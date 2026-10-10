// Authored material families baked once; mipmaps filter fine detail during orbit.
export function sceneryTile(name) {
  name=name.toLowerCase();
  if(/wood|oak|timber/.test(name))return 0;
  if(/brick/.test(name))return 4;
  if(/linen|canvas/.test(name))return 5;
  if(/earth|soil|mulch/.test(name))return 6;
  if(/ceramic|cream/.test(name))return 7;
  if(/foliage/.test(name))return 2;
  if(/metal|rail|graphite|brass|powdercoat/.test(name))return 3;
  return 1;
}
export function sceneryAtlasData() {
  const bytes=new Uint8Array(1024*512*4);let seed=937;
  for(let y=0;y<512;y++)for(let x=0;x<1024;x++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const random=seed/4294967296,u=x%256,v=y%256,tile=Math.floor(x/256)+4*Math.floor(y/256);
    let shade=.96;
    if(tile===0){
      const grain=Math.sin(u*.28+Math.sin(v*.022)*1.8+Math.sin(u*.035)*2);
      const pores=Math.max(0,grain)**12;
      shade=.94-.19*pores-.06*(.5+.5*Math.sin(u*.064+v*.003))+(random-.5)*.035;
    }else if(tile===4){
      const pits=random>.95?.08:0;
      shade=.93+(random-.5)*.10-pits+.035*Math.sin(u*.13)*Math.sin(v*.08);
    }else if(tile===5){
      shade=.94-.07*(u%4===0)-.05*(v%4===0)+(random-.5)*.025;
    }else if(tile===3){
      shade=.98+(random-.5)*.025-.02*(v%19===0);
    }else if(tile===6){
      shade=.82+(random-.5)*.23;
    }else if(tile===1){
      shade=.96+(random-.5)*.07-.035*Math.sin(u*.032+Math.sin(v*.021));
    }else shade=.97+(random-.5)*.04;
    const n=Math.max(0,Math.min(255,Math.round(shade*255))),i=(y*1024+x)*4;
    bytes.set([n,n,n,255],i);
  }
  return bytes;
}
