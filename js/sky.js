// Day/night cycle: sky dome, sun, moon, stars, clouds, fog and scene lighting driven by one clock (hours 0-24).
(function(){
const {sstep}=T;
const C=(h)=>new THREE.Color(h);
const KEYS={
  nightTop:C('#04060d'),nightHor:C('#0f1a33'),
  duskTop:C('#35467f'),duskHor:C('#ff9a5c'),
  dayTop:C('#3a7fd5'),dayHor:C('#bcdcf2')
};
function glowTex(inner,outer){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),r=g.createRadialGradient(64,64,0,64,64,64);
  r.addColorStop(0,inner);r.addColorStop(.3,inner);r.addColorStop(1,outer);g.fillStyle=r;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
const Sky={
  e:1,night:0,sunDir:new THREE.Vector3(),
  init(scene){
    this.scene=scene;
    this.uni={top:{value:new THREE.Color()},hor:{value:new THREE.Color()},sunDir:{value:new THREE.Vector3(0,1,0)},sunCol:{value:new THREE.Color()},glow:{value:1}};
    this.dome=new THREE.Mesh(new THREE.SphereGeometry(1800,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:this.uni,
      vertexShader:'varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform vec3 top,hor,sunCol,sunDir;uniform float glow;varying vec3 vD;void main(){float h=clamp(vD.y,0.,1.);vec3 c=mix(hor,top,pow(h,.55));'+
      'c=mix(c,hor*.85,smoothstep(0.,-.25,vD.y));float s=max(dot(normalize(vD),sunDir),0.);c+=sunCol*(pow(s,48.)*.55+pow(s,6.)*.18)*glow;gl_FragColor=vec4(pow(c,vec3(.4545)),1.);}'}));
    this.dome.renderOrder=-10;scene.add(this.dome);
    const st=new Float32Array(1400*3);for(let i=0;i<1400;i++){const u=Math.random()*2-1,a=Math.random()*6.283,r=Math.sqrt(1-u*u);st[i*3]=r*Math.cos(a)*1700;st[i*3+1]=Math.abs(u)*1700;st[i*3+2]=r*Math.sin(a)*1700;}
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(st,3));
    this.stars=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:3,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false}));scene.add(this.stars);
    const mk=(tex,s,col)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(s,s),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,fog:false,color:col,blending:THREE.AdditiveBlending}));m.renderOrder=-9;scene.add(m);return m;};
    this.sun=mk(glowTex('rgba(255,247,220,1)','rgba(255,200,120,0)'),360,0xffffff);
    this.moon=mk(glowTex('rgba(225,235,255,1)','rgba(150,170,220,0)'),190,0xffffff);
    this.hemi=new THREE.HemisphereLight(0xbfd8ff,0x4a4a3a,.7);scene.add(this.hemi);
    this.dir=new THREE.DirectionalLight(0xffffff,1);scene.add(this.dir,this.dir.target);
    scene.fog=new THREE.Fog(0xbcdcf2,80,640);
    this.clouds=[];this.cmat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.92,fog:false,depthWrite:false});
    const ico=new THREE.IcosahedronGeometry(1,1);
    for(let i=0;i<34;i++){const g=new THREE.Group();const n=3+Math.floor(Math.random()*4);
      for(let k=0;k<n;k++){const m=new THREE.Mesh(ico,this.cmat);m.position.set(k*55-n*25+Math.random()*20,Math.random()*14,Math.random()*30);m.scale.set(50+Math.random()*30,18+Math.random()*10,34+Math.random()*16);g.add(m);}
      g.position.set((Math.random()-.5)*3000,260+Math.random()*180,(Math.random()-.5)*3000);scene.add(g);this.clouds.push(g);}
  },
  update(hour,cam,player,dt){
    const a=(hour-6)/24*Math.PI*2,sd=this.sunDir.set(Math.cos(a)*.5,Math.sin(a),Math.cos(a)*.86).normalize(),e=sd.y;this.e=e;
    const toDusk=sstep(-.2,-.01,e),toDay=sstep(.03,.38,e);
    const top=KEYS.nightTop.clone().lerp(KEYS.duskTop,toDusk).lerp(KEYS.dayTop,toDay),hor=KEYS.nightHor.clone().lerp(KEYS.duskHor,toDusk).lerp(KEYS.dayHor,toDay);
    this.uni.top.value.copy(top);this.uni.hor.value.copy(hor);this.uni.sunDir.value.copy(sd);
    this.uni.sunCol.value.setRGB(1,.72+.2*toDay,.45+.45*toDay);this.uni.glow.value=sstep(-.12,.05,e);
    this.night=1-sstep(-.14,.1,e);
    const p=player;this.dome.position.copy(cam.position);this.stars.position.copy(cam.position);this.stars.material.opacity=sstep(.0,-.25,e);
    this.sun.position.copy(cam.position).addScaledVector(sd,1500);this.sun.lookAt(cam.position);this.sun.visible=e>-.15;
    this.moon.position.copy(cam.position).addScaledVector(sd,-1500);this.moon.lookAt(cam.position);this.moon.visible=e<.1;
    const fc=hor.clone().lerp(C('#10172b'),0);this.scene.fog.color.copy(fc);
    this.scene.fog.near=60+this.night*10;this.scene.fog.far=640-this.night*120;
    const sunUp=Math.max(0,e);
    if(e>-.04){this.dir.position.set(p.x,0,p.z).addScaledVector(sd,300);this.dir.color.setRGB(1,.78+.2*toDay,.6+.38*toDay);this.dir.intensity=Math.min(1.25,sunUp*2.6+.05);}
    else{this.dir.position.set(p.x,0,p.z).addScaledVector(sd,-300);this.dir.color.setRGB(.55,.65,1);this.dir.intensity=.22*sstep(-.04,-.3,e)+.04;}
    this.dir.target.position.set(p.x,0,p.z);
    this.hemi.color.copy(top).lerp(hor,.5);this.hemi.groundColor.setRGB(.28,.27,.22).multiplyScalar(.25+.75*(1-this.night));
    this.hemi.intensity=.18+.62*(1-this.night)+.1*toDusk;
    this.cmat.color.copy(hor).lerp(C('#ffffff'),.55*toDay).multiplyScalar(.12+.88*(1-this.night)*(.55+.45*toDay));
    this.clouds.forEach(c=>{c.position.x+=dt*4;const dx=c.position.x-p.x,dz=c.position.z-p.z;
      if(dx>1600)c.position.x-=3200;if(dx<-1600)c.position.x+=3200;if(dz>1600)c.position.z-=3200;if(dz<-1600)c.position.z+=3200;});
  }
};
window.Sky=Sky;
})();
