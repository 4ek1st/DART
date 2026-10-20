using System.Reflection;
using System.Text;
using ArtCatalog.Updates;

namespace ArtCatalog;

internal static class EmbeddedFrontend
{
    private const string Prefix = "ArtCatalogFrontend/";

    internal static string Resolve()
    {
        var assembly = typeof(EmbeddedFrontend).Assembly;
        if (!assembly.GetManifestResourceNames().Any(name => name.StartsWith(Prefix, StringComparison.Ordinal)))
            return Path.Combine(AppContext.BaseDirectory, "wwwroot");
        var executable = Environment.ProcessPath ?? throw new InvalidOperationException("Не найден файл программы.");
        var directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "ArtCatalog", "Frontend", ReleaseProtocol.FileHash(executable));
        return Extract(directory);
    }

    internal static string Extract(string directory)
    {
        directory = Path.TrimEndingDirectorySeparator(Path.GetFullPath(directory));
        var assembly = typeof(EmbeddedFrontend).Assembly;
        using var extractionLock = AcquireExtractionLock(directory);
        try
        {
            foreach (var name in assembly.GetManifestResourceNames().Where(name => name.StartsWith(Prefix, StringComparison.Ordinal)))
            {
                var relative = name[Prefix.Length..].Replace('\\', '/');
                var path = Path.GetFullPath(Path.Combine(directory, relative));
                if (!path.StartsWith(directory + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("Неверный путь встроенного интерфейса.");
                using var stream = assembly.GetManifestResourceStream(name)!;
                using var memory = new MemoryStream(); stream.CopyTo(memory); var bytes = memory.ToArray();
                if (!File.Exists(path) || ReleaseProtocol.FileHash(path) != ReleaseProtocol.Hash(bytes))
                    ReleaseProtocol.WriteAtomic(path, bytes);
            }
        }
        finally { extractionLock.ReleaseMutex(); }
        return directory;
    }

    private static Mutex AcquireExtractionLock(string directory)
    {
        var fullPath = Path.TrimEndingDirectorySeparator(Path.GetFullPath(directory)).ToUpperInvariant();
        var name = @"Local\DART.Frontend." + ReleaseProtocol.Hash(Encoding.UTF8.GetBytes(fullPath));
        var mutex = new Mutex(false, name);
        try
        {
            try
            {
                if (!mutex.WaitOne(TimeSpan.FromSeconds(30)))
                    throw new TimeoutException("Не удалось дождаться извлечения встроенного интерфейса.");
            }
            catch (AbandonedMutexException) { /* The previous process exited; this caller owns the mutex. */ }
            return mutex;
        }
        catch { mutex.Dispose(); throw; }
    }
}
