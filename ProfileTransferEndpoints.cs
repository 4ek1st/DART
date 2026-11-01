using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace ArtCatalog;

internal static class ProfileTransferEndpoints
{
    internal static void Map(WebApplication app)
    {
        app.MapGet("/api/profile-transfer/export", (LocalStore store) =>
        {
            try
            {
                return Results.File(JsonSerializer.SerializeToUtf8Bytes(store.ExportProfileTransfer(), ProfileTransfer.Json),
                    "application/json", "DART-profile-" + DateTimeOffset.UtcNow.ToString("yyyy-MM-dd") + ".json");
            }
            catch (Exception error) when (error is JsonException or InvalidDataException or IOException)
            { return Results.Problem("Could not export the profile. Existing data has been preserved.", statusCode: 409); }
        });
        app.MapPost("/api/profile-transfer/preview", async (HttpContext context) =>
        {
            if (!SameOrigin(context)) return Results.StatusCode(403);
            try
            {
                var document = ProfileTransfer.Parse(await Read(context));
                return Results.Json(ProfileTransfer.Counts(document));
            }
            catch (ProfileTooLargeException) { return Results.Problem("Profile file exceeds 20 MB.", statusCode: 413); }
            catch (Exception error) when (error is JsonException or InvalidDataException or FormatException or InvalidOperationException or ArgumentException or DecoderFallbackException)
            { return Results.Problem("The file is not a supported DART profile, or contains invalid values.", statusCode: 400); }
        });
        app.MapPost("/api/profile-transfer/import", async (HttpContext context, LocalStore store) =>
        {
            if (!SameOrigin(context)) return Results.StatusCode(403);
            if (context.Request.Query["applySettings"].ToString() is not ("" or "true" or "false")) return Results.BadRequest();
            try
            {
                var document = ProfileTransfer.Parse(await Read(context));
                return Results.Json(store.ImportProfileTransfer(document, context.Request.Query["applySettings"] == "true"));
            }
            catch (ProfileTooLargeException) { return Results.Problem("Profile file exceeds 20 MB.", statusCode: 413); }
            catch (Exception error) when (error is JsonException or InvalidDataException or FormatException or InvalidOperationException or ArgumentException or DecoderFallbackException)
            { return Results.Problem("The profile could not be merged. Existing data has been preserved.", statusCode: 400); }
            catch (IOException) { return Results.Problem("The profile could not be saved. A verified local backup has been kept.", statusCode: 409); }
        });
    }
    private static bool SameOrigin(HttpContext context) => string.Equals(context.Request.Headers.Origin,
        $"{context.Request.Scheme}://{context.Request.Host}", StringComparison.OrdinalIgnoreCase);
    private sealed class ProfileTooLargeException : Exception;
    private static async Task<string> Read(HttpContext context)
    {
        if (context.Request.ContentLength is > ProfileTransfer.MaxBytes) throw new ProfileTooLargeException();
        using var output = new MemoryStream(); var buffer = new byte[8192]; int count;
        while ((count = await context.Request.Body.ReadAsync(buffer, context.RequestAborted)) > 0)
        {
            if (output.Length + count > ProfileTransfer.MaxBytes) throw new ProfileTooLargeException();
            output.Write(buffer, 0, count);
        }
        return new UTF8Encoding(false, true).GetString(output.ToArray());
    }
}
