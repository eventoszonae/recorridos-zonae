"""Genera data/greenhouse.venue.json: espacios, objetos con ID único y posiciones.
Coordenadas en planta (metros): x = este-oeste del plano, y = hacia el lago (deck). Origen = centro del salón.
Para mover el montaje solo se edita este archivo (o el JSON resultante); el modelo 3D no cambia."""
import json, math
O = (28.91, 5.90)                       # origen en coordenadas Rhino
L = lambda x, y: [round(x-O[0], 3), round(y-O[1], 3)]
objs = []
def add(id_, tipo, x, y, rot=0, z=0, zona=None, estado='provisional'):
    objs.append(dict(id=id_, tipo=tipo, pos=L(x, y), z=z, rot=rot, zona=zona, montaje=estado))

# --- Salón: montaje típico de Zona E (plano de modulación enviado el 11-nov)
# 8 mesas de madera de 10 puestos con el largo paralelo a la fachada del deck:
# 4 junto a la fachada derecha, 3 junto a la izquierda (lado de la barra) y 1 en el centro.
mesas = [(33.72, 9.86), (33.72, 7.74), (33.72, 5.62), (33.72, 3.43),
         (24.28, 9.86), (24.28, 7.74), (24.28, 5.62),
         (28.88, 8.19)]
ns = 0
for i, (x, y) in enumerate(mesas, 1):
    add(f'GH-MESA-{i:02d}', 'mesa_madera', x, y, rot=0, zona='salon', estado='montaje tipico')
    for sy in (-1, 1):                                   # 4 por lado
        for d in (-0.975, -0.325, 0.325, 0.975):
            ns += 1; add(f'GH-SILLA-{ns:03d}', 'silla_x', x+d, y+sy*0.69, rot=(0 if sy < 0 else 180), zona='salon', estado='montaje tipico')
    # Máximo 80 sillas X (Zona E): la mesa central (GH-MESA-08) va sin cabeceras → 78 + 2 de novios = 80
    for e in ((-1, 1) if i < 8 else ()):                 # cabeceras
        ns += 1; add(f'GH-SILLA-{ns:03d}', 'silla_x', x+e*1.49, y, rot=(90 if e > 0 else -90), zona='salon', estado='montaje tipico')
# Mesa de novios (2 sillas, mirando hacia la pista) y mesa de postres junto a la entrada desde el deck
add('GH-NOVIOS-01', 'mesa_novios', 28.84, 5.97, rot=0, zona='salon', estado='montaje tipico')
for d in (-0.42, 0.42):
    ns += 1; add(f'GH-SILLA-{ns:03d}', 'silla_x', 28.84+d, 6.66, rot=180, zona='salon', estado='montaje tipico')
add('GH-POSTRES-01', 'mesa_postres', 28.91, 10.29, rot=0, zona='salon', estado='montaje tipico')

# --- Deck: 6 mesas cocteleras altas con 4 sillas cada una – POSICIÓN PROVISIONAL
coct = [(25.0, 13.1), (29.0, 13.1), (33.0, 13.1), (26.3, 17.0), (29.5, 17.0), (32.7, 17.0)]
nc = 0
for i, (x, y) in enumerate(coct, 1):
    add(f'GH-COCT-{i:02d}', 'mesa_coctel', x, y, rot=0, zona='deck')
    for k, (dx, dy, r) in enumerate([(0, -0.58, 0), (0.58, 0, 90), (0, 0.58, 180), (-0.58, 0, -90)]):
        nc += 1; add(f'GH-SCOCT-{nc:02d}', 'silla_coctel', x+dx, y+dy, rot=r, zona='deck')

# --- 2 salas de hierro forjado DISTINTAS (fotos): celosía en el deck, corazones en el muelle – posición provisional
add('GH-SALA-01', 'sala_hierro', 23.30, 18.10, rot=0, zona='deck')
add('GH-SALA-02', 'sala_corazones', 28.91, 30.55, rot=180, z=-0.66, zona='muelle')

