// Procedural world definition: noise, road path, zone weights and terrain height.
(function(){
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;

function hash(ix,iz){
  let h=(Math.imul(ix,374761393)+Math.imul(iz,668265263))|0;
  h=Math.imul(h^(h>>>13),1274126177);
  return ((h^(h>>>16))>>>0)/4294967295;
}
function vnoise(x,z){
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
  const u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  const a=hash(ix,iz),b=hash(ix+1,iz),c=hash(ix,iz+1),d=hash(ix+1,iz+1);
  return lerp(lerp(a,b,u),lerp(c,d,u),v);
}
function fbm(x,z,oct){
  let s=0,a=.5,f=1,n=0;
  for(let i=0;i<oct;i++){s+=a*vnoise(x*f+i*13.7,z*f-i*7.1);n+=a;a*=.5;f*=2.03;}
  return s/n;
}
// Zone field along the road direction (z). Offset chosen so the drive starts in countryside.
const ZOFF=3.7;
const zoneV=z=>vnoise(z/1500+ZOFF,9.1);
const mtnW=z=>sstep(.50,.76,zoneV(z));
const cityW=z=>sstep(.47,.27,zoneV(z));

const roadX=z=>110*Math.sin(z/420)+55*Math.sin(z/175+1.3)+18*Math.sin(z/68);
const roadH=z=>{
  const m=mtnW(z);
  return (fbm(z/600,3.3,3)-.5)*26*(1-cityW(z)*.8)+m*90+Math.sin(z/110)*5*m+2;
};
function rolling(x,z){return (fbm(x/320,z/320,4)-.5)*70;}
function ridge(x,z){
  const n=fbm(x/380+40,z/380,5);
  return Math.pow(1-Math.abs(n*2-1),1.6)*330+(fbm(x/90,z/90,3)-.5)*40;
}
function height(x,z){
  const rx=roadX(z),d=Math.abs(x-rx),rh=roadH(z);
  const cw=cityW(z),mw=mtnW(z);
  let t=rolling(x,z)+mw*(90+ridge(x,z)*sstep(30,280,d));
  t=lerp(t,rh,cw);
  return lerp(rh,t,sstep(13,58,d));
}
function normal(x,z,out){
  const e=2,hx=height(x+e,z)-height(x-e,z),hz=height(x,z+e)-height(x,z-e);
  const l=Math.hypot(hx,2*e,hz);out.set(-hx/l,2*e/l,-hz/l);return out;
}
window.T={clamp,sstep,lerp,hash,vnoise,fbm,zoneV,mtnW,cityW,roadX,roadH,height,normal,ROAD_HALF:7.2};
})();
