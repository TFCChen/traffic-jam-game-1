import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function batchColoredMeshes(root,predicate,{roughness=.55,metalness=.12,name='Batched trim'}={}){
  root.updateMatrixWorld(true);
  const meshes=[];root.traverse(mesh=>{if(mesh.isMesh&&predicate(mesh))meshes.push(mesh);});
  if(meshes.length<2)return;
  const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert(),geometries=[];
  for(const mesh of meshes){
    const geometry=mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));
    for(const name of Object.keys(geometry.attributes))if(name!=='position'&&name!=='normal')geometry.deleteAttribute(name);
    const color=mesh.material.color,colors=new Float32Array(geometry.getAttribute('position').count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometries.push(geometry);
  }
  const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
  if(!geometry)throw Error('Colored trim geometry could not be batched.');
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness,metalness});material.name=name;
  const merged=new THREE.Mesh(geometry,material);merged.userData.generatedGeometry=true;merged.castShadow=merged.receiveShadow=true;
  meshes.forEach(mesh=>mesh.removeFromParent());root.add(merged);return merged;
}

export function detailTexture(kind) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const context=canvas.getContext('2d');
  if(kind==='beam'){
    const gradient=context.createLinearGradient(0,0,0,64);
    gradient.addColorStop(0,'rgba(255,239,191,0)');gradient.addColorStop(.75,'rgba(255,239,191,.24)');gradient.addColorStop(1,'rgba(255,239,191,.7)');
    context.fillStyle=gradient;context.beginPath();context.moveTo(5,0);context.lineTo(59,0);context.lineTo(38,64);context.lineTo(26,64);context.closePath();context.fill();
  }else if(kind==='glow'){
    const gradient=context.createRadialGradient(32,32,1,32,32,32);
    gradient.addColorStop(0,'rgba(255,255,255,.65)');gradient.addColorStop(1,'rgba(255,255,255,0)');
    context.fillStyle=gradient;context.fillRect(0,0,64,64);
  }else{
    context.fillStyle='rgba(25,35,40,.35)';
    for(let y=0;y<64;y+=5){context.fillRect(14,y,7,3);context.fillRect(42,y,7,3);}
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export function asphaltTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const context=canvas.getContext('2d'),data=context.createImageData(512,512);
  let seed=731;
  for(let i=0;i<data.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const shade=231+(seed%20);data.data.set([shade,shade,shade,255],i);}
  context.putImageData(data,0,0);
  // Restrained wear: broad repair patches, aggregate and fine sealed cracks.
  context.fillStyle='rgba(91,98,100,.07)';context.fillRect(84,137,173,101);
  for(let i=0;i<450;i++){
    seed=(seed*1664525+1013904223)>>>0;const x=seed%512;
    seed=(seed*1664525+1013904223)>>>0;const y=seed%512;
    context.fillStyle=i%3?'rgba(25,32,36,.09)':'rgba(255,255,255,.18)';context.fillRect(x,y,1+i%2,1);
  }
  context.strokeStyle='rgba(38,48,52,.10)';context.lineWidth=.8;
  for(const [x,y]of [[43,61],[308,332],[401,111]]){
    context.beginPath();context.moveTo(x,y);for(let i=1;i<8;i++)context.lineTo(x+i*8+Math.sin(i*2)*4,y+i*5+Math.cos(i*3)*5);context.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(2,2);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

// Keep all four wheels in one material batch. Vertex rotation avoids four extra draw calls per car.
export function prepareWheels(root,length) {
  root.updateMatrixWorld(true);
  const wheels=[];root.traverse(mesh=>{if(mesh.isMesh&&mesh.material.name==='Rolling wheels')wheels.push(mesh);});
  for(const mesh of wheels){
    const matrix=new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
    const geometry=mesh.geometry.clone().applyMatrix4(matrix),position=geometry.getAttribute('position');
    const pivots=new Float32Array(position.count*3);
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),z=position.getZ(i);
      pivots.set([x<0?-length/2+.33:length/2-.34,.19,z<0?-.43:.43],i*3);
    }
    geometry.setAttribute('wheelPivot',new THREE.BufferAttribute(pivots,3));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
    root.add(mesh);mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);mesh.updateMatrix();
  }
}

export function rollingMaterial(material,angle) {
  material.onBeforeCompile=shader=>{
    shader.uniforms.wheelAngle=angle;
    shader.vertexShader='uniform float wheelAngle;\nattribute vec3 wheelPivot;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float wc=cos(wheelAngle), ws=sin(wheelAngle);
      vec2 wp=transformed.xy-wheelPivot.xy;
      transformed.xy=vec2(wc*wp.x-ws*wp.y,ws*wp.x+wc*wp.y)+wheelPivot.xy;`);
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
      float nc=cos(wheelAngle), ns=sin(wheelAngle);
      objectNormal.xy=vec2(nc*objectNormal.x-ns*objectNormal.y,ns*objectNormal.x+nc*objectNormal.y);`);
  };
  material.customProgramCacheKey=()=> 'rolling-wheels-v1';
  return material;
}
