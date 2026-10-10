import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STREET, passageBoxes } from './streetLayout.js';

export function createStreetBlocks(garage) {
  const pieces = new Map(), geometries=[], materials=[], lights=[];
  const palette = {
    'Street masonry':['#c4c1b2',.87,0], 'Street roof':['#969d89',.94,0],
    'Street tunnel':['#a5a699',.91,0], 'Street fittings':['#37484b',.48,.32],
    'Street timber':['#967e60',.83,0], 'Street terrace':['#c8c5b6',.88,0],
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
  function shrub(x,y,z,w=.22,d=.22,seed=0) {
    const foliage=new THREE.IcosahedronGeometry(1,1);
    const variation=.86+.22*Math.sin(seed*2.37+1);
    foliage.scale(w*variation,.075+(seed%5)*.015,d*(1.08-.15*Math.sin(seed*1.7)));
    foliage.rotateY(seed*.73);foliage.translate(x+Math.sin(seed*4.13)*w*.22,y,z+Math.cos(seed*2.19)*d*.27);
    const tint=new THREE.Color().setRGB(.86+(seed%3)*.055,.90+(seed%4)*.025,.82+(seed%5)*.03);
    const colors=new Float32Array(foliage.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=tint.r;colors[i+1]=tint.g;colors[i+2]=tint.b;}
    foliage.setAttribute('color',new THREE.BufferAttribute(colors,3));
    foliage.deleteAttribute('uv');if(!pieces.has('Street planting'))pieces.set('Street planting',[]);pieces.get('Street planting').push(foliage);
  }
  for(const [front,back,sign] of [[STREET.north,STREET.min,-1],[STREET.south,STREET.max,1]]) {
    const middle=(front+back)/2,depth=Math.abs(back-front);
    const garden=sign<0;
    // Match the courtyard's thin stone edge, not a separate dark podium.
    box('Street masonry',8.295,-.24,middle,4.5,.48,depth,.025);
    for(const x of [6.12,10.47]) {
      box('Street masonry',x,.74,middle,.20,1.48,depth,.018);
      box('Street masonry',x,1.59,middle,.24,.06,depth,.012);
      if(garden) {
        // A low planted edge visually joins the existing courtyard planters.
        for(let i=0;i<17;i++)shrub(x,1.68,front+sign*(.23+i*.36),.17,.22,i);
        for(let y=.36;y<1.4;y+=.36)box('Street roof',x+(x<8?-.105:.105),y,middle,.006,.006,depth-.04,0);
      } else {
        for(let i=0;i<24;i++)box('Street timber',x+(x<8?-.105:.105),.88,front+sign*(.16+i*.26),.025,1.12,.09,.004);
      }
    }
    // The structural roof stays opaque under both finishes. Different layouts
    // avoid two cloned buildings without sacrificing any viewing direction.
    box(garden?'Street roof':'Street terrace',8.295,1.599,middle,4.08,.035,depth-.12,.008);
    if(garden) {
      // Two offset planting beds leave a quiet stone maintenance path.
      for(const [x,z,w,d]of [[7.05,middle+sign*.65,1.35,4.85],[9.27,middle-sign*.85,1.48,3.85]]) {
        box('Street roof',x,1.635,z,w,.055,d,.015);
        for(let i=0;i<Math.floor(w/.29);i++)for(let j=0;j<Math.floor(d/.31);j++)shrub(x-w/2+.16+i*.30,1.70,z-d/2+.16+j*.32,.23,.24,i*17+j);
      }
      for(let i=0;i<10;i++)box('Street terrace',8.15,1.627,front+sign*(.4+i*.58),.62,.025,.46,.008);
    } else {
      // A small timber terrace echoes the cafe and pergola beside the puzzle.
      for(let i=0;i<16;i++)box('Street timber',8.60,1.63,front+sign*(1.75+i*.25),2.90,.035,.235,.006);
      for(const [x,z,d]of [[6.78,front+sign*2.6,2.1],[9.75,back-sign*.7,.85]]) {
        box('Street masonry',x,1.70,z,.48,.16,d,.025);
        for(let i=0;i<Math.floor(d/.25);i++)shrub(x,1.82,z-d/2+.13+i*.25,.22,.19,i);
      }
      box('Street timber',8.25,1.75,back-sign*.6,1.28,.23,.32,.018);
    }
    for(const z of [front,back]) {
      box('Street masonry',8.295,1.56,z,4.43,.12,.12,.015);
      box('Street fittings',8.295,1.49,z-sign*.035,3.91,.018,.03,.004);
    }
    box('Street masonry',8.295,.74,back+sign*.025,4.43,1.48,.08,.018);
    if(!garden) {
      box('Street glazing',8.8,1.55,front-sign*.066,2.4,.07,.018,.004);
      for(let x=7.6;x<10;x+=.48)box('Street fittings',x,1.55,front-sign*.079,.018,.09,.018,.003);
    }
    // Recessed entry lights, a drain and rainwater downpipes belong to the shell.
    for(const x of [6.45,10.14]) {
      box('Street fittings',x,1.2,front+sign*.18,.07,.17,.07,.01);
      box('Streetlamp glow passage',x,1.2,front+sign*.13,.045,.11,.018,.006);
    }
    for(let x=6.65;x<10.2;x+=.13) box('Street fittings',x,.044,front-sign*.16,.065,.014,.13,.003);
    for(const x of [6.07,10.52])box('Street fittings',x,.72,front+sign*.58,.035,1.4,.035,.006);
    const light=new THREE.PointLight('#ffcf8d',0,2.8,2);
    light.name='Passage entry light';
    light.position.set(8.295,1.42,front+sign*.25);garage.add(light);lights.push(light);
  }
  for(const [name,list]of pieces) {
    const geometry=mergeGeometries(list);list.forEach(g=>g.dispose());
    const [color,roughness,metalness]=palette[name];
    const material=new THREE.MeshStandardMaterial({name,color,roughness,metalness,vertexColors:name==='Street planting'});
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
