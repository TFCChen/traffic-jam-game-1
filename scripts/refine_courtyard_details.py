"""Incremental hardscape detail; preserve the approved vehicles, foliage and fence."""
import os,sys,math,hashlib,json
import bpy,bmesh
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public','models');sys.path.insert(0,os.path.join(ROOT,'scripts'))
from compact_environment import compact_environment_glb
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'art','street-courtyard.blend'))
# Remove only this script's earlier details to make reruns idempotent.
for obj in list(bpy.context.scene.objects):
    if obj.name.startswith('Craft detail'):
        bpy.data.objects.remove(obj,do_unlink=True)

def signature(obj):
    h=hashlib.sha256();h.update(repr(tuple(tuple(r)for r in obj.matrix_world)).encode())
    for v in obj.data.vertices:h.update(repr(tuple(v.co)).encode())
    for p in obj.data.polygons:h.update(repr(tuple(p.vertices)).encode())
    return h.hexdigest()
protected=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m and (m.name.startswith('Fence ') or m.name in ['Courtyard foliage detail','Courtyard bark','Asphalt blue slate','Street asphalt','Basalt foundation']) for m in o.data.materials)]
before={o.name:signature(o)for o in protected}
materials=bpy.data.materials
iron=materials['Graphite powdercoat'];stone=materials['Honed warm limestone'];brass=materials['Satin brass accents'];wood=materials['Oiled oak'];charcoal=materials['Cafe graphite']
brick=[materials['Cafe brick '+str(i)]for i in range(4)]
new=[]
def box(name,pos,size,material,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name='Craft detail '+name
    o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
    if bevel:
        m=o.modifiers.new('Small edge chamfer','BEVEL');m.width=bevel;m.segments=1;bpy.ops.object.modifier_apply(modifier=m.name)
    new.append(o);return o
# Back and both end walls have staggered masonry and clear mortar joints.
for wall in range(3):
    lo,hi=(-1.80,-.30)if wall==0 else(-1.89,-.75)
    for row in range(9):
        z=.18+row*.082;offset=.096 if row%2 else 0
        for col in range(math.ceil((hi-lo+.096)/.192)):
            a=max(lo,lo+col*.192-offset);b=min(hi,lo+(col+1)*.192-offset)
            if b-a<.02:continue
            centre=(a+b)/2
            # The end-wall service door occupies an actual quiet rectangular bay.
            if wall==2 and abs(centre+1.35)<.23 and z<.77:continue
            pos=(-1.894,centre,z)if wall==0 else(centre,(-1.806 if wall==1 else-.294),z)
            dims=(.016,b-a-.008,.071)if wall==0 else(b-a-.008,.016,.071)
            box('masonry',pos,dims,brick[(row*3+col+wall)%4])
    if wall==0:
        box('back plinth',(-1.91,-1.05,.145),(.035,1.5,.08),stone,.004)
        box('back lintel',(-1.908,-1.05,.968),(.03,1.51,.04),stone,.003)
    else:
        y=-1.826 if wall==1 else-.274
        box('end plinth',(-1.32,y,.145),(1.14,.035,.08),stone,.004)
        box('end lintel',(-1.32,y,.968),(1.15,.03,.04),stone,.003)
for y in [-1.817,-.283]:box('masonry corner',(-1.904,y,.565),(.035,.035,.76),stone,.003)
# Quiet service door with its own frame, bottom threshold and mounted pull.
box('service frame',(-1.35,-.276,.463),(.41,.043,.65),iron,.006)
box('service door',(-1.35,-.248,.463),(.355,.018,.59),charcoal,.004)
for x in [-1.514,-1.186]:box('door vertical reveal',(x,-.233,.463),(.012,.007,.584),iron,.002)
box('service threshold',(-1.35,-.238,.166),(.40,.095,.018),stone,.003)
box('service pull',(-1.205,-.218,.465),(.018,.03,.094),brass,.003)
# Roof gutter, corners and discrete downpipe, mounted behind the storefront.
box('roof gutter',(-1.963,-1.05,1.093),(.047,1.64,.036),iron,.005)
box('gutter recess',(-1.963,-1.05,1.108),(.021,1.60,.008),charcoal)
box('downpipe',(-1.958,-1.738,.604),(.031,.031,.94),iron,.003)
for z in [.27,.70,1.02]:box('downpipe bracket',(-1.939,-1.738,z),(.061,.048,.012),brass,.002)
box('rain outlet',(-1.968,-1.738,.14),(.045,.04,.035),iron,.003)
box('roof vent base',(-1.56,-1.16,1.169),(.18,.24,.031),charcoal,.004)
box('roof vent cowl',(-1.56,-1.16,1.203),(.18,.24,.019),iron,.004)
for y in [-1.24,-1.19,-1.14,-1.09]:box('vent slat',(-1.56,y,1.187),(.16,.009,.024),iron)
# Bench support shoes and real fasteners. All pieces stay above the paving datum.
for cx,cy,angle in [(-.70,-4.22,0),(1.05,-6.73,math.pi/2)]:
    def point(x,y,z):return(cx+x*math.cos(angle)-y*math.sin(angle),cy+x*math.sin(angle)+y*math.cos(angle),z)
    for x in [-.15,.15]:
        for y in [-.28,.28]:
            pad=box('bench footplate',point(x,y,.114),(.10,.068,.012),iron,.003);pad.rotation_euler.z=angle
            for dy in [-.023,.023]:box('bench floor fixing',point(x,y+dy,.123),(.012,.012,.006),brass,.001)
    for x in [-.13,-.043,.043,.13]:
        for y in [-.28,.28]:box('seat fixing',point(x,y,.350),(.008,.008,.003),brass)
# Replace only the disconnected solid planter-rim components with open frames.
planters=[(-.68,-5.6,.48,.53),(5.66,.73,.48,.53),(6.,-7.25,.48,.53),(-1.5,-6.95,.48,.53),(-.6,-2.9,.54,1.15),(2.1,.65,1.8,.42),(3.9,-6.65,1.65,.4)]
for obj in list(bpy.context.scene.objects):
    if obj.type!='MESH' or obj.name.startswith('Craft detail') or not any(m and m.name=='Honed warm limestone'for m in obj.data.materials) or obj.get('planter_openings'):continue
    bm=bmesh.new();bm.from_mesh(obj.data);pending=set(bm.verts);remove=[];count=0
    while pending:
        seed=pending.pop();component={seed};stack=[seed]
        while stack:
            v=stack.pop()
            for e in v.link_edges:
                other=e.other_vert(v)
                if other in pending:pending.remove(other);component.add(other);stack.append(other)
        ps=[obj.matrix_world@v.co for v in component]
        low=[min(p[i]for p in ps)for i in range(3)];high=[max(p[i]for p in ps)for i in range(3)]
        if abs(low[2]-.125)<.003 and abs(high[2]-.195)<.003 and any(abs((low[0]+high[0])/2-x)<.001 and abs((low[1]+high[1])/2-y)<.001 for x,y,w,l in planters):
            remove.extend(component);count+=1
    if remove:
        assert count==7,'Identify only the seven original planter rim boxes'
        bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(obj.data);obj.data.update();obj['planter_openings']=True
    bm.free()
for x,y,w,l in planters:
    ow,ol=w+.02,l+.02;iw,il=w-.075,l-.075;rim=.0475
    for sign in [-1,1]:
        box('open planter long rim',(x+sign*(ow-rim)/2,y,.16),(rim,ol,.07),stone,.004)
        box('open planter end rim',(x,y+sign*(ol-rim)/2,.16),(iw,rim,.07),stone,.004)
# Lower the existing earth below the stone lip, once only.
for obj in bpy.context.scene.objects:
    if obj.type=='MESH' and any(m and m.name=='Mulched earth'for m in obj.data.materials) and not obj.get('soil_recessed'):
        for vertex in obj.data.vertices:vertex.co.z-=.028
        obj['soil_recessed']=True;obj.data.update()
assert before=={o.name:signature(o)for o in protected},'Approved fence, vegetation, road and stone geometry must be unchanged'
# Merge only the appended pieces by their existing material; runtime batches stay fixed.
batches={}
for obj in new:batches.setdefault(obj.data.materials[0],[]).append(obj)
for material,group in batches.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0].name='Craft detail '+material.name
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
staged=os.path.join(ROOT,'art','garage.export.glb')
bpy.ops.export_scene.gltf(filepath=staged,export_format='GLB',use_selection=True,export_yup=True)
target=os.path.join(OUT,'garage.glb');os.replace(staged,target);compact_environment_glb(target)
assert os.path.getsize(target)<5_000_000,'Stay inside the existing environment download budget'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','street-courtyard.blend'))
print('CRAFT_DETAIL_COMPLETE',len(new),'authored pieces;',len(protected),'protected meshes unchanged;',os.path.getsize(target),'GLB bytes')
