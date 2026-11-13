import OBR from '@owlbear-rodeo/sdk';
import {bridge} from './bridge.js';
import {asset,mediaURL,emptyState} from './core.js';
import {readLibrary,writeLibrary,inspectVideo,upload} from './library.js';
import './style.css';
const $=s=>document.querySelector(s);
let kind='cut',items=[],key='',bus=null,isGM=false,state=emptyState();
const say=text=>{$('#status').textContent=text;};
async function safe(fn){try{await fn();}catch(e){console.error(e);say(e.message||'Não foi possível concluir.');}}
function persist(next){writeLibrary(key,next);items=next;render();}
function command(c){if(!isGM)throw new Error('Somente o GM pode apresentar.');bus.postMessage({type:'command',command:c});}
function setKind(value){kind=value;$('#tab-cut').classList.toggle('selected',kind==='cut');$('#tab-mask').classList.toggle('selected',kind==='mask');$('#tab-cut').setAttribute('aria-pressed',String(kind==='cut'));$('#tab-mask').setAttribute('aria-pressed',String(kind==='mask'));$('#form').hidden=true;$('#hint').textContent=kind==='cut'?'Vídeos com som, entrada e saída suaves.':'Efeitos em loop. O mapa continua livre para jogar.';render();}
function render(){
  const root=$('#library');root.replaceChildren();
  const filtered=items.filter(i=>i.kind===kind);
  if(!filtered.length){const box=document.createElement('div');box.className='empty';const symbol=document.createElement('span');symbol.textContent=kind==='cut'?'▷':'◌';const title=document.createElement('h2');title.textContent=kind==='cut'?'Sua próxima revelação.':'Dê outra atmosfera à cena.';const p=document.createElement('p');p.textContent='Adicione um vídeo para começar.';box.append(symbol,title,p);root.append(box);}
  for(const item of filtered){
    const card=document.createElement('article');card.className='card';
    const icon=document.createElement('span');icon.className='card-icon';icon.textContent=item.kind==='cut'?'▷':'◌';
    const details=document.createElement('div');details.className='card-info';const title=document.createElement('h3');title.textContent=item.name;
    const meta=document.createElement('p');meta.textContent=item.kind==='mask'?`Máscara · loop · ${Math.round(item.opacity*100)}%`:`${Math.floor(item.duration/60)}:${String(Math.floor(item.duration%60)).padStart(2,'0')} · com transição`;
    details.append(title,meta);
    const volumeLabel=document.createElement('label');volumeLabel.textContent=`Volume: ${Math.round(item.volume*100)}%`;
    const volumeSlider=document.createElement('input');volumeSlider.type='range';volumeSlider.min='0';volumeSlider.max='100';volumeSlider.value=String(Math.round(item.volume*100));volumeSlider.setAttribute('aria-label','Volume de '+item.name);
    volumeSlider.oninput=()=>{volumeLabel.firstChild.textContent=`Volume: ${volumeSlider.value}%`;};
    volumeSlider.onchange=()=>safe(async()=>{const volume=Number(volumeSlider.value)/100;persist(items.map(i=>i.id===item.id?{...i,volume}:i));if(state[item.kind]?.asset.id===item.id)command({type:'volume',kind:item.kind,id:item.id,volume});});
    volumeLabel.append(volumeSlider);details.append(volumeLabel);
    if(item.kind==='mask'){
      const label=document.createElement('label');label.textContent=`Opacidade: ${Math.round(item.opacity*100)}%`;
      const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.value=String(Math.round(item.opacity*100));slider.setAttribute('aria-label','Opacidade de '+item.name);
      slider.oninput=()=>{label.firstChild.textContent=`Opacidade: ${slider.value}%`;};
      slider.onchange=()=>safe(async()=>{const opacity=Number(slider.value)/100;persist(items.map(i=>i.id===item.id?{...i,opacity}:i));if(state.mask?.asset.id===item.id)command({type:'opacity',id:item.id,opacity});});
      label.append(slider);details.append(label);
    }
    const actions=document.createElement('div');actions.className='card-actions';
    const play=document.createElement('button');play.className='primary small';play.textContent=state[item.kind]?.asset.id===item.id?'Reiniciar':'▶ Jogar';play.onclick=()=>safe(async()=>{command({type:'play',asset:item});say('Apresentação enviada à sala.');});
    const del=document.createElement('button');del.className='small danger';del.textContent='Deletar';del.onclick=()=>{
      if(del.dataset.confirm!=='yes'){del.dataset.confirm='yes';del.textContent='Confirmar?';setTimeout(()=>{del.dataset.confirm='';del.textContent='Deletar';},4000);return;}
      void safe(async()=>{if(state[item.kind]?.asset.id===item.id)command({type:'stop',kind:item.kind});persist(items.filter(i=>i.id!==item.id));say('Removido da biblioteca. O arquivo original permanece na hospedagem.');});
    };
    actions.append(play,del);card.append(icon,details,actions);root.append(card);
  }
  $('#stop-cut').hidden=!state.cut;$('#stop-mask').hidden=!state.mask;$('#live').hidden=!state.cut&&!state.mask;
  $('#live-text').textContent=[state.cut?.asset.name,state.mask?.asset.name].filter(Boolean).join(' + ');
}
$('#tab-cut').onclick=()=>setKind('cut');$('#tab-mask').onclick=()=>setKind('mask');
$('#add').onclick=()=>{$('#form').reset();$('#opacity-value').value='100%';$('#form').hidden=false;$('#form-title').textContent=kind==='cut'?'Adicionar cutscene':'Adicionar máscara';$('#volume-label').hidden=false;$('#opacity-label').hidden=kind==='cut';$('#format-note').textContent=kind==='mask'?'Use WebM com transparência real (canal alfa). Máscaras ficam em loop e reproduzem o áudio do arquivo, se houver.':'Use MP4 ou WebM com áudio. Cole o link direto para o vídeo.';$('#source').dispatchEvent(new Event('change'));$('#name').focus();};
$('#opacity').oninput=()=>{$('#opacity-value').value=$('#opacity').value+'%';};
$('#enable-audio').onclick=()=>{bus?.postMessage({type:'audio'});say('Solicitado o áudio da máscara neste navegador.');};
$('#cancel').onclick=()=>{$('#form').hidden=true;};
$('#source').onchange=()=>{$('#url-label').hidden=$('#source').value==='file';$('#file-label').hidden=$('#source').value!=='file';};
$('#form').onsubmit=e=>{e.preventDefault();void safe(async()=>{
  if(!isGM)throw new Error('Somente o GM pode adicionar vídeos.');
  $('#save').disabled=true;
  try{
    let url,duration;
    if($('#source').value==='file'){
      const file=$('#file').files[0];if(!file)throw new Error('Escolha um vídeo.');
      if(!$('#server').value)throw new Error('Configure o servidor em “Arquivos do PC e backup” ou use um link direto.');
      const temp=URL.createObjectURL(file);try{duration=await inspectVideo(temp);}finally{URL.revokeObjectURL(temp);}
      say('Enviando o vídeo. Mantenha este painel aberto…');url=await upload(file,$('#server').value,$('#token').value);
    }else{url=mediaURL($('#url').value);say('Conferindo o vídeo…');duration=await inspectVideo(url);}
    const entry=asset({name:$('#name').value,kind,url,duration,fade:Number($('#fade').value),volume:Number($('#volume').value)/100,opacity:Number($('#opacity').value)/100});
    persist([...items,entry]);$('#form').hidden=true;say('Salvo. Use Jogar para apresentar à sala.');
  }finally{$('#save').disabled=false;}
});};
$('#stop-cut').onclick=()=>safe(async()=>command({type:'stop',kind:'cut'}));$('#stop-mask').onclick=()=>safe(async()=>command({type:'stop',kind:'mask'}));
$('#save-server').onclick=()=>safe(async()=>{if($('#server').value)mediaURL($('#server').value);localStorage.setItem(key+'/upload',JSON.stringify({server:$('#server').value,token:$('#token').value}));say('Conexão salva neste navegador.');});
$('#export').onclick=()=>safe(async()=>{const blob=new Blob([JSON.stringify({visions:1,items},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='visions-biblioteca.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);say('Backup exportado sem a chave de envio.');});
$('#import').onclick=()=>$('#backup-file').click();
$('#backup-file').onchange=()=>safe(async()=>{
  const file=$('#backup-file').files[0];if(!file)return;if(file.size>2*1024*1024)throw new Error('Backup muito grande.');
  const parsed=JSON.parse(await file.text());if(parsed.visions!==1||!Array.isArray(parsed.items)||parsed.items.length>1000)throw new Error('Backup inválido.');
  const incoming=parsed.items.map(asset);const ids=new Set(items.map(i=>i.id));persist([...items,...incoming.filter(i=>!ids.has(i.id))]);say('Backup importado. Os itens existentes foram preservados.');
});
if(OBR.isAvailable)OBR.onReady(()=>safe(async()=>{
  isGM=await OBR.player.getRole()==='GM';$('#role').textContent=isGM?'MESTRE':'JOGADOR';$('#gm').hidden=!isGM;$('#player').hidden=isGM;
  key='visions/library/'+OBR.player.id;
  if(isGM){items=readLibrary(key);const config=JSON.parse(localStorage.getItem(key+'/upload')||'{}');$('#server').value=config.server||'';$('#token').value=config.token||'';}
  bus=await bridge();$('#enable-audio').hidden=false;bus.onmessage=({data})=>{if(data?.type==='state'){state=data.state;if(isGM)items=readLibrary(key);render();}if(data?.type==='error')say(data.message);};bus.postMessage({type:'get'});
  OBR.player.onChange(p=>{isGM=p.role==='GM';$('#gm').hidden=!isGM;$('#player').hidden=isGM;$('#role').textContent=isGM?'MESTRE':'JOGADOR';});
  say(isGM?'Pronto para apresentar.':'Aguardando as visões do GM.');render();
}));
else{$('#role').textContent='PRÉVIA';$('#gm').hidden=false;$('#add').disabled=true;say('Prévia do painel. Instale no Owlbear para adicionar e apresentar vídeos.');render();}
