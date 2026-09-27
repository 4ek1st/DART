namespace ArtCatalog;

public sealed class CatalogParticipant
{
    public string Tag { get; set; } = "";
    public string Name { get; set; } = "";
    public string Role { get; set; } = "artist";
}

internal static class CatalogCredits
{
    // The catalog's artist category includes credited collaborators. Only explicit role
    // qualifiers distinguish them; ordinary post tags and uploader names are not evidence.
    public static string RoleForTag(string tag)
    {
        var normalized = tag.Replace('_', ' ').Trim().ToLowerInvariant();
        var start = normalized.LastIndexOf('(');
        var qualifier = start >= 0 && normalized.EndsWith(')')
            ? normalized[(start + 1)..^1].Trim() : "";
        return qualifier switch
        {
            "voice actor" or "voice actress" => "voice_actor",
            "sound editor" or "sound designer" or "sound effects" or "sfx" => "sound",
            "composer" or "musician" or "singer" or "vocalist" => "music",
            "writer" or "scriptwriter" => "writer",
            "colorist" or "colourist" => "colorist",
            "editor" or "video editor" => "editor",
            "translator" => "translator",
            "animator" => "animator",
            _ => "artist"
        };
    }

    public static void Apply(CatalogItem item, IEnumerable<string> confirmedTags)
    {
        item.Participants = confirmedTags.Where(tag => !string.IsNullOrWhiteSpace(tag))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(tag => new CatalogParticipant
                { Tag = tag, Name = tag.Replace('_', ' '), Role = RoleForTag(tag) })
            .OrderBy(person => person.Role == "artist" ? 0 : person.Role == "animator" ? 1 : 2)
            .ToList();
        var artist = item.Participants.FirstOrDefault(person => person.Role is "artist" or "animator");
        item.CreatorTag = artist?.Tag ?? "";
        item.CreatorName = artist?.Name ?? "";
        if (item.Source == "danbooru")
        {
            item.ArtistId = item.CreatorTag;
            item.Artist = artist?.Name ?? "Неизвестный автор";
        }
    }

    public static string RoleLabel(string role) => role switch
    {
        "artist" => "Художник", "animator" => "Анимация", "voice_actor" => "Озвучка",
        "sound" => "Звук", "music" => "Музыка", "writer" => "Сценарий",
        "colorist" => "Колорист", "editor" => "Монтаж", "translator" => "Перевод",
        _ => "Участник"
    };
}
