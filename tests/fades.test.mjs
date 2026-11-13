import {test} from 'node:test';
import assert from 'node:assert/strict';
import {envelope} from '../src/fades.js';
import {asset,commandState,emptyState} from '../src/core.js';
test('áudio e imagem entram de zero e saem gradualmente, inclusive em clipes curtos',()=>{
  assert.equal(envelope(0,10,700),0);
  assert.equal(envelope(350,10,700),.5);
  assert.equal(envelope(1000,10,700),1);
  assert.equal(envelope(1000,.35,700),.5);
  assert.equal(envelope(1000,0,700),0);
  assert.equal(envelope(350,.35,700),.5);
});
test('opacidade zero é preservada e não vira 100%',()=>{
  const item=asset({name:'Fumaça',url:'https://example.org/f.webm',kind:'mask',duration:10,opacity:0});
  assert.equal(item.opacity,0);
  const active=commandState(emptyState(),{type:'play',asset:item});
  const changed=commandState(active,{type:'opacity',id:item.id,opacity:.3});
  assert.equal(changed.mask.session,active.mask.session);
  assert.equal(changed.mask.startedAt,active.mask.startedAt);
  assert.equal(changed.mask.asset.opacity,.3);
});
