"""Construye el GLB del edificio Green House a partir del OBJ exportado de Rhino.
- Filtra solo el edificio (quita anexo/suite, láminas de mobiliario, árbol genérico)
- Clasifica cada cara en un material por reglas (posición, orientación, objeto Rhino)
- Agrega vidrios, franja alta de ventanas (estimada) y puertas corredizas
- Sistema de coordenadas de salida: glTF (Y arriba), metros, origen = centro del salón
Uso: python3 build_venue.py model.obj ../work/obj.pkl salida.glb
"""
import sys, json, struct, pickle, numpy as np

OBJ_PKL = sys.argv[1]; OUT = sys.argv[2]
V, M = pickle.load(open(OBJ_PKL, 'rb'))
ORIGIN = np.array([28.91, 5.90, 0.0])   # centro del salón en coordenadas Rhino

MATERIALS = {  # color base aproximado (Etapa 4 reemplaza por texturas reales)
  'acero_negro':   dict(c=[0.045,0.045,0.045,1], r=0.55, m=0.6),
  'piso_salon':    dict(c=[0.30,0.30,0.29,1],    r=0.55, m=0.0),
  'concreto':      dict(c=[0.55,0.54,0.51,1],    r=0.9,  m=0.0),
  'madera_deck':   dict(c=[0.33,0.19,0.13,1],    r=0.75, m=0.0),
  'madera_banda':  dict(c=[0.33,0.19,0.13,1],    r=0.8,  m=0.0),
  'madera_cielo':  dict(c=[0.62,0.34,0.15,1],    r=0.6,  m=0.0),
  'cubierta':      dict(c=[0.86,0.86,0.84,1],    r=0.8,  m=0.0),
  'techo_negro':   dict(c=[0.06,0.06,0.06,1],    r=0.8,  m=0.1),
  'fachada_gris':  dict(c=[0.22,0.23,0.24,1],    r=0.7,  m=0.1),
  'madera_rojiza': dict(c=[0.38,0.15,0.08,1],    r=0.5,  m=0.0),
  'verde_bosque':  dict(c=[0.07,0.20,0.12,1],    r=0.45, m=0.0),
  'marmol_negro':  dict(c=[0.05,0.05,0.05,1],    r=0.2,  m=0.0),
  'muro_claro':    dict(c=[0.80,0.78,0.74,1],    r=0.9,  m=0.0),
  'madera_pasarela': dict(c=[0.33,0.19,0.13,1], r=0.75, m=0.0),
  'concreto_sendero': dict(c=[0.72,0.71,0.68,1], r=0.85, m=0.0),
  'metal_cafe':    dict(c=[0.17,0.09,0.06,1], r=0.45, m=0.35),
  'madera_nicho':  dict(c=[0.38,0.15,0.08,1], r=0.5, m=0.0),
  'damero':        dict(c=[1,1,1,1], r=0.35, m=0.0),
  'teja_gris':     dict(c=[0.24,0.25,0.26,1], r=0.85, m=0.0),
  'vidrio':        dict(c=[0.75,0.85,0.85,0.18], r=0.05, m=0.0, blend=True),
}

# Objetos Rhino identificados en la verificación (índice de malla en el OBJ)
SALON_SLAB = {36527}; DECK = {127,128,129,130,131,132}; ALERO = {133}
ROOFS = {37,40,36677,36657,36622,36615,36679,36680}
SERVICE_VOL = {36518}; BAR_TOP = {36525}; BAR_BASE = {36526}
REAR_FLOOR = {1,36528,36536,36537}; REAR_VOL = {36660,36628}
EXCLUDE_MATS = {'leafs1','flowers1','bark1','Paint (5)','Paint (6)','*1'}

Z_ZOCALO, Z_FRANJA = 0.12, 2.25      # [E] alturas de las franjas verdes (videos)
def cortar_horizontal(tri, cuts):
    """Corta un triángulo por planos horizontales z = cuts. Devuelve [(triángulo, z_centro)]."""
    polys = [list(tri)]
    for zc in cuts:
        nxt = []
        for poly in polys:
            below, above = [], []
            for i in range(len(poly)):
                a, b = poly[i], poly[(i+1) % len(poly)]
                (below if a[2] <= zc else above).append(a)
                if (a[2] - zc) * (b[2] - zc) < 0:
                    t = (zc - a[2]) / (b[2] - a[2]); p = a + (b - a) * t
                    below.append(p); above.append(p)
            for q in (below, above):
                if len(q) >= 3: nxt.append(q)
        polys = nxt
    out = []
    for q in polys:
        for i in range(1, len(q)-1):
            t = np.array([q[0], q[i], q[i+1]]); out.append((t, t[:,2].mean()))
    return out

