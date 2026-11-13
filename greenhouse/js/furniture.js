// Modelos paramétricos de mobiliario (Three.js).
// Cada tipo se construye a partir de medidas; un mismo tipo se reutiliza en cualquier venue.
// Convención: modelo en su sitio, frente de la silla mirando hacia +Y del plano (-Z en Three).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const MAT = {
  negro:      new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.45, metalness: 0.6 }),
  maderaMiel: new THREE.MeshStandardMaterial({ color: 0xa8743a, roughness: 0.6 }),
  maderaGris: new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.8 }),
  vidrio:     new THREE.MeshStandardMaterial({ color: 0xbfd6d2, roughness: 0.05, transparent: true, opacity: 0.35 }),
  hierro:     new THREE.MeshStandardMaterial({ color: 0x1b221e, roughness: 0.5, metalness: 0.55 }),   // hierro forjado verde muy oscuro (foto)
  vidrioVerde:new THREE.MeshStandardMaterial({ color: 0x86ad9c, roughness: 0.35, transparent: true, opacity: 0.75 }),
  asiento:    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.35, metalness: 0.5 }),
  cojin:      new THREE.MeshStandardMaterial({ color: 0xece8de, roughness: 0.9 }),
};

// Utilidades: caja centrada en (x, y, z) del PLANO (z = altura). Devuelve geometría en coords Three.
function box(w, d, h, x, y, z, rx = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || rz) g.rotateX(rx).rotateZ(rz);
  g.translate(x, z, -y);
  return g;
}
function rod(len, r, x, y, z, rotX = 0, rotZ = 0) {
  const g = new THREE.CylinderGeometry(r, r, len, 6);
  g.rotateX(rotX).rotateZ(rotZ);
  g.translate(x, z, -y);
  return g;
}

