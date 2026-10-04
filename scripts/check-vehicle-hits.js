// Run in the loaded game with agent-browser eval --stdin.
// Samples rendered surfaces, so a pointer-events or camera regression fails here.
(async () => {
  // Wait for initial worker loading and ResizeObserver layout to settle.
  for (let attempt = 0; attempt < 100 && document.querySelector('.vehicle[aria-disabled="true"]'); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
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
