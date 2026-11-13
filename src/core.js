export const ID='io.github.visions';
export const WIRE=ID+'/state', HELLO=ID+'/hello', MODAL=ID+'/screen';
export const emptyState=()=>({rev:0,cut:null,mask:null});
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
  return {id:typeof value.id==='string'?value.id.slice(0,100):crypto.randomUUID(),kind:value.kind,name:value.name.trim().slice(0,90),url:mediaURL(value.url),duration:value.duration,
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
  return {rev:raw.rev,cut:session(raw.cut,'cut'),mask:session(raw.mask,'mask')};
}
export function senderIsGM(connectionId,players){return players.some(p=>p.connectionId===connectionId&&p.role==='GM');}
export function elapsed(s,now=Date.now()){return Math.max(0,(now-s.startedAt)/1000);}
export function finished(s,now=Date.now()){return !!s&&elapsed(s,now)>=s.asset.duration+s.asset.fade/1000;}
export function commandState(state,command,now=Date.now()){
  const next={...state,rev:Math.max(now,state.rev+1)};
  if(command.type==='play'){
    const a=asset(command.asset);
    next[a.kind]={session:crypto.randomUUID(),startedAt:now+1500,asset:a};
  }else if(command.type==='opacity'){
    if(!state.mask||state.mask.asset.id!==command.id)return state;
    const updated=asset({...state.mask.asset,opacity:command.opacity});
    next.mask={...state.mask,asset:updated};
  }else if(command.type==='stop'&&['cut','mask'].includes(command.kind)){
    if(command.session&&state[command.kind]?.session!==command.session)return state;
    next[command.kind]=null;
  }else throw new Error('Comando inválido');
  return next;
}
