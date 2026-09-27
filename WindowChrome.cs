using System.Runtime.InteropServices;

namespace ArtCatalog;

internal static class WindowChrome
{
    // Match the WebView tab strip (#181818) while retaining native window controls.
    private const int ImmersiveDarkMode = 20;
    private const int BorderColor = 34;
    private const int CaptionColor = 35;
    private const int TextColor = 36;
    private const int ChromeColor = 0x00181818;
    private const int LightText = 0x00F3F3F3;

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(
        IntPtr window, int attribute, ref int value, int valueSize);

    internal static void Apply(IntPtr window)
    {
        if (!OperatingSystem.IsWindowsVersionAtLeast(10, 0, 22000)) return;

        var enabled = 1;
        _ = DwmSetWindowAttribute(window, ImmersiveDarkMode, ref enabled, sizeof(int));
        var chrome = ChromeColor;
        _ = DwmSetWindowAttribute(window, CaptionColor, ref chrome, sizeof(int));
        _ = DwmSetWindowAttribute(window, BorderColor, ref chrome, sizeof(int));
        var text = LightText;
        _ = DwmSetWindowAttribute(window, TextColor, ref text, sizeof(int));
    }
}
