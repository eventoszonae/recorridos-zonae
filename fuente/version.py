"""Pone una versión nueva en el importmap de index.html (los navegadores descargan los módulos cambiados al instante)."""
import re, sys, time
p = sys.argv[1]; s = open(p).read()
v = time.strftime('%Y%m%d%H%M%S')
s = re.sub(r'\?v=[0-9A-Z]+"', f'?v={v}"', s)
open(p, 'w').write(s); print('versión', v)
