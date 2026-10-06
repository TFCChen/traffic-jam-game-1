import * as THREE from 'three';

export function hintDestination(car, delta) {
  return { row:car.row+(car.dir==='V'?delta:0), col:car.col+(car.dir==='H'?delta:0), len:car.len, dir:car.dir, distance:Math.abs(delta) };
}

// Only allocate the guide once; update its label when the requested move changes.
export function createHintGuide(scene) {
  const group=new THREE.Group();group.visible=false;scene.add(group);
  const gold=new THREE.MeshBasicMaterial({color:'#ffe5a0',depthTest:false,depthWrite:false});
  const dark=new THREE.MeshBasicMaterial({color:'#212733',depthTest:false,depthWrite:false});
  const cylinder=new THREE.CylinderGeometry(1,1,1,10);
  const cone=new THREE.ConeGeometry(.17,.34,12);
  const surfaceGold=new THREE.MeshBasicMaterial({color:'#ffe5a0',transparent:true,depthTest:true,depthWrite:false});
  // Draw the second style only where opaque scene depth hides the ground frame.
  const hiddenGold=new THREE.MeshBasicMaterial({color:'#ffe5a0',transparent:true,opacity:.28,depthTest:true,depthFunc:THREE.GreaterDepth,depthWrite:false});
  function mesh(geometry,material,order=30){const m=new THREE.Mesh(geometry,material);m.renderOrder=order;group.add(m);return m;}
  const routeBack=mesh(cylinder,dark),route=mesh(cylinder,gold,31),tip=mesh(cone,gold,32);
  const frame=Array.from({length:4},()=>mesh(cylinder,surfaceGold,29));
  const hiddenFrame=new THREE.InstancedMesh(cylinder,hiddenGold,128);hiddenFrame.renderOrder=29;hiddenFrame.frustumCulled=false;group.add(hiddenFrame);
  const dashPose=new THREE.Object3D();
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=80;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const labelMaterial=new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false});
  const label=new THREE.Sprite(labelMaterial);label.scale.set(1.25,.39,1);label.renderOrder=34;group.add(label);
  const up=new THREE.Vector3(0,1,0);let key='',destination=null;
  function segment(m,a,b,r){const d=b.clone().sub(a);m.position.copy(a).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(up,d.clone().normalize());m.scale.set(r,d.length(),r);}
  return {
    update(car,delta,visible,labelWidth=1.25){group.visible=!!car&&visible;if(!group.visible){destination=null;key='';return;}label.scale.set(labelWidth,labelWidth*80/256,1);const next=JSON.stringify([car.row,car.col,car.len,car.dir,delta]);if(next===key)return;key=next;
      destination=hintDestination(car,delta);
      const start=new THREE.Vector3(car.col+(car.dir==='H'?car.len/2:.5),1.35,car.row+(car.dir==='V'?car.len/2:.5));
      const direction=new THREE.Vector3(car.dir==='H'?Math.sign(delta):0,0,car.dir==='V'?Math.sign(delta):0);
      const end=start.clone().addScaledVector(direction,Math.abs(delta));
      segment(routeBack,start,end,.044);segment(route,start,end,.023);
      tip.position.copy(end);tip.quaternion.setFromUnitVectors(up,direction);
      const w=car.dir==='H'?car.len:1,h=car.dir==='V'?car.len:1,x=destination.col,z=destination.row;
      const corners=[[x+.06,z+.06],[x+w-.06,z+.06],[x+w-.06,z+h-.06],[x+.06,z+h-.06]].map(([x,z])=>new THREE.Vector3(x,.085,z));
      frame.forEach((m,i)=>segment(m,corners[i],corners[(i+1)%4],.022));
      let count=0;
      corners.forEach((a,i)=>{const edge=corners[(i+1)%4].clone().sub(a),length=edge.length(),direction=edge.clone().normalize();
        for(let offset=0;offset<length&&count<128;offset+=.24){const size=Math.min(.13,length-offset);dashPose.position.copy(a).addScaledVector(direction,offset+size/2);dashPose.quaternion.setFromUnitVectors(up,direction);dashPose.scale.set(.019,size,.019);dashPose.updateMatrix();hiddenFrame.setMatrixAt(count++,dashPose.matrix);}
      });
      hiddenFrame.count=count;hiddenFrame.instanceMatrix.needsUpdate=true;
      label.position.copy(start).addScaledVector(direction,Math.abs(delta)*.55);label.position.y=1.8;
      const ctx=canvas.getContext('2d');ctx.clearRect(0,0,256,80);ctx.fillStyle='#222733';ctx.strokeStyle='#efd08b';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(3,3,250,74,18);ctx.fill();ctx.stroke();ctx.fillStyle='#fff2cf';ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`移動 ${Math.abs(delta)} 格`,128,41);texture.needsUpdate=true;
    },
    snapshot:()=>group.visible?destination:null,
    dispose(){scene.remove(group);hiddenFrame.dispose();cylinder.dispose();cone.dispose();gold.dispose();dark.dispose();surfaceGold.dispose();hiddenGold.dispose();texture.dispose();labelMaterial.dispose();},
  };
}
