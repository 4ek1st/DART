using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Runtime.CompilerServices;

[assembly: InternalsVisibleTo("Rule34FixtureTests")]
[assembly: InternalsVisibleTo("ChromeTests")]

namespace ArtCatalog;

internal sealed record SankakuSession(string AccessToken = "", string RefreshToken = "", string Login = "");

internal interface ISankakuSessionStore
{
    SankakuSession GetSankakuSession();
    bool SetSankakuSession(SankakuSession session, string? expectedToken = null);
}

internal sealed class SankakuAccessException(bool loginRequired) : InvalidOperationException(
    loginRequired ? "Авторизуйтесь в Sankaku в настройках, чтобы получить доступ к этим работам."
    : "Sankaku ограничил доступ для этого аккаунта. Проверьте условия доступа или подписку Plus на сайте.")
{
    public bool LoginRequired { get; } = loginRequired;
}

internal sealed class SankakuLoginRequest
{
    public string Login { get; set; } = "";
    public string Password { get; set; } = "";
}

internal sealed class SankakuApi(ISankakuSessionStore sessions, HttpClient? transport = null)
{
    private static readonly HttpClient DefaultClient = new(new HttpClientHandler
    {
        AllowAutoRedirect = false,
        AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
    }) { Timeout = TimeSpan.FromSeconds(20) };
    private readonly HttpClient http = transport ?? DefaultClient;
    private readonly SemaphoreSlim authGate = new(1, 1);

    internal static bool ValidId(string id) => Regex.IsMatch(id, @"^[A-Za-z0-9]{1,64}$");