# --- Elementos fijos (posición del modelo Rhino)
add('GH-BARRA-01', 'barra', 23.90, 1.60, zona='salon', estado='fijo')
puertas = json.load(open('../site/greenhouse_arquitectura_puertas.json'))
for p in puertas:
    objs.append(dict(id=p['id'], tipo=('puerta_abatible' if 'abatible' in p['nombre'] else 'puerta_corrediza'), pos=p['pos'][:2], z=0, rot=0, zona='salon', montaje='fijo', nota=p['nombre'] + ('' if p['abierta'] else ' · cerrada en el recorrido'),
                     medidas_modelo=dict(ancho_m=p['ancho'], alto_m=p['alto'])))

R = lambda pts: [L(x, y) for x, y in pts]
def jardinera_curva():
    # Jardinera dentro de la curva: llena todo el espacio hasta el borde interior del corredor de madera (sin prado a la vista)
    cx, cy, rx, ry, hw = 20.88, 10.30, 20.88 - 13.40, 5.50, 0.75
    pts = [(14.20, 6.6)]
    for k in range(0, 21):
        a = math.pi/2 * k / 20
        pts.append((cx - (rx - hw - 0.05)*math.cos(a), cy + (ry - hw - 0.05)*math.sin(a)))
    pts += [(21.85, cy + ry - hw - 0.05), (21.85, 6.6)]
    return pts
def muelle_rect(cx=28.91, cy=30.17, w=8.0, d=4.0, giro=0):   # 8 × 4 m, a 9 m del deck (Zona E)
    a = math.radians(giro); out = []
    for u, v in [(-w/2, -d/2), (w/2, -d/2), (w/2, d/2), (-w/2, d/2)]:
        out.append((cx + u*math.cos(a) - v*math.sin(a), cy + u*math.sin(a) + v*math.cos(a)))
    return out
# --- Exterior de llegada (plano de modulación + videos ENTRADA / PASARELA). Posiciones [E] medidas en el plano.
def from_plan(cx, cy):            # recorte x3 del plano de modulación -> coordenadas Rhino
    ox, oy = cx/3, cy/3 + 280
    return (42.42 - 0.06688*oy, 20.29 - 0.06624*ox)
palm_px = [(300,145),(360,115),(455,105),(530,150),(615,195),(330,210),(420,185),(550,230),(370,280),(475,285),(580,310),
           (840,140),(970,125),(1080,145),(910,240),(1030,215),(1000,290)]
import random; random.seed(7)

import math
def orilla_irregular(poly, n_orilla=9, paso=0.8):
    """Orilla natural (Zona E, 12-nov: 'la orilla es irregular'): subdivide los tramos de orilla y los desplaza
    hacia adentro/afuera con un ruido suave. Frente al muelle (|x| < 5) se mantiene recta para que el muelle apoye.
    Forma ESTIMADA: es representativa, no un levantamiento."""
    out, s_acum = [], 0.0
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        if i >= n_orilla:
            out.append(a); continue
        L = math.dist(a, b); n = max(1, int(L / paso)); nx, ny = -(b[1] - a[1]) / L, (b[0] - a[0]) / L
        for k in range(n):
            t = k / n; x = a[0] + (b[0] - a[0]) * t; y = a[1] + (b[1] - a[1]) * t; s_ = s_acum + L * t
            amp = 1.1 * min(1.0, max(0.0, (abs(x) - 5.0) / 4.0)) if (abs(x) < 9 and y > 18) else 1.1
            d = amp * (0.55 * math.sin(s_ * 0.37) + 0.3 * math.sin(s_ * 0.91 + 1.3) + 0.15 * math.sin(s_ * 2.3 + 0.7))
            if i == 0 and k == 0: d = 0
            out.append([round(x + nx * d, 3), round(y + ny * d, 3)])
        s_acum += L
    return out

