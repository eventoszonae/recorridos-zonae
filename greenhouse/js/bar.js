// Bar interno (videos BAR y fotos de eventos):
// · Barra en L con estructura de acero negro en retícula (igual lenguaje que las ventanas) y cubierta negra.
// · Mueble de fondo: estantería de acero negro en retícula, con el letrero "BAR" de bombillos encima.
// Geometría de la barra = huella del modelo Rhino. Estantería y letrero: medidas y ubicación ESTIMADAS.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const O = [28.91, 5.90];                                  // origen local (centro del salón, coords Rhino)
const L = (x, y) => [x - O[0], y - O[1]];
function box(x0, x1, y0, y1, z0, z1) {                     // caja en coords Rhino → Three
  const [a, b] = L(x0, y0), [c, d] = L(x1, y1);
  const g = new THREE.BoxGeometry(Math.abs(c - a), z1 - z0, Math.abs(d - b));
  g.translate((a + c) / 2, (z0 + z1) / 2, -(b + d) / 2); return g;
}
const acero = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.45, metalness: 0.6 });
const cubierta = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.18, metalness: 0.1 });
// Paneles de ESPEJO (Zona E): opacos, metálicos, pulidos. El reflejo se toma de una foto 360° de la escena (ver espejoBar).
const vidrioOscuro = new THREE.MeshStandardMaterial({ color: 0xc9c9c6, roughness: 0.03, metalness: 1.0, envMapIntensity: 1.0 });
acero.name = 'acero_negro'; cubierta.name = 'marmol_negro'; vidrioOscuro.name = 'espejo_bar';   // nombres = obstáculos del recorrido

/** Panel de retícula: marco + parales cada `mod` m + travesaños, en un plano vertical (x const o y const). */
function reticula(eje, c, a0, a1, z0, z1, mod = 0.45, travesanos = [0.12, 0.6], t = 0.035) {
  const g = [], P = (u0, u1, zz0, zz1) => eje === 'x' ? box(c - t / 2, c + t / 2, u0, u1, zz0, zz1) : box(u0, u1, c - t / 2, c + t / 2, zz0, zz1);
  g.push(P(a0, a0 + t, z0, z1), P(a1 - t, a1, z0, z1), P(a0, a1, z0, z0 + t), P(a0, a1, z1 - t, z1));
  for (const z of travesanos) g.push(P(a0, a1, z, z + t));
  const n = Math.max(1, Math.round((a1 - a0) / mod));
  for (let k = 1; k < n; k++) { const u = a0 + (a1 - a0) * k / n; g.push(P(u - t / 2, u + t / 2, z0, z1)); }
  return g;
}

/** Letrero "BAR": letras de lámina metálica (lata) extruidas, con bombillos incrustados en la cara frontal.
 *  Se adosa a la pared (plano y = yPared, coords Rhino), mirando al salón. Altura de letra ≈ 0,42 m [E]. */
