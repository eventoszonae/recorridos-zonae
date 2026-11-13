// Etapa 6 – Plano interactivo: planta simplificada con "usted está aquí".
// Se dibuja con los mismos datos del venue (espacios, jardineras, lago, muelle): sirve para cualquier locación.
export class Plano {
  constructor({ canvas, venue, onSpace, fondo }) {
    Object.assign(this, { canvas, venue, onSpace });
    this.fondo = fondo || null;          // plano arquitectónico generado desde el modelo (data/plano.png)
    this.ctx = canvas.getContext('2d'); this.hover = null; this.me = null;
    const pts = venue.espacios.flatMap(e => e.poligono);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    this.b = this.fondo ? { x0: this.fondo.x0, x1: this.fondo.x1, y0: this.fondo.y0, y1: this.fondo.y1 }
                        : { x0: Math.min(...xs) - 2, x1: Math.max(...xs) + 2, y0: Math.min(...ys) - 2, y1: Math.max(...ys) + 2 };
    if (this.fondo) { this.img = new Image(); this.img.onload = () => this.draw(); this.img.src = this.fondo.img; }
    canvas.addEventListener('pointermove', e => { const h = this.hit(e); if (h !== this.hover) { this.hover = h; this.draw(); } canvas.style.cursor = h ? 'pointer' : ''; });
    canvas.addEventListener('pointerleave', () => { this.hover = null; this.draw(); });
    canvas.addEventListener('click', e => { const h = this.hit(e); if (h) this.onSpace(h); });
    this.resize();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
    this.canvas.width = r.width * dpr; this.canvas.height = r.height * dpr; this.dpr = dpr;
    const { x0, x1, y0, y1 } = this.b;
    this.s = Math.min(this.canvas.width / (x1 - x0), this.canvas.height / (y1 - y0));   // el lago (+y) queda arriba
    this.draw();
  }
  // planta con el lago (+y) hacia arriba
  P([x, y]) { const { x0, y1 } = this.b; return [(x - x0) * this.s, (y1 - y) * this.s]; }
  hit(e) {
    const r = this.canvas.getBoundingClientRect(), dpr = this.dpr;
    const px = (e.clientX - r.left) * dpr, py = (e.clientY - r.top) * dpr;
    const x = px / this.s + this.b.x0, y = this.b.y1 - py / this.s;
    // los espacios pequeños primero (pista dentro del salón)
    const order = [...this.venue.espacios].sort((a, b) => area(a.poligono) - area(b.poligono));
    return order.find(sp => inside([x, y], sp.poligono))?.id || null;
  }
  setPosition(xy, yaw) { this.me = xy ? { xy, yaw } : null; this.draw(); }
  path(poly) { const c = this.ctx; c.beginPath(); poly.forEach((p, i) => { const [a, b] = this.P(p); i ? c.lineTo(a, b) : c.moveTo(a, b); }); c.closePath(); }
  draw() {
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height, ext = this.venue.exterior, k = this.dpr;
    c.clearRect(0, 0, W, H);
    if (this.img?.complete && this.img.naturalWidth) {
      const [ax, ay] = this.P([this.b.x0, this.b.y1]), [bx, by] = this.P([this.b.x1, this.b.y0]);
      c.drawImage(this.img, ax, ay, bx - ax, by - ay);
    } else {
      if (ext.lago) { this.path(ext.lago); c.fillStyle = 'rgba(120,150,140,.35)'; c.fill(); }
      for (const j of ext.jardineras) { this.path(j); c.fillStyle = 'rgba(80,110,60,.30)'; c.fill(); }
    }
    if (this.hover) {                                   // solo se resalta el espacio señalado
      const sp = this.venue.espacios.find(s => s.id === this.hover);
      this.path(sp.poligono); c.fillStyle = 'rgba(27,27,26,.14)'; c.fill(); c.strokeStyle = 'rgba(27,27,26,.7)'; c.lineWidth = 1.2 * k; c.stroke();
    }
    if (this.me) {
      const [a, b] = this.P(this.me.xy), r = 5 * k;
      c.fillStyle = 'rgba(27,27,26,.18)'; c.beginPath();                 // cono de visión
      const ang = Math.atan2(-Math.cos(this.me.yaw), -Math.sin(this.me.yaw));   // dirección de la mirada en pantalla
      c.moveTo(a, b); c.arc(a, b, 22 * k, ang - 0.5, ang + 0.5); c.closePath(); c.fill();
      c.fillStyle = '#1b1b1a'; c.beginPath(); c.arc(a, b, r, 0, 7); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2 * k; c.stroke();
    }
    if (this.hover) {
      const sp = this.venue.espacios.find(s => s.id === this.hover);
      c.font = `${11 * k}px Inter, sans-serif`; c.fillStyle = '#1b1b1a'; c.fillText(sp.nombre, 6 * k, H - 8 * k);
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
