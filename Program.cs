using System.Diagnostics;
using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace ArtCatalog;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        var root = AppContext.BaseDirectory;
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            Args = args,
            ContentRootPath = root,
            WebRootPath = EmbeddedFrontend.Resolve()
        });
        builder.WebHost.ConfigureKestrel(options => options.Listen(IPAddress.Loopback, 0));
        var testDataDirectory = args.Contains("--server-only", StringComparer.OrdinalIgnoreCase)
            ? Environment.GetEnvironmentVariable("ARTCATALOG_TEST_DATA_DIR") : null;
        var dataArgument = Array.FindIndex(args, value =>
            value.Equals("--data-dir", StringComparison.OrdinalIgnoreCase));
        var dataDirectory = dataArgument >= 0 && dataArgument + 1 < args.Length
            ? Path.GetFullPath(args[dataArgument + 1])
            : testDataDirectory;
        builder.Services.AddSingleton(new LocalStore(dataDirectory));
        builder.Services.AddSingleton<CatalogService>();
        var installationArgument = Array.IndexOf(args, "--installation-root");
        var installationRoot = installationArgument >= 0 && installationArgument + 1 < args.Length
            ? Path.GetFullPath(args[installationArgument + 1]) : null;
        builder.Services.AddSingleton(new ArtCatalog.Updates.UpdateService(installationRoot));
        var app = builder.Build();
        app.UseDefaultFiles();
        UpdateEndpoints.Map(app);
        app.UseStaticFiles(new StaticFileOptions
        {
            OnPrepareResponse = context =>
                context.Context.Response.Headers.CacheControl = "no-store"
        });

        app.MapGet("/api/search", async (HttpContext context, CatalogService catalog) =>
        {
            var query = context.Request.Query["q"].ToString().Trim();
            if (query.Length > 200) return Results.BadRequest(new { error = "Поисковый запрос слишком длинный." });
            var page = int.TryParse(context.Request.Query["page"], out var number)
                ? Math.Clamp(number, 0, CatalogService.MaxSearchPage) : 0;
            var sources = context.Request.Query["sources"].ToString()
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (sources.Any(source => !CatalogState.IsSupported(source))) return Results.BadRequest();
            var rating = context.Request.Query["rating"].ToString();
            var sort = context.Request.Query["sort"].ToString();
            var kind = context.Request.Query["kind"].ToString();
            var sourcePages = CatalogService.ParseSourcePages(context.Request.Query["pages"].ToString());
            return Results.Ok(await catalog.SearchAsync(query, page, sources, rating, sort, kind,
                context.RequestAborted, sourcePages));
        });

        app.MapGet("/api/tags", async (HttpContext context, CatalogService catalog) =>
        {
            var query = context.Request.Query["q"].ToString().Trim();
            if (query.Length > 50) return Results.BadRequest();
            return Results.Ok(await catalog.SearchTagsAsync(query, context.RequestAborted));
        });

        app.MapGet("/api/profile", async (HttpContext context, CatalogService catalog) =>
        {
            var source = context.Request.Query["source"].ToString();
            var artistId = context.Request.Query["artist"].ToString();
            var rating = context.Request.Query["rating"].ToString();
            var page = int.TryParse(context.Request.Query["page"], out var number)
                ? Math.Clamp(number, 0, 100) : 0;
            if (!CatalogState.IsSupported(source) || artistId.Length > 100) return Results.BadRequest();
            try
            {
                var profile = await catalog.GetProfileAsync(source, artistId, page,
                    rating, context.RequestAborted);
                return profile is null ? Results.NotFound() : Results.Ok(profile);
            }
            catch (Rule34RequestException ex)
            {
                return Results.Json(new { error = ex.Message, retryAt = ex.RetryAt?.ToUnixTimeMilliseconds() },
                    statusCode: ex.RetryAt is null ? 401 : 503);
            }
            catch (SankakuAccessException ex)
            {
                return Results.Json(new { error = ex.Message, authRequired = ex.LoginRequired }, statusCode: 401);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or
                                       System.Text.Json.JsonException or InvalidOperationException)
            {
                return Results.Problem("Профиль сейчас недоступен.", statusCode: 502);
            }
        });

        app.MapGet("/api/detail", async (HttpContext context, CatalogService catalog, LocalStore store) =>
        {
            var source = context.Request.Query["source"].ToString();
            var id = context.Request.Query["id"].ToString();
            if (!CatalogState.IsSupported(source) || id.Length is < 1 or > 100)
                return Results.BadRequest(new { error = "Неверный идентификатор." });
            try
            {
                var item = await catalog.GetDetailAsync(source, id, context.RequestAborted);
                if (item is not null)
                {
                    try { store.RefreshSavedMetadata(item); }
                    catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or
                                                   System.Text.Json.JsonException)
                    {
                        // A metadata cache write must not prevent opening the artwork.
                    }
                }
                return item is null ? Results.NotFound() : Results.Ok(item);
            }
            catch (Rule34RequestException ex)
            {
                return Results.Json(new { error = ex.Message, retryAt = ex.RetryAt?.ToUnixTimeMilliseconds() },
                    statusCode: ex.RetryAt is null ? 401 : 503);
            }
            catch (SankakuAccessException ex)
            {
                return Results.Json(new { error = ex.Message, authRequired = ex.LoginRequired }, statusCode: 401);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or
                                       System.Text.Json.JsonException or InvalidOperationException)
            {
                return Results.Problem("Источник сейчас недоступен.", statusCode: 502);
            }
        });

        app.MapGet("/api/bookmarks", (LocalStore store) => Results.Ok(store.GetBookmarks()));
        app.MapGet("/api/likes", (LocalStore store) => Results.Ok(store.GetLikes()));
        app.MapGet("/api/favorite-tags", (LocalStore store) =>
            Results.Ok(store.GetFavoriteTags()));
        app.MapPost("/api/favorite-tags", async (HttpContext context, LocalStore store) =>
        {
            if (!IsSameOrigin(context.Request)) return Results.StatusCode(403);
            if (context.Request.ContentLength is > 1_000) return Results.StatusCode(413);
            FavoriteTagUpdate? update;
            try { update = await context.Request.ReadFromJsonAsync<FavoriteTagUpdate>(
                context.RequestAborted); }
            catch (System.Text.Json.JsonException) { return Results.BadRequest(); }
            var tag = update?.Tag?.Trim().ToLowerInvariant().Normalize(
                System.Text.NormalizationForm.FormKC) ?? "";
            if (update?.Favorite is null || tag.Length is < 1 or > 100 ||
                tag.StartsWith('-') || tag.Any(char.IsWhiteSpace) ||
                tag.Any(char.IsControl)) return Results.BadRequest();
            var tags = store.SetFavoriteTag(tag, update.Favorite.Value);
            return tags is null ? Results.Conflict() : Results.Ok(tags);
        });
        app.MapGet("/api/client-state", (LocalStore store) =>
            Results.Content(store.GetClientStateJson(), "application/json"));
        app.MapGet("/api/recommendation-tag-preferences", (LocalStore store) =>
            Results.Ok(store.GetRecommendationTagPreferences()));
        app.MapPost("/api/recommendation-tag-preferences", async (
            HttpContext context, LocalStore store) =>
        {
            if (!IsSameOrigin(context.Request)) return Results.StatusCode(403);
            if (context.Request.ContentLength is > 4096) return Results.StatusCode(413);
            RecommendationTagPreferenceUpdate? update;
            try
            {
                update = await context.Request.ReadFromJsonAsync<RecommendationTagPreferenceUpdate>(
                    cancellationToken: context.RequestAborted);
            }
            catch (System.Text.Json.JsonException) { return Results.BadRequest(); }
            if (update?.Tag is null || update.Mode is not ("priority" or "disabled" or "normal"))
                return Results.BadRequest();
            var tag = System.Text.RegularExpressions.Regex.Replace(
                update.Tag.Normalize(System.Text.NormalizationForm.FormKC)
                    .ToLowerInvariant().Replace('_', ' ').Replace(':', ' '),
                @"\s+", " ").Trim();
            if (tag.Length is < 1 or > 100) return Results.BadRequest();
            update.Tag = tag;
            return Results.Ok(store.UpdateRecommendationTagPreference(update));
        });
        app.MapPost("/api/client-state", async (HttpContext context, LocalStore store) =>
        {
            if (!IsSameOrigin(context.Request)) return Results.StatusCode(403);
            if (context.Request.ContentLength is > 1_000_000) return Results.StatusCode(413);
            using var reader = new StreamReader(context.Request.Body);
            var raw = await reader.ReadToEndAsync(context.RequestAborted);
            if (raw.Length > 1_000_000) return Results.StatusCode(413);
            try
            {
                using var parsed = System.Text.Json.JsonDocument.Parse(raw);
                if (parsed.RootElement.ValueKind != System.Text.Json.JsonValueKind.Object)
                    return Results.BadRequest();
            }
            catch (System.Text.Json.JsonException) { return Results.BadRequest(); }
            store.UpdateClientStateJson(raw);
            return Results.Ok();
        });
        app.MapPost("/api/bookmarks", async (HttpContext context, LocalStore store) =>
        {
            if (!IsSameOrigin(context.Request)) return Results.StatusCode(403);
            var item = await context.Request.ReadFromJsonAsync<CatalogItem>(context.RequestAborted);
            if (item is null || !CatalogService.IsValidItem(item)) return Results.BadRequest();
            return Results.Ok(new { saved = store.ToggleBookmark(item) });
        });
        app.MapPost("/api/likes", async (HttpContext context, LocalStore store) =>
        {
            if (!IsSameOrigin(context.Request)) return Results.StatusCode(403);
            var item = await context.Request.ReadFromJsonAsync<CatalogItem>(context.RequestAborted);
            if (item is null || !CatalogService.IsValidItem(item)) return Results.BadRequest();
            return Results.Ok(new { saved = store.ToggleLike(item) });
        });

        app.MapGet("/api/follows", (LocalStore store) => Results.Ok(store.GetFollows()));
        app.MapPost("/api/follows", async (HttpContext context, LocalStore store) =>
        {
            if (!IsSameOrigin(context.Request)) return Results.StatusCode(403);
            var follow = await context.Request.ReadFromJsonAsync<FollowRequest>(context.RequestAborted);
            if (follow is null || !CatalogService.IsValidFollow(follow)) return Results.BadRequest();
            return Results.Ok(new { following = store.ToggleFollow(follow) });
        });
        app.MapPost("/api/follows/gelbooru-tag", async (HttpContext context, LocalStore store) =>
        {
            if (!IsSameOrigin(context.Request)) return Results.StatusCode(403);
            var update = await context.Request.ReadFromJsonAsync<FollowTagUpdate>(context.RequestAborted);
            if (update?.Key is not { Length: > 0 and <= 220 } || update.Tag is null ||
                update.Tag.Length > 100) return Results.BadRequest();
            var tag = update.Tag.Trim().Replace(' ', '_');
            if (tag.Length > 0 && !CatalogService.ValidArtistTag(tag)) return Results.BadRequest();
            return store.SetGelbooruTag(update.Key, tag)
                ? Results.Ok(store.GetFollows()) : Results.NotFound();
        });
        app.MapPost("/api/follows/seen", async (HttpContext context, LocalStore store) =>
        {
            if (!IsSameOrigin(context.Request)) return Results.StatusCode(403);
            var update = await context.Request.ReadFromJsonAsync<FollowSeenRequest>(
                context.RequestAborted);
            if (update?.Keys is null || update.WorkKeys is null ||
                update.Keys.Count > 200 || update.WorkKeys.Count > 200 ||
                update.Keys.Any(key => key is null || key.Length is < 1 or > 220) ||
                update.WorkKeys.Any(entry => !update.Keys.Contains(entry.Key) ||
                    entry.Value is null || entry.Value.Count > 100 ||
                    entry.Value.Any(key => key is null || key.Length is < 1 or > 250)) ||
                update.Rating is not ("general" or "explicit" or "all"))
                return Results.BadRequest();
            store.MarkFollowsSeen(update);
            return Results.Ok(store.GetFollows());
        });

        app.MapGet("/api/settings", (LocalStore store) => Results.Ok(store.GetPublicSettings()));
        app.MapPost("/api/sankaku/login", async (HttpContext context, LocalStore store, CatalogService catalog) =>
        {
            if (!IsSameOrigin(context.Request)) return Results.StatusCode(403);
            if (context.Request.ContentLength is > 8_000) return Results.StatusCode(413);
            SankakuLoginRequest? login;
            try { login = await context.Request.ReadFromJsonAsync<SankakuLoginRequest>(context.RequestAborted); }
            catch (System.Text.Json.JsonException) { return Results.BadRequest(); }
            if (login?.Login is null || login.Password is null) return Results.BadRequest();
            try
            {
                await catalog.LoginSankakuAsync(login.Login, login.Password, context.RequestAborted);
                catalog.ClearSearchCache();
                return Results.Ok(store.GetPublicSettings());
            }
            catch (InvalidOperationException ex) { return Results.BadRequest(new { error = ex.Message }); }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            { return Results.Json(new { error = "Сервис входа Sankaku сейчас недоступен. Повторите позже." }, statusCode: 502); }
        });
        app.MapPost("/api/sankaku/logout", async (HttpContext context, LocalStore store, CatalogService catalog) =>
        {
            if (!IsSameOrigin(context.Request)) return Results.StatusCode(403);
            await catalog.LogoutSankakuAsync(context.RequestAborted);
            catalog.ClearSearchCache();
            return Results.Ok(store.GetPublicSettings());
        });
        app.MapGet("/api/content-preferences", (LocalStore store) =>
            Results.Ok(store.GetContentPreferences()));
        app.MapGet("/api/viewed-identities", (LocalStore store) =>
            Results.Ok(store.GetViewedTokens()));
        app.MapPost("/api/viewed-identities", async (HttpContext context, LocalStore store) =>
        {
            if (!IsSameOrigin(context.Request)) return Results.StatusCode(403);
            if (context.Request.ContentLength is > 20_000) return Results.StatusCode(413);
            List<string>? tokens;
            try { tokens = await context.Request.ReadFromJsonAsync<List<string>>(context.RequestAborted); }
            catch (System.Text.Json.JsonException) { return Results.BadRequest(); }
            if (tokens is null || tokens.Count is < 1 or > 200 ||
                tokens.Any(token => token is null || token.Length is < 5 or > 250 ||
                    !(new[] { "key:", "group:", "hash:" }.Any(prefix =>
                        token.StartsWith(prefix, StringComparison.Ordinal)) ||
                      System.Text.RegularExpressions.Regex.IsMatch(token,
                          @"^original:x-status:\d{5,25}$")) ||
                    token.Any(char.IsControl))) return Results.BadRequest();
            store.AddViewedTokens(tokens);
            return Results.Ok(new { saved = tokens.Count });
        });
        app.MapPost("/api/content-preferences", async (HttpContext context, LocalStore store) =>
        {
            if (!IsSameOrigin(context.Request)) return Results.StatusCode(403);
            if (context.Request.ContentLength is > 20_000) return Results.StatusCode(413);
            ContentPreferences? preferences;
            try { preferences = await context.Request.ReadFromJsonAsync<ContentPreferences>(
                context.RequestAborted); }
            catch (System.Text.Json.JsonException) { return Results.BadRequest(); }
            if (preferences?.AiMode is not ("all" or "generated" or "generated-and-assisted") ||
                preferences.AttributionPriority is not ("creator" or "original" or "uploader") ||
                preferences.ExcludedTags is null || preferences.ExcludedTags.Count > 100 ||
                preferences.ExcludedTags.Any(tag => tag is null || tag.Length is < 1 or > 100 ||
                    tag.Any(char.IsControl))) return Results.BadRequest();
            return Results.Ok(store.UpdateContentPreferences(preferences));
        });
        app.MapPost("/api/settings", async (HttpContext context, LocalStore store, CatalogService catalog) =>
        {
            if (!IsSameOrigin(context.Request)) return Results.StatusCode(403);
            var settings = await context.Request.ReadFromJsonAsync<SettingsUpdate>(context.RequestAborted);
            if (settings is null || settings.UserId is null || settings.ApiKey is null ||
                settings.UserId.Length > 100 || settings.ApiKey.Length > 300 ||
                settings.Rule34UserId?.Length > 100 || settings.Rule34ApiKey?.Length > 300)
                return Results.BadRequest();
            store.UpdateSettings(settings);
            catalog.ClearSearchCache();
            return Results.Ok(store.GetPublicSettings());
        });

        app.MapGet("/api/image", async (HttpContext context, CatalogService catalog) =>
        {
            var url = context.Request.Query["url"].ToString();
            await catalog.WriteImageAsync(url, context);
        });

        app.MapMethods("/api/video", ["GET", "HEAD"], async (HttpContext context, CatalogService catalog) =>
        {
            await catalog.WriteVideoAsync(context.Request.Query["url"].ToString(), context);
        });

        app.StartAsync().GetAwaiter().GetResult();
        var address = app.Services.GetRequiredService<IServer>().Features
            .Get<IServerAddressesFeature>()?.Addresses.FirstOrDefault();
        if (address is null) throw new InvalidOperationException("Local server did not start.");

        if (args.Contains("--server-only", StringComparer.OrdinalIgnoreCase))
        {
            Console.WriteLine(address);
            app.WaitForShutdownAsync().GetAwaiter().GetResult();
        }
        else
        {
            ApplicationConfiguration.Initialize();
            Application.Run(new CatalogForm(address));
        }
        app.StopAsync().GetAwaiter().GetResult();
    }

    private static bool IsSameOrigin(HttpRequest request)
    {
        var origin = request.Headers.Origin.ToString();
        return string.Equals(origin, $"{request.Scheme}://{request.Host}",
            StringComparison.OrdinalIgnoreCase);
    }
}