exterior = dict(
  jardineras=[R(jardinera_curva()),
              R([(21.85,2.5),(16.3,2.5),(15.85,2.0),(15.85,-4.42),(21.85,-4.42)])],
  palmas=[dict(pos=L(*from_plan(*p)), alto=round(random.uniform(2.2, 4.2), 2), giro=random.randint(0, 359)) for p in palm_px],
  # Inicio de la llegada (foto Lilo & Derek): plaza de adoquín en espiga + piedras grandes [medidas E]
  adoquin=R([(11.2, -12.6), (17.0, -12.6), (17.0, -8.72), (11.2, -8.72)]),
  piedras=[dict(pos=L(12.2, -9.4), alto=1.3), dict(pos=L(16.3, -9.6), alto=0.9), dict(pos=L(16.2, 6.4), alto=0.5)],
  bolardos=[L(12.35, y) for y in (-7.0, -2.0, 3.0)] + [L(12.4, 8.0)] + [L(13.6, 13.4), L(16.6, 16.4)],
  # Lago y muelle: ESTIMADOS (dron + video). El muelle arranca desde el prado (≈1,5 m sobre tierra) para poder pasar (Zona E).
  # Coordenadas locales (origen = centro del salón). Prado ≈ 15 m entre la escalinata del deck y la orilla.
  # Huella del edificio (envolvente convexa de muros del modelo Rhino, coords locales): la vegetación no la atraviesa
  edificio=[[[-7.04, 5.28], [7.06, 5.28], [7.06, 9.22], [-7.04, 9.22]], [[19.3, -4.63], [19.3, 2.69], [6.83, 5.22], [-6.82, 5.22], [-6.91, 5.15], [-6.91, -5.75], [-6.84, -5.85], [3.09, -12.21], [4.91, -12.21]]],
  lago=orilla_irregular([[-80, 27.0], [-30, 26.0], [-10, 24.2], [0.0, 23.6], [10.0, 24.2], [16.0, 20.0], [20.0, 12.0], [24.0, 4.0], [30.0, -2.0], [80, -2.0], [80, 140], [-80, 140]]),
  # Guaduales (video VISTA AL MUELLE): matas de guadua en la orilla, a la izquierda del muelle mirando al lago. Posición y tamaño [E]
  guaduas=[dict(pos=[-6.2, 22.7], culmos=34, alto=12.0, radio=1.3), dict(pos=[-9.6, 22.1], culmos=26, alto=10.5, radio=1.1)],
  muelle=dict(id='GH-MUELLE-01', centro=[0.0, 24.27], largo=8.0, ancho=4.0, giro=0, nivel=-0.66)   # al frente del Green House (Zona E),
)

