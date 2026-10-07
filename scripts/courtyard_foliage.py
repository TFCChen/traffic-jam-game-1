"""Seeded, irregular volumes of small folded leaves; no spiral surface grid."""
import math
import random
import bpy
from mathutils import Vector


def foliage(x, y, z, scale, material, palette, objects, canopy=False):
    rng = random.Random(284 + round((x + 20) * 10000) + round((y + 20) * 317))
    vertices, faces, colours = [], [], []
    if canopy:
        # A filled heart and uneven terminal branch masses, at several heights.
        # Keep the trunk visible below the crown and avoid a hollow leafy shell.
        clusters = [(Vector((x, y, 1.12)), (.245, .23, .22), 170)]
        for i in range(7):
            angle = rng.uniform(0, math.tau)
            radius = rng.uniform(.10, .235)
            centre = Vector((x + math.cos(angle) * radius, y + math.sin(angle) * radius,
                             rng.uniform(1.035, 1.30)))
            spread = rng.uniform(.12, .18)
            clusters.append((centre, (spread, spread * rng.uniform(.85, 1.15), spread * rng.uniform(.7, 1.1)), 60))
    else:
        clusters = [(Vector((x, y, z)), (scale, scale * .93, scale * .78), 95)]
    for centre, radii, count in clusters:
        cluster_shade = rng.choice([0, 1, 1, 2])
        for _ in range(count):
            # Independent random samples throughout each ellipsoid. Dense
            # centres and airy edges retain branch-shaped masses without rings.
            while True:
                offset = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
                if offset.length_squared < 1:
                    break
            p = centre + Vector(tuple(offset[j] * radii[j] for j in range(3)))
            azimuth = rng.uniform(0, math.tau)
            normal = Vector((math.cos(azimuth) * rng.uniform(.25, .9),
                             math.sin(azimuth) * rng.uniform(.25, .9), rng.uniform(.12, 1))).normalized()
            tangent = normal.cross(Vector((0, 0, 1))).normalized()
            bitangent = normal.cross(tangent).normalized()
            twist = rng.uniform(-math.pi, math.pi)
            axis = tangent * math.cos(twist) + bitangent * math.sin(twist)
            across = normal.cross(axis).normalized()
            length = rng.uniform(.025, .044) if canopy else rng.uniform(.019, .031)
            width = length * rng.uniform(.34, .46)
            base = len(vertices)
            vertices.extend(tuple(q) for q in [p-axis*length, p+across*width,
                p+axis*length, p-across*width, p+normal*width*.24])
            shade = max(0, min(3, cluster_shade + rng.choice([-1, 0, 0, 0, 1])))
            for j in range(4):
                faces.append((base+j, base+(j+1)%4, base+4)); colours.append(palette[shade].diffuse_color[:])
    mesh = bpy.data.meshes.new('Irregular branch leaf volumes')
    mesh.from_pydata(vertices, [], faces); mesh.update()
    obj = bpy.data.objects.new('Natural courtyard canopy' if canopy else 'Natural planter foliage', mesh)
    bpy.context.collection.objects.link(obj)
    layer = mesh.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='CORNER')
    for polygon in mesh.polygons:
        for loop in polygon.loop_indices:
            layer.data[loop].color = colours[polygon.index]
    mesh.materials.append(material); objects.append(obj)
    return obj
