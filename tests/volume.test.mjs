import {test} from 'node:test';
import assert from 'node:assert/strict';
import {commandState,emptyState,asset} from '../src/core.js';
for(const kind of ['cut','mask'])test(`volume de ${kind} muda sem reiniciar e aceita silêncio`,()=>{
  const item=asset({id:'sample',kind,name:'Sample',url:'https://example.org/a.webm',duration:20,volume:.8,opacity:.4});
  const before=commandState(emptyState(),{type:'play',asset:item},1000);
  for(const volume of [0,.25,1]){
    const after=commandState(before,{type:'volume',kind,id:item.id,volume},2000);
    assert.equal(after[kind].asset.volume,volume);
    assert.equal(after[kind].session,before[kind].session);
    assert.equal(after[kind].startedAt,before[kind].startedAt);
    assert.equal(after[kind].asset.opacity,.4);
  }
  assert.equal(commandState(before,{type:'volume',kind,id:'other',volume:.1}),before);
});