# Suite (anexo con cubierta a dos aguas, visible tras los ventanales en las fotos): muros blancos, remates negros,
# cubierta de teja gris oscura. Interior no modelado.
SUITE_TECHO = {36511, 36512, 36513, 36514, 36515}; SUITE_MUROS = {36498, 36500, 36501, 36507}
SUITE_REMATES = {36499, 36502, 36503, 36504, 36505, 36506, 36508, 36516, 36517, 36538, 36539}
def classify(oid, tri, zmid=0):
    n = np.cross(tri[1]-tri[0], tri[2]-tri[0]); L = np.linalg.norm(n)
    n = n/L if L > 0 else n
    up, down = n[2] > 0.7, n[2] < -0.7
    zc = tri[:,2].mean(); horiz = up or down
    if oid in SUITE_TECHO: return 'teja_gris'
    if oid in SUITE_MUROS: return 'acero_negro'   # Zona E 13-nov: la suite es como el Green House: retícula NEGRA con vidrio
    if oid in SUITE_REMATES: return 'acero_negro'
    if oid == 36509: return 'madera_deck'
    if oid in (36510, 0): return 'concreto_sendero' if (up and oid == 0) else 'concreto'
    if oid in SALON_SLAB: return 'piso_salon' if up else 'concreto'
    if oid in DECK: return 'madera_deck'
    horiz = up or down                       # en Rhino la orientación de las caras no es confiable: se usa la altura
    if oid in ALERO: return ('madera_cielo' if zc < zmid else 'techo_negro') if horiz else 'techo_negro'   # alero negro por fuera (Zona E)
    if oid in ROOFS: return ('techo_negro' if zc < zmid else 'cubierta') if horiz else 'acero_negro'
    if oid in SERVICE_VOL:
        if horiz and abs(zc - 2.65) < 0.03 and tri[:,0].min() >= 22.66 and tri[:,0].max() <= 33.79: return 'madera_nicho'   # cielo del nicho: madera (foto)
        if horiz: return 'techo_negro' if zc > zmid else 'concreto'
        # Interior del contenedor (nicho detrás de la pista, abierto entre x 25,92 y 31,68): paneles de madera
        if tri[:,1].max() <= 0.57 and tri[:,1].min() >= -1.62 and tri[:,0].min() >= 22.66 and tri[:,0].max() <= 33.79: return 'madera_nicho'
        return 'FRANJAS'        # se corta en franjas horizontales exactas (ver abajo)
    if oid in BAR_TOP or oid in BAR_BASE: return None      # la barra se construye aparte con su retícula (js/bar.js)
    if oid == 36528: return 'damero' if up else 'concreto'      # piso del nicho: damero blanco y negro (video BAR)
    if oid in REAR_FLOOR: return 'concreto'
    if oid in REAR_VOL: return 'muro_claro'
    return 'acero_negro'

buckets = {k: [] for k in MATERIALS}
for oid, m in enumerate(M):
    if not m['f']: continue
    mat = m['mats'].most_common(1)[0][0]
    if mat in EXCLUDE_MATS: continue
    idx = np.unique(np.concatenate([np.array(f) for f in m['f']])) - 1
    p = V[idx]
    if p[:,0].min() < 20.5 or p[:,0].max() > 48.3: continue   # edificio + suite (anexo); fuera quedan las láminas
    zmid = (p[:,2].min() + p[:,2].max()) / 2
    for f in m['f']:
        f = np.array(f) - 1
        for i in range(1, len(f)-1):
            tri = V[[f[0], f[i], f[i+1]]]
            _k = classify(oid, tri, zmid)
            if _k == 'FRANJAS':
                # Volumen de servicios (tipo contenedor, metal – Zona E): franja verde abajo, metal café oscuro, franja verde arriba
                for piece, zc_ in cortar_horizontal(tri, [Z_ZOCALO, Z_FRANJA]):
                    buckets['verde_bosque' if (zc_ < Z_ZOCALO or zc_ > Z_FRANJA) else 'metal_cafe'].append(piece)
            elif _k: buckets[_k].append(tri)

