import OBR from '@owlbear-rodeo/sdk';
import {bridge} from './bridge.js';
import {elapsed} from './core.js';
import {readLibrary,writeLibrary} from './library.js';
import {envelope,fadeAway} from './fades.js';
import './screen.css';
const cut=document.querySelector('#cut'),film=document.querySelector('#film'),stop=document.querySelector('#stop'),unlock=document.querySelector('#unlock'),notice=document.querySelector('#notice');
const maskSlots=new Map();
let currentCut=null,generation=0,departing=false,bus,isGM=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const volumeControl=document.createElement('label');volumeControl.id='live-volume';volumeControl.hidden=true;
const volumeText=document.createElement('span'),volumeInput=document.createElement('input');
volumeInput.type='range';volumeInput.min='0';volumeInput.max='100';volumeInput.setAttribute('aria-label','Volume da cutscene');
volumeControl.append(volumeText,volumeInput);cut.append(volumeControl);
function syncVolumeControl(){
  volumeControl.hidden=!isGM||!currentCut||currentCut.asset.media==='image';
  if(currentCut&&document.activeElement!==volumeInput){volumeInput.value=String(Math.round(currentCut.asset.volume*100));volumeText.textContent=`Volume: ${volumeInput.value}%`;}
}
volumeInput.oninput=()=>{volumeText.textContent=`Volume: ${volumeInput.value}%`;};
volumeInput.onchange=()=>{
  if(!isGM||!currentCut)return;
  const volume=Number(volumeInput.value)/100,id=currentCut.asset.id;
  const key='visions/library/'+OBR.player.id;
  try{writeLibrary(key,readLibrary(key).map(item=>item.id===id?{...item,volume}:item));}
  catch(error){void OBR.notification.show('Volume ajustado para esta apresentação; não foi possível salvar na biblioteca.','WARNING');}
  bus.postMessage({type:'command',command:{type:'volume',kind:'cut',id,volume}});
};
function fadeOut(duration){
  generation++;
  if(currentCut)void fadeAway(film,cut,duration);
  for(const entry of maskSlots.values()){entry.stopped=true;void fadeAway(entry.el,entry.el,duration);}
}
async function showCut(s){
  if(currentCut?.session===s?.session){currentCut=s;if(s)film.muted=s.asset.volume===0;syncVolumeControl();return;}
  const gen=++generation;
  const previous=currentCut;currentCut=s;
  if(previous){await fadeAway(film,cut,previous.asset.fade,()=>gen===generation);if(gen!==generation||departing)return;}
  document.querySelector('#cut-image')?.remove();film.hidden=false;
  film.pause();film.removeAttribute('src');film.load();
  currentCut=s;unlock.hidden=true;notice.textContent='';cut.style.opacity='0';
  if(!s){cut.hidden=true;return;}
  cut.hidden=false;stop.hidden=!isGM;syncVolumeControl();
  cut.style.transition='none';
  notice.textContent='Preparando a visão…';
  if(s.asset.media==='image'){
    film.hidden=true;const img=new Image();img.id='cut-image';cut.prepend(img);
    img.onload=()=>{notice.textContent='';const entered=performance.now();function tick(now){if(gen!==generation||departing)return;const remaining=s.asset.duration-elapsed(s);cut.style.opacity=String(Date.now()<s.startedAt?0:envelope(Math.min(now-entered,Math.max(0,Date.now()-s.startedAt)),remaining,s.asset.fade));if(remaining>0)requestAnimationFrame(tick);else ended();}requestAnimationFrame(tick);};
    img.onerror=()=>{notice.textContent='Imagem inacessível. O GM pode interromper.';cut.style.opacity='1';};img.src=s.asset.url;return;
  }
  film.src=s.asset.url;film.volume=0;film.muted=s.asset.volume===0;
  const ready=()=>{
    if(gen!==generation||departing)return;
    if(elapsed(s)>=s.asset.duration){ended();return;}
    film.currentTime=Math.min(elapsed(s),Math.max(0,film.duration-.1));
    void start();
  };
  async function start(){
    if(gen!==generation||departing)return;
    if(Date.now()<s.startedAt){await sleep(s.startedAt-Date.now());if(gen!==generation||departing)return;}
    try{
      await film.play();
      if(gen!==generation||departing)return;
      notice.textContent='';unlock.hidden=true;
      const entered=performance.now();
      function tick(now){
        if(gen!==generation||departing)return;
        const remaining=Number.isFinite(film.duration)?film.duration-film.currentTime:s.asset.duration-film.currentTime;
        const factor=envelope(now-entered,remaining,s.asset.fade);
        film.volume=currentCut.asset.volume*factor;cut.style.opacity=String(factor);
        if(!film.ended)requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }catch{
      if(gen!==generation)return;
      notice.textContent='Seu navegador pediu um clique para iniciar o vídeo.';unlock.hidden=false;cut.style.opacity='1';
    }
  }
  function ended(){
    if(gen!==generation)return;
    cut.style.opacity='0';
    setTimeout(()=>{if(gen===generation)bus.postMessage({type:'ended',session:s.session});},s.asset.fade);
  }
  unlock.onclick=()=>{
    if(elapsed(s)>=s.asset.duration){ended();return;}
    film.currentTime=Math.min(elapsed(s),Math.max(0,film.duration-.1));void start();
  };
  film.oncanplay=null;
  film.onloadeddata=ready;
  film.onended=ended;
  film.ontimeupdate=null;
  film.onerror=()=>{notice.textContent='Não foi possível carregar este vídeo. O GM pode interromper a apresentação.';cut.style.opacity='1';};
  setTimeout(()=>{if(gen===generation&&film.readyState<2){notice.textContent='O vídeo está demorando a carregar. Verifique a conexão.';cut.style.opacity='1';}},15000);
  film.load();
}
function showMask(s,slot){
  const old=maskSlots.get(slot);
  if(old?.s.session===s?.session){if(old){if(old.el.tagName==='VIDEO'&&old.s.asset.volume===0&&s.asset.volume>0)old.el.muted=false;old.s=s;}return;}
  if(old){old.stopped=true;maskSlots.delete(slot);void fadeAway(old.el,old.el,old.s.asset.fade).then(()=>{old.el.pause?.();old.el.removeAttribute('src');old.el.load?.();old.el.remove();});}
  if(!s)return;
  const type=s.asset.media||'video',el=document.createElement(type==='video'?'video':type==='image'?'img':'div');
  el.volume=0;el.style.opacity='0';el.style.zIndex=slot==='mask2'?'2':'1';el.style.transition='none';
  const entry={s,el,stopped:false};maskSlots.set(slot,entry);document.querySelector('#masks').append(el);
  const valid=()=>!entry.stopped&&!departing&&maskSlots.get(slot)===entry;
  async function start(){
    if(Date.now()<s.startedAt)await sleep(s.startedAt-Date.now());if(!valid())return;
    if(type==='video'){
      el.currentTime=elapsed(s)%el.duration;
      try{await el.play();}catch{el.muted=true;try{await el.play();void OBR.notification.show('Visions: clique em Ativar áudio no painel para liberar o som.','WARNING');}catch{return;}}
    }
    if(!valid())return;const entered=performance.now();el.dataset.audioStart=String(entered);
    function tick(now){if(!valid())return;el.volume=entry.s.asset.volume*envelope(now-Number(el.dataset.audioStart),Infinity,s.asset.fade);el.style.opacity=String(entry.s.asset.opacity*envelope(now-entered,Infinity,s.asset.fade));requestAnimationFrame(tick);}requestAnimationFrame(tick);
  }
  el.onerror=()=>{if(valid())void OBR.notification.show('Visions: não foi possível carregar a máscara.','ERROR');};
  if(type==='color'){el.style.backgroundColor=s.asset.color;void start();}
  else if(type==='image'){el.onload=start;el.src=s.asset.url;}
  else{el.loop=true;el.playsInline=true;el.muted=s.asset.volume===0;el.onloadeddata=start;el.src=s.asset.url;}
}
OBR.onReady(async()=>{
  isGM=await OBR.player.getRole()==='GM';bus=await bridge();
  stop.onclick=()=>{if(isGM&&currentCut)bus.postMessage({type:'command',command:{type:'stop',kind:'cut',session:currentCut.session}});};
  OBR.player.onChange(p=>{isGM=p.role==='GM';stop.hidden=!isGM;syncVolumeControl();});
  bus.onmessage=({data})=>{
    if(data?.type==='depart'){departing=true;fadeOut(data.duration||700);return;}
    if(data?.type==='audio'&&!departing){
      for(const video of document.querySelectorAll('#masks video')){
        if(!video.muted)continue;
        video.volume=0;video.dataset.audioStart=String(performance.now());video.muted=false;
        video.play().catch(()=>{video.muted=true;void OBR.notification.show('Visions: permita a reprodução automática com som no navegador e tente novamente.','WARNING');});
      }
    }
    if(data?.type==='state'&&!departing){showMask(data.state.mask,'mask');showMask(data.state.mask2,'mask2');void showCut(data.state.cut);}
  };
  bus.postMessage({type:'get'});
});


