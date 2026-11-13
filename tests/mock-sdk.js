// Browser-only integration fixture. Never included in the production build.
const params=new URLSearchParams(window.top.location.search);
const connectionId=params.get('connection')||'gm',role=params.get('role')||'GM';
const wire=new BroadcastChannel('visions-test-transport');
const handlers=new Map();
wire.onmessage=({data})=>{if(data.connectionId!==connectionId)for(const f of handlers.get(data.channel)||[])f(data);};
const api={isAvailable:true,
  onReady(fn){queueMicrotask(()=>void fn());if(window===window.top&&location.pathname==='/'){const iframe=document.createElement('iframe');iframe.src='/background.html';iframe.hidden=true;document.body.append(iframe);}},
  player:{id:connectionId,getConnectionId:async()=>connectionId,getRole:async()=>role,onChange:()=>()=>{}},
  party:{getPlayers:async()=>[{id:'gm',connectionId:'gm',role:'GM'},{id:'player',connectionId:'player',role:'PLAYER'}]},
  broadcast:{sendMessage:async(channel,data)=>wire.postMessage({channel,data,connectionId}),onMessage(channel,fn){handlers.set(channel,[...(handlers.get(channel)||[]),fn]);if(location.pathname==='/background.html')window.top.document.body.dataset.background='ready';return ()=>{};}},
  modal:{async open(options){
    const doc=window.top.document;const iframe=doc.createElement('iframe');iframe.id='vision-modal';iframe.src=options.url;iframe.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;z-index:1000;';iframe.style.pointerEvents=options.disablePointerEvents?'none':'auto';iframe.dataset.options=JSON.stringify(options);doc.body.append(iframe);
  },async close(){window.top.document.querySelector('#vision-modal')?.remove();}},
  notification:{show:async text=>{window.top.document.body.dataset.notification=text;}}
};
export default api;
