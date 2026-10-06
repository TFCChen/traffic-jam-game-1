export const EXIT_COMPLETE_MS = 6200;
const clamp = v => Math.max(0, Math.min(1, v));
const smooth = v => { v = clamp(v); return v*v*(3-2*v); };
const TURN_START = 7.2, TURN_LENGTH = 3.4, END_Z = 9.05;
// Integrate a tangent whose curvature grows from zero and returns to zero.
const curve = [{x:0,z:0}], STEPS = 240, ds = TURN_LENGTH/STEPS;
for(let i=1;i<=STEPS;i++) {
  const angle = Math.PI/2*smooth((i-.5)/STEPS), p = curve[i-1];
  curve.push({x:p.x+Math.cos(angle)*ds,z:p.z+Math.sin(angle)*ds});
}
// An eased speed profile, integrated once rather than in the render loop.
const timeline = [0], TICKS = 660, duration = 5.5;
for(let i=1;i<=TICKS;i++) {
  const t=(i-.5)*duration/TICKS;
  const speed=smooth(t/.85)*(2.3-.55*smooth((t-1)/.65)+.75*smooth((t-3.35)/.8))*(1-smooth((t-4.55)/.95));
  timeline.push(timeline[i-1]+speed*duration/TICKS);
}
function sample(values,t) {
  const f=clamp(t)*(values.length-1),i=Math.min(values.length-2,Math.floor(f));
  return [i,f-i];
}
export function exitPose(age, originX=5, originZ=2.5, reduced=false) {
  if(reduced)return {x:originX,z:originZ,yaw:0,distance:0,bank:0,steering:0,visible:false,complete:age>=120,follow:0};
  const straight=TURN_START-originX,turnZ=curve[STEPS].z;
  const total=straight+TURN_LENGTH+END_Z-originZ-turnZ;
  const [i,f]=sample(timeline,(age-180)/5500);
  const distance=(timeline[i]+(timeline[i+1]-timeline[i])*f)/timeline[TICKS]*total;
  let x=originX+distance,z=originZ,yaw=0,curvature=0;
  if(distance>straight) {
    const u=clamp((distance-straight)/TURN_LENGTH),[j,g]=sample(curve,u);
    x=TURN_START+curve[j].x+(curve[j+1].x-curve[j].x)*g;
    z=originZ+curve[j].z+(curve[j+1].z-curve[j].z)*g;
    yaw=-Math.PI/2*smooth(u);
    curvature=Math.PI/2*6*u*(1-u)/TURN_LENGTH;
    if(distance>straight+TURN_LENGTH)z+=distance-straight-TURN_LENGTH;
  }
  return {x,z,yaw,distance,bank:-curvature*.01,steering:-Math.atan(1.33*curvature),visible:true,complete:age>=EXIT_COMPLETE_MS,follow:smooth((age-450)/1000)*(1-smooth((age-4800)/1400))};
}