// ---------- utilidades de detalle (coordenadas del PLANO: [x, y, z altura]) ----------
const V = ([x, y, z]) => new THREE.Vector3(x, z, -y);
const merge = list => mergeGeometries(list.map(g => (g.index ? g.toNonIndexed() : g)));
/** Tubo a lo largo de una curva suave que pasa por los puntos dados. */
function tube(pts, r, seg = 24, closed = false, radial = 6) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(V), closed, 'centripetal'), seg, r, radial, closed);
}
/** Barra recta entre dos puntos (cilindro o platina rectangular). */
function bar(p0, p1, r, flat = 0) {
  const a = V(p0), b = V(p1), d = b.clone().sub(a), L = d.length();
  const g = flat ? new THREE.BoxGeometry(flat, L, r * 2) : new THREE.CylinderGeometry(r, r, L, 5);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
/** UV en METROS por proyección de caja: la veta de la madera corre a lo largo de X (largo de la mesa).
 *  Así la textura no se estira: el visor define cuántos metros cubre cada repetición. */
function uvMetros(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getZ(i); v = p.getX(i); }        // cubierta: tablas a lo largo
    else if (az >= ax) { u = p.getY(i); v = p.getX(i); }                // cantos largos
    else { u = p.getZ(i); v = p.getY(i); }                              // cabeceras y patas
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
/** Marco rectangular de varilla (4 barras rectas) */
function rect(hx, hy, z, r) {
  const P = [[-hx, -hy, z], [hx, -hy, z], [hx, hy, z], [-hx, hy, z]];
  return [0, 1, 2, 3].map(i => bar(P[i], P[(i + 1) % 4], r));
}
function roundedPlate(w, d, r, t, z) {
  const sh = new THREE.Shape(), x = w / 2, y = d / 2;
  sh.moveTo(-x + r, -y); sh.lineTo(x - r, -y); sh.quadraticCurveTo(x, -y, x, -y + r); sh.lineTo(x, y - r); sh.quadraticCurveTo(x, y, x - r, y);
  sh.lineTo(-x + r, y); sh.quadraticCurveTo(-x, y, -x, y - r); sh.lineTo(-x, -y + r); sh.quadraticCurveTo(-x, -y, -x + r, -y);
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.translate(0, z, 0);     // queda horizontal; su "y" de la forma = -z de Three = y del plano
  return g;
}

const BUILDERS = {
  // 2,60 × 1,00 × 0,75 m (ficha). Largo a lo largo de X del plano.
  mesa_madera() {
    const top = [box(2.6, 1.0, 0.05, 0, 0, 0.725)];
    const legs = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1])
      legs.push(box(0.08, 0.08, 0.70, sx * 1.12, sy * 0.36, 0.35, sy * 0.12, 0));
    legs.push(box(2.1, 0.05, 0.05, 0, 0, 0.25));
    return [[uvMetros(mergeGeometries([...top, ...legs])), MAT.maderaMiel]];
  },
  // Mesa de postres = "mesa decorativa" de la ficha original: 2,60 × 1,00 × 0,95 m (por confirmar que es la misma)
  mesa_postres() {
    const g = [box(2.6, 1.0, 0.05, 0, 0, 0.925)];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.push(box(0.08, 0.08, 0.90, sx * 1.2, sy * 0.4, 0.45));
    return [[uvMetros(mergeGeometries(g)), MAT.maderaMiel]];
  },
  // Mesa de novios: medidas ESTIMADAS desde el plano de modulación (≈ 1,80 × 0,90 m, alto 0,75 m)
  mesa_novios() {
    const g = [box(1.8, 0.9, 0.05, 0, 0, 0.725)];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.push(box(0.07, 0.07, 0.70, sx * 0.8, sy * 0.36, 0.35));
    return [[uvMetros(mergeGeometries(g)), MAT.maderaMiel]];
  },
  // 88,5 alto × 50,5 largo × 54 ancho cm (ficha). Asiento a 0,46 m (estimado).
  silla_x() {
    const W = 0.505, D = 0.54, H = 0.885, S = 0.46, g = [];
    const lx0 = W / 2 - 0.014, ly0 = D / 2 - 0.014;        // patas en el borde exacto de la ficha
    g.push(box(W - 0.04, D - 0.06, 0.03, 0, 0.01, S));
    for (const sx of [-1, 1]) {
      g.push(rod(S, 0.013, sx * lx0, ly0, S / 2));          // patas delanteras
      g.push(rod(H, 0.014, sx * lx0, -ly0, H / 2));         // patas traseras = postes del respaldo
    }
    g.push(box(W - 0.03, 0.025, 0.05, 0, -ly0, H - 0.03)); // travesaño superior
    const lx = Math.hypot(W - 0.06, H - S - 0.08), a = Math.atan2(H - S - 0.08, W - 0.06);
    g.push(box(lx, 0.02, 0.025, 0, -ly0, (S + H - 0.06) / 2, 0, a));   // X del respaldo
    g.push(box(lx, 0.02, 0.025, 0, -ly0, (S + H - 0.06) / 2, 0, -a));
    return [[mergeGeometries(g), MAT.negro]];
  },
  // 0,70 × 0,70 × 1,00 m (ficha).
  mesa_coctel() {
    const base = [];
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
      base.push(rod(0.98, 0.012, sx * 0.25, sy * 0.25, 0.49));
    base.push(box(0.55, 0.55, 0.02, 0, 0, 0.30));
    return [[box(0.70, 0.70, 0.035, 0, 0, 0.982), MAT.maderaGris], [mergeGeometries(base), MAT.negro]];
  },
  // Medidas ESTIMADAS (pendientes): asiento 0,42 m de lado a 0,75 m; respaldo hasta 1,05 m.
  silla_coctel() {
    const g = [box(0.42, 0.42, 0.02, 0, 0, 0.75)];
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.push(rod(0.75, 0.008, sx * 0.2, sy * 0.2, 0.375));
    for (let i = -2; i <= 2; i++) g.push(rod(0.30, 0.005, i * 0.09, -0.2, 0.90));
    g.push(box(0.42, 0.012, 0.012, 0, -0.2, 1.05));
    g.push(box(0.42, 0.012, 0.012, 0, 0.2, 0.30));
    g.push(box(0.42, 0.012, 0.012, 0, -0.2, 0.30));
    return [[mergeGeometries(g), MAT.negro]];
  },
  // Composición y medidas ESTIMADAS a partir de la foto: 4 poltronas + mesa de centro con vidrio.
  sala_hierro() {
    const iron = [], glass = [];
    const chair = (x, y, rot) => {
      const parts = [box(0.58, 0.55, 0.03, 0, 0, 0.42), box(0.58, 0.03, 0.45, 0, -0.27, 0.66)];
      for (const sx of [-1, 1]) { parts.push(box(0.03, 0.55, 0.03, sx * 0.29, 0, 0.62));
        for (const sy of [-1, 1]) parts.push(rod(0.42, 0.012, sx * 0.27, sy * 0.25, 0.21)); }
      const m = mergeGeometries(parts); m.rotateY(rot); m.translate(x, 0, -y); iron.push(m);
    };
    chair(-0.55, -0.75, 0); chair(0.55, -0.75, 0); chair(-0.55, 0.75, Math.PI); chair(0.55, 0.75, Math.PI);
    glass.push(box(0.60, 0.60, 0.012, 0, 0, 0.45));
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) iron.push(rod(0.44, 0.01, sx * 0.27, sy * 0.27, 0.22));
    return [[mergeGeometries(iron), MAT.negro], [mergeGeometries(glass), MAT.vidrio]];
  },
};

