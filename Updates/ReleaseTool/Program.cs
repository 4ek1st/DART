using System.Text.Json;
using ArtCatalog.Updates;
try
{
    switch (args[0])
    {
        case "init": ReleasePublisher.Initialize(args[1], args[2], args[3], args[4], args[5]); break;
        case "check-base": ReleasePublisher.CheckBase(args[1], args[2]); break;
        case "seal": Console.WriteLine(ReleasePublisher.Seal(args[1], args[2], args[3], args[4], args[5], args[6], File.ReadAllText(args[7]), args.Length > 8 ? args[8] : "")); break;
        case "bootstrap": new Installation(args[1]).Activate(args[2], bootstrap: true); break;
        case "activate": new Installation(args[1]).Activate(args[2]); break;
        case "current": Console.WriteLine(JsonSerializer.Serialize(new Installation(args[1]).Current(), ReleaseProtocol.Json)); break;
        case "check": Console.WriteLine(JsonSerializer.Serialize(await new UpdateService(args[1]).CheckAsync(true, default), ReleaseProtocol.Json)); break;
        default: throw new InvalidOperationException("Unknown release operation.");
    }
}
catch (Exception error) { Console.Error.WriteLine(error.Message); Environment.ExitCode = 1; }
