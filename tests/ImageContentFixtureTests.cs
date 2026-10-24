using System.Buffers.Binary;
using System.Reflection;
using ArtCatalog;

internal static class ImageContentFixtureTests
{
    private delegate string? ResolveContent(string declared, ReadOnlySpan<byte> data);

    internal static void Run()
    {
        var type = typeof(CatalogItem).Assembly.GetType("ArtCatalog.CatalogImageContent")!;
        var resolve = type.GetMethod("Resolve", BindingFlags.NonPublic | BindingFlags.Static)!
            .CreateDelegate<ResolveContent>();
        static void Check(bool condition, string message)
        {
            if (!condition) throw new Exception(message);
        }
        static byte[] Box(string major, params string[] compatible)
        {
            var bytes = new byte[16 + 4 * compatible.Length];
            BinaryPrimitives.WriteUInt32BigEndian(bytes, (uint)bytes.Length);
            System.Text.Encoding.ASCII.GetBytes("ftyp" + major).CopyTo(bytes, 4);
            for (var i = 0; i < compatible.Length; i++)
                System.Text.Encoding.ASCII.GetBytes(compatible[i]).CopyTo(bytes, 16 + i * 4);
            return bytes;
        }

        const string binary = "application/octet-stream";
        Check(resolve(binary, Box("avif", "avif", "mif1", "miaf")) == "image/avif",
            "Sankaku's binary-labelled AVIF preview must load as an image");
        Check(resolve(binary, Box("mif1", "miaf", "avif")) == "image/avif",
            "An AVIF compatible brand must be recognized");
        Check(resolve("APPLICATION/OCTET-STREAM", Box("avis")) == "image/avif",
            "Animated AVIF and MIME casing must be supported");
        Check(resolve(binary, new byte[] { 0x89, 0x50, 0x4E, 0x47, 13, 10, 26, 10 }) == "image/png" &&
            resolve(binary, new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }) == "image/jpeg" &&
            resolve(binary, "GIF89a"u8) == "image/gif" &&
            resolve(binary, "RIFF0000WEBP"u8) == "image/webp",
            "Known binary-labelled image formats must retain their real MIME types");
        Check(resolve("image/svg+xml", "<svg/>"u8) == "image/svg+xml" &&
            resolve("image/webp", []) == "image/webp",
            "Correctly declared image responses must keep existing behavior");
        Check(resolve(binary, "<html>not an image</html>"u8) is null &&
            resolve(binary, []) is null && resolve(binary, "RIFF"u8) is null &&
            resolve("text/html", Box("avif")) is null,
            "HTML, truncated signatures and nonbinary MIME types must stay rejected");
        Check(resolve(binary, Box("mp42", "isom")) is null,
            "An MP4 container is not an AVIF image");
        var truncated = Box("avif");
        BinaryPrimitives.WriteUInt32BigEndian(truncated, 1000);
        Check(resolve(binary, truncated) is null, "A truncated AVIF file-type box must stay rejected");
        var versionOnly = Box("mif1");
        "avif"u8.CopyTo(versionOnly.AsSpan(12));
        Check(resolve(binary, versionOnly) is null, "A minor version must not be mistaken for an AVIF brand");
        Console.WriteLine("Image CDN binary MIME detection and nonimage rejection: PASS");
    }
}
