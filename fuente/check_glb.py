import json,struct,numpy as np,sys,matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
d=open(sys.argv[1],'rb').read(); jl=struct.unpack('<I',d[12:16])[0]; g=json.loads(d[20:20+jl]); b=d[20+jl+8:]
tris=[];cols=[]
for mesh in g['meshes']:
    pr=mesh['primitives'][0]; a=g['accessors'][pr['attributes']['POSITION']]; bv=g['bufferViews'][a['bufferView']]
    P=np.frombuffer(b[bv['byteOffset']:bv['byteOffset']+bv['byteLength']],np.float32).reshape(-1,3,3)
    c=g['materials'][pr['material']]['pbrMetallicRoughness']['baseColorFactor']
    tris.append(P); cols+= [c]*len(P)
P=np.concatenate(tris).astype(float); C=np.array(cols)
extra=sys.argv[3:] 
def view(az,el,fn,ycut=99):
    k=P[:,:,1].mean(1)<ycut; Q=P[k]; CC=C[k]
    a,e=np.radians(az),np.radians(el)
    d_=np.array([np.cos(e)*np.sin(a),np.sin(e),np.cos(e)*np.cos(a)])
    right=np.cross([0,1,0],d_); right/=np.linalg.norm(right); up=np.cross(d_,right)
    n=np.cross(Q[:,1]-Q[:,0],Q[:,2]-Q[:,0]); n/=np.linalg.norm(n,axis=1,keepdims=True)+1e-12
    L=np.array([0.4,0.8,0.3]);L/=np.linalg.norm(L); sh=0.45+0.55*np.abs(n@L)
    o=np.argsort(Q@d_ @ np.ones(3)/3) if False else np.argsort((Q@d_).mean(1))
    fc=CC.copy(); fc[:,:3]=np.clip(fc[:,:3]*sh[:,None]*1.6,0,1)
    fig,ax=plt.subplots(figsize=(14,9)); ax.set_facecolor('#dfe6ea')
    ax.add_collection(PolyCollection(np.stack([Q@right,Q@up],2)[o],facecolors=fc[o],edgecolors='none'))
    ax.autoscale(); ax.set_aspect('equal'); ax.axis('off'); fig.savefig(fn,dpi=70,bbox_inches='tight'); plt.close(fig)
view(20,30,sys.argv[2]+'_a.png'); view(200,35,sys.argv[2]+'_b.png'); view(160,50,sys.argv[2]+'_cut.png',ycut=3.0)
