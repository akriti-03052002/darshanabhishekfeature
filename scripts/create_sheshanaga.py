import bpy
import math
import os

# Clear default scene
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

# Helper: Create Principled BSDF Material
def create_pbr_material(name, base_color, metallic=0.0, roughness=0.5):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = base_color
        bsdf.inputs['Metallic'].default_value = metallic
        bsdf.inputs['Roughness'].default_value = roughness
    return mat

def build_sheshanaga_model(export_path, blend_path):
    reset_scene()
    
    # Material: Sacred Antique Temple Gold / Brass
    brass_mat = create_pbr_material("TempleGoldenBrass", (1.0, 0.86, 0.45, 1.0), metallic=0.92, roughness=0.22)
    ruby_mat = create_pbr_material("SacredRubyEye", (0.55, 0.02, 0.05, 1.0), metallic=0.3, roughness=0.15)
    
    root_obj = bpy.data.objects.new("SheshanagaRoot", None)
    bpy.context.collection.objects.link(root_obj)
    
    # 1. Base Coils (Kundalini Coils around Lingam plinth)
    curve_data = bpy.data.curves.new('NagaCoilsCurve', type='CURVE')
    curve_data.dimensions = '3D'
    curve_data.bevel_depth = 0.014
    curve_data.bevel_resolution = 6
    polyline = curve_data.splines.new('BEZIER')
    
    num_points = 18
    polyline.bezier_points.add(num_points - 1)
    for i in range(num_points):
        t = i / (num_points - 1)
        angle = t * math.pi * 3.2 - math.pi * 0.4
        r = 0.165 - t * 0.018
        y_pos = 0.118 + t * 0.052
        # Three.js (x, y, z) maps to Blender (x, -z, y) or standard orientation
        # Let's keep native Three.js coordinates: X=right, Y=up, Z=forward
        # Blender coordinates: X=right, Y=forward, Z=up.
        # glTF exporter in Blender automatically converts Y-up when exporting!
        # In Blender: Z is UP, Y is BACK/FORWARD.
        # Three.js (x, y, z) -> Blender (x, -z, y):
        bx = math.cos(angle) * r
        by = -math.sin(angle) * r
        bz = y_pos
        
        pt = polyline.bezier_points[i]
        pt.co = (bx, by, bz)
        pt.handle_left_type = 'AUTO'
        pt.handle_right_type = 'AUTO'
        
    coils_obj = bpy.data.objects.new("SheshanagaCoils", curve_data)
    coils_obj.data.materials.append(brass_mat)
    bpy.context.collection.objects.link(coils_obj)
    coils_obj.parent = root_obj
    
    # 2. Ascending Spine Trunk
    spine_curve = bpy.data.curves.new('NagaSpineCurve', type='CURVE')
    spine_curve.dimensions = '3D'
    spine_curve.bevel_depth = 0.022
    spine_curve.bevel_resolution = 8
    spine_poly = spine_curve.splines.new('BEZIER')
    
    spine_pts = [
        (0.0, 0.165, 0.166),
        (0.0, 0.160, 0.280),
        (0.0, 0.150, 0.420),
        (0.0, 0.130, 0.540),
        (0.0, 0.095, 0.640),
        (0.0, 0.045, 0.710)
    ]
    spine_poly.bezier_points.add(len(spine_pts) - 1)
    for i, (sx, sy, sz) in enumerate(spine_pts):
        pt = spine_poly.bezier_points[i]
        pt.co = (sx, sy, sz)
        pt.handle_left_type = 'AUTO'
        pt.handle_right_type = 'AUTO'
        
    spine_obj = bpy.data.objects.new("SheshanagaSpine", spine_curve)
    spine_obj.data.materials.append(brass_mat)
    bpy.context.collection.objects.link(spine_obj)
    spine_obj.parent = root_obj

    # 3. Flared Cobra Hood Fan Mesh
    mesh_data = bpy.data.meshes.new("NagaHoodMesh")
    vertices = []
    faces = []
    
    width_segs = 32
    height_segs = 24
    
    for j in range(height_segs + 1):
        v = j / height_segs
        bz = 0.20 + v * 0.54
        by_base = 0.155 - v * 0.10
        fwd_arch = math.pow(v, 2.2) * 0.035
        by = by_base - fwd_arch
        
        span_x = 0.07 + math.sin(math.pow(v, 0.75) * math.pi * 0.88) * 0.138
        
        for i in range(width_segs + 1):
            u = (i / width_segs) * 2.0 - 1.0
            bx = u * span_x
            dish_y = -(1.0 - u * u) * 0.032
            flute = math.cos(u * 7.0 * math.pi) * 0.006 * (1.0 - u * u * 0.25)
            
            vertices.append((bx, by + dish_y + flute, bz))
            
    for j in range(height_segs):
        for i in range(width_segs):
            a = j * (width_segs + 1) + i
            b = (j + 1) * (width_segs + 1) + i
            c = (j + 1) * (width_segs + 1) + (i + 1)
            d = j * (width_segs + 1) + (i + 1)
            faces.append((a, b, c, d))
            
    mesh_data.from_pydata(vertices, [], faces)
    mesh_data.update()
    
    hood_obj = bpy.data.objects.new("SheshanagaHood", mesh_data)
    hood_obj.data.materials.append(brass_mat)
    bpy.context.collection.objects.link(hood_obj)
    hood_obj.parent = root_obj
    
    # Smooth shading & Solidify modifier for rich sculptural thickness
    for poly in hood_obj.data.polygons:
        poly.use_smooth = True
    sol_mod = hood_obj.modifiers.new(name="Solidify", type='SOLIDIFY')
    sol_mod.thickness = 0.008
    sub_mod = hood_obj.modifiers.new(name="Subsurf", type='SUBSURF')
    sub_mod.levels = 1
    
    # 4. Sculpted 7 Cobra Heads (Sapta-Mukhi)
    head_configs = [
        (0, 0.0, 0.018, 0.742, 0.0, 0.38, 1.30),
        (-1, -0.046, 0.024, 0.735, -0.18, 0.35, 1.15),
        (1, 0.046, 0.024, 0.735, 0.18, 0.35, 1.15),
        (-2, -0.092, 0.038, 0.718, -0.36, 0.30, 1.05),
        (2, 0.092, 0.038, 0.718, 0.36, 0.30, 1.05),
        (-3, -0.138, 0.058, 0.690, -0.54, 0.25, 0.95),
        (3, 0.138, 0.058, 0.690, 0.54, 0.25, 0.95)
    ]
    
    for idx, hx, hy, hz, rot_z, rot_x, scale in head_configs:
        # Create head mesh (beveled snout + flared hood wings)
        bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.015 * scale, depth=0.042 * scale, location=(hx, -hy, hz))
        head = bpy.context.active_object
        head.name = f"NagaHead_{idx}"
        head.rotation_euler = (rot_x, 0, rot_z)
        head.scale = (1.15, 0.65, 1.35)
        head.data.materials.append(brass_mat)
        head.parent = root_obj
        for p in head.data.polygons:
            p.use_smooth = True
            
        # Ruby eyes
        for eye_side in (-1, 1):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0024 * scale, location=(hx + eye_side * 0.008 * scale, -hy - 0.007 * scale, hz + 0.004 * scale))
            eye = bpy.context.active_object
            eye.name = f"NagaEye_{idx}_{eye_side}"
            eye.data.materials.append(ruby_mat)
            eye.parent = head
            
        # Center head crown
        if idx == 0:
            bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.008 * scale, depth=0.024 * scale, location=(hx, -hy + 0.006 * scale, hz + 0.018 * scale))
            crown = bpy.context.active_object
            crown.name = "NagaCrown"
            crown.data.materials.append(brass_mat)
            crown.parent = head
            
    # Save .blend
    os.makedirs(os.path.dirname(blend_path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    
    # Export GLB (Y-up standard for Three.js)
    os.makedirs(os.path.dirname(export_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print("SUCCESS: Exported Sheshanaga GLB to", export_path)

if __name__ == "__main__":
    out_glb = r"C:\Users\akrit\Downloads\darshan-—-first-person-pooja-&-seva (1)\public\models\sheshanaga_gold_canopy.glb"
    out_blend = r"C:\Users\akrit\Downloads\darshan-—-first-person-pooja-&-seva (1)\assets\blender\sheshanaga_gold_canopy.blend"
    build_sheshanaga_model(out_glb, out_blend)
    bpy.ops.wm.quit_blender()
