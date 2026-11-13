// Etapa 5 – Recorrido en primera persona.
// · Ojos a 1,60 m sobre el piso que hay debajo (sube y baja escalones solo).
// · Mirar: arrastrar (mouse o dedo).  Caminar: W A S D / flechas, o clic/toque en el piso.
// · Colisiones: muros, vidrios y estructura (rayos) + mobiliario, troncos y jardineras (huellas 2D).
import * as THREE from 'three';

const EYE = 1.60, SPEED = 1.5, RADIUS = 0.32, MAX_STEP = 0.8;

// Huella de cada tipo de mueble en planta (ancho, fondo) en metros – para no atravesarlos
const HUELLA = {
  mesa_madera: [2.6, 1.0], mesa_postres: [2.6, 1.0], mesa_novios: [2.0, 1.0], silla_x: [0.5, 0.54],
  mesa_coctel: [0.7, 0.7], silla_coctel: [0.42, 0.37], sala_hierro: [1.95, 1.35], sala_corazones: [2.9, 1.5], puerta_abatible: [0, 0], barra: [0, 0], puerta_corrediza: [0, 0],
};
const PISOS = new Set(['piso_salon', 'madera_deck', 'madera_pasarela', 'concreto_sendero', 'concreto']);
const MUROS = new Set(['vidrio', 'espejo_bar', 'vidrio_bar', 'acero_negro', 'madera_rojiza', 'metal_cafe', 'verde_bosque', 'muro_claro', 'fachada_gris', 'marmol_negro']);

export class Recorrido {
  constructor({ camera, dom, scene, arquitectura, ground, venue, onPick, pisosExtra = [] }) {
    Object.assign(this, { camera, dom, venue, onPick });
    this.enabled = false; this.yaw = 0; this.pitch = 0; this.keys = new Set();
    this.target = null; this.pos = new THREE.Vector3(); this.floorY = 0;
    this.floors = [ground, ...pisosExtra]; this.walls = [];
    arquitectura.traverse(o => { if (!o.isMesh) return;
      if (PISOS.has(o.material.name)) this.floors.push(o);
      if (MUROS.has(o.material.name)) this.walls.push(o); });
    // Obstáculos 2D (plano): muebles, troncos de palma, jardineras
    this.rects = venue.objetos.filter(o => HUELLA[o.tipo]?.[0]).map(o => {
      const [w, d] = HUELLA[o.tipo]; return { x: o.pos[0], y: o.pos[1], hw: w / 2, hd: d / 2, a: THREE.MathUtils.degToRad(o.rot || 0) }; });
    this.circles = venue.exterior.palmas.map(p => ({ x: p.pos[0], y: p.pos[1], r: 0.25 }));
    this.polys = venue.exterior.jardineras;
    this.lago = venue.exterior.lago || null; this.muelle = venue.exterior.muelle || null;
    this.ray = new THREE.Raycaster(); this.down = new THREE.Vector3(0, -1, 0);
    // marcador de destino en el piso
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.visible = false; scene.add(this.marker);
    this._bind();
  }

