import * as THREE from 'three';

// Surface-attached droplets: local coordinates keep them on moving cars.
// Beads perturb the optical normal, not the pane's overall transparency.
export function rainSurfaceKind(name) {
  if (name.startsWith('Paint')) return 'paint';
  if (name === 'Automotive glass' || name === 'Architectural glazing' || name==='Street glazing') return 'glass';
  if(name==='Batched trim')return 'trim';
  return ({'Courtyard foliage detail':'leaf','Courtyard bark':'bark',
    'Courtyard fence':'metal','Batched scenery':'scenery','Street masonry':'masonry','Street roof':'roof','Street fittings':'metal','Street planting':'leaf'})[name] ?? null;
}
// R: tiny spherical beads. G: narrow gravity-aligned drainage trails.
// Bake once, then let hardware mipmaps filter subpixel water detail.
export function rainFilmMap(size=512) {
  const bytes=new Uint8Array(size*size*4);let seed=92171;
  const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
  const put=(x,y,channel,height)=>{
    const pixel=(((y%size+size)%size)*size+((x%size+size)%size))*4;
    bytes[pixel+channel]=Math.max(bytes[pixel+channel],Math.round(Math.max(0,Math.min(1,height))*255));
    bytes[pixel+3]=255;
  };
  for(let i=0;i<2200;i++){
    const x=random()*size,y=random()*size,r=.65+random()**2*1.65;
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
      const px=Math.round(x)+dx,py=Math.round(y)+dy,cap=Math.max(0,1-((px-x)**2+(py-y)**2)/(r*r));
      put(px,py,0,cap*cap);
    }
  }
  for(let i=0;i<32;i++){
    const x=random()*size,y=random()*size,length=30+random()*130,width=.7+random()*.8,phase=random()*6.28;
    for(let t=0;t<length;t++){
      const centre=x+Math.sin(t*.035+phase)*1.4,fade=Math.sin(Math.PI*t/length)**.6;
      for(let dx=-3;dx<=3;dx++){
        const px=Math.round(centre)+dx;
        put(px,Math.round(y-t),1,Math.exp(-(((px-centre)/width)**2))*fade);
      }
    }
  }
  return bytes;
}
const functions = `
vec2 rainFilm(vec3 p,vec3 n) {
  vec3 weight=pow(abs(n),vec3(8.));weight/=max(.001,weight.x+weight.y+weight.z);
  vec2 sideX=texture2D(rainSurfaceMap,p.zy*.95).rg;
  vec2 top=texture2D(rainSurfaceMap,p.zx*.95).rg;
  vec2 sideZ=texture2D(rainSurfaceMap,p.xy*.95).rg;
  return vec2(dot(weight,vec3(sideX.r+sideX.g*.65,top.r+top.g*.22,sideZ.r+sideZ.g*.65)),dot(weight,vec3(sideX.g,top.g*.45,sideZ.g)));
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
  const film=new THREE.DataTexture(rainFilmMap(),512,512);
  film.wrapS=film.wrapT=THREE.RepeatWrapping;film.generateMipmaps=true;
  film.minFilter=THREE.LinearMipmapLinearFilter;film.magFilter=THREE.LinearFilter;film.needsUpdate=true;
  function attach(material,length=2) {
    const kind=rainSurfaceKind(material.name);
    if (!kind) return;
    const beads=['paint','glass','trim'].includes(kind);
    const entry=tracked.get(material);
    if (entry?.wrapper===material.onBeforeCompile) return;
    const before=material.onBeforeCompile,key=material.customProgramCacheKey();
    const wrapper=(shader,renderer)=>{
      before.call(material,shader,renderer);
      shader.uniforms.rainSurfaceWet=wet;shader.uniforms.rainSurfaceDetail=detail;
      shader.uniforms.rainSurfaceMap={value:film};
      shader.vertexShader='varying vec3 rainLocal;varying vec3 rainLocalNormal;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nrainLocal=transformed;rainLocalNormal=normal;');
      shader.fragmentShader='varying vec3 rainLocal;varying vec3 rainLocalNormal;uniform float rainSurfaceWet;uniform float rainSurfaceDetail;uniform sampler2D rainSurfaceMap;\n'+functions+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float rainExposure=${kind==='masonry'?'max(max(step(rainLocal.z,-8.89),step(16.89,rainLocal.z)),max(step(1.78,rainLocal.y),max(step(rainLocal.x,6.08),step(10.51,rainLocal.x))))':kind==='roof'?'smoothstep(.5,.9,abs(rainLocalNormal.y))':kind==='scenery'?'smoothstep(.1,.25,rainLocal.y)':kind==='trim'?`max(smoothstep(.80,.9,rainLocal.y),max(smoothstep(.40,.46,abs(rainLocal.z)),smoothstep(${(length/2-.16).toFixed(2)},${(length/2-.08).toFixed(2)},abs(rainLocal.x))))`:'1.'};
        ${kind==='scenery'||kind==='glass'?'rainExposure*=1.-(1.-smoothstep(.84,.91,rainLocal.y))*step(rainLocal.x,-.42)*step(.45,rainLocal.z)*step(rainLocal.z,1.7);':''}
        float rainWet=rainSurfaceWet*rainExposure;
        diffuseColor.rgb*=mix(1.,${{paint:'.95',trim:'.92',glass:'1.',leaf:'.68',bark:'.60',metal:'.88',scenery:'.73',masonry:'.84',roof:'.72'}[kind]},rainWet);
        vec2 rainFilmDetail=vec2(0.);
        ${beads?'if(rainWet*rainSurfaceDetail>.01)rainFilmDetail=rainFilm(rainLocal,normalize(rainLocalNormal));':''}
        float beadHeight=rainFilmDetail.x;
        ${kind==='paint'||kind==='trim'?'diffuseColor.rgb*=mix(1.,.84,clamp(beadHeight*.8+rainFilmDetail.y*.7,0.,1.)*rainWet);':''}`);
      if (kind!=='glass')shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=mix(roughnessFactor,${kind==='masonry'?'.58':kind==='roof'?'.42':kind==='bark'?'.44':kind==='leaf'?'.24':'.18'},rainWet*.85);
        ${beads?'roughnessFactor=mix(roughnessFactor,.045,smoothstep(.03,.3,beadHeight)*rainWet);':''}`);
      if(beads)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        if(rainWet*rainSurfaceDetail>.01)normal=rainPerturb(normal,-vViewPosition,beadHeight*rainWet*${kind==='glass'?'.00065':'.0010'});
      `);
      // Glass retains its .003 roughness and existing Beer-Lambert tint.
      // The car's lacquer uses a distinct beaded top optical layer.
      if(kind==='paint')shader.fragmentShader=shader.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>
        #ifdef USE_CLEARCOAT
        if(rainWet*rainSurfaceDetail>.01)clearcoatNormal=rainPerturb(clearcoatNormal,-vViewPosition,beadHeight*rainWet*.0012);
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
    dispose(){for(const[m,e]of tracked){m.onBeforeCompile=e.before;m.customProgramCacheKey=()=>e.key;}tracked.clear();film.dispose();},
  };
}
