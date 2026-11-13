import OBR from '@owlbear-rodeo/sdk';
import {bridge} from './bridge.js';
import {elapsed} from './core.js';
import {envelope,fadeAway} from './fades.js';
import './screen.css';
const cut=document.querySelector('#cut'),film=document.querySelector('#film'),stop=document.querySelector('#stop'),unlock=document.querySelector('#unlock'),notice=document.querySelector('#notice');
let currentCut=null,currentMask=null,generation=0,maskGeneration=0,departing=false,bus,isGM=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function fadeOut(duration){
  generation++;maskGeneration++;
  if(currentCut)void fadeAway(film,cut,duration);
  for(const video of document.querySelector('#masks').children)void fadeAway(video,video,duration);
}
async function showCut(s){
  if(currentCut?.session===s?.session)return;
  const gen=++generation;
  const previous=currentCut;currentCut=s;
  if(previous){await fadeAway(film,cut,previous.asset.fade,()=>gen===generation);if(gen!==generation||departing)return;}
  film.pause();film.removeAttribute('src');film.load();
  currentCut=s;unlock.hidden=true;notice.textContent='';cut.style.opacity='0';
  if(!s){cut.hidden=true;return;}
  cut.hidden=false;stop.hidden=!isGM;
  cut.style.transition='none';
  notice.textContent='Preparando a visão…';
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
        film.volume=s.asset.volume*factor;cut.style.opacity=String(factor);
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
async function showMask(s){
  if(currentMask?.session===s?.session){currentMask=s;return;}
  const gen=++maskGeneration;
  const old=[...document.querySelector('#masks').children];
  const outgoingFade=currentMask?.asset.fade||700;
  for(const v of old){void fadeAway(v,v,outgoingFade).then(()=>{v.pause();v.removeAttribute('src');v.load();v.remove();});}
  currentMask=s;
  if(!s)return;
  const video=document.createElement('video');
  video.muted=false;video.volume=0;video.loop=true;video.playsInline=true;video.preload='auto';video.src=s.asset.url;
  video.style.transition='none';
  document.querySelector('#masks').append(video);
  video.onloadeddata=async()=>{
    if(gen!==maskGeneration||departing)return;
    video.currentTime=elapsed(s)%video.duration;
    try{await video.play();}
    catch{
      video.muted=true;
      try{await video.play();await OBR.notification.show('Visions: abra o painel e clique em Ativar áudio para liberar o som da máscara.','WARNING');}
      catch{await OBR.notification.show('Visions: o navegador bloqueou a máscara.','WARNING');return;}
    }
    const entered=performance.now();
    video.dataset.audioStart=String(entered);
    function tick(now){if(gen!==maskGeneration||departing)return;const factor=envelope(now-entered,Infinity,s.asset.fade);video.volume=s.asset.volume*envelope(now-Number(video.dataset.audioStart),Infinity,s.asset.fade);video.style.opacity=String(currentMask.asset.opacity*factor);requestAnimationFrame(tick);}
    requestAnimationFrame(tick);
  };
  video.onerror=()=>{void OBR.notification.show('Visions: não foi possível carregar a máscara.','ERROR');video.remove();};
}
OBR.onReady(async()=>{
  isGM=await OBR.player.getRole()==='GM';bus=await bridge();
  stop.onclick=()=>{if(isGM&&currentCut)bus.postMessage({type:'command',command:{type:'stop',kind:'cut',session:currentCut.session}});};
  OBR.player.onChange(p=>{isGM=p.role==='GM';stop.hidden=!isGM;});
  bus.onmessage=({data})=>{
    if(data?.type==='depart'){departing=true;fadeOut(data.duration||700);return;}
    if(data?.type==='audio'&&!departing){
      for(const video of document.querySelector('#masks').children){
        if(!video.muted)continue;
        video.volume=0;video.dataset.audioStart=String(performance.now());video.muted=false;
        video.play().catch(()=>{video.muted=true;void OBR.notification.show('Visions: permita a reprodução automática com som no navegador e tente novamente.','WARNING');});
      }
    }
    if(data?.type==='state'&&!departing){void showMask(data.state.mask);void showCut(data.state.cut);}
  };
  bus.postMessage({type:'get'});
});
