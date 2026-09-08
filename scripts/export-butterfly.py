"""Convert the credited CC0 Butterfly .blend to a self-contained GLB.
Run with Blender 4.4 --background --disable-autoexec source.blend --python ...
"""
import bpy
from pathlib import Path
scene=bpy.context.scene
if bpy.context.object and bpy.context.object.mode!='OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
rig=bpy.data.objects['Armature']
mesh=bpy.data.objects['Butterfly']
mesh.animation_data_clear()
mesh.data.validate()
image=bpy.data.images['butterfly-skin']
image.filepath=str(Path(bpy.data.filepath).parent/'butterfly-skin.png')
image.reload()
image.pack()
mat=bpy.data.materials.new('Monarch wing scales')
mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value=.85
tex=mat.node_tree.nodes.new('ShaderNodeTexImage')
tex.image=image
mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
mat.node_tree.links.new(tex.outputs['Alpha'],bsdf.inputs['Alpha'])
mesh.data.materials.clear()
mesh.data.materials.append(mat)
rig.animation_data.action=bpy.data.actions['Flying']
scene.frame_set(0)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
mesh.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(Path(__file__).resolve().parent.parent/'public/assets/woodland/butterfly.glb'),
    export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',
    export_frame_range=False,export_force_sampling=True,export_cameras=False,export_lights=False)
