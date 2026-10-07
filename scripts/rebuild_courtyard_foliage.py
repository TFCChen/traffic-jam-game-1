"""Replace only the foliage in the editable courtyard, preserving all hardscape."""
import os
import sys
import math
import hashlib
from types import SimpleNamespace
import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
from courtyard_foliage import foliage
from compact_environment import compact_environment_glb

def signature(objects):
    digest = hashlib.sha256()
    for obj in sorted(objects, key=lambda obj: obj.name):
        digest.update(repr((obj.name, tuple(tuple(row) for row in obj.matrix_world))).encode())
        for vertex in obj.data.vertices: digest.update(repr(tuple(vertex.co)).encode())
        for polygon in obj.data.polygons: digest.update(repr(tuple(polygon.vertices)).encode())
    return digest.hexdigest()

bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT, 'art', 'street-courtyard.blend'))
material = bpy.data.materials['Courtyard foliage detail']
def palette_colour(hex_colour):
    srgb = [int(hex_colour[i:i+2], 16)/255 for i in (0,2,4)]
    return SimpleNamespace(diffuse_color=tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in srgb)+(1,))
palette = [palette_colour(c) for c in ['4c6952','5b795b','6d8864','7c926b']]
old = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and material in obj.data.materials[:]]
assert old, 'Expected the authored foliage mesh'
static = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj not in old]
before = signature(static)
for obj in old: bpy.data.objects.remove(obj, do_unlink=True)
objects = []
for x,y in [(-.68,-5.6),(5.66,.73),(6.,-7.25),(-1.5,-6.95)]:
    foliage(x,y,1.12,.25,material,palette,objects,canopy=True)
for x,y,w,l in [(-.6,-2.9,.54,1.15),(2.1,.65,1.8,.42),(3.9,-6.65,1.65,.4)]:
    count = max(2, math.ceil(max(w,l)/.25))
    for i in range(count):
        foliage(x+(i-(count-1)/2)*.23*(w>l),y+(i-(count-1)/2)*.23*(l>=w),.29,.15,material,palette,objects)
bpy.ops.object.select_all(action='DESELECT')
for obj in objects: obj.select_set(True)
bpy.context.view_layer.objects.active = objects[0]
bpy.ops.object.join()
joined = bpy.context.object; joined.name = 'Courtyard foliage detail'
assert before == signature(static), 'Non-foliage geometry must remain unchanged'
bpy.ops.object.select_all(action='DESELECT')
for obj in static + [joined]: obj.select_set(True)
staged = os.path.join(ROOT, 'art', 'garage.export.glb')
bpy.ops.export_scene.gltf(filepath=staged, export_format='GLB', use_selection=True, export_yup=True)
target = os.path.join(ROOT, 'public', 'models', 'garage.glb')
os.replace(staged, target); compact_environment_glb(target)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'art', 'street-courtyard.blend'))
print('NATURAL_FOLIAGE_COMPLETE', len(joined.data.polygons), 'triangles; unchanged hardscape', before)
