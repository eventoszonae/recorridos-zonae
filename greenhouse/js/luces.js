// Elementos FIJOS de iluminación (confirmados por Zona E):
// · Guirnaldas de luces pequeñas en todo el techo del salón.
// · 2 lámparas de ratán sobre el bar interno.
import * as THREE from 'three';

const P = (x, y, h) => new THREE.Vector3(x, h, -y);
// Materiales de bombillos compartidos: el modo Día / Atardecer / Noche cambia su brillo (ver ambiente.js)
export const matGuirnalda = new THREE.MeshBasicMaterial({ color: 0xffc46b });
export const matBulboRatan = new THREE.MeshBasicMaterial({ color: 0xffb860 });   // coordenadas locales del plano (origen = centro del salón)

/** Guirnaldas (foto del salón, Zona E 12-nov): hilos PARALELOS muy seguidos a lo largo del salón, con caída suave
 *  entre vigas, y unos hilos colgados en "guirnalda" más profunda hacia el costado del deck. Bombillo cada ~10 cm.
 *  Separación entre hilos ≈ 0,32 m y caídas: ESTIMADAS. */
export function guirnaldas(scene) {
  const TOP = 3.93, x0 = -6.85, x1 = 6.85, y0 = -5.0, y1 = 5.0;
  const cables = [];   // [a, b, caída, tramos]
  for (let y = y0; y <= y1 + 0.01; y += 0.32) cables.push([P(x0, y, TOP), P(x1, y, TOP), 0.10, 5]);
  // guirnaldas colgadas (más profundas), cruzando en diagonal sobre el lado del deck
  for (const [xa, ya, xb, yb, c] of [[-6.6, 4.9, 1.2, 1.2, 0.75], [-2.0, 4.9, 6.6, 1.6, 0.85], [1.5, 4.9, 6.7, 3.1, 0.55], [-6.7, 2.6, -1.0, 4.9, 0.6]])
    cables.push([P(xa, ya, TOP), P(xb, yb, TOP), c, 1]);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
  const bulbs = [], lineas = [];
  for (const [a, b, caida, tramos] of cables) {
    const L = a.distanceTo(b), n = Math.round(L / 0.10);
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n, p = a.clone().lerp(b, t), u = (t * tramos) % 1;
      p.y -= caida * 4 * u * (1 - u);
      bulbs.push(p); if (prev) lineas.push(prev, p); prev = p;
    }
  }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lineas), lineMat));
  const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.011, 6, 4), matGuirnalda, bulbs.length);
  const m = new THREE.Matrix4();
  bulbs.forEach((p, i) => inst.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
  scene.add(inst);
}

/** Celosía de ratán dibujada (rombos), usada con transparencia recortada. */
function texturaRatan() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128); g.strokeStyle = '#b8874f'; g.lineWidth = 5;
  for (let i = -128; i < 256; i += 21) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i, 128); g.lineTo(i + 128, 0); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 3);
  return t;
}

/** Lámparas de ratán del bar (video BAR): bulbo calado colgado de cuerda. Medidas ESTIMADAS. */
export function lamparasRatan(scene, posiciones, alturaBorde = 2.35) {
  // forma de bulbo/cebolla con punta arriba y abajo (video BAR) – Ø ≈ 0,48 m, alto ≈ 0,70 m [E]
  const perfil = [[0.01, 0], [0.06, 0.04], [0.17, 0.15], [0.24, 0.30], [0.22, 0.42], [0.13, 0.54], [0.06, 0.63], [0.02, 0.70]].map(([r, h]) => new THREE.Vector2(r, h));
  const geo = new THREE.LatheGeometry(perfil, 28);
  const mat = new THREE.MeshStandardMaterial({ map: texturaRatan(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
  for (const [x, y] of posiciones) {
    const l = new THREE.Mesh(geo, mat); l.position.copy(P(x, y, alturaBorde)); l.castShadow = true; scene.add(l);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), matBulboRatan);
    bulb.position.copy(P(x, y, alturaBorde + 0.30)); scene.add(bulb);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 3.95 - alturaBorde - 0.70, 4), new THREE.MeshStandardMaterial({ color: 0xa57a4c, roughness: 1 }));
    cable.position.copy(P(x, y, (3.95 + alturaBorde + 0.70) / 2)); scene.add(cable);
  }
}