# ---------- geometría agregada ----------
def box(x0,x1,y0,y1,z0,z1):
    c = np.array([[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]])
    F = [(0,2,1),(0,3,2),(4,5,6),(4,6,7),(0,1,5),(0,5,4),(1,2,6),(1,6,5),(2,3,7),(2,7,6),(3,0,4),(3,4,7)]
    return [c[list(t)] for t in F]
def pane(axis, const, a0, a1, z0, z1):
    """Panel plano vertical. axis='x': plano x=const que va de y=a0..a1"""
    if axis == 'x': q = np.array([[const,a0,z0],[const,a1,z0],[const,a1,z1],[const,a0,z1]])
    else:           q = np.array([[a0,const,z0],[a1,const,z0],[a1,const,z1],[a0,const,z1]])
    return [q[[0,1,2]], q[[0,2,3]], q[[0,2,1]], q[[0,3,2]]]   # doble cara
def frame_bar(axis, const, a0, a1, z0, z1, t=0.05):
    if axis == 'x': return box(const-t/2,const+t/2,a0,a1,z0,z1)
    return box(a0,a1,const-t/2,const+t/2,z0,z1)

H = 2.65   # altura de la retícula de fachada en el modelo
# Vidrio en tramos con retícula existente (cara de cada fachada)
glass_runs = [('x',22.02,0.15,2.0),('x',22.02,5.57,11.05),('y',11.10,22.09,26.44),('y',11.10,31.34,35.74),
              ('x',35.82,2.30,5.50),('x',35.82,8.25,11.05)]
for ax,c,a0,a1 in glass_runs: buckets['vidrio'] += pane(ax,c,a0,a1,0.0,H)

# Franja alta de ventanas (clerestorio) – ESTIMADA: el modelo no la trae; se ve en videos y dron
ROOF_UNDERSIDE = lambda xmid: 3.70 if xmid < 31.3 else 3.34
upper = [('x',22.02,0.15,11.10),('y',11.10,22.0,35.82),('x',35.82,2.30,11.10)]
for ax,c,a0,a1 in upper:
    segs = [(a0,a1,3.97)]
    for s0,s1,top in segs:
        z0 = 3.35 if (ax=='y') else H        # sobre el alero del deck la franja empieza en 3,35
        if top - z0 < 0.05: continue
        buckets['vidrio'] += pane(ax,c,s0,s1,z0,top)
        buckets['acero_negro'] += frame_bar(ax,c,s0,s1,z0,z0+0.06,0.06)
        n = max(1,int(round((s1-s0)/1.37)))
        for k in range(n+1):
            a = s0+(s1-s0)*k/n
            buckets['acero_negro'] += frame_bar(ax,c,a-0.025,a+0.025,z0,top,0.05) if False else \
                (box(c-0.03,c+0.03,a-0.025,a+0.025,z0,top) if ax=='x' else box(a-0.025,a+0.025,c-0.03,c+0.03,z0,top))

# ---------- Puertas: mismo diseño de retícula que las ventanas (perfil 6 cm, travesaños a 0,68 / 1,32 / 1,95 m,
# parales cada ~0,62 m), según el modelo Rhino y la observación de Zona E.
PERFIL = 0.06; TRAV = [0.68, 1.32, 1.95]; MOD = 0.62
def hoja(origin, ang, ancho, alto=H, grosor=0.05):
    """Hoja de puerta/ventana con retícula. origin = esquina (x,y) en planta, ang = dirección del ancho (rad).
    Devuelve (marcos, vidrio) como listas de triángulos en coordenadas Rhino."""
    ca, sa = np.cos(ang), np.sin(ang)
    def T(tris):   # local (u a lo ancho, v espesor, z) -> planta
        out = []
        for t in tris:
            t = np.array(t, dtype=float); u, v = t[:, 0].copy(), t[:, 1].copy()
            t[:, 0] = origin[0] + u*ca - v*sa; t[:, 1] = origin[1] + u*sa + v*ca; out.append(t)
        return out
    fr = []
    fr += box(0, PERFIL, -grosor/2, grosor/2, 0, alto) + box(ancho-PERFIL, ancho, -grosor/2, grosor/2, 0, alto)
    fr += box(0, ancho, -grosor/2, grosor/2, 0, 0.10) + box(0, ancho, -grosor/2, grosor/2, alto-PERFIL, alto)
    for z in TRAV: fr += box(0, ancho, -grosor/2, grosor/2, z, z+PERFIL)
    n = max(1, int(round(ancho / MOD)))
    for k in range(1, n): u = ancho*k/n; fr += box(u-PERFIL/2, u+PERFIL/2, -grosor/2, grosor/2, 0.10, alto-PERFIL)
    gl = pane('y', 0.0, PERFIL, ancho-PERFIL, 0.10, alto-PERFIL)
    return T(fr), T(gl)

