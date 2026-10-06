// Garage asphalt tops out at 0.0355. Leave 2.5 mm of raster clearance below tyres.
export const VEHICLE_GROUND_HEIGHT = .038;
export const CONTACT_PLANE_OFFSET = -.001;
// A soft chassis footprint plus four concentrated tyre contacts, in road units.
export function contactOpacity(x, z, length) {
  let opacity = .16 * Math.exp(-Math.pow(x / (length * .43), 4) - Math.pow(z / .34, 4));
  for (const axle of [-length / 2 + .33, length / 2 - .34]) {
    for (const side of [-.43, .43]) {
      opacity += .62 * Math.exp(-Math.pow((x - axle) / .11, 2) - Math.pow((z - side) / .085, 2));
    }
  }
  return Math.min(.8, opacity);
}
