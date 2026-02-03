namespace SynthiaDash.Api.Models;

public class CreateDemoRequest
{
    public string Email { get; set; } = "";
    public string Name { get; set; } = "";
    public string Reason { get; set; } = "";
}

public class UpdateDemoRequestStatus
{
    public string Status { get; set; } = ""; // "approved" or "rejected"
}

public class DemoRequest
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public string Name { get; set; } = "";
    public string Reason { get; set; } = "";
    public string? IpAddress { get; set; }
    public string? Location { get; set; }
    public string Status { get; set; } = "pending";
    public DateTime CreatedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public int? ReviewedBy { get; set; }
}
