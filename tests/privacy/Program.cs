using System.Reflection;
using System.Runtime.InteropServices;
using ArtCatalog;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        if (!OperatingSystem.IsWindowsVersionAtLeast(10, 0, 19041))
        {
            Console.WriteLine("Privacy native fixture skipped: Windows 10 2004+ required.");
            return;
        }

        var directory = Path.Combine(Path.GetTempPath(), "DART-privacy-fixture-" + Guid.NewGuid());
        Directory.CreateDirectory(directory);
        try
        {
            var assembly = typeof(ScreenCaptureStatus).Assembly;
            var storeType = assembly.GetType("ArtCatalog.LocalStore")!;
            var protectionType = assembly.GetType("ArtCatalog.ScreenCaptureProtection")!;
            object Store() => Activator.CreateInstance(storeType, [directory])!;
            object Protection(object store) => Activator.CreateInstance(protectionType, [store])!;
            object? Call(object target, string name, params object[] arguments) =>
                target.GetType().GetMethod(name, BindingFlags.Instance | BindingFlags.Public)!
                    .Invoke(target, arguments);
            ScreenCaptureStatus Change(object target, bool enabled)
            {
                // Exercise the same HTTP worker -> WinForms UI thread hop used by the app.
                var pending = Task.Run(async () => await
                    (Task<ScreenCaptureStatus>)Call(target, "ChangeAsync", enabled)!);
                var deadline = DateTime.UtcNow.AddSeconds(10);
                while (!pending.IsCompleted && DateTime.UtcNow < deadline)
                {
                    Application.DoEvents();
                    Thread.Sleep(5);
                }
                if (!pending.IsCompleted) throw new Exception("Native UI dispatch timed out");
                return pending.GetAwaiter().GetResult();
            }
            static void Expect(bool condition, string message)
            {
                if (!condition) throw new Exception(message);
            }

            var store = Store();
            var protection = Protection(store);
            using var window = new Form { ShowInTaskbar = false,
                StartPosition = FormStartPosition.Manual, Location = new Point(-32000, -32000) };
            Call(protection, "Attach", window);
            Call(protection, "HandleCreated", window.Handle);
            var initial = (ScreenCaptureStatus)Call(protection, "Status")!;
            Expect(!initial.Requested && !initial.Active && initial.Available,
                "A new profile must start with capture protection off");

            var enabled = Change(protection, true);
            Expect(enabled.Requested && enabled.Active && enabled.Error is null,
                "Enabling must apply and confirm the native window affinity");
            Expect(GetWindowDisplayAffinity(window.Handle, out var affinity) && affinity == 0x11,
                "Windows must report WDA_EXCLUDEFROMCAPTURE for the test window");

            Call(store, "UpdateContentPreferences", new ContentPreferencesUpdate());

            var restartedStore = Store();
            var restartedProtection = Protection(restartedStore);
            using var restoredWindow = new Form { ShowInTaskbar = false,
                StartPosition = FormStartPosition.Manual, Location = new Point(-32000, -32000) };
            Call(restartedProtection, "Attach", restoredWindow);
            Call(restartedProtection, "HandleCreated", restoredWindow.Handle);
            var restored = (ScreenCaptureStatus)Call(restartedProtection, "Status")!;
            Expect(restored.Requested && restored.Active &&
                GetWindowDisplayAffinity(restoredWindow.Handle, out affinity) && affinity == 0x11,
                "A new window must restore the saved protection before use");

            var disabled = Change(restartedProtection, false);
            Expect(!disabled.Requested && !disabled.Active && disabled.Error is null &&
                GetWindowDisplayAffinity(restoredWindow.Handle, out affinity) && affinity == 0,
                "Disabling must clear the native affinity and saved preference");
            Console.WriteLine("Privacy native fixture passed: enable, persisted restore, disable.");
        }
        finally
        {
            // This exact, newly created fixture directory is the only cleanup target.
            var resolved = Path.GetFullPath(directory);
            if (resolved.StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) &&
                Path.GetFileName(resolved).StartsWith("DART-privacy-fixture-", StringComparison.Ordinal))
                Directory.Delete(resolved, recursive: true);
        }
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetWindowDisplayAffinity(IntPtr window, out uint affinity);
}
