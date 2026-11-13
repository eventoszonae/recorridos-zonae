// Etapa 4 – Materiales e iluminación de día.
// Cada material del modelo (por nombre) recibe su textura real y su escala en metros.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { MAT } from './furniture.js';

// Tamaño real que cubre una repetición de cada textura (metros). [E] = estimado.
export const ESCALA = {
  piso_salon: 0.58,   // [E] módulo del estampado; medido en el video contra el ancho de silla y mesa
  madera_deck: 1.8,   // Zona E 13-nov: el piso del deck y el muelle son la MISMA madera del cielo del alero
  madera_cielo: 1.8,  // [E] tablas largas y angostas (fotos del alero)
  madera_pasarela: 2.4,
};
// Texturas tomadas de los ESCANEOS de Zona E (13-nov): [archivo, ancho m, largo m]
const ESCANEO = {
  concreto_sendero: ['concreto_sendero', 1.5, 2.35],   // concreto real con junta cada ~2,35 m
  madera_banda: ['madera_cielo', 1.8, 1.8],           // Zona E 13-nov: bandas de la llegada = misma madera del cielo del alero
  damero: ['damero', 1.57, 1.57],                      // ESCANEO del nicho: baldosas de 19,6 cm alineadas con los muros (no en diagonal)
  madera_nicho: ['madera_nicho', 1.22, 2.44],          // FOTO del nicho: láminas de triplex con veta y tira dorada
  concreto: ['concreto_sendero', 1.5, 2.35],           // zócalos y losas: el mismo concreto real del sendero
};

const loader = new THREE.TextureLoader();

/** Piso de damero blanco y negro del nicho, en diagonal (foto): baldosa ≈ 22 cm [E]. */
function damero(renderer) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#e4e0d6'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#141414'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,110,95,${Math.random() * 0.12})`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }  // desgaste
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 0.44, 1 / 0.44); t.center.set(0.5, 0.5); t.rotation = Math.PI / 4;   // baldosas de ≈ 22 cm a 45° (foto del nicho)
  return t;
}

/** Paneles del nicho (foto): contrachapado café rojizo oscuro con listones dorados entre paneles de ≈ 1,25 m. */
function panelesNicho(renderer) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 512, 512); grd.addColorStop(0, '#4d2214'); grd.addColorStop(0.5, '#5e2a17'); grd.addColorStop(1, '#45200f');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {                          // veta suave del contrachapado
    g.strokeStyle = `rgba(${Math.random() < .5 ? '25,8,2' : '140,70,40'},${0.04 + Math.random() * 0.06})`; g.lineWidth = 1 + Math.random() * 3;
    const y = Math.random() * 512; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(170, y + 30 * Math.random() - 15, 340, y + 30 * Math.random() - 15, 512, y); g.stroke();
  }
  g.fillStyle = '#b8954a'; g.fillRect(0, 0, 5, 512);       // listón dorado vertical
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 1.25, 1 / 1.25); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}

/** Lámina corrugada verde del contenedor: nervios horizontales cada ≈ 10 cm (foto del nicho). */
function laminaCorrugada(renderer) {
  const c = document.createElement('canvas'); c.width = 8; c.height = 64; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0, '#2c5a40'); grd.addColorStop(0.45, '#1f4a33'); grd.addColorStop(0.55, '#15382a'); grd.addColorStop(1, '#2c5a40');
  g.fillStyle = grd; g.fillRect(0, 0, 8, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1 / 0.10); return t;
}

/** Concreto del sendero (video ENTRADA): gris claro con juntas transversales cada ~1,6 m [E]. */
function concretoSendero(renderer) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#b9b5ac'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '90,88,82' : '230,228,220'},0.08)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  g.fillStyle = 'rgba(70,68,62,0.55)'; g.fillRect(0, 0, 256, 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 1.6, 1 / 1.6); return t;
}

/** Paneles de madera rojiza del volumen de servicios: textura dibujada (la del video era muy borrosa).
 *  Paneles de ~1,2 m [E] con junta clara, como en el video del bar. UV en metros. */
function panelesMadera(renderer) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#5a2414'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {                      // veta vertical suave
    const x = Math.random() * 512, w = 1 + Math.random() * 3;
    g.fillStyle = `rgba(${Math.random() < .5 ? '30,8,2' : '120,55,30'},${0.05 + Math.random() * 0.08})`; g.fillRect(x, 0, w, 512);
  }
  g.fillStyle = '#c9a77a'; g.fillRect(0, 0, 6, 512);     // junta / listón claro entre paneles
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 1.2, 1 / 1.2); t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
async function tex(name, renderer, repeat = [1, 1], rotation = 0) {
  const t = await loader.loadAsync(new URL(`../tex/${name}.jpg`, import.meta.url).href);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.repeat.set(...repeat); t.center.set(0.5, 0.5); t.rotation = rotation;
  return t;
}

