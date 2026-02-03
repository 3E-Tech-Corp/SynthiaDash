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
    Task<List<Project>> GetProjectsForUserAsync(int userId);
    Task<int> GetProjectCountForUserAsync(int userId);
    Task<Project?> UpdateProjectStatusAsync(int id, string status, string? detail = null, string? error = null);
    Task<Project?> UpdateProjectAsync(int id, UpdateProjectRequest request);
    Task ProvisionProjectAsync(Project project);
    Task<Project?> GetProjectForUserAsync(int userId, string? repoFullName = null);
    Task SetProjectBriefAsync(int projectId, string brief);
    Task<(string? brief, DateTime? setAt)?> GetProjectBriefAsync(int projectId);

    // Project members
    Task<List<ProjectMember>> GetProjectMembersAsync(int projectId);
    Task<ProjectMember?> AddProjectMemberAsync(int projectId, int userId, string role, int? addedBy);
    Task<bool> RemoveProjectMemberAsync(int projectId, int userId);
    Task<bool> UpdateProjectMemberRoleAsync(int projectId, int userId, string role);
    Task<bool> IsProjectMemberAsync(int projectId, int userId);
    Task<string?> GetMemberRoleAsync(int projectId, int userId);
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

    public async Task<int> GetProjectCountForUserAsync(int userId)
    {
        using var db = new SqlConnection(_connectionString);
        // Count projects where user is the owner (via ProjectMembers)
        // Fall back to CreatedByUserId for backwards compatibility
        return await db.ExecuteScalarAsync<int>(
            @"SELECT COUNT(DISTINCT p.Id) FROM Projects p
              LEFT JOIN ProjectMembers pm ON pm.ProjectId = p.Id AND pm.UserId = @UserId AND pm.Role = 'owner'
              WHERE pm.Id IS NOT NULL OR p.CreatedByUserId = @UserId",
            new { UserId = userId });
    }

    public async Task<List<Project>> GetProjectsForUserAsync(int userId)
    {
        using var db = new SqlConnection(_connectionString);
        // Return projects where user is a member (any role) via ProjectMembers
        // Fall back to CreatedByUserId for backwards compatibility
        var projects = await db.QueryAsync<Project>(
            @"SELECT DISTINCT p.*, u.Email AS CreatedByEmail
              FROM Projects p
              LEFT JOIN Users u ON p.CreatedByUserId = u.Id
              LEFT JOIN ProjectMembers pm ON pm.ProjectId = p.Id AND pm.UserId = @UserId
              WHERE pm.Id IS NOT NULL OR p.CreatedByUserId = @UserId
              ORDER BY p.CreatedAt DESC",
            new { UserId = userId });
        return projects.ToList();
    }

    public async Task<Project> CreateProjectAsync(CreateProjectRequest request, int userId, string email)
    {
        using var db = new SqlConnection(_connectionString);

        var org = _configuration["GitHub:Org"] ?? "3E-Tech-Corp";
        var repoFullName = request.LinkExisting && !string.IsNullOrWhiteSpace(request.RepoFullName)
            ? request.RepoFullName
            : $"{org}/{request.Slug}";

        // For linked repos, set status to ready immediately
        var initialStatus = request.LinkExisting ? "ready" : "pending";

        // First insert with placeholder names to get the identity Id
        var id = await db.QuerySingleAsync<int>(
            @"INSERT INTO Projects (Name, Slug, Domain, RepoFullName, DatabaseName, IisSiteName, CreatedByUserId, Description, Status)
              OUTPUT INSERTED.Id
              VALUES (@Name, @Slug, @Domain, @RepoFullName, '_pending', '_pending', @UserId, @Description, @Status)",
            new
            {
                request.Name,
                request.Slug,
                request.Domain,
                RepoFullName = repoFullName,
                UserId = userId,
                request.Description,
                Status = initialStatus
            });

        if (!request.LinkExisting)
        {
            // Build convention-based names: Demo_{Id}_{Title}
            // Title = PascalCase from project name (e.g. "Dress App" -> "DressApp")
            var titlePart = string.Concat(request.Name
                .Split(' ', '-', '_')
                .Where(w => !string.IsNullOrWhiteSpace(w))
                .Select(w => char.ToUpper(w[0]) + w[1..].ToLower()));
            var conventionName = $"Demo_{id}_{titlePart}";

            var dbName = conventionName;
            var iisSiteName = conventionName;

            // Update with the real convention-based names
            await db.ExecuteAsync(
                @"UPDATE Projects SET DatabaseName = @DbName, IisSiteName = @IisSiteName WHERE Id = @Id",
                new { DbName = dbName, IisSiteName = iisSiteName, Id = id });
        }
        else
        {
            // For linked repos, use project name as IIS site name and no DB
            await db.ExecuteAsync(
                @"UPDATE Projects SET DatabaseName = '', IisSiteName = @IisSiteName, ReadyAt = GETUTCDATE() WHERE Id = @Id",
                new { IisSiteName = request.Name, Id = id });
        }

        // Add creator as owner in ProjectMembers
        await db.ExecuteAsync(
            @"INSERT INTO ProjectMembers (ProjectId, UserId, Role, AddedBy)
              VALUES (@ProjectId, @UserId, 'owner', @UserId)",
            new { ProjectId = id, UserId = userId });

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

    public async Task<Project?> GetProjectForUserAsync(int userId, string? repoFullName = null)
    {
        using var db = new SqlConnection(_connectionString);

        if (!string.IsNullOrEmpty(repoFullName))
        {
            // Try to match by repo first (check membership or ownership)
            var byRepo = await db.QueryFirstOrDefaultAsync<Project>(
                @"SELECT p.*, u.Email AS CreatedByEmail
                  FROM Projects p
                  LEFT JOIN Users u ON p.CreatedByUserId = u.Id
                  LEFT JOIN ProjectMembers pm ON pm.ProjectId = p.Id AND pm.UserId = @UserId
                  WHERE p.RepoFullName = @RepoFullName
                    AND (pm.Id IS NOT NULL OR p.CreatedByUserId = @UserId)",
                new { RepoFullName = repoFullName, UserId = userId });
            if (byRepo != null) return byRepo;
        }

        // Fall back to most recent project for this user
        return await db.QueryFirstOrDefaultAsync<Project>(
            @"SELECT TOP 1 p.*, u.Email AS CreatedByEmail
              FROM Projects p
              LEFT JOIN Users u ON p.CreatedByUserId = u.Id
              LEFT JOIN ProjectMembers pm ON pm.ProjectId = p.Id AND pm.UserId = @UserId
              WHERE pm.Id IS NOT NULL OR p.CreatedByUserId = @UserId
              ORDER BY p.CreatedAt DESC",
            new { UserId = userId });
    }

    public async Task SetProjectBriefAsync(int projectId, string brief)
    {
        using var db = new SqlConnection(_connectionString);
        await db.ExecuteAsync(
            @"UPDATE Projects SET ProjectBrief = @Brief, ProjectBriefSetAt = GETUTCDATE() WHERE Id = @Id",
            new { Id = projectId, Brief = brief });
    }

    public async Task<(string? brief, DateTime? setAt)?> GetProjectBriefAsync(int projectId)
    {
        using var db = new SqlConnection(_connectionString);
        var result = await db.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT ProjectBrief, ProjectBriefSetAt FROM Projects WHERE Id = @Id",
            new { Id = projectId });
        if (result == null) return null;
        return ((string?)result.ProjectBrief, (DateTime?)result.ProjectBriefSetAt);
    }

    public async Task<Project?> UpdateProjectAsync(int id, UpdateProjectRequest request)
    {
        using var db = new SqlConnection(_connectionString);

        var updates = new List<string>();
        var parameters = new DynamicParameters();
        parameters.Add("Id", id);

        if (request.Name != null)
        {
            updates.Add("Name = @Name");
            parameters.Add("Name", request.Name);
        }
        if (request.Description != null)
        {
            updates.Add("Description = @Description");
            parameters.Add("Description", request.Description);
        }
        if (request.RepoFullName != null)
        {
            updates.Add("RepoFullName = @RepoFullName");
            parameters.Add("RepoFullName", request.RepoFullName);
        }
        if (request.Domain != null)
        {
            updates.Add("Domain = @Domain");
            parameters.Add("Domain", request.Domain);
        }

        if (updates.Count == 0)
            return await GetProjectAsync(id);

        var sql = $"UPDATE Projects SET {string.Join(", ", updates)} WHERE Id = @Id";
        await db.ExecuteAsync(sql, parameters);

        return await GetProjectAsync(id);
    }

    // ─── Project Members ────────────────────────────────────────

    public async Task<List<ProjectMember>> GetProjectMembersAsync(int projectId)
    {
        using var db = new SqlConnection(_connectionString);
        var members = await db.QueryAsync<ProjectMember>(
            @"SELECT pm.*, u.Email AS UserEmail, u.DisplayName AS UserDisplayName
              FROM ProjectMembers pm
              INNER JOIN Users u ON pm.UserId = u.Id
              WHERE pm.ProjectId = @ProjectId
              ORDER BY CASE pm.Role WHEN 'owner' THEN 0 WHEN 'developer' THEN 1 WHEN 'viewer' THEN 2 ELSE 3 END, pm.AddedAt",
            new { ProjectId = projectId });
        return members.ToList();
    }

    public async Task<ProjectMember?> AddProjectMemberAsync(int projectId, int userId, string role, int? addedBy)
    {
        using var db = new SqlConnection(_connectionString);

        // Validate role
        var validRoles = new[] { "owner", "developer", "viewer" };
        if (!validRoles.Contains(role.ToLower()))
            return null;

        try
        {
            var id = await db.QuerySingleAsync<int>(
                @"INSERT INTO ProjectMembers (ProjectId, UserId, Role, AddedBy)
                  OUTPUT INSERTED.Id
                  VALUES (@ProjectId, @UserId, @Role, @AddedBy)",
                new { ProjectId = projectId, UserId = userId, Role = role.ToLower(), AddedBy = addedBy });

            return await db.QueryFirstOrDefaultAsync<ProjectMember>(
                @"SELECT pm.*, u.Email AS UserEmail, u.DisplayName AS UserDisplayName
                  FROM ProjectMembers pm
                  INNER JOIN Users u ON pm.UserId = u.Id
                  WHERE pm.Id = @Id",
                new { Id = id });
        }
        catch (SqlException ex) when (ex.Number == 2627 || ex.Number == 2601) // Unique constraint violation
        {
            return null; // Already a member
        }
    }

    public async Task<bool> RemoveProjectMemberAsync(int projectId, int userId)
    {
        using var db = new SqlConnection(_connectionString);
        var affected = await db.ExecuteAsync(
            "DELETE FROM ProjectMembers WHERE ProjectId = @ProjectId AND UserId = @UserId",
            new { ProjectId = projectId, UserId = userId });
        return affected > 0;
    }

    public async Task<bool> UpdateProjectMemberRoleAsync(int projectId, int userId, string role)
    {
        var validRoles = new[] { "owner", "developer", "viewer" };
        if (!validRoles.Contains(role.ToLower()))
            return false;

        using var db = new SqlConnection(_connectionString);
        var affected = await db.ExecuteAsync(
            "UPDATE ProjectMembers SET Role = @Role WHERE ProjectId = @ProjectId AND UserId = @UserId",
            new { ProjectId = projectId, UserId = userId, Role = role.ToLower() });
        return affected > 0;
    }

    public async Task<bool> IsProjectMemberAsync(int projectId, int userId)
    {
        using var db = new SqlConnection(_connectionString);
        return await db.ExecuteScalarAsync<bool>(
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM ProjectMembers WHERE ProjectId = @ProjectId AND UserId = @UserId) THEN 1 ELSE 0 END",
            new { ProjectId = projectId, UserId = userId });
    }

    public async Task<string?> GetMemberRoleAsync(int projectId, int userId)
    {
        using var db = new SqlConnection(_connectionString);
        return await db.ExecuteScalarAsync<string?>(
            "SELECT Role FROM ProjectMembers WHERE ProjectId = @ProjectId AND UserId = @UserId",
            new { ProjectId = projectId, UserId = userId });
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
