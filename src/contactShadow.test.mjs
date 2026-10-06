import assert from 'node:assert/strict';
import { contactOpacity, VEHICLE_GROUND_HEIGHT, CONTACT_PLANE_OFFSET } from './contactShadow.js';
assert(VEHICLE_GROUND_HEIGHT - .0355 < .003, 'Tyres must stay close to asphalt');
assert(VEHICLE_GROUND_HEIGHT + CONTACT_PLANE_OFFSET > .0355 && CONTACT_PLANE_OFFSET < 0,
  'Contact plane must stay above the asphalt and below the tyres');
for (const length of [2, 3]) {
  for (const x of [-length / 2 + .33, length / 2 - .34]) {
    assert(contactOpacity(x, .43, length) > .6, 'Tyres need concentrated ground contact');
    assert.equal(contactOpacity(x, .43, length), contactOpacity(x, -.43, length));
  }
  assert(contactOpacity(0, 0, length) > .1, 'Chassis needs restrained underbody occlusion');
  assert(contactOpacity(0, .52, length) < .02, 'Shadow must fade outside the tyres');
  assert(contactOpacity(length / 2 + .06, 0, length) < .02, 'No rectangular shadow edge');
}
console.log('Four tyre contact patches and soft underbody shadow passed.');
