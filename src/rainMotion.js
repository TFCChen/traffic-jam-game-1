import * as THREE from 'three';

export function courtyardWind(time) {
  const gust=.7+.3*Math.sin(time*.31);
  return [Math.sin(time*.7)*.017*gust,Math.cos(time*.53)*.011*gust,
    Math.sin(time*1.7)*.003,Math.sin(time*1.1)*.002];
}

// Short isolated releases, not continuous rain. One model unit is roughly
// 1.5 metres; acceleration is scaled to this small courtyard's proportions.
export function dripPose(time,index,source,windTime=time) {
  const phase=(time+index*2.47+Math.sin(index*3)*.4)%19.3,hang=.32;
  const flight=Math.sqrt(2*Math.max(0,source.y-source.floor)/6.2);
  const age=phase-hang,impact=age-flight;
  const profile=source.wind??[0,0,0,0];
  const wind=courtyardWind(windTime-Math.max(0,Math.min(age,flight)));
  const dx=wind[0]*profile[0]+wind[2]*profile[1];
  const dz=wind[1]*profile[0]+wind[2]*profile[3];
  const dy=wind[3]*profile[2];
  return {x:source.x+dx,z:source.z+dz,y:Math.max(source.floor,source.y+dy-3.1*Math.max(0,age)**2),
    radius:phase<hang?.0015+.0025*phase/hang:.004,
    stretch:phase<hang?.005:.006+Math.min(flight,Math.max(0,age))*.012,
    dropAlpha:age<flight?.62:0,
    impactAlpha:impact>=0&&impact<.24?.28*(1-impact/.24):0,
    impactRadius:.005+.035*Math.max(0,Math.min(.24,impact))/.24,
    floor:source.floor};
}

export function rainDripSources(garage,anchors) {
  const sources=[.67,1.13,1.51].map(z=>({kind:'canopy',x:-.327,y:.882,z}));
  garage.updateWorldMatrix(true,true);
  for(const [cx,cz]of anchors){
    let best=null,score=-Infinity;
    garage.traverse(mesh=>{
      if(!mesh.isMesh||mesh.material.name!=='Courtyard foliage detail')return;
      const positions=mesh.geometry.attributes.position,profile=mesh.geometry.attributes.windProfile;
      const p=new THREE.Vector3();
      for(let i=0;i<positions.count;i++){
        p.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
        const radius=Math.hypot(p.x-cx,p.z-cz);
        if(radius<.15||radius>.72||p.y<.7||p.y>1.6||!(p.x<-.32||p.x>6.32||p.z<-.32||p.z>6.32))continue;
        const candidate=radius-p.y*.07;
        if(candidate>score){score=candidate;best={kind:'leaf',x:p.x,y:p.y,z:p.z,
          wind:profile?[profile.getX(i),profile.getY(i),profile.getZ(i),profile.getW(i)]:[0,0,0,0]};}
      }
    });
    if(best)sources.push(best);
  }
  const ray=new THREE.Raycaster();
  return sources.map(source=>{
    ray.set(new THREE.Vector3(source.x,source.y-.018,source.z),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(garage,true).find(h=>!['Courtyard foliage detail','Courtyard bark'].includes(h.object.material.name));
    return {...source,floor:hit?.point.y??.1};
  }).filter(source=>source.y-source.floor>.1);
}

export function createRainMotion(scene,garage,anchors) {
  const sources=rainDripSources(garage,anchors),capacity=sources.length*2;
  const geometry=new THREE.SphereGeometry(1,6,4);
  const fades=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1);
  geometry.setAttribute('waterFade',fades);fades.setUsage(THREE.DynamicDrawUsage);
  const material=new THREE.MeshStandardMaterial({color:'#b9d4dd',roughness:.06,metalness:0,
    transparent:true,opacity:1,depthWrite:false});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float waterFade;varying float dropFade;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ndropFade=waterFade;');
    shader.fragmentShader='varying float dropFade;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=dropFade;');
  };
  material.customProgramCacheKey=()=> 'residual-water-v1';
  const mesh=new THREE.InstancedMesh(geometry,material,capacity);
  mesh.name='Residual canopy and leaf water';mesh.raycast=()=>{};mesh.frustumCulled=false;
  mesh.visible=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);
  const pose=new THREE.Object3D();let time=0,active=0;
  return {
    update(dt,enabled,windTime){
      mesh.visible=enabled;active=0;if(!enabled)return;
      time+=Math.min(dt,.1);
      sources.forEach((source,i)=>{
        const p=dripPose(time,i,source,windTime??time);
        pose.position.set(p.x,p.y,p.z);pose.scale.set(p.radius,p.stretch,p.radius);
        pose.updateMatrix();mesh.setMatrixAt(i*2,pose.matrix);fades.array[i*2]=p.dropAlpha;
        pose.position.set(p.x,p.floor+.0012,p.z);pose.scale.set(p.impactRadius,.0008,p.impactRadius);
        pose.updateMatrix();mesh.setMatrixAt(i*2+1,pose.matrix);fades.array[i*2+1]=p.impactAlpha;
        if(p.dropAlpha>0)active++;if(p.impactAlpha>0)active++;
      });
      mesh.instanceMatrix.needsUpdate=true;fades.needsUpdate=true;
    },
    snapshot(){return {visible:mesh.visible,capacity,active,sources:sources.map(s=>({...s})),time};},
    pause(){mesh.visible=false;active=0;},
    dispose(){scene.remove(mesh);mesh.dispose();geometry.dispose();material.dispose();},
  };
}
