"""Rebuild editable toy assets with Blender 4.5, then export web-ready GLBs.
Run: blender --background --python scripts/build_models.py
All outputs are inside this repository; no external add-ons or textures required.
"""
import bpy, math, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'models')
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(ROOT, 'art'), exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def mat(name, hex_color, roughness=.45, metallic=0):
    rgb = tuple(int(hex_color[i:i+2], 16) / 255 for i in (0, 2, 4))
    linear = tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb)
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*linear, 1)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*linear, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return material

cream = mat('Ceramic ivory', 'efeada', .6)
asphalt = mat('Asphalt blue slate', '435b67', .95)
rail = mat('Painted mint rail', '91b8aa', .5)
rubber = mat('Tyre rubber', '273b40', .9)
glass = mat('Opaque blue glass', '385a72', .18, .12)
chrome = mat('Wheel hubs', 'c4d9da', .35, .4)
white = mat('Warm white trim', 'f7efd5', .5)
lamp = mat('Headlamp', 'ffdf9c', .25)
redlamp = mat('Tail lamp', 'df7460', .35)
yellow = mat('Barrier orange', 'e7af6c', .5)
bed = mat('Pickup bed', '526263', .8)
wheel_material = mat('Rolling wheels', 'ffffff', .72, .05)
wheel_bsdf=wheel_material.node_tree.nodes.get('Principled BSDF')
wheel_colour=wheel_material.node_tree.nodes.new('ShaderNodeVertexColor')
wheel_colour.layer_name='Col'
wheel_material.node_tree.links.new(wheel_colour.outputs['Color'],wheel_bsdf.inputs['Base Color'])
foliage=mat('Garden foliage','688a68',.95)
terracotta=mat('Terracotta','c38765',.95)
streetlamp=mat('Streetlamp glow','ffe7af',.3)
drain=mat('Drain metal','34434a',.85)
pavement=mat('Concrete apron','b8c1b9',.98)
objects = []

def cube(name, position, size, material, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new('Soft toy edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    mod = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    bpy.ops.object.modifier_apply(modifier=mod.name)
    objects.append(obj)
    return obj

def cylinder(name, position, radius, depth, material, axis='Z'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=radius, depth=depth, location=position)
    obj = bpy.context.object
    obj.name = name
    if axis == 'Y': obj.rotation_euler.x = math.pi / 2
    if axis == 'X': obj.rotation_euler.y = math.pi / 2
    obj.data.materials.append(material)
    mod = obj.modifiers.new('Tyre edge', 'BEVEL'); mod.width=.025; mod.segments=2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for polygon in obj.data.polygons: polygon.use_smooth=True
    objects.append(obj)
    return obj

def export(name):
    # Merge by material to keep mobile draw calls low.
    merged=[]
    batches={}
    for obj in objects: batches.setdefault(obj.data.materials[0],[]).append(obj)
    for material,batch in batches.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in batch: obj.select_set(True)
        bpy.context.view_layer.objects.active=batch[0]
        bpy.ops.object.join()
        batch[0].name=material.name
        merged.append(batch[0])
    objects[:]=merged
    bpy.ops.object.select_all(action='DESELECT')
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    for obj in objects:
        for parent in list(obj.users_collection): parent.objects.unlink(obj)
        collection.objects.link(obj)
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name+'.glb'), export_format='GLB', use_selection=True, export_yup=True)
    return list(objects)

def wheel_colourize(obj, colour):
    layer=obj.data.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER')
    for element in layer.data: element.color=colour.diffuse_color
    obj.data.materials.clear();obj.data.materials.append(wheel_material)
    return obj