// ======== Versiones fieles a las fotos del moodboard ========
Object.assign(BUILDERS, {
  // Silla X (foto "SILLA"): madera curvada negra, respaldo con travesaño curvo y X de platinas,
  // asiento redondeado con borde, aro bajo entre patas. Medidas de ficha: 88,5 alto × 50,5 × 54 cm.
  silla_x() {
    const g = [], S = 0.46, H = 0.885;
    for (const sx of [-1, 1]) {
      g.push(tube([[sx * 0.225, 0.235, 0], [sx * 0.215, 0.22, 0.22], [sx * 0.205, 0.20, S - 0.01]], 0.015, 8));          // pata delantera
      g.push(tube([[sx * 0.215, -0.255, 0], [sx * 0.20, -0.215, 0.25], [sx * 0.195, -0.205, S], [sx * 0.19, -0.235, 0.70], [sx * 0.185, -0.26, H - 0.03]], 0.016, 16)); // pata trasera + poste
    }
    // travesaño superior curvo (doble tubo = platina ancha)
    for (const dz of [0, -0.035]) g.push(tube([[-0.20, -0.25, H - 0.02 + dz], [0, -0.285, H - 0.012 + dz], [0.20, -0.25, H - 0.02 + dz]], 0.02, 12));
    // X del respaldo (platinas)
    g.push(bar([-0.17, -0.245, H - 0.07], [0.175, -0.21, S + 0.06], 0.006, 0.03));
    g.push(bar([0.17, -0.245, H - 0.07], [-0.175, -0.21, S + 0.06], 0.006, 0.03));
    // asiento redondeado + borde
    g.push(roundedPlate(0.44, 0.43, 0.07, 0.03, S - 0.015));
    g.push(tube([[-0.21, 0.205, S + 0.02], [0.21, 0.205, S + 0.02], [0.215, -0.19, S + 0.02], [-0.215, -0.19, S + 0.02]], 0.012, 40, true));
    // aro bajo el asiento (curvo, como en la foto)
    g.push(tube([[-0.21, 0.205, 0.17], [0, 0.23, 0.18], [0.21, 0.205, 0.17], [0.20, -0.215, 0.20], [-0.20, -0.215, 0.20]], 0.009, 40, true));
    return [[merge(g), MAT.negro]];
  },
  // Silla coctelera (fotos "MESAS COCTELERAS"): silla alta de varilla de hierro negro, respaldo envolvente
  // de varillas verticales, 4 patas con reposapiés. Medidas ESTIMADAS (pendientes).
  // Silla coctelera (Zona E): 42 cm ancho × 37 cm fondo × 1,10 m alto; asiento a 70 cm. Varilla de hierro negro.
  silla_coctel() {
    const g = [], S = 0.70, RX = 0.20, RY = 0.175, TOP = 1.10;
    g.push(...rect(RX, RY, S, 0.006));
    const top = [[-RX, RY - 0.06, S + 0.14], [-RX - 0.005, 0, S + 0.28], [-0.13, -RY - 0.015, TOP - 0.02], [0, -RY - 0.02, TOP], [0.13, -RY - 0.015, TOP - 0.02], [RX + 0.005, 0, S + 0.28], [RX, RY - 0.06, S + 0.14]];
    const curve = new THREE.CatmullRomCurve3(top.map(V), false, 'centripetal');
    g.push(new THREE.TubeGeometry(curve, 40, 0.006, 4, false));
    for (let i = 0; i <= 20; i++) { const p = curve.getPoint(i / 20); g.push(bar([p.x * 0.97, -p.z * 0.97, S], [p.x, -p.z, p.y], 0.0035)); }
    for (let i = -4; i <= 4; i++) g.push(bar([i * 0.043, RY, S], [i * 0.043, -RY, S], 0.0035));
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.push(bar([sx * RX, sy * RY, S], [sx * (RX + 0.01), sy * (RY + 0.01), 0], 0.007));
    g.push(...rect(RX + 0.007, RY + 0.007, 0.30, 0.006));
    return [[merge(g), MAT.negro], [roundedPlate(RX * 2, RY * 2, 0.04, 0.008, S - 0.01), MAT.asiento]];
  },
  mesa_coctel() {
    const base = [], T = 0.965, b = 0.30, t = 0.30;
    const F = [[-b, -b], [b, -b], [b, b], [-b, b]], U = [[-t, -t], [t, -t], [t, t], [-t, t]];
    for (let i = 0; i < 4; i++) {
      base.push(bar([...F[i], 0], [...U[(i + 1) % 4], T], 0.006));
      base.push(bar([...F[i], 0], [...U[(i + 3) % 4], T], 0.006));
      base.push(bar([...F[i], 0], [0, 0, 0.55], 0.006));
    }
    base.push(...rect(t, t, T, 0.008));
    return [[uvMetros(box(0.70, 0.70, 0.035, 0, 0, 0.982)), MAT.maderaGris], [merge(base), MAT.negro]];
  },
  // Sala de hierro forjado (foto): 4 poltronas con patas en X (tipo plegable), respaldo en celosía con
  // remate de volutas, y 2 mesitas con vidrio verde texturizado. Medidas ESTIMADAS (pendientes).
  sala_hierro() {
    const iron = [], glass = [];
    const chair = (cx, cy, rot) => {
      const p = [], S = 0.42, W = 0.255;   // poltrona 51 × 51 cm, asiento 42 cm, alto total 1,00 m (Zona E)
      for (const sx of [-1, 1]) {
        p.push(tube([[sx * W, 0.30, 0.02], [sx * W, 0.05, 0.28], [sx * W, -0.25, S]], 0.012, 10));          // X lateral
        p.push(tube([[sx * W, -0.30, 0.02], [sx * W, -0.05, 0.28], [sx * W, 0.25, S]], 0.012, 10));
        p.push(tube([[sx * W, 0.24, S], [sx * W, 0.20, S + 0.20], [sx * W, -0.05, S + 0.24], [sx * W, -0.24, S + 0.22]], 0.011, 12)); // brazo
        p.push(tube([[sx * W, -0.25, S], [sx * W, -0.30, S + 0.30], [sx * W, -0.33, S + 0.50]], 0.012, 10)); // poste respaldo
      }
      for (let i = 0; i <= 5; i++) p.push(bar([-W, -0.25 + i * 0.1, S], [W, -0.25 + i * 0.1, S], 0.007));     // asiento en celosía
      for (let i = 0; i <= 4; i++) p.push(bar([-W + i * W / 2, -0.27, S + 0.02], [-W + i * W / 2, -0.33, S + 0.48], 0.006)); // celosía respaldo
      for (let k = 0; k < 4; k++) p.push(bar([-W, -0.27 - k * 0.015, S + 0.12 + k * 0.11], [W, -0.27 - k * 0.015, S + 0.12 + k * 0.11], 0.006));
      p.push(tube([[-W, -0.33, S + 0.50], [-0.12, -0.335, S + 0.58], [0, -0.33, S + 0.52], [0.12, -0.335, S + 0.58], [W, -0.33, S + 0.50]], 0.009, 20)); // volutas
      const m = merge(p); m.rotateY(rot); m.translate(cx, 0, -cy); iron.push(m);
    };
    const table = (cx, cy) => {
      const p = [];
      for (const sx of [-1, 1]) { p.push(tube([[sx * 0.24, -0.24, 0.01], [sx * 0.22, 0, 0.24], [sx * 0.2525, 0.2525, 0.48]], 0.01, 10));
                                  p.push(tube([[sx * 0.24, 0.24, 0.01], [sx * 0.22, 0, 0.24], [sx * 0.2525, -0.2525, 0.48]], 0.01, 10)); }
      p.push(...rect(0.2525, 0.2525, 0.48, 0.01));   // mesita 50,5 × 50,5 × 48 cm (Zona E)
      const m = merge(p); m.translate(cx, 0, -cy); iron.push(m);
      const gl = new THREE.BoxGeometry(0.505, 0.012, 0.505); gl.translate(cx, 0.486, -cy); glass.push(gl);
    };
    table(0, -0.33); table(0, 0.33);
    chair(-0.62, -0.38, -Math.PI / 2); chair(-0.62, 0.38, -Math.PI / 2); chair(0.62, -0.38, Math.PI / 2); chair(0.62, 0.38, Math.PI / 2);
    return [[merge(iron), MAT.hierro], [merge(glass), MAT.vidrioVerde]];
  },
});

