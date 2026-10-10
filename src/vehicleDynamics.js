const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
export const SUSPENSION_PROFILES = {
  racer: { frequency: 20, response: 0.0012 },
  jeep: { frequency: 17, response: 0.00165 },
  pickup: { frequency: 18, response: 0.0015 },
  compact: { frequency: 19, response: 0.0014 },
  taxi: { frequency: 18, response: 0.0015 },
  schoolbus: { frequency: 17, response: 0.0014 },
  coach: { frequency: 19, response: 0.00125 },
  camper: { frequency: 16, response: 0.0016 },
  delivery: { frequency: 18, response: 0.00135 },
};
// Critically damped chassis pitch; wheel geometry stays outside the suspension pivot.
// Drag input remains constrained by the puzzle grid, without adding input latency.
export function stepSuspension(state, velocity, dt, profile) {
  const filtered =
    state.speed + (velocity - state.speed) * (1 - Math.exp(-12 * dt));
  const acceleration = clamp((filtered - state.speed) / Math.max(dt, 0.001), 8);
  const target = acceleration * (profile?.response ?? 0.0015),
    omega = profile?.frequency ?? 18,
    offset = state.pitch - target;
  const coefficient = state.rate + omega * offset,
    decay = Math.exp(-omega * dt);
  // Independent vertical spring compresses the body; tyres and puzzle position stay fixed.
  const heave = state.heave ?? 0,
    heaveRate = state.heaveRate ?? 0,
    verticalOmega = 22;
  const verticalTarget = -Math.min(0.003, Math.abs(acceleration) * 0.00035);
  const verticalOffset = heave - verticalTarget,
    verticalCoefficient = heaveRate + verticalOmega * verticalOffset;
  const verticalDecay = Math.exp(-verticalOmega * dt);
  return {
    speed: filtered,
    pitch: clamp(target + (offset + coefficient * dt) * decay, 0.02),
    rate: (state.rate - omega * coefficient * dt) * decay,
    heave: Math.max(
      -0.006,
      Math.min(
        0,
        verticalTarget +
          (verticalOffset + verticalCoefficient * dt) * verticalDecay,
      ),
    ),
    heaveRate:
      (heaveRate - verticalOmega * verticalCoefficient * dt) * verticalDecay,
  };
}
export function contactImpulse(state, direction = 1) {
  return { ...state, rate: -Math.sign(direction || 1) * 0.8, heaveRate: -0.16 };
}
// Axle loads follow chassis pitch without moving the four ground contact points.
export function axleCompression(state, length = 2) {
  const halfWheelbase = (length - 0.67) / 2,
    transfer = Math.sin(state.pitch) * halfWheelbase;
  return {
    front: Math.min(0.012, Math.max(0, -state.heave + transfer)),
    rear: Math.min(0.012, Math.max(0, -state.heave - transfer)),
  };
}
