import * as THREE from 'three';

// Surface-attached droplets: local coordinates keep them on moving cars.
// Beads perturb the optical normal, not the pane's overall transparency.
export function rainSurfaceKind(name) {
  if (name.startsWith('Paint')) return 'paint';
  if (name === 'Automotive glass' || name === 'Architectural glazing') return 'glass';
  if(name==='Batched trim')return 'trim';
  return ({'Courtyard foliage detail':'leaf','Courtyard bark':'bark',
    'Courtyard fence':'metal','Batched scenery':'scenery'})[name] ?? null;
}
const functions = `
vec2 rainHash(vec2 p) {
  vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
  q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);
}
float rainBead(vec2 uv) {
  vec2 cell=floor(uv),random=rainHash(cell);
  vec2 p=fract(uv)-(.22+.56*random);
  float radius=.10+.19*random.x*random.x;
  float r=length(p)/radius;
  float aa=max(fwidth(r),.025);
  // Smooth spherical caps, with screen-footprint fading to prevent sparkle.
  float cap=max(0.,1.-r*r);
  return cap*cap*(1.-smoothstep(1.-aa,1.+aa,r))*
    (1.-smoothstep(.35,1.1,length(fwidth(uv))))*step(.48,random.y);
}
float rainHeight(vec3 p,vec3 n) {
  vec3 weight=pow(abs(n),vec3(8.));weight/=max(.001,weight.x+weight.y+weight.z);
  vec3 warped=p+sin(p.zxy*31.)*.005;
  return dot(weight,vec3(rainBead(warped.zy*27.),rainBead(warped.xz*27.),rainBead(warped.xy*27.)));
}
vec3 rainPerturb(vec3 n,vec3 position,float height) {
  vec3 px=dFdx(position),py=dFdy(position),r1=cross(py,n),r2=cross(n,px);
  float det=dot(px,r1);
  vec3 gradient=sign(det)*(dFdx(height)*r1+dFdy(height)*r2);
  return normalize(abs(det)*n-gradient);
}
`;

export function createRainSurfaces() {
  const wet={value:0},detail={value:1},tracked=new Map();
  function attach(material,length=2) {
    const kind=rainSurfaceKind(material.name);
    if (!kind) return;
    const entry=tracked.get(material);
    if (entry?.wrapper===material.onBeforeCompile) return;
    const before=material.onBeforeCompile,key=material.customProgramCacheKey();
    const wrapper=(shader,renderer)=>{
      before.call(material,shader,renderer);
      shader.uniforms.rainSurfaceWet=wet;shader.uniforms.rainSurfaceDetail=detail;
      shader.vertexShader='varying vec3 rainLocal;varying vec3 rainLocalNormal;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nrainLocal=transformed;rainLocalNormal=normal;');
      shader.fragmentShader='varying vec3 rainLocal;varying vec3 rainLocalNormal;uniform float rainSurfaceWet;uniform float rainSurfaceDetail;\n'+functions+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float rainExposure=${kind==='scenery'?'smoothstep(.1,.25,rainLocal.y)':kind==='trim'?`max(smoothstep(.80,.9,rainLocal.y),max(smoothstep(.40,.46,abs(rainLocal.z)),smoothstep(${(length/2-.16).toFixed(2)},${(length/2-.08).toFixed(2)},abs(rainLocal.x))))`:'1.'};
        ${kind==='scenery'||kind==='glass'?'rainExposure*=1.-(1.-smoothstep(.84,.91,rainLocal.y))*step(rainLocal.x,-.42)*step(.45,rainLocal.z)*step(rainLocal.z,1.7);':''}
        float rainWet=rainSurfaceWet*rainExposure;
        diffuseColor.rgb*=mix(1.,${{paint:'.95',trim:'.92',glass:'1.',leaf:'.68',bark:'.60',metal:'.88',scenery:'.73'}[kind]},rainWet);
        float beadHeight=0.;
        if(rainWet*rainSurfaceDetail>.01)beadHeight=rainHeight(rainLocal,normalize(rainLocalNormal));`);
      if (kind!=='glass')shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=mix(roughnessFactor,${kind==='bark'?'.44':kind==='leaf'?'.24':'.14'},rainWet*.85);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        if(rainWet*rainSurfaceDetail>.01)normal=rainPerturb(normal,-vViewPosition,beadHeight*rainWet*${kind==='glass'?'.001':'.0012'});
      `);
      // Glass retains its .003 roughness and existing Beer-Lambert tint.
      // The car's lacquer uses a distinct beaded top optical layer.
      if(kind==='paint')shader.fragmentShader=shader.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>
        #ifdef USE_CLEARCOAT
        if(rainWet*rainSurfaceDetail>.01)clearcoatNormal=rainPerturb(clearcoatNormal,-vViewPosition,beadHeight*rainWet*.0014);
        #endif`);
    };
    material.onBeforeCompile=wrapper;
    material.customProgramCacheKey=()=>key+'-rain-surface-v1-'+kind;
    material.needsUpdate=true;
    tracked.set(material,{kind,wrapper,before,key});
  }
  return {
    attach,
    detach(material){tracked.delete(material);},
    setTheme(settings,quality){wet.value=settings.theme==='rain'?1:0;detail.value=quality.decor?1:0;},
    snapshot(){return {wet:wet.value>0,detail:detail.value>0,materials:tracked.size,kinds:[...new Set([...tracked.values()].map(e=>e.kind))]};},
    dispose(){for(const[m,e]of tracked){m.onBeforeCompile=e.before;m.customProgramCacheKey=()=>e.key;}tracked.clear();},
  };
}
