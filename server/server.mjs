import http from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir,open,stat,readdir,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {pipeline} from 'node:stream/promises';

export function videoExtension(bytes){
  if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'webp';
  if(bytes.length>=12&&bytes.toString('ascii',4,8)==='ftyp')return 'mp4';
  if(bytes.length>=4&&bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])))return 'webm';
  return null;
}
export function byteRange(header,size){
  if(!header)return {start:0,end:size-1,partial:false};
  const m=/^bytes=(\d*)-(\d*)$/.exec(header);if(!m||(!m[1]&&!m[2]))return null;
  const start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2]));
  const end=m[1]?(m[2]?Math.min(size-1,Number(m[2])):size-1):size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return null;
  return {start,end,partial:true};
}
export function createUploadServer({directory,token,publicURL,allowedOrigin,maxBytes=250*1024*1024,maxStorage=2*1024*1024*1024}){
  if(!token||token.length<32)throw new Error('Configure UPLOAD_TOKEN com ao menos 32 caracteres aleatórios.');
  const base=new URL(publicURL);if(base.protocol!=='https:'&&base.hostname!=='127.0.0.1')throw new Error('PUBLIC_URL deve usar HTTPS.');
  const expectedOrigin=new URL(allowedOrigin).origin;
  const tokenBytes=Buffer.from('Bearer '+token);
  let reserved=0,active=0;
  const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));};
  const auth=req=>{const actual=Buffer.from(req.headers.authorization||'');return actual.length===tokenBytes.length&&timingSafeEqual(actual,tokenBytes);};
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    const origin=req.headers.origin;
    if(origin===expectedOrigin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    const path=new URL(req.url,'http://localhost').pathname;
    if(req.method==='OPTIONS'){
      if(origin!==expectedOrigin){json(res,403,{error:'Origem não autorizada.'});return;}
      res.writeHead(204,{'Access-Control-Allow-Methods':'GET, HEAD, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'});res.end();return;
    }
    try{
      await mkdir(directory,{recursive:true});
      if(path==='/health'&&req.method==='GET'){json(res,200,{ok:true});return;}
      if(path==='/api/videos'&&req.method==='POST'){
        if((origin&&origin!==expectedOrigin)||!auth(req)){json(res,403,{error:'Chave ou origem não autorizada.'});return;}
        const length=Number(req.headers['content-length']);
        if(!Number.isSafeInteger(length)||length<=0){json(res,411,{error:'Tamanho do arquivo obrigatório.'});return;}
        if(length>maxBytes){json(res,413,{error:'Arquivo maior que o limite permitido.'});return;}
        if(active>=3){json(res,429,{error:'Há muitos uploads em andamento. Tente novamente.'});return;}
        active++;reserved+=length;
        let filepath,handle;
        try{
          const files=await readdir(directory);
          const sizes=await Promise.all(files.map(f=>stat(join(directory,f)).then(s=>s.size).catch(()=>0)));
          if(sizes.reduce((a,b)=>a+b,0)+reserved>maxStorage){json(res,507,{error:'Armazenamento cheio. Remova arquivos no servidor ou aumente o limite.'});return;}
          let total=0,first=Buffer.alloc(0),extension,id;
          for await(const chunk of req){
            total+=chunk.length;if(total>length||total>maxBytes)throw new Error('Tamanho excedido');
            if(!handle){
              first=Buffer.concat([first,chunk]);if(first.length<12)continue;
              extension=videoExtension(first);if(!extension){json(res,415,{error:'Use um arquivo MP4, WebM ou WebP válido.'});return;}
              id=randomUUID()+'.'+extension;filepath=join(directory,id);handle=await open(filepath,'wx');
              await handle.writeFile(first);first=Buffer.alloc(0);
            }else await handle.writeFile(chunk);
          }
          if(!handle||total!==length)throw new Error('Arquivo incompleto');
          await handle.close();handle=null;
          const url=new URL('/media/'+id,base).href;
          filepath=null;json(res,201,{url});
        }finally{
          await handle?.close().catch(()=>{});
          if(filepath)await unlink(filepath).catch(()=>{});
          active--;reserved-=length;
        }
        return;
      }
      const match=/^\/media\/([a-f0-9-]{36}\.(mp4|webm|webp))$/.exec(path);
      if(match&&['GET','HEAD'].includes(req.method)){
        const filepath=join(directory,match[1]);const info=await stat(filepath);
        const range=byteRange(req.headers.range,info.size);
        res.setHeader('Access-Control-Allow-Origin','*');
        if(!range){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
        const {start,end,partial}=range;
        res.setHeader('Content-Type',match[2]==='webp'?'image/webp':match[2]==='mp4'?'video/mp4':'video/webm');
        res.setHeader('Content-Length',end-start+1);res.setHeader('Accept-Ranges','bytes');
        res.setHeader('Cache-Control','public, max-age=31536000, immutable');
        if(partial)res.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`);
        res.writeHead(partial?206:200);
        if(req.method==='HEAD'){res.end();return;}
        await pipeline(createReadStream(filepath,{start,end}),res);return;
      }
      json(res,404,{error:'Endereço não encontrado.'});
    }catch(error){
      if(res.headersSent){res.destroy();return;}
      json(res,error.code==='ENOENT'?404:400,{error:error.code==='ENOENT'?'Vídeo não encontrado.':'Falha ao receber ou ler o vídeo.'});
    }
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const server=createUploadServer({directory:resolve(process.env.UPLOAD_DIR||'uploads'),token:process.env.UPLOAD_TOKEN,publicURL:process.env.PUBLIC_URL,allowedOrigin:process.env.ALLOWED_ORIGIN,maxStorage:Number(process.env.MAX_STORAGE_MB||2048)*1024*1024});
  server.requestTimeout=10*60*1000;
  server.listen(Number(process.env.PORT||8787),'0.0.0.0',()=>console.log('Servidor de uploads Visions iniciado.'));
}
