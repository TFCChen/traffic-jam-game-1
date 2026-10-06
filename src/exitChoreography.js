export const EXIT_COMPLETE_MS = 3950;
const clamp=(v)=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
export function exitPose(age, originX=5, originZ=2.5, reduced=false) {
  if(reduced)return {x:originX,z:originZ,yaw:0,distance:0,bank:0,visible:false,complete:age>=120,follow:0};
  // Clear the fence with the rear bumper before steering into the street.
  const straight=7.2-originX,radius=.65,arc=radius*Math.PI/2,total=straight+arc+(8.1-originZ-radius);
  const t=Math.max(0,(age-250)/1000),distance=Math.min(total,t<.5?3*t*t:.75+3*(t-.5));
  let x=originX+distance,z=originZ,yaw=0,bank=0;
  if(distance>straight){const angle=Math.min(Math.PI/2,(distance-straight)/radius);x=7.2+radius*Math.sin(angle);z=originZ+radius*(1-Math.cos(angle));yaw=-angle;bank=.014*Math.sin(angle*2);if(distance>straight+arc)z+=distance-straight-arc;}
  return {x,z,yaw,distance,bank,visible:distance<total,complete:age>=EXIT_COMPLETE_MS,follow:smooth((age-400)/650)*(1-smooth((age-3250)/700))};
}
