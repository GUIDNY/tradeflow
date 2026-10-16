"""Tiny stand-in models for the asset test (tests/run.mjs 'assets'): one per replaceable slot, made to the slot's spec
(origin, axes, metres; see ASSETS.md). They only prove that a listed model is loaded and placed where the generator would
build; they are not meant to look good. Run: python3 make.py (writes the .glb files next to this script)."""
import json, math, os, struct

def glb(path, prims):
    """prims: [(triangles [[(x,y,z)*3]...], material dict)] -> one mesh, one primitive per material, flat normals"""
    bin_ = bytearray(); views = []; accs = []; gprims = []; mats = []
    def add(data, target, fmt, count, typ, ctype, mn=None, mx=None):
        while len(bin_) % 4: bin_.append(0)
        off = len(bin_); bin_.extend(struct.pack('<' + fmt * (len(data)), *data))
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(bin_) - off, 'target': target})
        a = {'bufferView': len(views) - 1, 'componentType': ctype, 'count': count, 'type': typ}
        if mn is not None: a['min'] = mn; a['max'] = mx
        accs.append(a); return len(accs) - 1
    for tris, mat in prims:
        pos = []; nor = []
        for a, b, c in tris:
            ux, uy, uz = b[0]-a[0], b[1]-a[1], b[2]-a[2]; vx, vy, vz = c[0]-a[0], c[1]-a[1], c[2]-a[2]
            n = (uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx); l = math.sqrt(sum(t*t for t in n)) or 1
            for p in (a, b, c): pos += list(p); nor += [n[0]/l, n[1]/l, n[2]/l]
        cnt = len(pos)//3
        mn = [min(pos[i::3]) for i in range(3)]; mx = [max(pos[i::3]) for i in range(3)]
        pa = add(pos, 34962, 'f', cnt, 'VEC3', 5126, mn, mx); na = add(nor, 34962, 'f', cnt, 'VEC3', 5126)
        ia = add(list(range(cnt)), 34963, 'H', cnt, 'SCALAR', 5123)
        m = {'pbrMetallicRoughness': {'baseColorFactor': mat.get('color', [1, 1, 1, 1]), 'metallicFactor': 0, 'roughnessFactor': mat.get('rough', .8)}}
        if 'emissive' in mat: m['emissiveFactor'] = mat['emissive']
        mats.append(m); gprims.append({'attributes': {'POSITION': pa, 'NORMAL': na}, 'indices': ia, 'material': len(mats)-1})
    while len(bin_) % 4: bin_.append(0)
    js = {'asset': {'version': '2.0', 'generator': 'snowrush fixtures'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': os.path.basename(path)[:-4]}],
          'meshes': [{'primitives': gprims}], 'materials': mats, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(bin_)}]}
    j = json.dumps(js, separators=(',', ':')).encode()
    while len(j) % 4: j += b' '
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(j) + 8 + len(bin_)) + struct.pack('<II', len(j), 0x4E4F534A) + j + struct.pack('<II', len(bin_), 0x004E4942) + bytes(bin_)
    open(path, 'wb').write(out); print(path, sum(len(t) for t, _ in prims), 'tris', len(out), 'bytes')

def outward(tris, c):
    bad = 0
    for a, b, cc in tris:
        n = ((b[1]-a[1])*(cc[2]-a[2])-(b[2]-a[2])*(cc[1]-a[1]), (b[2]-a[2])*(cc[0]-a[0])-(b[0]-a[0])*(cc[2]-a[2]), (b[0]-a[0])*(cc[1]-a[1])-(b[1]-a[1])*(cc[0]-a[0]))
        m = [(a[i]+b[i]+cc[i])/3-c[i] for i in range(3)]
        if sum(n[i]*m[i] for i in range(3)) < 0: bad += 1
    return bad

def box(x0, y0, z0, x1, y1, z1):
    v = lambda i: (x1 if i & 1 else x0, y1 if i & 2 else y0, z1 if i & 4 else z0)
    faces = [(0, 2, 6, 4), (1, 5, 7, 3), (0, 4, 5, 1), (2, 3, 7, 6), (0, 1, 3, 2), (4, 6, 7, 5)]   # -x +x -y +y -z +z, outward
    out = []
    for a, b, c, d in faces: out += [(v(a), v(c), v(b)), (v(a), v(d), v(c))]
    return out

