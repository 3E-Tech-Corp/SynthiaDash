namespace SynthiaDash.Api.Models;

public class ChatMessage
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string SessionKey { get; set; } = "";
    public string Role { get; set; } = "user"; // user, assistant
    public string Content { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public class SendChatRequest
{
    public string Message { get; set; } = "";
}

public class ChatHistoryResponse
{
    public List<ChatMessage> Messages { get; set; } = new();
    public string ChatAccess { get; set; } = "none";
    public string? ProjectName { get; set; }
    public string? RepoFullName { get; set; }
}
