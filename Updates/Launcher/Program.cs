using System.Diagnostics;
using System.Runtime.InteropServices;
using ArtCatalog.Updates;

try
{
    var installation = new Installation(AppContext.BaseDirectory);
    var activateIndex = Array.IndexOf(args, "--activate");
    if (activateIndex >= 0)
    {
        if (activateIndex + 1 >= args.Length) throw new InvalidOperationException("Нет подготовленного обновления.");
        var waitIndex = Array.IndexOf(args, "--wait-pid");
        if (waitIndex >= 0 && waitIndex + 1 < args.Length && int.TryParse(args[waitIndex + 1], out var pid))
        {
            try { using var previous = Process.GetProcessById(pid);
                if (!previous.WaitForExit(60_000)) throw new InvalidOperationException("DART не завершил работу. Обновление отменено."); }
            catch (ArgumentException) { }
        }
        installation.Activate(Path.GetFullPath(args[activateIndex + 1]));
    }
    var config = installation.Config;
    if (!Directory.Exists(config.ProfilePath)) throw new InvalidOperationException("Личный профиль недоступен. Создание пустого профиля запрещено.");
    var info = new ProcessStartInfo(installation.Executable()) { UseShellExecute = false };
    info.ArgumentList.Add("--data-dir"); info.ArgumentList.Add(config.ProfilePath);
    info.ArgumentList.Add("--installation-root"); info.ArgumentList.Add(installation.Root);
    foreach (var argument in args.Take(activateIndex < 0 ? args.Length : 0)) info.ArgumentList.Add(argument);
    _ = Process.Start(info) ?? throw new InvalidOperationException("Не удалось запустить DART.");
}
catch (Exception error)
{
    NativeError.MessageBox(IntPtr.Zero, error.Message, "DART — обновление не установлено", 0x10);
    Environment.ExitCode = 1;
}
internal static class NativeError
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int MessageBox(IntPtr window,
        string text, string caption, uint flags);
}
