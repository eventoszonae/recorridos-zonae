// Exterior de llegada: jardineras, palmas y bolardos de luz.
// Vegetación REPRESENTATIVA (no especie por especie): ubica volumen, altura y sombra según el plano.
import * as THREE from 'three';
import { crearGuadual, arbustosTropicales, pinosFondo, materialPalma } from './vegetacion.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const P = (x, y, h = 0) => new THREE.Vector3(x, h, -y);
// Terreno plano al nivel del prado (-0,68 m bajo el salón) y fondo del lago bajo el agua.
let LAGO = null, ORILLA_BB = null, MUELLE = null; const SEG_GRID = new Map(), CELDA_LAGO = new Map();   // tramos de orilla por celda de 4 m (rápido)
const NIVEL_AGUA = -2.0;   // ~0,35 m bajo el muelle [E]
const FONDO_LAGO = -2.8;
/** Nivel del prado SIN la orilla. MEDIDO con los escaneos de Zona E (13-nov, Scaniverse):
 *  · Entrada, sendero y jardines: a nivel del salón (prado ~6 cm abajo).
 *  · Bajo la pasarela y el cóctel el terreno baja en depresión: el deck queda ~0,75 m sobre el prado de su frente.
 *  · Del frente del deck al muelle (~9 m) el prado baja como una lomita: el muelle queda ~1,65 m bajo el deck.
 *  Perfil del escaneo deck→muelle (distancia desde el frente del deck → altura): 0→-0,75 · 2→-0,95 · 4→-1,25 · 6→-1,47 · 9→-1,64 */
const PERFIL_LAGO = [[0, -0.70], [1, -0.76], [2, -0.95], [3, -1.10], [4, -1.25], [5, -1.40], [6, -1.47], [7, -1.55], [8, -1.60], [9, -1.64], [30, -1.66]];
const Y_FRENTE_DECK = 13.27;
export function nivelPrado(y) {
  if (y <= Y_FRENTE_DECK) return -0.06 - 0.69 * THREE.MathUtils.smoothstep(y, 2.5, Y_FRENTE_DECK - 1.5);
  const d = y - Y_FRENTE_DECK;
  for (let i = 1; i < PERFIL_LAGO.length; i++) {
    const [d0, h0] = PERFIL_LAGO[i - 1], [d1, h1] = PERFIL_LAGO[i];
    if (d <= d1) return h0 + (h1 - h0) * (d - d0) / (d1 - d0);
  }
  return -1.66;
}
export function alturaTerreno(y, x = 0) {
  // Bajo el muelle (rectangular, 8 × 4 m) el terreno queda por debajo de la plataforma: así el pasto no la atraviesa
  if (MUELLE) {
    const dx = Math.abs(x - MUELLE.centro[0]) - MUELLE.largo / 2, dy = Math.abs(y - MUELLE.centro[1]) - MUELLE.ancho / 2;
    if (dx < 0.7 && dy < 0.7) return Math.min(alturaBase(y, x), MUELLE.nivel - 0.12);   // el faldón de 20 cm del muelle tapa el borde
  }
  return alturaBase(y, x);
}
function alturaBase(y, x) {
  const base = nivelPrado(y);
  if (!LAGO) return base;
  const key = Math.floor(x / 4) + ',' + Math.floor(y / 4), segs = SEG_GRID.get(key);
  if (!segs) {                                   // celda sin orilla: toda adentro o toda afuera del lago (se calcula una vez)
    if (!CELDA_LAGO.has(key)) CELDA_LAGO.set(key, inside([x, y], LAGO));
    return CELDA_LAGO.get(key) ? FONDO_LAGO : base;
  }
  const dentro = inside([x, y], LAGO);
  let d = Infinity;
  for (const [ax, ay, bx, by] of segs) {
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  if (dentro) return Math.max(FONDO_LAGO, NIVEL_AGUA - 0.08 - d * 0.55);
  if (d > 4) return base;
  const cercaMuelle = Math.abs(x) < 6 && y > 18;
  const n = 0.5 + 0.5 * (0.6 * Math.sin(x * 0.33 + y * 0.12) + 0.4 * Math.sin(x * 0.87 - y * 0.41 + 1.3));   // 0..1
  const borde = cercaMuelle ? base : base + (n - 0.4) * 0.6;                    // tramo bajo … barranco
  if (d < 0.6) {                                                    // cara del borde: barranco empinado o playa suave
    const k = n > 0.55 ? THREE.MathUtils.smoothstep(d, 0, 0.25) : d / 0.6;
    return THREE.MathUtils.lerp(NIVEL_AGUA - 0.12, borde, k);
  }
  return THREE.MathUtils.lerp(borde, base, THREE.MathUtils.smoothstep(d, 0.6, 4));
}
/** Malla del prado con la pendiente hacia el lago. */
export function crearTerreno(material, lago, muelle = null) {
  MUELLE = muelle;
  LAGO = lago || null;
  if (LAGO) {                                                    // caja de la orilla (solo tramos cercanos al venue)
    const o = LAGO.filter(([x, y]) => Math.abs(x) < 79 && y < 100);
    ORILLA_BB = [Math.min(...o.map(p => p[0])) - 5, Math.max(...o.map(p => p[0])) + 5, Math.min(...o.map(p => p[1])) - 5, Math.max(...o.map(p => p[1])) + 5];
    SEG_GRID.clear(); CELDA_LAGO.clear();
    for (let i = 0; i < LAGO.length; i++) {
      const [ax, ay] = LAGO[i], [bx, by] = LAGO[(i + 1) % LAGO.length];
      if (Math.hypot(bx - ax, by - ay) > 3) continue;                       // tramos largos = bordes lejanos del lago
      for (let cx = Math.floor((Math.min(ax, bx) - 4.5) / 4); cx <= Math.floor((Math.max(ax, bx) + 4.5) / 4); cx++)
        for (let cy = Math.floor((Math.min(ay, by) - 4.5) / 4); cy <= Math.floor((Math.max(ay, by) + 4.5) / 4); cy++) {
          const k = cx + ',' + cy; if (!SEG_GRID.has(k)) SEG_GRID.set(k, []); SEG_GRID.get(k).push([ax, ay, bx, by]);
        }
    }
  }
  const g = new THREE.PlaneGeometry(420, 420, 300, 300); g.translate(0, 40, 0); g.rotateX(-Math.PI / 2);   // llega hasta la otra orilla y el bosque
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, alturaTerreno(-p.getZ(i), p.getX(i)));
  g.computeVertexNormals();
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 105, uv.getY(i) * 105);
  const m = new THREE.Mesh(g, material); m.receiveShadow = true; return m;
}

