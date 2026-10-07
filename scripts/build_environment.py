"""Blender 4.5: rebuild the street courtyard without modifying vehicle assets.
Run: blender --background --python scripts/build_environment.py
The full build_models.py also executes this source using its shared helpers.
"""
if 'cube' not in globals():
    import os
    helper = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build_models.py')
    source = open(helper, encoding='utf8').read().split('\nassets = []')[0]
    exec(compile(source, helper, 'exec'), globals())

import random
rng = random.Random(284)
objects.clear()
concrete = mat('Honed warm limestone', 'c7c4b9', .82)
edge = mat('Basalt foundation', '414a4c', .75)
joint = mat('Recessed mortar', '858a84', .95)
iron = mat('Graphite powdercoat', '344247', .38, .38)
brass = mat('Satin brass accents', 'b19a70', .34, .68)
paver = [mat('Limestone paver '+str(i), c, .87) for i,c in enumerate(['c0bfb4','b8b9b0','ccc9be','bfc1b7'])]
brick = [mat('Cafe brick '+str(i), c, .92) for i,c in enumerate(['967e69','a18a74','ad9880','9b8876'])]
timber = mat('Oiled oak', '80634c', .54)
charcoal = mat('Cafe graphite', '37484b', .48)
shopglass = mat('Architectural glazing', '455b62', .065, .32)
linen = mat('Linen canvas', 'd1c6aa', .92)
light = mat('Streetlamp glow', 'ffe2ab', .28)
mark = mat('Parking markings', 'cbd0c7', .89)
soil = mat('Mulched earth', '4e5141', .98)
leaves = [mat('Courtyard foliage '+str(i), c, .95) for i,c in enumerate(['4c6952','5b795b','6d8864','7c926b'])]
leaf_detail = mat('Courtyard foliage detail', 'ffffff', .95)
leaf_colour=leaf_detail.node_tree.nodes.new('ShaderNodeVertexColor');leaf_colour.layer_name='Col'
leaf_detail.node_tree.links.new(leaf_colour.outputs['Color'],leaf_detail.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
stone_dark = mat('Rain drain and rubber', '2b3537', .86)

# Continuous street / apron / lot, on one datum; no runtime road patches.
cube('Courtyard plinth',(4,-4.05,-.24),(12.4,12.4,.48),edge,.12)
cube('Limestone perimeter reveal',(4,-4.05,-.035),(12.34,12.34,.07),concrete,.04)
cube('Parking court',(3,-3,.018),(6,6,.035),asphalt,.012)
cube('Full neighbourhood street',(8.3,-4.05,.018),(3.7,12.32,.035),street,.015)
cube('Flush exit apron',(6.25,-2.5,.018),(.5,1.05,.035),asphalt,.008)

def paving(x0,x1,y0,y1,step=.42):
    cube('Paving joint bed',((x0+x1)/2,(y0+y1)/2,.05),(x1-x0,y1-y0,.10),joint,.008)
    rows=math.ceil((y1-y0)/step)
    for row in range(rows):
        a=y0+row*step;b=min(y1,a+step)
        offset=step/2 if row%2 else 0
        cols=math.ceil((x1-x0+offset)/step)
        for col in range(cols):
            lo=max(x0,x0+col*step-offset);hi=min(x1,x0+(col+1)*step-offset)
            if hi-lo>.025:
                cube('Limestone paving',((lo+hi)/2,(a+b)/2,.082),(hi-lo-.012,b-a-.012,.05),rng.choice(paver),.007)

paving(-2.1,-.16,-6.35,.85)
paving(-2.1,6.45,.85,2.05)
paving(-.16,6.45,.16,.85)
paving(-2.1,6.45,-10.15,-6.35)
paving(-.16,6.45,-6.35,-6.16)
paving(6.16,6.45,-1.95,.16)
paving(6.16,6.45,-9.6,-3.05)

# Low, finely proportioned metal fence with separate footings and brass caps.
def fence(a,b):
    length=math.dist(a,b);count=max(1,math.ceil(length/.8))
    for i in range(count+1):
        x=a[0]+(b[0]-a[0])*i/count;y=a[1]+(b[1]-a[1])*i/count
        cube('Fence shoe',(x,y,.065),(.085,.085,.06),concrete,.012)
        cube('Slim fence post',(x,y,.195),(.032,.032,.29),iron,.006)
        cube('Satin post cap',(x,y,.345),(.038,.038,.018),brass,.006)
    for h in (.15,.30):
        size=(length,.022,.022) if a[1]==b[1] else (.022,length,.022)
        cube('Architectural railing',((a[0]+b[0])/2,(a[1]+b[1])/2,h),size,iron,.005)

for a,b in [((0,0),(6,0)),((0,-6),(6,-6)),((0,0),(0,-6)),((6,0),(6,-1.94)),((6,-3.06),(6,-6))]:fence(a,b)

# Grid is restrained and always inside the unchanged 6x6 puzzle footprint.
for row in range(7):
    for col in range(7):
        x=min(5.94,max(.06,col));y=-min(5.94,max(.06,row))
        cube('Bay locator',(x,y,.038),(.085,.012,.004),mark,.001)
        cube('Bay locator',(x,y,.038),(.012,.085,.004),mark,.001)

# Integral curb stones, crossings, channel drain and tactile surfaces.
for y in [1.95-i*.42 for i in range(29)]:
    if -3.16<y<-1.84:continue
    cube('Street curb',(6.48,y,.074),(.09,.405,.13),concrete,.012)
for y in [1.95-i*.42 for i in range(29)]:cube('Outer curb',(10.13,y,.066),(.09,.405,.12),concrete,.012)
for y in [1.75-i*.82 for i in range(15)]:
    if -4.48<y<-3.48:continue
    cube('Centre dash',(8.05,y,.038),(.038,.36,.005),mark,.001)
for y in [-3.5-i*.17 for i in range(6)]:cube('Zebra crossing',(8.3,y,.039),(3.34,.078,.005),mark,.001)
for x in [6.25+i*.032 for i in range(6)]:cube('Exit trench slots',(x,-2.5,.039),(.014,.96,.006),stone_dark,.001)
for x in [6.28+i*.033 for i in range(4)]:
    for y in [-3.31-i*.055 for i in range(4)]:cylinder('Tactile stud',(x,y,.113),.007,.008,brass)
for x,y in [(7.05,-7.2),(9.6,-.8)]:
    cylinder('Recessed manhole',(x,y,.038),.19,.008,iron)
    for dy in [-.10,-.05,0,.05,.10]:cube('Manhole ribs',(x,y+dy,.044),(.25,.009,.004),stone_dark,.001)

# Entry equipment belongs beside the clear path, not inside the turning lane.
cube('Parking kiosk',(6.27,-1.67,.33),(.16,.18,.49),iron,.02)
cube('Kiosk recessed screen',(6.27,-1.565,.405),(.106,.009,.13),shopglass,.008)
cube('Ticket slot',(6.27,-1.563,.29),(.073,.008,.012),brass,.003)
cube('Gate housing',(6.2,-1.94,.22),(.10,.10,.37),iron,.018)

def planter(x,y,w,l):
    cube('Planter base',(x,y,.09),(w,l,.17),edge,.035)
    cube('Planter stone rim',(x,y,.16),(w+.02,l+.02,.07),concrete,.025)
    cube('Recessed planting soil',(x,y,.201),(w-.075,l-.075,.015),soil,.008)

def shrub(x,y,z,scale=.18):
    # Individually folded almond leaves, with small gaps for branch silhouettes.
    # Build each cluster directly as one mesh, avoiding hundreds of draw calls.
    vertices=[];faces=[];colours=[]
    for i in range(110):
        a=i*2.39996;h=1-2*(i+.5)/110;r=math.sqrt(1-h*h)
        normal=Vector((r*math.cos(a),r*math.sin(a),h))
        centre=Vector((x,y,z))+Vector((normal.x*scale,normal.y*scale,normal.z*scale*.8))*rng.uniform(.66,1.02)
        tangent=normal.cross(Vector((0,0,1)))
        if tangent.length<.05:tangent=Vector((1,0,0))
        tangent.normalize();bitangent=normal.cross(tangent).normalized()
        length=scale*rng.uniform(.28,.38);width=length*.46
        base=len(vertices)
        points=[centre-tangent*length,centre+bitangent*width,centre+tangent*length,centre-bitangent*width,centre+normal*width*.35,centre-normal*.004]
        vertices.extend(tuple(p) for p in points)
        shade=rng.randrange(len(leaves))
        for j in range(4):
            faces.append((base+j,base+(j+1)%4,base+4));colours.append(shade)
            # Double-sided folded leaves do not need a closed hidden underside.
    mesh=bpy.data.meshes.new('Folded fine foliage');mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new('Individual courtyard leaves',mesh);bpy.context.collection.objects.link(obj)
    # Preserve the authored palette without multiplying material batches.
    layer=mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER')
    for p in mesh.polygons:
        for loop in p.loop_indices:layer.data[loop].color=leaves[colours[p.index]].diffuse_color
    obj.data.materials.append(leaf_detail);objects.append(obj)

def tree(x,y):
    planter(x,y,.48,.53)
    cylinder('Tree trunk',(x,y,.55),.031,.78,timber)
    for i in range(5):
        a=i*math.tau/5
        strut('Fine tree branch',(x,y,.63),(x+math.cos(a)*.18,y+math.sin(a)*.18,.95),.012,timber)
        shrub(x+math.cos(a)*.14,y+math.sin(a)*.14,1.08+i*.013,.25)
    shrub(x,y,1.26,.23)

for x,y in [(-.68,-5.6),(5.66,.73),(6.0,-7.25),(-1.5,-6.95)]:tree(x,y)
for x,y,w,l in [(-.6,-2.9,.54,1.15),(2.1,.65,1.8,.42),(3.9,-6.65,1.65,.4)]:
    planter(x,y,w,l)
    count=max(2,math.ceil(max(w,l)/.25))
    for i in range(count):shrub(x+(i-(count-1)/2)*.23*(w>l),y+(i-(count-1)/2)*.23*(l>=w),.29,.15)

def bench(x,y,rotation=0):
    # Slats, airy underside and independent steel legs.
    before=len(objects)
    for dy in [-.28,.28]:cube('Bench steel leg',(x,y+dy,.19),(.38,.038,.27),iron,.007)
    for dx in [-.13,-.043,.043,.13]:cube('Oak seat slat',(x+dx,y,.33),(.073,.72,.035),timber,.01)
    for h in [.47,.56]:cube('Oak back slat',(x-.21,y,h),(.035,.74,.073),timber,.01)
    for dy in [-.28,.28]:cube('Bench back bracket',(x-.23,y+dy,.41),(.025,.027,.37),iron,.004)
    if rotation:
        for o in objects[before:]:
            dx=o.location.x-x;dy=o.location.y-y;o.location.x=x+dx*math.cos(rotation)-dy*math.sin(rotation);o.location.y=y+dx*math.sin(rotation)+dy*math.cos(rotation);o.rotation_euler.z+=rotation

bench(-.70,-4.22);bench(1.05,-6.73,math.pi/2)
for x,y in [(-.59,-3.6),(5.70,-6.70)]:
    cube('Litter bin',(x,y,.28),(.20,.22,.37),iron,.024)
    cube('Bin lid',(x,y,.48),(.23,.25,.028),brass,.009)
    cube('Bin recessed aperture',(x+.104,y,.403),(.008,.15,.051),stone_dark,.005)

def lamp_post(x,y):
    cylinder('Lamp base',(x,y,.15),.067,.1,iron)
    cylinder('Tapered street pole',(x,y,.79),.022,1.3,iron)
    cube('Lamp arm',(x+.13,y,1.41),(.29,.04,.04),iron,.01)
    cube('Architectural lamp head',(x+.23,y,1.405),(.22,.13,.05),iron,.02)
    cube('Recessed lamp diffuser',(x+.23,y,1.374),(.17,.09,.012),light,.006)
for x,y in [(-.68,-.16),(6.2,-5.45),(4.65,.74),(1.83,-7.0)]:lamp_post(x,y)

# Small brick cafe with a genuine recessed storefront and visible service details.
x,y=-1.32,-1.05
cube('Cafe solid volume',(x,y,.57),(1.14,1.50,.92),joint,.035)
for row in range(10):
    z=.15+row*.083
    for col in range(8):
        yy=y-.74+col*.20+(.10 if row%2 else 0)
        if yy>y+.74:continue
        if -.52<yy-y<.38 and .32<z<.79:continue
        cube('Cafe masonry',(x+.574,yy,z),(.028,.187,.071),rng.choice(brick),.005)
cube('Storefront recess',(x+.58,y-.03,.56),(.035,1.03,.50),charcoal,.007)
cube('Storefront reflection',(x+.601,y-.03,.59),(.01,.91,.33),shopglass,.006)
cube('Warm service interior',(x+.612,y-.03,.47),(.009,.83,.047),light,.002)
for yy in [y-.52,y-.02,y+.46]:cube('Storefront mullion',(x+.62,yy,.60),(.025,.023,.42),brass,.004)
cube('Oak service counter',(x+.71,y-.03,.375),(.23,1.12,.045),timber,.012)
for yy in [y-.3,y+.12]:
    cylinder('Coffee cup',(x+.74,yy,.425),.035,.048,cream)
    cylinder('Coffee cup rim',(x+.74,yy,.453),.038,.008,brass)
cube('Cafe door',(x+.595,y+.61,.44),(.025,.22,.66),charcoal,.01)
cube('Door inset',(x+.616,y+.61,.53),(.012,.17,.29),shopglass,.006)
cube('Door brass handle',(x+.641,y+.55,.46),(.028,.018,.12),brass,.004)
cube('Floating roof fascia',(x,y,1.07),(1.25,1.61,.10),charcoal,.03)
cube('Standing seam roof',(x,y,1.135),(1.23,1.59,.025),iron,.012)
for yy in [y-.65+i*.18 for i in range(8)]:cube('Roof standing seam',(x,yy,1.154),(1.15,.012,.015),iron,.004)
cube('Cafe canopy',(x+.74,y-.04,.91),(.50,1.18,.055),linen,.012)
for yy in [y-.58+i*.13 for i in range(9)]:cube('Canopy ribs',(x+.74,yy,.944),(.45,.012,.008),brass,.002)
for yy in [y-.54,y+.47]:strut('Canopy supports',(x+.57,yy,.86),(x+.95,yy,.86),.013,iron)
cube('Cafe sign backing',(x+.60,y-.04,1.004),(.025,.66,.106),charcoal,.008)
bpy.ops.object.text_add(location=(x+.62,y-.31,.978),rotation=(math.pi/2,0,math.pi/2))
obj=bpy.context.object;obj.name='Cafe engraved lettering';obj.data.body='ATELIER';obj.data.size=.068;obj.data.extrude=.001;obj.data.materials.append(brass);bpy.ops.object.convert(target='MESH');objects.append(bpy.context.object)

# Rear courtyard is a designed destination, not a naked road extension.
for x in [2.25,2.85,3.45]:
    cylinder('Cafe table pedestal',(x,-7.6,.27),.027,.33,iron)
    cylinder('Cafe table foot',(x,-7.6,.12),.11,.02,iron)
    cylinder('Cafe table top',(x,-7.6,.445),.20,.037,timber)
    for dy in [-.36,.36]:
        cube('Terrace chair seat',(x,-7.6+dy,.28),(.23,.21,.025),timber,.01)
        cube('Terrace chair back',(x,-7.6+dy+(.1 if dy>0 else -.1),.40),(.23,.028,.22),timber,.01)
        for dx in [-.09,.09]:cube('Terrace chair leg',(x+dx,-7.6+dy,.19),(.018,.16,.17),iron,.004)
for xx in [1.9,3.8]:
    for yy in [-7.12,-8.08]:cube('Pergola post',(xx,yy,.72),(.045,.045,1.22),iron,.008)
for xx in [1.88+i*.16 for i in range(13)]:cube('Pergola shade slat',(xx,-7.6,1.355),(.066,1.18,.037),timber,.006)

# Warm recessed perimeter luminaires: restrained detail for dusk/night themes.
for x in [1.5,3,4.5]:cube('Walkway light',(x,-6.30,.124),(.16,.045,.014),light,.005)
cube('Storm water grille',(5.60,-5.83,.039),(.51,.13,.006),iron,.006)
for x in [5.4+i*.05 for i in range(9)]:cube('Drain void',(x,-5.83,.044),(.013,.10,.004),stone_dark,.001)

garage=export('garage')
compact_source=os.path.join(ROOT,'scripts','compact_environment.py')
compact_scope={'__name__':'environment_compact'}
exec(compile(open(compact_source,encoding='utf8').read(),compact_source,'exec'),compact_scope)
compact_scope['compact_environment_glb'](os.path.join(OUT,'garage.glb'))
if 'assets' not in globals():
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','street-courtyard.blend'))
    print('ENVIRONMENT_BUILD_COMPLETE', OUT)
