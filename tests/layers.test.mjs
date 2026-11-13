import {test} from 'node:test';
import assert from 'node:assert/strict';
import {asset,emptyState,commandState,stateValue} from '../src/core.js';
import {videoExtension} from '../server/server.mjs';
test('duas máscaras independentes, limite, edição ao vivo e estado antigo',()=>{
 const a=asset({id:'a',kind:'mask',name:'Cor',media:'color',color:'#663399',duration:10,opacity:.4});
 const b=asset({id:'b',kind:'mask',name:'WebP',media:'image',url:'https://example.com/a.webp',duration:10});
 let s=commandState(emptyState(),{type:'play',asset:a},100);
 s=commandState(s,{type:'play',asset:b},200);
 assert.equal(s.mask.asset.id,'a');assert.equal(s.mask2.asset.id,'b');
 assert.throws(()=>commandState(s,{type:'play',asset:{...b,id:'third'}}),/Duas/);
 const first=s.mask,session=s.mask2.session;
 s=commandState(s,{type:'opacity',id:'b',opacity:.2});
 assert.equal(s.mask,first);assert.equal(s.mask2.session,session);assert.equal(s.mask2.asset.opacity,.2);
 s=stateValue(s);s=commandState(s,{type:'stop',kind:'mask',id:'a'});
 assert.equal(s.mask,null);assert.equal(s.mask2.asset.id,'b');
 s=commandState(s,{type:'stop',kind:'mask'});assert.equal(s.mask2,null);
 const old={rev:1,cut:null,mask:null};assert.equal(stateValue(old).mask2,null);
 assert.throws(()=>asset({...a,color:'invalid'}));
});
test('servidor reconhece WebP e rejeita assinatura incorreta',()=>{
 assert.equal(videoExtension(Buffer.from('RIFFxxxxWEBP')),'webp');
 assert.equal(videoExtension(Buffer.from('RIFFxxxxWAVE')),null);
});
