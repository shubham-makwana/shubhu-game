// Five drivable cars built from extruded side profiles (z = forward, y = up).
(function(){
const SPECS=[
 {id:'gt',name:'Coastline GT',desc:'Low, fast, loud tyres',top:265,acc:15,grip:1.15,len:4.5,wid:1.9,wr:.34,wz:1.45,
  body:[[-2.25,.3],[-2.25,.78],[-1.5,.9],[-.8,1.2],[.3,1.24],[1.1,.92],[2.25,.74],[2.25,.3]],
  glass:[[-1.0,.92],[-.65,1.17],[.2,1.2],[.85,.93]],colors:['#d4402b','#2f6fb5','#f0b323','#e9ecef','#1f2328'],cam:[8,3.2]},
 {id:'sedan',name:'Metro Sedan',desc:'Smooth and comfortable',top:190,acc:10,grip:1,len:4.7,wid:1.8,wr:.34,wz:1.5,
  body:[[-2.35,.35],[-2.35,.88],[-1.5,.98],[-1.0,1.42],[.5,1.45],[1.25,1.0],[2.35,.86],[2.35,.35]],
  glass:[[-1.2,1.0],[-.88,1.38],[.45,1.4],[1.05,1.02]],colors:['#2e4a62','#9aa3ab','#7c1f2c','#e9ecef','#2b6a4f'],cam:[8.5,3.6]},
 {id:'suv',name:'Trail SUV',desc:'Big wheels, great off-road',top:170,acc:9,grip:.95,len:4.6,wid:1.95,wr:.46,wz:1.45,
  body:[[-2.3,.5],[-2.3,1.5],[-1.8,1.72],[.7,1.72],[1.35,1.2],[2.3,1.08],[2.3,.5]],
  glass:[[-1.7,1.25],[-1.55,1.68],[.6,1.68],[1.15,1.22]],colors:['#4f6b3a','#d97b29','#e9ecef','#1f2328','#3a5f8a'],cam:[9,4.2]},
 {id:'pickup',name:'Ridge Pickup',desc:'Heavy, steady, tough',top:160,acc:8.5,grip:.92,len:5.2,wid:2,wr:.45,wz:1.65,
  body:[[-2.6,.5],[-2.6,1.2],[-0.4,1.2],[-.35,1.75],[.9,1.75],[1.45,1.3],[2.6,1.15],[2.6,.5]],
  glass:[[-.25,1.3],[-.2,1.7],[.8,1.7],[1.25,1.32]],colors:['#b5372a','#e9ecef','#32393f','#c9a227','#2f6fb5'],cam:[9.5,4.3]},
 {id:'mini',name:'Pocket Hatch',desc:'Tiny, zippy, easy to park',top:145,acc:9,grip:1.05,len:3.5,wid:1.6,wr:.3,wz:1.1,
  body:[[-1.75,.32],[-1.75,1.12],[-1.2,1.5],[.55,1.5],[.95,1.05],[1.75,.85],[1.75,.32]],
  glass:[[-1.15,1.15],[-.95,1.45],[.5,1.45],[.82,1.1]],colors:['#f2c14e','#e46f5a','#59a9c6','#e9ecef','#7bbf6a'],cam:[7,3]}
];
function profileGeo(pts,depth){
  const s=new THREE.Shape();pts.forEach((p,i)=>i?s.lineTo(p[0],p[1]):s.moveTo(p[0],p[1]));
  const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.08,bevelThickness:.08,bevelSegments:2,steps:1});
  g.rotateY(-Math.PI/2);g.translate(depth/2,0,0);return g;
}
function build(spec,colorHex){
  const g=new THREE.Group(),inner=new THREE.Group();g.add(inner);
  const paint=new THREE.MeshStandardMaterial({color:colorHex,roughness:.35,metalness:.35});
  const glass=new THREE.MeshStandardMaterial({color:0x14202c,roughness:.12,metalness:.6});
  const dark=new THREE.MeshStandardMaterial({color:0x111111,roughness:.9}),hub=new THREE.MeshStandardMaterial({color:0xb9bec4,roughness:.4,metalness:.8});
  const body=new THREE.Mesh(profileGeo(spec.body,spec.wid-.16),paint);body.castShadow=true;inner.add(body);
  const gl=new THREE.Mesh(profileGeo(spec.glass,spec.wid-.1),glass);inner.add(gl);
  const under=new THREE.Mesh(new THREE.BoxGeometry(spec.wid-.2,.18,spec.len-.3),dark);under.position.y=spec.body[0][1]-.05;inner.add(under);
  const wheels=[];
  [[1,1],[-1,1],[1,-1],[-1,-1]].forEach(([sx,sz])=>{
    const pivot=new THREE.Group();pivot.position.set(sx*(spec.wid/2-.12),spec.wr,sz*spec.wz);
    const spin=new THREE.Group();pivot.add(spin);
    const tyre=new THREE.Mesh(new THREE.CylinderGeometry(spec.wr,spec.wr,.3,18),dark);tyre.rotation.z=Math.PI/2;spin.add(tyre);
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(spec.wr*.62,spec.wr*.62,.32,10),hub);rim.rotation.z=Math.PI/2;spin.add(rim);
    const bar=new THREE.Mesh(new THREE.BoxGeometry(.33,spec.wr*.2,spec.wr*1.2),dark);spin.add(bar);
    inner.add(pivot);wheels.push({pivot,spin,front:sz>0});});
  const headMat=new THREE.MeshStandardMaterial({color:0xfff6dd,emissive:0xfff0c0,emissiveIntensity:.25}),
        tailMat=new THREE.MeshStandardMaterial({color:0x6a0f0f,emissive:0xff1a1a,emissiveIntensity:.35});
  const fy=spec.body[spec.body.length-2][1]-.12,ry=spec.body[1][1]-.12,hz=spec.len/2,spots=[];
  [-1,1].forEach(s=>{
    const h=new THREE.Mesh(new THREE.BoxGeometry(.38,.16,.1),headMat);h.position.set(s*(spec.wid/2-.4),fy,hz+.04);inner.add(h);
    const t=new THREE.Mesh(new THREE.BoxGeometry(.4,.14,.1),tailMat);t.position.set(s*(spec.wid/2-.35),ry,-hz-.04);inner.add(t);
    const sp=new THREE.SpotLight(0xfff1cc,0,110,.5,.55,1.2);sp.position.set(s*.6,fy,hz);const tg=new THREE.Object3D();tg.position.set(s*.6,fy-3,hz+30);
    inner.add(sp,tg);sp.target=tg;spots.push(sp);});
  return {group:g,inner,wheels,headMat,tailMat,spots,spec};
}
window.Cars={SPECS,build};
})();
