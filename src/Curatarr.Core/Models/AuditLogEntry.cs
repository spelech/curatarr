namespace Curatarr.Core.Models;

public class AuditLogEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string? MediaItemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string MediaType { get; set; } = string.Empty;
    public int? SeasonNumber { get; set; }
    public string InstancesAffectedJson { get; set; } = "[]";
    public long BytesFreed { get; set; }
    public bool AddedToImportExclusion { get; set; }
    public string Actor { get; set; } = "WebUI";
    public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;
    public string? Details { get; set; }
}

public static class SmartCategoryIds
{
    public const string NeverWatched = "never_watched";
    public const string Stale = "stale";
    public const string Abandoned = "abandoned";
    public const string CutoffUnmet = "cutoff_unmet";
    public const string SpaceHogs = "space_hogs";
    public const string Missing = "missing";
    public const string Protected = "protected";
    public const string All = "all";
}
