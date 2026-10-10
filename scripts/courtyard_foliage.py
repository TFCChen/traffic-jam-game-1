"""Connected branching plants. Every leaf grows from a modeled twig."""
import math
import random
import bpy
from mathutils import Vector

def foliage(x,y,z,scale,material,palette,objects,canopy=False,bark=None):
    rng=random.Random(284+round((x+20)*10000)+round((y+20)*317))
    vertices,faces,colours,wood_vertices,wood_faces=[],[],[],[],[]
    segments,anchors=[],[]
    def tube(a,b,r1,r2,sides=4):
        direction=(b-a).normalized();axis=direction.cross(Vector((0,0,1)))
        if axis.length<.05:axis=direction.cross(Vector((0,1,0)))
        axis.normalize();across=direction.cross(axis).normalized();start=len(wood_vertices)
        for p,radius in [(a,r1),(b,r2)]:
            for i in range(sides):
                angle=i*math.tau/sides;wood_vertices.append(tuple(p+radius*(axis*math.cos(angle)+across*math.sin(angle))))
        for i in range(sides):
            j=(i+1)%sides;wood_faces.extend([(start+i,start+j,start+sides+j),(start+i,start+sides+j,start+sides+i)])
        segments.append((a.copy(),b.copy()))
    def shoot(a,b,radius,bend=.015,sides=4):
        mid=a.lerp(b,.5)+Vector((rng.uniform(-bend,bend),rng.uniform(-bend,bend),rng.uniform(0,bend)))
        tube(a,mid,radius,radius*.64,sides);tube(mid,b,radius*.64,radius*.22,sides);return [a,mid,b]
    def along(path,t):
        t=max(0,min(1,t));return path[0].lerp(path[1],t*2) if t<.5 else path[1].lerp(path[2],(t-.5)*2)
    def leaf(anchor,direction,shade):
        # Narrow leaf base embeds in the twig; a folded rib and six outline
        # points give a softer almond silhouette than the old diamond cards.
        axis=direction.normalized();across=axis.cross(Vector((0,0,1)))
        if across.length<.05:across=axis.cross(Vector((0,1,0)))
        across.normalize();normal=across.cross(axis).normalized()
        if normal.z<0:normal.negate()
        length=rng.uniform(.027,.040) if canopy else rng.uniform(.021,.033);width=length*rng.uniform(.38,.48)
        centre=anchor+axis*length;start=len(vertices)
        outline=[anchor,centre-axis*length*.35+across*width,centre+axis*length*.40+across*width*.85,
                 anchor+axis*length*2,centre+axis*length*.40-across*width*.85,centre-axis*length*.35-across*width]
        vertices.extend(tuple(p) for p in outline+[centre+normal*width*.24])
        shade=max(0,min(3,shade+rng.choice([-1,0,0,0,0,1])))
        for i in range(6):faces.append((start+i,start+(i+1)%6,start+6));colours.append(palette[shade].diffuse_color[:])
        anchors.append(anchor.copy())
    def terminal(a,b,shade):
        path=shoot(a,b,.0018 if canopy else .0012,bend=.006,sides=3)
        direction=(b-a).normalized();azimuth=math.atan2(direction.y,direction.x)
        for i in range(5):
            anchor=along(path,.18+i*.18+rng.uniform(-.045,.045));angle=azimuth+(1 if i%2 else -1)*rng.uniform(.75,1.6)
            leaf(anchor,Vector((math.cos(angle),math.sin(angle),rng.uniform(-.15,.55))),shade)
        leaf(b,direction+Vector((0,0,.25)),shade)
    if canopy:
        # Bent, tapered leader. Forks start at staggered heights and curve
        # before splitting into leafy lateral shoots, rather than five spokes.
        trunk=[Vector((x,y,.17))]
        for h in [.43,.66,.86,1.07,1.29]:trunk.append(Vector((x+rng.uniform(-.023,.023),y+rng.uniform(-.021,.021),h)))
        for i in range(len(trunk)-1):tube(trunk[i],trunk[i+1],.034-i*.005,.029-i*.005,8)
        for i in range(7):
            height=rng.uniform(.65,1.08);parent=min(range(len(trunk)-1),key=lambda j:abs((trunk[j].z+trunk[j+1].z)/2-height))
            a=trunk[parent].lerp(trunk[parent+1],max(0,min(1,(height-trunk[parent].z)/(trunk[parent+1].z-trunk[parent].z))))
            angle=i*math.tau/7+rng.uniform(-.4,.4);radius=rng.uniform(.18,.29)
            b=Vector((x+math.cos(angle)*radius,y+math.sin(angle)*radius,rng.uniform(1.06,1.30)))
            primary=shoot(a,b,rng.uniform(.008,.013),bend=.035,sides=5);shade=rng.choice([0,1,1,2])
            for j in range(6):
                start=along(primary,.30+j*.115+rng.uniform(-.035,.035));bearing=angle+rng.uniform(-1.35,1.35);reach=rng.uniform(.08,.145)
                end=start+Vector((math.cos(bearing)*reach,math.sin(bearing)*reach,rng.uniform(.06,.16)))
                secondary=shoot(start,end,.0042,bend=.012)
                for k in range(4):
                    root=along(secondary,.23+k*.23+rng.uniform(-.05,.05));bearing2=bearing+(1 if k%2 else -1)*rng.uniform(.6,1.6)
                    tip=root+Vector((math.cos(bearing2)*rng.uniform(.04,.085),math.sin(bearing2)*rng.uniform(.04,.085),rng.uniform(.01,.07)))
                    terminal(root,tip,shade)
        # Inner shoots fill the crown around the leader as well as its edges.
        # Leaves still attach to real branches; there is no hidden filler ball.
        for i in range(8):
            root=along(trunk[-3:],.08+i*.11);angle=rng.uniform(0,math.tau)
            end=root+Vector((math.cos(angle)*rng.uniform(.07,.14),math.sin(angle)*rng.uniform(.07,.14),rng.uniform(.03,.09)))
            inner=shoot(root,end,.0035,bend=.012)
            for j in range(5):
                a=along(inner,.25+j*.17);bearing=angle+rng.uniform(-1.6,1.6)
                terminal(a,a+Vector((math.cos(bearing)*.065,math.sin(bearing)*.065,rng.uniform(.02,.07))),1)
    else:
        # Soil-rooted shrub stems split into overlapping dense leafy fans.
        root=Vector((x,y,.202))
        for i in range(6):
            angle=i*math.tau/6+rng.uniform(-.45,.45)
            end=Vector((x+math.cos(angle)*scale*.8,y+math.sin(angle)*scale*.8,z+rng.uniform(.025,.075)))
            stem=shoot(root,end,.005,bend=.013)
            for j in range(7):
                a=along(stem,.30+j*.11);bearing=angle+(1 if j%2 else -1)*rng.uniform(.6,1.6)
                b=a+Vector((math.cos(bearing)*scale*.60,math.sin(bearing)*scale*.60,rng.uniform(.015,.065)))
                terminal(a,b,rng.choice([0,1,1,2]))
    def distance(point,segment):
        a,b=segment;delta=b-a;t=max(0,min(1,(point-a).dot(delta)/delta.length_squared));return (point-(a+delta*t)).length
    max_gap=max(min(distance(p,s) for s in segments) for p in anchors)
    assert max_gap<.000001,'Every leaf base must touch a branch'
    result=[]
    for name,verts,polygons,mat in [('Courtyard foliage detail',vertices,faces,material),('Courtyard bark',wood_vertices,wood_faces,bark)]:
        assert mat is not None,'Plant bark material required'
        mesh=bpy.data.meshes.new(name+' connected geometry');mesh.from_pydata(verts,[],polygons);mesh.update()
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
        if mat==material:
            layer=mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='CORNER')
            for polygon in mesh.polygons:
                polygon.use_smooth=True
                for loop in polygon.loop_indices:layer.data[loop].color=colours[polygon.index]
        else:
            for polygon in mesh.polygons:polygon.use_smooth=True
        mesh.materials.append(mat);objects.append(obj);result.append(obj)
    result[0]['attachedLeaves']=len(anchors);result[0]['maxAttachmentGap']=max_gap
    return result[0]
