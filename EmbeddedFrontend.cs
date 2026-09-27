using System.Reflection;
using ArtCatalog.Updates;

namespace ArtCatalog;

internal static class EmbeddedFrontend
{
    internal static string Resolve()
    {
        var assembly = typeof(EmbeddedFrontend).Assembly;
        const string prefix = "ArtCatalogFrontend/";
        var resources = assembly.GetManifestResourceNames().Where(name => name.StartsWith(prefix, StringComparison.Ordinal)).ToArray();
        if (resources.Length == 0) return Path.Combine(AppContext.BaseDirectory, "wwwroot");
        var executable = Environment.ProcessPath ?? throw new InvalidOperationException("Не найден файл программы.");
        var directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "ArtCatalog", "Frontend", ReleaseProtocol.FileHash(executable));
        foreach (var name in resources)
        {
            var relative = name[prefix.Length..].Replace('\\', '/');
            var path = Path.GetFullPath(Path.Combine(directory, relative));
            if (!path.StartsWith(directory + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Неверный путь встроенного интерфейса.");
            using var stream = assembly.GetManifestResourceStream(name)!;
            using var memory = new MemoryStream(); stream.CopyTo(memory); var bytes = memory.ToArray();
            if (!File.Exists(path) || ReleaseProtocol.FileHash(path) != ReleaseProtocol.Hash(bytes))
                ReleaseProtocol.WriteAtomic(path, bytes);
        }
        return directory;
    }
}
