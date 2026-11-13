// Etapa 6 – Puntos interactivos (hotspots) anclados a objetos reales del modelo.
// · Un punto por TIPO de elemento (no uno por silla) y una etiqueta por espacio: la vista no se satura.
// · Solo se muestran los que están cerca, delante de la cámara y no tapados por muros (los vidrios no tapan).
// · Los datos vienen de greenhouse.venue.json → "hotspots"; el texto, de inventario.json.
import * as THREE from 'three';

// Pictogramas (SVG) para los baños
const MUJER = '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="4" r="2.4" fill="currentColor"/><path d="M12 7.6c-2 0-3.1 1.2-3.6 3L6.6 16h3.2v6h1.8v-6h.8v6h1.8v-6h3.2l-1.8-5.4c-.5-1.8-1.6-3-3.6-3z" fill="currentColor"/></svg>';
const HOMBRE = '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="4" r="2.4" fill="currentColor"/><path d="M9.2 7.6h5.6c1 0 1.8.8 1.8 1.8v6h-2v7h-2v-7h-1.2v7h-2v-7h-2v-6c0-1 .8-1.8 1.8-1.8z" fill="currentColor"/></svg>';
export const ICONO = { bano_mujeres: MUJER, bano_hombres: HOMBRE };
export class Hotspots {
  constructor({ root, camera, venue, inv, occluders, onPick }) {
    Object.assign(this, { camera, onPick });
    this.items = []; this.mode = 'aerial'; this.ray = new THREE.Raycaster(); this.lastOcc = 0;
    this.occluders = occluders;
    const byId = Object.fromEntries(venue.objetos.map(o => [o.id, o]));
    for (const h of venue.hotspots) {
      const ref = h.ref ? byId[h.ref] : null;
      const pos = ref ? ref.pos : h.pos;
      if (!pos) continue;
      const kind = h.espacio ? 'space' : 'obj';
      const name = kind === 'space' ? inv.espacios[h.espacio]?.nombre : inv.tipos[ref.tipo]?.nombre;
      const el = document.createElement('button');
      el.className = 'hs ' + kind; el.setAttribute('aria-label', name || '');
      const ico = ref && ICONO[ref.tipo];   // baños: pictograma de mujer / hombre, como el letrero real de la puerta
      if (ico) el.classList.add('ico');
      el.innerHTML = kind === 'space' ? `<span>${name}</span>` : ico ? `<i>${ico}</i><span>${name}</span>` : `<i></i><span>${name}</span>`;
      const data = kind === 'space' ? { space: h.espacio } : { id: ref.id, tipo: ref.tipo, medidas: ref.medidas_modelo, nota: ref.nota };
      el.addEventListener('click', e => { e.stopPropagation(); this.onPick(kind, data); });
      el.addEventListener('pointerdown', e => e.stopPropagation());
      root.appendChild(el);
      const y = (ref?.z || 0) + h.h;
      this.items.push({ el, kind, data, p: new THREE.Vector3(pos[0], y, -pos[1]), visible: false, occluded: false });
    }
  }
  setMode(m) { this.mode = m; }
  /** Oculta todos los puntos (p. ej. mientras se lee una ficha). */
  setPaused(p) { this.paused = p; }
  /** Polígonos de los espacios: no se muestra la etiqueta del espacio en el que uno ya está. */
  setSpaces(espacios) { this.espacios = espacios; }

  update() {
    const cam = this.camera, now = performance.now(), W = innerWidth, H = innerHeight;
    const checkOcc = now - this.lastOcc > 180; if (checkOcc) this.lastOcc = now;
    const v = new THREE.Vector3(), placed = [];
    const here = this.mode === 'walk' && this.espacios
      ? [...this.espacios].sort((a, b) => area(a.poligono) - area(b.poligono)).find(e => inside([cam.position.x, -cam.position.z], e.poligono))?.id : null;
    // los más cercanos primero: si dos etiquetas se tapan, gana la más cercana
    const order = this.items.map(it => [it, cam.position.distanceTo(it.p)]).sort((a, b) => a[1] - b[1]);
    for (const [it] of order) {
      const d = cam.position.distanceTo(it.p);
      const max = this.mode === 'walk' ? (it.kind === 'obj' ? 9 : 14) : (it.kind === 'obj' ? 16 : 90);
      let show = !this.paused && d < max && !(it.kind === 'space' && it.data.space === here);
      if (show) { v.copy(it.p).project(cam); show = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05; }
      if (show && checkOcc) {                                   // ¿lo tapa un muro opaco?
        const dir = it.p.clone().sub(cam.position).normalize();
        this.ray.set(cam.position, dir); this.ray.far = d - 0.4;
        it.occluded = this.ray.intersectObjects(this.occluders, false).length > 0;
      }
      show = show && !it.occluded;
      if (show) {                                               // evitar etiquetas encimadas
        const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H, r = it.kind === 'space' ? 70 : 26;
        if (placed.some(([x, y, rr]) => Math.abs(x - sx) < r + rr && Math.abs(y - sy) < 18)) show = false;
        else placed.push([sx, sy, r]);
      }
      if (show) {
        it.el.style.transform = `translate(${(v.x + 1) / 2 * W}px, ${(1 - v.y) / 2 * H}px) translate(-50%, -50%)`;
        it.el.style.opacity = this.mode === 'walk' && it.kind === 'obj' ? Math.min(1, (max - d) / 2.5) : 1;
      }
      if (!show) it.el.style.opacity = '0';          // ocultar de verdad (el estilo en línea manda sobre la clase)
      if (show !== it.visible) { it.el.classList.toggle('on', show); it.visible = show; }
    }
  }
}

function area(p) { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(s / 2); }
function inside([x, y], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
