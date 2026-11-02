using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;

namespace ArtCatalog;

internal static class UpscaleEndpoints
{
    internal static void Map(WebApplication app)
    {
        app.MapGet("/api/upscale", (UpscaleComponent module, ImageUpscaleService jobs) =>
            Results.Json(new { component = module.Status, cacheBytes = jobs.CacheBytes(), preferences = module.Preferences }));
        app.MapPost("/api/upscale/preferences", async (HttpContext context, UpscaleComponent module) =>
        {
            if (!SameOrigin(context)) return Results.StatusCode(403);
            try
            {
                if (context.Request.ContentLength > 1024) return Error("scale", 400);
                var value = await context.Request.ReadFromJsonAsync<UpscalePreferences>(context.RequestAborted);
                return value is null ? Error("scale", 400) : Results.Json(module.SetScale(value.Scale));
            }
            catch (UpscaleException e) { return Error(e.Code, 400); }
            catch (System.Text.Json.JsonException) { return Error("scale", 400); }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException) { return Error("storage", 409); }
        });
        app.MapPost("/api/upscale/install", (HttpContext context, UpscaleComponent module) =>
            Mutate(context, () => { module.StartInstall(); return Results.Json(module.Status); }));
        app.MapPost("/api/upscale/install/cancel", (HttpContext context, UpscaleComponent module) =>
            Mutate(context, () => { module.CancelInstall(); return Results.Ok(); }));
        app.MapPost("/api/upscale/remove", (HttpContext context, UpscaleComponent module) =>
            Mutate(context, () => { module.Remove(); return Results.Json(module.Status); }));
        app.MapPost("/api/upscale/cache/clear", (HttpContext context, ImageUpscaleService jobs) =>
            Mutate(context, () => { jobs.ClearCache(); return Results.Ok(); }));
        app.MapPost("/api/upscale/jobs", async (HttpContext context, ImageUpscaleService jobs) =>
        {
            if (!SameOrigin(context)) return Results.StatusCode(403);
            if (context.Request.ContentType?.Split(';')[0] != "image/png") return Error("image", 415);
            if (!int.TryParse(context.Request.Query["scale"], out var scale) || scale is not (2 or 4)) return Error("scale", 400);
            if (context.Request.ContentLength > UpscalePng.MaxInputBytes) return Error("too-large", 413);
            var sizeFeature = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (sizeFeature is { IsReadOnly: false }) sizeFeature.MaxRequestBodySize = UpscalePng.MaxInputBytes;
            try
            {
                using var data = new MemoryStream(); var buffer = new byte[64 * 1024]; int count;
                while ((count = await context.Request.Body.ReadAsync(buffer, context.RequestAborted)) > 0)
                {
                    if (data.Length + count > UpscalePng.MaxInputBytes) return Error("too-large", 413);
                    data.Write(buffer, 0, count);
                }
                return Results.Json(await jobs.SubmitAsync(data.ToArray(), scale, context.RequestAborted));
            }
            catch (UpscaleException e) { return Error(e.Code, e.Code == "too-large" ? 413 : 409); }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException) { return Error("storage", 409); }
        });
        app.MapGet("/api/upscale/jobs/{id}", (string id, ImageUpscaleService jobs) =>
            jobs.Get(id) is { } job ? Results.Json(job) : Error("not-found", 404));
        app.MapPost("/api/upscale/jobs/{id}/cancel", (string id, HttpContext context, ImageUpscaleService jobs) =>
            Mutate(context, () => { jobs.Cancel(id); return Results.Ok(); }));
        app.MapGet("/api/upscale/jobs/{id}/image", (string id, HttpContext context, ImageUpscaleService jobs) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            context.Response.Headers.XContentTypeOptions = "nosniff";
            return jobs.OpenResult(id) is { } stream ? Results.File(stream, "image/png",
                context.Request.Query["download"] == "1" ? "DART-upscale-" + jobs.Get(id)!.Scale + "x.png" : null,
                enableRangeProcessing: true) : Error("not-found", 404);
        });
    }
    private static IResult Mutate(HttpContext context, Func<IResult> action)
    {
        if (!SameOrigin(context)) return Results.StatusCode(403);
        try { return action(); }
        catch (UpscaleException e) { return Error(e.Code, 409); }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException) { return Error("storage", 409); }
    }
    private static bool SameOrigin(HttpContext context) => string.Equals(context.Request.Headers.Origin,
        $"{context.Request.Scheme}://{context.Request.Host}", StringComparison.OrdinalIgnoreCase);
    private static IResult Error(string code, int status) => Results.Json(new { error = code }, statusCode: status);
}