doors = [('GH-PUERTA-01', 'Puerta corrediza de acceso desde el deck', 'corrediza', True),
         ('GH-PUERTA-02', 'Puerta abatible lateral (acceso entre jardineras, no se usa)', 'abatible', False),
         ('GH-PUERTA-03', 'Puerta corrediza lateral derecha (cerrada)', 'corrediza', False)]
door_meta = []
def add(fr_gl):
    buckets['acero_negro'].extend(fr_gl[0]); buckets['vidrio'].extend(fr_gl[1])

# GH-PUERTA-01 – vano del deck (y = 11,10; x 26,56–31,25): CORREDIZA de 2 hojas con retícula (confirmado por Zona E),
# abierta a la mitad: la segunda hoja queda corrida detrás de la primera.
y0, xa, xb = 11.10, 26.56, 31.25; mid = (xa + xb)/2
add(hoja((xa, y0 - 0.03), 0.0, mid - xa + 0.04)); add(hoja((xa + 0.02, y0 + 0.03), 0.0, mid - xa + 0.04))
door_meta.append(dict(id=doors[0][0], nombre=doors[0][1], abierta=True, pos=[round(mid-ORIGIN[0],3), round(y0-ORIGIN[1],3), 1.3], ancho=round(xb-xa,2), alto=H))

# GH-PUERTA-02 – lateral izquierda (x = 22,02; y 2,10–5,47): PUERTA NORMAL (abatible) de 2 hojas, CERRADA
# (confirmado por Zona E: es la puerta del acceso entre jardineras, que los invitados no usan). Hojas en el plano de fachada.
xc, ya, yb = 22.02, 2.10, 5.47; mid = (ya + yb)/2
add(hoja((xc, ya), np.pi/2, mid - ya)); add(hoja((xc, mid), np.pi/2, yb - mid))
door_meta.append(dict(id=doors[1][0], nombre=doors[1][1], abierta=False, pos=[round(xc-ORIGIN[0],3), round(mid-ORIGIN[1],3), 1.3], ancho=round(yb-ya,2), alto=H))

# GH-PUERTA-03 – lateral derecha (x = 35,82; y 5,57–8,15): corrediza de 2 hojas, CERRADA (Zona E, 12-nov)
xc, ya, yb = 35.82, 5.57, 8.15; mid = (ya + yb)/2
add(hoja((xc - 0.03, ya), np.pi/2, mid - ya + 0.02)); add(hoja((xc + 0.03, mid - 0.02), np.pi/2, yb - mid + 0.02))
door_meta.append(dict(id=doors[2][0], nombre=doors[2][1], abierta=False, pos=[round(xc-ORIGIN[0],3), round(mid-ORIGIN[1],3), 1.3], ancho=round(yb-ya,2), alto=H))

# Cubierta del salón – el modelo Rhino trae solo las vigas, sin la lámina (el dron muestra cubierta blanca)
for (x0,x1,ztop) in [(21.94,35.90,4.00)]:     # una sola cubierta (corregido: la franja de vidrio central no existe)
    for t in box(x0,x1,0.04,11.15,ztop-0.03,ztop):
        zc=t[:,2].mean(); flat=np.ptp(t[:,2])<1e-6
        buckets[('cubierta' if zc>ztop-0.015 else 'techo_negro') if flat else 'fachada_gris'].append(t)


def _up(tris):
    out = []
    for t in tris:
        t = np.array(t, dtype=float)
        if np.cross(t[1]-t[0], t[2]-t[0])[2] < 0: t = t[[0, 2, 1]]
        out.append(t)
    return out
