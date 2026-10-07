using System.Buffers.Binary;
using System.Text;

namespace ArtCatalog;

// Pick five nearby independently decodable frames. Seeking an arbitrary P/B
// frame can otherwise download an entire long GOP for a single small preview.
internal static class PreviewMp4Samples
{
    private readonly record struct Box(string Type, int Data, int End, int TypeAt = 0);
    private static List<Box> Children(byte[] data, int start, int end)
    {
        var boxes = new List<Box>();
        while (start + 8 <= end && boxes.Count < 65536)
        {
            long size = UInt(data, start); var header = 8;
            if (size == 1)
            {
                if (start + 16 > end) return [];
                var wide = BinaryPrimitives.ReadUInt64BigEndian(data.AsSpan(start + 8));
                if (wide > int.MaxValue) return [];
                size = (long)wide; header = 16;
            }
            if (size < header || size > end - start) return [];
            boxes.Add(new(Encoding.ASCII.GetString(data, start + 4, 4), start + header, start + (int)size, start + 4));
            start += (int)size;
        }
        return start == end ? boxes : [];
    }
    private static uint UInt(byte[] data, int at) => BinaryPrimitives.ReadUInt32BigEndian(data.AsSpan(at, 4));
    private static Box Child(byte[] data, Box parent, string name) => Children(data, parent.Data, parent.End)
        .FirstOrDefault(box => box.Type == name);
    private static bool Table(byte[] data, Box box, int width, out int count)
    {
        count = 0;
        if (box.Type is null || box.End - box.Data < 8) return false;
        var number = UInt(data, box.Data + 4);
        if (number == 0 || number > 65536 || number > (box.End - box.Data - 8) / width) return false;
        count = (int)number; return true;
    }

    internal static void HideAudioTracks(byte[] data, int header)
    {
        foreach (var track in Children(data, header, data.Length).Where(box => box.Type == "trak"))
        {
            var handler = Child(data, Child(data, track, "mdia"), "hdlr");
            if (handler.End - handler.Data >= 12 && Encoding.ASCII.GetString(data, handler.Data + 8, 4) == "soun")
                Encoding.ASCII.GetBytes("free").CopyTo(data, track.TypeAt);
        }
    }

    internal static double[] Read(byte[] data, int header)
    {
        var movie = new Box("moov", header, data.Length);
        foreach (var track in Children(data, movie.Data, movie.End).Where(box => box.Type == "trak"))
        {
            var media = Child(data, track, "mdia");
            var handler = Child(data, media, "hdlr");
            if (handler.End - handler.Data < 12 || Encoding.ASCII.GetString(data, handler.Data + 8, 4) != "vide") continue;
            var time = Child(data, media, "mdhd");
            if (time.End - time.Data < 24 || data[time.Data] > 1) continue;
            var scaleAt = time.Data + (data[time.Data] == 1 ? 20 : 12);
            if (scaleAt + 4 > time.End) continue;
            var scale = UInt(data, scaleAt); if (scale == 0) continue;
            var table = Child(data, Child(data, media, "minf"), "stbl");
            var timing = Child(data, table, "stts");
            var sync = Child(data, table, "stss");
            if (!Table(data, timing, 8, out var runs) || !Table(data, sync, 4, out var keys) || keys < 5) continue;
            var composition = Child(data, table, "ctts");
            var hasComposition = Table(data, composition, 8, out var compositions) && data[composition.Data] <= 1;
            long sample = 1, compositionStart = 1;
            double elapsed = 0;
            var compositionRun = 0;
            var key = 0; var points = new List<double>(); var valid = true;
            uint previousKey = 0;
            for (var run = 0; run < runs && valid; run++)
            {
                var at = timing.Data + 8 + run * 8;
                var count = UInt(data, at); var delta = UInt(data, at + 4);
                if (count == 0 || delta == 0) { valid = false; break; }
                while (key < keys)
                {
                    var index = UInt(data, sync.Data + 8 + key * 4);
                    if (index >= sample + count) break;
                    if (index < sample || index <= previousKey) { valid = false; break; }
                    long offset = 0;
                    if (hasComposition)
                    {
                        while (compositionRun < compositions)
                        {
                            var entry = composition.Data + 8 + compositionRun * 8;
                            var covered = UInt(data, entry);
                            if (covered == 0) { valid = false; break; }
                            if (index < compositionStart + covered)
                            {
                                var raw = UInt(data, entry + 4);
                                offset = data[composition.Data] == 1 ? unchecked((int)raw) : raw;
                                break;
                            }
                            compositionStart += covered; compositionRun++;
                        }
                        if (compositionRun >= compositions) valid = false;
                    }
                    points.Add((elapsed + (index - sample) * delta + offset + Math.Min(delta * .5, scale * .002)) / scale);
                    previousKey = index; key++;
                }
                elapsed += (double)count * delta; sample += count;
                if (elapsed / scale > 24 * 60 * 60) valid = false;
            }
            if (!valid || key != keys || points.Count < 5) continue;
            var duration = elapsed / scale;
            var available = points.Where(point => point >= 0 && point < duration).ToArray();
            if (available.Length < 5) continue;
            var picked = new[] { .1, .3, .5, .7, .9 }.Select(part => available
                .MinBy(point => Math.Abs(point - part * duration))).ToArray();
            if (picked.Distinct().Count() == 5) return picked;
        }
        return [];
    }
}
