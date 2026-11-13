// Vegetación detallada (no volúmenes): guaduas con culmos segmentados y follaje de hojas recortadas.
// Referencia: video VISTA AL MUELLE (matas de guadua en la orilla, arqueadas sobre el agua).
// Cantidad de culmos, alturas y posiciones: ESTIMADAS.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

/** Textura del culmo: verde con nudos (anillos claros + sombra) cada ~0,35 m en la dirección del largo. */
function texCulmo() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, '#4f6a2a'); grad.addColorStop(0.45, '#7d9640'); grad.addColorStop(1, '#46602a');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${40 + Math.random() * 60},${70 + Math.random() * 50},30,0.12)`; g.fillRect(Math.random() * 64, Math.random() * 256, 1, 6 + Math.random() * 20); }
  g.fillStyle = '#c9c79a'; g.fillRect(0, 246, 64, 4);          // anillo del nudo
  g.fillStyle = 'rgba(30,40,15,.55)'; g.fillRect(0, 250, 64, 6);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; return t;
}

/** Textura de rama con hojas lanceoladas (hoja de guadua), con transparencia. */
function texHojas() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  const r = rng(7);
  g.strokeStyle = '#5b6b2c'; g.lineWidth = 2; g.beginPath(); g.moveTo(20, 236); g.quadraticCurveTo(110, 150, 236, 30); g.stroke();
  for (let k = 0; k < 22; k++) {
    const t = 0.12 + k / 22 * 0.85, x = 20 + 216 * t, y = 236 - 206 * t + (r() - 0.5) * 10;
    const ang = -0.7 + (k % 2 ? 1 : -1) * (0.7 + r() * 0.5), L = 55 + r() * 40, W = 7 + r() * 4;
    g.save(); g.translate(x, y); g.rotate(ang);
    const h = 75 + r() * 25, s = 40 + r() * 20, l = 32 + r() * 18;
    g.fillStyle = `hsl(${h},${s}%,${l}%)`;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.4, -W, L, 0); g.quadraticCurveTo(L * 0.4, W, 0, 0); g.fill();
    g.strokeStyle = `hsla(${h},${s}%,${l + 14}%,.6)`; g.lineWidth = 1; g.beginPath(); g.moveTo(2, 0); g.lineTo(L - 4, 0); g.stroke();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

let MAT = null;
function materiales() {
  if (MAT) return MAT;
  MAT = {
    culmo: new THREE.MeshStandardMaterial({ map: texCulmo(), roughness: 0.55, metalness: 0 }),
    hoja: new THREE.MeshStandardMaterial({ map: texHojas(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 }),
  };
  return MAT;
}

/** Mata de guadua. pos en coordenadas de plano (x, y), suelo a la altura z0. */
export function crearGuadual(scene, { pos, culmos = 30, alto = 12, radio = 1.2 }, z0, seed = 11) {
  const r = rng(seed), M = materiales(), grupo = new THREE.Group();
  grupo.position.set(pos[0], z0, -pos[1]); scene.add(grupo);
  const tubos = [], hojas = [];
  for (let i = 0; i < culmos; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radio;
    const base = new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d);
    const h = alto * (0.7 + r() * 0.35);
    // inclinación hacia afuera de la mata + arqueo de la punta (la guadua se dobla con el peso del follaje)
    const out = new THREE.Vector3(base.x, 0, base.z).normalize().multiplyScalar(0.16 + r() * 0.3).add(new THREE.Vector3((r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2));
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      pts.push(base.clone().add(new THREE.Vector3(out.x * h * (t + t * t * 0.9), h * t * (1 - 0.18 * t * t), out.z * h * (t + t * t * 0.9))));
    }
    const curva = new THREE.CatmullRomCurve3(pts);
    const rad = 0.045 + r() * 0.03;
    const g = new THREE.TubeGeometry(curva, 24, rad, 7, false);
    const p = g.attributes.position, n = 25 * 8;                     // adelgaza hacia la punta
    for (let s = 0; s <= 24; s++) {
      const t = s / 24, c = curva.getPointAt(t), f = 1 - 0.75 * t;
      for (let j = 0; j <= 7; j++) { const idx = s * 8 + j; if (idx >= p.count) continue;
        p.setXYZ(idx, c.x + (p.getX(idx) - c.x) * f, c.y + (p.getY(idx) - c.y) * f, c.z + (p.getZ(idx) - c.z) * f); }
    }
    const uv = g.attributes.uv, largo = curva.getLength();
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getY(k), uv.getX(k) * largo / 0.35);   // un nudo cada 0,35 m
    g.computeVertexNormals(); tubos.push(g);
    // follaje: ramilletes en la mitad superior del culmo
    const nH = Math.round(26 + h * 2.6);
    for (let k = 0; k < nH; k++) {
      const t = 0.38 + Math.pow(r(), 0.7) * 0.62, c = curva.getPointAt(Math.min(t, 1));
      const s = 0.7 + r() * 0.7;
      hojas.push({ p: c, s, rx: (r() - 0.5) * 2.4, ry: r() * Math.PI * 2, rz: (r() - 0.5) * 2.4, tint: 0.8 + r() * 0.35 });
    }
  }
  const cul = new THREE.Mesh(mergeGeometries(tubos), M.culmo); cul.castShadow = true; cul.receiveShadow = true; grupo.add(cul);
  const plano = new THREE.PlaneGeometry(1, 1); plano.translate(0.45, 0.45, 0);
  const inst = new THREE.InstancedMesh(plano, M.hoja, hojas.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  hojas.forEach((h, i) => {
    q.setFromEuler(new THREE.Euler(h.rx, h.ry, h.rz));
    m4.compose(h.p, q, new THREE.Vector3(h.s, h.s, h.s)); inst.setMatrixAt(i, m4);
    inst.setColorAt(i, col.setRGB(h.tint * 0.95, h.tint, h.tint * 0.85));
  });
  inst.castShadow = true; inst.receiveShadow = true; inst.userData.sinAO = true; grupo.add(inst);
  return grupo;
}

// ======================================================================================
// JARDINERAS: mezcla de especies (atlas 2×2) con alturas y tonos distintos para dar profundidad.
//   0 · hojas grandes de corazón (filodendro / anturio)   – oscuras, medianas
//   1 · hojas largas en cinta (heliconia / dracena)        – claras, altas y erguidas
//   2 · helecho (frondas plumosas)                         – verde medio, bajo y arqueado
//   3 · calatea / hoja rayada                              – verde azulado, bajo
// ======================================================================================
function hojaPath(g, L, W, punta = 0.8) {
  g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(L * 0.25, -W, L * punta, -W * 0.8, L, 0); g.bezierCurveTo(L * punta, W * 0.8, L * 0.25, W, 0, 0);
}
function texAtlasPlantas() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S * 2; const g = c.getContext('2d'); const r = rng(33);
  const celda = (i, fn) => { g.save(); g.translate((i % 2) * S, Math.floor(i / 2) * S); g.beginPath(); g.rect(0, 0, S, S); g.clip(); fn(); g.restore(); };
  // 0 · filodendro: hojas acorazonadas grandes, brillo en el borde superior
  celda(0, () => {
    for (let k = 0; k < 9; k++) {
      const x = S * (0.25 + r() * 0.5), y = S * (0.35 + r() * 0.5), L = S * (0.28 + r() * 0.16), W = L * 0.55, a = -Math.PI / 2 + (r() - 0.5) * 2.0;
      const h = 95 + r() * 30, l = 20 + r() * 14;
      g.save(); g.translate(x, y); g.rotate(a);
      const gr = g.createLinearGradient(0, -W, 0, W); gr.addColorStop(0, `hsl(${h},50%,${l + 12}%)`); gr.addColorStop(0.5, `hsl(${h},55%,${l}%)`); gr.addColorStop(1, `hsl(${h},45%,${l - 5}%)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(L * 0.1, -W * 1.1, L * 0.75, -W * 0.9, L, 0); g.bezierCurveTo(L * 0.75, W * 0.9, L * 0.1, W * 1.1, 0, 0); g.fill();
      g.strokeStyle = `hsla(${h},35%,${l + 25}%,.55)`; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(L * 0.95, 0); g.stroke();
      g.lineWidth = 1; for (let v = 0.12; v < 0.85; v += 0.11) { g.beginPath(); g.moveTo(L * v, 0); g.quadraticCurveTo(L * (v + 0.08), -W * 0.4, L * (v + 0.16), -W * 0.75); g.moveTo(L * v, 0); g.quadraticCurveTo(L * (v + 0.08), W * 0.4, L * (v + 0.16), W * 0.75); g.stroke(); }
      g.restore();
    }
  });
  // 1 · heliconia / dracena: hojas largas y angostas, erguidas, verde amarillento
  celda(1, () => {
    for (let k = 0; k < 14; k++) {
      const x = S * (0.4 + r() * 0.2), a = -Math.PI / 2 + (r() - 0.5) * 1.1, L = S * (0.55 + r() * 0.35), W = S * (0.035 + r() * 0.03);
      const h = 75 + r() * 25, l = 28 + r() * 16;
      g.save(); g.translate(x, S * 0.98); g.rotate(a);
      g.fillStyle = `hsl(${h},48%,${l}%)`; hojaPath(g, L, W, 0.9); g.fill();
      g.strokeStyle = `hsla(${h},40%,${l + 18}%,.7)`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(L * 0.97, 0); g.stroke();
      g.restore();
    }
  });
  // 2 · helecho: frondas con foliolos pequeños
  celda(2, () => {
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 2.3, L = S * (0.4 + r() * 0.2), h = 88 + r() * 20, l = 24 + r() * 14;
      g.save(); g.translate(S * 0.5, S * 0.95); g.rotate(a);
      g.strokeStyle = `hsl(${h},40%,${l - 6}%)`; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.5, L * 0.08, L, L * 0.2); g.stroke();
      g.fillStyle = `hsl(${h},50%,${l}%)`;
      for (let t = 0.08; t < 0.97; t += 0.035) {
        const px = L * t, py = L * 0.2 * t * t, w = S * 0.05 * (1 - t * 0.8);
        for (const sg of [-1, 1]) { g.save(); g.translate(px, py); g.rotate(sg * 1.2); hojaPath(g, w, w * 0.28); g.fill(); g.restore(); }
      }
      g.restore();
    }
  });
  // 3 · calatea: hojas ovaladas con rayas claras, verde azulado
  celda(3, () => {
    for (let k = 0; k < 11; k++) {
      const x = S * (0.3 + r() * 0.4), y = S * (0.5 + r() * 0.4), L = S * (0.22 + r() * 0.12), W = L * 0.38, a = -Math.PI / 2 + (r() - 0.5) * 1.8;
      const h = 120 + r() * 25, l = 18 + r() * 10;
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = `hsl(${h},35%,${l}%)`; hojaPath(g, L, W); g.fill();
      g.save(); hojaPath(g, L, W); g.clip();
      g.strokeStyle = `hsla(${h - 30},40%,${l + 22}%,.65)`; g.lineWidth = 3;
      for (let v = 0.1; v < 0.95; v += 0.1) { g.beginPath(); g.moveTo(L * v, 0); g.lineTo(L * (v + 0.08), -W); g.moveTo(L * v, 0); g.lineTo(L * (v + 0.08), W); g.stroke(); }
      g.restore(); g.restore();
    }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
let MAT_ATLAS = null;
// por especie: [tamaño mín, máx], inclinación (0 = erguida), tarjetas por mata, rango de tinte [r,g,b] (desvía el tono)
const ESPECIES = [
  { s: [0.75, 1.15], incl: 0.9, n: 7, tint: [[0.85, 0.95, 0.75], [1.15, 1.15, 0.95]] },
  { s: [1.2, 1.9], incl: 0.25, n: 5, tint: [[0.95, 1.0, 0.75], [1.2, 1.15, 0.85]] },
  { s: [0.55, 0.85], incl: 1.1, n: 6, tint: [[0.8, 0.95, 0.75], [1.05, 1.1, 0.9]] },
  { s: [0.45, 0.7], incl: 0.7, n: 6, tint: [[0.7, 0.85, 0.85], [0.95, 1.0, 1.0]] },
];

/** Jardinera mixta: puntos {x, y, z, borde} (borde = distancia al borde, 0..1) → matas de 4 especies.
 *  Las altas (heliconias) van al centro, las bajas (helecho, calatea) al borde: así hay capas y profundidad. */
export function arbustosTropicales(scene, puntos, seed = 5) {
  if (!MAT_ATLAS) MAT_ATLAS = new THREE.MeshStandardMaterial({ map: texAtlasPlantas(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
  const r = rng(seed), porEspecie = [[], [], [], []];
  for (const p of puntos) {
    const interior = p.borde ?? r();
    const e = interior > 0.55 ? (r() < 0.35 ? 1 : r() < 0.75 ? 0 : 2) : interior > 0.25 ? (r() < 0.5 ? 0 : r() < 0.6 ? 2 : 3) : (r() < 0.5 ? 2 : 3);
    const E = ESPECIES[e], base = THREE.MathUtils.lerp(E.s[0], E.s[1], r());
    const tA = E.tint[0], tB = E.tint[1], k = r(), tint = [0, 1, 2].map(i => THREE.MathUtils.lerp(tA[i], tB[i], k));
    for (let j = 0; j < E.n; j++) {
      const a = (j / E.n) * Math.PI * 2 + r() * 0.8, d = r() * 0.12;
      porEspecie[e].push({ pos: new THREE.Vector3(p.x + Math.cos(a) * d, p.z, -(p.y + Math.sin(a) * d)), s: base * (0.8 + r() * 0.4),
        e: new THREE.Euler(-E.incl * (0.5 + r() * 0.6), a, (r() - 0.5) * 0.3, 'YXZ'), tint: tint.map(v => v * (0.9 + r() * 0.2)) });
    }
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  porEspecie.forEach((cards, e) => {
    if (!cards.length) return;
    const pl = new THREE.PlaneGeometry(1, 1); pl.translate(0, 0.5, 0);
    const uv = pl.attributes.uv, ox = (e % 2) * 0.5, oy = e < 2 ? 0.5 : 0;   // celda del atlas (canvas: fila 0 arriba)
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ox + uv.getX(i) * 0.5, oy + uv.getY(i) * 0.5);
    const inst = new THREE.InstancedMesh(pl, MAT_ATLAS, cards.length);
    cards.forEach((c, i) => { m4.compose(c.pos, q.setFromEuler(c.e), new THREE.Vector3(c.s, c.s, c.s)); inst.setMatrixAt(i, m4); inst.setColorAt(i, col.setRGB(...c.tint)); });
    inst.castShadow = true; inst.receiveShadow = true; inst.userData.sinAO = true; scene.add(inst);
  });
}

// ======================================================================================
// PINOS DE FONDO: billboards cruzados (dos planos en X) con 3 siluetas de pino distintas.
// ======================================================================================
function texPinos() {
  const W = 256, H = 512, c = document.createElement('canvas'); c.width = W * 3; c.height = H; const g = c.getContext('2d'); const r = rng(91);
  for (let v = 0; v < 3; v++) {
    g.save(); g.translate(v * W, 0); g.beginPath(); g.rect(0, 0, W, H); g.clip();
    const cx = W / 2, top = 10 + v * 12, base = H - 6, copaIni = H * (0.22 + v * 0.12);
    g.strokeStyle = '#4a3a2c'; g.lineWidth = 7 - v; g.beginPath(); g.moveTo(cx, base); g.lineTo(cx, top + 20); g.stroke();
    const capas = 22 + v * 4;
    for (let k = 0; k < capas; k++) {
      const t = k / (capas - 1), y = top + (base - copaIni - top) * t + (r() - 0.5) * 6;
      const ancho = (W * 0.46) * (v === 2 ? 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.3)) : Math.pow(t, 0.85)) + 6;
      for (const sg of [-1, 1]) {
        const L = ancho * (0.75 + r() * 0.35), caida = L * (0.18 + r() * 0.15);
        const h = 115 + r() * 30, l = 13 + r() * 10 + (1 - t) * 4;
        g.strokeStyle = `hsl(${h},35%,${l}%)`;
        for (let n = 0; n < 34; n++) {                                      // agujas: trazos cortos a lo largo de la rama
          const u = r(), x = cx + sg * L * u, yy = y + caida * u * u + (r() - 0.5) * 9 * (0.4 + u);
          g.lineWidth = 1 + r() * 1.6; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + sg * (4 + r() * 6), yy + 3 + r() * 6); g.stroke();
        }
      }
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** Bosque de pinos alrededor del lago (fondo). Tamaños, posiciones y número de árboles: ESTIMADOS (decorativo de horizonte). */
export function pinosFondo(scene, { enLago = () => false, suelo = () => -1.7 } = {}, seed = 3) {
  // Zona E 13-nov: los árboles van DETRÁS del lago, sobre el prado de la otra orilla (y a los costados), nunca en el agua.
  const r = rng(seed), mat = new THREE.MeshStandardMaterial({ map: texPinos(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 });
  const variantes = [[], [], []];
  let n = 0, intentos = 0;
  while (n < 380 && intentos < 20000) {
    intentos++;
    const x = -150 + r() * 300, y = -40 + r() * 230;
    if (Math.hypot(x, y - 5) < 42) continue;                              // no sobre el venue ni sus jardines
    if (enLago(x, y) || enLago(x + 2.5, y) || enLago(x - 2.5, y) || enLago(x, y + 2.5) || enLago(x, y - 2.5)) continue;
    const lejos = Math.hypot(x, y - 35);
    if (r() > Math.min(1, 1.4 - lejos / 160)) continue;                   // más denso cerca de la orilla, más ralo lejos
    const h = 14 + r() * 16 + (lejos > 90 ? 6 : 0);
    variantes[Math.floor(r() * 3)].push({ x, y, z: suelo(x, y), h, w: h * (0.42 + r() * 0.12), rot: r() * Math.PI, tono: 0.75 + r() * 0.4, frio: r() });
    n++;
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  variantes.forEach((arr, v) => {
    const p1 = new THREE.PlaneGeometry(1, 1), p2 = new THREE.PlaneGeometry(1, 1); p2.rotateY(Math.PI / 2);
    const g = mergeGeometries([p1, p2]); g.translate(0, 0.5, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (v + uv.getX(i)) / 3);
    const inst = new THREE.InstancedMesh(g, mat, arr.length);
    arr.forEach((t, i) => {
      m4.compose(new THREE.Vector3(t.x, t.z - 0.3, -t.y), q.setFromEuler(new THREE.Euler(0, t.rot, 0)), new THREE.Vector3(t.w, t.h, t.w));
      inst.setMatrixAt(i, m4); inst.setColorAt(i, col.setRGB(t.tono * (0.92 - t.frio * 0.1), t.tono, t.tono * (0.9 + t.frio * 0.15)));
    });
    inst.userData.sinAO = true; scene.add(inst);
  });
}

// ======================================================================================
// HOJA DE PALMA (pinnada) con transparencia: reemplaza la cinta lisa.
// ======================================================================================
let MAT_PALMA = null;
export function materialPalma() {
  if (MAT_PALMA) return MAT_PALMA;
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d'); const r = rng(55);
  g.strokeStyle = '#5d6b30'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 64); g.lineTo(512, 64); g.stroke();
  for (let x = 6; x < 505; x += 7) {
    const t = x / 512, L = 60 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) * (0.85 + r() * 0.25), h = 85 + r() * 25, l = 22 + r() * 14;
    g.strokeStyle = `hsl(${h},48%,${l}%)`; g.lineWidth = 3 + r() * 2;
    for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(x, 64); g.quadraticCurveTo(x + 10, 64 + sg * L * 0.5, x + 22, 64 + sg * L); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  MAT_PALMA = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.65 });
  return MAT_PALMA;
}