const M = {
  piedra:  new THREE.MeshStandardMaterial({ color: 0x7d7a72, roughness: 0.92 }),
  piedraOrilla: new THREE.MeshStandardMaterial({ color: 0x5f5a50, roughness: 0.85 }),
  tierra:  new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 1 }),
  nucleo:  new THREE.MeshStandardMaterial({ color: 0x1c3517, roughness: 1 }),
  follaje: new THREE.MeshStandardMaterial({ color: 0x2f5a26, roughness: 0.85, side: THREE.DoubleSide }),
  follaje2:new THREE.MeshStandardMaterial({ color: 0x4f7a2e, roughness: 0.8, side: THREE.DoubleSide }),
  tronco:  new THREE.MeshStandardMaterial({ color: 0x5e5244, roughness: 1 }),
  bolardo: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.4 }),
  luz:     new THREE.MeshStandardMaterial({ color: 0xf4f1ea, emissive: 0x2a2a24, roughness: 0.3 }),
};

/** Una hoja de palma: cinta que sale del tronco y se curva hacia abajo. */
function frond(len, width) {
  const seg = 12, pos = [], idx = [], uvs = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, x = t * len, y = Math.sin(t * Math.PI * 0.55) * len * 0.35 - t * t * len * 0.55;
    const w = width;                                       // el ancho real lo da la textura (foliolos recortados)
    pos.push(x, y, -w / 2, x, y + w * 0.12, w / 2);       // ligera "V" para dar volumen
    uvs.push(t, 0, t, 1);
    if (i < seg) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** Palma. `choca(x, y)` (coords de plano) indica si un punto cae dentro del edificio: las hojas que lo atraviesan
 *  se acortan y, si aun así chocan, se quitan (Zona E, 12-nov: las matas no deben meterse a la locación). */
function palm(h, rot, rng, pos = [0, 0], choca = () => false) {
  const trunk = new THREE.CylinderGeometry(0.09, 0.14, h, 7); trunk.translate(0, h / 2, 0);
  const leaves = [];
  const n = 9 + Math.floor(rng() * 4), c = Math.cos(rot), s = Math.sin(rot);
  const atraviesa = f => {
    const p = f.attributes.position;
    for (let k = 0; k < p.count; k += 2) {
      const x = p.getX(k), z = p.getZ(k), wx = x * c + z * s, wz = -x * s + z * c;   // giro del grupo (eje Y)
      if (choca(pos[0] + wx, pos[1] - wz)) return true;
    }
    return false;
  };
  for (let i = 0; i < n; i++) {
    const largo = 1.7 + rng() * 1.0, rz = -0.15 + rng() * 0.5, ry = (i / n) * Math.PI * 2 + rng() * 0.3;
    for (const k of [1, 0.7, 0.45]) {
      const f = frond(largo * k, 0.95);
      f.rotateZ(rz); f.rotateY(ry); f.translate(0, h, 0);
      if (!atraviesa(f)) { leaves.push(f); break; }
    }
  }
  if (!leaves.length) leaves.push(frond(0.4, 0.5).translate(0, h, 0));
  const g = new THREE.Group();
  const t = new THREE.Mesh(trunk, M.tronco); t.castShadow = true; g.add(t);
  const l = new THREE.Mesh(mergeGeometries(leaves), materialPalma()); l.castShadow = true; l.userData.sinAO = true; g.add(l);
  g.rotation.y = rot;
  return g;
}

export const matBolardo = M.luz;   // difusor de los bolardos (el modo Noche lo enciende)
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

/** Plaza de adoquín en espiga al inicio de la llegada (foto). Adoquín ≈ 20 × 10 cm [E]. */
function crearAdoquin(scene, poly) {
  // Adoquín en espina de pescado: textura REAL del escaneo de la llegada (Zona E 13-nov); parche de 2,5 × 1,25 m
  const t = new THREE.TextureLoader().load(new URL('../tex/adoquin.jpg', import.meta.url).href);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 2.5, 1 / 1.25);
  const geo = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y))));
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getZ(i));
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 })); { const cx = poly.reduce((a, q) => a + q[0], 0) / poly.length, cy = poly.reduce((a, q) => a + q[1], 0) / poly.length; m.position.y = alturaTerreno(cy, cx) + 0.025; } m.receiveShadow = true;
  scene.add(m); return m;
}

