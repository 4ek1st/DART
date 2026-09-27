using System.Diagnostics;
using System.Text.Json;
using ArtCatalog.Updates;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace ArtCatalog;

internal static class UpdateEndpoints
{
    internal static void Map(WebApplication app)
    {
        app.MapGet("/api/updates", async (UpdateService updates, HttpContext context) =>
            Results.Ok(await updates.CheckAsync(false, context.RequestAborted)));
        bool SameOrigin(HttpContext context) => context.Request.Headers.Origin == $"{context.Request.Scheme}://{context.Request.Host}";
        app.MapPost("/api/updates/check", async (UpdateService updates, HttpContext context) =>
        {
            if (!SameOrigin(context)) return Results.StatusCode(403);
            try { return Results.Ok(await updates.CheckAsync(true, context.RequestAborted)); }
            catch (InvalidOperationException error) { return Results.BadRequest(new { error = error.Message }); }
        });
        app.MapPost("/api/updates/source", async (UpdateService updates, HttpContext context) =>
        {
            if (!SameOrigin(context)) return Results.StatusCode(403);
            if (context.Request.ContentLength is > 10_000) return Results.StatusCode(413);
            try
            {
                var source = await context.Request.ReadFromJsonAsync<UpdateSource>(context.RequestAborted);
                if (source?.Repository is null || source.Token is null) return Results.BadRequest();
                updates.Configure(source);
                return Results.Ok(await updates.CheckAsync(true, context.RequestAborted));
            }
            catch (Exception error) when (error is JsonException or InvalidOperationException)
            { return Results.BadRequest(new { error = error.Message }); }
        });
        app.MapPost("/api/updates/install", async (UpdateService updates, HttpContext context) =>
        {
            if (!SameOrigin(context)) return Results.StatusCode(403);
            try
            {
                var folder = await updates.PrepareAsync(context.RequestAborted);
                var info = new ProcessStartInfo(Path.Combine(updates.Root!, "DART.exe"))
                    { UseShellExecute = false, CreateNoWindow = true };
                info.ArgumentList.Add("--activate"); info.ArgumentList.Add(folder);
                info.ArgumentList.Add("--wait-pid"); info.ArgumentList.Add(Environment.ProcessId.ToString());
                _ = Process.Start(info) ?? throw new InvalidOperationException("Не удалось запустить установку обновления.");
                _ = Task.Run(async () =>
                {
                    await Task.Delay(700);
                    foreach (Form form in Application.OpenForms)
                        form.BeginInvoke(new Action(form.Close));
                    if (Application.OpenForms.Count == 0) app.Lifetime.StopApplication();
                });
                return Results.Ok(new { restarting = true });
            }
            catch (Exception error) when (error is InvalidOperationException or HttpRequestException or IOException)
            { updates.InstallationFailed(); return Results.BadRequest(new { error = error.Message }); }
        });
    }
}
