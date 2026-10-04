"""Render the actual exported hero GLB for silhouette review, without altering assets."""
import bpy, os, sys
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
kind=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'racer'
if kind not in ('racer','compact','jeep'):raise ValueError('Unsupported studio model')
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'public','models',kind+'.glb'))
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=600;scene.render.resolution_percentage=100
scene.world.color=(.15,.15,.15)
bpy.ops.mesh.primitive_plane_add(size=200)
floor=bpy.context.object;floor.location.z=-.008
material=bpy.data.materials.new('Studio floor');material.diffuse_color=(.14,.17,.19,1);material.use_nodes=True
material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.14,.17,.19,1)
material.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.85
floor.data.materials.append(material)
for location,power,size in [((1,-3,5),500,4),((-2,2,3),450,3),((3,3,4),300,3)]:
    bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object
    light.data.energy=power;light.data.shape='DISK';light.data.size=size
    light.rotation_euler=(Vector((0,0,.25))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=2.8;scene.camera=camera
os.makedirs(os.path.join(ROOT,'.browser-checks'),exist_ok=True)
for name,location in [('three-quarter',(3,-4,2.4)),('side',(0,-5,1.1))]:
    camera.location=location;camera.rotation_euler=(Vector((0,0,.29))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.join(ROOT,'.browser-checks',('coupe' if kind=='racer' else kind)+'-'+name+'.png')
    bpy.ops.render.render(write_still=True)
