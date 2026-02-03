namespace SynthiaDash.Api.Models;

public class FeaturedProject
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? ProjectId { get; set; }
    public string Url { get; set; } = string.Empty;
    public string? ThumbnailPath { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public class CreateFeaturedProjectRequest
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? ProjectId { get; set; }
    public string Url { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdateFeaturedProjectRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public int? ProjectId { get; set; }
    public string? Url { get; set; }
    public int? SortOrder { get; set; }
    public bool? IsActive { get; set; }
}

public class ReorderItem
{
    public int Id { get; set; }
    public int SortOrder { get; set; }
}
