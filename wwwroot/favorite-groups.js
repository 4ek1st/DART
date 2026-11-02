(function(root) {
  'use strict';
  // Presentation groups contain real saved works. Never add group keys to a
  // CatalogItem's identity or turn different works into copies of one another.
  function layout(items, groups) {
    const byKey=new Map();
    for(const item of items) for(const key of [item.key,...(item.memberKeys||[])]) if(!byKey.has(key))byKey.set(key,item);
    const membership=new Map(), claimed=new Set();
    for(const group of groups) {
      const members=[...new Set((group.keys||[]).map(key=>byKey.get(key)).filter(item=>item&&!claimed.has(item)))];
      if(!members.length)continue;
      const row={item:members[0],items:members,groupId:group.id};
      for(const item of members){membership.set(item,row);claimed.add(item);}
    }
    const rows=[],shown=new Set();
    for(const item of items){const row=membership.get(item)||{item,items:[item],groupId:null};
      if(!shown.has(row.item)){rows.push(row);shown.add(row.item);}}
    return rows;
  }
  function create({request,changed=()=>{},toast=()=>{}}) {
    let groups=[],revision=0,pending=false,error=false,loading=null;
    function valid(value){return Array.isArray(value)&&value.every(group=>typeof group?.id==='string'&&Array.isArray(group.keys)&&group.keys.every(key=>typeof key==='string'));}
    async function load(){
      if(loading)return loading;
      const version=revision;
      loading=(async()=>{try{const value=await request('/api/favorite-artwork-groups');if(!valid(value))throw Error('Invalid groups');
        if(version===revision){groups=value;error=false;changed();}return true;
      }catch{error=true;changed();return false;}finally{loading=null;}})();return loading;
    }
    async function update(body){
      if(pending)return false;
      pending=true;revision++;changed();
      try{const value=await request('/api/favorite-artwork-groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        if(!valid(value))throw Error('Invalid groups');groups=value;error=false;return true;
      }catch{toast('Could not save the group. Your Favorites were kept.');return false;}
      finally{pending=false;revision++;changed();}
    }
    return{load,groups:()=>groups,layout:items=>layout(items,groups),
      merge:(fromKey,toKey)=>!fromKey||!toKey||fromKey===toKey?Promise.resolve(false):update({fromKey,toKey}),
      ungroup:ungroupId=>update({ungroupId}),get pending(){return pending;},get error(){return error;}};
  }
  const api={layout,create};root.DartFavoriteGroups=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);
