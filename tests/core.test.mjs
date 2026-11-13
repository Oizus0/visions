import {test} from 'node:test';
import assert from 'node:assert/strict';
import {asset,mediaURL,stateValue,senderIsGM,emptyState,commandState,finished} from '../src/core.js';
const video=()=>asset({name:'Revelação',kind:'cut',url:'https://example.org/film.mp4',duration:10,volume:.8});
test('links locais, scripts e páginas do YouTube são rejeitados',()=>{
  for(const link of ['file:///C:/video.mp4','javascript:alert(1)','http://example.org/video','https://youtu.be/test'])assert.throws(()=>mediaURL(link));
  assert.equal(mediaURL('https://github.com/user/repo/blob/main/film.mp4'),'https://raw.githubusercontent.com/user/repo/main/film.mp4');
});
test('somente o remetente GM real é autorizado, não um ID autodeclarado',()=>{
  const players=[{connectionId:'gm',role:'GM'},{connectionId:'player',role:'PLAYER'}];
  assert.ok(senderIsGM('gm',players));assert.ok(!senderIsGM('player',players));assert.ok(!senderIsGM('unknown',players));
});
test('troca de vídeo não pode ser encerrada pelo evento atrasado do anterior',()=>{
  let s=commandState(emptyState(),{type:'play',asset:video()},1000);const old=s.cut.session;
  s=commandState(s,{type:'play',asset:video()},2000);
  assert.equal(commandState(s,{type:'stop',kind:'cut',session:old}),s);
  assert.equal(commandState(s,{type:'stop',kind:'cut',session:s.cut.session}).cut,null);
});
test('máscara e cutscene têm ciclos independentes e sessão expirada é detectada',()=>{
  let s=commandState(emptyState(),{type:'play',asset:video()},1000);
  s=commandState(s,{type:'play',asset:{...video(),kind:'mask'}},1100);
  assert.ok(s.cut&&s.mask);assert.ok(!finished(s.cut,3000));assert.ok(finished(s.cut,14000));
  s=commandState(s,{type:'stop',kind:'cut'},15000);assert.ok(!s.cut&&s.mask);
  assert.deepEqual(stateValue(s),s);assert.throws(()=>stateValue({...s,mask:{...s.mask,asset:{...s.mask.asset,url:'blob:test'}}}));
});
