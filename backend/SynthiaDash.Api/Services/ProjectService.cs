using System.Text;
using System.Text.Json;
using Dapper;
using Microsoft.Data.SqlClient;
using SynthiaDash.Api.Models;

namespace SynthiaDash.Api.Services;

public interface IProjectService
{
    Task<Project> CreateProjectAsync(CreateProjectRequest request, int userId, string email);
    Task<Project?> GetProjectAsync(int id);
    Task<List<Project>> GetProjectsAsync();
    Task<Project?> UpdateProjectStatusAsync(int id, string status, string? detail = null, string? error = null);
    Task ProvisionProjectAsync(Project project);
}

public class ProjectService : IProjectService
{
    private readonly string _connectionString;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly INotificationService _notificationService;
    private readonly ILogger<ProjectService> _logger;

    public ProjectService(
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        INotificationService notificationService,
        ILogger<ProjectService> logger)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new ArgumentNullException("ConnectionStrings:DefaultConnection");
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<Project> CreateProjectAsync(CreateProjectRequest request, int userId, string email)
    {
        using var db = new SqlConnection(_connectionString);

        var repoFullName = $"{_configuration["GitHub:Org"] ?? "3E-Tech-Corp"}/{request.Slug}";
        var dbName = $"{request.Slug}_DB";
        var iisSiteName = request.Domain;

        var id = await db.QuerySingleAsync<int>(
            @"INSERT INTO Projects (Name, Slug, Domain, RepoFullName, DatabaseName, IisSiteName, CreatedByUserId)
              OUTPUT INSERTED.Id
              VALUES (@Name, @Slug, @Domain, @RepoFullName, @DatabaseName, @IisSiteName, @UserId)",
            new
            {
                request.Name,
                request.Slug,
                request.Domain,
                RepoFullName = repoFullName,
                DatabaseName = dbName,
                IisSiteName = iisSiteName,
                UserId = userId
            });

        var project = (await GetProjectAsync(id))!;
        return project;
    }

