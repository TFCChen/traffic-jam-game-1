import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// A small, self-contained street resident. One skinned draw, no fur shells,
// extra lights, physics loop, textures to download or animated sun shadow pass.
const HOME = [-.35, .109, 6.66];
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { const t=clamp(x); return t*t*(3-2*t); };
const pulse = (t,a,b,c,d) => ease((t-a)/(b-a))*(1-ease((t-c)/(d-c)));

export function catPose(time, rain=false, still=false) {
  // Different pauses on successive visits, with the same continuous home pose.
  let t=Math.max(0,time), cycle=0;
  const durations=[32,38,35];
  const period=durations.reduce((a,b)=>a+b,0);
  t%=period;
  while(t>=durations[cycle])t-=durations[cycle++];
  const delay=durations[cycle]-32;
  const p=Math.max(0,t-delay);
  const playing=!rain&&!still;
  const reach=playing?pulse(p,8,9,10,11):0;
  const hop=playing&&p>=11&&p<12?Math.sin((p-11)*Math.PI):0;
  const visit=playing?(p<11?0:p<12?ease(p-11):1-ease((p-22)/3)):0;
  const grooming=!still?pulse(p,17,18,20,21):0;
  const look=!still?pulse(p,5,6.5,9,11):0;
  const steps=playing?pulse(p,22,22.2,24.8,25)*Math.sin((p-22)*Math.PI*6):0;
  const blink=still?0:Math.max(pulse(t,3.1,3.18,3.26,3.36),pulse(p,15,15.08,15.16,15.26));
  return {
    x:HOME[0]+visit*.10, y:HOME[1]+hop*.105, z:HOME[2]+visit*.43,
    yaw:.24, reach, hop, grooming, look, steps, blink,
    breath:still?0:Math.sin(time*2.1)*.002,
    tail:still?.18:Math.sin(time*1.45)*.18+look*.22,
    ears:still?0:Math.sin(time*.77)*.045+look*.12,
    activity:still?'rest':rain?'watch rain':hop>0?'pounce':reach>0?'paw leaf':grooming>0?'groom':visit>0?'investigate':'watch',
    leaf:playing?pulse(p,9,9.3,11.5,13):0,
  };
}

