import * as THREE from 'three';
// Continue the source asphalt's planar UV transform instead of stretching the
// entire texture once across each new slab (which creates visible seams).
export function continueGroundUV(mesh,source) {
  const pos=source.geometry.attributes.position,uv=source.geometry.attributes.uv;
  if(!uv)return;
  source.updateWorldMatrix(true,false);mesh.updateWorldMatrix(true,false);
  const points=Array.from({length:pos.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(source.matrixWorld));
  const highest=Math.max(...points.map(p=>p.y)),indices=source.geometry.index;
  for(let i=0;i<(indices?.count??pos.count);i+=3){
    const ids=[0,1,2].map(n=>indices?indices.getX(i+n):i+n),[a,b,c]=ids.map(n=>points[n]);
    if([a,b,c].some(p=>p.y<highest-.002))continue;
    const bx=b.x-a.x,bz=b.z-a.z,cx=c.x-a.x,cz=c.z-a.z,det=bx*cz-bz*cx;
    if(Math.abs(det)<1e-8)continue;
    const [ua,ub,uc]=ids.map(n=>new THREE.Vector2().fromBufferAttribute(uv,n));
    const targetPos=mesh.geometry.attributes.position,targetUV=mesh.geometry.attributes.uv,p=new THREE.Vector3();
    for(let n=0;n<targetPos.count;n++){p.fromBufferAttribute(targetPos,n).applyMatrix4(mesh.matrixWorld);const x=p.x-a.x,z=p.z-a.z,s=(x*cz-z*cx)/det,t=(bx*z-bz*x)/det;targetUV.setXY(n,ua.x+s*(ub.x-ua.x)+t*(uc.x-ua.x),ua.y+s*(ub.y-ua.y)+t*(uc.y-ua.y));}
    targetUV.needsUpdate=true;return;
  }
}
