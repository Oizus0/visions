import {asset} from './core.js';
export function readLibrary(key){
  const raw=JSON.parse(localStorage.getItem(key)||'[]');
  if(!Array.isArray(raw))throw new Error('Biblioteca inválida. Importe um backup.');
  return raw.map(asset);
}
export function writeLibrary(key,items){localStorage.setItem(key,JSON.stringify(items.map(asset)));}
export function inspectVideo(url){return new Promise((resolve,reject)=>{
  const video=document.createElement('video');video.preload='metadata';video.muted=true;
  const cleanup=()=>{clearTimeout(timer);video.removeAttribute('src');video.load();};
  const timer=setTimeout(()=>{cleanup();reject(new Error('O vídeo não respondeu em 20 segundos. Confira o link direto e a conexão.'));},20000);
  video.onloadedmetadata=()=>{const duration=video.duration;cleanup();Number.isFinite(duration)&&duration>0?resolve(duration):reject(new Error('Vídeo sem duração válida.'));};
  video.onerror=()=>{cleanup();reject(new Error('Vídeo inacessível ou formato incompatível. Use um link direto MP4/WebM.'));};
  video.src=url;
});}
export async function upload(file,server,token){
  const base=new URL(server);
  if(base.protocol!=='https:')throw new Error('O servidor precisa de um endereço HTTPS.');
  if(!token)throw new Error('Configure a chave de envio em “Arquivos do PC e backup”.');
  if(file.size>250*1024*1024)throw new Error('Limite desta versão: 250 MB por arquivo.');
  const response=await fetch(new URL('/api/videos',base),{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':file.type||'application/octet-stream'},body:file});
  const result=await response.json().catch(()=>({error:'O servidor não retornou uma resposta válida.'}));
  if(!response.ok)throw new Error(result.error||'Falha no envio do vídeo.');
  return result.url;
}

export function inspectImage(url){return new Promise((resolve,reject)=>{
 const img=new Image();const timer=setTimeout(()=>{img.src='';reject(new Error('A imagem não respondeu.'));},20000);
 img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(new Error('Imagem inacessível. Use um link direto WebP.'));};img.src=url;
});}