    private async Task<(HttpStatusCode Status, string Body)> SendAsync(string path,
        object? body, string token, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(body is null ? HttpMethod.Get : HttpMethod.Post,
            "https://sankakuapi.com" + path);
        request.Headers.TryAddWithoutValidation("Accept", "application/vnd.sankaku.api+json;v=2");
        request.Headers.TryAddWithoutValidation("Origin", "https://sankaku.app");
        request.Headers.UserAgent.ParseAdd("ArtCatalog/0.1 (Windows)");
        if (token.Length > 0) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) request.Content = new StringContent(JsonSerializer.Serialize(body),
            System.Text.Encoding.UTF8, "application/json");
        using var response = await http.SendAsync(request, cancellationToken);
        return (response.StatusCode, await response.Content.ReadAsStringAsync(cancellationToken));
    }

    public async Task LoginAsync(string login, string password, CancellationToken cancellationToken)
    {
        login = login.Trim();
        if (login.Length is < 1 or > 200 || password.Length is < 1 or > 1000)
            throw new InvalidOperationException("Введите логин и пароль Sankaku.");
        await authGate.WaitAsync(cancellationToken);
        try
        {
            var response = await SendAsync("/auth/token", new { login, password }, "", cancellationToken);
            using var data = ParseObject(response.Body);
            var access = Text(data.RootElement, "access_token");
            if (response.Status == HttpStatusCode.OK && access.Length > 0 && Successful(data.RootElement))
            {
                sessions.SetSankakuSession(new(access, Text(data.RootElement, "refresh_token"), login));
                return;
            }
            if (response.Status == HttpStatusCode.TooManyRequests)
                throw new InvalidOperationException("Слишком много запросов входа. Подождите и повторите.");
            if (Regex.IsMatch(response.Body, "mfa|otp|two.factor|authentication.factor", RegexOptions.IgnoreCase))
                throw new InvalidOperationException("Sankaku требует двухэтапную проверку. Этот способ входа пока не поддерживает её.");
            if ((int)response.Status is 400 or 401 or 403)
                throw new InvalidOperationException("Неверный логин или пароль Sankaku.");
            throw new InvalidOperationException("Вход Sankaku временно недоступен. Повторите позже.");
        }
        finally { authGate.Release(); }
    }

    public async Task LogoutAsync(CancellationToken cancellationToken)
    {
        await authGate.WaitAsync(cancellationToken);
        try { sessions.SetSankakuSession(new()); }
        finally { authGate.Release(); }
    }

    internal static string SearchPath(string query, int page, string rating, string sort) =>
        "/v2/posts?lang=en&limit=24&page=" + ((long)page + 1) + "&tags=" + Uri.EscapeDataString(
            (query + (rating == "general" ? " rating:s" : rating == "explicit" ? " rating:q,e" : "") +
            (sort == "popular" ? " order:popularity" : "")).Trim());

    public Task<JsonDocument> PostsAsync(string query, int page, string rating, string sort,
        CancellationToken cancellationToken) => GetAsync(SearchPath(query, page, rating, sort), cancellationToken);

    public Task<JsonDocument> PostAsync(string id, CancellationToken cancellationToken)
    {
        if (!ValidId(id)) throw new InvalidOperationException("Неверный идентификатор Sankaku.");
        return GetAsync("/posts/" + id + "?lang=en", cancellationToken);
    }

    public Task<JsonDocument> TagsAsync(string query, CancellationToken cancellationToken) =>
        GetAsync("/tags?lang=en&limit=15&name=" + Uri.EscapeDataString(query), cancellationToken);

    public Task<JsonDocument> PostTagsAsync(string id, int page, CancellationToken cancellationToken)
    {
        if (!ValidId(id)) throw new InvalidOperationException("Неверный идентификатор Sankaku.");
        return GetAsync("/posts/" + id + "/tags?lang=en&limit=100&page=" + page, cancellationToken);
    }

    private async Task<JsonDocument> GetAsync(string path, CancellationToken cancellationToken)
    {
        var token = sessions.GetSankakuSession().AccessToken;
        var response = await SendAsync(path, null, token, cancellationToken);
        if (InvalidToken(response) && token.Length > 0)
        {
            token = await RefreshAsync(token, cancellationToken);
            response = await SendAsync(path, null, token, cancellationToken);
            if (InvalidToken(response))
            {
                sessions.SetSankakuSession(new(), token);
                throw new SankakuAccessException(true);
            }
        }
        if ((int)response.Status is 401 or 403 || response.Status == HttpStatusCode.TooManyRequests &&
            (response.Body.Contains("_tags-explicit-limit", StringComparison.Ordinal) ||
             response.Body.Contains("anonymous_tags-limit", StringComparison.Ordinal)))
            throw new SankakuAccessException(sessions.GetSankakuSession().AccessToken.Length == 0);
        if (response.Status == HttpStatusCode.TooManyRequests)
            throw new InvalidOperationException("Сайт ограничил частоту запросов (HTTP 429). Подождите и повторите.");
        if ((int)response.Status is 400 or 422)
            throw new InvalidOperationException("Sankaku не принял запрос. Попробуйте меньше тегов.");
        if (response.Status != HttpStatusCode.OK)
            throw new HttpRequestException("Sankaku request failed", null, response.Status);
        return JsonDocument.Parse(response.Body);
    }

    private async Task<string> RefreshAsync(string previous, CancellationToken cancellationToken)
    {
        await authGate.WaitAsync(cancellationToken);
        try
        {
            var current = sessions.GetSankakuSession();
            if (current.AccessToken != previous)
            {
                if (current.AccessToken.Length == 0) throw new SankakuAccessException(true);
                return current.AccessToken;
            }
            if (current.RefreshToken.Length == 0)
            {
                sessions.SetSankakuSession(new(), previous);
                throw new SankakuAccessException(true);
            }
            var response = await SendAsync("/auth/token", new { refresh_token = current.RefreshToken }, "", cancellationToken);
            using var data = ParseObject(response.Body);
            var access = Text(data.RootElement, "access_token");
            if (response.Status == HttpStatusCode.OK && access.Length > 0 && Successful(data.RootElement))
            {
                var refresh = Text(data.RootElement, "refresh_token");
                if (!sessions.SetSankakuSession(new(access, refresh.Length > 0 ? refresh : current.RefreshToken,
                        current.Login), previous))
                    throw new SankakuAccessException(sessions.GetSankakuSession().AccessToken.Length == 0);
                return access;
            }
            if ((int)response.Status is 400 or 401 or 403)
            {
                sessions.SetSankakuSession(new(), previous);
                throw new SankakuAccessException(true);
            }
            throw new InvalidOperationException("Не удалось обновить вход Sankaku. Подождите и повторите.");
        }
        finally { authGate.Release(); }
    }

    private static bool InvalidToken((HttpStatusCode Status, string Body) response) =>
        response.Status == HttpStatusCode.Unauthorized || response.Status == HttpStatusCode.Forbidden &&
        (response.Body.Contains("invalid-token") || response.Body.Contains("invalid_token"));

    private static JsonDocument ParseObject(string value)
    {
        try { return JsonDocument.Parse(value); }
        catch (JsonException) { return JsonDocument.Parse("{}"); }
    }
    private static bool Successful(JsonElement value) => value.ValueKind == JsonValueKind.Object &&
        (!value.TryGetProperty("success", out var success) || success.ValueKind != JsonValueKind.False);
    internal static string Text(JsonElement value, string name) => value.ValueKind == JsonValueKind.Object &&
        value.TryGetProperty(name, out var property) && property.ValueKind is not (JsonValueKind.Null or JsonValueKind.Undefined)
            ? property.ValueKind == JsonValueKind.String ? property.GetString() ?? "" : property.ToString() : "";
}
