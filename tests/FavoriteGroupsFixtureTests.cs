using System.Reflection;
using ArtCatalog;

internal static class FavoriteGroupsFixtureTests
{
    internal static void Run()
    {
        var type=typeof(CatalogItem).Assembly.GetType("ArtCatalog.LocalStore")!;
        var merge=type.GetMethod("GroupFavoriteArtworks")??throw new Exception("Manual Favorites groups are missing");
        var path=Path.Combine(Path.GetTempPath(),"DART-favorite-groups-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(path);
        object Open()=>Activator.CreateInstance(type,[path])!;
        try
        {
            var store=Open();
            foreach(var id in new[]{"1","2","3"})type.GetMethod("SetFavoriteArtwork")!.Invoke(store,[new CatalogItem{Source="danbooru",Id=id,Key="danbooru:"+id,Title="Work "+id,Rating="g",Thumbnail="https://cdn.donmai.us/fixture.jpg"},true]);
            var result=merge.Invoke(store,["danbooru:1","danbooru:2",null])!;
            var json = new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web);
            var groups=System.Text.Json.JsonSerializer.SerializeToNode(result,json)!.AsArray();
            if(groups.Count!=1||groups[0]!["keys"]![0]!.GetValue<string>()!="danbooru:2")throw new Exception("Drop target must supply the persistent group cover");
            var joined=merge.Invoke(Open(),["danbooru:2","danbooru:3",null])!;
            groups=System.Text.Json.JsonSerializer.SerializeToNode(joined,json)!.AsArray();
            if(groups.Count!=1||groups[0]!["keys"]!.AsArray().Count!=3)throw new Exception("Dropping a group must retain every member across restart");
            var file=Path.Combine(path,"favorite-artwork-groups-v1.json");
            var good=File.ReadAllBytes(file);var backup=File.ReadAllBytes(file+".bak");
            File.WriteAllText(file,"{broken");
            if(((System.Collections.ICollection)type.GetMethod("GetFavoriteArtworkGroups")!.Invoke(Open(),null)!).Count!=1)
                throw new Exception("Damaged primary must retain the good backup for reads");
            try{merge.Invoke(store,["danbooru:1","danbooru:3",null]);throw new Exception("Damaged groups must reject writes");}
            catch(TargetInvocationException error)when(error.InnerException is System.Text.Json.JsonException or IOException){}
            if(!File.ReadAllBytes(file+".bak").SequenceEqual(backup))throw new Exception("A rejected write must preserve the good backup");
            File.WriteAllBytes(file,good);
            var groupId=groups[0]!["id"]!.GetValue<string>();merge.Invoke(store,["","",groupId]);
            if(((System.Collections.ICollection)type.GetMethod("GetFavoriteArtworkGroups")!.Invoke(Open(),null)!).Count!=0)throw new Exception("Ungroup must remove only group metadata");
            if(((List<CatalogItem>)type.GetMethod("GetFavoriteArtworks")!.Invoke(store,null)!).Count!=3)throw new Exception("Grouping must preserve original Favorite artworks");
            try{merge.Invoke(store,["danbooru:missing","danbooru:1",null]);throw new Exception("Missing Favorites cannot be grouped");}
            catch(TargetInvocationException error)when(error.InnerException is ArgumentException){}
            Console.WriteLine("Manual Favorite groups: drop target, group merge, restart, rejected corruption, backup preservation and nondestructive ungroup PASS");
        }
        finally{Directory.Delete(path,true);}
    }
}