# ---------- Sendero de llegada y pasarela (plano de modulación + videos ENTRADA y PASARELA) ----------
# Medidas tomadas del plano de modulación (escala calibrada con las columnas). [E] ancho total ≈ 2,67 m.
ZP = -0.005                        # Zona E 13-nov: entrada, sendero y pasarela a la MISMA altura del salón (el prado baja bajo el cóctel)
Z_PAS_FIN = -0.005                 # La pasarela va a nivel del salón y llega al deck sin escalones; queda suspendida donde el terreno baja
def ribbon(center, half_w, z, offs=(-1, 1)):
    zf = z if callable(z) else (lambda k: z)
    """Cinta a lo largo de una polilínea (x,y). offs = fracciones del medio ancho que limitan la cinta."""
    tris = []; uvs = []; acc = 0
    C = np.array(center)
    for i in range(len(C) - 1):
        p0, p1 = C[i], C[i+1]; d = p1 - p0; L = np.linalg.norm(d); t = d / L; nrm = np.array([-t[1], t[0]])
        # normal promedio en los vértices para unir sin huecos
        def n_at(k):
            ts = []
            if k > 0: a = C[k]-C[k-1]; ts.append(a/np.linalg.norm(a))
            if k < len(C)-1: a = C[k+1]-C[k]; ts.append(a/np.linalg.norm(a))
            tt = sum(ts); tt /= np.linalg.norm(tt); return np.array([-tt[1], tt[0]])
        n0, n1 = n_at(i), n_at(i+1)
        a0 = p0 + n0*half_w*offs[0]; b0 = p0 + n0*half_w*offs[1]; a1 = p1 + n1*half_w*offs[0]; b1 = p1 + n1*half_w*offs[1]
        Q = [np.array([*a0, zf(i)]), np.array([*b0, zf(i)]), np.array([*b1, zf(i+1)]), np.array([*a1, zf(i+1)])]
        tris += [np.array([Q[0], Q[2], Q[1]]), np.array([Q[0], Q[3], Q[2]])]   # cara hacia arriba
        w0, w1 = offs[0]*half_w, offs[1]*half_w
        U = [(w0, acc), (w1, acc), (w1, acc+L), (w0, acc+L)]       # tablas a lo largo del recorrido
        uvs += [[U[0], U[2], U[1]], [U[0], U[3], U[2]]]
        acc += L
    RIB_UV.extend(uvs)
    return tris
HW = 1.55          # concreto: 3,10 m de ancho total (Zona E)
HW_MADERA = 0.75   # pasillo de madera: 1,50 m hasta el cóctel (Zona E)
RIB_UV = []; CUSTOM_UV = {}
# LLEGADA (Zona E, 12-nov): pasillo principal de 3,10 m = banda de madera izq. + concreto + banda de madera der.
# Donde el concreto gira en curva hacia la puerta lateral, SOLO la banda izquierda sigue de largo y se convierte
# en el corredor de madera de 1,50 m que llega hasta el cóctel. La banda derecha termina en la curva.
X0, X1, BANDA = 12.65, 15.75, 0.80     # bandas de 0,80 m y concreto de 1,50 m (medido en el escaneo de la llegada)
Y_INI, Y_CURVA = -8.72, 3.07
buckets['madera_banda'] += box(X0, X0 + BANDA, Y_INI, Y_CURVA, ZP - 0.04, ZP - 0.004)          # banda izquierda
buckets['concreto_sendero'] += box(X0 + BANDA, X1 - BANDA, Y_INI, Y_CURVA, ZP - 0.04, ZP)     # concreto
buckets['madera_banda'] += box(X1 - BANDA, X1, Y_INI, Y_CURVA, ZP - 0.04, ZP - 0.004)          # banda derecha (termina aquí)
ccx, ccy, crx, cry = X1, Y_CURVA, X1 - (X0 + BANDA), 2.98                                        # curva de concreto
ang = np.linspace(np.pi, np.pi/2, 16)
curva = [(ccx + crx*np.cos(a), ccy + cry*np.sin(a)) for a in ang]
for k in range(len(curva)-1):
    buckets['concreto_sendero'].append(np.array([(ccx, ccy, ZP), (*curva[k], ZP), (*curva[k+1], ZP)]))
# La banda izquierda SIGUE LA CURVA del concreto (franja de 0,52 m pegada a su borde exterior) y desde esa curva
# arranca el corredor de madera de 1,50 m hacia el cóctel, sin montarse sobre el concreto.
XL0, XL1 = X0, X0 + 1.50
Z_RECTO_FIN = -0.005
Y_SUBE = Y_CURVA + cry
zw = lambda y: ZP + (Z_RECTO_FIN - ZP) * np.clip((y - Y_SUBE) / (10.30 - Y_SUBE), 0, 1)
orx, ory = crx + BANDA, cry + BANDA                                   # elipse exterior de la banda
for k in range(len(ang)-1):                                           # franja curva
    a0, a1 = ang[k], ang[k+1]
    p = [(ccx + crx*np.cos(a0), ccy + cry*np.sin(a0)), (ccx + orx*np.cos(a0), ccy + ory*np.sin(a0)),
         (ccx + orx*np.cos(a1), ccy + ory*np.sin(a1)), (ccx + crx*np.cos(a1), ccy + cry*np.sin(a1))]
    q = [np.array([x, y, ZP + 0.002]) for x, y in p]
    buckets['madera_banda'] += [np.array([q[0],q[1],q[2]]), np.array([q[0],q[2],q[3]])]