internal sealed class CatalogForm : Form
{
    private readonly WebView2 webView = new() { Dock = DockStyle.Fill };
    private readonly Uri home;
    private readonly string userDataDirectory;
    protected override CreateParams CreateParams
    {
        get { var parameters = base.CreateParams; parameters.Style &= ~0x00C00000; return parameters; }
    }

    public CatalogForm(string address, string? webViewDataDirectory = null)
    {
        home = new Uri(address);
        userDataDirectory = webViewDataDirectory ?? Path.Combine(Environment.GetFolderPath(
            Environment.SpecialFolder.LocalApplicationData), "ArtCatalog", "WebView2");
        Text = "DART — Discover Art";
        Width = 1450;
        Height = 900;
        MinimumSize = new Size(840, 570);
        BackColor = Color.FromArgb(24, 24, 24);
        HandleCreated += (_, _) => WindowChrome.Apply(Handle);
        Resize += (_, _) => PublishWindowState();
        Controls.Add(webView);
        Shown += async (_, _) => await InitializeAsync();
    }

    private async Task InitializeAsync()
    {
        try
        {
            Directory.CreateDirectory(userDataDirectory);
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: userDataDirectory);
            await webView.EnsureCoreWebView2Async(environment);
            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Settings.IsNonClientRegionSupportEnabled = true;
            webView.CoreWebView2.WebMessageReceived += (_, e) =>
            {
                if (!Uri.TryCreate(e.Source, UriKind.Absolute, out var source) ||
                    source.GetLeftPart(UriPartial.Authority) != home.GetLeftPart(UriPartial.Authority)) return;
                try
                {
                    using var message = System.Text.Json.JsonDocument.Parse(e.WebMessageAsJson);
                    if (message.RootElement.GetProperty("type").GetString() != "window-command") return;
                    switch (message.RootElement.GetProperty("command").GetString())
                    {
                        case "minimize": WindowState = FormWindowState.Minimized; break;
                        case "maximize": WindowState = WindowState == FormWindowState.Maximized
                            ? FormWindowState.Normal : FormWindowState.Maximized; break;
                        case "close": Close(); break;
                    }
                }
                catch (Exception ex) when (ex is System.Text.Json.JsonException or KeyNotFoundException or InvalidOperationException) { }
            };
            webView.CoreWebView2.NavigationCompleted += (_, _) => PublishWindowState();
            webView.CoreWebView2.NavigationStarting += (_, e) =>
            {
                if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var target) ||
                    !string.Equals(target.GetLeftPart(UriPartial.Authority),
                        home.GetLeftPart(UriPartial.Authority), StringComparison.OrdinalIgnoreCase))
                {
                    e.Cancel = true;
                    OpenExternal(e.Uri);
                }
            };
            webView.CoreWebView2.NewWindowRequested += (_, e) =>
            {
                e.Handled = true;
                OpenExternal(e.Uri);
            };
            webView.Source = home;
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, $"Не удалось запустить WebView2.\n\n{ex.Message}",
                "DART — Discover Art", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void PublishWindowState()
    {
        if (webView.CoreWebView2 is null || IsDisposed) return;
        webView.CoreWebView2.PostWebMessageAsJson(System.Text.Json.JsonSerializer.Serialize(new
            { type = "window-state", maximized = WindowState == FormWindowState.Maximized }));
    }

    private static void OpenExternal(string? raw)
    {
        if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri) || uri.Scheme != "https") return;
        if (uri.UserInfo.Length > 0 || !CatalogService.IsAllowedSourceHost(uri.Host) &&
            !uri.Host.Equals("sankaku.app", StringComparison.OrdinalIgnoreCase)) return;
        try { Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true }); }
        catch (System.ComponentModel.Win32Exception) { }
    }
}
