import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createUploadServer,byteRange} from '../server/server.mjs';
test('upload autenticado, leitura parcial, limites e arquivos inválidos',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'visions-test-'));
  const token='t'.repeat(40);
  const server=createUploadServer({directory,token,publicURL:'https://media.example',allowedOrigin:'https://oizus0.github.io',maxBytes:1024});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  try{
    const body=Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(100)]);
    const headers={Authorization:'Bearer '+token,Origin:'https://oizus0.github.io'};
    assert.equal((await fetch(base+'/api/videos',{method:'POST',body})).status,403);
    assert.equal((await fetch(base+'/api/videos',{method:'POST',headers:{...headers,Origin:'https://other.example'},body})).status,403);
    assert.equal((await fetch(base+'/api/videos',{method:'POST',headers,body:Buffer.alloc(1100)})).status,413);
    assert.equal((await fetch(base+'/api/videos',{method:'POST',headers,body:Buffer.alloc(50)})).status,415);
    const response=await fetch(base+'/api/videos',{method:'POST',headers,body});assert.equal(response.status,201);
    const result=await response.json();const path=new URL(result.url).pathname;
    const partial=await fetch(base+path,{headers:{Range:'bytes=0-3'}});assert.equal(partial.status,206);assert.equal(partial.headers.get('content-range'),'bytes 0-3/104');assert.equal((await partial.arrayBuffer()).byteLength,4);
    assert.equal((await fetch(base+path,{method:'HEAD'})).headers.get('content-type'),'video/webm');
    assert.equal((await fetch(base+path,{headers:{Range:'bytes=9999-'}})).status,416);
    assert.equal((await readdir(directory)).length,1);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
});
test('intervalos de vídeo inclusive sufixos',()=>{
  assert.deepEqual(byteRange('bytes=-3',10),{start:7,end:9,partial:true});assert.equal(byteRange('bytes=0-1,5-7',10),null);assert.equal(byteRange('bytes=-0',10),null);
});
