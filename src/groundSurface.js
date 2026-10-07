import * as THREE from 'three';

export const GROUND_BOUNDS = { x: -2.2, z: -2.15, size: 12.4 };
export const PUDDLES = [[8.9,5.4,1.05,.72],[7.5,.9,.62,1.4],[5.6,5.83,.52,.26],[.45,5.4,.38,.5],[4.5,.25,.9,.3],[-.9,2.9,.36,.85],[2.8,7.2,.7,.38]];
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = (a,b,x) => { const t=clamp((x-a)/(b-a));return t*t*(3-2*t); };
function hash(x,z) { let n=Math.imul(x,374761393)^Math.imul(z,668265263)^731; n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295; }
function noise(x,z) {
  const ix=Math.floor(x),iz=Math.floor(z),tx=smooth(0,1,x-ix),tz=smooth(0,1,z-iz);
  const a=hash(ix,iz)*(1-tx)+hash(ix+1,iz)*tx,b=hash(ix,iz+1)*(1-tx)+hash(ix+1,iz+1)*tx;
  return a*(1-tz)+b*tz;
}
export function groundSample(x,z) {
  const variation=noise(x*1.7,z*1.7),broad=noise(x*.45+12,z*.45-7);
  const lotEdge=Math.min(Math.abs(x+.09),Math.abs(x-6.09),Math.abs(z+.09),Math.abs(z-6.09));
  const inLotRing=x>-.3&&x<6.3&&z>-.3&&z<6.3;
  const curbEdge=Math.min(Math.abs(x-6.48),Math.abs(x-10.12));
  const edge=inLotRing?(1-smooth(.025,.19,lotEdge)):(x>6.3?1-smooth(.025,.18,curbEdge):0);
  const drain=Math.exp(-((x-5.6)**2/.18+(z-5.83)**2/.045));
  const tyre=x>6.6&&x<10 ? (1-smooth(.022,.075,Math.abs(x-(7.45+.17*Math.sin(z*.7))))) * smooth(-1,1,z) * (1-smooth(7,9,z)) : 0;
  let puddle=0;
  for(const[cx,cz,rx,rz]of PUDDLES) {
    const distance=Math.hypot((x-cx)/rx,(z-cz)/rz)+.22*(noise(x*9,z*9)-.5);
    puddle=Math.max(puddle,1-smooth(.65,1.04,distance));
  }
  return { grime:clamp(.06+.14*broad+.16*edge*(.5+variation)+.17*drain+.08*tyre),
    dampness:clamp(.16+.58*broad+.13*variation+puddle*.35),puddle };
}
export function groundMaps(size=384) {
  const macro=new Uint8Array(size*size*4);
  for(let z=0;z<size;z++)for(let x=0;x<size;x++) {
    const s=groundSample(GROUND_BOUNDS.x+(x+.5)/size*GROUND_BOUNDS.size,GROUND_BOUNDS.z+(z+.5)/size*GROUND_BOUNDS.size);
    macro.set([Math.round(s.grime*255),Math.round(s.dampness*255),Math.round(s.puddle*255),255],(z*size+x)*4);
  }
  const grain=new Uint8Array(256*256*4);
  for(let z=0;z<256;z++)for(let x=0;x<256;x++) {
    const n=hash(x,z),aggregate=hash(Math.floor(x/3),Math.floor(z/3));
    const shade=Math.round(255*(.37+.38*n+.25*aggregate));
    grain.set([shade,Math.round((.5+.5*aggregate)*255),0,255],(z*256+x)*4);
  }
  // Sparse sealed hairlines, masked again by a non-repeating world field.
  for(const [sx,sz]of [[37,64],[174,198]])for(let i=0;i<62;i++){
    const x=sx+i,z=Math.round(sz+i*.28+Math.sin(i*.18)*3);
    if(x<256&&z<256)grain[(z*256+x)*4+2]=220;
  }
  return {macro,grain};
}

