using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using System.Text.Json;

namespace ArtCatalog;

internal static class FavoriteEndpoints
{
    internal static void Map(WebApplication app, Func<HttpRequest, bool> sameOrigin)
    {
        app.MapGet("/api/favorite-artwork-groups", (LocalStore store) =>
        {
            try { return Results.Ok(store.GetFavoriteArtworkGroups()); }
            catch (Exception error) when (error is IOException or JsonException or UnauthorizedAccessException)
            { return Results.Problem("Favorite groups could not be read.", statusCode: 503); }
        });
        app.MapPost("/api/favorite-artwork-groups", async (HttpContext context, LocalStore store) =>
        {
            if (!sameOrigin(context.Request)) return Results.StatusCode(403);
            if (context.Request.ContentLength is > 4096) return Results.StatusCode(413);
            var limit = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = 4096;
            try
            {
                var update = await context.Request.ReadFromJsonAsync<FavoriteArtworkGroupUpdate>(context.RequestAborted);
                if (update is null) return Results.BadRequest();
                return Results.Ok(store.GroupFavoriteArtworks(update.FromKey, update.ToKey, update.UngroupId));
            }
            catch (BadHttpRequestException error) { return Results.StatusCode(error.StatusCode); }
            catch (ArgumentException) { return Results.BadRequest(); }
            catch (Exception error) when (error is IOException or JsonException or UnauthorizedAccessException)
            { return Results.Problem("Favorite groups could not be saved. Existing choices were kept.", statusCode: 503); }
        });
        app.MapGet("/api/favorite-artworks", (LocalStore store) => Results.Ok(store.GetFavoriteArtworks()));
        app.MapPost("/api/favorite-artworks", async (HttpContext context, LocalStore store) =>
        {
            if (!sameOrigin(context.Request)) return Results.StatusCode(403);
            if (context.Request.ContentLength is > 1_000_000) return Results.StatusCode(413);
            var limit = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = 1_000_000;
            try
            {
                var update = await context.Request.ReadFromJsonAsync<FavoriteArtworkUpdate>(context.RequestAborted);
                if (update is null) return Results.BadRequest();
                return Results.Ok(store.SetFavoriteArtwork(update.Item, update.Favorite));
            }
            catch (BadHttpRequestException error) { return Results.StatusCode(error.StatusCode); }
            catch (Exception error) when (error is JsonException or ArgumentException) { return Results.BadRequest(); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            { return Results.Problem("Favorite artwork could not be saved.", statusCode: 503); }
        });
        app.MapGet("/api/favorites", (HttpContext context, LocalStore store) =>
        {
            var rating = context.Request.Query["rating"].ToString();
            if (rating.Length == 0) rating = "all";
            if (rating is not ("general" or "explicit" or "all" or "questionable" or "explicit-only" or "none")) return Results.BadRequest();
            try { return Results.Ok(store.GetFavoriteActivity(rating)); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException or JsonException)
            { return Results.Problem("Viewing statistics could not be read.", statusCode: 503); }
        });
        app.MapPost("/api/favorites/activity", async (HttpContext context, LocalStore store) =>
        {
            if (!sameOrigin(context.Request)) return Results.StatusCode(403);
            if (context.Request.ContentLength is > 160_000) return Results.StatusCode(413);
            var limit = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = 160_000;
            try
            {
                var records = await context.Request.ReadFromJsonAsync<List<FavoriteViewUpdate>>(context.RequestAborted);
                if (records is null || records.Any(record => record is null)) return Results.BadRequest();
                store.RecordFavoriteActivity(records);
                return Results.Ok(new { recorded = true });
            }
            catch (BadHttpRequestException error) { return Results.StatusCode(error.StatusCode); }
            catch (Exception error) when (error is JsonException or ArgumentException) { return Results.BadRequest(); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            { return Results.Problem("Viewing statistics could not be saved.", statusCode: 503); }
        });
    }
}
