"""Rebuild editable toy assets with Blender 4.5, then export web-ready GLBs.
Run: blender --background --python scripts/build_models.py
All outputs are inside this repository; no external add-ons or textures required.
"""
import bpy, bmesh, math, os
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
glass = mat('Automotive glass', 'e7eff1', .003)
glass_bsdf = glass.node_tree.nodes.get('Principled BSDF')
glass_bsdf.inputs['Transmission Weight'].default_value = 1
glass_bsdf.inputs['IOR'].default_value = 1.48
panel_glass = mat('Smoked panel glass', '263b46', .12, .12)
mirror_glass = mat('Mirror silver', 'dde5e8', .055, 1)
upholstery = mat('Cabin upholstery', '34353a', .86)
seat_trim = mat('Seat stitching and console', '887767', .75)
leather = mat('Tailored cabin leather', 'ffffff', .65)
leather_colour=leather.node_tree.nodes.new('ShaderNodeVertexColor')
leather_colour.layer_name='Col'
leather.node_tree.links.new(leather_colour.outputs['Color'],leather.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
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
leaf_light=mat('Sunlit foliage','7b966d',.95)
leaf_dark=mat('Shaded foliage','526e58',.95)
terracotta=mat('Terracotta','c38765',.95)
streetlamp=mat('Streetlamp glow','ffe7af',.3)
drain=mat('Drain metal','34434a',.85)
pavement=mat('Concrete apron','b8c1b9',.98)
street=mat('Street asphalt','657071',.95)
stone=mat('Sidewalk stone','aeb6ac',.95)
wood=mat('Weathered wood','a58b6c',.85)
awning=mat('Canvas awning','a19e78',.9)
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
        # Subpixel trim does not need the same bevel tessellation as the silhouette.
        mod.segments = 3 if bevel>=.05 else 2 if bevel>=.025 else 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    mod = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    bpy.ops.object.modifier_apply(modifier=mod.name)
    objects.append(obj)
    if name in ('Coupe mirror','Body coloured mirror','Motorhome mirror','Pickup mirror','Commercial mirror'):
        # The reflective lens faces rearward; inset within the housing rim.
        cube('Mirror optical face',(position[0]-size[0]/2-.002,position[1],position[2]),
             (.004,size[1]*.74,size[2]*.67),mirror_glass,.003)
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
        if name in ('racer','compact','jeep','coach','schoolbus','delivery','taxi','pickup','camper'):bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
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
    # Publish a complete GLB at once; dev-server reads cannot see a partial export.
    staged_path=os.path.join(ROOT,'art',name+'.export.glb')
    bpy.ops.export_scene.gltf(filepath=staged_path, export_format='GLB', use_selection=True, export_yup=True)
    os.replace(staged_path,os.path.join(OUT,name+'.glb'))
    return list(objects)

def wheel_colourize(obj, colour):
    layer=obj.data.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER')
    for element in layer.data: element.color=colour.diffuse_color
    obj.data.materials.clear();obj.data.materials.append(wheel_material)
    return obj

def wheel_ring(name,x,y,radius,tube,material):
    bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=6,
        major_radius=radius,minor_radius=tube,location=(x,y,.19),rotation=(math.pi/2,0,0))
    obj=bpy.context.object;obj.name=name;obj.data.materials.append(material)
    for polygon in obj.data.polygons:polygon.use_smooth=True
    objects.append(obj)
    return wheel_colourize(obj,material)

def panel_seam(body,name,points,side=None):
    # Project small seams onto the actual rounded shell, rather than floating lines.
    projected=[]
    for a,b in zip(points,points[1:]):
        for i in range(6):
            p=Vector(a).lerp(Vector(b),i/6)
            origin=Vector((p.x,side*2,p.z)) if side else Vector((p.x,p.y,2))
            direction=Vector((0,-side,0)) if side else Vector((0,0,-1))
            hit,point,normal,index=body.ray_cast(origin,direction)
            if hit:projected.append(point+normal*.0015)
    for a,b in zip(projected,projected[1:]):
        if (b-a).length<.15:strut(name,a,b,.0028,rubber)

def shaped_cabin(name,position,size,material,taper=.68):
    obj=cube(name,position,size,material,0)
    for vertex in obj.data.vertices:
        if vertex.co.z>0:vertex.co.x*=taper;vertex.co.y*=.88
    obj.data.update()
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.delete(bm,geom=[face for face in bm.faces if abs(face.normal.z)>.7],context='FACES')
    bm.to_mesh(obj.data);bm.free()
    mod=obj.modifiers.new('Rounded glass edges','BEVEL');mod.width=.045;mod.segments=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=obj.modifiers.new('Glass normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

def coachwork(kind, length, material):
    # Lofted cross-sections: a curved bonnet, shoulders and tapered nose instead of a box.
    profiles = {
        'racer': [(-.92,.31,.28),(-.76,.42,.35),(-.40,.42,.365),(.18,.40,.35),(.48,.385,.32),(.73,.35,.29),(.92,.30,.23)],
        'compact': [(-.92,.29,.31),(-.67,.40,.39),(-.22,.41,.39),(.35,.39,.37),(.72,.34,.32),(.92,.26,.25)],
        'taxi': [(-.92,.30,.30),(-.7,.40,.36),(-.25,.41,.38),(.35,.40,.36),(.72,.35,.32),(.92,.29,.26)],
        'jeep': [(-.92,.35,.33),(-.70,.41,.39),(-.25,.41,.40),(.35,.41,.39),(.72,.40,.36),(.92,.34,.31)],
        'pickup': [(-.92,.31,.32),(-.70,.40,.38),(-.25,.40,.39),(.35,.40,.38),(.72,.37,.35),(.92,.31,.29)],
    }
    sections=profiles.get(kind)
    if not sections:
        return cube('Commercial chassis',(0,0,.22),(length-.16,.82,.25),material,.09)
    vertices=[]
    for x,width,top in sections:
        # Eight-sided shoulder section keeps broad highlights and a rounded silhouette.
        vertices.extend([(x,-width*.82,.095),(x,-width,.14),(x,-width,top-.07),(x,-width*.79,top),
                         (x,width*.79,top),(x,width,top-.07),(x,width,.14),(x,width*.82,.095)])
    faces=[tuple(range(7,-1,-1))]
    for i in range(len(sections)-1):
        for j in range(8):faces.append((i*8+j,i*8+(j+1)%8,(i+1)*8+(j+1)%8,(i+1)*8+j))
    faces.append(tuple(range((len(sections)-1)*8,len(sections)*8)))
    mesh=bpy.data.meshes.new('Sculpted body mesh');mesh.from_pydata(vertices,[],[tuple(reversed(face)) for face in faces]);mesh.update()
    obj=bpy.data.objects.new('Sculpted '+kind+' body',mesh);bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material);objects.append(obj)
    bpy.context.view_layer.objects.active=obj
    bevel=obj.modifiers.new('Body highlight edges','BEVEL');bevel.width=.045;bevel.segments=3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for polygon in mesh.polygons:polygon.use_smooth=True
    normal=obj.modifiers.new('Coachwork normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=normal.name)
    return obj

def wheel_arch(x,y,material,body=None):
    # An open semicircular fender, not a solid disc covering the tyre.
    vertices=[];faces=[];attached=[]
    for i in range(13):
        angle=math.pi*i/12
        for r in (.209 if body else .204,.239):
            vx,vz=x+math.cos(angle)*r,.19+math.sin(angle)*r
            vy=y
            hit=True
            if body:
                side=1 if y>0 else -1
                hit,point,normal,index=body.ray_cast(Vector((vx,side*2,vz)),Vector((0,-side,0)))
                if hit:vy=point.y+side*.007
            vertices.append((vx,vy,vz))
            attached.append(hit)
    for i in range(12):
        face=(i*2,i*2+1,i*2+3,i*2+2)
        if all(attached[j] for j in face):faces.append(face)
    mesh=bpy.data.meshes.new('Fender arc');mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new('Wheel arch',mesh);bpy.context.collection.objects.link(obj);mesh.materials.append(material)
    objects.append(obj);bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('Fender thickness','SOLIDIFY');mod.thickness=.018;bpy.ops.object.modifier_apply(modifier=mod.name)

def surface(name,vertices,faces,material,subdivide=0):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);mesh.materials.append(material);objects.append(obj)
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    bpy.context.view_layer.objects.active=obj
    if subdivide:
        mod=obj.modifiers.new('Continuous sculpted curves','SUBSURF');mod.levels=subdivide
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for face in obj.data.polygons:face.use_smooth=True
    if material==glass:
        # Seal each exposed perimeter using the exact glazing vertices, including
        # intermediate curve samples. No straight trim spanning a curved window.
        edges={}
        for face in faces:
            for a,b in zip(face,face[1:]+face[:1]):
                edge=tuple(sorted((a,b)));edges[edge]=edges.get(edge,0)+1
        for (a,b),count in edges.items():
            if count==1:strut('Bonded glazing gasket',vertices[a],vertices[b],.011,rubber)
    return obj

