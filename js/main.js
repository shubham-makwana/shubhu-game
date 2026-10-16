// Game loop: renderer, driving model, chase camera, input, menu and HUD.
(function(){
const {clamp,lerp,height,roadX,cityW,mtnW,ROAD_HALF}=T;
const $=id=>document.getElementById(id);
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(62,1,.5,2600);
function resize(){const w=window.innerWidth,h=window.innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();

World.init();Sky.init(scene);scene.add(World.group);
// soft blob shadow under the car
const blob=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,2,32,32,32);
  r.addColorStop(0,'rgba(0,0,0,.6)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})(),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-6}));
blob.rotation.x=-Math.PI/2;scene.add(blob);

// ---------- state ----------
const P={x:roadX(0),z:0,y:0,h:0,vx:0,vz:0,steer:0,pitch:0,roll:0,odo:0,spin:0,camH:0,speedKmh:0};
P.y=height(P.x,P.z);
const st={car:null,carIdx:0,color:0,hour:9.5,auto:true,camMode:0,lights:null,menu:true,sound:true};
const keys={};
const out=(k)=>keys[k]||false;

function setCar(idx,colorIdx){
  if(st.car){scene.remove(st.car.group);st.car.group.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
  const spec=Cars.SPECS[idx];st.carIdx=idx;st.color=Math.min(colorIdx,spec.colors.length-1);
  st.car=Cars.build(spec,new THREE.Color(spec.colors[st.color]));scene.add(st.car.group);blob.scale.set(spec.wid*1.5,spec.len*1.3,1);
  [...$('cars').children].forEach((b,i)=>b.setAttribute('aria-pressed',i===idx));
  const box=$('colors');[...box.querySelectorAll('.sw')].forEach(n=>n.remove());
  spec.colors.forEach((c,i)=>{const b=document.createElement('button');b.className='sw';b.style.background=c;b.setAttribute('aria-label','Paint '+(i+1));b.setAttribute('aria-pressed',i===st.color);
    b.onclick=()=>setCar(idx,i);box.appendChild(b);});
}
Cars.SPECS.forEach((s,i)=>{const b=document.createElement('button');b.className='car';b.innerHTML='<strong>'+s.name+'</strong><span>'+s.desc+'</span><small>'+s.top+' km/h top</small>';b.onclick=()=>setCar(i,0);$('cars').appendChild(b);});

// ---------- input ----------
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys[k]=true;
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();
  if(st.menu)return;
  if(k==='c')cycleCam();if(k==='h')st.lights=st.lights===null?true:st.lights?false:null;if(k==='r')resetToRoad();if(k==='m')st.sound=!st.sound;});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
function cycleCam(){st.camMode=(st.camMode+1)%3;}
function resetToRoad(){P.x=roadX(P.z);const d=(roadX(P.z+5)-roadX(P.z-5))/10;P.h=Math.atan2(d,1);P.vx=P.vz=0;P.y=height(P.x,P.z);P.camH=P.h;}
if('ontouchstart' in window||navigator.maxTouchPoints>0){
  const pad=document.createElement('div');pad.style.cssText='position:fixed;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 86px);display:flex;justify-content:space-between;padding:0 max(16px,env(safe-area-inset-left,0px));pointer-events:none;z-index:5';
  const mk=(label,ks)=>{const b=document.createElement('button');b.textContent=label;b.style.cssText='width:64px;height:64px;font-size:22px;pointer-events:auto;border-radius:50%';
    const on=e=>{e.preventDefault();ks.forEach(k=>keys[k]=true);},off=e=>{e.preventDefault();ks.forEach(k=>keys[k]=false);};
    b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off);return b;};
  const l=document.createElement('div'),r=document.createElement('div');l.style.cssText=r.style.cssText='display:flex;gap:10px';
  l.append(mk('◀',['a']),mk('▶',['d']));r.append(mk('▲',['w']),mk('▼',['s']));pad.append(l,r);document.body.appendChild(pad);
}

// ---------- UI ----------
$('tod').addEventListener('input',e=>{st.hour=+e.target.value;});
$('auto').addEventListener('click',()=>{st.auto=!st.auto;});
$('camBtn').addEventListener('click',cycleCam);
$('menuBtn').addEventListener('click',()=>{st.menu=true;$('menu').hidden=false;});
$('go').addEventListener('click',()=>{st.menu=false;$('menu').hidden=true;startAudio();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&audio.ctx)audio.ctx.suspend();else if(audio.ctx)audio.ctx.resume();});

