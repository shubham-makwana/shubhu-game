// Streams terrain chunks, road slabs, trees, buildings and street lamps around the player.
(function(){
const {sstep,lerp,hash,fbm,roadX,roadH,height,normal,cityW,mtnW,ROAD_HALF}=T;
const S=200,STEP=4,N=S/STEP,R=3,SLAB=200;
const mats={};
function canvasTex(draw,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;t.encoding=THREE.sRGBEncoding;return t;}
function makeMats(){
  const cell=64,cells=8,W=cell*cells;
  const rnd=(i,j)=>hash(i*7+3,j*11+5);
  const day=canvasTex((g)=>{g.fillStyle='#d4d8dc';g.fillRect(0,0,W,W);
    for(let i=0;i<cells;i++)for(let j=0;j<cells;j++){const x=i*cell+10,y=j*cell+12;
      const gr=g.createLinearGradient(x,y,x,y+38);gr.addColorStop(0,'#5d7690');gr.addColorStop(1,'#2f4358');g.fillStyle=gr;g.fillRect(x,y,44,38);}},W,W);
  const lit=canvasTex((g)=>{g.fillStyle='#000';g.fillRect(0,0,W,W);
    for(let i=0;i<cells;i++)for(let j=0;j<cells;j++){if(rnd(i,j)>.42){g.fillStyle=rnd(j,i)>.5?'#ffd9a0':'#fff2cf';g.fillRect(i*cell+10,j*cell+12,44,38);}}},W,W);
  mats.bldg=new THREE.MeshStandardMaterial({map:day,emissiveMap:lit,emissive:0xffffff,emissiveIntensity:0,vertexColors:true,roughness:.75});
  mats.terrain=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
  mats.road=new THREE.MeshStandardMaterial({color:0x16181c,roughness:.92,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  mats.line=new THREE.MeshStandardMaterial({color:0xf2f0e6,roughness:.7,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
  mats.lampPole=new THREE.MeshStandardMaterial({color:0x59616b,roughness:.6});
  mats.lamp=new THREE.MeshStandardMaterial({color:0x222222,emissive:0xffcf8a,emissiveIntensity:0});
  mats.tree=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,flatShading:true});
}
function bake(geo,col){const n=geo.attributes.position.count,a=new Float32Array(n*3),c=new THREE.Color(col);
  for(let i=0;i<n;i++){a[i*3]=c.r;a[i*3+1]=c.g;a[i*3+2]=c.b;}geo.setAttribute('color',new THREE.BufferAttribute(a,3));return geo;}
function merge(list){let pc=0,ic=0;list.forEach(g=>{pc+=g.attributes.position.count;ic+=g.index.count;});
  const pos=new Float32Array(pc*3),nor=new Float32Array(pc*3),col=new Float32Array(pc*3),idx=new Uint32Array(ic);let po=0,io=0;
  list.forEach(g=>{pos.set(g.attributes.position.array,po*3);nor.set(g.attributes.normal.array,po*3);col.set(g.attributes.color.array,po*3);
    for(let i=0;i<g.index.count;i++)idx[io+i]=g.index.array[i]+po;po+=g.attributes.position.count;io+=g.index.count;});
  const m=new THREE.BufferGeometry();m.setAttribute('position',new THREE.BufferAttribute(pos,3));m.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  m.setAttribute('color',new THREE.BufferAttribute(col,3));m.setIndex(new THREE.BufferAttribute(idx,1));return m;}
let treeGeo,lampPoleGeo,lampHeadGeo;
function makeShared(){
  const t=new THREE.CylinderGeometry(.35,.5,3,6);t.translate(0,1.5,0);
  const a=new THREE.ConeGeometry(3.2,7,7);a.translate(0,6.2,0);
  const b=new THREE.ConeGeometry(2.4,6,7);b.translate(0,10,0);
  treeGeo=merge([bake(t,0x5a4128),bake(a,0x3f7a3a),bake(b,0x57934a)]);
  lampPoleGeo=new THREE.BoxGeometry(.28,9,.28);lampPoleGeo.translate(0,4.5,0);
  lampHeadGeo=new THREE.BoxGeometry(1.8,.3,.7);lampHeadGeo.translate(0,9.1,0);
}
const tmpN=new THREE.Vector3(),cCol=new THREE.Color(),cA=new THREE.Color(.62,.45,.2),cB=new THREE.Color(.44,.45,.47),cC=new THREE.Color(.42,.38,.35),cD=new THREE.Color(.96,.97,1),cE=new THREE.Color(.3,.28,.25);
function buildTerrain(cx,cz){
  const x0=cx*S,z0=cz*S,V=N+1,M=V+2,H=new Float32Array(M*M);
  for(let j=0;j<M;j++)for(let i=0;i<M;i++)H[j*M+i]=height(x0+(i-1)*STEP,z0+(j-1)*STEP);
  const pos=new Float32Array(V*V*3),nor=new Float32Array(V*V*3),col=new Float32Array(V*V*3),idx=new Uint32Array(N*N*6),c=cCol;
  for(let j=0;j<V;j++)for(let i=0;i<V;i++){
    const x=x0+i*STEP,z=z0+j*STEP,m=(j+1)*M+i+1,h=H[m],k=(j*V+i)*3;
    const hx=H[m+1]-H[m-1],hz=H[m+M]-H[m-M],l=Math.hypot(hx,2*STEP,hz),ny=2*STEP/l;
    pos[k]=x-x0;pos[k+1]=h;pos[k+2]=z-z0;nor[k]=-hx/l;nor[k+1]=ny;nor[k+2]=-hz/l;
    const cw=cityW(z),mw=mtnW(z),slope=1-ny,v=fbm(x/45,z/45,2);
    c.setRGB(.30+.10*v,.50+.08*v,.20+.05*v);
    if(v>.6&&mw<.3)c.lerp(cA,.35);
    c.lerp(cB,cw*sstep(.1,.5,cw));
    const rock=sstep(.18,.38,slope)+sstep(90,170,h)*.7;
    c.lerp(cC,Math.min(1,rock)*(1-cw));
    c.lerp(cD,sstep(190+v*40,260+v*40,h)*(1-sstep(.5,.75,slope)*.6));
    const dr=Math.abs(x-roadX(z));c.lerp(cE,(1-sstep(7,11,dr))*.5);
    col[k]=c.r;col[k+1]=c.g;col[k+2]=c.b;}
  let q=0;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*V+i,b=a+1,d=a+V,e=d+1;idx[q++]=a;idx[q++]=d;idx[q++]=b;idx[q++]=b;idx[q++]=d;idx[q++]=e;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setIndex(new THREE.BufferAttribute(idx,1));g.computeBoundingSphere();
  const grp=new THREE.Group();grp.position.set(x0,0,z0);grp.add(new THREE.Mesh(g,mats.terrain));
  addTrees(grp,x0,z0);addBuildings(grp,x0,z0);return grp;
}
function addTrees(grp,x0,z0){
  const items=[],GS=13;
  for(let gz=0;gz<S/GS;gz++)for(let gx=0;gx<S/GS;gx++){
    const wx=x0+gx*GS+hash(gx+x0,gz+z0)*GS,wz=z0+gz*GS+hash(gx*3+z0,gz*5+x0)*GS;
    if(cityW(wz)>.25)continue;
    const dens=fbm(wx/110,wz/110,2);if(dens<.5||hash(Math.floor(wx),Math.floor(wz))>(dens-.4)*2.2)continue;
    if(Math.abs(wx-roadX(wz))<16)continue;
    const h=height(wx,wz);if(h>150+mtnW(wz)*20)continue;normal(wx,wz,tmpN);if(tmpN.y<.82)continue;
    items.push([wx-x0,h,wz-z0,.8+hash(gx,gz)*.8,hash(gz,gx)*6.28]);}
  if(!items.length)return;
  const im=new THREE.InstancedMesh(treeGeo,mats.tree,items.length),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
  items.forEach((t,i)=>{q.setFromAxisAngle(up,t[4]);m4.compose(new THREE.Vector3(t[0],t[1]-.2,t[2]),q,new THREE.Vector3(t[3],t[3]*(.9+hash(i,7)*.5),t[3]));im.setMatrixAt(i,m4);});
  im.instanceMatrix.needsUpdate=true;im.frustumCulled=false;grp.add(im);
}
function pushBox(A,cx,cz,w,d,y0,y1,col){
  const hw=w/2,hd=d/2,uw=w/32,ud=d/32,vh=(y1-y0)/28,base=A.p.length/3;
  const sides=[[cx-hw,cz+hd,cx+hw,cz+hd,0,0,1,uw],[cx+hw,cz-hd,cx-hw,cz-hd,0,0,-1,uw],[cx+hw,cz+hd,cx+hw,cz-hd,1,0,0,ud],[cx-hw,cz-hd,cx-hw,cz+hd,-1,0,0,ud]];
  sides.forEach(s=>{const b=A.p.length/3;
    A.p.push(s[0],y0,s[1],s[2],y0,s[3],s[2],y1,s[3],s[0],y1,s[1]);
    for(let i=0;i<4;i++){A.n.push(s[4],0,s[6]);A.c.push(col.r,col.g,col.b);}
    A.u.push(0,0,s[7],0,s[7],vh,0,vh);A.i.push(b,b+1,b+2,b,b+2,b+3);});
  const b=A.p.length/3;A.p.push(cx-hw,y1,cz+hd,cx+hw,y1,cz+hd,cx+hw,y1,cz-hd,cx-hw,y1,cz-hd);
  for(let i=0;i<4;i++){A.n.push(0,1,0);A.c.push(col.r*.55,col.g*.55,col.b*.55);A.u.push(.03,.03);}A.i.push(b,b+1,b+2,b,b+2,b+3);
}
function addBuildings(grp,x0,z0){
  const CS=56,A={p:[],n:[],u:[],c:[],i:[]},col=new THREE.Color();
  for(let gz=Math.floor(z0/CS);gz<=Math.floor((z0+S)/CS);gz++)for(let gx=Math.floor(x0/CS);gx<=Math.floor((x0+S)/CS);gx++){
    const cx=gx*CS+CS/2,cz=gz*CS+CS/2;if(cx<x0||cx>=x0+S||cz<z0||cz>=z0+S)continue;
    const cw=cityW(cz);if(cw<.55)continue;if(Math.abs(cx-roadX(cz))<38)continue;
    const r=hash(gx,gz),w=26+hash(gx+9,gz)*14,d=26+hash(gx,gz+9)*14,
      hgt=14+Math.pow(hash(gx+2,gz+4),3)*150*sstep(.55,1,cw)+r*18;
    const y=Math.min(height(cx-w/2,cz-d/2),height(cx+w/2,cz+d/2),height(cx,cz))-4;
    col.setHSL(.58+hash(gx,gz+1)*.1,.08,.72+hash(gz,gx)*.2);
    pushBox(A,cx-x0,cz-z0,w,d,y,y+hgt+4,col);}
  if(!A.p.length)return;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(A.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(A.n,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(A.u,2));g.setAttribute('color',new THREE.Float32BufferAttribute(A.c,3));g.setIndex(A.i);g.computeBoundingSphere();
  grp.add(new THREE.Mesh(g,mats.bldg));
}
function strip(pts){ // pts: [[xl,y,zl,xr,y,zr],...] -> geometry
  const p=[],i=[];pts.forEach((s,k)=>{p.push(s[0],s[1],s[2],s[3],s[4],s[5]);if(k){const a=(k-1)*2;i.push(a,a+2,a+1,a+1,a+2,a+3);}});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(i);g.computeVertexNormals();return g;}
function buildSlab(sz){
  const z0=sz*SLAB,grp=new THREE.Group(),rows=[],edgeL=[],edgeR=[],H=ROAD_HALF,y=.14;
  for(let z=z0;z<=z0+SLAB;z+=STEP){const x=roadX(z),h=roadH(z)+y;
    rows.push([x-H,h,z,x+H,h,z]);
    edgeL.push([x-H+.5,h+.02,z,x-H+.9,h+.02,z]);edgeR.push([x+H-.9,h+.02,z,x+H-.5,h+.02,z]);}
  grp.add(new THREE.Mesh(strip(rows),mats.road));
  const lines=[strip(edgeL),strip(edgeR)];
  for(let z=z0;z<z0+SLAB;z+=16){const d=[];for(let k=0;k<=2;k++){const zz=z+k*3,x=roadX(zz),h=roadH(zz)+y+.02;d.push([x-.18,h,zz,x+.18,h,zz]);}lines.push(strip(d));}
  lines.forEach(g=>{g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(1),3));});
  const lm=new THREE.Mesh(merge(lines.map(g=>{g.setIndex(g.index);return g;})),new THREE.MeshStandardMaterial({color:0xf2f0e6,roughness:.7,vertexColors:true,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));
  grp.add(lm);
  const lamps=[];for(let z=z0;z<z0+SLAB;z+=50){const side=((z/50)&1)?1:-1,x=roadX(z)+side*(H+2.6);lamps.push([x,roadH(z),z,side]);}
  const poles=new THREE.InstancedMesh(lampPoleGeo,mats.lampPole,lamps.length),heads=new THREE.InstancedMesh(lampHeadGeo,mats.lamp,lamps.length),m4=new THREE.Matrix4();
  lamps.forEach((l,k)=>{m4.makeTranslation(l[0],l[1],l[2]);poles.setMatrixAt(k,m4);m4.makeTranslation(l[0]-l[3]*.9,l[1],l[2]);heads.setMatrixAt(k,m4);});
  poles.frustumCulled=heads.frustumCulled=false;grp.add(poles,heads);
  return grp;
}
function disposeGroup(g){g.traverse(o=>{if(o.geometry&&o.geometry!==treeGeo&&o.geometry!==lampPoleGeo&&o.geometry!==lampHeadGeo)o.geometry.dispose();});}
const World={group:new THREE.Group(),chunks:new Map(),slabs:new Map(),
  init(){makeMats();makeShared();},
  setNight(n){mats.bldg.emissiveIntensity=n*1.1;mats.lamp.emissiveIntensity=n*2.2;},
  update(px,pz,all){
    const pcx=Math.floor(px/S),pcz=Math.floor(pz/S),need=[];
    for(let dz=-R;dz<=R;dz++)for(let dx=-R;dx<=R;dx++)need.push([pcx+dx,pcz+dz,dx*dx+dz*dz]);
    need.sort((a,b)=>a[2]-b[2]);const keep=new Set();let built=0;
    for(const [cx,cz] of need){const k=cx+','+cz;keep.add(k);
      if(!this.chunks.has(k)&&(all||built<1)){const g=buildTerrain(cx,cz);this.chunks.set(k,g);this.group.add(g);built++;}}
    for(const [k,g] of this.chunks)if(!keep.has(k)){this.group.remove(g);disposeGroup(g);this.chunks.delete(k);}
    const ps=Math.floor(pz/SLAB),keepS=new Set();let sb=0;
    for(let s=ps-5;s<=ps+5;s++){keepS.add(s);if(!this.slabs.has(s)&&(all||sb<1)){const g=buildSlab(s);this.slabs.set(s,g);this.group.add(g);sb++;}}
    for(const [k,g] of this.slabs)if(!keepS.has(k)){this.group.remove(g);disposeGroup(g);this.slabs.delete(k);}
  },
  clear(){for(const g of this.chunks.values()){this.group.remove(g);disposeGroup(g);}for(const g of this.slabs.values()){this.group.remove(g);disposeGroup(g);}this.chunks.clear();this.slabs.clear();}
};
window.World=World;
})();
