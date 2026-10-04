const clamp=(value,limit)=>Math.max(-limit,Math.min(limit,value));
// Critically damped chassis pitch; wheel geometry stays outside the suspension pivot.
// Drag input remains constrained by the puzzle grid, without adding input latency.
export function stepSuspension(state,velocity,dt){
  const filtered=state.speed+(velocity-state.speed)*(1-Math.exp(-12*dt));
  const acceleration=clamp((filtered-state.speed)/Math.max(dt,.001),8);
  const target=-acceleration*.00045,omega=20,offset=state.pitch-target;
  const coefficient=state.rate+omega*offset,decay=Math.exp(-omega*dt);
  return {speed:filtered,pitch:clamp(target+(offset+coefficient*dt)*decay,.004),rate:(state.rate-omega*coefficient*dt)*decay};
}
