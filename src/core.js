export const ID='io.github.visions';
export const WIRE=ID+'/state', HELLO=ID+'/hello', MODAL=ID+'/screen';
export const emptyState=()=>({rev:0,cut:null,mask:null,mask2:null});
export function mediaURL(raw){
  const u=new URL(String(raw).trim());
  if(u.protocol!=='https:')throw new Error('Use um endereço HTTPS acessível aos jogadores.');
  if(u.username||u.password)throw new Error('O link não pode conter senha.');
  if(u.hostname==='github.com' && u.pathname.includes('/blob/')) {
    u.hostname='raw.githubusercontent.com';u.pathname=u.pathname.replace('/blob/','/');
  }
  if(/(^|\.)(youtube\.com|youtu\.be)$/.test(u.hostname))throw new Error('Use um link direto MP4 ou WebM, não uma página do YouTube.');
  if(u.href.length>2000)throw new Error('Link muito longo.');
  return u.href;
}
export function asset(value){
  if(!value||!['cut','mask'].includes(value.kind))throw new Error('Tipo de vídeo inválido.');
  if(typeof value.name!=='string'||!value.name.trim())throw new Error('Dê um nome ao vídeo.');
  if(!Number.isFinite(value.duration)||value.duration<=0||value.duration>14400)throw new Error('Use um vídeo de até quatro horas, com duração definida.');
  const media=value.media||'video';
  if(!['video','image','color'].includes(media)||media==='color'&&value.kind!=='mask')throw new Error('Formato inválido.');
  const color=value.color||'#000000';if(!/^#[0-9a-f]{6}$/i.test(color))throw new Error('Cor inválida.');
  return {media,color,id:typeof value.id==='string'?value.id.slice(0,100):crypto.randomUUID(),kind:value.kind,name:value.name.trim().slice(0,90),url:media==='color'?'':mediaURL(value.url),duration:value.duration,
    fade:Math.min(2000,Math.max(200,Number(value.fade)||700)),volume:Math.min(1,Math.max(0,Number(value.volume)||0)),opacity:Math.min(1,Math.max(0,Number.isFinite(Number(value.opacity))?Number(value.opacity):1))};
}
export function stateValue(raw){
  if(!raw||!Number.isFinite(raw.rev)||raw.rev<0)throw new Error('Estado inválido');
  const session=(s,kind)=>{
    if(s===null)return null;
    if(!s||typeof s.session!=='string'||s.session.length>100||!Number.isFinite(s.startedAt))throw new Error('Sessão inválida');
    const a=asset(s.asset);if(a.kind!==kind)throw new Error('Tipo incorreto');
    return {session:s.session,startedAt:s.startedAt,asset:a};
  };
  return {rev:raw.rev,cut:session(raw.cut,'cut'),mask:session(raw.mask,'mask'),mask2:session(raw.mask2??null,'mask')};
}
export function senderIsGM(connectionId,players){return players.some(p=>p.connectionId===connectionId&&p.role==='GM');}
export function elapsed(s,now=Date.now()){return Math.max(0,(now-s.startedAt)/1000);}
export function finished(s,now=Date.now()){return !!s&&elapsed(s,now)>=s.asset.duration+s.asset.fade/1000;}
export function commandState(state,command,now=Date.now()){
  const next={...state,rev:Math.max(now,state.rev+1)};
  if(command.type==='play'){
    const a=asset(command.asset);
    let slot=a.kind;
    if(a.kind==='mask'){
      slot=['mask','mask2'].find(k=>state[k]?.asset.id===a.id)||['mask','mask2'].find(k=>!state[k]);
      if(!slot)throw new Error('Duas máscaras já estão ativas. Retire uma antes de adicionar outra.');
    }
    next[slot]={session:crypto.randomUUID(),startedAt:now+1500,asset:a};
  }else if(command.type==='volume'||command.type==='opacity'){
    const slots=command.type==='opacity'||command.kind==='mask'?['mask','mask2']:['cut'];
    const slot=slots.find(k=>state[k]?.asset.id===command.id);if(!slot)return state;
    const prop=command.type==='opacity'?'opacity':'volume';
    next[slot]={...state[slot],asset:asset({...state[slot].asset,[prop]:command[prop]})};
  }else if(command.type==='stop'&&['cut','mask'].includes(command.kind)){
    const slots=command.kind==='mask'?['mask','mask2']:['cut'];
    if(!slots.some(k=>state[k]&&(!command.id||state[k].asset.id===command.id)&&(!command.session||state[k].session===command.session)))return state;
    for(const k of slots){
      if(command.id&&state[k]?.asset.id!==command.id)continue;
      if(command.session&&state[k]?.session!==command.session)continue;
      next[k]=null;
    }
  }else throw new Error('Comando inválido');
  return next;
}