def y_borde(x):                                                       # borde superior de la franja curva
    u = np.clip((x - ccx) / orx, -1, 1); return ccy + ory*np.sqrt(1 - u*u)
xs = np.linspace(XL0, XL1, 9)
for xa, xb in zip(xs[:-1], xs[1:]):                                   # corredor: desde la curva hasta la pasarela
    ya, yb = y_borde(xa), y_borde(xb)
    q = [np.array([xa, ya, zw(ya)+0.002]), np.array([xb, yb, zw(yb)+0.002]), np.array([xb, 10.30, Z_RECTO_FIN]), np.array([xa, 10.30, Z_RECTO_FIN])]
    buckets['madera_deck'] += [np.array([q[0],q[1],q[2]]), np.array([q[0],q[2],q[3]])]
for xx in (XL0, XL1):                                                 # faldones del tramo elevado
    y0 = max(Y_SUBE, y_borde(xx))
    buckets['madera_deck'] += [np.array([(xx, y0, -1.00), (xx, 10.30, -1.00), (xx, 10.30, Z_RECTO_FIN)]), np.array([(xx, y0, -1.00), (xx, 10.30, Z_RECTO_FIN), (xx, y0, zw(y0))])]
# Pasarela curva de madera (video PASARELA): cuarto de elipse hasta el costado del deck
cx, cy, rx, ry = 20.88, 10.30, 20.88 - (XL0 + XL1) / 2, 5.50      # arranca en el eje del corredor de madera
arc = [(cx - rx*np.cos(a), cy + ry*np.sin(a)) for a in np.linspace(0, np.pi/2, 24)]
arc.append((21.00, cy + ry))
ZARC = lambda k: Z_RECTO_FIN + (Z_PAS_FIN - Z_RECTO_FIN) * min(1.0, k / (len(arc) - 1))   # sigue subiendo en la curva
RIB_UV.clear(); buckets['madera_pasarela'] += ribbon(arc, HW_MADERA, ZARC); CUSTOM_UV['madera_pasarela'] = list(RIB_UV)
# Faldones laterales del sendero hasta el terreno (visibles solo donde el terreno baja hacia el lago)
def skirt(center, half_w, side, z0, z1):
    C = np.array(center); out = []; z1f = z1 if callable(z1) else (lambda k: z1)
    for i in range(len(C)-1):
        def off(k):
            ts = []
            if k > 0: a = C[k]-C[k-1]; ts.append(a/np.linalg.norm(a))
            if k < len(C)-1: a = C[k+1]-C[k]; ts.append(a/np.linalg.norm(a))
            t = sum(ts); t /= np.linalg.norm(t); return C[k] + np.array([-t[1], t[0]])*half_w*side
        a, b = off(i), off(i+1)
        q = [np.array([*a, z0]), np.array([*b, z0]), np.array([*b, z1f(i+1)]), np.array([*a, z1f(i)])]
        out += [np.array([q[0],q[1],q[2]]), np.array([q[0],q[2],q[3]])]
    return out
for sd in (-1, 1): buckets['madera_deck'] += skirt(arc, HW_MADERA, sd, -1.00, lambda k: ZARC(k) - 0.002)
# Acceso secundario de concreto entre las dos jardineras hasta la puerta lateral (indicado por Zona E, no se usa en eventos)
# Dintel verde (lámina corrugada del contenedor) sobre la boca del nicho (foto del nicho)
buckets['verde_bosque'] += box(25.92, 31.68, 0.56, 0.70, 2.25, 2.65)
# Bandas de madera a los dos lados del acceso de concreto hacia la puerta lateral (foto de la puerta; Zona E):
# arriba continúa la franja curva de la banda izquierda; abajo continúa la banda derecha.
buckets['madera_banda'] += box(15.75, 21.97, 6.05, 6.05 + BANDA, ZP - 0.04, ZP - 0.002)
buckets['madera_banda'] += box(X1 - BANDA, 21.97, 3.07 - BANDA, 3.07, ZP - 0.04, ZP - 0.002)
# Acceso secundario entre jardineras: concreto plano a ras del prado, como el sendero principal [por confirmar el remate en la puerta]
buckets['concreto_sendero'] += box(15.75, 21.97, 3.07, 6.05, -0.70, ZP)
for _k in ('concreto_sendero', 'madera_deck', 'madera_banda'):
    buckets[_k] = _up(buckets[_k])
