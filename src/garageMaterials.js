import * as THREE from 'three';

export function detailTexture(kind) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const context=canvas.getContext('2d');
  if(kind==='glow'){
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
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const context=canvas.getContext('2d'),data=context.createImageData(128,128);
  let seed=731;
  for(let i=0;i<data.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const shade=231+(seed%20);data.data.set([shade,shade,shade,255],i);}
  context.putImageData(data,0,0);
  const texture=new THREE.CanvasTexture(canvas);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(6,6);texture.colorSpace=THREE.SRGBColorSpace;
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
