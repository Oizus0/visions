import OBR from '@owlbear-rodeo/sdk';
import {WIRE,HELLO,MODAL,emptyState,stateValue,senderIsGM,commandState,finished} from './core.js';
import {bridge,absolute} from './bridge.js';
OBR.onReady(async()=>{
  const bus=await bridge();
  let state=emptyState(),mode='none',displayedFade=700,queue=Promise.resolve();
  const run=fn=>{queue=queue.then(fn).catch(e=>{console.error(e);bus.postMessage({type:'error',message:e.message});});};
  const snapshot=()=>bus.postMessage({type:'state',state});
  async function display(){
    const desired=state.cut?'cut':state.mask?'mask':'none';
    if(mode!==desired){
      if(mode!=='none'){
        bus.postMessage({type:'depart',duration:displayedFade});
        await new Promise(resolve=>setTimeout(resolve,displayedFade+100));
        await OBR.modal.close(MODAL);
      }
      mode=desired;
      if(mode!=='none')await OBR.modal.open({id:MODAL,url:absolute('screen.html'),fullScreen:true,hideBackdrop:true,hidePaper:true,disablePointerEvents:mode==='mask'});
    }
    displayedFade=Math.max(state.cut?.asset.fade||0,state.mask?.asset.fade||0,350);
    snapshot();
  }
  async function publish(){await display();await OBR.broadcast.sendMessage(WIRE,{state},{destination:'REMOTE'});}
  bus.onmessage=({data})=>{
    if(data?.type==='get')snapshot();
    if(data?.type==='ended')run(async()=>{
      if(state.cut?.session!==data.session)return;
      if(await OBR.player.getRole()==='GM'){
        state=commandState(state,{type:'stop',kind:'cut',session:data.session});await publish();
      }else{state={...state,cut:null};await display();}
    });
    if(data?.type==='command')run(async()=>{
      if(await OBR.player.getRole()!=='GM')throw new Error('Somente o GM pode controlar o Visions.');
      state=commandState(state,data.command);await publish();
    });
  };
  OBR.broadcast.onMessage(WIRE,event=>run(async()=>{
    if(!senderIsGM(event.connectionId,await OBR.party.getPlayers()))return;
    const incoming=stateValue(event.data?.state);
    if(incoming.rev<=state.rev)return;
    if(finished(incoming.cut))incoming.cut=null;
    state=incoming;await display();
  }));
  OBR.broadcast.onMessage(HELLO,()=>run(async()=>{
    if(await OBR.player.getRole()==='GM'&&state.rev)await OBR.broadcast.sendMessage(WIRE,{state},{destination:'REMOTE'});
  }));
  await OBR.broadcast.sendMessage(HELLO,{});
  // Reannounce active state and recover missed messages / participants arriving late.
  setInterval(()=>run(async()=>{
    if(await OBR.player.getRole()!=='GM')return;
    if(finished(state.cut)){state=commandState(state,{type:'stop',kind:'cut'});await publish();}
    else if(state.rev)await OBR.broadcast.sendMessage(WIRE,{state},{destination:'REMOTE'});
  }),5000);
});