# Zócalo del salón (Zona E 13-nov: entre el sendero y el salón se veía una franja de prado: debe ser concreto).
# La losa del Rhino mide 0,25 m de espesor y el prado está a -0,68: se cierra el borde exterior de la losa
# con un faldón de concreto desde -0,25 hasta el terreno, siguiendo exactamente su contorno.
def _zocalo_losa(oid, z_top=-0.25, z_bot=-0.74):
    m = M[oid]; tops = []
    for f in m['f']:
        q = V[np.array(f) - 1]
        if np.abs(q[:, 2]).max() < 0.01: tops.append([tuple(np.round(v[:2], 4)) for v in q])
    cuenta = {}
    for q in tops:
        for i in range(len(q)):
            e = tuple(sorted((q[i], q[(i + 1) % len(q)]))); cuenta[e] = cuenta.get(e, 0) + 1
    out = []
    for (a, b), c in cuenta.items():
        if c != 1: continue
        A0, B0 = np.array([a[0], a[1], z_top]), np.array([b[0], b[1], z_top]); A1, B1 = A0.copy(), B0.copy(); A1[2] = B1[2] = z_bot
        out += [np.array([A0, B0, B1]), np.array([A0, B1, A1]), np.array([A0, B1, B0]), np.array([A0, A1, B1])]   # dos caras
    return out
buckets['concreto'] += _zocalo_losa(36527)
# Deck del cóctel SUSPENDIDO sobre el terreno en depresión (Zona E 13-nov; escaneos: el deck queda ~0,75 m sobre el prado).
# Bajo la plataforma (0,25 m) se ven los apoyos: postes cada ~2,3 m [E] y una viga perimetral.
for _x in np.linspace(22.0, 35.85, 7):
    for _y in np.linspace(11.4, 19.05, 4):
        buckets['acero_negro'] += box(_x - 0.06, _x + 0.06, _y - 0.06, _y + 0.06, -1.10, -0.25)
for (_a, _b, _c, _d) in [(21.87, 35.97, 11.25, 11.37), (21.87, 35.97, 19.05, 19.17), (21.87, 21.99, 11.25, 19.17), (35.85, 35.97, 11.25, 19.17)]:
    buckets['acero_negro'] += box(_a, _b, _c, _d, -0.40, -0.25)
# Suite: vidrios dentro de la retícula negra (oeste, este y norte); el bloque sur (36501) es muro cerrado.
buckets['vidrio'] += pane('x', 44.14, 5.38, 8.40, 0.0, 2.65)
buckets['vidrio'] += pane('x', 48.04, 3.54, 8.40, 0.0, 2.65)
buckets['vidrio'] += pane('y', 8.42, 44.12, 48.02, 0.0, 2.65)
# Zona de servicio trasera (detrás de los baños): Zona E 12-nov – "debe tener una pared, no se ve lo que hay adentro".
# Se cierran los 3 lados abiertos bajo la cubierta trasera (sur, oeste y este), desde el sardinel hasta la viga. Material [E]: muro claro.
buckets['muro_claro'] += box(21.97, 37.91, -8.72, -8.60, 0.0, 2.75)     # sur
buckets['muro_claro'] += box(21.99, 22.11, -8.60, 0.04, 0.0, 2.75)      # oeste
buckets['muro_claro'] += box(37.79, 37.91, -8.60, -1.71, 0.0, 2.75)     # este
# Antes del deck: 2 escalones de madera (Zona E) desde el final de la pasarela (-0,34) hasta el deck (0,00)
buckets['madera_deck'] += box(21.00, 21.87, 15.05, 17.17, -1.00, -0.005)   # remate a nivel entre la pasarela y el deck (sin escalones)
# Relleno del hueco entre los escalones y el bloque de esquina del deck (obj 129, desde y = 17,17)
buckets['madera_deck'] += box(21.22, 21.44, 16.55, 17.17, -0.70, 0.0)

# ---------- escritura GLB ----------
def to_gltf(P):  # Rhino (x,y,z) -> glTF (x, z, -y), con origen en el salón
    P = P - ORIGIN
    return np.stack([P[...,0], P[...,2], -P[...,1]], -1)