function buildKitten() {
  const bones=[], pieces=[], rest=[];
  function bone(name,parent,position) {
    const b=new THREE.Bone();b.name=name;b.position.fromArray(position);
    if(parent)parent.add(b);
    bones.push(b);return b;
  }
  const root=bone('Kitten root',null,[0,0,0]);
  const body=bone('Spine',root,[0,.25,-.025]);
  const head=bone('Head',body,[0,.14,.235]);
  const ears=[-1,1].map(s=>bone(`Ear ${s}`,head,[s*.095,.075,-.01]));
  const eyes=[-1,1].map(s=>bone(`Eye ${s}`,head,[s*.07,.017,.117]));
  const legs=[];
  for(const rear of [false,true])for(const side of [-1,1]) {
    const upper=bone(`${rear?'Hind':'Front'} leg ${side}`,root,[side*(rear?.092:.079),.235,rear?-.17:.145]);
    const lower=bone('Ankle',upper,[0,-.105,rear?-.022:.008]);
    const paw=bone('Paw',lower,[0,-.092,.012]);
    legs.push({upper,lower,paw,rear,side});
  }
  const tails=[bone('Tail base',body,[0,.055,-.19])];
  for(const [i,offset] of [[0,[0,.065,-.045]],[1,[0,.07,-.025]],[2,[.01,.065,.008]],[3,[.01,.035,.03]]])
    tails.push(bone(`Tail ${i+1}`,tails.at(-1),offset));
  root.updateMatrixWorld(true);
  const bonePositions=bones.map(b=>b.getWorldPosition(new THREE.Vector3()));
  function piece(g,b,color,skin) {
    g.deleteAttribute('uv');
    const n=g.attributes.position.count;
    const rgb=new Float32Array(n*3),indices=new Uint16Array(n*4),weights=new Float32Array(n*4);
    const c=new THREE.Color(),point=new THREE.Vector3();
    for(let i=0;i<n;i++) {
      point.fromBufferAttribute(g.attributes.position,i);
      c.set(typeof color==='function'?color(point):color);c.toArray(rgb,i*3);
      const w=skin?.(point)??[[bones.indexOf(b),1]];
      w.forEach(([j,v],k)=>{indices[i*4+k]=j;weights[i*4+k]=v;});
    }
    g.setAttribute('color',new THREE.BufferAttribute(rgb,3));
    g.setAttribute('skinIndex',new THREE.BufferAttribute(indices,4));
    g.setAttribute('skinWeight',new THREE.BufferAttribute(weights,4));
    pieces.push(g);
  }
  function ellipsoid(b,offset,scale,color,segments=16) {
    const p=bonePositions[bones.indexOf(b)].clone().add(new THREE.Vector3(...offset));
    const g=new THREE.SphereGeometry(1,segments,12);g.scale(...scale);g.translate(...p.toArray());piece(g,b,color);
  }
  const cream='#f4e6ca', ginger='#c98242', dark='#95552e', pink='#ca8983';
  const coat = p => {
    if(p.y<.22&&p.z>.03)return cream;
    // Soft irregular tabby bars following the back, not separate floating strips.
    const stripe=Math.sin(p.z*66+Math.sin(p.x*32)*1.3);
    return stripe>.68&&p.y>.27?dark:ginger;
  };
  ellipsoid(body,[0,0,0],[.126,.133,.228],coat,24);
  ellipsoid(body,[0,.003,.12],[.11,.125,.105],cream);
  ellipsoid(head,[0,0,0],[.141,.121,.123],p=>p.z>.285&&Math.abs(p.x)<.042?cream:ginger,24);
  // Cheeks, chin and a short cat muzzle; no protruding dog snout.
  ellipsoid(head,[-.043,-.044,.102],[.061,.044,.041],cream);
  ellipsoid(head,[.043,-.044,.102],[.061,.044,.041],cream);
  ellipsoid(head,[0,-.071,.077],[.055,.022,.038],cream);
  ellipsoid(head,[0,-.025,.143],[.018,.011,.009],pink);
  for(const side of [-1,1]) {
    const eye=eyes[side===-1?0:1];
    ellipsoid(eye,[0,-.001,-.013],[.036,.036,.021],'#49392b');
    ellipsoid(eye,[0,0,.002],[.025,.027,.009],'#a5b66a');
    ellipsoid(eye,[-side*.001,.001,.009],[.008,.022,.004],'#172a24');
    ellipsoid(eye,[-side*.008,.012,.012],[.006,.006,.003],'#fff5db',8);
    // Fine tapered whiskers remain actual geometry from every viewing angle.
    for(let i=0;i<3;i++) {
      const a=new THREE.Vector3(side*.05,-.043+i*.012,.13).add(bonePositions[bones.indexOf(head)]);
      const end=a.clone().add(new THREE.Vector3(side*.105,(i-1)*.02,-.005));
      const path=new THREE.LineCurve3(a,end);
      piece(new THREE.TubeGeometry(path,1,.0013,3,false),head,'#e8ddc7');
    }
  }
  for(let i=0;i<ears.length;i++) {
    const b=ears[i],side=i?1:-1,p=bonePositions[bones.indexOf(b)];
    // A thick leaf-like ear with a rounded tip and inset inner surface.
    const outline=[[-.050,0,.012],[.049,0,.006],[side*.026,.105,-.020],[side*.012,.115,-.014]];
    const vertices=[];
    for(const q of outline)vertices.push(q[0]+p.x,q[1]+p.y,q[2]+p.z);
    vertices.push(p.x,p.y+.025,p.z-.035);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    g.setIndex([0,1,2,0,2,3,0,4,1,1,4,2,2,4,3,3,4,0]);g.computeVertexNormals();piece(g,b,ginger);
    const inner=new THREE.BufferGeometry();
    inner.setAttribute('position',new THREE.Float32BufferAttribute([
      p.x-.031,p.y+.014,p.z+.014,p.x+.031,p.y+.014,p.z+.010,
      p.x+side*.020,p.y+.085,p.z-.009,
    ],3));inner.setIndex([0,1,2]);inner.computeVertexNormals();piece(inner,b,pink);
  }
  for(const {upper,lower,paw,rear} of legs) {
    ellipsoid(upper,[0,-.04,rear?-.015:0],[rear?.060:.034,.083,rear?.073:.038],ginger);
    ellipsoid(lower,[0,-.043,.006],[.029,.063,.032],p=>p.y<.09?cream:ginger);
    ellipsoid(paw,[0,-.012,.014],[.041,.025,.055],cream);
    // Two tiny toe creases, merged into the same draw as the coat.
    for(const x of [-.013,.013])ellipsoid(paw,[x,-.006,.061],[.0016,.009,.0015],'#b9a68c',8);
  }
  const tailPoints=tails.map(b=>bonePositions[bones.indexOf(b)].clone());
  tailPoints.push(tailPoints.at(-1).clone().add(new THREE.Vector3(.012,.035,.015)));
  const tailPath=new THREE.CatmullRomCurve3(tailPoints);
  const tailGeo=new THREE.TubeGeometry(tailPath,24,.026,8,false);
  const tailVertices=tailGeo.attributes.position,tailPoint=new THREE.Vector3();
  for(let j=0;j<=24;j++) {
    const centre=tailPath.getPointAt(j/24),taper=1-.64*ease(j/24);
    for(let k=0;k<=8;k++) {
      const index=j*9+k;
      tailPoint.fromBufferAttribute(tailVertices,index).sub(centre).multiplyScalar(taper).add(centre);
      tailVertices.setXYZ(index,tailPoint.x,tailPoint.y,tailPoint.z);
    }
  }
  tailGeo.computeVertexNormals();
  // Blend along the tail chain instead of rotating disconnected capsules.
  const tailStart=bones.indexOf(tails[0]);
  piece(tailGeo,tails[0],p=>Math.sin((p.y+p.z)*95)>.25?dark:ginger,p=>{
    let best=0,distance=Infinity;
    for(let i=0;i<tailPoints.length;i++){const d=p.distanceToSquared(tailPoints[i]);if(d<distance){best=i;distance=d;}}
    best=Math.min(best,4);return [[tailStart+best,.75],[tailStart+Math.max(0,best-1),.25]];
  });
  const geometry=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,metalness:0});
  material.name='Kitten short coat';
  const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name='Courtyard tabby kitten';
  mesh.add(root);mesh.bind(new THREE.Skeleton(bones));mesh.receiveShadow=true;mesh.castShadow=false;
  // The footprint never leaves a tiny sidewalk bay. Avoid bind-pose culling
  // cutting off a lifted paw or tail; this single resident is always bounded.
  mesh.frustumCulled=false;
  for(const b of bones)rest.push({position:b.position.clone(),rotation:b.rotation.clone()});
  return {mesh,bones,rest,body,head,ears,eyes,legs,tails,material,geometry};
}