/** Agua del lago: superficie oscura que refleja el cielo, con ondas suaves animadas. */
function crearLago(scene, poly) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const a = Math.sin(x * 0.098) * 0.5 + Math.sin((x + y) * 0.061) * 0.3 + Math.sin(y * 0.137 + x * 0.02) * 0.4;
    const b = Math.cos(y * 0.098) * 0.5 + Math.cos((x - y) * 0.073) * 0.3;
    const i = (y * 256 + x) * 4; img.data[i] = 128 + a * 50; img.data[i + 1] = 128 + b * 50; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const n = new THREE.CanvasTexture(c); n.wrapS = n.wrapT = THREE.RepeatWrapping; n.repeat.set(0.21, 0.17);
  const geo = new THREE.ShapeGeometry(new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)))); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x24322a, roughness: 0.14, metalness: 0.1, normalMap: n, normalScale: new THREE.Vector2(0.05, 0.05), envMapIntensity: 0.55 });
  const water = new THREE.Mesh(geo, mat); water.position.y = NIVEL_AGUA; water.receiveShadow = true; scene.add(water);
  return dt => { n.offset.x += dt * 0.004; n.offset.y += dt * 0.002; };
}

/** Muelle: plataforma de madera sobre la orilla (video VISTA AL MUELLE). Medidas ESTIMADAS desde el dron. */
function crearMuelle(scene, m, maderaMat) {
  const grp = new THREE.Group();
  const top = new THREE.PlaneGeometry(m.largo, m.ancho); top.rotateX(-Math.PI / 2);
  const uv = top.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * m.ancho, uv.getX(i) * m.largo);  // tablas a lo largo, UV en metros
  const deck = new THREE.Mesh(top, maderaMat); deck.position.y = m.nivel; deck.receiveShadow = true; grp.add(deck);
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x4a3326, roughness: 0.85 });
  for (const [w, d, x, z] of [[m.largo, 0.06, 0, m.ancho / 2], [m.largo, 0.06, 0, -m.ancho / 2], [0.06, m.ancho, m.largo / 2, 0], [0.06, m.ancho, -m.largo / 2, 0]]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), edgeMat); e.position.set(x, m.nivel - 0.1, z); e.castShadow = true; grp.add(e);
  }
  for (const sx of [-1, -0.33, 0.33, 1]) for (const sz of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), edgeMat); p.position.set(sx * (m.largo / 2 - 0.15), m.nivel - 0.7, sz * (m.ancho / 2 - 0.15)); grp.add(p);
  }
  grp.position.set(m.centro[0], 0, -m.centro[1]); grp.rotation.y = THREE.MathUtils.degToRad(m.giro);
  grp.userData = { id: m.id, tipo: 'muelle' }; scene.add(grp);
  return deck;
}

