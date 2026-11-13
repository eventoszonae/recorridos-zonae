"""Crea texturas repetibles (seamless) a partir de las fotos de detalle del moodboard y fotogramas de video."""
import numpy as np
from PIL import Image, ImageFilter
SRC = '/home/claude/w/pdfimg/'; OUT = 'tex/'

def seamless(img, blend=0.18):
    """Hace repetible una imagen mezclando cada borde con el opuesto (cross-fade)."""
    a = np.asarray(img, dtype=float); h, w = a.shape[:2]
    bw, bh = int(w * blend), int(h * blend)
    out = a.copy()
    # horizontal: mezcla franja izquierda con la derecha
    ramp = np.linspace(0, 1, bw)[None, :, None]
    out[:, :bw] = a[:, :bw] * ramp + a[:, w - bw:] * (1 - ramp)
    out = out[:, :w - bw]
    a = out; w2 = a.shape[1]
    ramp = np.linspace(0, 1, bh)[:, None, None]
    out = a.copy(); out[:bh] = a[:bh] * ramp + a[h - bh:] * (1 - ramp)
    out = out[:h - bh]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

def even_light(img, radius=120, strength=0.85):
    """Quita sombras/manchas de luz grandes (las fotos tienen luz no uniforme)."""
    a = np.asarray(img, dtype=float)
    low = np.asarray(img.filter(ImageFilter.GaussianBlur(radius)), dtype=float)
    m = low.mean(axis=(0, 1), keepdims=True)
    return Image.fromarray(np.clip(a / (low / m) ** strength, 0, 255).astype(np.uint8))

def save(img, name, size):
    img.convert('RGB').resize((size, size), Image.LANCZOS).save(OUT + name, quality=82, optimize=True)
    print(name)

# 1. Piso del salón: cemento con estampado. Período medido por autocorrelación: 755 × 721 px = 1 módulo.
p = Image.open(SRC + 'p-000.ppm').convert('RGB')
p = even_light(p, 200, 0.9)
save(p.crop((300, 420, 300 + 755, 420 + 721)), 'piso_salon.jpg', 1024)   # ya es periódico: sin mezcla
# 2. Madera de mesas (tablones verticales en la foto)
save(seamless(even_light(Image.open(SRC + 'p-002.ppm').convert('RGB').crop((100, 200, 1412, 1800)))), 'madera_mesa.jpg', 1024)
# 3. Piso del deck (tablones horizontales)
save(seamless(even_light(Image.open(SRC + 'p-015.ppm').convert('RGB').crop((80, 150, 1432, 1850)))), 'madera_deck.jpg', 1024)
# 4. Cielo de madera del alero
save(seamless(even_light(Image.open(SRC + 'p-020.ppm').convert('RGB').crop((80, 150, 1432, 1850)))), 'madera_cielo.jpg', 1024)
# 5. Cubierta de las mesas cocteleras (madera envejecida)
save(seamless(even_light(Image.open(SRC + 'p-019.ppm').convert('RGB').crop((100, 200, 1412, 1800)))), 'madera_coctel.jpg', 512)
# 6. Paneles de madera rojiza del volumen de servicios (fotograma del video BAR)
f = Image.open('/home/claude/w/barf.png').convert('RGB')
save(seamless(even_light(f.crop((372, 520, 468, 650)), 30, 0.6), 0.25), 'madera_rojiza.jpg', 256)
# 7. Prado: textura procedural con el color medido en zona soleada del video DECK (el prado de los videos tiene sombras)
g = np.asarray(Image.open('/home/claude/w/grass2.png').convert('RGB').crop((140, 700, 400, 770)), dtype=float).reshape(-1, 3)
base = np.median(g, 0); rng = np.random.default_rng(3); N = 512
noise = sum(np.asarray(Image.fromarray((rng.random((N//k, N//k))*255).astype(np.uint8)).resize((N, N), Image.BICUBIC), float)/255*w
            for k, w in [(64, .35), (16, .3), (4, .2), (1, .15)])
tex = base[None, None, :] * (0.78 + 0.42*noise[..., None]) * np.array([0.98, 1.0, 0.92])
save(seamless(Image.fromarray(np.clip(tex, 0, 255).astype(np.uint8)), 0.15), 'prado.jpg', 512)
print('color prado', base)
