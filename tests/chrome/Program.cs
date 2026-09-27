using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.Json;
using ArtCatalog;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal static class ChromeTest
{
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
    private static extern nint GetWindowLong(nint handle, int index);
    [STAThread]
    private static int Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        using var form = new CatalogForm(args[0], Path.Combine(Path.GetTempPath(), "DART-ChromeTests-" + Guid.NewGuid())) { ShowInTaskbar = false, StartPosition = FormStartPosition.Manual, Location = new Point(30, 30) };
        bool commandsPassed = false, closed = false;
        form.FormClosed += (_, _) => closed = true;
        Exception? failure = null;
        form.Shown += async (_, _) =>
        {
            try
            {
                var web = (WebView2)typeof(CatalogForm).GetField("webView", BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(form)!;
                web.CoreWebView2InitializationCompleted += (_, e) => { if (!e.IsSuccess) Console.Error.WriteLine(e.InitializationException); };
                var deadline = DateTime.UtcNow.AddSeconds(35);
                while (web.CoreWebView2 is null && DateTime.UtcNow < deadline) await Task.Delay(100);
                if (web.CoreWebView2 is null) throw new Exception("Native WebView did not initialize.");
                while (DateTime.UtcNow < deadline)
                {
                    if (await web.CoreWebView2.ExecuteScriptAsync("!!document.querySelector('.desktop-window #window-controls:not([hidden])')") == "true") break;
                    await Task.Delay(100);
                }
                if (((long)GetWindowLong(form.Handle, -16) & 0x00C00000) != 0) throw new Exception("Separate caption is still present.");
                if (!web.CoreWebView2.Settings.IsNonClientRegionSupportEnabled) throw new Exception("Native drag regions disabled.");
                var state = await web.CoreWebView2.ExecuteScriptAsync("JSON.stringify({title:document.title,controls:!document.getElementById('window-controls').hidden,update:!document.getElementById('install-update-button').hidden})");
                using var document = JsonDocument.Parse(JsonSerializer.Deserialize<string>(state)!);
                if (!document.RootElement.GetProperty("controls").GetBoolean() || document.RootElement.GetProperty("update").GetBoolean())
                    throw new Exception("Native controls/update visibility incorrect.");
                using var capture = new MemoryStream();
                await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, capture);
                capture.Position = 0; using var full = new Bitmap(capture);
                using var header = full.Clone(new Rectangle(0, 0, full.Width, Math.Min(124, full.Height)), full.PixelFormat);
                header.Save(args[1], System.Drawing.Imaging.ImageFormat.Png);
                await Click(web, "maximize");
                if (form.WindowState != FormWindowState.Maximized) throw new Exception("Maximize failed.");
                await Click(web, "maximize");
                if (form.WindowState != FormWindowState.Normal) throw new Exception("Restore failed.");
                await Click(web, "minimize");
                if (form.WindowState != FormWindowState.Minimized) throw new Exception("Minimize failed.");
                form.WindowState = FormWindowState.Normal;
                Console.WriteLine("Native WebView: caption removed, drag enabled, update hidden, maximize/restore/minimize bridge: PASS");
                commandsPassed = true;
                await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-window-command=close]').click()");
            }
            catch (Exception error) { failure = error; form.Close(); }
        };
        Application.Run(form);
        if (failure is not null) { Console.Error.WriteLine(failure); return 1; }
        if (!commandsPassed || !closed) return 1;
        Console.WriteLine("Native close: PASS");
        return 0;
    }
    private static async Task Click(WebView2 web, string command)
    {
        await web.CoreWebView2.ExecuteScriptAsync($"document.querySelector('[data-window-command={command}]').click()");
        await Task.Delay(400);
    }
}
