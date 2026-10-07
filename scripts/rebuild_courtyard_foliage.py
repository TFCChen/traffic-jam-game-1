"""Rebuild connected trees and shrubs, preserving surrounding hardscape."""
import os
import sys
import math
import hashlib
from types import SimpleNamespace
import bpy
import bmesh

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
bark = bpy.data.materials.get('Courtyard bark') or bpy.data.materials.new('Courtyard bark')
bark.diffuse_color=(.133,.085,.048,1);bark.use_nodes=True
bsdf=bark.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=bark.diffuse_color;bsdf.inputs['Roughness'].default_value=.94
def palette_colour(hex_colour):
    srgb = [int(hex_colour[i:i+2], 16)/255 for i in (0,2,4)]
    return SimpleNamespace(diffuse_color=tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in srgb)+(1,))
palette = [palette_colour(c) for c in ['4c6952','5b795b','6d8864','7c926b']]
old = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and any(m in obj.data.materials[:] for m in [material,bark])]
assert old, 'Expected the authored foliage mesh'
# Remove only the original tree trunks/spokes from the joined oak mesh.
# Benches, cafe woodwork and pergola components must remain untouched.
trees=[(-.68,-5.6),(5.66,.73),(6.,-7.25),(-1.5,-6.95)]
for obj in list(bpy.context.scene.objects):
    if obj.type!='MESH' or not any(m.name=='Oiled oak' for m in obj.data.materials):continue
    bm=bmesh.new();bm.from_mesh(obj.data);pending=set(bm.verts);removed=[]
    while pending:
        seed=pending.pop();component={seed};stack=[seed]
        while stack:
            vertex=stack.pop()
            for edge in vertex.link_edges:
                other=edge.other_vert(vertex)
                if other in pending:pending.remove(other);component.add(other);stack.append(other)
        positions=[obj.matrix_world@v.co for v in component]
        if any(all(abs(p.x-x)<.32 and abs(p.y-y)<.32 and .14<p.z<1.03 for p in positions) for x,y in trees):removed.extend(component)
    if removed:
        print('REMOVED_OLD_TREE_VERTICES',len(removed));bmesh.ops.delete(bm,geom=removed,context='VERTS');bm.to_mesh(obj.data);obj.data.update()
    bm.free()
static = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj not in old]
before = signature(static)
for obj in old: bpy.data.objects.remove(obj, do_unlink=True)
objects = []
for x,y in trees:
    foliage(x,y,1.12,.25,material,palette,objects,canopy=True,bark=bark)
for x,y,w,l in [(-.6,-2.9,.54,1.15),(2.1,.65,1.8,.42),(3.9,-6.65,1.65,.4)]:
    count = max(2, math.ceil(max(w,l)/.25))
    for i in range(count):
        foliage(x+(i-(count-1)/2)*.23*(w>l),y+(i-(count-1)/2)*.23*(l>=w),.29,.15,material,palette,objects,bark=bark)
attached=sum(obj.get('attachedLeaves',0) for obj in objects)
gap=max(obj.get('maxAttachmentGap',0) for obj in objects)
joined=[]
batches=[(mat,[obj for obj in objects if mat in obj.data.materials[:]]) for mat in [material,bark]]
for mat,batch in batches:
    bpy.ops.object.select_all(action='DESELECT')
    for obj in batch:obj.select_set(True)
    bpy.context.view_layer.objects.active=batch[0];bpy.ops.object.join()
    result=bpy.context.object;result.name=mat.name;joined.append(result)
assert before == signature(static), 'Surrounding hardscape geometry must remain unchanged'
bpy.ops.object.select_all(action='DESELECT')
for obj in static + joined: obj.select_set(True)
staged = os.path.join(ROOT, 'art', 'garage.export.glb')
bpy.ops.export_scene.gltf(filepath=staged, export_format='GLB', use_selection=True, export_yup=True)
target = os.path.join(ROOT, 'public', 'models', 'garage.glb')
os.replace(staged, target); compact_environment_glb(target)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'art', 'street-courtyard.blend'))
print('CONNECTED_FOLIAGE_COMPLETE',sum(len(obj.data.polygons) for obj in joined),'triangles;',attached,'attached leaves; max gap',gap,'unchanged remaining hardscape',before)