export function createGroundSurface(renderer,garage) {
  const maps=groundMaps(),textures=[];
  function texture(bytes,w,h,repeat=false) {
    const t=new THREE.DataTexture(bytes,w,h);t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
    t.generateMipmaps=true;t.wrapS=t.wrapT=repeat?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;
    t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());t.needsUpdate=true;textures.push(t);return t;
  }
  const macro=texture(maps.macro,384,384),grain=texture(maps.grain,256,256,true);
  // A small sky-only environment is convolved once. Wet surfaces reflect
  // overcast sky and receive local-light highlights with material-specific
  // roughness. No second scene render or planar mirror is needed.
  const skyBytes=new Uint8Array(256*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<256;x++) {
    const horizon=Math.exp(-(((y/128-.5)/.17)**2));
    const cloud=smooth(.35,.68,noise(x/34,y/16))*.32;
    const c=new THREE.Color(.18+.28*horizon+cloud,.28+.27*horizon+cloud,.40+.23*horizon+cloud);
    skyBytes.set([Math.round(c.r*255),Math.round(c.g*255),Math.round(c.b*255),255],(y*256+x)*4);
  }
  const sky=texture(skyBytes,256,128);sky.mapping=THREE.EquirectangularReflectionMapping;
  const pmrem=new THREE.PMREMGenerator(renderer),reflection=pmrem.fromEquirectangular(sky);pmrem.dispose();
  const weather={value:0},ripples={value:0},clock={value:0},items=[];
  const kinds={'Asphalt blue slate':0,'Street asphalt':0,'Courtyard paving':1,'Courtyard stone':2,'Parking markings':3};
  garage.traverse(mesh=>{
    if(!mesh.isMesh||!(mesh.material.name in kinds))return;
    const original=mesh.material,kind=kinds[original.name],material=new THREE.MeshStandardMaterial();
    material.copy(original);
    material.map=null;material.bumpMap=grain;material.bumpScale=kind===0?.003:.0006;material.roughnessMap=null;material.roughness=kind===0?.91:.84;
    material.metalness=0;material.envMap=reflection.texture;material.envMapIntensity=1.1;
    const before=original.onBeforeCompile;
    material.onBeforeCompile=(shader,gl)=>{
      before.call(material,shader,gl);
      shader.uniforms.groundMacro={value:macro};shader.uniforms.groundGrain={value:grain};shader.uniforms.groundWeather=weather;
      shader.uniforms.groundRipple=ripples;shader.uniforms.groundClock=clock;
      shader.vertexShader='varying vec3 groundWorld; varying float groundFacing;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        groundWorld=(modelMatrix*vec4(transformed,1.)).xyz;
        groundFacing=abs(normalize(mat3(modelMatrix)*normal).y);`);
      shader.fragmentShader=`varying vec3 groundWorld; varying float groundFacing; uniform sampler2D groundMacro; uniform sampler2D groundGrain; uniform float groundWeather;uniform float groundRipple;uniform float groundClock;
        float residualRipple(vec2 p){
          float h=0.;
          ${PUDDLES.map(([x,z],i)=>`{
            float age=mod(groundClock+${(i*.71).toFixed(2)},4.7);
            float d=length(p-vec2(${x.toFixed(2)},${z.toFixed(2)}));
            float waveWidth=max(.045,fwidth(d)*1.8);
            h+=exp(-pow((d-age*.16)/waveWidth,2.))*(1.-smoothstep(1.2,3.4,age));
          }`).join('\n')}
          return h;
        }\n`+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <bumpmap_pars_fragment>',THREE.ShaderChunk.bumpmap_pars_fragment.replaceAll('vBumpMapUv','(groundWorld.xz*1.3)'));
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec4 groundField=texture2D(groundMacro,(groundWorld.xz-vec2(-2.2,-2.15))/12.4);
        vec4 aggregate=texture2D(groundGrain,groundWorld.xz*1.3);
        float facing=smoothstep(.5,.95,groundFacing);
        float wet=groundWeather*(.55+.45*groundField.g)*facing;
        float pool=groundWeather*groundField.b*facing;
        float pigment=${kind===0?'(.84+.25*aggregate.r-groundField.r*.18)':kind===3?'(1.-groundField.r*.07)':'(.93+.10*aggregate.r-groundField.r*.07)'};
        ${kind===0?'pigment*=mix(1.,.82,aggregate.b*smoothstep(.5,.72,groundField.g));':''}
        diffuseColor.rgb*=pigment*mix(1.,${kind===0?'.70':kind===3?'.94':'.83'},wet);
        diffuseColor.rgb*=mix(vec3(1.),vec3(.97,.99,1.),pool*.35);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=clamp(roughness+(.5-aggregate.g)*.09,.72,.98);
        roughnessFactor=mix(roughnessFactor,${kind===0?'.60':kind===1?'.42':kind===2?'.52':'.58'},wet);
        roughnessFactor=mix(roughnessFactor,${kind===0?'.48':kind===1?'.36':kind===2?'.46':'.52'},pool*.4);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        normal=normalize(mix(normal,nonPerturbedNormal,max(wet*.12,pool*.35)));
        if(pool*groundRipple>.01){
          float waterHeight=residualRipple(groundWorld.xz)*pool*groundRipple*.00012;
          vec3 px=dFdx(-vViewPosition),py=dFdy(-vViewPosition);
          vec3 r1=cross(py,normal),r2=cross(normal,px);float det=dot(px,r1);
          normal=normalize(abs(det)*normal-sign(det)*(dFdx(waterHeight)*r1+dFdy(waterHeight)*r2));
        }`);
    };
    material.customProgramCacheKey=()=>`courtyard-ground-v1-${kind}`;
    mesh.material=material;items.push({mesh,original,material});
  });
  return {
    setTheme(settings,quality) {
      weather.value=settings.theme==='rain'?1:0;
      for(const {material}of items) {
        material.envMapIntensity=weather.value?1.15:1.1;
      }
    },
    snapshot(){return {wet:weather.value>0,materials:items.length,reflectionPassesPerFrame:0,reflectionCaptures:0,macroSize:384};},
    update(dt,settings,quality,reduced,editor){ripples.value=settings.theme==='rain'&&quality.decor&&!reduced&&!editor?1:0;if(ripples.value)clock.value+=Math.min(dt,.1);},
    dispose(){for(const{mesh,original,material}of items){mesh.material=original;material.dispose();}textures.forEach(t=>t.dispose());reflection.dispose();},
  };
}