venue = dict(
  id='greenhouse', nombre='Green House', operador='Zona E',
  modelo='greenhouse_arquitectura.glb', unidades='m',
  origen_rhino=list(O),
  # Puntos del recorrido en primera persona (x, y del plano; la altura de ojos se calcula sobre el piso)
  puntos=[
    dict(id='llegada', nombre='Llegada',  pos=L(14.2, -8.0),  mira=L(14.0, 4.0)),
    dict(id='pasarela', nombre='Pasarela', pos=L(15.0, 13.6),  mira=L(23.0, 16.0)),
    dict(id='deck',    nombre='Deck',     pos=L(23.2, 15.8),  mira=L(30.0, 12.0)),
    dict(id='salon',   nombre='Salón',    pos=L(31.7, 10.4),  mira=L(28.5, 3.0)),
    dict(id='bar',     nombre='Bar',      pos=L(26.6, 3.6),   mira=L(23.9, 1.4)),
    dict(id='ceremonia', nombre='Ceremonia', pos=L(28.91, 21.0), mira=L(28.91, 32.0)),
    dict(id='suite',   nombre='Suite',    pos=L(46.1, 13.5),  mira=L(46.1, 5.0)),
    dict(id='muelle',  nombre='Muelle',   pos=L(28.91, 31.3),  mira=L(28.91, 15.0)),
  ],
  # Puntos interactivos: UNO por tipo de elemento (ref = objeto donde se ancla) y uno por espacio.
  hotspots=[
    dict(ref='GH-MESA-03', h=0.95), dict(ref='GH-SILLA-021', h=1.05), dict(ref='GH-NOVIOS-01', h=0.95),
    dict(ref='GH-POSTRES-01', h=1.2), dict(ref='GH-COCT-02', h=1.25), dict(ref='GH-SCOCT-06', h=1.3),
    dict(ref='GH-SALA-01', h=1.15), dict(ref='GH-SALA-02', h=0.5), dict(ref='GH-BARRA-01', h=1.45),
    dict(espacio='GH-ESP-SALON', pos=L(31.3, 5.9), h=3.1), dict(espacio='GH-ESP-DECK', pos=L(29.0, 15.5), h=2.6),
 dict(espacio='GH-ESP-SERVICIOS', pos=L(26.0, 0.0), h=2.6),
    dict(espacio='GH-ESP-ENTRADA', pos=L(14.2, -3.0), h=1.4), dict(espacio='GH-ESP-MUELLE', pos=L(28.91, 30.17), h=1.2),
    dict(espacio='GH-ESP-CEREMONIA', pos=L(28.91, 24.2), h=1.0), dict(espacio='GH-ESP-SUITE', pos=L(46.1, 5.0), h=3.0),
  ],
  exterior=exterior,
  espacios=[
    dict(id='GH-ESP-CEREMONIA', nombre='Zona de ceremonia', poligono=R([(23.9, 20.2), (33.9, 20.2), (33.9, 28.2), (23.9, 28.2)]),
         camara=dict(pos=L(28.91, 16.5)+[3.2], mira=L(28.91, 27.0)+[0.0])),
    dict(id='GH-ESP-SUITE', nombre='Suite', poligono=R([(44.1, 1.4), (48.1, 1.4), (48.1, 11.55), (44.1, 11.55)]),
         camara=dict(pos=L(41.0, 16.0)+[5.5], mira=L(46.1, 5.0)+[1.5])),
    dict(id='GH-ESP-MUELLE', nombre='Muelle', poligono=R(muelle_rect()), camara=dict(pos=L(28.91, 20.0)+[4.0], mira=L(28.91, 30.17)+[0.0])),
    dict(id='GH-ESP-ENTRADA', nombre='Llegada y pasarela', poligono=R([(12.86,-8.72),(15.53,-8.72),(15.53,10.35),(20.88,14.46),(21.87,14.46),(21.87,17.11),(20.88,17.11),(12.86,10.22)]),
         camara=dict(pos=L(14.2, -11.5)+[0.94], mira=L(15.0, 6.0)+[0.5])),
    dict(id='GH-ESP-SALON', nombre='Salón', poligono=R([(22.0, 0.69), (35.82, 0.69), (35.82, 11.10), (22.0, 11.10)]),
         camara=dict(pos=L(36.5, 13.5)+[6.0], mira=L(28.9, 5.9)+[0.8])),
    dict(id='GH-ESP-DECK', nombre='Deck de cóctel', poligono=R([(22.0, 11.25), (35.97, 11.25), (35.97, 19.17), (22.0, 19.17)]),
         camara=dict(pos=L(29.0, 26.0)+[5.0], mira=L(29.0, 15.0)+[0.8])),
    dict(id='GH-ESP-SERVICIOS', nombre='Bar y servicios', poligono=R([(22.57, -1.71), (37.90, -1.71), (37.90, 0.69), (22.57, 0.69)]),
         camara=dict(pos=L(30.0, 8.0)+[2.2], mira=L(24.5, 1.0)+[1.2])),
  ],
  objetos=objs)
json.dump(venue, open('../site/data/greenhouse.venue.json', 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print(Counter(o['tipo'] for o in objs))