export function createCourtyardCat(scene) {
  const rig=buildKitten(), group=new THREE.Group();group.name='Sidewalk kitten resident';
  group.add(rig.mesh);scene.add(group);
  // A soft receiving footprint instead of another moving full-scene depth pass.
  const shadowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{opacity:{value:.2}},
    vertexShader:'varying vec2 q; void main(){q=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 q;uniform float opacity;void main(){float a=pow(max(0.,1.-dot(q,q)),2.)*opacity;gl_FragColor=vec4(.07,.08,.09,a);}',
  });
  const shadowGeometry=new THREE.PlaneGeometry(.36,.64),shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);
  shadow.name='Kitten soft contact';shadow.rotation.x=-Math.PI/2;shadow.renderOrder=2;scene.add(shadow);
  const leafGeometry=new THREE.SphereGeometry(1,8,4);
  leafGeometry.scale(.025,.004,.045);
  const leafMaterial=new THREE.MeshStandardMaterial({color:'#b48b47',roughness:.95});
  const leaf=new THREE.Mesh(leafGeometry,leafMaterial);leaf.name='Kitten fallen leaf';scene.add(leaf);
  let time=0, pose=catPose(0), visible=true, moving=false, theme='day';
  function apply(next) {
    pose=next;
    rig.bones.forEach((b,i)=>{b.position.copy(rig.rest[i].position);b.rotation.copy(rig.rest[i].rotation);});
    group.position.set(pose.x,pose.y,pose.z);group.rotation.y=pose.yaw;
    group.scale.setScalar(.86);
    rig.body.position.y+=pose.breath-pose.reach*.014;
    rig.head.rotation.set(pose.look*.2+pose.grooming*.32,Math.sin(time*.42)*.08-pose.grooming*.4,-pose.look*.10);
    for(let i=0;i<rig.ears.length;i++)rig.ears[i].rotation.z=(i?1:-1)*pose.ears;
    for(const eye of rig.eyes)eye.scale.y=1-pose.blink*.92;
    rig.tails.forEach((b,i)=>{b.rotation.y=pose.tail*(.45+i*.12);b.rotation.x=Math.sin(time*1.1-i*.6)*.06;});
    for(const leg of rig.legs) {
      const gait=pose.steps*(leg.side*(leg.rear?-1:1));
      leg.upper.rotation.x=gait*.16+pose.hop*(leg.rear?-.35:.28);
      leg.lower.rotation.x=-gait*.1-pose.hop*.2;
      if(!leg.rear&&leg.side===-1) {
        leg.upper.rotation.x+=pose.reach*-.65+pose.grooming*-2.4;
        leg.lower.rotation.x+=pose.reach*.5+pose.grooming*1.4;
        leg.paw.rotation.x-=pose.grooming*.4;
      }
    }
    group.updateMatrixWorld(true);
    shadow.position.set(pose.x,.1105,pose.z-.025);shadow.rotation.z=-pose.yaw;
    shadow.scale.setScalar(1+pose.hop*.22);shadowMaterial.uniforms.opacity.value=(theme==='neon'?.16:.22)-pose.hop*.09;
    leaf.position.set(HOME[0]+.12+pose.leaf*.08,.116+Math.sin(pose.leaf*Math.PI)*.025,HOME[2]+.37+pose.leaf*.12);
    leaf.rotation.y=.6+pose.leaf*2;
    moving=pose.hop>0||pose.reach>0||pose.grooming>0||Math.abs(pose.steps)>.01;
  }
  apply(pose);
  return {
    setTheme(settings,quality) {
      theme=settings.theme;
      // Damp short fur stays rough; never apply car-glass rain beads to an animal.
      rig.material.color.set(theme==='rain'?'#d9d0c0':'#ffffff');
      rig.material.roughness=theme==='rain'?.94:.88;
      shadowMaterial.uniforms.opacity.value=theme==='neon'?.16:.22;
    },
    update(dt,settings,quality,reduced,editor) {
      visible=!editor;group.visible=shadow.visible=leaf.visible=visible;
      if(!visible){moving=false;return;}
      if(!reduced&&quality.decor)time+=Math.min(Math.max(0,dt),.1);
      apply(catPose(time,settings.theme==='rain',reduced||!quality.decor));
    },
    pause() {moving=false;},
    snapshot(){return {visible,time,activity:pose.activity,position:[pose.x,pose.y,pose.z],moving,bones:rig.bones.length,draws:3,theme};},
    dispose(){scene.remove(group,shadow,leaf);rig.mesh.skeleton.dispose();rig.geometry.dispose();rig.material.dispose();shadowGeometry.dispose();shadowMaterial.dispose();leafGeometry.dispose();leafMaterial.dispose();},
  };
}
