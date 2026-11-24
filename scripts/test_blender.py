import bpy

print("=== BLENDER PYTHON HEADLESS VERIFIED ===")
print("Version:", bpy.app.version_string)
bpy.ops.wm.quit_blender()