def lathe(prof, n, cx=0, cz=0, sx=1, sz=1):
    """surface of revolution: prof = [(r, y)] bottom to top"""
    out = []
    for i in range(n):
        a0, a1 = i/n*2*math.pi, (i+1)/n*2*math.pi
        for (r0, y0), (r1, y1) in zip(prof, prof[1:]):
            p = lambda r, y, a: (cx + math.cos(a)*r*sx, y, cz + math.sin(a)*r*sz)
            A, B, C, D = p(r0, y0, a0), p(r0, y0, a1), p(r1, y1, a1), p(r1, y1, a0)
            if r0 > 1e-6: out.append((A, C, B))
            if r1 > 1e-6: out.append((A, D, C))
    return out

assert outward(box(-1, -1, -1, 1, 1, 1), (0, 0, 0)) == 0, 'box winding'
d = os.path.dirname(os.path.abspath(__file__))
# helmet: a shell over the head pivot (the top of the neck), like the game's own: centre .105 up, slightly back
dome = [(math.sin(t)*.16, .105 + math.cos(t)*.157) for t in [math.pi*.6*(1-i/10) for i in range(11)]]
glb(os.path.join(d, 'helmet.glb'), [(lathe(dome, 20, cz=-.015, sz=1.12), {'color': [.95, .95, .95, 1], 'rough': .5})])
glb(os.path.join(d, 'goggles.glb'), [(box(-.11, .065, .1, .11, .15, .16), {'color': [1, .45, .1, 1], 'rough': .15, 'emissive': [.6, .25, .05]})])
# a left mitt: origin at the wrist, fingers toward +X, palm down
glb(os.path.join(d, 'mitt.glb'), [(box(-.02, -.05, -.055, .16, .05, .055), {'color': [.1, .1, .12, 1]})])
# a tree: trunk (bark) and three tiers (needles); origin at the foot of the trunk; 12 m tall (the game rescales it)
tiers = []
for i, (r, y0, h) in enumerate([(3.2, 2, 5), (2.4, 5, 4.5), (1.5, 8, 4)]): tiers += lathe([(r, y0), (0, y0 + h)], 10) + lathe([(0, y0), (r, y0)], 10)
glb(os.path.join(d, 'tree.glb'), [(lathe([(.3, 0), (.2, 3)], 6), {'color': [.25, .15, .1, 1]}), (tiers, {'color': [.1, .3, .15, 1]})])
glb(os.path.join(d, 'tree_far.glb'), [(lathe([(3, 1), (0, 12)], 5), {'color': [.1, .3, .15, 1]})])
# a house: 10 m wide (x), 12 m deep (z), front +Z; walls from a plinth 1.5 m below the origin to 7 m, a gable roof, lit windows
walls = box(-5, -1.5, -6, 5, 7, 6)
roof = [((-5.6, 7, -6.4), (0, 10, 6.4), (0, 10, -6.4)), ((-5.6, 7, -6.4), (-5.6, 7, 6.4), (0, 10, 6.4)), ((5.6, 7, -6.4), (0, 10, 6.4), (5.6, 7, 6.4)), ((5.6, 7, -6.4), (0, 10, -6.4), (0, 10, 6.4)),
        ((-5, 7, 6), (5, 7, 6), (0, 10, 6)), ((-5, 7, -6), (0, 10, -6), (5, 7, -6))]
wins = []
for x in (-3, 0, 3):
    for y in (1.5, 4.5): wins += box(x - .6, y, 6.0, x + .6, y + 1.3, 6.06)
assert outward(roof[:4], (0, 7, 0)) == 0, 'roof winding'
glb(os.path.join(d, 'house.glb'), [(walls, {'color': [.93, .88, .8, 1]}), (roof, {'color': [.35, .2, .15, 1]}), (wins, {'color': [1, .85, .5, 1], 'emissive': [1, .7, .3]})])
# a bench: seat .46 m high, 1.8 m long (x), back toward -Z
glb(os.path.join(d, 'bench.glb'), [(box(-.9, .42, -.25, .9, .49, .25) + box(-.9, .5, -.27, .9, .9, -.21) + box(-.8, 0, -.2, -.72, .42, .2) + box(.72, 0, -.2, .8, .42, .2), {'color': [.45, .3, .2, 1]})])
