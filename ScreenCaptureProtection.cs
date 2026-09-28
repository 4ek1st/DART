using System.Runtime.InteropServices;

namespace ArtCatalog;

public sealed record ScreenCaptureStatus(bool Requested, bool Active, bool Available, string? Error);

public sealed class ScreenCaptureUpdate
{
    public bool? HideFromScreenCapture { get; set; }
}

internal readonly record struct CaptureApplyResult(bool Success, string? Error);

internal static class WindowCaptureAffinity
{
    private const uint None = 0;
    private const uint ExcludeFromCapture = 0x11;

    public static bool IsSupported => OperatingSystem.IsWindowsVersionAtLeast(10, 0, 19041);

    public static CaptureApplyResult TryApply(IntPtr handle, bool enabled)
    {
        if (enabled && !IsSupported) return new(false, "unsupported-windows");
        if (enabled && (DwmIsCompositionEnabled(out var composing) < 0 || !composing))
            return new(false, "composition-unavailable");

        var affinity = enabled ? ExcludeFromCapture : None;
        if (!SetWindowDisplayAffinity(handle, affinity)) return new(false, "apply-failed");
        if (!GetWindowDisplayAffinity(handle, out var actual) || actual != affinity)
        {
            if (enabled) _ = SetWindowDisplayAffinity(handle, None);
            return new(false, "verify-failed");
        }
        return new(true, null);
    }

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetWindowDisplayAffinity(IntPtr window, uint affinity);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetWindowDisplayAffinity(IntPtr window, out uint affinity);

    [DllImport("dwmapi.dll")]
    private static extern int DwmIsCompositionEnabled([MarshalAs(UnmanagedType.Bool)] out bool enabled);
}

internal sealed class ScreenCaptureProtection
{
    private readonly LocalStore store;
    private readonly SemaphoreSlim changes = new(1, 1);
    private readonly object sync = new();
    private Form? window;
    private bool hasHandle;
    private bool active;
    private string? error;

    public ScreenCaptureProtection(LocalStore store) => this.store = store;

    public void Attach(Form form)
    {
        lock (sync) window = form;
    }

    public void HandleCreated(IntPtr handle)
    {
        var enabled = store.GetPrivacyPreferences().HideFromScreenCapture;
        var result = WindowCaptureAffinity.TryApply(handle, enabled);
        lock (sync)
        {
            hasHandle = true;
            active = enabled && result.Success;
            error = result.Error;
        }
    }

    public void HandleDestroyed()
    {
        lock (sync)
        {
            hasHandle = false;
            active = false;
            error = "window-unavailable";
        }
    }

    public void Detach(Form form)
    {
        lock (sync)
        {
            if (window != form) return;
            window = null;
            hasHandle = false;
            active = false;
            error = "window-unavailable";
        }
    }

    public ScreenCaptureStatus Status()
    {
        var requested = store.GetPrivacyPreferences().HideFromScreenCapture;
        lock (sync)
            return new(requested, active, hasHandle && WindowCaptureAffinity.IsSupported,
                error ?? (requested && !active ? "window-unavailable" : null));
    }

    public async Task<ScreenCaptureStatus> ChangeAsync(bool enabled)
    {
        await changes.WaitAsync();
        try
        {
            var previous = store.GetPrivacyPreferences().HideFromScreenCapture;
            if (!enabled && !Status().Active)
            {
                try
                {
                    store.SetPrivacyPreferences(false);
                    lock (sync) error = null;
                }
                catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
                {
                    lock (sync) error = "save-failed";
                }
                return Status();
            }
            var result = await ApplyToWindowAsync(enabled);
            if (!result.Success) return Status();
            try { store.SetPrivacyPreferences(enabled); }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
            {
                await ApplyToWindowAsync(previous);
                lock (sync) error = "save-failed";
            }
            return Status();
        }
        finally { changes.Release(); }
    }

    private async Task<CaptureApplyResult> ApplyToWindowAsync(bool enabled)
    {
        Form? form;
        lock (sync) form = hasHandle ? window : null;
        if (form is null || form.IsDisposed)
        {
            lock (sync) error = "window-unavailable";
            return new(false, "window-unavailable");
        }

        if (!form.InvokeRequired) return Apply(form, enabled);
        var completion = new TaskCompletionSource<CaptureApplyResult>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        try
        {
            form.BeginInvoke((Action)(() => completion.TrySetResult(Apply(form, enabled))));
        }
        catch (InvalidOperationException)
        {
            completion.TrySetResult(new(false, "window-unavailable"));
        }
        return await completion.Task;
    }

    private CaptureApplyResult Apply(Form form, bool enabled)
    {
        if (form.IsDisposed || !form.IsHandleCreated)
            return new(false, "window-unavailable");
        var result = WindowCaptureAffinity.TryApply(form.Handle, enabled);
        lock (sync)
        {
            // On any failed verification, never report protection as active.
            active = enabled && result.Success;
            error = result.Error;
        }
        return result;
    }
}