def ribbon(name,sections,material):
    vertices=[]
    for x,width,z in sections:
        for t in (-1,-.5,0,.5,1):vertices.append((x,width*t,z+.008*(1-t*t)))
    faces=[]
    for i in range(len(sections)-1):
        for j in range(4):faces.append((i*5+j,i*5+j+1,(i+1)*5+j+1,(i+1)*5+j))
    return surface(name,vertices,faces,material)

def strut(name,a,b,width,material):
    direction=Vector(b)-Vector(a)
    obj=cube(name,(Vector(a)+Vector(b))/2,(direction.length,width,width),material,width*.25)
    obj.rotation_euler=direction.to_track_quat('X','Z').to_euler();return obj

def glazing_pillar(name,sections,side,width,paint):
    for a,b in zip(sections,sections[1:]):
        strut(name,(a[0],side*a[1],a[2]),(b[0],side*b[1],b[2]),width,paint)
    for x,w,z in sections[1:-1]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=width*.54,location=(x,side*w,z))
        joint=bpy.context.object;joint.name='Continuous pillar joint';joint.data.materials.append(paint);objects.append(joint)
        for polygon in joint.data.polygons:polygon.use_smooth=True

def clip_window(points,x,keep_front):
    result=[]
    for a,b in zip(points,points[1:]+points[:1]):
        ina=(a[0]>=x) if keep_front else (a[0]<=x)
        inb=(b[0]>=x) if keep_front else (b[0]<=x)
        if ina:result.append(a)
        if ina!=inb:
            t=(x-a[0])/(b[0]-a[0]);result.append(tuple(a[i]+t*(b[i]-a[i]) for i in range(3)))
    return result

def divided_side_window(name,points,split,side,paint,width=.050):
    # A structural opaque strip occupies a real gap between separate panes.
    for label,front,x in [('Front door glass',True,split+width/2),('Rear quarter glass',False,split-width/2)]:
        pane=clip_window(points,x,front)
        if len(pane)>=3:surface(label,pane,[tuple(range(len(pane)))],glass)
    pillar=clip_window(clip_window(points,split-width/2,True),split+width/2,False)
    if len(pillar)>=3:
        pillar=[(x,y+side*.008,z) for x,y,z in pillar]
        surface(name+' B pillar',pillar,[tuple(range(len(pillar)))],paint)
        lower=min(pillar,key=lambda p:p[2]);upper=max(pillar,key=lambda p:p[2])
        strut(name+' structural pillar',lower,upper,width*.65,paint)

