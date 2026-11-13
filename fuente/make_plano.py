"""Genera el plano arquitectónico (PNG) del venue a partir del modelo 3D y de los datos:
corte horizontal a 1,0 m (muros, columnas, vidrios), pisos con su material, mobiliario a escala,
jardines, lago y muelle. El visor lo usa como fondo del plano interactivo (mismos límites)."""
import json, struct, numpy as np, matplotlib, sys
matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection, LineCollection
from matplotlib.patches import Polygon, Rectangle, Circle
from matplotlib.transforms import Affine2D
SITE = '../site/'
d = open(SITE + 'greenhouse_arquitectura.glb', 'rb').read(); jl = struct.unpack('<I', d[12:16])[0]
g = json.loads(d[20:20+jl]); b = d[20+jl+8:]
v = json.load(open(SITE + 'data/greenhouse.venue.json'))
meshes = {}
for m in g['meshes']:
    pr = m['primitives'][0]; a = g['accessors'][pr['attributes']['POSITION']]; bv = g['bufferViews'][a['bufferView']]
    P = np.frombuffer(b[bv['byteOffset']:bv['byteOffset']+bv['byteLength']], np.float32).reshape(-1, 3, 3).astype(float)
    meshes[m['name']] = np.stack([P[:, :, 0], -P[:, :, 2], P[:, :, 1]], -1)     # local x, y, z
pts = np.concatenate([e['poligono'] for e in v['espacios']])
x0, x1 = pts[:, 0].min() - 2, pts[:, 0].max() + 2; y0, y1 = pts[:, 1].min() - 2, pts[:, 1].max() + 2
W = 900; H = int(W * (y1 - y0) / (x1 - x0))
fig = plt.figure(figsize=(W / 100, H / 100), dpi=100); ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(x0, x1); ax.set_ylim(y0, y1); ax.axis('off')
fig.patch.set_alpha(0)
INK = '#1b1b1a'
# terreno
ax.add_patch(Rectangle((x0, y0), x1 - x0, y1 - y0, fc='#e7e9df', ec='none', zorder=0))
ext = v['exterior']
if ext.get('lago'): ax.add_patch(Polygon(ext['lago'], fc='#c9d8d3', ec='#9fb6ae', lw=0.8, zorder=1))
for j in ext['jardineras']: ax.add_patch(Polygon(j, fc='#cfd8bf', ec='#9aab86', lw=0.6, zorder=1))
def floor(name, fc, z=2):
    P = meshes.get(name)
    if P is None: return
    flat = (np.ptp(P[:, :, 2], 1) < 0.35) & (P[:, :, 2].max(1) < 0.3)
    ax.add_collection(PolyCollection(P[flat][:, :, :2], facecolors=fc, edgecolors=fc, linewidths=0.2, zorder=z))
floor('concreto', '#e2e0db'); floor('concreto_sendero', '#d9d6cf'); floor('piso_salon', '#f1efea', 3); floor('damero', '#d8d6d0', 3)
for n in ('madera_deck', 'madera_pasarela', 'madera_banda'): floor(n, '#dcc7ad', 2)
# tablas del deck/pasarela: líneas finas
# corte a 1,0 m: elementos verticales
def cut(name, color, lw, z=6):
    P = meshes.get(name)
    if P is None: return
    sel = (P[:, :, 2].min(1) < 1.0) & (P[:, :, 2].max(1) > 1.0) & (np.ptp(P[:, :, 2], 1) > 0.3)
    T = P[sel]; segs = []
    for t in T:
        # intersección del triángulo con el plano z = 1
        s = []
        for i in range(3):
            a, c = t[i], t[(i + 1) % 3]
            if (a[2] - 1.0) * (c[2] - 1.0) < 0: u = (1.0 - a[2]) / (c[2] - a[2]); s.append(a[:2] + (c[:2] - a[:2]) * u)
        if len(s) == 2: segs.append(s)
    ax.add_collection(LineCollection(segs, colors=color, linewidths=lw, zorder=z, capstyle='round'))
cut('vidrio', '#5f8796', 1.8, 5)
for n in ('acero_negro', 'metal_cafe', 'verde_bosque', 'madera_nicho', 'muro_claro', 'fachada_gris'): cut(n, INK, 1.6)
# mobiliario a escala (desde los datos)
SZ = {'mesa_madera': (2.6, 1.0), 'mesa_novios': (2.0, 1.0), 'mesa_postres': (2.6, 1.0), 'silla_x': (0.5, 0.54), 'mesa_coctel': (0.7, 0.7),
      'silla_coctel': (0.42, 0.37), 'sala_hierro': (1.95, 1.35), 'sala_corazones': (2.9, 1.5)}
for o in v['objetos']:
    if o['tipo'] not in SZ: continue
    w, h = SZ[o['tipo']]; mesa = 'mesa' in o['tipo']
    r = Rectangle((o['pos'][0] - w / 2, o['pos'][1] - h / 2), w, h, fc='#ffffff' if mesa else '#cfcac0', ec=INK, lw=0.5 if mesa else 0.3, zorder=7)
    r.set_transform(Affine2D().rotate_deg_around(o['pos'][0], o['pos'][1], o['rot']) + ax.transData); ax.add_patch(r)
# barra en L y estantería del bar (se construyen en el visor, no están en el GLB)
O = (28.91, 5.90); Lr = lambda pts: [(x - O[0], y - O[1]) for x, y in pts]
ax.add_patch(Polygon(Lr([(22.57, 2.12), (24.89, 2.12), (24.89, 0.69), (25.27, 0.69), (25.27, 2.49), (22.57, 2.49)]), fc='#3a3a38', ec=INK, lw=0.6, zorder=7))
ax.add_patch(Polygon(Lr([(22.95, 0.72), (24.45, 0.72), (24.45, 1.17), (22.95, 1.17)]), fc='#ffffff', ec=INK, lw=0.6, hatch='////', zorder=7))
# muelle
m = ext.get('muelle')
if m:
    r = Rectangle((m['centro'][0] - m['largo'] / 2, m['centro'][1] - m['ancho'] / 2), m['largo'], m['ancho'], fc='#dcc7ad', ec='#8d7356', lw=0.6, zorder=4)
    r.set_transform(Affine2D().rotate_deg_around(*m['centro'], m['giro']) + ax.transData); ax.add_patch(r)
# palmas: copa con radios
for p in ext['palmas']:
    cx, cy = p['pos']; R = 0.9 + p['alto'] * 0.15
    ax.add_patch(Circle((cx, cy), R, fc='#b9c7a3', ec='#7f9168', lw=0.5, alpha=0.85, zorder=8))
    for k in range(9):
        a = k / 9 * 2 * np.pi + p['giro']; ax.plot([cx, cx + R * np.cos(a)], [cy, cy + R * np.sin(a)], color='#7f9168', lw=0.4, zorder=8)
for pz in ext.get('piedras', []): ax.add_patch(Circle(pz['pos'], 0.35, fc='#cfcbc2', ec='#8f8a80', lw=0.4, zorder=8))
fig.savefig(SITE + 'data/plano.png', dpi=100, transparent=False)
json.dump(dict(img='data/plano.png', x0=x0, x1=x1, y0=y0, y1=y1), open(SITE + 'data/plano.json', 'w'))
print(W, H, x0, x1, y0, y1)
