export const EXIT_TIME_SCALE = .72;
export const EXIT_COMPLETE_MS = 5650 * EXIT_TIME_SCALE;
export function exitSceneFade(age,reduced=false){
  age /= EXIT_TIME_SCALE;
  return reduced?0:smooth((age-4850)/500)*(1-smooth((age-5800)/450));
}
const clamp = v => Math.max(0, Math.min(1, v));
const smooth = v => { v=clamp(v); return v*v*(3-2*v); };
const smoother = v => {v=clamp(v);return v*v*v*(v*(v*6-15)+10);};
const WHEELBASE=1.33, HALF_TRACK=.405, REAR_OFFSET=.67;
const TURN_REAR_X=6.60, RADIUS=2.05, ENTRY_RAMP=.9, RETURN_RAMP=2.5;
// Early unwind, long gentle tail: zero slope at both ends, with the peak
// curvature drop in the first quarter instead of the middle of the return.
const returnEnvelope = v => {v=clamp(v);return v*v*v*v*(5-4*v);};
// Independent entry/exit transitions: unwind over a longer distance, without
// adding a steering-only lag that would make the tyres slide across the path.
// Entry integrates to half its length; the asymmetric return integrates to a
// third. Compensating the missing curvature retains a 90-degree total heading.
const TURN_LENGTH=Math.PI/2*RADIUS+ENTRY_RAMP/2+RETURN_RAMP*2/3, STEPS=720, ds=TURN_LENGTH/STEPS;
// The rear axle follows the path; both front wheels share a turning centre.
const curve=[{x:0,z:0,heading:0,curvature:0}];
for(let i=1;i<=STEPS;i++){
  const s=(i-.5)*ds, p=curve[i-1];
  const curvature=smooth(s/ENTRY_RAMP)*returnEnvelope((TURN_LENGTH-s)/RETURN_RAMP)/RADIUS;
  const heading=p.heading+curvature*ds;
  curve.push({x:p.x+Math.cos((p.heading+heading)/2)*ds,z:p.z+Math.sin((p.heading+heading)/2)*ds,heading,curvature});
}
const timeline=[0], TICKS=660;
for(let i=1;i<=TICKS;i++){
  const t=(i-.5)*5.5/TICKS;
  // Gently leave the bay, settle into the turn, then accelerate away. Fifth
  // order easing avoids abrupt acceleration at either end of each transition.
  const speed=smoother(t/.95)*(2.45-.85*smoother((t-.65)/.7)+.95*smoother((t-4.6)/.9));
  timeline.push(timeline[i-1]+speed*5.5/TICKS);
}
function sample(values,t){const f=clamp(t)*(values.length-1),i=Math.min(values.length-2,Math.floor(f));return [i,f-i];}
export function steeringAngles(curvature){
  return [-Math.atan(WHEELBASE*curvature/(1+HALF_TRACK*curvature)), -Math.atan(WHEELBASE*curvature/(1-HALF_TRACK*curvature))];
}
function travelled(age,total){
  const [i,f]=sample(timeline,(age-180)/5500);
  return (timeline[i]+(timeline[i+1]-timeline[i])*f)/timeline[TICKS]*total;
}
export function exitPose(age,originX=5,originZ=2.5,reduced=false){
  if(reduced)return {x:originX,z:originZ,yaw:0,distance:0,speed:0,bank:0,steering:0,steeringPair:[0,0],visible:false,complete:age>=120,follow:0};
  const complete=age>=EXIT_COMPLETE_MS;
  age /= EXIT_TIME_SCALE;
  const straight=TURN_REAR_X+REAR_OFFSET-originX;
  const total=straight+TURN_LENGTH+9.5-originZ-curve[STEPS].z-REAR_OFFSET;
  const distance=travelled(age,total);
  const speed=(travelled(age+2/EXIT_TIME_SCALE,total)-travelled(age-2/EXIT_TIME_SCALE,total))/.004;
  let x=originX+distance,z=originZ,yaw=0,curvature=0;
  if(distance>straight){
    const u=clamp((distance-straight)/TURN_LENGTH),[j,g]=sample(curve,u),a=curve[j],b=curve[j+1];
    const heading=a.heading+(b.heading-a.heading)*g;
    x=TURN_REAR_X+a.x+(b.x-a.x)*g+REAR_OFFSET*Math.cos(heading);
    z=originZ+a.z+(b.z-a.z)*g+REAR_OFFSET*Math.sin(heading);
    yaw=-heading;curvature=a.curvature+(b.curvature-a.curvature)*g;
    if(distance>straight+TURN_LENGTH){z+=distance-straight-TURN_LENGTH;curvature=0;}
  }
  const steeringPair=steeringAngles(curvature);
  // Cut while the car is still driving, with the entire shot fully faded.
  // It never reaches the miniature street's exposed edge on screen.
  return {x,z,yaw,distance,speed,bank:-Math.min(.016,curvature*speed*speed*.008),steering:steeringPair[1],steeringPair,visible:age<5400,complete,follow:smoother((age-450)/1100)*(1-smoother((age-5350)/300))};
}
