import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STREET, passageBoxes } from './streetLayout.js';

export function createStreetBlocks(garage) {
  const pieces = new Map(), geometries=[], materials=[], lights=[];
  const palette = {
    'Street masonry':['#bebcaf',.87,0], 'Street roof':['#52605d',.94,0],
    'Street tunnel':['#636c68',.91,0], 'Street fittings':['#37484b',.48,.32],
    'Street glazing':['#49626a',.13,.28], 'Streetlamp glow passage':['#ffe1ac',.35,0],
    'Street planting':['#697765',.91,0],
  };
  function box(name,x,y,z,w,h,d,r=.015) {
    const geometry = r ? new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/4,h/4,d/4)) : new THREE.BoxGeometry(w,h,d).toNonIndexed();
    geometry.translate(x,y,z);
    for(const key of Object.keys(geometry.attributes)) if(!['position','normal'].includes(key))geometry.deleteAttribute(key);
    if(!pieces.has(name))pieces.set(name,[]);
    pieces.get(name).push(geometry);
  }
  // Structural shell exactly matches the visibility volumes. Thin bevelled
  // finishes sit outside it, so an opening never reveals an empty facade.
  for(const bounds of passageBoxes()) {
    const c=bounds.getCenter(new THREE.Vector3()),s=bounds.getSize(new THREE.Vector3());
    box('Street tunnel',c.x,c.y,c.z,s.x,s.y,s.z,0);
  }
  for(const [front,back,sign] of [[STREET.north,STREET.min,-1],[STREET.south,STREET.max,1]]) {
    const middle=(front+back)/2,depth=Math.abs(back-front);
    // Continuous plinth, masonry sides, overhanging coping and recessed roof.
    box('Street fittings',8.295,-.24,middle,4.75,.48,depth+.12,.025);
    for(const x of [6.12,10.47]) {
      box('Street masonry',x,.84,middle,.28,1.68,depth,.025);
      box('Street masonry',x,1.87,middle,.36,.18,depth+.08,.02);
      // Shallow horizontal masonry courses, never high-contrast brick wallpaper.
      for(let y=.32;y<1.5;y+=.32) box('Street fittings',x+(x<8?-.147:.147),y,middle,.006,.008,depth-.04,0);
    }
    box('Street roof',8.295,1.825,middle,3.96,.025,depth-.28,.008);
    for(let z=Math.min(front,back)+.7;z<Math.max(front,back)-.35;z+=.82)box('Street fittings',8.295,1.841,z,3.83,.005,.007,0);
    for(const z of [front,back]) {
      box('Street masonry',8.295,1.88,z,4.67,.24,.22,.025);
      box('Street fittings',8.295,1.725,z-sign*.035,3.91,.025,.05,.006);
    }
    box('Street masonry',8.295,.81,back+sign*.025,4.43,1.62,.08,.018);
    // A clerestory band and divided frame make this a small building rather
    // than a freestanding motorway portal. Its lighting follows scene themes.
    box('Street glazing',8.295,1.895,front-sign*.116,3.45,.10,.018,.004);
    for(let x=6.72;x<10;x+=.52) box('Street fittings',x,1.895,front-sign*.129,.018,.12,.018,.003);
    // Recessed entry lights, a drain and rainwater downpipes belong to the shell.
    for(const x of [6.45,10.14]) {
      box('Street fittings',x,1.28,front+sign*.18,.08,.21,.08,.012);
      box('Streetlamp glow passage',x,1.28,front+sign*.13,.052,.14,.018,.006);
    }
    for(let x=6.65;x<10.2;x+=.13) box('Street fittings',x,.044,front-sign*.16,.065,.014,.13,.003);
    for(const x of [6.07,10.52]) box('Street fittings',x,.78,front+sign*.58,.045,1.5,.045,.008);
    // Restrained rooftop detail; no oversized signs, faux trees, or roof holes.
    box('Street fittings',6.77,1.92,middle+sign*.7,.56,.17,.78,.025);
    for(let i=0;i<5;i++) box('Street roof',6.77,2.01,middle+sign*.7+(i-2)*.12,.48,.02,.045,.004);
    box('Street masonry',10.16,1.95,middle-sign*.7,.34,.23,1.5,.02);
    box('Street roof',10.16,2.07,middle-sign*.7,.26,.025,1.4,.006);
    // Low shrubs keep the roof edge soft; reuse the courtyard's muted palette.
    for(let i=0;i<7;i++) {
      const foliage=new THREE.IcosahedronGeometry(1,1);
      foliage.scale(.14,.07+(i%3)*.01,.15);foliage.translate(10.16+Math.sin(i*3.7)*.025,2.12,middle-sign*.7+(i-3)*.18);
      foliage.deleteAttribute('uv');if(!pieces.has('Street planting'))pieces.set('Street planting',[]);pieces.get('Street planting').push(foliage);
    }
    const light=new THREE.PointLight('#ffcf8d',0,2.8,2);
    light.name='Passage entry light';
    light.position.set(8.295,1.42,front+sign*.25);garage.add(light);lights.push(light);
  }
  for(const [name,list]of pieces) {
    const geometry=mergeGeometries(list);list.forEach(g=>g.dispose());
    const [color,roughness,metalness]=palette[name];
    const material=new THREE.MeshStandardMaterial({name,color,roughness,metalness});
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.userData.generatedGeometry=true;
    mesh.raycast=()=>{};garage.add(mesh);geometries.push(geometry);materials.push(material);
  }
  return {geometries,
    setTheme(settings,quality) {
      const night=settings.theme==='neon',warm=night?1:settings.theme==='sunset'?.45:settings.theme==='rain'?.16:0;
      for(const m of materials)if(m.name==='Street glazing'){m.emissive.set('#e3b575');m.emissiveIntensity=warm*.36;}
      for(const light of lights){light.visible=quality.decor&&warm>0;light.intensity=warm*.65;}
    },
  };
}
