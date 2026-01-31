using System.Collections.Concurrent;
using System.Text.Json;
using SynthiaDash.Api.Models;

namespace SynthiaDash.Api.Services;

public interface ITaskService
{
    Task<AgentTask> CreateTaskAsync(string repoFullName, string errorContent, string? customPrompt);
    Task<AgentTask?> GetTaskAsync(string id);
    Task<List<AgentTask>> GetTasksAsync(int limit = 20);
    Task<AgentTask?> CompleteTaskAsync(string id, string status, string result, string? prUrl);
    Task TriggerAgentAsync(AgentTask task);
}

public class TaskService : ITaskService
{
    private readonly ConcurrentDictionary<string, AgentTask> _tasks = new();
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TaskService> _logger;
    private readonly string _tasksFilePath;

    public TaskService(IHttpClientFactory httpClientFactory, IConfiguration configuration, ILogger<TaskService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;

        // Persist tasks to a JSON file next to the app
        var dataDir = Path.Combine(AppContext.BaseDirectory, "data");
        Directory.CreateDirectory(dataDir);
        _tasksFilePath = Path.Combine(dataDir, "tasks.json");

        LoadTasks();
    }

    private void LoadTasks()
    {
        try
        {
            if (File.Exists(_tasksFilePath))
            {
                var json = File.ReadAllText(_tasksFilePath);
                var tasks = JsonSerializer.Deserialize<List<AgentTask>>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
                foreach (var t in tasks)
                    _tasks[t.Id] = t;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load tasks from {Path}", _tasksFilePath);
        }
    }

    private void SaveTasks()
    {
        try
        {
            var json = JsonSerializer.Serialize(_tasks.Values.OrderByDescending(t => t.CreatedAt).ToList(),
                new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(_tasksFilePath, json);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to save tasks to {Path}", _tasksFilePath);
        }
    }

    public Task<AgentTask> CreateTaskAsync(string repoFullName, string errorContent, string? customPrompt)
    {
        var task = new AgentTask
        {
            RepoFullName = repoFullName,
            ErrorContent = errorContent,
            Prompt = customPrompt,
            SessionKey = $"hook:dash:{Guid.NewGuid():N}"[..24],
            Status = "pending"
        };
        _tasks[task.Id] = task;
        SaveTasks();
        return Task.FromResult(task);
    }

    public Task<AgentTask?> GetTaskAsync(string id)
    {
        _tasks.TryGetValue(id, out var task);
        return Task.FromResult(task);
    }

    public Task<List<AgentTask>> GetTasksAsync(int limit = 20)
    {
        var tasks = _tasks.Values
            .OrderByDescending(t => t.CreatedAt)
            .Take(limit)
            .ToList();
        return Task.FromResult(tasks);
    }

    public Task<AgentTask?> CompleteTaskAsync(string id, string status, string result, string? prUrl)
    {
        if (!_tasks.TryGetValue(id, out var task))
            return Task.FromResult<AgentTask?>(null);

        task.Status = status;
        task.Result = result;
        task.PrUrl = prUrl;
        task.CompletedAt = DateTime.UtcNow;
        SaveTasks();
        return Task.FromResult<AgentTask?>(task);
    }

    public async Task TriggerAgentAsync(AgentTask task)
    {
        try
        {
            var gatewayBaseUrl = _configuration["Gateway:BaseUrl"] ?? "http://localhost:18789";
            var hookToken = _configuration["Gateway:HookToken"] ?? "";

            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {hookToken}");

            var callbackUrl = _configuration["App:BaseUrl"] ?? "https://ai.3eweb.com";

            var callbackEndpoint = $"{callbackUrl}/api/tasks/{task.Id}/complete";
            var additionalInstructions = string.IsNullOrEmpty(task.Prompt) ? "" : $"\n### Additional Instructions:\n{task.Prompt}\n";

            var message = $"## Agent Task: Fix Build Errors\n\n"
                + $"**Repository:** {task.RepoFullName}\n"
                + $"**Task ID:** {task.Id}\n"
                + $"**Dashboard Callback:** POST {callbackEndpoint}\n\n"
                + $"### Error Content (from ErrorMessage.md):\n```\n{task.ErrorContent}\n```\n"
                + additionalInstructions
                + "\n### Your Mission:\n"
                + "1. Analyze the build/compile errors above\n"
                + $"2. Clone or navigate to the repo: {task.RepoFullName}\n"
                + "3. Fix the code issues\n"
                + "4. Commit and push the fixes\n"
                + $"5. When done, use web_fetch or exec curl to POST to: {callbackEndpoint}\n"
                + "   Body (JSON): {\"status\": \"completed\", \"result\": \"Your summary\", \"prUrl\": \"optional\"}\n";

            var payload = new
            {
                message,
                name = "Dashboard",
                sessionKey = task.SessionKey,
                deliver = true,
                channel = "telegram",
                timeoutSeconds = 300
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

            // Mark as running
            task.Status = "running";
            SaveTasks();

            var response = await client.PostAsync($"{gatewayBaseUrl}/hooks/agent", content);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogError("Hook trigger failed: {Status} {Body}", response.StatusCode, body);
                task.Status = "failed";
                task.Result = $"Failed to trigger agent: {response.StatusCode}";
                SaveTasks();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to trigger agent for task {TaskId}", task.Id);
            task.Status = "failed";
            task.Result = $"Failed to trigger agent: {ex.Message}";
            SaveTasks();
        }
    }
}
