using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace ArtCatalog;

internal static class SourceStatusEndpoints
{
    internal static void Map(WebApplication app) => app.MapGet("/api/source-status", (HttpContext context) =>
    {
        context.Response.Headers.CacheControl = "no-store";
        return Results.Ok(SourceAvailability.Default.Snapshot());
    });
}