def cut_opening(target,name,pos,size):
    cutter=cube('Temporary '+name,pos,size,rubber,0);objects.remove(cutter)
    bpy.context.view_layer.objects.active=target
    mod=target.modifiers.new(name,'BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)

def framed_entry(x,bottom,top,width,paint,side_y=-.44,floor_height=None):
    # Recessed closed door: framed glazing above a solid kick panel, with steps behind.
    z=(bottom+top)/2
    for dx in (-width/2,width/2):cube('Entry jamb',(x+dx,side_y,z),(.030,.048,top-bottom+.035),rubber,.004)
    for h in (bottom,top):cube('Entry header' if h==top else 'Entry threshold',(x,side_y,h),(width+.03,.05,.025),chrome,.004)
    cube('Entry kick panel',(x,side_y+.018,bottom+.135),(width-.04,.018,.24),paint,.008)
    for dx in (-width*.23,width*.23):
        cube('Entry door glazing',(x+dx,side_y+.024,(bottom+.27+top)/2),(width*.42,.007,top-bottom-.30),glass,.006)
    cube('Entry centre seal',(x,side_y+.008,z),(.018,.025,top-bottom),rubber,.003)
    cube('Entry glass rail',(x,side_y+.005,bottom+.27),(width,.023,.020),rubber,.003)
    floor_height=bottom+.164 if floor_height is None else floor_height
    for h,y in ((bottom+.025,side_y+.07),((bottom+floor_height)/2-.0125,side_y+.15),(floor_height-.0125,side_y+.23)):
        cube('Recessed entry tread',(x,y,h),(width-.05,.14,.025),upholstery,.003)
        cube('Entry tread nosing',(x,y-.07,h+.014),(width-.06,.012,.007),chrome,.002)
    cube('Entry grab rail',(x-width*.35,side_y+.19,top-.18),(.016,.016,.27),chrome,.004)

def open_cabin_tub(body,kind):
    # The exterior shell used to remain solid up to the seat cushions.
    # Carve a real passenger well before adding a separate carpeted floor.
    centre,length,bottom=( -.10,.72,.225) if kind=='racer' else ( .18,.78,.285) if kind=='pickup' else (1.04,.78,.375) if kind=='camper' else (-.18,1.04,.285 if kind=='jeep' else .255)
    cutter=cube('Temporary passenger well',(centre,0,bottom+.40),(length,.54,.80),rubber,.025)
    objects.remove(cutter);bpy.context.view_layer.objects.active=body
    mod=body.modifiers.new('Recessed passenger cell','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)

def cabin_foundation(seat_x,cushion_z,dash_x,kind,width=.52):
    floor_z=cushion_z-(.12 if kind=='racer' else .15)
    # Visible gaps below individual seats; no continuous platform at cushion height.
    rear=seat_x-.22;front=dash_x+.015
    cube('Recessed carpeted floor',((rear+front)/2,0,floor_z),
         (front-rear,width,.012),upholstery,.004)
    cube('Transmission tunnel',((seat_x+dash_x)/2,0,floor_z+.025),
         (dash_x-seat_x+.15,.057,.053),upholstery,.010)
    for side in (-1,1):
        y=side*(.18 if width>.53 else .145)
        for offset in (-.062,.062):
            cube('Separate seat runner',(seat_x,y+offset,floor_z+.018),(.23,.015,.022),chrome,.003)
        for x in (seat_x-.065,seat_x+.055):
            cube('Seat mounting pedestal',(x,y,(floor_z+cushion_z-.026)/2),
                 (.037,.12,cushion_z-.026-floor_z),upholstery,.006)
        foot_x=(seat_x+.135+dash_x)/2
        cube('Individual recessed foot mat',(foot_x,y,floor_z+.008),
             (max(.08,dash_x-seat_x-.135),.19,.005),rubber,.002)
        # Toe board encloses the front of the well instead of a floating dash.
        toe=cube('Sloped toe board',(dash_x+.017,y,floor_z+.052),(.035,.22,.10),upholstery,.007)
        toe.rotation_euler.y=-.25
        for i in range(3):
            cube('Foot mat rib',(foot_x-.04+i*.035,y,floor_z+.012),(.003,.145,.002),seat_trim,0)
    for py,w in ((-.178,.026),(-.122,.018)):
        pedal=cube('Pedal pad',(dash_x-.032,py,floor_z+.049),(.009,w,.032),chrome,.003)
        pedal.rotation_euler.y=-.3
        strut('Pedal arm',(dash_x+.012,py,floor_z+.09),(dash_x-.029,py,floor_z+.05),.006,upholstery)
    for side in (-1,1):
        cube('Inner door sill',((rear+front)/2,side*(width/2+.016),floor_z+.055),
             (front-rear,.028,.095),upholstery,.012)

def leather_piece(obj,kind):
    # Vertex colours let different cabin palettes share one material/draw call.
    palette={'racer':'a76843','jeep':'91846b','pickup':'8b6950','compact':'596e7a','taxi':'8a7660',
             'camper':'b29a78','coach':'667b8b','schoolbus':'73675a','delivery':'65717b'}
    rgb=[int(palette[kind][i:i+2],16)/255 for i in (0,2,4)]
    colour=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb]
    layer=obj.data.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER')
    for element in layer.data:element.color=(*colour,1)
    return obj

def tailored_seat(x,y,z,height,kind,width=.20):
    sporty=kind=='racer'
    cube('Seat frame and cushion',(x,y,z),(.25,width,.046),upholstery,.023)
    leather_piece(cube('Cushion centre insert',(x+.006,y,z+.025),(.19,width*.64,.017),leather,.008),kind)
    # Closed, lofted backrest: narrow waist, broad shoulders and a reclining crown.
    profiles=[(0,.77,0),(.18,.84,-.007),(.52,.75,-.018),(.80,1,-.035),(1,.83,-.045)]
    vertices=[]
    for t,w,recline in profiles:
        bx=x-.096+recline;bz=z+.02+height*t;hw=width*w/2
        vertices.extend([(bx-.023,y-hw*.8,bz),(bx-.012,y-hw,bz),(bx+.020,y-hw*.80,bz),
                         (bx+.025,y+hw*.80,bz),(bx-.012,y+hw,bz),(bx-.023,y+hw*.8,bz)])
    faces=[tuple(range(5,-1,-1))]
    for i in range(len(profiles)-1):
        for j in range(6):faces.append((i*6+j,i*6+(j+1)%6,(i+1)*6+(j+1)%6,(i+1)*6+j))
    faces.append(tuple(range(24,30)))
    surface('Contoured seat shell',vertices,faces,upholstery,1)
    # Padded back insert follows the actual reclining surface.
    for i,(a,b) in enumerate(zip(profiles,profiles[1:])):
        verts=[]
        for t,w,recline in (a,b):
            for side in (-1,1):verts.append((x-.069+recline,y+side*width*.29*w,z+.02+height*t))
        leather_piece(surface('Tailored backrest insert',verts,[(0,1,3,2)],leather),kind)
        for side in (-1,1):
            strut('Backrest piping',verts[0 if side<0 else 1],verts[2 if side<0 else 3],.003,seat_trim)
    for side in (-1,1):
        bolster=cube('Raised seat bolster',(x,y+side*width*.43,z+.038),(.23,.029,.038),upholstery,.014)
        strut('Cushion seam',(x-.085,y+side*width*.31,z+.034),(x+.085,y+side*width*.31,z+.034),.003,seat_trim)
    for i in range(4):
        sx=x-.06+i*.035
        strut('Cushion tailoring',(sx,y-width*.26,z+.035),(sx,y+width*.26,z+.035),.0018,seat_trim)
    # Headrest is supported by two posts rather than floating above the seat.
    for side in (-1,1):
        strut('Headrest stem',(x-.14,y+side*.028,z+height),(x-.14,y+side*.028,z+height+.047),.006,chrome)
    leather_piece(cube('Padded head restraint',(x-.142,y,z+height+.051),(.046,width*.57,.047),leather,.017),kind)
    cube('Seatbelt buckle',(x-.015,y+(.115 if y<0 else -.115),z+.016),(.024,.014,.025),rubber,.004)
    cube('Buckle release button',(x-.015,y+(.115 if y<0 else -.115),z+.031),(.018,.011,.005),redlamp,.002)

def cockpit_controls(x,z,driver_y,kind,width=.47):
    cube('Wrapped dashboard lower',(x,0,z-.018),(.13,width,.053),upholstery,.020)
    # Overlapping flowing upper and lower surfaces replace the rectangular bar.
    ribbon('Swept dashboard cap',[(x-.082,width*.46,z+.006),(x-.038,width*.51,z+.03),
                                (x+.055,width*.47,z+.031),(x+.09,width*.43,z+.002)],upholstery)
    cube('Satin dashboard fascia',(x-.073,0,z),(.008,width*.89,.006),chrome,.002)
    # Two cockpit zones: instrument pod on the left, layered passenger shelf
    # and glovebox on the right, connected by a narrow falling centre stack.
    leather_piece(cube('Passenger dashboard insert',(x-.072,width*.22,z-.015),
                       (.008,width*.33,.035),leather,.004),kind)
    cube('Glovebox lower panel',(x-.066,width*.25,z-.041),(.016,width*.38,.025),upholstery,.005)
    cube('Glovebox release',(x-.076,width*.23,z-.034),(.003,.033,.005),chrome,.001)
    for side in (-1,1):
        strut('Dashboard stitched brow',(x-.04,side*width*.12,z+.033),
              (x-.04,side*width*.43,z+.033),.002,seat_trim)
    stack=cube('Sloping centre stack',(x-.075,0,z-.038),(.018,.066,.076),upholstery,.006)
    stack.rotation_euler.y=-.25
    for vy in (-width*.40,-.065,.065,width*.40):
        cube('Inset air vent',(x-.082,vy,z+.013),(.009,.049,.019),rubber,.003)
        for offset in (-.014,0,.014):
            cube('Vent vane',(x-.088,vy+offset,z+.013),(.003,.002,.013),chrome,.001)
    cube('Instrument hood',(x-.060,driver_y,z+.040),(.065,.112,.033),upholstery,.012)
    cube('Recessed instrument display',(x-.094,driver_y,z+.035),(.003,.090,.023),panel_glass,.003)
    for dy in (-.023,.023):
        cylinder('Gauge bezel',(x-.097,driver_y+dy,z+.036),.009,.002,chrome,'X')
        strut('Gauge needle',(x-.099,driver_y+dy-.004,z+.033),(x-.099,driver_y+dy+.004,z+.041),.002,white)
    screen=cube('Centre infotainment screen',(x-.081,0,z+.025),(.008,.073,.045),rubber,.005)
    cube('Infotainment glass',(x-.087,0,z+.025),(.002,.062,.032),panel_glass,.002)
    for i in range(3):cube('Display graphic',(x-.089,-.018+i*.016,z+.025),(.001,.009,.003+i*.005),chrome,.001)
    for dy in (-.027,.027):cylinder('Climate rotary dial',(x-.088,dy,z-.015),.008,.005,chrome,'X')
    wx=x-.117;wz=z+.015;radius=.043 if kind=='racer' else .052
    bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=.007,major_segments=24,minor_segments=6,
        location=(wx,driver_y,wz),rotation=(0,math.pi/2-.25,0))
    wheel=bpy.context.object;wheel.name='Three spoke leather steering rim';wheel.data.materials.append(upholstery);objects.append(wheel)
    for polygon in wheel.data.polygons:polygon.use_smooth=True
    cube('Steering airbag hub',(wx,driver_y,wz),(.019,.035,.027),upholstery,.008)
    for angle in (math.pi/2,math.pi*7/6,math.pi*11/6):
        strut('Satin steering spoke',(wx,driver_y,wz),
              (wx,driver_y+math.sin(angle)*radius*.86,wz+math.cos(angle)*radius*.86),.007,chrome)
    strut('Steering column',(wx+.014,driver_y,wz),(x-.035,driver_y,z-.025),.013,upholstery)

def cockpit(kind):
    """Visible cabin detail, batched by material rather than individual props."""
    sporty=kind=='racer';suv=kind=='jeep';pickup=kind=='pickup'
    seat_x=-.25 if sporty else .12 if pickup else -.21
    floor=.365 if sporty else .46 if suv or pickup else .415
    back_height=.13 if sporty else .20 if not suv else .27
    dash_x=.20 if sporty else .49 if pickup else .24 if suv else .23
    cabin_foundation(seat_x,floor,dash_x,kind)
    for side in (-1,1):
        y=side*.145
        tailored_seat(seat_x,y,floor,back_height,kind)
        door_z=floor-(.065 if sporty else .045)
        cube('Moulded door panel',(seat_x,side*.286,door_z),(.40,.025,.096),upholstery,.015)
        leather_piece(cube('Padded door insert',(seat_x+.005,side*.272,door_z+.008),(.27,.008,.047),leather,.008),kind)
        cube('Door armrest',(seat_x-.015,side*.265,door_z+.012),(.19,.035,.025),upholstery,.009)
        cube('Interior release handle',(seat_x+.10,side*.263,door_z+.037),(.050,.012,.012),chrome,.004)
        cube('Window switch surround',(seat_x+.03,side*.253,door_z+.027),(.04,.017,.005),rubber,.002)
        for dz in (0,.007,.014):
            strut('Door speaker grille',(seat_x+.09,side*.269,door_z-.025+dz),
                  (seat_x+.15,side*.269,door_z-.025+dz),.002,seat_trim)
    dash_z=.412 if sporty else .535 if pickup or suv else .465
    cockpit_controls(dash_x,dash_z,-.145,kind)
    cube('Centre console',(seat_x+.055,0,floor-.01),(.34,.062,.068),upholstery,.016)
    cube('Console inlay',(seat_x+.08,0,floor+.027),(.18,.041,.006),seat_trim,.003)
    cube('Gear selector',(seat_x+.07,0,floor+.047),(.026,.025,.037),chrome,.007)
    for cx in (seat_x-.045,seat_x-.103):
        cylinder('Cupholder recess',(cx,0,floor+.027),.015,.004,rubber)
    leather_piece(cube('Padded centre armrest',(seat_x-.08,0,floor+.033),(.095,.052,.024),leather,.010),kind)
    if not sporty and not pickup:
        cube('Rear seat bench',(-.54 if suv else -.48,0,floor),(.17,.43,.06),upholstery,.025)
        cube('Rear seat back',(-.63 if suv else -.565,0,floor+(.09 if suv else .07)),(.05,.43,.18 if suv else .13),upholstery,.02)
        for side in (-1,1):
            leather_piece(cube('Rear bench cushion insert',(-.54 if suv else -.48,side*.12,floor+.032),(.14,.15,.008),leather,.004),kind)
            leather_piece(cube('Rear backrest insert',(-.601 if suv else -.536,side*.12,floor+(.09 if suv else .07)),(.006,.14,.13 if suv else .085),leather,.004),kind)

