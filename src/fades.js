export function envelope(enteredMs,remainingSeconds,fadeMs){
  return Math.max(0,Math.min(1,enteredMs/fadeMs,remainingSeconds*1000/fadeMs));
}
export function fadeAway(video,element,ms,valid=()=>true){
  const volume=video.volume,opacity=Number(getComputedStyle(element).opacity),start=performance.now();
  element.style.transition='none';
  return new Promise(resolve=>{
    function tick(now){
      if(!valid()){resolve();return;}
      const factor=Math.max(0,1-(now-start)/ms);
      video.volume=volume*factor;element.style.opacity=String(opacity*factor);
      if(factor>0)requestAnimationFrame(tick);else resolve();
    }
    requestAnimationFrame(tick);
  });
}
