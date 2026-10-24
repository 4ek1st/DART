using System.Buffers.Binary;

namespace ArtCatalog;

internal static class CatalogImageContent
{
    internal static string? Resolve(string declared, ReadOnlySpan<byte> data)
    {
        if (declared.StartsWith("image/", StringComparison.OrdinalIgnoreCase)) return declared;
        if (!declared.Equals("application/octet-stream", StringComparison.OrdinalIgnoreCase)) return null;

        // Some image CDNs use a generic binary MIME type. Infer only recognized
        // image signatures; a file extension alone must not authorize a response.
        if (data.Length >= 8 && BinaryPrimitives.ReadUInt64BigEndian(data) == 0x89504E470D0A1A0A)
            return "image/png";
        if (data.Length >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF)
            return "image/jpeg";
        if (data.StartsWith("GIF87a"u8) || data.StartsWith("GIF89a"u8)) return "image/gif";
        if (data.Length >= 12 && data.StartsWith("RIFF"u8) && data.Slice(8, 4).SequenceEqual("WEBP"u8))
            return "image/webp";
        if (data.Length >= 16 && data.Slice(4, 4).SequenceEqual("ftyp"u8))
        {
            var boxSize = BinaryPrimitives.ReadUInt32BigEndian(data);
            if (boxSize >= 16 && boxSize <= data.Length)
            {
                if (AvifBrand(data.Slice(8, 4))) return "image/avif";
                // The minor version at offset 12 is not a compatible brand.
                for (var offset = 16; offset + 4 <= Math.Min(boxSize, 4096); offset += 4)
                    if (AvifBrand(data.Slice(offset, 4))) return "image/avif";
            }
        }
        return null;
    }

    private static bool AvifBrand(ReadOnlySpan<byte> brand) =>
        brand.SequenceEqual("avif"u8) || brand.SequenceEqual("avis"u8);
}
