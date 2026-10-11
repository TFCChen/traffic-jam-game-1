import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STREET, passageBoxes } from './streetLayout.js';

export function createStreetBlocks(garage) {
  const pieces = new Map(), geometries=[], materials=[], lights=[];
  const palette = {
    'Street masonry':['#c4c1b2',.87,0], 'Street roof':['#62716a',.94,0],
    'Street tunnel':['#636c68',.91,0], 'Street fittings':['#37484b',.48,.32],
    'Street glazing':['#49626a',.13,.28], 'Streetlamp glow passage':['#ffe1ac',.35,0],
  };
  function piece(name,geometry,seed=0) {
    for(const key of Object.keys(geometry.attributes)) if(!['position','normal'].includes(key))geometry.deleteAttribute(key);
    if(name==='Street masonry') {
      const tone=.97+.035*Math.sin(seed),colors=new Float32Array(geometry.attributes.position.count*3).fill(tone);
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    }
    if(!pieces.has(name))pieces.set(name,[]);
    pieces.get(name).push(geometry);
  }
  function box(name,x,y,z,w,h,d,r=.015) {
    const geometry = r ? new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/4,h/4,d/4)) : new THREE.BoxGeometry(w,h,d).toNonIndexed();
    geometry.translate(x,y,z);
    piece(name,geometry,x*11+y*19+z*7);
  }
  function wing(x,front,sign) {
    // Solid sloping return wall: full height at the portal, low at the curb.
    // It stays outside the lane, and is never needed to hide a spawn point.
    const geometry=new THREE.BoxGeometry(.22,1,.64).toNonIndexed(),p=geometry.attributes.position;
    for(let i=0;i<p.count;i++) {
      const z=front-sign*(.32+p.getZ(i));
      const t=(front-z)/sign/.64;
      p.setXYZ(i,x+p.getX(i),p.getY(i)>0?1.45-1.15*t:.035,z);
    }
    geometry.computeVertexNormals();piece('Street masonry',geometry,x*11+front*7);
  }
  // Structural shell exactly matches the visibility volumes. Thin bevelled
  // finishes sit outside it, so an opening never reveals an empty facade.
  for(const bounds of passageBoxes()) {
    const c=bounds.getCenter(new THREE.Vector3()),s=bounds.getSize(new THREE.Vector3());
    box('Street tunnel',c.x,c.y,c.z,s.x,s.y,s.z,0);
  }
  for(const [front,back,sign] of [[STREET.north,STREET.min,-1],[STREET.south,STREET.max,1]]) {
    const middle=(front+back)/2,depth=Math.abs(back-front);
    // Both ends read as the same neighbourhood tunnel. Only the restrained
    // stone joint rhythm and roof seams vary; neither roof implies a garden.
    const north=sign<0;
    box('Street masonry',8.295,-.24,middle,4.5,.48,depth,.025);
    for(const x of [6.12,10.47]) {
      // Actual narrow joints reveal the opaque backing, without coplanar
      // dark lines that shimmer as the camera orbits.
      const span=north?.88:1.04;
      for(let row=0;row<4;row++)for(let a=-(row%2)*span/2;a<depth;a+=span) {
        const lo=Math.max(0,a),hi=Math.min(depth,a+span);
        if(hi-lo<.025)continue;
        box('Street masonry',x,.185+row*.37,front+sign*(lo+hi)/2,.20,.362,hi-lo-.008,.005);
      }
      box('Street masonry',x,1.64,middle,.26,.08,depth+.04,.012);
      wing(x,front,sign);
    }
    box('Street roof',8.295,1.599,middle,4.08,.035,depth-.16,.008);
    if(north) {
      for(const x of [7.3,8.3,9.3])box('Street roof',x,1.627,middle,.014,.012,depth-.32,.003);
    } else {
      for(let i=1;i<6;i++)box('Street roof',8.295,1.627,front+sign*i,3.96,.012,.014,.003);
    }
    for(const z of [front,back]) {
      box('Street masonry',8.295,1.65,z,4.43,.18,.16,.015);
      box('Street fittings',8.295,1.49,z-sign*.035,3.91,.018,.03,.004);
    }
    for(let row=0;row<4;row++)for(let a=-(row%2)*.43;a<4.43;a+=.86) {
      const lo=Math.max(0,a),hi=Math.min(4.43,a+.86);
      if(hi-lo<.025)continue;
      box('Street masonry',6.08+(lo+hi)/2,.185+row*.37,back+sign*.045,hi-lo-.008,.362,.08,.005);
    }
    // Narrow stone jambs make the portal read clearly from either side.
    for(const x of [6.21,10.38])box('Street masonry',x,.74,front-sign*.045,.25,1.48,.14,.012);
    // Thin inset entry band keeps the original legible portal and warm light.
    box('Street glazing',8.295,1.64,front-sign*.086,3.1,.06,.018,.004);
    for(let x=6.75;x<10;x+=north?.62:.78)box('Street fittings',x,1.64,front-sign*.099,.016,.08,.018,.003);
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
    const material=new THREE.MeshStandardMaterial({name,color,roughness,metalness,vertexColors:name==='Street masonry'});
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
