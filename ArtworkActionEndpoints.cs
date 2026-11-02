using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using System.Text.Json;

namespace ArtCatalog;

internal static class ArtworkActionEndpoints
{
    internal static void Map(WebApplication app, Func<HttpRequest, bool> sameOrigin)
    {
        app.MapGet("/api/hidden-artworks", (LocalStore store) => Results.Ok(store.GetHiddenArtworks()));
        app.MapPost("/api/hidden-artworks", async (HttpContext context, LocalStore store) =>
        {
            if (!sameOrigin(context.Request)) return Results.StatusCode(403);
            if (context.Request.ContentLength is > 1_000_000) return Results.StatusCode(413);
            var limit = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = 1_000_000;
            try
            {
                var update = await context.Request.ReadFromJsonAsync<HiddenArtworkUpdate>(context.RequestAborted);
                if (update is null) return Results.BadRequest();
                var items = store.SetHiddenArtwork(update.Item, update.Hidden);
                return items is null ? Results.Conflict(new { error = "Hidden artwork limit reached." }) : Results.Ok(items);
            }
            catch (BadHttpRequestException error) { return Results.StatusCode(error.StatusCode); }
            catch (Exception error) when (error is JsonException or ArgumentException) { return Results.BadRequest(); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            { return Results.Problem("Hidden artworks could not be saved.", statusCode:503); }
        });
    }
}
