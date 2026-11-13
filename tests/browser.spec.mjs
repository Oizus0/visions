import {test,expect} from '@playwright/test';
test('GM e jogador: biblioteca, máscara sem bloqueio, cutscene e interrupção',async({context})=>{
  test.setTimeout(90000);
  const gm=await context.newPage(),player=await context.newPage();
  await gm.goto('http://127.0.0.1:5193/?connection=gm&role=GM');
  await player.goto('http://127.0.0.1:5193/?connection=player&role=PLAYER');
  await expect(gm.locator('body')).toHaveAttribute('data-background','ready');
  await expect(player.locator('body')).toHaveAttribute('data-background','ready');
  await expect(player.locator('#gm')).toBeHidden();
  // A player cannot use the local command channel to start a presentation.
  await player.evaluate(()=>{const b=new BroadcastChannel('io.github.visions/player');b.postMessage({type:'command',command:{type:'play',asset:{name:'Não autorizado',kind:'cut',url:'https://video.example/test.webm',duration:10}}});b.close();});
  await expect(player.locator('#status')).toContainText('Somente o GM');
  // A real short WebM generated in Chromium exercises video metadata and playback.
  const encoded=await gm.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#704bb0';ctx.fillRect(0,0,160,90);
    const stream=canvas.captureStream(10),rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'}),chunks=[];
    rec.ondataavailable=e=>chunks.push(e.data);
    const result=new Promise(resolve=>{rec.onstop=async()=>{const blob=new Blob(chunks,{type:'video/webm'});const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob);stream.getTracks().forEach(t=>t.stop());};});
    rec.start();const id=setInterval(()=>{ctx.fillRect(0,0,160,90);},100);setTimeout(()=>{clearInterval(id);rec.stop();},3500);return result;
  });
  const video=Buffer.from(encoded,'base64');
  await context.route('https://video.example/**',route=>route.fulfill({status:200,contentType:'video/webm',body:video}));
  // Recordings can lack duration until seek; use known finite length for stored fixtures.
  const base={url:'https://video.example/test.webm',duration:3.5,fade:350,volume:.8,opacity:.6};
  await gm.evaluate(base=>localStorage.setItem('visions/library/gm',JSON.stringify([{...base,id:'cut1',kind:'cut',name:'Revelação'},{...base,id:'mask1',kind:'mask',name:'Névoa'}])),base);
  await gm.reload();await expect(gm.locator('body')).toHaveAttribute('data-background','ready');
  await gm.locator('#tab-mask').click();await gm.getByRole('button',{name:'▶ Jogar'}).click();
  await expect(player.locator('#vision-modal')).toHaveCSS('pointer-events','none');
  await expect(player.frameLocator('#vision-modal').locator('#masks video')).toHaveCount(1);
  await expect.poll(()=>gm.frameLocator('#vision-modal').locator('#masks video').evaluate(v=>v.volume)).toBeGreaterThan(.7);
  await expect(gm.frameLocator('#vision-modal').locator('#masks video')).toHaveCSS('opacity','0.6');
  await gm.getByRole('slider',{name:'Opacidade de Névoa'}).fill('25');
  await gm.getByRole('slider',{name:'Opacidade de Névoa'}).dispatchEvent('change');
  await expect(player.frameLocator('#vision-modal').locator('#masks video')).toHaveCSS('opacity','0.25');
  await gm.getByRole('slider',{name:'Volume de Névoa'}).fill('0');
  await gm.getByRole('slider',{name:'Volume de Névoa'}).dispatchEvent('change');
  await expect.poll(()=>player.frameLocator('#vision-modal').locator('#masks video').evaluate(v=>v.volume)).toBe(0);
  await gm.getByRole('slider',{name:'Volume de Névoa'}).fill('80');
  await gm.getByRole('slider',{name:'Volume de Névoa'}).dispatchEvent('change');
  await expect.poll(()=>player.frameLocator('#vision-modal').locator('#masks video').evaluate(v=>v.muted)).toBe(false);
  const late=await context.newPage();await late.goto('http://127.0.0.1:5193/?connection=late&role=PLAYER');
  await expect(late.locator('#vision-modal')).toHaveCSS('pointer-events','none');
  await player.evaluate(()=>{const button=document.createElement('button');button.id='map-click';button.textContent='Mapa';button.onclick=()=>button.textContent='Movido';document.body.append(button);});
  await player.locator('#map-click').click();await expect(player.locator('#map-click')).toHaveText('Movido');
  await gm.locator('#stop-mask').click();await expect(player.locator('#vision-modal')).toHaveCount(0);
  await gm.locator('#tab-cut').click();await gm.getByRole('button',{name:'▶ Jogar'}).click();
  await expect(player.locator('#vision-modal')).toHaveCSS('pointer-events','auto');
  await expect(player.frameLocator('#vision-modal').locator('#stop')).toBeHidden();
  await expect(gm.frameLocator('#vision-modal').locator('#stop')).toBeVisible();
  await expect.poll(()=>gm.frameLocator('#vision-modal').locator('#film').evaluate(v=>!v.paused)).toBeTruthy();
  await expect.poll(()=>gm.frameLocator('#vision-modal').locator('#film').evaluate(v=>v.volume)).toBeGreaterThan(.3);
  await gm.frameLocator('#vision-modal').locator('#stop').click();await expect(player.locator('#vision-modal')).toHaveCount(0);
  await gm.getByRole('button',{name:'▶ Jogar'}).click();
  await expect(player.locator('#vision-modal')).toHaveCount(1);
  await expect(player.locator('#vision-modal')).toHaveCount(0,{timeout:16000});
  await gm.getByRole('button',{name:'Deletar',exact:true}).click();await gm.getByRole('button',{name:'Confirmar?'}).click();
  await expect(gm.locator('.card')).toHaveCount(0);await gm.reload();await expect(gm.locator('.card')).toHaveCount(0);
  await gm.setViewportSize({width:440,height:660});await gm.locator('#tab-mask').click();
  await gm.screenshot({path:'test-results/painel.png',fullPage:true});
  await gm.locator('#add').click();await gm.screenshot({path:'test-results/formulario.png',fullPage:true});
  expect(await gm.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(440);
});