/** Arboleda lejana alrededor del lago (fondo): volúmenes simples, solo para el horizonte. */
function crearArboleda(scene, r) {
  const geos = [];
  for (let i = 0; i < 90; i++) {
    const a = THREE.MathUtils.lerp(-0.25, Math.PI + 0.25, i / 89), R = 85 + r() * 25;
    const x = Math.cos(a) * R, y = 40 + Math.sin(a) * R * 0.8;
    const s = 4 + r() * 4, h = 9 + r() * 12;
    const b = new THREE.IcosahedronGeometry(s, 1); b.scale(1, h / s / 1.6, 1); b.translate(x, -0.7 + h * 0.55, -y); geos.push(b);
  }
  const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: 0x2c4a26, roughness: 0.95 }));
  scene.add(m);
}

export function construirExterior(scene, ext, opts = {}) {
  const r = rng(42);
  const EDIF = ext.edificio || [];
  const distEdificio = (x, y) => EDIF.reduce((m, poly) => Math.min(m, inside([x, y], poly) ? 0 : distBorde([x, y], poly)), Infinity);
  const chocaEdificio = (x, y) => distEdificio(x, y) < 0.3;
  // Jardineras: tierra + arbustos bajos (filodendros) como masas de follaje
  for (const poly of ext.jardineras) {
    const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ShapeGeometry(shape); g.rotateX(-Math.PI / 2);
    const bed = new THREE.Mesh(g, M.tierra); bed.position.y = alturaTerreno(Math.max(...poly.map(p => p[1]))) + 0.01; bed.receiveShadow = true; scene.add(bed);
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    const box = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const puntos = [], prof = Math.min(box[1] - box[0], box[3] - box[2]) / 2;
    const nB = Math.round((box[1] - box[0]) * (box[3] - box[2]) * 3.2);   // densidad: jardín lleno, sin huecos
    for (let k = 0; k < nB; k++) {
      const x = box[0] + r() * (box[1] - box[0]), y = box[2] + r() * (box[3] - box[2]);
      if (!inside([x, y], poly)) continue;
      const dE = distEdificio(x, y);
      if (dE < 0.6) continue;                                            // pegado al muro: sin planta
      const borde = dE < 1.3 ? 0 : Math.min(1, distBorde([x, y], poly) / Math.max(0.6, prof * 0.8));   // cerca del muro: solo plantas bajas
      puntos.push({ x, y, z: alturaTerreno(y, x), borde });
    }
    arbustosTropicales(scene, puntos, 5 + puntos.length);
  }
  for (const p of ext.palmas) {
    const g = palm(p.alto, THREE.MathUtils.degToRad(p.giro), r, p.pos, chocaEdificio);
    g.position.copy(P(p.pos[0], p.pos[1], alturaTerreno(p.pos[1], p.pos[0]))); scene.add(g);
  }
  // Bolardos de luz (video ENTRADA): poste negro ~0,6 m con difusor blanco [medidas E]
  for (const [x, y] of ext.bolardos) {
    const h0 = alturaTerreno(y, x);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 12), M.bolardo); post.position.copy(P(x, y, h0 + 0.25));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), M.luz); cap.position.copy(P(x, y, h0 + 0.56));
    post.castShadow = true; scene.add(post, cap);
  }
  const extra = { floors: [], update: () => {} };
  if (ext.adoquin) extra.floors.push(crearAdoquin(scene, ext.adoquin));
  for (const p of ext.piedras || []) {
    let g = new THREE.DodecahedronGeometry(0.5, 1); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g); const pos = g.attributes.position;   // vértices unidos: la deformación no abre la piedra
    for (let i = 0; i < pos.count; i++) { const k = 0.72 + r() * 0.5; pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * (0.75 + r() * 0.4), pos.getZ(i) * k); }
    g.computeVertexNormals(); g.scale(0.9, p.alto, 0.7);
    const m = new THREE.Mesh(g, M.piedra); m.position.copy(P(p.pos[0], p.pos[1], alturaTerreno(p.pos[1], p.pos[0]) + p.alto * 0.42)); m.rotation.y = r() * 6;
    m.castShadow = true; scene.add(m);
  }
  if (ext.lago) { extra.update = crearLago(scene, ext.lago); crearOrilla(scene, ext.lago, r); }
  if (ext.muelle && opts.madera) extra.floors.push(crearMuelle(scene, ext.muelle, opts.madera));
  (ext.guaduas || []).forEach((gd, i) => crearGuadual(scene, gd, Math.max(alturaTerreno(gd.pos[1], gd.pos[0]), NIVEL_AGUA), 11 + i * 17));
  pinosFondo(scene, { enLago: (x, y) => !!ext.lago && inside([x, y], ext.lago), suelo: (x, y) => alturaTerreno(y, x) });
  return extra;
}

