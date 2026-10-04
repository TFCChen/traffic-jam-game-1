// Run in the loaded game with agent-browser eval --stdin.
// Samples rendered surfaces, so a pointer-events or camera regression fails here.
(async () => {
  const canvas=document.querySelector('.garage-canvas');
  if(canvas){
    for(let attempt=0;attempt<200&&!canvas.dataset.ready;attempt++)await new Promise(resolve=>setTimeout(resolve,25));
    const inspection=canvas.garageInspection;
    if(!inspection?.snapshot().ready)throw new Error('3D models did not become ready.');
    await new Promise(resolve=>setTimeout(resolve,250));
    const results=[];
    for(const car of inspection.snapshot().cars){
      const [x,,z]=car.position;
      const offsets=[[0,0],[car.dir==='H'?.35:0,car.dir==='V'?.35:0],[car.dir==='H'?-.35:0,car.dir==='V'?-.35:0]];
      for(const [dx,dz]of offsets){
        const point=inspection.project(x+dx,.55,z+dz),hit=inspection.pick(point.x,point.y);
        results.push({id:car.id,hit,pass:hit===car.id});
      }
    }
    const failures=results.filter(result=>!result.pass);
    if(failures.length)throw new Error(JSON.stringify(failures));
    return {renderer:'3D',cars:inspection.snapshot().cars.length,samples:results.length,passed:results.length,settings:inspection.snapshot().settings};
  }
  // Wait for initial worker loading and ResizeObserver layout to settle.
  for (let attempt = 0; attempt < 100 && document.querySelector('.vehicle[aria-disabled="true"]'); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  // Loading a level can animate the target from its placeholder position.
  const settling = [...document.querySelectorAll('.vehicle')].flatMap(car => car.getAnimations())
    .filter(animation => ['left', 'top'].includes(animation.transitionProperty));
  await Promise.all(settling.map(animation => animation.finished.catch(() => {})));
  const cars = [...document.querySelectorAll('.vehicle')];
  if (!cars.length) throw new Error('Load a playable level before checking hits.');
  const results = [];
  for (const car of cars) {
    const points = [
      ['body-front', '.vehicle-skin', '15%', '3px'],
      ['body-middle', '.vehicle-skin', '50%', '3px'],
      ['body-rear', '.vehicle-skin', '85%', '3px'],
      ['roof', '.car-roof', '50%', '50%'],
      ['side', car.classList.contains('H') ? '.body-wall.near' : '.body-wall.nose', '50%', '50%'],
    ];
    for (const [surface, selector, x, y] of points) {
      const probe = document.createElement('i');
      probe.style.cssText = `position:absolute;left:${x};top:${y};width:0;height:0;pointer-events:none`;
      car.querySelector(selector).append(probe);
      try {
        const rect = probe.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x, rect.y);
        results.push({ car: car.getAttribute('aria-label'), surface, pass: hit?.closest('.vehicle') === car });
      } finally {
        probe.remove();
      }
    }
  }
  const [origin, x, y] = [...document.querySelectorAll('.plane-probe')].map(probe => probe.getBoundingClientRect());
  if (Math.abs(x.y - origin.y) > .1 || Math.abs(y.x - origin.x) > .1) throw new Error('The board axes are skewed.');
  const failures = results.filter(result => !result.pass);
  if (failures.length) throw new Error(JSON.stringify(failures));
  return { cars: cars.length, surfaces: results.length, passed: results.length, levelAxes: true };
})();
