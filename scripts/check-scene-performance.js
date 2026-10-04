// Run with agent-browser eval --stdin on a loaded, idle 3D level.
// Checks actual rendered frames, not the display's requestAnimationFrame rate.
(async () => {
  const canvas=document.querySelector('.garage-canvas');
  for(let n=0;n<200&&!canvas?.dataset.ready;n++)await new Promise(resolve=>setTimeout(resolve,25));
  const inspection=canvas?.garageInspection;
  if(!inspection?.snapshot().ready)throw Error('Load a 3D level first.');
  if(canvas.dataset.dragging)throw Error('Release the car before measuring idle rendering.');
  await new Promise(resolve=>setTimeout(resolve,600));
  const start=inspection.snapshot().performance,t=performance.now();
  await new Promise(resolve=>setTimeout(resolve,2000));
  const end=inspection.snapshot().performance,seconds=(performance.now()-t)/1000;
  const fps=(end.frames-start.frames)/seconds;
  if(fps>33)throw Error(`Idle rendering exceeds 30 FPS budget: ${fps}`);
  if(end.shadowUpdates!==start.shadowUpdates)throw Error('Stationary scene refreshed its shadow map.');
  const transform=canvas.style.transform;
  let offscreenFrames;
  try {
    canvas.style.transform='translateY(10000px)';
    await new Promise(resolve=>setTimeout(resolve,200));
    const before=inspection.snapshot().performance;
    if(before.inView)throw Error('Offscreen observation did not settle.');
    await new Promise(resolve=>setTimeout(resolve,1000));
    offscreenFrames=inspection.snapshot().performance.frames-before.frames;
    if(offscreenFrames!==0)throw Error('Offscreen canvas continued rendering.');
  } finally {canvas.style.transform=transform;}
  await new Promise(resolve=>setTimeout(resolve,200));
  if(!inspection.snapshot().performance.inView)throw Error('Visible canvas did not resume.');
  return {idleFPS:Number(fps.toFixed(1)),idleShadowUpdates:0,offscreenFrames,pixelRatio:end.pixelRatio,shadowSize:end.shadowSize};
})()