// ---------- audio (simple engine hum) ----------
const audio={ctx:null};
function startAudio(){
  if(audio.ctx){audio.ctx.resume();return;}
  try{const A=window.AudioContext||window.webkitAudioContext;const ctx=new A(),o=ctx.createOscillator(),o2=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();
    o.type='sawtooth';o2.type='square';f.type='lowpass';f.frequency.value=380;g.gain.value=0;o.connect(f);o2.connect(f);f.connect(g);g.connect(ctx.destination);o.start();o2.start();
    Object.assign(audio,{ctx,o,o2,f,g});}catch(e){}
}
function updateAudio(sp,thr){
  if(!audio.ctx)return;const t=audio.ctx.currentTime,s=clamp(sp/70,0,1.2),base=38+s*95;
  audio.o.frequency.setTargetAtTime(base,t,.08);audio.o2.frequency.setTargetAtTime(base*.5,t,.08);
  audio.f.frequency.setTargetAtTime(260+s*700+Math.abs(thr)*250,t,.1);audio.g.gain.setTargetAtTime(st.sound&&!st.menu?.035+.03*Math.abs(thr):0,t,.1);
}

// ---------- physics ----------
const tmp=new THREE.Vector3();
function step(dt){
  const spec=st.car.spec,topMS=spec.top/3.6;
  const fx=Math.sin(P.h),fz=Math.cos(P.h),lx=Math.cos(P.h),lz=-Math.sin(P.h); // forward and left
  let fs=P.vx*fx+P.vz*fz,ls=P.vx*lx+P.vz*lz;
  const up=out('w')||out('arrowup'),dn=out('s')||out('arrowdown'),L=out('a')||out('arrowleft'),Rr=out('d')||out('arrowright'),brake=out(' ');
  const onRoad=Math.abs(P.x-roadX(P.z))<ROAD_HALF+1.2;
  let acc=0;
  if(up&&!st.menu)acc=spec.acc*clamp(1-fs/topMS,0,1)*(onRoad?1:.7);
  if(dn&&!st.menu){acc=fs>1.5?-20:-spec.acc*.5*clamp(1+fs/12,0,1);}
  if(brake&&!st.menu)acc-=Math.sign(fs)*Math.min(Math.abs(fs)/dt,24);
  const s=(height(P.x+fx*2,P.z+fz*2)-height(P.x-fx*2,P.z-fz*2))/4;
  acc-=9.8*s*.8;
  acc-=fs*(.018+(onRoad?0:.12))+Math.sign(fs)*(onRoad?.5:2.4);
  fs+=acc*dt;if(Math.abs(fs)<.15&&!up&&!dn)fs=0;
  fs=clamp(fs,-12,topMS*1.05);
  // steering: wheel angle shrinks with speed, yaw follows bicycle model
  const target=((L?1:0)-(Rr?1:0))*.62*lerp(1,.2,clamp(Math.abs(fs)/38,0,1));
  P.steer=lerp(P.steer,st.menu?0:target,1-Math.exp(-dt*9));
  const yaw=fs/2.8*Math.tan(P.steer);
  const gripK=(brake?1.1:6.5)*spec.grip;
  ls*=Math.exp(-dt*gripK);
  P.h+=yaw*dt;
  const nfx=Math.sin(P.h),nfz=Math.cos(P.h),nlx=Math.cos(P.h),nlz=-Math.sin(P.h);
  P.vx=nfx*fs+nlx*ls;P.vz=nfz*fs+nlz*ls;
  P.x+=P.vx*dt;P.z+=P.vz*dt;P.odo+=Math.hypot(P.vx,P.vz)*dt;P.speedKmh=Math.hypot(P.vx,P.vz)*3.6;
  P.fs=fs;P.ls=ls;P.acc=acc;
  // ground contact: sample four corners
  const hw=spec.wid/2,hl=spec.wz;
  const pts=[[hl,hw],[hl,-hw],[-hl,hw],[-hl,-hw]].map(([a,b])=>height(P.x+nfx*a+nlx*b,P.z+nfz*a+nlz*b));
  const gy=(pts[0]+pts[1]+pts[2]+pts[3])/4,pitchT=-Math.atan(((pts[0]+pts[1])-(pts[2]+pts[3]))/2/(2*hl)),rollT=Math.atan(((pts[0]+pts[2])-(pts[1]+pts[3]))/2/(2*hw));
  P.y=lerp(P.y,gy,1-Math.exp(-dt*22));P.pitch=lerp(P.pitch,pitchT-acc*.004,1-Math.exp(-dt*8));P.roll=lerp(P.roll,rollT-ls*.004+P.steer*fs*.004,1-Math.exp(-dt*8));
  if(!onRoad&&Math.abs(fs)>4)P.y+=Math.sin(P.odo*3.1)*.02*Math.min(1,fs/20);
}
function placeCar(dt){
  const c=st.car,g=c.group;g.position.set(P.x,P.y,P.z);g.rotation.set(P.pitch,P.h,P.roll,'YXZ');
  P.spin+=(P.fs||0)*dt/c.spec.wr;
  c.wheels.forEach(w=>{w.spin.rotation.x=P.spin;if(w.front)w.pivot.rotation.y=P.steer;});
  const n=Sky.night,auto=st.lights===null?n>.35:st.lights,braking=out(' ')||((out('s')||out('arrowdown'))&&(P.fs||0)>1.5);
  c.headMat.emissiveIntensity=auto?2.2:.2;c.tailMat.emissiveIntensity=braking?2.6:auto?1:.3;
  c.spots.forEach(s=>{s.intensity=auto?2.4:0;s.visible=auto;});
  blob.position.set(P.x,P.y+.06,P.z);blob.rotation.order='YXZ';blob.rotation.set(-Math.PI/2,P.h,0);
}
// ---------- camera ----------
function updateCamera(dt,time){
  const spec=st.car.spec;
  if(st.menu){const a=time*.25,r=spec.len*1.9+3;camera.position.set(P.x+Math.sin(a)*r,P.y+spec.len*.38+1.1,P.z+Math.cos(a)*r);camera.lookAt(P.x,P.y+.8,P.z);camera.fov=lerp(camera.fov,45,.1);camera.updateProjectionMatrix();return;}
  let dh=P.h-P.camH;dh=Math.atan2(Math.sin(dh),Math.cos(dh));P.camH+=dh*(1-Math.exp(-dt*3.2));
  const sp=clamp(P.speedKmh/200,0,1);let pos,look;
  if(st.camMode===2){ // hood view
    const h=P.h;pos=tmp.set(P.x+Math.sin(h)*.4,P.y+spec.body[3][1]+.45,P.z+Math.cos(h)*.4);camera.position.copy(pos);
    camera.lookAt(P.x+Math.sin(h)*30,P.y+spec.body[3][1]+.3+P.pitch*-10,P.z+Math.cos(h)*30);camera.rotateZ(P.roll*.5);
  }else{
    const dist=spec.cam[0]*(st.camMode===1?1.7:1)+sp*2,ht=spec.cam[1]*(st.camMode===1?1.9:1);
    camera.position.set(P.x-Math.sin(P.camH)*dist,0,P.z-Math.cos(P.camH)*dist);
    camera.position.y=Math.max(P.y+ht,height(camera.position.x,camera.position.z)+2.2);
    camera.lookAt(P.x+Math.sin(P.camH)*6,P.y+1.4,P.z+Math.cos(P.camH)*6);
  }
  camera.fov=lerp(camera.fov,60+sp*22+(st.camMode===2?8:0),.08);camera.updateProjectionMatrix();
}
// ---------- HUD ----------
let hudT=0;
function hud(){
  const h=st.hour,hh=Math.floor(h)%24,mm=Math.floor((h-Math.floor(h))*60);
  $('clock').textContent=String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
  const z=P.z,zone=cityW(z)>.5?'City centre':mtnW(z)>.5?'Mountain pass':cityW(z)>.2?'City outskirts':mtnW(z)>.2?'Foothills':'Countryside';
  $('zone').textContent=zone+' · '+Math.round(P.y)+' m';
  $('spd').textContent=Math.round(P.speedKmh);$('odo').textContent=(P.odo/1000).toFixed(1)+' km';
  const a=$('auto');a.textContent='Auto cycle: '+(st.auto?'on':'off');a.setAttribute('aria-pressed',st.auto);
  const sl=$('tod');if(document.activeElement!==sl)sl.value=h;
}
// ---------- loop ----------
let last=performance.now(),time=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;time+=dt;
  if(st.auto){st.hour=(st.hour+dt*.045)%24;}
  step(dt);World.update(P.x,P.z,false);
  Sky.update(st.hour,camera,P,dt);World.setNight(Sky.night);
  placeCar(dt);updateCamera(dt,time);
  updateAudio(P.speedKmh,(out('w')||out('arrowup')?1:0));
  hudT+=dt;if(hudT>.1){hudT=0;hud();}
  renderer.render(scene,camera);requestAnimationFrame(frame);
}
$('go').disabled=true;$('go').textContent='Building the world…';$('menu').hidden=false;
setCar(0,0);
setTimeout(()=>{
  try{World.update(P.x,P.z,true);}catch(err){console.error(err);}
  P.h=Math.atan2((roadX(5)-roadX(-5))/10,1);P.camH=P.h;
  $('go').disabled=false;$('go').textContent='Start driving';last=performance.now();requestAnimationFrame(frame);
},60);
})();