// ======== Correcciones con las fotos de eventos (11-nov) ========
/** Pata torneada: perfil de revolución (radio, altura) en metros. */
function pataTorneada(h, x, y) {
  const R = [[0.045,0],[0.035,0.03],[0.05,0.07],[0.03,0.11],[0.042,0.20],[0.055,0.33],[0.04,0.45],[0.03,0.50],[0.045,0.55],[0.038,h-0.10],[0.045,h-0.06],[0.045,h]];
  const g = new THREE.LatheGeometry(R.map(([r, z]) => new THREE.Vector2(r, z)), 12);
  g.translate(x, 0, -y); return g;
}
Object.assign(BUILDERS, {
  // Mesa de madera (fotos de eventos): cubierta de tablones rústicos, faldón y 4 PATAS TORNEADAS. 2,60 × 1,00 × 0,75 m (ficha).
  mesa_madera() {
    const g = [box(2.6, 1.0, 0.05, 0, 0, 0.725), box(2.36, 0.04, 0.10, 0, 0.42, 0.65), box(2.36, 0.04, 0.10, 0, -0.42, 0.65),
               box(0.04, 0.80, 0.10, 1.18, 0, 0.65), box(0.04, 0.80, 0.10, -1.18, 0, 0.65)];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.push(pataTorneada(0.70, sx * 1.18, sy * 0.42));
    return [[uvMetros(merge(g)), MAT.maderaMiel]];
  },
  // Mesa de 8 puestos (Zona E, 12-nov): 2,00 × 1,00 × 0,75 m, mismo diseño rústico con patas torneadas.
  // En el montaje típico se usa como mesa de novios (2 sillas).
  mesa_novios() {
    const g = [box(2.0, 1.0, 0.05, 0, 0, 0.725), box(1.76, 0.04, 0.10, 0, 0.42, 0.65), box(1.76, 0.04, 0.10, 0, -0.42, 0.65),
               box(0.04, 0.80, 0.10, 0.88, 0, 0.65), box(0.04, 0.80, 0.10, -0.88, 0, 0.65)];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.push(pataTorneada(0.70, sx * 0.88, sy * 0.42));
    return [[uvMetros(merge(g)), MAT.maderaMiel]];
  },
  // Mesa alta de postres (fotos): mesa de CABALLETE, patas inclinadas en A y travesaño bajo.
  // Medidas de la "mesa decorativa" de la ficha: 2,60 × 1,00 × 0,95 m (por confirmar que es la misma).
  mesa_postres() {
    const H = 0.95, g = [box(2.6, 1.0, 0.06, 0, 0, H - 0.03), box(2.2, 0.08, 0.12, 0, 0, 0.18)];
    for (const sx of [-1, 1]) {
      g.push(box(0.10, 0.90, 0.08, sx * 1.05, 0, H - 0.10));                       // cabezal
      for (const sy of [-1, 1]) g.push(bar([sx * 1.05, sy * 0.40, H - 0.12], [sx * 1.05, sy * 0.22, 0], 0.045, 0.10));   // patas en A
      g.push(box(0.08, 0.70, 0.08, sx * 1.05, 0, 0.18));
    }
    return [[uvMetros(merge(g)), MAT.maderaMiel]];
  },
  // Sala del deck (fotos): 4 poltronas de hierro con respaldo en celosía y volutas, COJINES BLANCOS, 2 mesitas de vidrio.
  sala_hierro: (base => () => {
    const parts = base();
    const cush = [];
    for (const [cx, cy, rot] of [[-0.62, -0.38, -Math.PI / 2], [-0.62, 0.38, -Math.PI / 2], [0.62, -0.38, Math.PI / 2], [0.62, 0.38, Math.PI / 2]]) {
      const c = new THREE.BoxGeometry(0.52, 0.07, 0.50); c.translate(0, 0.465, 0.0); c.rotateY(rot); c.translate(cx, 0, -cy); cush.push(c);
    }
    return [...parts, [merge(cush), MAT.cojin]];
  })(BUILDERS.sala_hierro),
  // Sala del muelle (fotos): sofá de 2 puestos con respaldo de CORAZONES, 2 poltronas, 2 mesitas de vidrio, cojines blancos.
  // Medidas ESTIMADAS. Frente hacia +y del objeto.
  sala_corazones() {
    const iron = [], glass = [], cush = [];
    const heart = (cx, cy, w, z0) => {     // respaldo en corazón dibujado con varilla
      const pts = [[cx - w, cy, z0], [cx - w, cy, z0 + 0.34], [cx - w * 0.8, cy, z0 + 0.46], [cx - w * 0.4, cy, z0 + 0.47], [cx, cy, z0 + 0.38], [cx + w * 0.4, cy, z0 + 0.47], [cx + w * 0.8, cy, z0 + 0.46], [cx + w, cy, z0 + 0.34], [cx + w, cy, z0]];
      iron.push(tube(pts, 0.009, 24));
      iron.push(tube([[cx - w * 0.6, cy, z0 + 0.36], [cx, cy, z0 + 0.06], [cx + w * 0.6, cy, z0 + 0.36]], 0.007, 16));
    };
    const seat = (cx, cy, W, S = 0.42) => {
      iron.push(...rect(W / 2, 0.25, S, 0.01).map(g => { g.translate(cx, 0, -cy); return g; }));
      for (const sx of [-1, 1]) for (const sy of [-1, 1])
        iron.push(tube([[cx + sx * W / 2, cy + sy * 0.25, S], [cx + sx * (W / 2 + 0.03), cy + sy * 0.20, 0.2], [cx + sx * (W / 2 + 0.06), cy + sy * 0.28, 0.01]], 0.011, 10));
      for (const sx of [-1, 1]) iron.push(tube([[cx + sx * W / 2, cy + 0.25, S], [cx + sx * (W / 2 + 0.03), cy + 0.12, S + 0.22], [cx + sx * W / 2, cy - 0.22, S + 0.25]], 0.01, 12)); // brazos con voluta
      const c = new THREE.BoxGeometry(W, 0.07, 0.48); c.translate(cx, S + 0.04, -cy); cush.push(c);
      return S;
    };
    // sofá (centro, atrás)
    const S1 = seat(0, -0.45, 1.15); heart(-0.29, -0.70, 0.27, S1 + 0.02); heart(0.29, -0.70, 0.27, S1 + 0.02);
    iron.push(bar([-0.575, -0.70, S1], [-0.575, -0.70, S1 + 0.32], 0.01)); iron.push(bar([0.575, -0.70, S1], [0.575, -0.70, S1 + 0.32], 0.01));
    // poltronas a los lados
    for (const sx of [-1, 1]) { const S = seat(sx * 1.15, -0.05, 0.51); heart(sx * 1.15, -0.30, 0.24, S + 0.02); }   // poltrona 51 cm
    // 2 mesitas de vidrio al frente
    for (const sx of [-0.27, 0.27]) {
      iron.push(...rect(0.2525, 0.2525, 0.48, 0.01).map(g => { g.translate(sx, 0, -0.25); return g; }));   // mesita 50,5 × 48 cm
      for (const a of [-1, 1]) for (const b of [-1, 1]) iron.push(tube([[sx + a * 0.2525, 0.25 + b * 0.2525, 0.48], [sx + a * 0.21, 0.25 + b * 0.19, 0.24], [sx + a * 0.2525, 0.25 + b * 0.2525, 0.01]], 0.009, 8));
      const gl = new THREE.BoxGeometry(0.505, 0.012, 0.505); gl.translate(sx, 0.486, -0.25); glass.push(gl);
    }
    return [[merge(iron), MAT.hierro], [merge(glass), MAT.vidrio], [merge(cush), MAT.cojin]];
  },
});

const cache = {};
/** Crea un objeto de inventario. obj = {id, tipo, pos:[x,y], z, rot(grados)} */
export function createFurniture(obj) {
  const build = BUILDERS[obj.tipo];
  if (!build) return null;                      // barra y puertas ya están en el modelo de arquitectura
  cache[obj.tipo] ??= build();
  const group = new THREE.Group();
  for (const [geo, mat] of cache[obj.tipo]) {
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; group.add(m);
  }
  group.position.set(obj.pos[0], obj.z || 0, -obj.pos[1]);
  group.rotation.y = THREE.MathUtils.degToRad(obj.rot || 0);
  group.userData = { id: obj.id, tipo: obj.tipo };
  group.name = obj.id;
  return group;
}