def car(kind, length, colour):
    objects.clear()
    paint = mat('Paint '+kind, colour, .3, .04)
    tall = kind in ('schoolbus', 'coach', 'camper', 'delivery')
    cube('Chassis', (0,0,.22), (length-.16,.82,.25), paint, .09)
    if kind == 'racer':
        cube('Low sporty cabin', (-.12,0,.47), (.9,.67,.32), glass, .09)
        cube('Sport roof', (-.2,0,.65), (.43,.62,.04), paint, .025)
        cube('Rear spoiler', (-length/2+.2,0,.45), (.12,.92,.055), white, .025)
        for y in (-.12,.12): cube('Racing stripe', (.6,y,.355), (.5,.055,.012), white, .005)
    elif kind == 'pickup':
        cube('Cab glass', (.39,0,.49), (.62,.69,.38), glass, .08)
        cube('Cab roof', (.3,0,.7), (.46,.73,.055), paint)
        cube('Cargo floor', (-.47,0,.36), (.8,.65,.06), bed, .025)
        for y in (-.35,.35): cube('Cargo sides', (-.47,y,.47), (.87,.07,.23), paint, .025)
        cube('Tailgate', (-.89,0,.47), (.07,.74,.23), paint, .025)
    elif kind in ('schoolbus','coach'):
        cube('Passenger cabin', (-.1,0,.62), (length-.55,.76,.7), paint, .08)
        for x in [i*.38-length/2+.45 for i in range(6)]:
            for y in (-.389,.389): cube('Passenger window', (x,y,.73), (.26,.02,.28), glass, .025)
        cube('Front windshield', (length/2-.36,0,.75), (.045,.66,.34), glass, .025)
        cube('Rear windshield', (-length/2+.18,0,.73), (.025,.55,.27), glass, .025)
        if kind == 'coach': cube('Roof air conditioner', (-.4,0,1.0), (.6,.47,.12), white)
        else:
            for y in (-.39,.39): cube('School stripe', (-.12,y,.46), (length-.6,.015,.07), rubber, .006)
    elif kind == 'delivery':
        cube('Truck cab', (.91,0,.57), (.55,.74,.55), paint, .06)
        cube('Windshield', (1.16,0,.66), (.025,.61,.25), glass, .02)
        cube('Cargo box', (-.45,0,.67), (1.78,.8,.95), white, .045)
        for z in (.35,.5,.65,.8,.95):
            for y in (-.411,.411): cube('Cargo seams', (-.45,y,z), (1.6,.012,.012), chrome, .003)
    elif kind == 'camper':
        cube('Camper shell', (-.25,0,.65), (length-.6,.82,.85), white, .11)
        cube('Driver glass', (length/2-.25,0,.66), (.05,.63,.38), glass, .035)
        for y in (-.42,.42):
            cube('Camper window', (-.45,y,.74), (.49,.025,.32), glass)
            cube('Camper colour stripe', (-.25,y,.42), (length-.8,.02,.13), paint, .015)
        cube('Roof skylight', (-.4,0,1.1), (.43,.38,.035), glass, .04)
    else:
        cabin_height = .47 if kind == 'jeep' else .32
        cube('Cabin glass', (-.15,0,.5), (1.12,.67,cabin_height), glass, .095)
        cube('Cabin roof', (-.25,0,.5+cabin_height/2+.02), (.55,.73,.06), paint, .035)
        if kind == 'jeep':
            cylinder('Rear spare tyre', (-length/2+.02,0,.47), .2,.12,rubber,'X')
            for y in (-.2,.2): cube('Roof rack', (-.25,y,.8), (.62,.06,.06), chrome, .02)
        if kind == 'taxi': cube('Taxi roof sign', (-.12,0,.75), (.32,.26,.12), lamp, .025)
    # Small readable details share existing material batches, rather than extra draw calls.
    mirror_x = .82 if tall else .28
    for y in (-.47,.47):
        cube('Side mirror', (mirror_x,y,.59 if tall else .49), (.16,.085,.075), chrome, .018)
        cube('Door handle', (.15,y*.89,.43), (.12,.023,.025), chrome, .008)
    if not tall:
        for y in (-.417,.417):
            cube('Door seam', (-.36,y,.33), (.015,.015,.16), rubber, .003)
        if kind == 'racer':
            for y in (-.19,.19): cube('Hood vent', (.64,y,.367), (.22,.07,.016), rubber, .008)
            cube('Front splitter', (.91,0,.125), (.13,.76,.035), rubber, .01)
        elif kind == 'jeep':
            for y in (-.18,-.09,0,.09,.18): cube('Jeep grille', (.927,y,.32), (.02,.036,.13), rubber, .005)
        elif kind == 'pickup':
            for y in (-.18,0,.18): cube('Bed plank', (-.5,y,.402), (.63,.11,.04), cream, .01)
        elif kind == 'taxi':
            for x in (-.55,-.35,-.15,.05,.25):
                for y in (-.424,.424): cube('Taxi checker', (x,y,.32), (.1,.016,.065), white, .004)
        else:
            for y in (-.342,.342): cube('Window pillar', (-.15,y,.51), (.055,.035,.29), paint, .01)
    elif kind in ('schoolbus','coach'):
        cube('Passenger door', (.8,-.403,.59), (.26,.021,.46), glass, .022)
        cube('Door divider', (.8,-.42,.59), (.018,.018,.46), chrome, .004)
        cube('Destination board', (1.166,0,.98), (.03,.44,.09), rubber, .012)
        for y in (-.12,-.04,.04,.12): cube('Destination lettering', (1.19,y,.982), (.014,.038,.04), lamp, .003)
    elif kind == 'delivery':
        for y in (-.2,.2):
            cube('Rear cargo door', (-1.353,y,.67), (.014,.37,.78), chrome, .016)
            cube('Rear door latch', (-1.368,y,.64), (.018,.025,.4), rubber, .005)
        for y in (-.416,.416):
            cube('Cargo label', (-.45,y,.72), (.5,.018,.26), paint, .02)
            cube('Cargo label bar', (-.45,y*1.027,.72), (.27,.014,.035), white, .006)
    elif kind == 'camper':
        cube('Living door', (.38,-.431,.65), (.32,.022,.63), cream, .028)
        cube('Door window', (.38,-.45,.79), (.22,.02,.2), glass, .016)
        cube('Door handle', (.48,-.468,.57), (.035,.025,.08), chrome, .008)
        cube('Roof luggage', (.24,0,1.105), (.38,.42,.15), paint, .04)
    cube('Rear plate', (-length/2+.055,0,.24), (.026,.24,.09), white, .007)
    for y in (-.075,-.025,.025,.075): cube('Plate marks', (-length/2+.035,y,.24), (.012,.025,.047), rubber, .002)
    for x in (-length/2+.33, length/2-.34):
        for y in (-.43,.43):
            wheel_colourize(cylinder('Wheel', (x,y,.19), .19,.13,rubber,'Y'),rubber)
            wheel_colourize(cylinder('Hub', (x,y*1.13,.19), .09,.025,chrome,'Y'),chrome)
            wheel_colourize(cube('Wheel spoke',(x,y*1.16,.19),(.135,.018,.024),white,.004),white)
            wheel_colourize(cube('Wheel spoke',(x,y*1.16,.19),(.024,.018,.135),white,.004),white)
    for y in (-.26,.26):
        cube('Headlight', (length/2-.065,y,.3), (.022,.15,.09), lamp, .02)
        cube('Taillight', (-length/2+.065,y,.3), (.022,.13,.07), redlamp, .018)
    cube('Front bumper', (length/2-.06,0,.18), (.055,.57,.08), chrome, .025)
    exported = export(kind)
    return exported

