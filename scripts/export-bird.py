"""Build ECOVERSE's CC0 shrike GLB using Blender 4.4 in background mode.
Open the credited source .blend with --disable-autoexec before this script.
The source rig has no animation; Flight and Perch below are project-authored.
"""
import bpy
import math
from mathutils import Quaternion, Vector, Matrix
from pathlib import Path

rig = bpy.data.objects['Bird_YBShrike Rig']
bird = bpy.data.objects['Bird_YBShrike']
scene = bpy.context.scene
scene.render.fps = 30
original = {p.name:p.matrix_basis.copy() for p in rig.pose.bones}
rig.animation_data_create()

# Replace legacy Blender Internal materials with a glTF-compatible PBR material.
mat = bpy.data.materials.new('Shrike feather plumage')
mat.use_nodes = True
nodes = mat.node_tree.nodes
bsdf = nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value = .85
diff = nodes.new('ShaderNodeTexImage')
diff.image = bpy.data.images['bird_shrike1_diff']
mat.node_tree.links.new(diff.outputs['Color'],bsdf.inputs['Base Color'])
mat.node_tree.links.new(diff.outputs['Alpha'],bsdf.inputs['Alpha'])
norm = nodes.new('ShaderNodeTexImage')
norm.image = bpy.data.images['bird_shrike1_norm']
norm.image.colorspace_settings.name = 'Non-Color'
normal = nodes.new('ShaderNodeNormalMap')
normal.inputs['Strength'].default_value = .5
mat.node_tree.links.new(norm.outputs['Color'],normal.inputs['Color'])
mat.node_tree.links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
bird.data.materials.clear()
bird.data.materials.append(mat)
for image in [diff.image,norm.image]:
    image.filepath = str(Path(bpy.data.filepath).parent/'textures'/(image.name+'.png'))
    image.reload()
    image.scale(1024,1024)
    image.pack()

for name,frames in [('Flight',[0,3,6,9,12]),('Perch',[0,15,30])]:
    action=bpy.data.actions.new(name)
    rig.animation_data.action=action
    for frame in frames:
        scene.frame_set(frame)
        for p in rig.pose.bones:
            p.matrix_basis=Matrix.Identity(4)
            p.rotation_mode='QUATERNION'
        if name=='Flight':
            flap=math.sin(frame/12*math.tau)
            for side,sign in [('L',-1),('R',1)]:
                p=rig.pose.bones['shoulder.'+side]
                axis=p.bone.matrix_local.to_quaternion().inverted()@Vector((0,1,0))
                p.rotation_quaternion=Quaternion(axis,sign*flap*.95)
        else:
            for side,sign in [('L',1),('R',-1)]:
                p=rig.pose.bones['shoulder.'+side]
                axis=p.bone.matrix_local.to_quaternion().inverted()@Vector((0,0,1))
                p.rotation_quaternion=Quaternion(axis,sign*1.3)
            p=rig.pose.bones['head']
            p.rotation_quaternion @= Quaternion((0,1,0),.12 if frame==15 else 0)
        for p in rig.pose.bones:
            p.keyframe_insert('location',frame=frame)
            p.keyframe_insert('rotation_quaternion',frame=frame)
            p.keyframe_insert('scale',frame=frame)
    action.use_fake_user=True

rig.animation_data.action=bpy.data.actions['Flight']
scene.frame_set(0)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bird.select_set(True)
bpy.context.view_layer.objects.active=rig
output=Path(__file__).resolve().parent.parent/'public/assets/woodland/bird.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,
    export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,
    export_force_sampling=True,export_cameras=False,export_lights=False)
print('EXPORTED',output)