gl = dict(asset=dict(version='2.0', generator='ZonaE GreenHouse builder'), scene=0, scenes=[dict(nodes=[])],
          nodes=[], meshes=[], materials=[], accessors=[], bufferViews=[], buffers=[])
blob = bytearray()
def add_view(data, target):
    global blob
    while len(blob) % 4: blob.append(0)
    off = len(blob); blob += data
    gl['bufferViews'].append(dict(buffer=0, byteOffset=off, byteLength=len(data), target=target))
    return len(gl['bufferViews'])-1
stats = {}
for name, tris in buckets.items():
    if not tris: continue
    TR = np.array(tris, dtype=np.float64); T = to_gltf(TR)         # (n,3,3)
    nrm = np.cross(T[:,1]-T[:,0], T[:,2]-T[:,0]); ln = np.linalg.norm(nrm,axis=1,keepdims=True)
    ok = ln[:,0] > 1e-10; T, nrm, ln, TR = T[ok], nrm[ok], ln[ok], TR[ok]
    tris_ok = {name: TR}; nrr = np.cross(TR[:,1]-TR[:,0], TR[:,2]-TR[:,0]); nr_rh = {name: nrr/np.linalg.norm(nrr,axis=1,keepdims=True)}
    nrm = nrm/ln
    pos = T.reshape(-1,3).astype(np.float32); nor = np.repeat(nrm,3,axis=0).astype(np.float32)
    # UV planares en METROS (el visor aplica la escala real de cada textura)
    R = np.array(tris_ok[name]).reshape(-1,3)          # coords Rhino (x, y, z)
    Nr = np.repeat(nr_rh[name], 3, axis=0)
    uv = np.where(np.abs(Nr[:,2:3]) > 0.7, R[:,[0,1]],
         np.where(np.abs(Nr[:,0:1]) > np.abs(Nr[:,1:2]), R[:,[1,2]], R[:,[0,2]]))
    if name == 'madera_deck': uv = uv[:, ::-1]           # tablas del deck van hacia el lago (eje Y)
    if name in CUSTOM_UV: uv = np.array(CUSTOM_UV[name], dtype=np.float64).reshape(-1, 2)[np.repeat(ok, 3)][:, ::-1]
    uv = uv.astype(np.float32); vu = add_view(uv.tobytes(), 34962)
    idx = np.arange(len(pos), dtype=np.uint32)
    vp = add_view(pos.tobytes(), 34962); vn = add_view(nor.tobytes(), 34962); vi = add_view(idx.tobytes(), 34963)
    a0 = len(gl['accessors'])
    gl['accessors'] += [dict(bufferView=vp, componentType=5126, count=len(pos), type='VEC3', min=pos.min(0).tolist(), max=pos.max(0).tolist()),
                        dict(bufferView=vn, componentType=5126, count=len(nor), type='VEC3'),
                        dict(bufferView=vi, componentType=5125, count=len(idx), type='SCALAR'),
                        dict(bufferView=vu, componentType=5126, count=len(uv), type='VEC2')]
    md = MATERIALS[name]
    mat = dict(name=name, pbrMetallicRoughness=dict(baseColorFactor=md['c'], metallicFactor=md['m'], roughnessFactor=md['r']),
               doubleSided=True)
    if md.get('blend'): mat['alphaMode'] = 'BLEND'
    gl['materials'].append(mat)
    gl['meshes'].append(dict(name=name, primitives=[dict(attributes=dict(POSITION=a0, NORMAL=a0+1, TEXCOORD_0=a0+3), indices=a0+2, material=len(gl['materials'])-1)]))
    gl['nodes'].append(dict(name='arq_'+name, mesh=len(gl['meshes'])-1))
    gl['scenes'][0]['nodes'].append(len(gl['nodes'])-1)
    stats[name] = len(T)
while len(blob) % 4: blob.append(0)
gl['buffers'].append(dict(byteLength=len(blob)))
js = json.dumps(gl, separators=(',',':')).encode()
while len(js) % 4: js += b' '
with open(OUT, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12+8+len(js)+8+len(blob)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(blob), 0x004E4942)); f.write(blob)
json.dump(door_meta, open(OUT.replace('.glb','_puertas.json'),'w'), ensure_ascii=False, indent=1)
print(json.dumps(stats), 'bytes', 12+8+len(js)+8+len(blob))
