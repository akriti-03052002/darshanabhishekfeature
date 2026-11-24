import bpy
import math
import os

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

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

def create_master_sheshanaga():
    reset_scene()
    
    # 1. PBR Materials
    gold_mat = create_pbr_material("TempleAntiqueGold", (1.0, 0.84, 0.42, 1.0), metallic=0.92, roughness=0.22)
    ruby_mat = create_pbr_material("SacredRubyEye", (0.55, 0.02, 0.05, 1.0), metallic=0.35, roughness=0.12)
    
    root = bpy.data.objects.new("SheshanagaMaster", None)
    bpy.context.collection.objects.link(root)
    
    # 2. Triple Kundalini Base Coils (wrapping around Lingam base on Yoni plinth)
    coils_curve = bpy.data.curves.new('NagaCoils', type='CURVE')
    coils_curve.dimensions = '3D'
    coils_curve.bevel_depth = 0.016
    coils_curve.bevel_resolution = 8
    spline = coils_curve.splines.new('BEZIER')
    
    num_pts = 24
    spline.bezier_points.add(num_pts - 1)
    for i in range(num_pts):
        t = i / (num_pts - 1)
        ang = t * math.pi * 3.4 - math.pi * 0.45
        r = 0.168 - t * 0.018
        y_h = 0.116 + t * 0.058
        
        bx = math.cos(ang) * r
        by = -math.sin(ang) * r
        bz = y_h
        
        pt = spline.bezier_points[i]
        pt.co = (bx, by, bz)
        pt.handle_left_type = 'AUTO'
        pt.handle_right_type = 'AUTO'
        
    coils_obj = bpy.data.objects.new("Coils", coils_curve)
    coils_obj.data.materials.append(gold_mat)
    bpy.context.collection.objects.link(coils_obj)
    coils_obj.parent = root
    
    # 3. Ascending Serpent Spine Trunk
    spine_curve = bpy.data.curves.new('NagaSpine', type='CURVE')
    spine_curve.dimensions = '3D'
    spine_curve.bevel_depth = 0.024
    spine_curve.bevel_resolution = 10
    s_spline = spine_curve.splines.new('BEZIER')
    
    spine_pts = [
        (0.0, 0.170, 0.166),
        (0.0, 0.165, 0.280),
        (0.0, 0.155, 0.420),
        (0.0, 0.135, 0.540),
        (0.0, 0.095, 0.640),
        (0.0, 0.040, 0.720)
    ]
    s_spline.bezier_points.add(len(spine_pts) - 1)
    for i, (sx, sy, sz) in enumerate(spine_pts):
        pt = s_spline.bezier_points[i]
        pt.co = (sx, sy, sz)
        pt.handle_left_type = 'AUTO'
        pt.handle_right_type = 'AUTO'
        
    spine_obj = bpy.data.objects.new("SpineTrunk", spine_curve)
    spine_obj.data.materials.append(gold_mat)
    bpy.context.collection.objects.link(spine_obj)
    spine_obj.parent = root

    # 4. Flared 7-Headed Cobra Hood Canopy (Vertical Broad Fan with Forward Arch)
    # Matching Panel 2 of Visual Reference Board
    mesh = bpy.data.meshes.new("NagaHoodCanopyMesh")
    w_segs = 36
    h_segs = 28
    
    verts = []
    uvs = []
    faces = []
    
    for j in range(h_segs + 1):
        v = j / h_segs
        # Height rises from base (z=0.20) up to crown (z=0.76)
        bz = 0.20 + v * 0.56
        # Curves forward at the top over the dome:
        by_base = 0.160 - v * 0.11
        fwd_cup = math.pow(v, 2.0) * 0.055
        by = by_base - fwd_cup
        
        # Broad majestic fan flare: half-width spans up to 0.22m (44cm total spread!)
        span_x = 0.075 + math.sin(math.pow(v, 0.70) * math.pi * 0.88) * 0.145
        
        for i in range(w_segs + 1):
            u = (i / w_segs) * 2.0 - 1.0
            bx = u * span_x
            dish_y = -(1.0 - u * u) * 0.038
            # 7 distinct vertical fluted ridges corresponding to the 7 serpent heads
            flute = math.cos(u * 7.0 * math.pi) * 0.008 * (1.0 - u * u * 0.2)
            
            verts.append((bx, by + dish_y + flute, bz))
            uvs.append(((u + 1) * 0.5, v))
            
    for j in range(h_segs):
        for i in range(w_segs):
            a = j * (w_segs + 1) + i
            b = (j + 1) * (w_segs + 1) + i
            c = (j + 1) * (w_segs + 1) + (i + 1)
            d = j * (w_segs + 1) + (i + 1)
            faces.append((a, b, c, d))
            
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    
    hood_obj = bpy.data.objects.new("SheshanagaCanopy", mesh)
    hood_obj.data.materials.append(gold_mat)
    bpy.context.collection.objects.link(hood_obj)
    hood_obj.parent = root
    
    for p in hood_obj.data.polygons:
        p.use_smooth = True
    sol = hood_obj.modifiers.new(name="Solidify", type='SOLIDIFY')
    sol.thickness = 0.009
    sub = hood_obj.modifiers.new(name="Subsurf", type='SUBSURF')
    sub.levels = 1
    
    # 5. Seven Sculpted Cobra Heads (Sapta-Mukhi) crowning the top rim
    head_cfgs = [
        (0, 0.0, 0.015, 0.755, 0.0, 0.42, 1.35),
        (-1, -0.048, 0.022, 0.748, -0.16, 0.38, 1.20),
        (1, 0.048, 0.022, 0.748, 0.16, 0.38, 1.20),
        (-2, -0.096, 0.038, 0.730, -0.32, 0.34, 1.10),
        (2, 0.096, 0.038, 0.730, 0.32, 0.34, 1.10),
        (-3, -0.142, 0.060, 0.702, -0.48, 0.28, 0.98),
        (3, 0.142, 0.060, 0.702, 0.48, 0.28, 0.98)
    ]
    
    for idx, hx, hy, hz, rz, rx, s in head_cfgs:
        bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.016 * s, depth=0.045 * s, location=(hx, -hy, hz))
        head = bpy.context.active_object
        head.name = f"Head_{idx}"
        head.rotation_euler = (rx, 0, rz)
        head.scale = (1.18, 0.65, 1.38)
        head.data.materials.append(gold_mat)
        head.parent = root
        for p in head.data.polygons:
            p.use_smooth = True
            
        # Lateral hood flange wings
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.002 * s, -0.010 * s))
        flange = bpy.context.active_object
        flange.name = f"Flange_{idx}"
        flange.scale = (0.030 * s, 0.006 * s, 0.026 * s)
        flange.data.materials.append(gold_mat)
        flange.parent = head
        
        # Center head royal crown (Kireeta)
        if idx == 0:
            bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.009 * s, depth=0.026 * s, location=(hx, -hy + 0.006 * s, hz + 0.020 * s))
            crown = bpy.context.active_object
            crown.name = "RoyalCrown"
            crown.data.materials.append(gold_mat)
            crown.parent = head
            
        # Polished ruby eyes
        for side in (-1, 1):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0026 * s, location=(hx + side * 0.0085 * s, -hy - 0.008 * s, hz + 0.005 * s))
            eye = bpy.context.active_object
            eye.name = f"Eye_{idx}_{side}"
            eye.data.materials.append(ruby_mat)
            eye.parent = head

    # Save and export
    blend_path = r"C:\Users\akrit\Downloads\darshan-—-first-person-pooja-&-seva (1)\assets\blender\sheshanaga_master.blend"
    glb_path = r"C:\Users\akrit\Downloads\darshan-—-first-person-pooja-&-seva (1)\public\models\sheshanaga_master.glb"
    
    os.makedirs(os.path.dirname(blend_path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    
    os.makedirs(os.path.dirname(glb_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print("SUCCESS: Exported Master Sheshanaga GLB to", glb_path)

if __name__ == "__main__":
    create_master_sheshanaga()
    bpy.ops.wm.quit_blender()