    public async Task<Project?> GetProjectAsync(int id)
    {
        using var db = new SqlConnection(_connectionString);
        return await db.QueryFirstOrDefaultAsync<Project>(
            @"SELECT p.*, u.Email AS CreatedByEmail
              FROM Projects p
              LEFT JOIN Users u ON p.CreatedByUserId = u.Id
              WHERE p.Id = @Id", new { Id = id });
    }

    public async Task<List<Project>> GetProjectsAsync()
    {
        using var db = new SqlConnection(_connectionString);
        var projects = await db.QueryAsync<Project>(
            @"SELECT p.*, u.Email AS CreatedByEmail
              FROM Projects p
              LEFT JOIN Users u ON p.CreatedByUserId = u.Id
              ORDER BY p.CreatedAt DESC");
        return projects.ToList();
    }

    public async Task<Project?> UpdateProjectStatusAsync(int id, string status, string? detail = null, string? error = null)
    {
        using var db = new SqlConnection(_connectionString);

        var updates = new List<string> { "Status = @Status" };
        var parameters = new DynamicParameters();
        parameters.Add("Id", id);
        parameters.Add("Status", status);

        if (detail != null)
        {
            updates.Add("StatusDetail = @Detail");
            parameters.Add("Detail", detail);
        }
        if (error != null)
        {
            updates.Add("Error = @Error");
            parameters.Add("Error", error);
        }
        if (status == "ready")
        {
            updates.Add("ReadyAt = GETUTCDATE()");
        }

        var sql = $"UPDATE Projects SET {string.Join(", ", updates)} WHERE Id = @Id";
        await db.ExecuteAsync(sql, parameters);

        return await GetProjectAsync(id);
    }

    /// <summary>
    /// Full provisioning pipeline: create repo from template, trigger IIS/DB setup
    /// </summary>
    public async Task ProvisionProjectAsync(Project project)
    {
        var org = _configuration["GitHub:Org"] ?? "3E-Tech-Corp";
        var templateRepo = _configuration["Provisioning:TemplateRepo"] ?? "project-template";
        var githubToken = _configuration["GitHub:Token"] ?? "";

        try
        {
            // Step 1: Create repo from template
            await UpdateProjectStatusAsync(project.Id, "provisioning", "Creating GitHub repository...");
            _logger.LogInformation("Creating repo {Repo} from template {Template}", project.RepoFullName, templateRepo);

            var client = _httpClientFactory.CreateClient("GitHub");

            var createRepoPayload = new
            {
                owner = org,
                name = project.Slug,
                description = $"{project.Name} - Auto-provisioned project",
                @private = false,
                include_all_branches = false
            };

            var createContent = new StringContent(
                JsonSerializer.Serialize(createRepoPayload), Encoding.UTF8, "application/json");

            var repoResponse = await client.PostAsync(
                $"repos/{org}/{templateRepo}/generate", createContent);

            if (!repoResponse.IsSuccessStatusCode)
            {
                var body = await repoResponse.Content.ReadAsStringAsync();
                throw new Exception($"Failed to create repo: {repoResponse.StatusCode} — {body}");
            }

            _logger.LogInformation("Repo {Repo} created successfully", project.RepoFullName);

            // Step 2: Set repo variables for deployment
            await UpdateProjectStatusAsync(project.Id, "provisioning", "Configuring repository variables...");

            // Set IIS_SITE_NAME variable
            var varPayload = new { name = "IIS_SITE_NAME", value = project.IisSiteName };
            var varContent = new StringContent(
                JsonSerializer.Serialize(varPayload), Encoding.UTF8, "application/json");
            await client.PostAsync($"repos/{project.RepoFullName}/actions/variables", varContent);

            // Set DB_NAME variable
            var dbVarPayload = new { name = "DB_NAME", value = project.DatabaseName };
            var dbVarContent = new StringContent(
                JsonSerializer.Serialize(dbVarPayload), Encoding.UTF8, "application/json");
            await client.PostAsync($"repos/{project.RepoFullName}/actions/variables", dbVarContent);

            // Set DOMAIN variable
            var domainVarPayload = new { name = "DOMAIN", value = project.Domain };
            var domainVarContent = new StringContent(
                JsonSerializer.Serialize(domainVarPayload), Encoding.UTF8, "application/json");
            await client.PostAsync($"repos/{project.RepoFullName}/actions/variables", domainVarContent);

            // Step 3: Trigger provisioning workflow (IIS + DB creation on self-hosted runner)
            await UpdateProjectStatusAsync(project.Id, "provisioning", "Setting up IIS site and database...");

            // Wait a moment for the repo to be fully ready
            await Task.Delay(5000);

            // Trigger the provision workflow
            var provisionPayload = new
            {
                @ref = "main",
                inputs = new
                {
                    site_name = project.IisSiteName,
                    db_name = project.DatabaseName,
                    domain = project.Domain,
                    project_name = project.Name
                }
            };

            // Try to trigger provision.yml workflow
            var provisionContent = new StringContent(
                JsonSerializer.Serialize(provisionPayload), Encoding.UTF8, "application/json");

            // First check if the workflow exists (it may take a moment for GitHub to index it)
            for (int attempt = 0; attempt < 5; attempt++)
            {
                var wfResponse = await client.GetAsync($"repos/{project.RepoFullName}/actions/workflows");
                if (wfResponse.IsSuccessStatusCode)
                {
                    var wfJson = await wfResponse.Content.ReadAsStringAsync();
                    var wfDoc = JsonDocument.Parse(wfJson);
                    var count = wfDoc.RootElement.GetProperty("total_count").GetInt32();
                    if (count > 0) break;
                }
                _logger.LogInformation("Waiting for workflows to be indexed (attempt {N})...", attempt + 1);
                await Task.Delay(3000);
            }

            // Find and trigger the provision workflow
            var workflowsResp = await client.GetAsync($"repos/{project.RepoFullName}/actions/workflows");
            if (workflowsResp.IsSuccessStatusCode)
            {
                var wfJson = await workflowsResp.Content.ReadAsStringAsync();
                var wfDoc = JsonDocument.Parse(wfJson);
                var workflows = wfDoc.RootElement.GetProperty("workflows");

                long? provisionWorkflowId = null;
                long? deployWorkflowId = null;

                foreach (var wf in workflows.EnumerateArray())
                {
                    var name = wf.GetProperty("name").GetString()?.ToLower() ?? "";
                    if (name.Contains("provision")) provisionWorkflowId = wf.GetProperty("id").GetInt64();
                    if (name.Contains("deploy")) deployWorkflowId = wf.GetProperty("id").GetInt64();
                }

                if (provisionWorkflowId != null)
                {
                    var triggerResp = await client.PostAsync(
                        $"repos/{project.RepoFullName}/actions/workflows/{provisionWorkflowId}/dispatches",
                        provisionContent);

                    if (triggerResp.IsSuccessStatusCode)
                    {
                        await UpdateProjectStatusAsync(project.Id, "provisioning",
                            "Provisioning workflow triggered. IIS site and database being created...");
                    }
                    else
                    {
                        _logger.LogWarning("Could not trigger provision workflow, will need manual IIS/DB setup");
                        await UpdateProjectStatusAsync(project.Id, "provisioning",
                            "Repo created. IIS site and database need manual setup on FTPB1.");
                    }
                }
                else
                {
                    _logger.LogWarning("No provision workflow found in template");
                    await UpdateProjectStatusAsync(project.Id, "provisioning",
                        "Repo created. No provisioning workflow found — set up IIS/DB manually.");
                }
            }

            // Step 4: Notify and mark as ready (or provisioning if waiting for workflow)
            await UpdateProjectStatusAsync(project.Id, "ready",
                $"Repository created at github.com/{project.RepoFullName}. Site: {project.Domain}");

            // Notify Feng
            await _notificationService.NotifyProjectProvisioned(project);

            _logger.LogInformation("Project {Name} provisioning complete", project.Name);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Project provisioning failed for {Name}", project.Name);
            await UpdateProjectStatusAsync(project.Id, "failed", error: ex.Message);
        }
    }
}