  // ---------- entrada ----------
  _bind() {
    let drag = null;
    this.dom.addEventListener('pointerdown', e => { if (!this.enabled) return; drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now() }; });
    addEventListener('pointermove', e => {
      if (!this.enabled || !drag) return;
      const k = e.pointerType === 'mouse' ? 0.0042 : 0.0055;
      this.yaw += (e.clientX - drag.x) * k; this.pitch -= (e.clientY - drag.y) * k;   // arrastrar = "tomar" la vista (como Google Street View)
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.2, 1.2); drag.x = e.clientX; drag.y = e.clientY;
    });
    addEventListener('pointerup', e => {
      if (!this.enabled || !drag) return;
      const moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
      if (moved < 6 && performance.now() - drag.t < 600) this._click(e);
      drag = null;
    });
    addEventListener('keydown', e => { if (this.enabled && !e.target.closest('input,textarea')) this.keys.add(e.key.toLowerCase()); });
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
  }

  _click(e) {
    const m = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (this.onPick && this.onPick(e)) return;            // clic sobre un objeto con ficha
    this.ray.setFromCamera(m, this.camera);
    const hit = this.ray.intersectObjects(this.floors, false)[0];
    if (!hit || hit.distance > 40) return;
    this.walkTo(hit.point.x, -hit.point.z);
  }

  // ---------- API ----------
  /** Coloca la cámara en un punto del plano mirando a otro (con fundido). */
  goTo(punto, fade) {
    const go = () => {
      this.pos.set(punto.pos[0], 0, -punto.pos[1]);
      this.floorY = this._floorAt(this.pos.x, this.pos.z) ?? 0;
      const dx = punto.mira[0] - punto.pos[0], dy = punto.mira[1] - punto.pos[1];
      this.yaw = Math.atan2(-dx, dy) ; this.pitch = 0.08; this.target = null; this.marker.visible = false;
    };
    fade ? fade(go) : go();
  }
  walkTo(x, y) { this.target = new THREE.Vector2(x, y); this.marker.position.set(x, (this._floorAt(x, -y) ?? 0) + 0.02, -y); this.marker.visible = true; }
  /** Posición actual en el plano (para el "usted está aquí") */
  get planPos() { return [this.pos.x, -this.pos.z]; }

  // ---------- física simple ----------
  _floorAt(x, z) {
    this.ray.set(new THREE.Vector3(x, this.floorY + 1.2, z), this.down);   // desde un poco más arriba que el piso actual (evita techos)
    const h = this.ray.intersectObjects(this.floors, false)[0];
    return h ? h.point.y : null;
  }
  _blocked(x, y) {
    for (const c of this.circles) if (Math.hypot(x - c.x, y - c.y) < c.r + RADIUS) return true;
    for (const r of this.rects) {
      const dx = x - r.x, dy = y - r.y, c = Math.cos(-r.a), s = Math.sin(-r.a);
      const lx = dx * c - dy * s, ly = dx * s + dy * c;
      if (Math.abs(lx) < r.hw + RADIUS * 0.6 && Math.abs(ly) < r.hd + RADIUS * 0.6) return true;
    }
    for (const p of this.polys) if (inside([x, y], p)) return true;
    if (this.lago && inside([x, y], this.lago)) {                      // no caminar sobre el agua, salvo en el muelle
      const m = this.muelle; if (!m) return true;
      const a = THREE.MathUtils.degToRad(m.giro), dx = x - m.centro[0], dy = y - m.centro[1];
      const u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(u) > m.largo / 2 - 0.15 || Math.abs(v) > m.ancho / 2) return true;   // el muelle se conecta con el prado
    }
    return false;
  }
  _wallHit(from, dir, dist) {
    for (const h of [0.45, 1.2]) {
      this.ray.set(new THREE.Vector3(from.x, this.floorY + h, from.z), dir); this.ray.far = dist + RADIUS;
      const hit = this.ray.intersectObjects(this.walls, false)[0];
      if (hit) { this.ray.far = Infinity; return true; }
    }
    this.ray.far = Infinity; return false;
  }
  _tryMove(dx, dz) {
    const len = Math.hypot(dx, dz); if (len < 1e-5) return false;
    const dir = new THREE.Vector3(dx / len, 0, dz / len);
    if (this._wallHit(this.pos, dir, len)) return false;
    const nx = this.pos.x + dx, nz = this.pos.z + dz;
    if (this._blocked(nx, -nz)) return false;
    const fy = this._floorAt(nx, nz);
    if (fy === null || fy - this.floorY > MAX_STEP) return false;
    this.pos.x = nx; this.pos.z = nz; this.floorY = fy; return true;
  }

  update(dt) {
    if (!this.enabled) return;
    let mx = 0, mz = 0;
    const f = (this.keys.has('w') || this.keys.has('arrowup')) - (this.keys.has('s') || this.keys.has('arrowdown'));
    const r = (this.keys.has('d') || this.keys.has('arrowright')) - (this.keys.has('a') || this.keys.has('arrowleft'));
    if (f || r) {
      this.target = null; this.marker.visible = false;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      mx = (-sin * f + cos * r); mz = (-cos * f - sin * r);
      const n = Math.hypot(mx, mz); mx *= SPEED * dt / n; mz *= SPEED * dt / n;
      if (!this._tryMove(mx, mz)) { this._tryMove(mx, 0) || this._tryMove(0, mz); }   // deslizar contra muros
    } else if (this.target) {
      const tx = this.target.x - this.pos.x, tz = -this.target.y - this.pos.z, d = Math.hypot(tx, tz);
      if (d < 0.25) { this.target = null; this.marker.visible = false; }
      else {
        const step = Math.min(d, SPEED * dt);
        const want = Math.atan2(-tx, -tz); let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.yaw += dy * Math.min(1, dt * 4);                                     // gira suave hacia donde camina
        if (!this._tryMove(tx / d * step, tz / d * step)) { this.target = null; this.marker.visible = false; }
      }
    }
    // cámara: altura con suavizado (escalones)
    const eyeY = this.floorY + EYE;
    this.camera.position.x = this.pos.x; this.camera.position.z = this.pos.z;
    this.camera.position.y += (eyeY - this.camera.position.y) * Math.min(1, dt * 10);
    this.camera.rotation.set(-this.pitch, this.yaw, 0, 'YXZ');
  }
}

function inside([x, y], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
