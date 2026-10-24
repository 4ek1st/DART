using System.Runtime.InteropServices;

namespace ArtCatalog.Updates;

internal static class ShortcutIcons
{
    private static int queued;

    internal static void Refresh(string? installationRoot, string? applicationPath)
    {
        if (string.IsNullOrWhiteSpace(installationRoot) || string.IsNullOrWhiteSpace(applicationPath) ||
            Interlocked.Exchange(ref queued, 1) != 0) return;
        try
        {
            var thread = new Thread(() =>
            {
                try
                {
                    RefreshCore(installationRoot, applicationPath,
                    [
                        Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs"),
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                            @"Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar")
                    ]);
                }
                catch { /* Shortcut appearance must never prevent the app from opening. */ }
            }) { IsBackground = true, Name = "DART shortcut icons" };
            thread.SetApartmentState(ApartmentState.STA);
            thread.Start();
        }
        catch { /* Windows Shell integration is best effort. */ }
    }

    internal static int RefreshCore(string installationRoot, string applicationPath,
        IEnumerable<string> candidateFolders)
    {
        object? shell = null;
        var changed = 0;
        try
        {
            var root = FullPath(installationRoot);
            var application = FullPath(applicationPath);
            if (root is null || application is null) return 0;
            var release = Path.GetDirectoryName(application);
            var buildId = release is null ? "" : Path.GetFileName(release);
            if (!ReleaseProtocol.IsHash(buildId) ||
                !SamePath(Path.GetDirectoryName(release!), Path.Combine(root, "releases")) ||
                !SamePath(application, Path.Combine(release!, "DART.exe")) ||
                !File.Exists(application)) return 0;
            var launcher = Path.Combine(root, "DART.exe");
            if (!File.Exists(launcher)) return 0;

            var shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType is null) return 0;
            shell = Activator.CreateInstance(shellType);
            if (shell is null) return 0;
            var icon = application + ",0";
            foreach (var folder in candidateFolders.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                string[] links;
                try
                {
                    var directory = FullPath(folder);
                    if (directory is null || !Directory.Exists(directory)) continue;
                    links = Directory.GetFiles(directory, "*.lnk", SearchOption.TopDirectoryOnly);
                }
                catch { continue; }
                foreach (var link in links)
                {
                    object? shortcut = null;
                    try
                    {
                        shortcut = ((dynamic)shell).CreateShortcut(link);
                        if (!SamePath((string)((dynamic)shortcut).TargetPath, launcher) ||
                            string.Equals((string)((dynamic)shortcut).IconLocation, icon,
                                StringComparison.OrdinalIgnoreCase)) continue;
                        ((dynamic)shortcut).IconLocation = icon;
                        ((dynamic)shortcut).Save();
                        changed++;
                        SHChangeNotify(0x00002000, 0x0005, link, IntPtr.Zero);
                    }
                    catch { /* A locked or unavailable shortcut is left for a later launch. */ }
                    finally { Release(shortcut); }
                }
            }
        }
        catch { /* Missing folders, COM or installation metadata do not affect startup. */ }
        finally { Release(shell); }
        return changed;
    }

    private static string? FullPath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        path = Environment.ExpandEnvironmentVariables(path.Trim().Trim('"'));
        return Path.IsPathFullyQualified(path) ? Path.TrimEndingDirectorySeparator(Path.GetFullPath(path)) : null;
    }

    private static bool SamePath(string? left, string right) =>
        string.Equals(FullPath(left), FullPath(right), StringComparison.OrdinalIgnoreCase);

    private static void Release(object? value)
    {
        try { if (value is not null && Marshal.IsComObject(value)) Marshal.FinalReleaseComObject(value); }
        catch { }
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern void SHChangeNotify(uint eventId, uint flags, string item1, IntPtr item2);
}
