import * as THREE from 'three';

// Static courtyard probe, excluding cars, hints and particles. Geometry is shared
// read-only; only materials and render targets belong to this reflection cache.
export function createCourtyardReflections(renderer, source) {
  const probe = new THREE.Scene(), materials = new Set(), cache = new Map();
  const courtyard = source.clone(true);
  courtyard.traverse(mesh => {
    if (!mesh.isMesh) return;
    const original = mesh.material;
    const material = new THREE.MeshLambertMaterial({
      color: original.color, vertexColors: original.vertexColors,
      side: original.side, map: original.map,
      emissive: original.emissive, emissiveIntensity: original.emissiveIntensity,
    });
    material.name = original.name;
    mesh.material = material;
    mesh.castShadow = mesh.receiveShadow = false;
    materials.add(material);
  });
  probe.add(courtyard);
  const floorMaterial = new THREE.MeshLambertMaterial();
  const floorGeometry = new THREE.PlaneGeometry(160,160);
  const floor = new THREE.Mesh(floorGeometry,floorMaterial);
  floor.rotation.x=-Math.PI/2; floor.position.y=-.1; probe.add(floor);
  const skyGeometry = new THREE.SphereGeometry(60,24,12);
  const skyMaterial = new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false,
    uniforms:{sky:{value:new THREE.Color()}, horizon:{value:new THREE.Color()},
      sunColor:{value:new THREE.Color()}, sunDirection:{value:new THREE.Vector3()}, sunStrength:{value:1}},
    vertexShader:'varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction; uniform vec3 sky,horizon,sunColor,sunDirection; uniform float sunStrength;
      void main(){ vec3 d=normalize(direction); float altitude=smoothstep(-.08,.65,d.y);
        vec3 c=mix(horizon,sky,altitude); float alignment=max(0.,dot(d,sunDirection));
        c+=sunColor*sunStrength*(pow(alignment,32.)*.16+pow(alignment,1200.)*3.);
        gl_FragColor=vec4(c,1.); }`,
  });
  probe.add(new THREE.Mesh(skyGeometry,skyMaterial));
  const ambient = new THREE.HemisphereLight(), sun = new THREE.DirectionalLight();
  sun.target.position.set(3,0,3); probe.add(ambient,sun,sun.target);
  const generator = new THREE.PMREMGenerator(renderer);
  let builds=0, key=null;
  return {
    update(theme, sunPosition, intensity) {
      key=JSON.stringify([theme.id,...sunPosition.toArray(),intensity]);
      if(cache.has(key)) return cache.get(key).texture;
      ambient.color.set(theme.sky); ambient.groundColor.set(theme.ground); ambient.intensity=theme.ambient;
      sun.position.copy(sunPosition); sun.color.set(theme.sun); sun.intensity=intensity;
      floorMaterial.color.set(theme.floor);
      skyMaterial.uniforms.sky.value.set(theme.sky).multiplyScalar(theme.id==='neon'?.08:.65);
      skyMaterial.uniforms.horizon.value.set(theme.sky).multiplyScalar(theme.id==='neon'?.12:.9);
      skyMaterial.uniforms.sunColor.value.set(theme.sun);
      skyMaterial.uniforms.sunDirection.value.copy(sunPosition).sub(sun.target.position).normalize();
      skyMaterial.uniforms.sunStrength.value=theme.id==='neon'?.06:intensity*.3;
      for(const material of materials) if(material.name.startsWith('Streetlamp glow')) {
        material.emissive.set('#ffc882'); material.emissiveIntensity=theme.id==='neon'?2.2:theme.id==='sunset'?.6:.1;
      }
      const passageWarmth=theme.id==='neon'?1:theme.id==='sunset'?.45:theme.id==='rain'?.16:0;
      for(const material of materials)if(material.name==='Street glazing') {
        material.emissive.set('#e3b575');material.emissiveIntensity=passageWarmth*.36;
      }
      courtyard.traverse(o=>{if(o.name==='Passage entry light')o.intensity=passageWarmth*.65;});
      const target=generator.fromScene(probe,0,.1,100,{size:128,position:new THREE.Vector3(3,.85,3)});
      cache.set(key,target); builds++;
      if(cache.size>4) { const oldest=cache.keys().next().value; cache.get(oldest).dispose();cache.delete(oldest); }
      return target.texture;
    },
    snapshot:()=>({type:'static-courtyard',resolution:128,builds,cached:cache.size,key}),
    dispose(){cache.forEach(target=>target.dispose());materials.forEach(m=>m.dispose());
      floorMaterial.dispose();floorGeometry.dispose();skyMaterial.dispose();skyGeometry.dispose();generator.dispose();},
  };
}
