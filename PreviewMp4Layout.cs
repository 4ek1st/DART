using System.Buffers.Binary;
using System.Text;

namespace ArtCatalog;

// Expose a conventional fast-start layout without downloading/reencoding the
// movie. Moving a trailing moov lets Chromium seek directly to five samples.
internal sealed record PreviewMp4Layout(long InsertAt, long OriginalStart, byte[] Movie)
{
    internal const int MaxMetadataBytes = 2 * 1024 * 1024;
    internal long OriginalEnd => OriginalStart + Movie.Length;
    internal double[] SampleTimes { get; init; } = [];

    internal static async Task<PreviewMp4Layout?> ReadAsync(long length,
        Func<long, int, Task<byte[]>> read)
    {
        long position = 0, insertAt = 0;
        var mediaSeen = false;
        for (var boxes = 0; boxes < 32 && position + 8 <= length; boxes++)
        {
            var header = await read(position, 8);
            var size = (long)BinaryPrimitives.ReadUInt32BigEndian(header);
            var type = Encoding.ASCII.GetString(header, 4, 4);
            var headerSize = 8;
            if (size == 1)
            {
                if (position + 16 > length) return null;
                var extended = await read(position + 8, 8);
                var wide = BinaryPrimitives.ReadUInt64BigEndian(extended);
                if (wide > long.MaxValue) return null;
                size = (long)wide; headerSize = 16;
            }
            else if (size == 0) size = length - position;
            if (size < headerSize || size > length - position) return null;
            if (position == 0)
            {
                if (type != "ftyp" || size > 4096) return null;
                insertAt = size;
            }
            if (type == "mdat") mediaSeen = true;
            if (type == "moov")
            {
                if (size > MaxMetadataBytes) return null;
                var movie = await read(position, (int)size);
                var times = PreviewMp4Samples.Read(movie, headerSize);
                // Muting does not stop Chromium fetching an interleaved audio
                // track. Ignore it only in hover metadata, preserving box sizes.
                PreviewMp4Samples.HideAudioTracks(movie, headerSize);
                if (mediaSeen && position > insertAt)
                {
                    if (!Rewrite(movie, headerSize, movie.Length, insertAt, position, size)) return null;
                    return new(insertAt, position, movie) { SampleTimes = times };
                }
                return new(position, position, movie) { SampleTimes = times };
            }
            position += size;
        }
        return null;
    }

    private static bool Rewrite(byte[] movie, int start, int end, long insertAt,
        long originalStart, long shift, int depth = 0)
    {
        if (depth > 8) return false;
        for (var position = start; position < end;)
        {
            if (end - position < 8) return false;
            var size = (long)BinaryPrimitives.ReadUInt32BigEndian(movie.AsSpan(position));
            var type = Encoding.ASCII.GetString(movie, position + 4, 4);
            var header = 8;
            if (size == 1)
            {
                if (end - position < 16) return false;
                var extended = BinaryPrimitives.ReadUInt64BigEndian(movie.AsSpan(position + 8));
                if (extended > int.MaxValue) return false;
                size = (long)extended; header = 16;
            }
            if (size < header || size > end - position) return false;
            var next = position + (int)size;
            if (type == "mvex") return false; // Fragmented movies keep their original layout.
            if (type is "trak" or "mdia" or "minf" or "stbl")
            {
                if (!Rewrite(movie, position + header, next, insertAt, originalStart, shift, depth + 1)) return false;
            }
            if (type is "stco" or "co64")
            {
                if (size < header + 8) return false;
                var count = BinaryPrimitives.ReadUInt32BigEndian(movie.AsSpan(position + header + 4));
                var width = type == "stco" ? 4 : 8;
                if (count > (size - header - 8) / width) return false;
                for (var index = 0; index < count; index++)
                {
                    var offset = position + header + 8 + (int)index * width;
                    var value = width == 4 ? BinaryPrimitives.ReadUInt32BigEndian(movie.AsSpan(offset))
                        : BinaryPrimitives.ReadUInt64BigEndian(movie.AsSpan(offset));
                    if (value >= (ulong)originalStart && value < (ulong)(originalStart + shift)) return false;
                    if (value >= (ulong)insertAt && value < (ulong)originalStart) value += (ulong)shift;
                    if (width == 4)
                    {
                        if (value > uint.MaxValue) return false;
                        BinaryPrimitives.WriteUInt32BigEndian(movie.AsSpan(offset), (uint)value);
                    }
                    else BinaryPrimitives.WriteUInt64BigEndian(movie.AsSpan(offset), value);
                }
            }
            position = next;
        }
        return true;
    }
}