/** Aplica texturas y ajustes físicos a los materiales del GLB de arquitectura y del mobiliario. */
export async function aplicarMateriales(root, renderer) {
  const maps = {};
  for (const [name, [f, w, l]] of Object.entries(ESCANEO)) maps[name] = await tex(f, renderer, [1 / w, 1 / l]);
  for (const [name, s] of Object.entries(ESCALA)) maps[name] = await tex({ madera_deck: 'madera_cielo', madera_pasarela: 'madera_deck' }[name] || name, renderer, [1 / s, 1 / s]);
  const tune = {
    piso_salon:   { roughness: 0.42, color: 0xf2e4d4 },   // cemento pulido, tono cálido de los videos
    madera_deck:  { roughness: 0.72, color: 0x9a7058 },   // misma madera café del cielo del alero (deck y muelle)
    madera_cielo: { roughness: 0.7, color: 0x9a7058 },    // fotos: madera café oscura
    madera_pasarela: { roughness: 0.8, color: 0xffffff },
    concreto_sendero: { roughness: 0.92, color: 0xffffff },
    madera_banda: { roughness: 0.72, color: 0x9a7058 },
    madera_rojiza:{ roughness: 0.5, color: 0xffffff },
    acero_negro:  { roughness: 0.5, metalness: 0.5, color: 0x1b1b1b },
    techo_negro:  { roughness: 0.85, metalness: 0.1, color: 0x161616 },
    verde_bosque: { roughness: 0.45, color: 0xffffff },
    damero:       { roughness: 0.3, color: 0xffffff },
    concreto:     { roughness: 0.9, color: 0xe8e4dc },
    madera_nicho: { roughness: 0.5, color: 0x9c7a55 },   // Zona E: el triplex real es más oscuro
    metal_cafe:   { roughness: 0.42, metalness: 0.35, color: 0x2e1a12 },   // lámina metálica café oscuro (volumen de servicios)
    marmol_negro: { roughness: 0.15, color: 0x0d0d0d },
    vidrio:       { roughness: 0.03, metalness: 0.0, color: 0xdfeeee, opacity: 0.12, envMapIntensity: 1.6 },
  };
  root.traverse(o => {
    if (!o.isMesh) return;
    const m = o.material, n = m.name;
    if (maps[n]) m.map = maps[n];
    if (n === 'madera_rojiza') m.map = panelesMadera(renderer);
    if (n === 'verde_bosque') m.map = laminaCorrugada(renderer);
    if (tune[n]) for (const [k, v] of Object.entries(tune[n])) k === 'color' ? m.color.setHex(v) : (m[k] = v);
    m.needsUpdate = true;
  });
  // Mobiliario: madera real de las mesas y de las cocteleras
  MAT.maderaMiel.map = await tex('madera_mesa', renderer, [1 / 0.65, 1 / 0.65]);   // [E] la foto muestra 3 tablas ≈ 0,65 m (tablas de ~22 cm) MAT.maderaMiel.color.setHex(0xf0b878); MAT.maderaMiel.needsUpdate = true;
  MAT.maderaGris.map = await tex('madera_coctel', renderer, [1 / 0.7, 1 / 0.7]); MAT.maderaGris.color.setHex(0x6e5a4c); MAT.maderaGris.needsUpdate = true;   // Zona E: la madera de las cocteleras es más oscura
  return { prado: await tex('prado', renderer, [1, 1]) };   // la malla del terreno ya trae UV repetidas (cada 4 m)
}

/** Cielo físico + sol + reflejos ambientales generados desde el mismo cielo (sin descargar HDRI). */
/** Cielo físico + mapa de entorno. Devuelve el cielo y `set(...)` para cambiar la hora (regenera el reflejo del cielo). */
export function cieloHora(scene, renderer, sun) {
  const sky = new Sky(); sky.scale.setScalar(900); scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer); let rt = null;
  const azim = THREE.MathUtils.degToRad(-130);       // orientación ilustrativa (norte sin confirmar)
  function set({ elev, turbidity, rayleigh, mie }) {
    const u = sky.material.uniforms;
    u.turbidity.value = turbidity; u.rayleigh.value = rayleigh; u.mieCoefficient.value = mie; u.mieDirectionalG.value = 0.8;
    const dir = new THREE.Vector3().setFromSphericalCoords(1, Math.PI / 2 - THREE.MathUtils.degToRad(elev), azim);
    u.sunPosition.value.copy(dir); sun.position.copy(dir).multiplyScalar(40);
    const envScene = new THREE.Scene(); envScene.add(sky.clone());
    rt?.dispose(); rt = pmrem.fromScene(envScene); scene.environment = rt.texture;
  }
  set({ elev: 52, turbidity: 4, rayleigh: 1.2, mie: 0.004 });
  return { sky, set };
}

export function iluminacionDia(scene, renderer, sun) {
  const sky = new Sky(); sky.scale.setScalar(900);
  const u = sky.material.uniforms;
  u.turbidity.value = 4; u.rayleigh.value = 1.2; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.8;
  // Sol de media mañana (ilustrativo: aún no hay orientación norte confirmada)
  const elev = THREE.MathUtils.degToRad(52), azim = THREE.MathUtils.degToRad(-130);
  const dir = new THREE.Vector3().setFromSphericalCoords(1, Math.PI / 2 - elev, azim);
  u.sunPosition.value.copy(dir);
  sun.position.copy(dir).multiplyScalar(40);
  const envScene = new THREE.Scene(); envScene.add(sky.clone());
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene).texture;
  scene.add(sky);
  return sky;
}