assets = []
for index,(kind,length,colour) in enumerate([
    ('racer',2,'e53935'),('jeep',2,'43a047'),('pickup',2,'fb8c00'),('compact',2,'38bdf8'),('taxi',2,'ec4899'),
    ('schoolbus',3,'fdd835'),('coach',3,'2563eb'),('camper',3,'059669'),('delivery',3,'9333ea')]):
    group=car(kind,length,colour)
    assets.append((group,(index%3)*4,(index//3)*4))

objects.clear()
cube('Garage foundation',(3,-3,-.23),(6.55,6.55,.46),cream,.15)
cube('Asphalt',(3,-3,.018),(6.02,6.02,.035),asphalt,.075)
cube('Exit road',(6.7,-2.5,-.03),(1.55,1.02,.15),asphalt,.065)
for y in (-1.93,-3.07): cube('Road curb',(6.7,y,-.02),(1.65,.16,.22),cream,.06)
for x in (.0,6):
    ranges=[(-.07,-1.88),(-3.13,-6.0)] if x==6 else [(-.07,-6.0)]
    for start,end in ranges:
        for y in (start,end): cylinder('Rail post',(x,y,.19),.07,.38,rail)
        cube('Side rail',(x,(start+end)/2,.34),(.09,abs(end-start),.09),white,.04)
for y in (0,-6):
    for x in (0,2,4,6): cylinder('Rail post',(x,y,.19),.07,.38,rail)
    cube('Horizontal rail',(3,y,.34),(6.05,.09,.09),white,.04)
for row in range(6):
    for col in range(6):
        for dx,dy in ((.08,-.08),(.92,-.92)):
            cube('Bay corner',(col+dx,-row+dy,.042),(.11,.016,.008),white,.002)
            cube('Bay corner',(col+dx,-row+dy,.042),(.016,.11,.008),white,.002)
cube('Gate control',(6.43,-1.81,.25),(.25,.27,.5),cream,.06)
cube('Gate display',(6.43,-1.663,.34),(.13,.016,.16),glass,.02)
cube('Exit sign post',(6.96,-1.61,.36),(.06,.06,.72),rail,.02)
cube('Exit sign',(6.96,-1.61,.73),(.64,.08,.28),rail,.055)
# Simple raised arrow in the sign face.
cube('Arrow',(6.94,-1.658,.73),(.31,.012,.035),white,.008)
for angle in (-.7,.7):
    obj=cube('Arrow tip',(7.07,-1.66,.73),(.15,.012,.035),white,.007); obj.rotation_euler.y=angle
# A continuous apron supports the scenery; the puzzle remains slightly raised.
cube('Surrounding pavement',(3.25,-3,-.15),(8.8,6.7,.18),pavement,.1)
scenery_start=len(objects)
# Small surroundings stay outside the playable grid and exit lane.
cube('Caretaker booth',(-.73,-1.45,.35),(.62,.68,.7),rail,.06)
cube('Booth roof',(-.73,-1.45,.76),(.76,.82,.13),cream,.05)
cube('Booth window',(-.406,-1.45,.48),(.018,.46,.27),glass,.025)
cube('Booth door',(-.73,-1.097,.34),(.33,.018,.53),cream,.025)
cube('Booth handle',(-.64,-1.08,.35),(.04,.025,.08),chrome,.008)
for x,y in ((-.65,-5.3),(6.8,-.62)):
    cylinder('Flower pot',(x,y,.12),.18,.24,terracotta)
    for dx,dy,dz in ((0,0,.36),(.13,0,.3),(-.09,.09,.31)):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.19,location=(x+dx,y+dy,dz))
        obj=bpy.context.object;obj.name='Plant';obj.data.materials.append(foliage);objects.append(obj)
for x,y in ((6.8,-4.35),(7.14,-4.7)):
    cube('Cone foot',(x,y,.045),(.28,.28,.09),rubber,.025)
    bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.11,radius2=.025,depth=.32,location=(x,y,.24))
    obj=bpy.context.object;obj.name='Traffic cone';obj.data.materials.append(yellow);objects.append(obj)
    cylinder('Cone stripe',(x,y,.25),.071,.045,white)
for x,y in ((-.7,-.2),(6.65,-5.45)):
    cylinder('Lamp post',(x,y,.63),.032,1.26,drain)
    cube('Lamp cap',(x,y,1.29),(.3,.25,.09),rail,.035)
    cube('Lamp diffuser',(x,y,1.23),(.24,.2,.04),streetlamp,.015)
cube('Drain grate',(5.6,-5.77,.04),(.56,.19,.009),drain,.012)
for x in (5.4,5.5,5.6,5.7,5.8):cube('Drain slot',(x,-5.77,.048),(.028,.145,.01),chrome,.002)
for obj in objects[scenery_start:]:
    if not obj.name.startswith('Drain'):obj.location.z-=.06
garage=export('garage')
for group,x,y in assets:
    for obj in group: obj.location.x += x+10; obj.location.y += y
# Save the editable source with all original asset meshes and materials.
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','toy-garage.blend'))
print('MODEL_BUILD_COMPLETE', OUT)
