using System.Net;

namespace ArtCatalog;

internal sealed record SourceAvailabilityStatus(string Source, bool WebsiteUnavailable = false,
    int? StatusCode = null, long? RetryAt = null, long? CheckedAt = null);

internal sealed class SourceWebsiteUnavailableException(string source, DateTimeOffset retryAt)
    : HttpRequestException($"{source}: the website is temporarily unavailable.", null,
        HttpStatusCode.ServiceUnavailable)
{
    internal DateTimeOffset RetryAt { get; } = retryAt;
}

// Response evidence only: no profile data, credentials, request URLs or active
// remote health probes. Cached reads never turn an unavailable site healthy.
internal sealed class SourceAvailability(Func<DateTimeOffset>? clock = null)
{
    internal static readonly SourceAvailability Default = new();
    private readonly Func<DateTimeOffset> now = clock ?? (() => DateTimeOffset.UtcNow);
    private readonly object sync = new();
    private readonly Dictionary<string, (long Sequence, SourceAvailabilityStatus Status)> states =
        CatalogState.Sources.ToDictionary(source => source,
            source => (0L, new SourceAvailabilityStatus(source)), StringComparer.Ordinal);
    private long sequence;

    internal static string? SourceFromHost(string host) => host.ToLowerInvariant() switch
    {
        "danbooru.donmai.us" => "danbooru",
        "gelbooru.com" or "www.gelbooru.com" => "gelbooru",
        "rule34.xxx" or "api.rule34.xxx" => "rule34",
        "sankakuapi.com" => "sankaku",
        _ => null
    };

    internal long Begin() => Interlocked.Increment(ref sequence);

    internal void Observe(string source, HttpStatusCode status, long requestSequence,
        DateTimeOffset? retryAt = null)
    {
        var at = now();
        var unavailable = (int)status is >= 500 and <= 599;
        lock (sync)
        {
            if (!states.TryGetValue(source, out var previous) || requestSequence < previous.Sequence) return;
            var deadline = unavailable ? retryAt is { } supplied && supplied > at
                ? supplied : at.AddSeconds(30) : (DateTimeOffset?)null;
            states[source] = (requestSequence, new(source, unavailable, (int)status,
                deadline?.ToUnixTimeMilliseconds(), at.ToUnixTimeMilliseconds()));
        }
    }

    internal DateTimeOffset? GetRetryAt(string source)
    {
        lock (sync)
            return states.TryGetValue(source, out var value) && value.Status.WebsiteUnavailable &&
                value.Status.RetryAt is { } retry && retry > now().ToUnixTimeMilliseconds()
                ? DateTimeOffset.FromUnixTimeMilliseconds(retry) : null;
    }

    internal SourceAvailabilityStatus[] Snapshot()
    {
        lock (sync) return CatalogState.Sources.Select(source => states[source].Status).ToArray();
    }

    internal DateTimeOffset? RetryAfter(HttpResponseMessage response)
    {
        var at = now();
        var absolute = response.Headers.RetryAfter?.Date;
        if (absolute > at) return absolute;
        if (response.Headers.RetryAfter?.Delta is not { } delta || delta <= TimeSpan.Zero) return null;
        try { return at + delta; }
        catch (ArgumentOutOfRangeException) { return DateTimeOffset.MaxValue; }
    }
}

internal sealed class SourceAvailabilityHandler(HttpMessageHandler inner,
    SourceAvailability? availability = null) : DelegatingHandler(inner)
{
    private readonly SourceAvailability state = availability ?? SourceAvailability.Default;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var source = request.RequestUri is { } uri ? SourceAvailability.SourceFromHost(uri.IdnHost) : null;
        cancellationToken.ThrowIfCancellationRequested();
        if (source is not null && state.GetRetryAt(source) is { } retryAt)
            throw new SourceWebsiteUnavailableException(source, retryAt);
        var sequence = source is null ? 0 : state.Begin();
        var response = await base.SendAsync(request, cancellationToken);
        if (source is not null) state.Observe(source, response.StatusCode, sequence, state.RetryAfter(response));
        return response;
    }
}