const lata = new THREE.MeshStandardMaterial({ color: 0x7a5236, roughness: 0.55, metalness: 0.7 });
export const bombillo = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffd590, emissiveIntensity: 2.2, roughness: 0.3 });
function dentro(pt, poly) {                                   // punto dentro de polígono (par-impar)
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
/** Contornos de las letras B, A, R dibujados a mano (sin tipografía externa). Unidades: m, alto H. */
function formasBAR(H) {
  const w = H * 0.72, e = H * 0.2;                           // ancho de letra y grosor del trazo
  const B = new THREE.Shape(); {
    const mid = H * 0.52;
    B.moveTo(0, 0); B.lineTo(w * 0.62, 0); B.bezierCurveTo(w * 1.08, 0, w * 1.08, mid, w * 0.6, mid);
    B.bezierCurveTo(w * 0.98, mid, w * 0.98, H, w * 0.55, H); B.lineTo(0, H); B.closePath();
    const h1 = new THREE.Path(); h1.moveTo(e, e * 0.75); h1.lineTo(w * 0.55, e * 0.75);
    h1.bezierCurveTo(w * 0.78, e * 0.75, w * 0.78, mid - e * 0.45, w * 0.55, mid - e * 0.45); h1.lineTo(e, mid - e * 0.45); h1.closePath();
    const h2 = new THREE.Path(); h2.moveTo(e, mid + e * 0.45); h2.lineTo(w * 0.5, mid + e * 0.45);
    h2.bezierCurveTo(w * 0.7, mid + e * 0.45, w * 0.7, H - e * 0.75, w * 0.5, H - e * 0.75); h2.lineTo(e, H - e * 0.75); h2.closePath();
    B.holes.push(h1, h2);
  }
  const A = new THREE.Shape(); {
    const W = w * 1.1;
    A.moveTo(0, 0); A.lineTo(e * 1.1, 0); A.lineTo(W * 0.5 - e * 0.05, H - e * 1.6); A.lineTo(W - e * 1.1, 0);
    A.lineTo(W, 0); A.lineTo(W * 0.5 + e * 0.55, H); A.lineTo(W * 0.5 - e * 0.55, H); A.closePath();
    // barra horizontal
    const cb = new THREE.Shape(); const yb = H * 0.28, t = e * 0.75;
    const xl = (yy) => e * 1.1 + (W * 0.5 - e * 0.05 - e * 1.1) * yy / (H - e * 1.6);
    cb.moveTo(xl(yb) - 0.01, yb); cb.lineTo(W - xl(yb) + 0.01, yb); cb.lineTo(W - xl(yb + t) + 0.01, yb + t); cb.lineTo(xl(yb + t) - 0.01, yb + t); cb.closePath();
    A.userData = { extra: cb, ancho: W };
  }
  const R = new THREE.Shape(); {
    const mid = H * 0.45;
    R.moveTo(0, 0); R.lineTo(e, 0); R.lineTo(e, mid); R.lineTo(w * 0.42, mid); R.lineTo(w * 0.78, 0); R.lineTo(w * 1.02, 0);
    R.lineTo(w * 0.62, mid + e * 0.15); R.bezierCurveTo(w * 1.05, mid + e * 0.4, w * 1.0, H, w * 0.55, H); R.lineTo(0, H); R.closePath();
    const h = new THREE.Path(); h.moveTo(e, mid + e * 0.7); h.lineTo(w * 0.5, mid + e * 0.7);
    h.bezierCurveTo(w * 0.74, mid + e * 0.7, w * 0.74, H - e * 0.75, w * 0.5, H - e * 0.75); h.lineTo(e, H - e * 0.75); h.closePath();
    R.holes.push(h);
  }
  return [[B, w * 0.95], [A, A.userData.ancho], [R, w * 1.02]];
}
function letrero3D(scene, xc, yPared, zc) {
  const [lx, ly] = L(xc, yPared);
  const grupo = new THREE.Group(); grupo.position.set(lx, zc, -ly - 0.012); grupo.rotation.y = Math.PI; scene.add(grupo);
  const H = 0.42, P = 0.07, sep = 0.06;                      // alto de letra, fondo de la lata, separación [E]
  const letras = formasBAR(H);
  const total = letras.reduce((s, [, a]) => s + a, 0) + sep * 2;
  let x = -total / 2;
  const geos = [], bulbs = [], paso = 0.07, r = 0.016, margen = 0.026;
  for (const [sh, ancho] of letras) {
    const partes = [sh, ...(sh.userData?.extra ? [sh.userData.extra] : [])];
    for (const p of partes) { const g = new THREE.ExtrudeGeometry(p, { depth: P, bevelEnabled: false, curveSegments: 10 }); g.translate(x, -H / 2, 0); geos.push(g.toNonIndexed()); }
    const polys = partes.map(p => ({ ext: p.getPoints(10), huecos: p.holes.map(h => h.getPoints(10)) }));
    const den = (q) => polys.some(({ ext, huecos }) => dentro(q, ext) && !huecos.some(h => dentro(q, h)));
    const pts = [];
    for (let u = 0; u <= ancho; u += 0.012) for (let v = 0; v <= H; v += 0.012) {
      if (![[0, 0], [margen, 0], [-margen, 0], [0, margen], [0, -margen]].every(([a, b]) => den({ x: u + a, y: v + b }))) continue;
      if (!pts.some(([a, b]) => (a - u) ** 2 + (b - v) ** 2 < paso * paso)) pts.push([u, v]);
    }
    pts.forEach(([u, v]) => bulbs.push([u + x, v - H / 2]));
    x += ancho + sep;
  }
  const m = new THREE.Mesh(mergeGeometries(geos), lata); m.castShadow = true; grupo.add(m);
  const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 10, 8), bombillo, bulbs.length), mt = new THREE.Matrix4();
  bulbs.forEach(([u, v], i) => inst.setMatrixAt(i, mt.makeTranslation(u, v, P + r * 0.5)));
  grupo.add(inst);
  const luz = new THREE.PointLight(0xffd8a0, 2.0, 3.5, 2); luz.position.set(0, 0, 0.5); grupo.add(luz);
}

