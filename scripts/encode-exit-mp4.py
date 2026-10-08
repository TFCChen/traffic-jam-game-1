"""Encode timestamped screen captures with Blender's built-in H.264 encoder."""
import bpy,json,sys,os,math,bisect
args=sys.argv[sys.argv.index('--')+1:]
for source,target in zip(args[::2],args[1::2]):
    frames=json.load(open(source,encoding='utf8'));times=[f['time']for f in frames]
    scene=bpy.context.scene
    if scene.sequence_editor:scene.sequence_editor_clear()
    sequence=scene.sequence_editor_create();fps=30
    count=math.ceil((times[-1]-times[0]+1/fps)*fps)
    first=os.path.abspath(frames[0]['path'])
    strip=sequence.strips.new_image('Recorded gameplay',first,channel=1,frame_start=1)
    for i in range(1,count):
        index=max(0,min(len(frames)-1,bisect.bisect_right(times,times[0]+i/fps)-1))
        strip.elements.append(os.path.basename(frames[index]['path']))
    scene.frame_start=1;scene.frame_end=count
    scene.render.resolution_x=1280;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.fps=fps;scene.render.use_sequencer=True
    scene.render.image_settings.file_format='FFMPEG'
    scene.render.ffmpeg.format='MPEG4';scene.render.ffmpeg.codec='H264'
    scene.render.ffmpeg.constant_rate_factor='HIGH';scene.render.ffmpeg.audio_codec='NONE'
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
    scene.render.filepath=os.path.abspath(target)
    bpy.ops.render.render(animation=True)
    print('EXIT_VIDEO_COMPLETE',target,count,'frames')
