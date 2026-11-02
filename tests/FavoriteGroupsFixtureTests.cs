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
            var bridgePath=Path.Combine(path,"bridge");Directory.CreateDirectory(bridgePath);
            var bridge=Activator.CreateInstance(type,[bridgePath])!;
            var choices=Enumerable.Range(1,5).Select(id=>new CatalogItem{Source="danbooru",Id=id.ToString(),Key="danbooru:"+id,Title="Bridge "+id,Rating="g",Thumbnail="https://cdn.donmai.us/bridge-"+id+".jpg"}).ToArray();
            foreach(var item in choices)type.GetMethod("SetFavoriteArtwork")!.Invoke(bridge,[item,true]);
            merge.Invoke(bridge,[choices[1].Key,choices[0].Key,null]);merge.Invoke(bridge,[choices[3].Key,choices[2].Key,null]);
            type.GetMethod("SetFavoriteArtwork")!.Invoke(bridge,[choices[0],false]);type.GetMethod("SetFavoriteArtwork")!.Invoke(bridge,[choices[2],false]);
            choices[2].MemberKeys=[choices[0].Key];type.GetMethod("SetFavoriteArtwork")!.Invoke(bridge,[choices[2],true]);
            merge.Invoke(bridge,[choices[1].Key,choices[4].Key,null]);
            var reconciled=System.Text.Json.JsonSerializer.SerializeToNode(type.GetMethod("GetFavoriteArtworkGroups")!.Invoke(Activator.CreateInstance(type,[bridgePath]),null),json)!.AsArray();
            if(reconciled.Count!=1||!reconciled[0]!["keys"]!.AsArray().Select(key=>key!.GetValue<string>()).SequenceEqual(["danbooru:5","danbooru:3","danbooru:2","danbooru:4"]))
                throw new Exception("Alias bridges must reconcile all connected packs before writing a valid target-first group");
            Console.WriteLine("Manual Favorite groups: drop target, group merge, restart, rejected corruption, backup preservation and nondestructive ungroup PASS");
        }
        finally{Directory.Delete(path,true);}
    }
}
