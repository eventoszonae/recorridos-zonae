// Modos de iluminación: Día · Atardecer · Noche.
// Cambia el cielo, el sol, el reflejo del entorno y enciende las luces FIJAS de la locación
// (guirnaldas, lámparas de ratán, letrero BAR y bolardos). Intensidades y colores: ESTIMADOS a partir de las fotos.
import * as THREE from 'three';
import { matGuirnalda, matBulboRatan } from './luces.js';
import { bombillo as matLetrero } from './bar.js';
import { matBolardo } from './exterior.js';

const P = (x, y, h) => new THREE.Vector3(x, h, -y);

const MODOS = {
  dia:       { cielo: { elev: 52, turbidity: 4, rayleigh: 1.2, mie: 0.004 }, sol: [0xfff1dc, 3.2], hemi: 0.35, env: 0.7, exp: 0.68, luces: 0,   brillo: 1.0 },
  atardecer: { cielo: { elev: 4, turbidity: 9, rayleigh: 2.6, mie: 0.007 }, sol: [0xffa45c, 1.9], hemi: 0.16, env: 0.42, exp: 0.95, luces: 0.6, brillo: 2.4 },
  noche:     { cielo: { elev: -9, turbidity: 2, rayleigh: 0.6, mie: 0.002 }, sol: [0xffd8a8, 0.3], hemi: 0.12, env: 0.08, exp: 1.3, luces: 1.0, brillo: 4.0, hemiColor: [0xffd9b0, 0x3a2a18] },
};

/** Charco de luz en el piso (decal aditivo): da el efecto de luz sobre el sendero sin el costo de una luz real. */
let TEX_CHARCO = null;
function charco(scene, x, y, z, r, color = 0xffc98a) {
  if (!TEX_CHARCO) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); TEX_CHARCO = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: TEX_CHARCO, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.copy(P(x, y, z + 0.06)); m.renderOrder = 3; scene.add(m); return m;
}
/** Proyector de piso (uplight): caja negra con lente encendida + SpotLight hacia arriba, apuntando a `objetivo`. */
const matCaja = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6, metalness: 0.4 });
const matLente = new THREE.MeshBasicMaterial({ color: 0xffe2b0 });

