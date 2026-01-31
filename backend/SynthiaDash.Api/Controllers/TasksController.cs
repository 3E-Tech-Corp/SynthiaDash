using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SynthiaDash.Api.Models;
using SynthiaDash.Api.Services;

namespace SynthiaDash.Api.Controllers;

[ApiController]
[Route("[controller]")]
public class TasksController : ControllerBase
{
    private readonly ITaskService _taskService;
    private readonly IGitHubService _githubService;
    private readonly ILogger<TasksController> _logger;

    public TasksController(ITaskService taskService, IGitHubService githubService, ILogger<TasksController> logger)
    {
        _taskService = taskService;
        _githubService = githubService;
        _logger = logger;
    }

    /// <summary>
    /// List recent tasks
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetTasks([FromQuery] int limit = 20)
    {
        var tasks = await _taskService.GetTasksAsync(limit);
        return Ok(tasks);
    }

    /// <summary>
    /// Get a specific task
    /// </summary>
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetTask(string id)
    {
        var task = await _taskService.GetTaskAsync(id);
        if (task == null) return NotFound();
        return Ok(task);
    }

    /// <summary>
    /// Create a task: fetch ErrorMessage.md from the repo and trigger the agent
    /// </summary>
    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> CreateTask([FromBody] CreateTaskRequest request)
    {
        if (string.IsNullOrEmpty(request.RepoFullName))
            return BadRequest(new { message = "repoFullName is required" });

        // Fetch ErrorMessage.md from the repo
        string errorContent;
        try
        {
            errorContent = await FetchErrorMessageAsync(request.RepoFullName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch ErrorMessage.md from {Repo}", request.RepoFullName);
            return BadRequest(new { message = $"Could not fetch ErrorMessage.md: {ex.Message}" });
        }

        if (string.IsNullOrWhiteSpace(errorContent))
            return BadRequest(new { message = "ErrorMessage.md is empty or not found" });

        var task = await _taskService.CreateTaskAsync(request.RepoFullName, errorContent, request.CustomPrompt);

        // Fire and forget the agent trigger
        _ = Task.Run(() => _taskService.TriggerAgentAsync(task));

        return Ok(task);
    }

    /// <summary>
    /// Callback from the agent when task is complete
    /// </summary>
    [HttpPost("{id}/complete")]
    [AllowAnonymous]
    public async Task<IActionResult> CompleteTask(string id, [FromBody] CompleteTaskRequest request)
    {
        var task = await _taskService.CompleteTaskAsync(id, request.Status, request.Result, request.PrUrl);
        if (task == null) return NotFound();

        _logger.LogInformation("Task {TaskId} completed with status: {Status}", id, request.Status);
        return Ok(task);
    }

    private async Task<string> FetchErrorMessageAsync(string repoFullName)
    {
        using var client = new HttpClient();
        client.DefaultRequestHeaders.Add("User-Agent", "SynthiaDash");

        var token = HttpContext.RequestServices.GetRequiredService<IConfiguration>()["GitHub:Token"];
        if (!string.IsNullOrEmpty(token))
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");

        // Try to get ErrorMessage.md from the repo via GitHub API
        var response = await client.GetAsync(
            $"https://api.github.com/repos/{repoFullName}/contents/ErrorMessage.md");

        if (!response.IsSuccessStatusCode)
            throw new Exception($"ErrorMessage.md not found in {repoFullName}");

        var json = await response.Content.ReadAsStringAsync();
        var doc = System.Text.Json.JsonDocument.Parse(json);

        // Content is base64 encoded
        var contentBase64 = doc.RootElement.GetProperty("content").GetString() ?? "";
        var contentBytes = Convert.FromBase64String(contentBase64.Replace("\n", ""));
        return System.Text.Encoding.UTF8.GetString(contentBytes);
    }
}