/** Captura una vez el entorno desde el centro de la barra y lo usa como reflejo de los espejos.
 *  Llamar cuando toda la escena ya esté cargada (es una sola captura: no afecta el rendimiento). */
const marcosPlata = [];
let rtEspejo = null;
export function espejoBar(renderer, scene) {
  rtEspejo?.dispose();
  const rt = rtEspejo = new THREE.WebGLCubeRenderTarget(512, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cam = new THREE.CubeCamera(0.1, 200, rt);
  const [x, y] = L(24.0, 2.9); cam.position.set(x, 0.7, -y);
  scene.add(cam); cam.update(renderer, scene); scene.remove(cam);
  vidrioOscuro.envMap = rt.texture; vidrioOscuro.needsUpdate = true;
  for (const m of marcosPlata) { m.envMap = rt.texture; m.needsUpdate = true; }
}

export function crearBar(scene) {
  const steel = [], top = [], glass = [];
  // ----- barra en L (huella Rhino): brazo largo (frente al salón) y brazo corto (lateral)
  const H = 1.12;
  top.push(box(22.57, 25.27, 2.12, 2.49, H, H + 0.04), box(24.89, 25.27, 0.69, 2.12, H, H + 0.04));
  steel.push(...reticula('y', 2.47, 22.57, 25.27, 0, H), ...reticula('x', 25.25, 0.69, 2.49, 0, H));
  glass.push(box(22.60, 25.20, 2.42, 2.44, 0.05, H - 0.04), box(25.20, 25.22, 0.72, 2.44, 0.05, H - 0.04));
  steel.push(box(22.57, 25.27, 2.55, 2.58, 0.18, 0.21), box(25.33, 25.36, 0.69, 2.58, 0.18, 0.21));   // reposapiés
  // ----- estantería de fondo contra la PARED DE MADERA del volumen de servicios (Zona E), dentro de la L,
  //       mirando al salón. 1,50 × 0,45 × 2,20 m (confirmado)
  const x0 = 22.95, x1 = 24.45, y0 = 0.72, y1 = 1.17, HS = 2.2;   // 1,50 × 0,45 × 2,20 m (Zona E)
  for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) steel.push(box(x - 0.02, x + 0.02, y - 0.02, y + 0.02, 0, HS));
  for (const z of [0.05, 0.6, 1.1, 1.6, 2.18]) steel.push(box(x0, x1, y0, y1, z, z + 0.025));
  steel.push(...reticula('y', y1, x0, x1, 0, HS, 0.4, [0.6, 1.1, 1.6], 0.025));
  const m1 = new THREE.Mesh(mergeGeometries(steel.map(g => g.toNonIndexed())), acero); m1.castShadow = true; scene.add(m1);
  scene.add(new THREE.Mesh(mergeGeometries(top), cubierta), new THREE.Mesh(mergeGeometries(glass), vidrioOscuro));
  // ----- letrero BAR: letras 3D en lata con bombillos, PARADAS ENCIMA de la estantería (Zona E, 12-nov)
  letrero3D(scene, (x0 + x1) / 2, (y0 + y1) / 2 - 0.035, HS + 0.005 + 0.21);   // apoyado SOBRE la estantería (Zona E)
}