/** Detalle de la orilla: piedras medio sumergidas y matas bajas a lo largo del borde (no frente al muelle). [E] */
function crearOrilla(scene, lago, r) {
  const puntos = [], piedras = [];
  for (let i = 0; i < lago.length - 1; i++) {
    const [ax, ay] = lago[i], [bx, by] = lago[i + 1];
    if (Math.abs(ax) > 60 || ay > 45 || Math.hypot(bx - ax, by - ay) > 3) continue;   // solo la orilla cercana
    if (Math.abs(ax) < 5.5 && ay > 18) continue;                                     // frente al muelle: despejado
    const L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L;
    let sx = nx, sy = ny; if (inside([ax + nx * 0.5, ay + ny * 0.5], lago)) { sx = -nx; sy = -ny; }   // hacia tierra
    const u = r();
    if (u < 0.22) piedras.push([ax - sx * 0.15, ay - sy * 0.15, 0.25 + r() * 0.35]);
    else if (u < 0.6) {
      const k = 1 + Math.floor(r() * 3);
      for (let j = 0; j < k; j++) { const d = 0.2 + r() * 1.0, x = ax + sx * d + (r() - 0.5) * 0.6, y = ay + sy * d + (r() - 0.5) * 0.6;
        puntos.push({ x, y, z: alturaTerreno(y, x), borde: r() * 0.4 }); }
    }
  }
  if (puntos.length) arbustosTropicales(scene, puntos, 77);
  for (const [x, y, t] of piedras) {
    let g = new THREE.DodecahedronGeometry(0.5, 1); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const k = 0.7 + r() * 0.5; pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * (0.6 + r() * 0.3), pos.getZ(i) * k); }
    g.computeVertexNormals(); g.scale(t * 1.6, t, t * 1.3);
    const m = new THREE.Mesh(g, M.piedraOrilla); m.position.set(x, NIVEL_AGUA + t * 0.15, -y); m.rotation.y = r() * 6; m.castShadow = true; m.receiveShadow = true; scene.add(m);
  }
}
function distBorde([x, y], poly) {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return d;
}
function inside([x, y], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