def midengine_coupe(paint):
    # A single sculpted shell, with broad wheel shoulders and a low centre bonnet.
    # The reference language is the 296 GTB: wraparound cabin and rear buttresses.
    sections=[(-.965,.30,.285),(-.92,.365,.32),(-.82,.47,.335),(-.67,.54,.338),
              (-.49,.415,.34),(-.28,.365,.345),(-.08,.355,.344),(.12,.36,.34),
              (.32,.385,.325),(.49,.47,.303),(.66,.54,.279),(.79,.47,.251),(.9,.35,.224),(.965,.285,.215)]
    vertices=[]
    for x,w,crown in sections:
        shoulder=crown+.17*math.exp(-((x+.67)/.24)**2)+.25*math.exp(-((x-.66)/.23)**2)
        inner_shoulder=crown+.013+(shoulder-crown)*.62
        if x>0:
            # A gently crowned bonnet connects both fenders; no central trough.
            crown+=.16*math.exp(-((x-.66)/.28)**2)
            shoulder=crown-.010
            inner_shoulder=crown-.003
        vertices.extend([(x,-w*.84,.105),(x,-w,.15),(x,-w,.27 if x<.82 else .20),
                         (x,-w*.93,shoulder),(x,-w*.61,inner_shoulder),(x,0,crown),
                         (x,w*.61,inner_shoulder),(x,w*.93,shoulder),(x,w,.27 if x<.82 else .20),
                         (x,w,.15),(x,w*.84,.105),(x,0,.105)])
    faces=[tuple(range(11,-1,-1))]
    for i in range(len(sections)-1):
        for j in range(12):faces.append((i*12+j,i*12+(j+1)%12,(i+1)*12+(j+1)%12,(i+1)*12+j))
    faces.append(tuple(range((len(sections)-1)*12,len(sections)*12)))
    body=surface('Continuous mid-engine coachwork',vertices,faces,paint,1)
    open_cabin_tub(body,'racer')
    # Actual wheel openings replace the previous applied decorative rings.
    for x in (-.67,.66):
        for side in (-1,1):
            bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=.205,depth=.30,location=(x,side*.44,.19),rotation=(math.pi/2,0,0))
            cutter=bpy.context.object;bpy.context.view_layer.objects.active=body
            mod=body.modifiers.new('Open wheel well','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
            bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
            # A recessed upper liner fills the exposed cavity without closing it.
            vertices=[]
            for i in range(25):
                angle=math.pi*i/24
                for y,r in ((side*.31,.197),(side*.35,.197),(side*.35,.207),(side*.31,.207)):
                    vertices.append((x+math.cos(angle)*r,y,.19+math.sin(angle)*r))
            faces=[]
            for i in range(24):
                for j in range(4):faces.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
            surface('Recessed coupe wheel liner',vertices,faces,rubber)
    panel_seam(body,'Bonnet shut line',[(.33,-.275,0),(.66,-.255,0),(.87,-.20,0),(.89,0,0),(.87,.20,0),(.66,.255,0),(.33,.275,0),(.33,-.275,0)])
    for side in (-1,1):
        panel_seam(body,'Coupe door shut line',[(.23,0,.32),(.24,0,.19),(-.32,0,.18),(-.38,0,.31)],side)
    front_glazing=[(.285,.297,.349),(.19,.275,.448),(.08,.246,.535),(-.015,.216,.581)]
    rear_glazing=[(-.40,.199,.571),(-.49,.219,.478),(-.59,.255,.364)]
    ribbon('Curved wraparound windscreen',front_glazing,glass)
    ribbon('Domed coupe roof',[(-.015,.216,.583),(-.10,.224,.607),(-.27,.220,.604),(-.40,.199,.572)],paint)
    ribbon('Rear glass',rear_glazing,glass)
    for side in (-1,1):
        side_points=[(x,side*w,z) for x,w,z in front_glazing]+[(-.10,side*.224,.607),(-.27,side*.220,.604)]+[(x,side*w,z) for x,w,z in rear_glazing]+[(-.12,side*.315,.348)]
        divided_side_window('Coupe',side_points,-.34,side,rubber,.038)
        glazing_pillar('Swept A pillar',front_glazing,side,.023,paint)
        surface('Integrated rear buttress',[(-.39,side*.211,.575),(-.74,side*.339,.364),(-.78,side*.29,.357),(-.46,side*.203,.457)],[(0,1,2,3)],paint)
        surface('Exterior mirror sail',[(.285,side*.307,.355),(.20,side*.32,.354),(.23,side*.302,.399)],[(0,1,2)],paint)
        cube('Coupe door mirror base',(.23,side*.365,.333),(.10,.032,.029),paint,.007)
        strut('Mirror stem',(.23,side*.368,.334),(.20,side*.408,.351),.018,rubber)
        cube('Coupe mirror',(.19,side*.435,.365),(.135,.068,.053),paint,.016)
        surface('Sculpted side intake',[(-.43,side*.382,.328),(-.19,side*.364,.30),(-.34,side*.379,.225),(-.49,side*.40,.261)],[(0,1,2,3)],rubber)
        cube('Flush door handle',(-.13,side*.36,.31),(.07,.009,.014),chrome,.003)
        led_points=[]
        for x,y in ((.73,.39),(.80,.35),(.86,.30)):
            hit,point,normal,index=body.ray_cast(Vector((x,side*y,2)),Vector((0,0,-1)))
            if not hit:raise RuntimeError('Headlamp must follow the intact fender surface')
            led_points.append((x,side*y,point.z+.010))
        for a,b in zip(led_points,led_points[1:]):
            dx,dy=b[0]-a[0],b[1]-a[1];span=math.hypot(dx,dy);nx,ny=-dy/span,dx/span
            for label,width,offset,material in [('Inset lamp surround',.026,-.003,rubber),('Sculpted LED signature',.013,.002,lamp)]:
                vertices=[(a[0]-nx*width/2,a[1]-ny*width/2,a[2]+offset),(b[0]-nx*width/2,b[1]-ny*width/2,b[2]+offset),
                          (b[0]+nx*width/2,b[1]+ny*width/2,b[2]+offset),(a[0]+nx*width/2,a[1]+ny*width/2,a[2]+offset)]
                surface(label,vertices,[(0,1,2,3)],material)
        strut('Lower side blade',(-.42,side*.378,.13),(.40,side*.389,.13),.025,rubber)
    ribbon('Engine cover',[(-.61,.235,.36),(-.74,.244,.355),(-.85,.237,.343)],panel_glass)
    for x in (-.66,-.715,-.77,-.825):cube('Engine cooling louvre',(x,0,.366),(.012,.38,.012),rubber,.002)
    cube('Integrated rear lip',(-.918,0,.323),(.047,.64,.022),paint,.009)
    cube('Front air intake',(.951,0,.164),(.024,.42,.046),rubber,.01)
    cube('Rear diffuser',(-.955,0,.147),(.022,.51,.051),rubber,.008)
    for y in (-.13,0,.13):cube('Diffuser fin',(-.949,y,.126),(.07,.017,.035),rubber,.003)

def passenger_car(kind,paint):
    """Rounded hatchback and upright utility car, sharing only the playable footprint."""
    suv=kind=='jeep'
    sections=[(-.94,.32),(-.88,.40),(-.76,.50),(-.67,.525),(-.48,.455),(-.22,.425),
              (.12,.425),(.40,.455),(.56,.505),(.66,.525),(.80,.46),(.94,.32)]
    vertices=[]
    for x,w in sections:
        crown=(.445 if suv else .375)-(.035 if x>.65 else 0)
        shoulder=crown+(.11 if suv else .16)*math.exp(-((abs(x)-.66)/.24)**2)
        inner_shoulder=crown+.013+(shoulder-crown)*.62
        if x>.12:
            crown+=(.055 if suv else .09)*math.exp(-((x-.66)/.30)**2)
            shoulder=crown-.010
            inner_shoulder=crown-.003
        vertices.extend([(x,-w*.90,.115),(x,-w,.19),(x,-w,.32),
                         (x,-w*.92,shoulder),(x,-w*.60,inner_shoulder),(x,0,crown),
                         (x,w*.60,inner_shoulder),(x,w*.92,shoulder),(x,w,.32),
                         (x,w,.19),(x,w*.90,.115),(x,0,.115)])
    faces=[tuple(range(11,-1,-1))]
    for i in range(len(sections)-1):
        for j in range(12):faces.append((i*12+j,i*12+(j+1)%12,(i+1)*12+(j+1)%12,(i+1)*12+j))
    faces.append(tuple(range((len(sections)-1)*12,len(sections)*12)))
    body=surface('Utility sculpted shell' if suv else 'Rounded hatchback shell',vertices,faces,paint,1)
    open_cabin_tub(body,kind)
    for x in (-.67,.66):
        for side in (-1,1):
            bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.205,depth=.30,location=(x,side*.44,.19),rotation=(math.pi/2,0,0))
            cutter=bpy.context.object;bpy.context.view_layer.objects.active=body
            mod=body.modifiers.new('Functional wheel opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
            bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
    if suv:
        roof=[(.12,.292,.786),(-.02,.306,.808),(-.40,.306,.808),(-.65,.291,.782)]
        front=[(.42,.345,.452),(.30,.324,.610),(.12,.292,.785)]
        rear=[(-.65,.291,.78),(-.75,.32,.62),(-.83,.346,.447)]
    else:
        roof=[(.08,.263,.683),(-.06,.282,.714),(-.30,.281,.716),(-.47,.250,.682)]
        front=[(.40,.325,.387),(.29,.307,.520),(.08,.263,.682)]
        rear=[(-.47,.25,.681),(-.64,.294,.532),(-.78,.335,.390)]
        if kind=='taxi':
            roof=[(.10,.264,.684),(-.04,.281,.721),(-.38,.279,.721),(-.54,.253,.676)]
            rear=[(-.54,.253,.675),(-.65,.289,.511),(-.74,.324,.405)]
    ribbon('Contoured passenger windscreen',front,glass)
    ribbon('Crowned passenger roof',roof,paint)
    ribbon('Sloping hatch glass',rear,glass)
    for side in (-1,1):
        points=[(x,side*w,z) for x,w,z in front]+[(x,side*w,z) for x,w,z in roof[1:-1]]+[(x,side*w,z) for x,w,z in rear]
        divided_side_window('Passenger',points,-.23,side,rubber,.052)
        glazing_pillar('A pillar',front,side,.026 if suv else .024,paint)
        glazing_pillar('Rear hatch pillar',rear,side,.055 if suv else .044,paint)
        strut('Window beltline',(front[0][0],side*.35,front[0][2]+.004),(rear[-1][0],side*.35,rear[-1][2]+.004),.016,chrome)
        mz=.435 if suv else .370
        cube('Passenger mirror door base',(.35,side*.395,mz-.012),(.10,.034,.034),paint,.006)
        cube('Body coloured mirror',(.35,side*.459,mz+.022),(.115,.072,.055),paint,.018)
        strut('Mirror mount',(.35,side*.403,mz),(.35,side*.443,mz+.012),.018,rubber)
        for x in (-.06,-.47):
            z=.41 if suv else .348
            hit,point,normal,index=body.ray_cast(Vector((x,side*2,z)),Vector((0,-side,0)))
            if not hit:raise RuntimeError('Door handle requires a continuous door surface')
            cube('Inset door handle',(x,point.y+side*.006,z),(.074,.012,.019),chrome,.005)
        strut('Subtle door shutline',(-.27,side*.428,.19),(-.27,side*.428,.416 if suv else .345),.007,rubber)
        for x in (-.67,.66):
            if suv:wheel_arch(x,side*.508,rubber,body)
        if suv:
            strut('Roof rail',(-.58,side*.245,.837),(.08,side*.245,.837),.025,chrome)
            for x in (-.5,.02):cube('Roof rail foot',(x,side*.245,.816),(.064,.045,.025),rubber,.006)
        else:
            strut('Hatch lamp signature',(-.865,side*.365,.398),(-.893,side*.315,.324),.025,redlamp)
        cube('Inset lamp housing',(.897,side*.25,.378 if suv else .321),(.035,.17,.073),rubber,.018)
        cube('LED lens',(.919,side*.25,.382 if suv else .329),(.015,.132,.030),lamp,.007)
    cube('Front grille',(.94,0,.325 if suv else .272),(.024,.25,.11 if suv else .065),rubber,.015)
    if suv:
        for y in (-.08,-.04,0,.04,.08):cube('Grille satin bar',(.955,y,.326),(.014,.013,.078),chrome,.004)
        cube('Front skid plate',(.923,0,.169),(.055,.42,.053),chrome,.01)
        cylinder('Rear mounted spare tyre',(-.978,0,.46),.165,.075,rubber,'X')
        cylinder('Spare wheel cover',(-1.021,0,.46),.119,.020,paint,'X')
    else:
        ribbon('Hatch spoiler',[(-.75,.337,.424),(-.83,.347,.416)],paint)
        if kind!='taxi':ribbon('Glass roof insert',[(-.05,.19,.724),(-.24,.195,.726),(-.36,.185,.712)],glass)
    cube('Lower bumper lip',(.916,0,.155),(.062,.61,.033),rubber,.012)
    if kind=='taxi':
        for side in (-1,1):
            for index,x in enumerate((-.34,-.22,-.10,.02,.14,.26)):
                for row,z in enumerate((.315,.35)):
                    points=[]
                    for px,pz in ((x-.047,z-.013),(x+.047,z-.013),(x+.047,z+.013),(x-.047,z+.013)):
                        hit,point,normal,face=body.ray_cast(Vector((px,side*2,pz)),Vector((0,-side,0)))
                        if hit and abs(point.y)>.34:points.append((px,point.y+side*.005,pz))
                    if len(points)==4:surface('Flush taxi checker',points,[(0,1,2,3)],white if (index+row)%2 else rubber)

def leisure_vehicle(kind,paint):
    """Separate utility silhouettes: open-bed pickup and coachbuilt motorhome."""
    camper=kind=='camper';length=3 if camper else 2
    sections=[(-length/2+.06,.37),(-length/2+.16,.46),(-length/2+.33,.515),(-.3,.44),(.15,.44),(length/2-.34,.515),(length/2-.16,.45),(length/2-.06,.34)]
    vertices=[]
    for x,w in sections:
        crown=.445 if not camper else .405
        vertices.extend([(x,-w*.9,.115),(x,-w,.21),(x,-w,.35),(x,-w*.85,crown-.012),(x,0,crown),(x,w*.85,crown-.012),(x,w,.35),(x,w,.21),(x,w*.9,.115),(x,0,.115)])
    faces=[tuple(range(9,-1,-1))]
    for i in range(len(sections)-1):
        for j in range(10):faces.append((i*10+j,i*10+(j+1)%10,(i+1)*10+(j+1)%10,(i+1)*10+j))
    faces.append(tuple(range((len(sections)-1)*10,len(sections)*10)))
    body=surface('Motorhome lower hull' if camper else 'Sculpted pickup hull',vertices,faces,paint,1)
    open_cabin_tub(body,kind)
    for x in (-length/2+.33,length/2-.34):
        for side in (-1,1):
            bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.205,depth=.30,location=(x,side*.44,.19),rotation=(math.pi/2,0,0));cutter=bpy.context.object;bpy.context.view_layer.objects.active=body
            mod=body.modifiers.new('Utility wheel opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
    if camper:
        # Side panels bound a visible cabin instead of a solid box behind the glass.
        living_floor=cube('Motorhome floor',(-.29,0,.44),(2.25,.78,.12),white,.045)
        cut_opening(living_floor,'Entry floor recess',(.43,-.35,.44),(.28,.30,.30))
        for side in (-1,1):
            wall=cube('Lower living wall',(-.35,side*.403,.59),(2.12,.055,.25),white,.04)
            if side==-1:cut_opening(wall,'Living entry aperture',(.43,-.403,.58),(.27,.20,.40))
            cube('Upper window header',(-.35,side*.403,1.015),(2.12,.055,.15),white,.04)
            for x in (-1.36,-.73,-.13,.54):cube('Living window pillar',(x,side*.403,.80),(.075,.055,.32),white,.018)
            for x in (-1.03,-.43,.20):cube('Tinted living glazing',(x,side*.411,.80),(.51,.014,.25),glass,.025)
            strut('Motorhome beltline',(-1.33,side*.435,.48),(.64,side*.435,.48),.022,paint)
        ribbon('Curved motorhome roof',[(-1.36,.355,1.049),(-1.25,.415,1.09),(.32,.415,1.09),(.66,.37,1.04)],white)
        cube('Rear motorhome panel',(-1.375,0,.77),(.06,.79,.58),white,.04)
        for y in (-.18,.18):
            leather_piece(cube('Rear lounge seat',(-.84,y,.62),(.44,.28,.18),leather,.035),'camper')
            for x in (-.97,-.84,-.71):strut('Lounge cushion seam',(x,y-.10,.712),(x,y+.10,.712),.003,seat_trim)
        cube('Living table',(-.26,0,.68),(.36,.36,.025),wood,.01)
        ribbon('Motorhome panoramic windshield',[(1.435,.333,.43),(1.23,.344,.73),(1.08,.324,.92)],glass)
        ribbon('Overcab rounded roof',[(1.08,.326,.925),(.9,.349,.975),(.65,.367,1.02)],white)
        for side in (-1,1):
            cab_points=[(1.435,side*.333,.43),(1.23,side*.344,.73),(1.08,side*.324,.92),(.9,side*.349,.975),(.65,side*.367,1.02),(.64,side*.403,.48)]
            divided_side_window('Motorhome cab',cab_points,.78,side,white,.070)
            glazing_pillar('Motorhome A pillar',[(1.435,.333,.43),(1.23,.344,.73),(1.08,.324,.92)],side,.032,white)
            strut('Motorhome cab rear pillar',(.64,side*.403,.48),(.65,side*.367,1.02),.044,white)
            cube('Motorhome mirror body base',(1.25,side*.383,.404),(.075,.037,.041),paint,.008)
            strut('Motorhome mirror arm',(1.25,side*.396,.415),(1.25,side*.480,.48),.021,rubber)
            cube('Motorhome mirror',(1.25,side*.494,.50),(.09,.07,.10),paint,.018)
        framed_entry(.43,.39,.97,.25,white,-.423,.50)
        cube('Roof solar panel',(-.63,0,1.111),(.52,.55,.025),panel_glass,.018)
        for y in (-.16,0,.16):cube('Solar cell seam',(-.63,y,1.128),(.48,.012,.006),chrome,0)
        cube('Roof ventilation',(.11,0,1.13),(.27,.31,.07),cream,.026)
        cube('Front grille',(1.452,0,.29),(.017,.37,.07),rubber,.009)
        front=1.453
    else:
        cutter=cube('Temporary open bed',(-.48,0,.58),(.79,.66,.40),rubber,0);objects.remove(cutter);bpy.context.view_layer.objects.active=body
        mod=body.modifiers.new('Open cargo bed','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
        cube('Cargo bed liner',(-.48,0,.386),(.75,.62,.021),bed,.014)
        for y in (-.22,-.11,0,.11,.22):cube('Bed liner ridge',(-.48,y,.40),(.69,.018,.012),rubber,.003)
        ribbon('Pickup front glazing',[(.66,.323,.46),(.56,.299,.65),(.39,.269,.78)],glass)
        ribbon('Pickup cab roof',[(.39,.27,.784),(.27,.291,.81),(-.10,.291,.80),(-.23,.265,.76)],paint)
        ribbon('Pickup rear window',[(-.23,.265,.76),(-.26,.313,.45)],glass)
        for side in (-1,1):
            points=[(.66,side*.323,.46),(.56,side*.299,.65),(.39,side*.269,.78),(.27,side*.291,.81),(-.10,side*.291,.80),(-.23,side*.265,.76),(-.26,side*.313,.45)]
            divided_side_window('Pickup',points,-.12,side,paint,.055)
            glazing_pillar('Pickup A pillar',[(.66,.323,.46),(.56,.299,.65),(.39,.269,.78)],side,.030,paint)
            strut('Cab rear pillar',(-.23,side*.273,.765),(-.26,side*.321,.45),.032,paint)
            cube('Pickup mirror door base',(.58,side*.420,.426),(.095,.036,.035),paint,.007)
            strut('Pickup mirror arm',(.58,side*.435,.435),(.56,side*.473,.461),.018,rubber)
            cube('Pickup mirror',(.56,side*.485,.477),(.11,.09,.065),paint,.018)
            cube('Pickup handle',(.03,side*.436,.39),(.085,.015,.025),chrome,.006)
            cube('Cargo rail cap',(-.49,side*.361,.461),(.79,.04,.024),rubber,.007)
            cube('Side running board',(.10,side*.44,.16),(.72,.075,.025),chrome,.008)
        cube('Tailgate seam',(-.914,0,.344),(.014,.62,.015),rubber,.004)
        cube('Tailgate latch',(-.929,0,.40),(.012,.15,.03),chrome,.005)
        cube('Pickup front grille',(.944,0,.30),(.018,.40,.11),rubber,.009)
        for y in (-.12,0,.12):cube('Grille rib',(.956,y,.30),(.013,.021,.083),chrome,.004)
        front=.955
    for side in (-1,1):cube('Utility LED lamp',(front,side*.26,.365 if camper else .365),(.02,.16,.045),lamp,.009)

def commercial_vehicle(kind,paint):
    school=kind=='schoolbus';truck=kind=='delivery'
    # Continuous shell with crowned roof and softened front/rear shoulders.
    front=.89 if school else 1.43
    top=.96 if school else 1.015
    sections=[(-1.43,.33),(-1.36,.42),(-1.18,.445),(-.75,.445),(0,.445),
              (front-.22,.445),(front-.07,.41),(front,.33)]
    vertices=[]
    for x,w in sections:
        end=x==sections[0][0] or x==front
        roof=top-(.07 if end else 0)
        vertices.extend([(x,-w*.9,.11),(x,-w,.24),(x,-w,roof-.15),(x,-w*.94,roof-.045),
                         (x,-w*.62,roof),(x,0,roof+.015),(x,w*.62,roof),(x,w*.94,roof-.045),
                         (x,w,roof-.15),(x,w,.24),(x,w*.9,.11),(x,0,.11)])
    faces=[tuple(range(11,-1,-1))]
    for i in range(len(sections)-1):
        for j in range(12):faces.append((i*12+j,i*12+(j+1)%12,(i+1)*12+(j+1)%12,(i+1)*12+j))
    faces.append(tuple(range((len(sections)-1)*12,len(sections)*12)))
    if truck:
        body=cube('Truck lower chassis',(0,0,.28),(2.86,.90,.34),paint,.06)
        cube('Rounded cargo box',(-.47,0,.695),(1.86,.87,.85),white,.065)
        cabin=cube('Truck contoured cab',(.94,0,.565),(.97,.84,.84),paint,.10)
        cutter=cube('Temporary truck footwell',(1.02,0,.70),(.74,.54,.46),rubber,.018)
        objects.remove(cutter);bpy.context.view_layer.objects.active=cabin
        mod=cabin.modifiers.new('Recessed truck passenger cell','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
        bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
        for pos,size in [((.97,0,.72),(.52,1.0,.28)),((1.405,0,.715),(.12,.54,.29))]:
            cutter=cube('Cab window opening',pos,size,rubber,0);objects.remove(cutter);bpy.context.view_layer.objects.active=cabin
            mod=cabin.modifiers.new('Real cab glazing opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
        surface('Truck swept windshield',[(1.443,-.30,.54),(1.437,-.30,.88),(1.437,.30,.88),(1.443,.30,.54)],[(0,1,2,3)],glass)
        for side in (-1,1):
            surface('Driver side glass',[(1.30,side*.429,.56),(1.25,side*.409,.88),(.66,side*.429,.89),(.62,side*.429,.56)],[(0,1,2,3)],glass)
            cube('Cab door handle',(.70,side*.43,.48),(.085,.018,.025),chrome,.006)
            cube('Cab step',(.83,side*.463,.16),(.42,.04,.065),chrome,.012)
            cube('Cargo badge',(-.45,side*.444,.72),(.55,.018,.24),paint,.025)
            cube('Cargo badge stroke',(-.45,side*.459,.72),(.30,.009,.025),white,.004)
            for z in (.35,.55,.92):cube('Cargo protective seam',(-.47,side*.44,z),(1.66,.018,.015),chrome,.003)
        for y in (-.28,0,.28):cube('Cargo roof rib',(-.47,y,1.124),(1.55,.021,.015),chrome,.005)
        for y in (-.215,.215):
            cube('Cargo rear door',(-1.408,y,.70),(.018,.403,.70),chrome,.025)
            cube('Cargo lock bar',(-1.427,y,.70),(.018,.018,.56),rubber,.005)
            for z in (.45,.95):cube('Cargo hinge',(-1.431,y*1.75,z),(.02,.047,.031),rubber,.004)
    else:
        body=surface('Rounded passenger body',vertices,faces,paint)
        front_inner=front-.045
        cutter=cube('Temporary passenger aisle',((-1.30+front_inner)/2,0,.645),
                    (front_inner+1.30,.66,.54),rubber,.018)
        objects.remove(cutter);bpy.context.view_layer.objects.active=body
        mod=body.modifiers.new('Hollow bus passenger cell','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
        bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
        doorx=.56 if school else .70
        cut_opening(body,'Recessed bus entry aperture',(doorx,-.40,.555),(.33,.34,.68))
        aisle=cube('Bus carpeted aisle',((-1.27+front_inner)/2,0,.391),(front_inner+1.27,.64,.016),upholstery,.003)
        cut_opening(aisle,'Bus stairwell',(doorx,-.32,.39),(.32,.30,.12))
        start=-1.22;end=.67 if school else 1.19;count=5 if school else 6
        for i in range(count):
            width=(end-start)/count-.04;cx=start+(end-start)*(i+.5)/count
            cutter=cube('Passenger window opening',(cx,0,.72),(width,1.1,.26),rubber,0);objects.remove(cutter);bpy.context.view_layer.objects.active=body
            mod=body.modifiers.new('Real passenger window cavity','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
            for side in (-1,1):
                if side==-1 and abs(cx-doorx)<.30:continue
                tailored_seat(cx,side*.20,.615,.17,kind,.24)
                for px in (cx-.07,cx+.05):cube('Passenger seat pedestal',(px,side*.20,.493),(.025,.13,.188),upholstery,.004)
        cutter=cube('Front glass opening',(front-.008,0,.705),(.08,.53,.27),rubber,0);objects.remove(cutter);bpy.context.view_layer.objects.active=body
        mod=body.modifiers.new('Open front glazing','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
        # Continuous dark glazing gives a modern coach; school bus keeps discrete bays.
        for side in (-1,1):
            start=-1.22;end=.67 if school else 1.19
            panes=[(start,end)] if side==1 else [(start,doorx-.175),(doorx+.175,end)]
            for left,right in panes:
                surface('Passenger glazing',[(left,side*.448,.58),(left,side*.448,.86 if school else .91),
                    (right,side*.448,.86 if school else .91),(right,side*.448,.58)],[(0,1,2,3)],glass)
            count=5 if school else 6
            for i in range(count+1):
                x=start+(end-start)*i/count
                if side==-1 and abs(x-doorx)<.175:continue
                cube('Window mullion',(x,side*.457,.72 if school else .745),(.024,.014,.30 if school else .35),paint if school else rubber,.003)
            def side_trim(label,centre,z,length,depth,height,material,bevel):
                left,right=centre-length/2,centre+length/2
                spans=[(left,right)] if side==1 else [(left,min(right,doorx-.18)),(max(left,doorx+.18),right)]
                for a,b in spans:
                    if b>a:cube(label,((a+b)/2,side*.45,z),(b-a,depth,height),material,bevel)
            side_trim('Passenger beltline',-.17 if school else 0,.54,1.98 if school else 2.47,.018,.025,chrome,.006)
            if school:
                for z in (.34,.43):side_trim('School safety band',-.20,z,2.12,.019,.025,rubber,.005)
            else:
                side_trim('Coach lower sweep',-.05,.38,2.52,.016,.054,white,.012)
                for x in (-.75,-.25,.25):
                    if side==1 or abs(x-doorx)>.18:cube('Luggage compartment seam',(x,side*.451,.35),(.008,.01,.21),rubber,.002)
        windx=front+.015
        surface('Panoramic front glass',[(windx,-.29,.56),(front+.009,-.33,top-.115),
                (front+.009,.33,top-.115),(windx,.29,.56)],[(0,1,2,3)],glass)
        cube('Rear passenger glass',(-1.437,0,.71),(.018,.53,.24),glass,.025)
        framed_entry(doorx,.235,.88,.31,paint,-.449)
        cube('Emergency roof hatch',(-.25,0,top+.025),(.34,.40,.025),chrome,.018)
        if school:
            bodyhood=cube('School bus rounded bonnet',(1.12,0,.35),(.65,.76,.28),paint,.065)
            for side in (-1,1):
                for y in (.18,.28):cube('School safety lamp',(front+.024,side*y,.891),(.019,.055,.044),redlamp if y==.28 else lamp,.009)
            cube('School destination board',(.912,0,.91),(.025,.29,.05),rubber,.01)
        else:
            cube('Low profile roof AC',(-.65,0,top+.055),(.58,.43,.08),white,.032)
            for x in (-.83,-.75,-.67,-.59,-.51):cube('AC grille',(x,0,top+.1),(.016,.28,.009),rubber,.002)
            cube('Coach destination board',(1.448,0,.925),(.018,.41,.064),rubber,.01)
            for y in (-.12,-.04,.04,.12):cube('Route pixels',(1.462,y,.925),(.009,.025,.022),lamp,.002)
    # Wheel wells use the actual fixed wheel centres, with body above tyre crowns.
    for x in (-1.17,1.16):
        for side in (-1,1):
            bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.205,depth=.32,location=(x,side*.44,.19),rotation=(math.pi/2,0,0))
            cutter=bpy.context.object
            targets=[body]+([bodyhood] if school and x>0 else [])
            for target in targets:
                bpy.context.view_layer.objects.active=target
                mod=target.modifiers.new('Commercial wheel well','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
                bpy.ops.object.modifier_apply(modifier=mod.name)
            bpy.data.objects.remove(cutter,do_unlink=True)
    for side in (-1,1):
        mx=.80 if school else 1.24
        cube('Commercial mirror body base',(mx,side*.438,.516),(.070,.035,.038),paint,.007)
        strut('Extended mirror support',(mx,side*.449,.523),(mx,side*.49,.659),.018,rubber)
        cube('Commercial mirror',(mx,side*.49,.70),(.095,.063,.12),rubber,.017)
        cube('Commercial LED',(1.445,side*.27,.36),(.016,.15,.045),lamp,.01)
    cube('Front bumper lip',(1.435,0,.17),(.043,.62,.055),rubber,.012)
    cube('Commercial grille',(1.441,0,.28),(.023,.26,.079),rubber,.015)

def car(kind, length, colour):
    objects.clear()
    paint = mat('Paint '+kind, colour, .3, .04)
    paint.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.55
    paint.node_tree.nodes.get('Principled BSDF').inputs['Coat Roughness'].default_value=.2
    tall = kind in ('schoolbus', 'coach', 'camper', 'delivery')
    commercial=kind in ('coach','schoolbus','delivery')
    refined=kind in ('racer','compact','jeep','taxi','pickup','camper') or commercial
    if not refined:coachwork(kind,length,paint)
    if kind == 'racer':
        midengine_coupe(paint)
    elif kind in ('compact','jeep','taxi'):
        passenger_car(kind,paint)
        if kind=='taxi':cube('Taxi roof sign',(-.19,0,.79),(.27,.23,.10),lamp,.021)
    elif kind in ('pickup','camper'):
        leisure_vehicle(kind,paint)
    elif commercial:
        commercial_vehicle(kind,paint)
    # Small readable details share existing material batches, rather than extra draw calls.
    if not tall:
        cockpit(kind)
    else:
        driver_x=.88 if kind=='delivery' else .30 if kind=='schoolbus' else .98
        seat_z=.64 if kind=='delivery' else .54
        cabin_foundation(driver_x,seat_z,driver_x+.27,kind,.56)
        for side in (-1,1):
            tailored_seat(driver_x,side*.18,seat_z,.20,kind,.22)
            leather_piece(cube('Commercial door armrest',(driver_x,side*.30,seat_z+.045),(.20,.037,.055),leather,.012),kind)
        cockpit_controls(driver_x+.27,seat_z+.04,-.18,kind,.56)
    mirror_x = .82 if tall else .13 if kind=='racer' else .28
    for y in (-.41,.41):
        cube('Lower rocker trim',(0,y,.145),(length-.46,.032,.05),rubber,.01)
    if not refined and kind!='camper':
        front_x=.18 if kind=='racer' else length/2-(.35 if tall else .58)
        for y in (-.16,.16):cube('Windshield wiper',(front_x,y,.532 if kind=='racer' else .77 if tall else .57),(.025,.19,.015),rubber,.003)
    for y in (-.47,.47):
        if not refined:cube('Side mirror', (mirror_x,y,.59 if tall else .49), (.16,.085,.075), chrome, .018)
        if not refined:cube('Door handle', (.15,y*.89,.43), (.12,.023,.025), chrome, .008)
    if not tall:
        if not refined:
            for y in (-.417,.417):cube('Door seam', (-.36,y,.33), (.015,.015,.16), rubber, .003)
        if kind == 'racer':
            cube('Front splitter', (.90,0,.115), (.13,.71,.025), rubber, .008)
        elif not refined:
            for y in (-.342,.342): cube('Window pillar', (-.15,y,.51), (.055,.035,.29), paint, .01)
    cube('Rear plate', (-length/2+.055,0,.24), (.026,.24,.09), white, .007)
    # Body details remain in existing paint/trim batches.
    for x in (-length/2+.33,length/2-.34):
        if not refined:
            for y in (-.422,.422):wheel_arch(x,y,rubber)
    for y in (() if refined else (-.325,.325)):
        cube('Window sill',(-.16 if not tall else .25,y,.43 if not tall else .55),(.68 if not tall else .45,.024,.025),chrome,.007)
        if not tall:
            pillar=cube('Cabin pillar',(-.22,y,.52),(.042,.035,.29),paint,.008)
            pillar.rotation_euler.y=-.1 if kind=='racer' else .05
    if kind=='taxi':
        cube('Taxi sign face',(-.19,-.123,.79),(.24,.012,.048),rubber,.004)
    cube('Exhaust outlet',(-length/2+.043,.23,.15),(.06,.085,.045),rubber,.008)
    for y in (-.075,-.025,.025,.075): cube('Plate marks', (-length/2+.035,y,.24), (.012,.025,.047), rubber, .002)
    for x in (-length/2+.33, length/2-.34):
        for y in (-.43,.43):
            wheel_colourize(cylinder('Wheel', (x,y,.19), .19,.13,rubber,'Y'),rubber)
            wheel_ring('Tyre sidewall shoulder',x,y*1.158,.167,.006,rubber)
            wheel_ring('Alloy rim lip',x,y*1.158,.113,.006,chrome)
            if kind=='racer':
                wheel_ring('Recessed rim barrel',x,y*1.085,.106,.008,bed)
                rotor=cylinder('Recessed brake rotor',(x,y*1.075,.19),.092,.009,chrome,'Y')
                wheel_colourize(rotor,chrome)
            else:wheel_colourize(cylinder('Hub', (x,y*1.13,.19), .09,.025,chrome,'Y'),chrome)
            # Different rim styles identify vehicle families, all retain one rolling batch.
            spokes=5 if kind=='racer' else 6 if kind in ('taxi','compact') else 4
            for spoke in range(spokes):
                angle=spoke*math.tau/spokes
                part=cube('Alloy spoke',(x+math.cos(angle)*.063,y*1.16,.19+math.sin(angle)*.063),(.092,.012,.014),chrome,0)
                part.rotation_euler.y=-angle;wheel_colourize(part,chrome)
            wheel_colourize(cylinder('Hub cap',(x,y*1.18,.19),.027,.012,bed,'Y'),bed)
            for tread in range(12):
                angle=tread*math.tau/12
                part=cube('Tyre tread',(x+math.cos(angle)*.178,y,.19+math.sin(angle)*.178),(.019,.105,.012),bed,0)
                part.rotation_euler.y=math.pi/2-angle;wheel_colourize(part,bed)
    for y in (-.26,.26):
        if not refined:cube('Headlight', (length/2-.065,y,.3), (.022,.15,.09), lamp, .02)
        cube('Taillight', (-length/2+.065,y,.28 if kind=='racer' else .3), (.022,.18 if kind=='racer' else .13,.035 if kind=='racer' else .07), redlamp, .012)
        if kind=='racer':cube('Recessed tail lamp bezel',(-length/2+.074,y,.28),(.019,.193,.048),rubber,.008)
    if not refined:cube('Front bumper', (length/2-.06,0,.18), (.055,.57,.08), chrome, .025)
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
cube('Foundation shadow reveal',(3,-3,-.365),(6.43,6.43,.055),drain,.04)
cube('Asphalt',(3,-3,.018),(6.02,6.02,.035),asphalt,.075)
cube('Exit road',(6.7,-2.5,-.03),(1.55,1.02,.15),asphalt,.065)
for y in (-1.93,-3.07): cube('Road curb',(6.7,y,-.02),(1.65,.16,.22),cream,.06)
for x in (.0,6):
    ranges=[(-.07,-1.88),(-3.13,-6.0)] if x==6 else [(-.07,-6.0)]
    for start,end in ranges:
        for y in (start,end):
            cylinder('Rail post',(x,y,.19),.047,.38,rail)
            cylinder('Post mounting collar',(x,y,.054),.085,.045,cream)
            cylinder('Post cap',(x,y,.388),.057,.025,chrome)
        cylinder('Side rail',(x,(start+end)/2,.34),.032,abs(end-start),white,'Y')
        cylinder('Lower side rail',(x,(start+end)/2,.17),.014,abs(end-start),rail,'Y')
for y in (0,-6):
    for x in (0,2,4,6):
        cylinder('Rail post',(x,y,.19),.047,.38,rail)
        cylinder('Post mounting collar',(x,y,.054),.085,.045,cream)
        cylinder('Post cap',(x,y,.388),.057,.025,chrome)
    cylinder('Horizontal rail',(3,y,.34),.032,6.05,white,'X')
    cylinder('Lower horizontal rail',(3,y,.17),.014,6.05,rail,'X')
for row in range(6):
    for col in range(6):
        for dx,dy in ((.08,-.08),(.92,-.92)):
            cube('Bay corner',(col+dx,-row+dy,.042),(.11,.016,.008),white,.002)
            cube('Bay corner',(col+dx,-row+dy,.042),(.016,.11,.008),white,.002)
cube('Gate control',(6.43,-1.81,.25),(.25,.27,.5),cream,.06)
cube('Gate display',(6.43,-1.663,.34),(.13,.016,.16),panel_glass,.02)
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
cube('Booth window',(-.406,-1.45,.48),(.018,.46,.27),panel_glass,.025)
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
# A quiet street corner frames the saturated puzzle cars. Keep the exit lane clear.
cube('Neighbourhood street',(7.13,-3,.065),(1.14,6.7,.05),street,.015)
for row in range(13):
    y=.15-row*.51
    cube('West paving slab',(-.72,y,.055),(.91,.49,.055),stone,.014)
    if not -3.12<y<-1.88:cube('East paving slab',(6.4,y,.055),(.48,.49,.055),stone,.014)
for y in (.12,-.55,-1.22,-3.65,-4.32,-4.99,-5.66):
    cube('Street centre dash',(7.45,y,.099),(.035,.3,.008),white,.002)
for y in (-3.35,-3.55,-3.75,-3.95):cube('Pedestrian crossing',(7.05,y,.099),(.79,.09,.008),white,.003)
for y in (-.2,-.8,-1.4,-3.6,-4.2,-4.8,-5.4,-6):
    cube('West kerbstone',(-.17,y,.1),(.14,.55,.14),cream,.02)
    if y< -3.2 or y>-1.6:cube('Street kerbstone',(6.68,y,.1),(.12,.55,.14),cream,.02)
# Kiosk frontage and striped canvas canopy, with a small warm display window.
cube('Kiosk sign',(-.392,-1.45,.63),(.035,.48,.15),wood,.018)
cube('Kiosk canopy',(-.63,-1.05,.81),(.91,.36,.08),awning,.015)
for x in (-.98,-.76,-.54,-.32):cube('Canopy stripe',(x,-1.05,.855),(.085,.34,.015),cream,.004)
cube('Kiosk service shelf',(-.405,-1.45,.36),(.22,.48,.055),wood,.012)
cube('Kiosk window glow',(-.4,-1.45,.5),(.02,.36,.18),streetlamp,.014)
# Low furniture sits below vehicle roofs, away from the grid and exit.
for y in (-3.75,-4.02):
    cube('Bench foot',(-.73,y,.16),(.45,.05,.3),drain,.008)
for x in (-.91,-.77,-.63):cube('Bench seat slat',(x,-3.9,.32),(.1,.62,.045),wood,.008)
for z in (.47,.58):cube('Bench back slat',(-.98,-3.9,z),(.045,.65,.08),wood,.01)
for y in (-3.75,-4.04):cube('Bench back support',(-1.01,y,.42),(.035,.035,.49),drain,.006)
cube('Street bin',(-.69,-2.68,.3),(.26,.28,.52),rail,.03)
cube('Bin lid',(-.69,-2.68,.58),(.3,.32,.055),drain,.015)
cube('Bin opening',(-.55,-2.68,.48),(.015,.15,.07),rubber,.01)
for x,y in ((-.74,-5.32),(6.36,-5.87)):
    cylinder('Street tree trunk',(x,y,.47),.047,.86,wood)
    for dx,dy,z,r in ((0,0,.99,.26),(.16,.08,.88,.22),(-.14,-.08,.87,.22)):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=r,location=(x+dx,y+dy,z))
        obj=bpy.context.object;obj.name='Street tree crown';obj.data.materials.append(leaf_light if dx>0 else leaf_dark if dx<0 else foliage);objects.append(obj)
cube('Utility cover',(7.12,-5.2,.099),(.3,.3,.012),drain,.014)
for x in (7.04,7.12,7.2):cube('Utility grooves',(x,-5.2,.108),(.018,.24,.008),chrome,.002)
for obj in objects[scenery_start:]:
    if not obj.name.startswith('Drain'):obj.location.z-=.06
garage=export('garage')
for group,x,y in assets:
    for obj in group: obj.location.x += x+10; obj.location.y += y
# Save the editable source with all original asset meshes and materials.
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','toy-garage.blend'))
print('MODEL_BUILD_COMPLETE', OUT)