/** Nicho detrás de la pista (interior del contenedor, video BAR): paneles de madera, espejos de borde ondulado,
 *  downlights en el techo y una luz cálida suave para que se lea la profundidad. Posiciones y medidas [E]. */
export function crearNicho(scene) {
  // Espejos sin marco con borde biselado ondulado; dos diseños alternados (foto del nicho). ≈ 0,55 × 0,85 m [E]
  const ondulado = (w, h, P = THREE.Shape) => {
    const s = new P(), pts = [], N = 96;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2, cx = Math.cos(a), cy = Math.sin(a);
      const r = 1 + 0.045 * Math.sin(a * 14);                       // festón
      const sq = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);   // forma rectangular redondeada
      pts.push([sq(cx, 0.45) * w / 2 * r, sq(cy, 0.45) * h / 2 * r]);
    }
    s.moveTo(...pts[0]); pts.slice(1).forEach(p => s.lineTo(...p)); s.closePath(); return s;
  };
  const ornamental = (w, h, P = THREE.Shape) => {
    const s = new P(), x = w / 2, y = h / 2;
    s.moveTo(-x, -y + 0.12); s.quadraticCurveTo(-x + 0.02, -y + 0.02, -x + 0.12, -y);
    s.lineTo(-0.06, -y); s.quadraticCurveTo(0, -y - 0.06, 0.06, -y); s.lineTo(x - 0.12, -y);
    s.quadraticCurveTo(x - 0.02, -y + 0.02, x, -y + 0.12); s.quadraticCurveTo(x - 0.05, 0, x, y - 0.12);
    s.quadraticCurveTo(x - 0.02, y - 0.02, x - 0.12, y); s.lineTo(0.06, y); s.quadraticCurveTo(0, y + 0.07, -0.06, y);
    s.lineTo(-x + 0.12, y); s.quadraticCurveTo(-x + 0.02, y - 0.02, -x, y - 0.12); s.quadraticCurveTo(-x + 0.05, 0, -x, -y + 0.12);
    s.closePath(); return s;
  };
  // Marco plateado (Zona E, 12-nov): moldura de 5 cm que sigue la forma del espejo
  const plata = new THREE.MeshStandardMaterial({ color: 0xcfcfcc, roughness: 0.32, metalness: 1.0 });
  marcosPlata.push(plata);
  const marco = (forma, w, h) => {
    const ext = forma(w + 0.10, h + 0.10); ext.holes.push(forma(w - 0.01, h - 0.01, THREE.Path));
    const g = new THREE.ExtrudeGeometry(ext, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 8 });
    return new THREE.Mesh(g, plata);
  };
  const yW = -1.595, z0 = -0.25;
  [27.0, 28.3, 29.6, 30.9].forEach((x, i) => {
    const [lx, ly] = L(x, yW);
    const forma = i % 2 ? ornamental : ondulado, w = i % 2 ? 0.56 : 0.52;
    const m = new THREE.Mesh(new THREE.ShapeGeometry(forma(w, 0.86), 8), vidrioOscuro);
    m.position.set(lx, z0 + 1.42, -ly - 0.006); m.rotation.y = Math.PI; scene.add(m);
    const f = marco(forma, w, 0.86); f.position.set(lx, z0 + 1.42, -ly - 0.002); f.rotation.y = Math.PI; f.castShadow = true; scene.add(f);
  });
  // detectores/luces redondas blancas en el cielo de madera (foto)
  const dl = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, emissive: 0x6a665c, roughness: 0.4 });
  for (const x of [26.9, 28.8, 30.7]) {
    const [lx, ly] = L(x, -0.4); const d = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.03, 20), dl);
    d.position.set(lx, 2.635, -ly); scene.add(d);
  }
  const [cx, cy] = L(28.8, -0.5);
  const luz = new THREE.PointLight(0xffe2b8, 5, 6, 1.6); luz.position.set(cx, 2.3, -cy); scene.add(luz);
}