export function crearAmbiente({ scene, renderer, sun, hemi, cielo, venue, alturaTerreno, alCambiar = () => {} }) {
  const movil = matchMedia('(pointer: coarse)').matches;   // en celular: menos luces reales (rendimiento)
  const puntos = [], charcos = [], lentes = [], calida = 0xffc98a;
  const agregar = (x, y, h, i, d, color = calida) => { const l = new THREE.PointLight(color, 0, d, 2); l.position.copy(P(x, y, h)); l.userData.max = i; scene.add(l); puntos.push(l); return l; };
  const foco = (x, y, z, tx, ty, tz, i, d, ang, color = 0xffd49a, penumbra = 0.5) => {
    const l = new THREE.SpotLight(color, 0, d, ang, penumbra, 1.4); l.position.copy(P(x, y, z)); l.target.position.copy(P(tx, ty, tz));
    l.userData.max = i; scene.add(l, l.target); puntos.push(l); return l;
  };
  const uplight = (x, y, z, tx, ty, tz, i, d, ang) => {
    const caja = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 12), matCaja); caja.position.copy(P(x, y, z + 0.05)); scene.add(caja);
    const lente = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), matLente); lente.rotation.x = -Math.PI / 2; lente.position.copy(P(x, y, z + 0.101)); lente.visible = false; scene.add(lente); lentes.push(lente);
    charcos.push([charco(scene, x, y, z, 0.9, 0xffe0b0), 0.55]);
    if (!movil) foco(x, y, z + 0.12, tx, ty, tz, i, d, ang);
  };
  // Salón: guirnaldas (luces suaves sin sombra)
  for (const x of [-3.6, 3.6]) for (const y of [-2.6, 2.6]) agregar(x, y, 3.4, 10, 10);
  agregar(-5.1, -3.65, 2.7, 5, 5, 0xffb064);                                                       // lámparas de ratán
  // Deck y zona de cóctel (para que se vean las mesas cocteleras) [E]
  for (const x of [-3.5, 3.5]) agregar(x, 7.2, 2.45, 6, 8);
  for (const x of [-1.6, 2.4]) agregar(x, 11.1, 2.6, 7, 8);
  // Entrada: bolardos (charco de luz en el sendero) [ubicación de los bolardos: datos del venue]
  for (const [x, y] of venue.exterior.bolardos || []) charcos.push([charco(scene, x, y, alturaTerreno(y, x), 1.6), 0.5]);
  // Piedras iluminadas (proyector al pie de cada piedra)
  for (const p of venue.exterior.piedras || []) {
    const [x, y] = p.pos, z = alturaTerreno(y, x);
    uplight(x - 0.9, y - 0.9, z, x, y, z + p.alto * 0.5, 22, 6, 0.55);
  }
  // Jardines: luz indirecta hacia las copas de algunas palmas (1 de cada 3) [E]
  (venue.exterior.palmas || []).filter((_, i) => i % 3 === 0).forEach(p => {
    const [x, y] = p.pos, z = alturaTerreno(y, x);
    uplight(x + 0.35, y - 0.35, z, x, y, z + p.alto, 28, p.alto + 4, 0.6);
  });
  // Jardineras: bañado cálido general (luz indirecta) para que todo el jardín se lea de noche [E]
  for (const poly of venue.exterior.jardineras || []) {
    const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length, z = alturaTerreno(cy, cx);
    agregar(cx, cy, z + 2.2, 22, 9, 0xffc27a);
    charcos.push([charco(scene, cx, cy, z, 3.2, 0xffcf90), 0.35]);
  }
  // Muelle y lago: reflector colgado del borde del alero del Green House (frente al lago), apuntando al muelle y al agua
  // (sugerencia Zona E 12-nov). Posición exacta y potencia [E].
  const mu = venue.exterior.muelle;
  if (mu) {
    const xr = mu.centro[0], yr = 9.1, zr = 2.6;                      // borde del alero (local y ≈ 9,2; cielo a 2,65 m)
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.12), matCaja); cab.position.copy(P(xr, yr, zr));
    cab.lookAt(P(mu.centro[0], mu.centro[1] + 2, mu.nivel)); scene.add(cab);
    const soporte = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), matCaja); soporte.position.copy(P(xr, yr, zr + 0.1)); scene.add(soporte);
    const lente = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.12), matLente); lente.position.copy(cab.position); lente.quaternion.copy(cab.quaternion); lente.translateZ(0.061); lente.visible = false; scene.add(lente); lentes.push(lente);
    foco(xr, yr, zr - 0.05, mu.centro[0], mu.centro[1] + 3, mu.nivel - 0.2, 65, 40, 0.62, 0xffcf96, 1.0);   // suave: borde difuminado
  }


  const base = { g: matGuirnalda.color.clone(), r: matBulboRatan.color.clone(), le: matLetrero.emissiveIntensity, b: matBolardo.emissive.clone() };

  let actual = 'dia';
  function set(modo) {
    const m = MODOS[modo]; if (!m) return; actual = modo;
    cielo.set(m.cielo);
    sun.color.setHex(m.sol[0]); sun.intensity = m.sol[1]; sun.castShadow = modo !== 'noche';
    hemi.intensity = m.hemi;
    if (m.hemiColor) { hemi.color.setHex(m.hemiColor[0]); hemi.groundColor.setHex(m.hemiColor[1]); } else { hemi.color.setHex(0xeef3f7); hemi.groundColor.setHex(0x5d6b42); } scene.environmentIntensity = m.env; renderer.toneMappingExposure = m.exp;
    for (const l of puntos) l.intensity = l.userData.max * m.luces;   // siempre en escena: el cambio de modo es inmediato (sin recompilar)
    for (const [c, op] of charcos) c.material.opacity = op * m.luces;
    for (const l of lentes) l.visible = m.luces > 0;
    matGuirnalda.color.copy(base.g).multiplyScalar(m.brillo);           // >1 = resplandor (bloom) de noche
    matBulboRatan.color.copy(base.r).multiplyScalar(m.brillo);
    matLetrero.emissiveIntensity = base.le * (modo === 'dia' ? 1 : modo === 'atardecer' ? 1.5 : 2);
    if (modo === 'dia') { matBolardo.emissive.copy(base.b); matBolardo.emissiveIntensity = 1; }
    else { matBolardo.emissive.setHex(0xffd9a0); matBolardo.emissiveIntensity = modo === 'noche' ? 3 : 1.5; }
    alCambiar(modo);
  }
  return { set, get modo() { return actual; } };
}
