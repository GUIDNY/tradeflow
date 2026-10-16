/* Snow Rush: the mountain. A track is a function of distance s (forward = -Z): a centre line, a width, a fall and
   a row of kickers, all closed-form, so the ground can be asked for anywhere (physics) and meshed in chunks (render). */
(function(ST){
  const {clamp,lerp,smooth,hash2,vnoise}=ST;
  const {scene,renderer,camera,sun,hemi}=ST;

  ST.TRACKS=[
    {id:'bunny',name:'גבעת הארנב',en:'BUNNY HILL',diff:'green',diffName:'ירוק · קל',blurb:'בוקר בהיר, מדרון רחב ונעים. מתחילים כאן.',len:800,vref:12,drag:.0234,slope:.25,halfW:25,bend:[22,8],rampStart:150,rampEvery:150,rampH:[.9,1.3],jump:{Hm:3,face:26,b:.1,Tb:8},redRate:.12,goals:[1800,4200],par:85,net:true,snowfall:.2,
      sky:{zen:0x2f6fcf,mid:0x86bdf0,hor:0xe3f0fb,sun:0xfff7ea,sunDir:[-.30,.50,-.80],fog:0xc3d9ee,fogNear:80,fogFar:420,snow:0xf4f8ff,hemiS:0x9cc4ff,hemiG:0xcfdcf2,hemiI:1.0,sunI:1.6,exp:.9,stars:0,mount:[0xffffff,0x6f86a8],neon:0}},
    {id:'bull',name:'עמק השקיעה',en:'SUNSET VALLEY',diff:'blue',diffName:'כחול · בינוני',blurb:'שקיעה, מדרון נעים וקל לקחת.',len:1050,vref:16,drag:.0166,slope:.30,halfW:21,bend:[30,11],rampStart:140,rampEvery:135,rampH:[1.1,1.6],jump:{Hm:3,face:26,b:.15,Tb:11},redRate:.30,goals:[2500,6000],par:90,net:true,snowfall:.4,
      sky:{zen:0x1d2a78,mid:0xb8509a,hor:0xffa860,sun:0xffd2a2,sunDir:[-.42,.17,-.89],fog:0xe8a9a0,fogNear:55,fogFar:340,snow:0xfaf4ff,hemiS:0x9fb4ff,hemiG:0xd8d2e8,hemiI:.95,sunI:2.0,exp:1.0,stars:0,mount:[0xf2d9e8,0x7e5c8a],neon:0}},
    {id:'bear',name:'הקניון הכחול',en:'BLUE CANYON',diff:'red',diffName:'אדום · מאתגר',blurb:'שעת כחול, קניון צר וקוצי קרח.',len:1300,vref:20,drag:.0124,slope:.34,halfW:17,bend:[44,15],rampStart:130,rampEvery:130,rampH:[1.3,1.9],jump:{Hm:5,face:30,b:.15,Tb:14},redRate:.46,goals:[4500,10500],par:110,net:true,snowfall:.6,
      sky:{zen:0x070f2e,mid:0x2a4f93,hor:0x9ec4f0,sun:0xb8d4ff,sunDir:[.5,.2,-.84],fog:0x8fb2dc,fogNear:40,fogFar:300,snow:0xeaf3ff,hemiS:0x8fb4ff,hemiG:0xcfe0ff,hemiI:.7,sunI:2.0,exp:1.05,stars:.5,mount:[0xdfeaff,0x37507f],neon:0}},
    {id:'ridge',name:'רכס הסופה',en:'WHITEOUT RIDGE',diff:'black',diffName:'שחור · מומחים',blurb:'סופת שלג, ראות נמוכה, מדרון תלול.',len:1400,vref:24,drag:.0104,slope:.40,halfW:15,bend:[48,16],rampStart:125,rampEvery:140,rampH:[1.4,2.0],jump:{Hm:5,face:34,b:.25,Tb:18},redRate:.5,goals:[6000,14000],par:108,net:false,snowfall:1,
      sky:{zen:0x56657c,mid:0x8996ab,hor:0xc9d2dd,sun:0xe8eef7,sunDir:[-.2,.35,-.9],fog:0xbfc9d6,fogNear:22,fogFar:200,snow:0xf1f5fb,hemiS:0xb9c6da,hemiG:0xdfe5ee,hemiI:1.15,sunI:.7,exp:1.0,stars:0,mount:[0xe8eef7,0x5a6678],neon:0}},
    {id:'ipo',name:'פארק הפסגה',en:'SUMMIT PARK',diff:'park',diffName:'פארק · לילה',blurb:'סנופארק: שלושה מסלולי קפיצות, קופסאות ומעקות, חצי צינור ורבע צינור.',len:1500,vref:15,drag:.01565,slope:.26,halfW:28,bend:[12,4],park:true,rampStart:120,rampEvery:120,rampH:[1.6,2.4],jump:{Hm:5,face:34,b:.25,Tb:14},redRate:.5,goals:[8000,19000],par:128,net:true,snowfall:.6,
      sky:{zen:0x030014,mid:0x2b0c5e,hor:0xff2f92,sun:0xff6ad5,sunDir:[-.3,.3,-.9],fog:0x35145f,fogNear:35,fogFar:290,snow:0xcfd0ff,hemiS:0x6a5cff,hemiG:0xff3da0,hemiI:.85,sunI:1.5,exp:1.1,stars:1,mount:[0x7d5cff,0x180a3a],neon:1}}
  ];
  ST.LAB={id:'lab',name:'מעבדת בדיקות',en:'TEST LAB',diff:'green',diffName:'בדיקות',blurb:'מדרון רחב וריק לבדיקת הרוכב והפיזיקה.',len:900,vref:11,slope:.2,halfW:32,bend:[10,4],rampStart:170,rampEvery:150,rampH:[.8,1.2],jump:{Hm:3,face:26,b:.1,Tb:6},redRate:0,goals:[1000,3000],par:120,net:false,snowfall:.1,noItems:true,
    sky:{zen:0x2f6fcf,mid:0x86bdf0,hor:0xe3f0fb,sun:0xfff7ea,sunDir:[-.30,.50,-.80],fog:0xc3d9ee,fogNear:90,fogFar:460,snow:0xf4f8ff,hemiS:0x9cc4ff,hemiG:0xcfdcf2,hemiI:1.0,sunI:1.6,exp:.9,stars:0,mount:[0xffffff,0x6f86a8],neon:0}};

  const L=48, U=64, NU=65, NS=49;           // chunk length (m), half width, columns, rows
  let T=ST.TRACKS[0], cx0=0;
  const S=z=>-z;                              // forward distance from a world z

  const cxRaw=s=>T.bend[0]*Math.sin(s*.0063)+T.bend[1]*Math.sin(s*.0151+2);
  const cx=s=>cxRaw(s)-cx0;
  const dcx=s=>T.bend[0]*.0063*Math.cos(s*.0063)+T.bend[1]*.0151*Math.cos(s*.0151+2);
  const halfW=s=>T.halfW+3.5*Math.sin(s*.011+1);
  const fall=s=>{ const k=T.slope*2.4; return -(T.slope*s)+k*(4.5*Math.sin(s*.021)+2.2*Math.sin(s*.057+1.3)); };
  /* Jumps are built like park table-tops, sized for the speed riders carry on this run: a gentle build-up, the kicker
     (its lip angle is measured in the world, not against the slope), a table, and a landing that falls away about as steeply
     as the flight path comes down, so a jump taken at the run's speed lands on the slope instead of on the flat. All heights
     are added on top of the run's own fall line. */
  const G_W=9.81, BUILD=30, rampCache=new Map();
  function rampAt(k){ let r=rampCache.get(k); if(r) return r;
    const X=T.jumpList?T.jumpList[k]:null; if(T.jumpList&&!X) return null;
    const J=Object.assign({},T.jump||{Hm:3,face:28,b:.15,Tb:12},X||{}), s=X?X.s:T.rampStart+k*T.rampEvery+(hash2(k,11)-.5)*20, h=X?X.h:lerp(T.rampH[0],T.rampH[1],hash2(k,37)), S=T.slope;
    const L=Math.min(16,1.45*h/J.b), b=1.45*h/L;                         // the kicker rises h over L, reaching slope b over the fall line at its lip
    const Hm=X?J.Hm:J.Hm*(.9+hash2(k,53)*.2), e=Math.max(.06,Math.tan(J.face*Math.PI/180)-S), LL=Hm>0?Hm/e:0;
    r={k,s,u:X?X.u:(hash2(k,23)-.5)*halfW(s)*.9,h,w:X&&X.w?X.w:4.6+hash2(k,41)*1.8,L,Hm,Tb:J.Tb,LL,e,lip:Math.atan(b-S),kick:b,v:(J.v||T.vref||14)*.85,face:J.face,gap:J.gap||0,name:J.name||''};
    rampCache.set(k,r); return r; }
  /* every jump whose feature (build-up to the end of its landing) overlaps [sA,sB] */
  function forRamps(sA,sB,fn){
    if(T.jumpList){ for(let k=0;k<T.jumpList.length;k++){ const r=rampAt(k); if(r.s-BUILD<=sB&&r.s+r.L+r.Tb+r.LL+8>=sA) fn(r,k); } return; }
    if(!T.rampEvery) return; const k0=Math.floor((sA-T.rampStart)/T.rampEvery)-1, k1=Math.ceil((sB-T.rampStart)/T.rampEvery)+1;
    for(let k=Math.max(0,k0);k<=k1;k++){ const r=rampAt(k); if(r.s>=T.len) break; if(r.s-BUILD<=sB&&r.s+r.L+r.Tb+r.LL+8>=sA) fn(r,k); } }   // none past the finish line
  /* the table and its landing: flat over the fall line, then a straight face at the landing angle, knuckle and runout rounded */
  const sr=(u,rad)=>(u+Math.sqrt(u*u+rad*rad))/2;
  function tableProfile(d,r){ if(d<-BUILD||d>r.L+r.Tb+r.LL+8) return 0; if(d<=0) return r.Hm*smooth(-BUILD,0,d);
    const K=r.L+r.Tb, R0=3; let y=Math.max(0,r.Hm-r.e*(sr(d-K,R0)-sr(d-K-r.LL,R0)));
    if(r.gap&&d>r.L+1.5&&d<K-1){ const u=(d-r.L-1.5)/(K-1-r.L-1.5); y-=r.gap*Math.pow(Math.sin(Math.PI*u),.35); }   // the gap between takeoff and landing
    return y; }
  function kickProfile(d,r){ if(d<=0) return 0; if(d<r.L) return r.h*Math.pow(d/r.L,1.45); const B=Math.max(1.2,r.h*.9); return d<r.L+B?r.h*(1-smooth(r.L,r.L+B,d)):0; }
  function rampProfile(d,r){ return tableProfile(d,r)+kickProfile(d,r); }      // height over the fall line, d metres past the start of the kicker
  function rampH(u,s){   // the table's sides fall away at ~30 degrees at most (2.6 m out per metre of height)
    let tab=0, kick=0;   // tables side by side do not stack: the higher one wins
    forRamps(s,s,r=>{ const d=s-r.s, du=Math.abs(u-r.u); tab=Math.max(tab,tableProfile(d,r)*(1-smooth(r.w+.5,r.w+.5+2.6*Math.max(1,r.Hm),du))); kick+=kickProfile(d,r)*(1-smooth(r.w-1.5,r.w+1.5,du)); });
    return tab+kick; }
  /* the kicker whose lip is just ahead (for the pop window), or null */
  function lipNear(s,x,ahead,behind){ let hit=null; forRamps(s,s,r=>{ const d=s-r.s; if(!hit&&d>r.L-(ahead||1.6)&&d<r.L+(behind||.4)&&Math.abs(cx(s)+r.u-x)<r.w) hit={r,d}; }); return hit; }
  /* the lip speeds that land cleanly on this jump with an ordinary pop (2.4 m/s): found once by flying the jump at each speed */
  function jumpWindow(r){ if(r.win) return r.win; const S=T.slope, tl=Math.tan(r.lip); let lo=null, hi=null;
    for(let v=4;v<=32;v+=.5){ const vy=v*tl+2.4; let t=0, x=0, y=0, gy=0;
      for(let i=0;i<400;i++){ t+=.01; x=v*t; y=r.Hm+r.h+vy*t-.5*G_W*t*t+S*x; gy=rampProfile(r.L+x,r); if(y<gy) break; }
      const e=.05, ts=(rampProfile(r.L+x+e,r)-rampProfile(r.L+x-e,r))/(2*e)-S, vyw=vy-G_W*t, n=Math.hypot(ts,1), imp=-(v*-ts+vyw)/n;
      if(imp<7){ if(lo===null) lo=v; hi=v; } }
    return r.win={lo:lo||0,hi:hi||0}; }
  /* where a rider launched from this kicker's lip at its design speed flies (for coins): points every dt seconds until it lands */
  function flightLine(r,n){ const pts=[], v=r.v, vy=v*Math.tan(r.lip)+2.6; let x=0,y=r.Hm+r.h,t=0; const S=T.slope;
    for(let i=0;i<200;i++){ t+=.05; x=v*t; y=r.Hm+r.h+vy*t-.5*G_W*t*t+S*x; const gy=rampProfile(r.L+x,r); if(y<gy){ break; } pts.push({d:r.L+x,above:y-gy}); }
    const out=[]; for(let i=1;i<=n;i++){ const p=pts[Math.floor(i*(pts.length-1)/(n+1))]; if(p) out.push(p); } return out; }
  let sites=[];
  function baseGround(x,z){
    const s=S(z), c=cx(s), u=x-c, Vg=ST.Village, w=Vg?Vg.width(s,halfW(s)):halfW(s), a=Math.abs(u)-w, vk=Vg?Vg.k(s):0;
    let y=vk>0?Vg.floor(s):fall(s);
    if(a>0) y+=a*a*.05+a*.18;
    // the noise is rougher off the run than on it (a park and the village floor are groomed smoother); the change is blended
    // over a few metres so the run's edge is a slope, not a step
    const off=smooth(-1.5,4,a), inK=(T.park?.35:1)*(1-.85*vk), in2=(T.park?.3:1)*(1-.7*vk);
    y+=vnoise(x*.02,z*.02)*lerp(1.5*inK,3.2,off)+vnoise(x*.1,z*.1)*lerp(.16*in2,.5,off);
    return y+rampH(u,s)+(ST.Park?ST.Park.terrain(s,u):0);
  }
  function groundY(x,z){ let y=baseGround(x,z); if(sites.length){ const s=S(z); for(let i=0;i<sites.length;i++){ const t=sites[i], dx=x-(cx(t.s)+t.u), dz=s-t.s, d=Math.hypot(dx,dz); if(d<t.r+9){ const m=1-smooth(t.r-2,t.r+9,d); y=y+(t.y-y)*m; } } } return y; }
  function setSites(list){ sites=[]; list.forEach(t=>{ const x=cx(t.s)+t.u, z=-t.s; sites.push({s:t.s,u:t.u,r:t.r,y:baseGround(x,z)}); }); }
  const _n=new THREE.Vector3();
  function groundN(x,z,out){ const e=.6, hx=groundY(x+e,z)-groundY(x-e,z), hz=groundY(x,z+e)-groundY(x,z-e); out=out||_n; return out.set(-hx,2*e,-hz).normalize(); }

  /* ---------- shared materials ---------- */
  function snowNormalMap(){
    const N=256,c=document.createElement('canvas'); c.width=c.height=N; const g=c.getContext('2d'), im=g.createImageData(N,N), h=new Float32Array(N*N);
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ let v=0,a=.5,f=8; for(let o=0;o<4;o++){ v+=a*vnoise((x/N)*f%f+o*7.1,(y/N)*f+o*3.3)*0+a*tile(x/N*f,y/N*f,f,o); a*=.5; f*=2; } h[y*N+x]=v; }
    function tile(x,y,p,o){ const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,m=v=>((v%p)+p)%p; const a=hash2(m(xi)+o*91,m(yi)),b=hash2(m(xi+1)+o*91,m(yi)),c2=hash2(m(xi)+o*91,m(yi+1)),d=hash2(m(xi+1)+o*91,m(yi+1)); const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf); return (a+(b-a)*u+(c2-a)*v+(a-b-c2+d)*u*v)*2-1; }
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const dx=h[y*N+(x+1)%N]-h[y*N+(x+N-1)%N], dy=h[((y+1)%N)*N+x]-h[((y+N-1)%N)*N+x], i=(y*N+x)*4;
      im.data[i]=clamp(128-dx*220,0,255); im.data[i+1]=clamp(128-dy*220,0,255); im.data[i+2]=235; im.data[i+3]=255; }
    g.putImageData(im,0,0); const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=renderer.capabilities.getMaxAnisotropy(); return t;
  }
  const SNOW_UNI={uSparkle:{value:1},uGlowK:{value:0}};
  function snowPatch(sh){
    Object.assign(sh.uniforms,SNOW_UNI);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP; attribute float aGroom; varying float vGroom; attribute float aGlow; varying float vGlow;').replace('#include <begin_vertex>','#include <begin_vertex>\n vWP=(modelMatrix*vec4(transformed,1.0)).xyz; vGroom=aGroom; vGlow=aGlow;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vWP; varying float vGroom; uniform float uSparkle; varying float vGlow; uniform float uGlowK;
      float sh1(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      { float dd=length(vViewPosition); float fade=vGroom*smoothstep(70.,6.,dd); float st=sin(vWP.x*30.0+sin(vWP.z*.07)*5.0)*.6+sin(vWP.x*61.0+1.3)*.4; normal=normalize(normal+vec3(st*.11*fade,0.,0.)); diffuseColor.rgb*=1.-.045*st*fade; }`)
      .replace('vec3 outgoingLight =',`{
        vec2 cell=floor(vWP.xz*34.0); float k=sh1(cell);
        vec3 vd=normalize(cameraPosition-vWP);
        float ph=dot(vd,vec3(sh1(cell+3.1)-.5,.35,sh1(cell+7.7)-.5))*95.0+k*60.0;
        float gl=step(.972,k)*pow(max(sin(ph),0.0),22.0);
        reflectedLight.directSpecular+=vec3(gl*1.6*uSparkle);
        totalEmissiveRadiance+=vec3(1.,.58,.26)*vGlow*uGlowK;   // pools of lamplight on the village snow after dark
      }
      vec3 outgoingLight =`);
  }
  const normalMap=snowNormalMap();
  const terrainMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:0,normalMap,normalScale:new THREE.Vector2(.55,.55),envMapIntensity:.7});
  terrainMat.onBeforeCompile=snowPatch;

  function mergeGeos(list){
    let np=0,ni=0; list.forEach(g=>{ np+=g.attributes.position.count; ni+=g.index?g.index.count:g.attributes.position.count; });
    const pos=new Float32Array(np*3),nor=new Float32Array(np*3),col=new Float32Array(np*3),idx=new Uint32Array(ni); let po=0,io=0;
    list.forEach(g=>{ const p=g.attributes.position, n=g.attributes.normal, c=g.attributes.color, cnt=p.count;
      pos.set(p.array,po*3); nor.set(n.array,po*3); if(c) col.set(c.array,po*3); else col.fill(1,po*3,(po+cnt)*3);
      if(g.index){ for(let i=0;i<g.index.count;i++) idx[io+i]=g.index.array[i]+po; io+=g.index.count; } else { for(let i=0;i<cnt;i++) idx[io+i]=po+i; io+=cnt; }
      po+=cnt; });
    const m=new THREE.BufferGeometry(); m.setAttribute('position',new THREE.BufferAttribute(pos,3)); m.setAttribute('normal',new THREE.BufferAttribute(nor,3)); m.setAttribute('color',new THREE.BufferAttribute(col,3)); m.setIndex(new THREE.BufferAttribute(idx,1)); return m;
  }
  function paint(g,fn){ const p=g.attributes.position, c=new Float32Array(p.count*3), col=new THREE.Color(); for(let i=0;i<p.count;i++){ fn(p.getX(i),p.getY(i),p.getZ(i),col,i); c[i*3]=col.r; c[i*3+1]=col.g; c[i*3+2]=col.b; } g.setAttribute('color',new THREE.BufferAttribute(c,3)); return g; }

  /* pine: trunk + three snow-dusted tiers, one merged geometry, instanced per chunk */
  function pineGeo(){
    const parts=[], trunk=new THREE.CylinderGeometry(.22,.34,2.2,7); trunk.translate(0,1.1,0); paint(trunk,(x,y,z,c)=>c.setRGB(.2,.12,.08)); parts.push(trunk);
    [[3.3,5.4,1.8],[2.7,4.8,4.0],[1.9,4.0,6.0]].forEach(([r,h,y0],i)=>{
      const g=new THREE.ConeGeometry(r,h,9,3); g.translate(0,y0+h/2,0);
      paint(g,(x,y,z,c)=>{ const t=(y-y0)/h, n=hash2(Math.round(x*9),Math.round(z*9))*.12; const snow=smooth(.38,.78,t+Math.hypot(x,z)/r*-.25+n);
        c.setRGB(.05+n*.5,.2+n,.14+n*.6).lerp(new THREE.Color(.92,.95,1),snow*.85); }); parts.push(g); });
    return mergeGeos(parts);
  }
  function rockGeo(){ const g=new THREE.IcosahedronGeometry(1,1); const p=g.attributes.position; for(let i=0;i<p.count;i++){ const x=p.getX(i),y=p.getY(i),z=p.getZ(i), k=1+hash2(Math.round(x*7),Math.round(z*7+y*3))*.45; p.setXYZ(i,x*k*1.25,y*k*.8,z*k); }
    g.computeVertexNormals(); return paint(g,(x,y,z,c)=>{ const s=smooth(.15,.65,y); c.setRGB(.26,.25,.3).lerp(new THREE.Color(.93,.95,1),s*.9); }); }
  function firGeo(){
    const parts=[], trunk=new THREE.CylinderGeometry(.16,.24,2.6,6); trunk.translate(0,1.3,0); paint(trunk,(x,y,z,c)=>c.setRGB(.17,.1,.07)); parts.push(trunk);
    for(let i=0;i<6;i++){ const r=2.1-i*.3, h=2.9, y0=1.6+i*1.45; const g=new THREE.ConeGeometry(r,h,8,2); g.translate(0,y0+h/2,0);
      paint(g,(x,y,z,c)=>{ const t=(y-y0)/h, n=hash2(Math.round(x*8)+i,Math.round(z*8))*.1; const snow=smooth(.15,.7,t-Math.hypot(x,z)/r*.2+n+i*.02);
        c.setRGB(.04+n*.4,.14+n,.12+n*.5).lerp(new THREE.Color(.93,.96,1),snow*.9); }); parts.push(g); }
    return mergeGeos(parts);
  }
  const GEO={pine:pineGeo(),fir:firGeo(),rock:rockGeo()};
  const MATS={tree:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0}),
    coin:new THREE.MeshStandardMaterial({color:0xffc83a,metalness:.9,roughness:.25,emissive:0xff9d00,emissiveIntensity:.9}),
    green:new THREE.MeshStandardMaterial({color:0x2fd6ff,roughness:.2,metalness:.1,emissive:0x1ab8ff,emissiveIntensity:1.4}),
    red:new THREE.MeshStandardMaterial({color:0xff5a1e,roughness:.35,metalness:.1,emissive:0xff3a10,emissiveIntensity:1.2}),
    wickG:new THREE.MeshBasicMaterial({color:0xd8f6ff}), wickR:new THREE.MeshBasicMaterial({color:0xffd2b8}),
    metal:new THREE.MeshStandardMaterial({color:0x2a2f3a,metalness:.7,roughness:.35})};
  const coinGeo=new THREE.CylinderGeometry(.62,.62,.14,24); coinGeo.rotateZ(Math.PI/2);
  const candleGeoCache={};
  function candleGeo(h,red){ const k=Math.round(h*4)+(red?1000:0); if(candleGeoCache[k]) return candleGeoCache[k];   // green: an ice crystal to collect; red: an ice spike to avoid
    const b=red?new THREE.ConeGeometry(.75,h,6):new THREE.OctahedronGeometry(1,0); if(!red) b.scale(.75,h/2,.75); b.translate(0,h/2,0);
    const w=new THREE.CylinderGeometry(.35,.6,.25,6); w.translate(0,.1,0); return candleGeoCache[k]={b,w}; }

  /* billboards: glowing ticker panels */
  const BB=[]; function makeBoards(){
    const words=['CARVE','FRESH POWDER','BIG AIR','SEND IT','ALPINE','FLOW'], subs=['אלפיני · גולשים בסטייל','אבק שלג טרי','קפיצה גדולה','יאללה לרדת','פסגות ושקט','זורמים עם ההר'];
    for(let i=0;i<6;i++){ const c=document.createElement('canvas'); c.width=512; c.height=256; const g=c.getContext('2d');
      const gr=g.createLinearGradient(0,0,0,256); gr.addColorStop(0,'#0a1b3a'); gr.addColorStop(1,i%2?'#12486e':'#2b1b4f'); g.fillStyle=gr; g.fillRect(0,0,512,256);
      // a mountain range behind the words
      g.fillStyle='rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(0,256); let px=0; while(px<=512){ g.lineTo(px,150+hash2(i*7+px,3)*70-(px>120&&px<400?40:0)); px+=48; } g.lineTo(512,256); g.closePath(); g.fill();
      g.fillStyle='rgba(255,255,255,.28)'; g.beginPath(); g.moveTo(300,256); g.lineTo(400,120); g.lineTo(500,256); g.closePath(); g.fill();
      g.fillStyle='#fff'; g.font='900 '+(words[i].length>8?44:64)+'px "Arial Black",Impact,sans-serif'; g.textAlign='left'; g.fillText(words[i],18,84);
      g.fillStyle='#ffd24a'; g.font='800 32px "Arial Black",sans-serif'; g.fillText(subs[i],18,136);
      g.strokeStyle='#8fd8ff'; g.lineWidth=6; g.strokeRect(3,3,506,250);
      const t=new THREE.CanvasTexture(c); t.anisotropy=4; t.encoding=THREE.sRGBEncoding; BB.push(t); }
  }
  makeBoards();
  function bannerTex(l1,l2){ const c=document.createElement('canvas'); c.width=1024; c.height=256; const g=c.getContext('2d');
    const gr=g.createLinearGradient(0,0,1024,0); gr.addColorStop(0,'#ff3d8b'); gr.addColorStop(.5,'#ffb020'); gr.addColorStop(1,'#16e08a'); g.fillStyle=gr; g.fillRect(0,0,1024,256);
    g.fillStyle='rgba(0,0,0,.78)'; g.fillRect(14,14,996,228); g.textAlign='center'; g.fillStyle='#fff'; g.font='900 104px "Arial Black",Impact,sans-serif'; g.fillText(l1,512,128);
    g.fillStyle='#ffd24a'; g.font='800 52px "Arial Black",sans-serif'; g.fillText(l2,512,206); const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=4; return t; }

  /* ---------- chunks ---------- */
  const chunks=new Map();                     // index -> {group,items,idx}
  const world=new THREE.Group(); scene.add(world);
  const ctx={snow:new THREE.Color()};

  const _st=new THREE.Color();
  function buildChunk(ci){
    const grp=new THREE.Group(), items=[], s0=ci*L, VG=ST.Village&&ST.Village.T===T?ST.Village:null;
    // terrain
    const pos=new Float32Array(NU*NS*3), col=new Float32Array(NU*NS*3), uv=new Float32Array(NU*NS*2), nor=new Float32Array(NU*NS*3), groom=new Float32Array(NU*NS), glow=new Float32Array(NU*NS);
    const snow=ctx.snow, cA=new THREE.Color(), cR=new THREE.Color(0x4a4655), n=new THREE.Vector3();
    for(let j=0;j<NS;j++){ const s=s0+j*(L/(NS-1)); const c=cx(s);
      for(let i=0;i<NU;i++){ const u=-U+i*(2*U/(NU-1)), x=c+u, z=-s, y=groundY(x,z), o=j*NU+i;
        pos[o*3]=x; pos[o*3+1]=y; pos[o*3+2]=z; uv[o*2]=x/6; uv[o*2+1]=z/6;
        groundN(x,z,n); const a=Math.abs(u)-halfW(s), steep=smooth(.62,.86,1-n.y), nz=vnoise(x*.05,z*.05)*.04;
        cA.copy(snow).multiplyScalar(.93+nz+n.y*.07); cA.lerp(cR,steep*.75);
        if(a>0) cA.multiplyScalar(1-smooth(0,26,a)*.16);
        let gm=1-smooth(-4,1.5,a);
        if(VG){ const vk=VG.k(s); if(vk>0){ gm*=1-smooth(.3,.9,vk); const sh=VG.shade(s,u);   // village: no corduroy, packed streets, wall shadows, lamp light
            if(sh.k>0){ const pn=vnoise(x*.35,z*.35)*.5+.5; cA.multiply(_st.setRGB(1-.15*sh.k-.1*sh.k*pn,1-.15*sh.k-.09*sh.k*pn,1-.12*sh.k-.06*sh.k*pn)); }
            if(sh.ao>0) cA.multiplyScalar(1-sh.ao);
            glow[o]=Math.min(1.4,sh.glow); } }
        groom[o]=gm; col[o*3]=cA.r; col[o*3+1]=cA.g; col[o*3+2]=cA.b; nor[o*3]=n.x; nor[o*3+1]=n.y; nor[o*3+2]=n.z; } }
    const idx=new Uint32Array((NU-1)*(NS-1)*6); let k=0;
    for(let j=0;j<NS-1;j++) for(let i=0;i<NU-1;i++){ const a=j*NU+i,b=a+1,c=a+NU,d=c+1; idx[k++]=a; idx[k++]=b; idx[k++]=c; idx[k++]=b; idx[k++]=d; idx[k++]=c; }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.BufferAttribute(nor,3)); g.setAttribute('color',new THREE.BufferAttribute(col,3)); g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.setAttribute('aGroom',new THREE.BufferAttribute(groom,1)); g.setAttribute('aGlow',new THREE.BufferAttribute(glow,1)); g.setIndex(new THREE.BufferAttribute(idx,1));
    g.computeBoundingSphere();
    const mesh=new THREE.Mesh(g,terrainMat); mesh.receiveShadow=true; grp.add(mesh);

    // trees + rocks (instanced)
    const trees=[], rocks=[];
    for(let n2=0;n2<150;n2++){ const s=s0+hash2(ci,n2*3+1)*L, w=halfW(s), side=hash2(ci,n2*3+2)<.5?-1:1, off=w+6+Math.pow(hash2(ci,n2*3+3),1.4)*(U-w-9), u=side*off;
      const dense=1-smooth(0,28,off-w); if(hash2(ci*7,n2)>.25+dense*.7*0+ (off<w+14?.5:.35)) continue;
      if(ST.Resort&&ST.Resort.blocked(s,u)||VG&&VG.blocked(s,u)) continue; const x=cx(s)+u, z=-s, y=groundY(x,z); trees.push({x,y:y-.2,z,sc:.5+hash2(ci,n2+500)*.7+(off>w+18?.35:0),r:hash2(ci,n2+900)*6.28}); }
    if(VG){ const ex=[]; VG.extraTrees(s0,L,ex); ex.forEach((t,i)=>{ if(ST.Resort&&ST.Resort.blocked(t.s,t.u)) return; const x=cx(t.s)+t.u, z=-t.s; trees.push({x,y:groundY(x,z)-.2,z,sc:t.sc,r:hash2(ci,i+1300)*6.28}); }); }
    for(let n2=0;n2<9;n2++){ const s=s0+hash2(ci,n2*5+700)*L, w=halfW(s), side=hash2(ci,n2*5+701)<.5?-1:1, u=side*(w*.8+hash2(ci,n2*5+702)*14);
      if(ST.Resort&&ST.Resort.blocked(s,u)||VG&&VG.blocked(s,u)) continue; const x=cx(s)+u, z=-s; rocks.push({x,y:groundY(x,z)-.15,z,sc:.9+hash2(ci,n2+333)*1.8,r:hash2(ci,n2+444)*6.28}); }
    // contact shadows: snow darkens (and cools) under every tree and rock
    { const ds=L/(NS-1), du=2*U/(NU-1), blob=(x,z,rad,k)=>{ const s=-z, j0=Math.round((s-s0)/ds), c=cx(s), i0=Math.round((x-c+U)/du), rj=Math.ceil(rad/ds)+1, ri=Math.ceil(rad/du)+1;
        for(let j=j0-rj;j<=j0+rj;j++){ if(j<0||j>=NS) continue; for(let i=i0-ri;i<=i0+ri;i++){ if(i<0||i>=NU) continue; const o=j*NU+i, px=pos[o*3], pz=pos[o*3+2], d=Math.hypot(px-x,pz-z); if(d>=rad) continue; const f=(1-d/rad), m=1-k*f*f*(3-2*f);
            col[o*3]*=m*.97; col[o*3+1]*=m*.985; col[o*3+2]*=Math.min(1,m*1.02); } } };
      trees.forEach(t=>blob(t.x,t.z,3.4*t.sc+.8,.38)); rocks.forEach(t=>blob(t.x,t.z,t.sc*1.5+.8,.3)); g.attributes.color.needsUpdate=true; }
    { const nG=T.id==='ridge'?4:T.id==='bear'?3:T.id==='ipo'?3:T.id==='bull'?2:1; for(let n2=0;n2<nG;n2++){ const s=s0+hash2(ci,n2*11+900)*L, w=halfW(s), side=hash2(ci,n2*11+901)<.5?-1:1, u=side*(w+14+hash2(ci,n2*11+902)*34), x=cx(s)+u, z=-s, sc=6+hash2(ci,n2*11+903)*12;
        if(ST.Resort&&ST.Resort.blocked(s,u)||VG&&VG.blocked(s,u)) continue; rocks.push({x,y:groundY(x,z)-sc*.25,z,sc,sy:1.5+hash2(ci,n2*11+904)*1.3,r:hash2(ci,n2*11+905)*6.28,giant:1}); } }
    const dummy=new THREE.Object3D();
    if(trees.length){ const firs=trees.filter((t,i)=>hash2(i,ci+77)<.45), pines=trees.filter((t,i)=>!(hash2(i,ci+77)<.45));
      [[GEO.pine,pines],[GEO.fir,firs]].forEach(([geo,arr])=>{ if(!arr.length) return; const im=new THREE.InstancedMesh(geo,MATS.tree,arr.length); arr.forEach((t,i)=>{ dummy.position.set(t.x,t.y,t.z); dummy.rotation.set(0,t.r,0); const k=geo===GEO.fir?t.sc*1.05:t.sc; dummy.scale.set(k*(geo===GEO.fir?.9:1),k*(.9+hash2(i,ci)*.45)*(geo===GEO.fir?1.25:1),k*(geo===GEO.fir?.9:1)); dummy.updateMatrix(); im.setMatrixAt(i,dummy.matrix); }); im.castShadow=true; im.receiveShadow=true; im.frustumCulled=false; grp.add(im); }); trees.forEach(t=>{ if(Math.abs(t.x-cx(-t.z))<halfW(-t.z)+7) items.push({type:'tree',x:t.x,z:t.z,y:t.y,r:.8*t.sc}); }); }
    if(rocks.length&&ASSET.rocks.length){ const groups=ASSET.rocks.map(()=>[]); rocks.forEach(t=>{ const pick=t.giant?(hash2(t.x|0,t.z|0)<.5?3:2):(hash2(t.x|0,(t.z|0)+5)<.5?0:1); groups[pick%ASSET.rocks.length].push(t); });
      groups.forEach((arr,gi)=>{ if(!arr.length) return; const A=ASSET.rocks[gi], im=new THREE.InstancedMesh(A.geo,A.mat,arr.length); arr.forEach((t,i)=>{ dummy.position.set(t.x,t.y,t.z); dummy.rotation.set(0,t.r,0); const k=t.giant?(A.name==='rock_face_01'?3.2:2.4):2.3, sy=t.giant?(t.sy||1)*.9:1; dummy.scale.set(t.sc*k,t.sc*k*sy,t.sc*k); dummy.updateMatrix(); im.setMatrixAt(i,dummy.matrix); }); im.castShadow=true; im.receiveShadow=true; im.frustumCulled=false; grp.add(im); });
      rocks.forEach(t=>{ if(!t.giant&&Math.abs(t.x-cx(-t.z))<halfW(-t.z)+2) items.push({type:'rock',x:t.x,z:t.z,y:t.y,r:1.1*t.sc}); }); }
    else if(rocks.length){ const im=new THREE.InstancedMesh(GEO.rock,MATS.tree,rocks.length); rocks.forEach((t,i)=>{ dummy.position.set(t.x,t.y,t.z); dummy.rotation.set(0,t.r,0); dummy.scale.set(t.sc,t.sc*(t.sy||1),t.sc); dummy.updateMatrix(); im.setMatrixAt(i,dummy.matrix); });
      im.castShadow=true; im.receiveShadow=true; im.frustumCulled=false; grp.add(im); rocks.forEach(t=>{ if(!t.giant&&Math.abs(t.x-cx(-t.z))<halfW(-t.z)+2) items.push({type:'rock',x:t.x,z:t.z,y:t.y,r:1.1*t.sc}); }); }

    // pickups and hazards: one pattern per 24 m cell
    const cellL=24, c0=Math.floor(s0/cellL);
    for(let cc=c0;cc<c0+L/cellL;cc++){ const s=cc*cellL; if(s<70||s>T.len-40) continue;
      let near=!!(ST.Park&&ST.Park.busy(s)); forRamps(s-4,s+2,()=>{ near=true; });
      const w=halfW(s), roll=hash2(cc,77); if(near||T.noItems) continue;
      const put=(type,sOff,u,extra)=>{ const ss=s+sOff, x=cx(ss)+clamp(u,-w+2.2,w-2.2), z=-ss; items.push(Object.assign({type,x,z,y:groundY(x,z)},extra||{})); };
      if(roll<.20){ const ph=hash2(cc,5)*6.28; for(let i=0;i<8;i++) put('coin',i*2.6,Math.sin(ph+i*.55)*w*.45,{air:.9}); }
      else if(roll<.38){ const u0=(hash2(cc,6)-.5)*w*1.0; for(let i=0;i<3;i++) put('green',i*6,u0+(i-1)*3.4,{h:2.2+i*1.3+hash2(cc,i)*.6}); }
      else if(roll<.38+T.redRate*.32){ const u0=(hash2(cc,9)-.5)*w*.7; put('red',0,u0-4.5,{h:2.6+hash2(cc,1)*2}); put('red',9,u0+4.5,{h:2.6+hash2(cc,2)*2}); if(hash2(cc,3)>.5) put('red',17,u0-.5,{h:2+hash2(cc,4)*2}); }
      else if(roll<.80){ const u0=(hash2(cc,13)>.5?1:-1)*w*.55; put('rockhaz',2,u0,{r:1.5}); if(hash2(cc,14)>.5) put('coin',-2,-u0*.4,{air:.9}); if(hash2(cc,15)>.55) put('coin',3,-u0*.4,{air:.9}); }
    }
    // coins floating over every kicker (the line a clean jump flies)
    if(!T.noItems) forRamps(s0,s0+L,r=>{ if(r.s+r.L<s0||r.s+r.L>=s0+L) return;
        flightLine(r,7).forEach(p=>{ const ss=r.s+p.d, x=cx(ss)+r.u, z=-ss; items.push({type:'coin',x,z,y:groundY(x,z),air:p.above+.9,big:true}); }); });
    // gates and boards
    if(s0<=10&&s0+L>10){ addArch(grp,10,'SNOW RUSH','קו הזינוק · יאללה לרדת'); }
    if(s0<=T.len&&s0+L>T.len){ addArch(grp,T.len,'FINISH','קו הסיום · עוד ריצה?'); items.push({type:'finish',x:cx(T.len),z:-T.len,y:groundY(cx(T.len),-T.len),r:30}); }
    for(let bs=Math.ceil((s0-60)/170)*170+90; bs<s0+L+60; bs+=170){ if(bs<s0||bs>=s0+L||bs>T.len) continue; const side=Math.floor(bs/170)%2?1:-1, u=side*(halfW(bs)+4.5), x=cx(bs)+u, z=-bs, y=groundY(x,z);
      const m=new THREE.Mesh(new THREE.PlaneGeometry(14,7),new THREE.MeshBasicMaterial({map:BB[Math.floor(bs/170)%BB.length],toneMapped:false}));
      const post=new THREE.Mesh(new THREE.BoxGeometry(.5,9,.5),MATS.metal); const pg=new THREE.Group(); pg.position.set(x,y,z); post.position.set(0,4,-.4); m.position.set(0,8.4,0); pg.lookAt(cx(bs),y+8.4,-bs); pg.rotation.set(0,pg.rotation.y,0); pg.add(post,m); const post2=post.clone(); post2.position.x=4.5; const post3=post.clone(); post3.position.x=-4.5; pg.add(post2,post3); grp.add(pg); }
    // item meshes (coins: one instanced mesh for the whole chunk, spun and hidden per instance by updateCoins)
    const coins=[];
    items.forEach(it=>{
      if(it.type==='coin'){ it.y+=it.air||1; it.r=1.7; coins.push(it); }
      else if(it.type==='green'||it.type==='red'){ const G=candleGeo(it.h,it.type==='red'), gm=new THREE.Group(); const b=new THREE.Mesh(G.b,it.type==='green'?MATS.green:MATS.red), w=new THREE.Mesh(G.w,it.type==='green'?MATS.wickG:MATS.wickR); b.castShadow=true; b.userData.dyn=w.userData.dyn=1; gm.add(b,w); gm.position.set(it.x,it.y,it.z); it.mesh=gm; it.r=it.type==='green'?2.1:1.35; grp.add(gm);
        const bm=it.type==='green'?MATS.green:MATS.red; } 
      else if(it.type==='rockhaz'){ const A=ASSET.rocks.length?ASSET.rocks[hash2(it.x|0,it.z|0)<.5?0:1]:null; const m=new THREE.Mesh(A?A.geo:GEO.rock,A?A.mat:MATS.tree); m.position.set(it.x,it.y-.1,it.z); m.scale.setScalar(A?it.r*2.4:it.r*1.1); m.rotation.y=hash2(it.x|0,it.z|0)*6; m.castShadow=true; m.receiveShadow=true; grp.add(m); }
    });
    if(coins.length){ const im=new THREE.InstancedMesh(coinGeo,MATS.coin,coins.length); im.userData.dyn=1; im.castShadow=true; im.frustumCulled=false; coins.forEach((it,i)=>{ it.im=im; it.ii=i; }); grp.add(im); grp.userData.coins=coins; }
    if(ST.Resort) ST.Resort.chunk(ci,grp,items,s0,L);
    const baked=ST.bakeStatic(grp);
    world.add(grp); return {group:grp,items,geo:g,idx:ci,baked};
  }
  function addArch(grp,s,l1,l2){ const w=halfW(s)+2, x=cx(s), z=-s, y=groundY(x,z), tex=bannerTex(l1,l2);
    [-1,1].forEach(sd=>{ const p=new THREE.Mesh(new THREE.BoxGeometry(1,15,1),MATS.metal); p.position.set(x+sd*w,groundY(x+sd*w,z)+7,z); p.castShadow=true; grp.add(p); });
    const bw=Math.min(w*2,24), b=new THREE.Mesh(new THREE.PlaneGeometry(bw,bw/4),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,toneMapped:false})); b.position.set(x,y+11.2,z); grp.add(b);
    const bar=new THREE.Mesh(new THREE.BoxGeometry(w*2+1,.6,.8),MATS.metal); bar.position.set(x,y+13.1,z); grp.add(bar); }
  function disposeChunk(c){ if(ST.Resort) ST.Resort.disposeChunk(c.idx); world.remove(c.group); c.group.traverse(o=>{ if(o===c.group) return; if(o.geometry&&o.geometry===c.geo) o.geometry.dispose(); }); (c.baked||[]).forEach(g=>g.dispose()); }

  let lastKey=null;
  /* chunks from `back` behind to `ahead` in front of s (the run looks downhill; the village menu looks both ways) */
  function update(playerS,force,back,ahead){
    const ci=Math.floor(playerS/L), b=back==null?1:back, a=ahead==null?7:ahead, key=ci+':'+b+':'+a; if(!force&&key===lastKey) return; lastKey=key;
    const want=new Set(); for(let i=ci-b;i<=ci+a;i++){ if(i<-1||i*L>T.len+250) continue; want.add(i); }
    want.forEach(i=>{ if(!chunks.has(i)) chunks.set(i,buildChunk(i)); });
    chunks.forEach((c,i)=>{ if(!want.has(i)){ disposeChunk(c); chunks.delete(i); } });
  }
  const _cm=new THREE.Matrix4(), _cq=new THREE.Quaternion(), _cp=new THREE.Vector3(), _cs=new THREE.Vector3(), _cy=new THREE.Vector3(0,1,0);
  function updateCoins(t,cam,s){ const ci=Math.floor(s/L); for(let i=ci-1;i<=ci+3;i++){ const c=chunks.get(i); if(!c||!c.group.userData.coins) continue; const list=c.group.userData.coins; let im=null;
      for(const it of list){ im=it.im; const dx=it.x-cam.x, dy=it.y-cam.y, dz=it.z-cam.z, hide=it.dead||dx*dx+dy*dy+dz*dz<3.2*3.2, k=hide?0:(it.big?1.05:.85);   // coins the lens flies through would fill the screen
        _cq.setFromAxisAngle(_cy,t*3.4+it.x); _cp.set(it.x,it.y,it.z); _cs.set(k,k,k); _cm.compose(_cp,_cq,_cs); im.setMatrixAt(it.ii,_cm); }
      if(im) im.instanceMatrix.needsUpdate=true; } }
  function nearItems(s,fn){ const ci=Math.floor(s/L); for(let i=ci-1;i<=ci+1;i++){ const c=chunks.get(i); if(c) c.items.forEach(fn); } }
  function reset(){ chunks.forEach(disposeChunk); chunks.clear(); lastKey=null; }

  /* ---------- sky, mountains, weather ---------- */
  const sky=new THREE.Mesh(new THREE.SphereGeometry(700,32,20),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{zen:{value:new THREE.Color()},mid:{value:new THREE.Color()},hor:{value:new THREE.Color()},sunC:{value:new THREE.Color()},sunD:{value:new THREE.Vector3(0,.2,-1)},stars:{value:0},fogC:{value:new THREE.Color()},time:{value:0},tPhoto:{value:null},uHas:{value:0},uYaw:{value:0},uExp:{value:1}},
    vertexShader:'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:`uniform vec3 zen,mid,hor,sunC,sunD,fogC; uniform float stars,time,uHas,uYaw,uExp; uniform sampler2D tPhoto; varying vec3 vD;
      float h3(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h3(vec3(i,1.)),h3(vec3(i+vec2(1,0),1.)),f.x),mix(h3(vec3(i+vec2(0,1),1.)),h3(vec3(i+vec2(1,1),1.)),f.x),f.y); }
      void main(){
        vec3 d=normalize(vD); float y=d.y;
        if(uHas>.5){ float cy=cos(-uYaw), sy=sin(-uYaw); vec3 e=vec3(d.x*cy+d.z*sy,d.y,-d.x*sy+d.z*cy); float phi=atan(e.x,-e.z), th=asin(clamp(e.y,-1.,1.)); vec3 pc=pow(texture2D(tPhoto,vec2(phi/6.2831853+.5,.5+th/3.14159265)).rgb,vec3(2.2))*uExp; pc=mix(pc,fogC,smoothstep(.02,-.18,y)*.9); gl_FragColor=vec4(pc,1.); return; }
        vec3 c=mix(hor,mid,smoothstep(0.0,.28,y)); c=mix(c,zen,smoothstep(.18,.85,y));
        c=mix(fogC,c,smoothstep(-.12,.03,y));
        float sd=max(dot(d,normalize(sunD)),0.);
        c+=sunC*(pow(sd,900.)*9.+pow(sd,60.)*.55+pow(sd,6.)*.28);
        if(y>0.){ vec2 p=d.xz/(y+.35)*2.4; float cl=n2(p*1.1+time*.01)*.6+n2(p*2.7)*.3+n2(p*6.)*.1; cl=smoothstep(.52,.86,cl)*smoothstep(0.,.25,y)*(1.-smoothstep(.55,.95,y));
          c=mix(c,mix(hor,sunC,.55)*1.25,cl*.5); }
        if(stars>0.&&y>0.02){ vec3 g=floor(d*260.); float s=step(.9965,h3(g)); c+=vec3(s)*stars*smoothstep(.02,.3,y)*(.6+.4*h3(g+1.)); }
        gl_FragColor=vec4(c,1.);
      }`}));
  sky.renderOrder=-10; sky.frustumCulled=false; scene.add(sky);

  /* cloud sea: two soft cloud layers far below the peaks, so the ridges rise out of cloud like the alpine reference */
  const cloudTex=(()=>{ const c=document.createElement('canvas'); c.width=c.height=512; const g=c.getContext('2d'), im=g.createImageData(512,512);
    for(let y=0;y<512;y++) for(let x=0;x<512;x++){ let v=0,a=.5,f=3; for(let o=0;o<5;o++){ v+=a*(vnoise(x/512*f+o*9.1,y/512*f+o*4.7)*.5+.5); a*=.5; f*=2; }
      const edge=Math.min(x,y,511-x,511-y)/60, al=clamp((v-.42)*3.2,0,1)*clamp(edge,0,1); const i=(y*512+x)*4; im.data[i]=255; im.data[i+1]=255; im.data[i+2]=255; im.data[i+3]=al*235; }
    g.putImageData(im,0,0); const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t; })();
  const clouds=[0,1].map(i=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(2600,2600),new THREE.MeshBasicMaterial({map:cloudTex.clone(),transparent:true,depthWrite:false,fog:false,opacity:i?.8:.95})); m.material.map.needsUpdate=true; m.material.map.repeat.set(3.5+i,3.5+i); m.rotation.x=-Math.PI/2; m.renderOrder=-6+i; m.frustumCulled=false; scene.add(m); return m; });
  const mount=new THREE.Group(); scene.add(mount);
  const plumeSprites=[]; const plumeTex2=(()=>{ const c=document.createElement('canvas'); c.width=256; c.height=64; const g=c.getContext('2d'); const gr=g.createRadialGradient(128,32,0,128,32,128); gr.addColorStop(0,'rgba(255,255,255,.9)'); gr.addColorStop(.5,'rgba(255,255,255,.35)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.save(); g.scale(1,.25); g.translate(0,96); g.fillStyle=gr; g.fillRect(0,-96,256,256); g.restore(); const t=new THREE.CanvasTexture(c); return t; })();
  function buildMountains(palette,sunDir,fogC){
    plumeSprites.length=0; while(mount.children.length){ const o=mount.children.pop(); if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); }
    const sunV=new THREE.Vector3(...sunDir).normalize(), lo=new THREE.Color(palette[1]).convertSRGBToLinear(), hi=new THREE.Color(palette[0]).convertSRGBToLinear(), fc=new THREE.Color(fogC).convertSRGBToLinear();
    const rockC=new THREE.Color(0x7a6d66).convertSRGBToLinear(), rockD=new THREE.Color(0x3d3a45).convertSRGBToLinear();
    [[860,520,0.5,11],[620,300,0.4,23],[470,150,0.3,41]].forEach(([R,H,sn,seed],layer)=>{
      const N=300, M=18, pos=[], idx=[];
      for(let i=0;i<=N;i++){ const a=i/N*Math.PI*2; const rid=(f,s)=>1-Math.abs(vnoise(Math.cos(a)*f+s,Math.sin(a)*f));   // ridged noise: sharp crests
        const ridge=Math.pow(rid(1.8,seed),2.4)*.6+Math.pow(rid(5,seed+3),2.8)*.3+Math.pow(rid(13,seed+7),3)*.1;
        const hh=H*(.12+ridge*1.2);
        for(let j=0;j<=M;j++){ const t=j/M, r=R-t*40-Math.pow(t,3)*60, y=-90+t*(hh+90); pos.push(Math.cos(a)*r,y,Math.sin(a)*r); } }
      for(let i=0;i<N;i++) for(let j=0;j<M;j++){ const a=i*(M+1)+j,b=a+1,c=a+(M+1),d=c+1; idx.push(a,c,b,b,c,d); }
      const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
      const p=g.attributes.position, nr=g.attributes.normal, col=new Float32Array(p.count*3), cc=new THREE.Color();
      for(let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i), z=p.getZ(i), ang=Math.atan2(z,x);
        // snow settles on the high, gentle parts; cliffs and gullies stay bare rock
        const patch=vnoise(ang*38+layer*5,y*.03)*.5+vnoise(ang*110,y*.09)*.25+.5, hf=smooth(H*.18,H*.55,y), snow=smooth(.46,.76,patch*.62+hf*.42);
        cc.copy(rockC).lerp(rockD,smooth(.4,.9,vnoise(ang*70,y*.05)*.5+.5)); cc.lerp(hi,snow);
        const sh=clamp(.5+.6*(nr.getX(i)*sunV.x+nr.getY(i)*sunV.y+nr.getZ(i)*sunV.z),.28,1.1), sc=clamp((sh-.28)/.82,0,1);
        cc.r*=lerp(.58,1.05,sc); cc.g*=lerp(.7,1.0,sc); cc.b*=lerp(.95,.97,sc);
        const haze=(layer===0?.36:layer===1?.2:.08)+smooth(60,-80,y)*.7; cc.lerp(fc,clamp(haze,0,1)); col[i*3]=cc.r; col[i*3+1]=cc.g; col[i*3+2]=cc.b; }
      g.setAttribute('color',new THREE.BufferAttribute(col,3));
      if(layer<2){ const hs=[]; for(let i=0;i<=N;i++) hs.push(pos[(i*(M+1)+M)*3+1]); let cnt=0; for(let i=4;i<N-4&&cnt<(layer?5:7);i++){ if(hs[i]>H*.62&&hs[i]>=hs[i-3]&&hs[i]>=hs[i+3]&&hs[i]>=hs[i-1]&&hs[i]>=hs[i+1]){ const a=i/N*Math.PI*2, r=R-40-60; const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:plumeTex2,transparent:true,depthWrite:false,fog:false,opacity:.5,color:0xffffff})); sp.position.set(Math.cos(a)*r*.99,hs[i]+8,Math.sin(a)*r*.99); sp.scale.set(layer?150:260,layer?50:90,1); sp.userData.ph=i; plumeSprites.push(sp); mount.add(sp); cnt++; i+=14; } } }
      const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,fog:false,side:THREE.DoubleSide,toneMapped:true})); m.frustumCulled=false; mount.add(m); });
  }

  /* falling snow: a box of flakes that wraps around the camera */
  const FL=1400, flakePos=new Float32Array(FL*3), flakeSeed=new Float32Array(FL*3);
  for(let i=0;i<FL;i++){ flakeSeed[i*3]=Math.random(); flakeSeed[i*3+1]=Math.random(); flakeSeed[i*3+2]=Math.random(); }
  const flakeGeo=new THREE.BufferGeometry(); flakeGeo.setAttribute('position',new THREE.BufferAttribute(flakePos,3));
  const flakeMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,
    uniforms:{col:{value:new THREE.Color(1,1,1)},px:{value:1},alpha:{value:.85}},
    vertexShader:'uniform float px; varying float vA; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; float d=-mv.z; gl_PointSize=clamp(px*5.5/d*6.0,1.0,9.0); vA=smoothstep(60.,8.,d); }',
    fragmentShader:'uniform vec3 col; uniform float alpha; varying float vA; void main(){ vec2 q=gl_PointCoord-.5; float a=smoothstep(.5,.1,length(q)); gl_FragColor=vec4(col,a*vA*alpha); }'});
  const flakes=new THREE.Points(flakeGeo,flakeMat); flakes.frustumCulled=false; scene.add(flakes);
  const BOX=[70,38,70];
  function updateFlakes(t,center,vel){
    for(let i=0;i<FL;i++){ const sx=flakeSeed[i*3],sy=flakeSeed[i*3+1],sz=flakeSeed[i*3+2];
      let x=sx*BOX[0]+Math.sin(t*.6+sz*20)*1.2-t*(1.5+sz)-vel.x*t*.0, y=sy*BOX[1]-t*(1.7+sy*1.3), z=sz*BOX[2]+t*.9;
      const mx=((x-center.x+BOX[0]/2)%BOX[0]+BOX[0])%BOX[0]-BOX[0]/2, my=((y-center.y+BOX[1]/2)%BOX[1]+BOX[1])%BOX[1]-BOX[1]/2, mz=((z-center.z+BOX[2]/2)%BOX[2]+BOX[2])%BOX[2]-BOX[2]/2;
      flakePos[i*3]=center.x+mx; flakePos[i*3+1]=center.y+my+4; flakePos[i*3+2]=center.z+mz; }
    flakeGeo.attributes.position.needsUpdate=true; }

  const GRADES={bunny:{shadow:[.90,.97,1.12],high:[1.02,1.0,.97],sat:1.12,contrast:1.1,vig:.22},bull:{shadow:[.92,1.0,1.1],high:[1.07,1.0,.9],sat:1.16,contrast:1.12,vig:.34},bear:{shadow:[.9,1.0,1.14],high:[1.0,1.0,1.0],sat:1.14,contrast:1.12,vig:.36},ridge:{shadow:[.95,1.0,1.06],high:[1.0,1.0,1.02],sat:.92,contrast:1.06,vig:.4},ipo:{shadow:[.95,.9,1.2],high:[1.1,.96,1.1],sat:1.25,contrast:1.14,vig:.42}};

  /* ---------- scanned assets (CC0, Poly Haven): real snow PBR, rock scans, photographic skies ---------- */
  const ASSET={rocks:[],skyCfg:null,skyTex:{},snow:false};
  const SKY_OF={bunny:'horn-koppe_snow',bull:'stierberg_sunrise',bear:'lago_disola',ridge:'snowy_hillside'};
  function rockSnow(mat){ mat.onBeforeCompile=sh=>{ sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      { vec3 wn=inverseTransformDirection(normal,viewMatrix); float sn=smoothstep(.42,.78,wn.y+.12*sin(vViewPosition.x*3.1)*sin(vViewPosition.z*2.3)); diffuseColor.rgb=mix(diffuseColor.rgb*.9,vec3(.9,.94,1.),sn*.94); }`); }; mat.envMapIntensity=.8; return mat; }
  async function loadAssets(){
    const tl=new THREE.TextureLoader(), maxA=renderer.capabilities.getMaxAnisotropy();
    const tex=u=>new Promise(res=>tl.load(u,t=>res(t),undefined,()=>res(null)));
    try{ ASSET.skyCfg=await fetch('assets/sky/skies.json').then(r=>r.json()); }catch(e){ console.warn('skies',e); }
    const [d,n,r]=await Promise.all([tex('assets/tex/snow_diff.jpg'),tex('assets/tex/snow_nor.jpg'),tex('assets/tex/snow_rough.jpg')]);
    if(d&&n&&r){ [d,n,r].forEach(t=>{ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=maxA; }); d.encoding=THREE.sRGBEncoding; terrainMat.map=d; terrainMat.normalMap=n; terrainMat.normalScale.set(.8,.8); terrainMat.roughnessMap=r; terrainMat.color.setScalar(1.18); terrainMat.needsUpdate=true; ASSET.snow=true; }
    const loadGlb=name=>new Promise(res=>{ const L=new THREE.GLTFLoader(); if(window.MeshoptDecoder) L.setMeshoptDecoder(window.MeshoptDecoder); L.load('assets/rocks/'+name+'.glb',g=>{ let me=null; g.scene.traverse(o=>{ if(o.isMesh&&!me) me=o; }); if(!me) return res(null);
        const geo=me.geometry.clone(); me.updateWorldMatrix(true,false); geo.applyMatrix4(me.matrixWorld); geo.computeBoundingBox(); const b=geo.boundingBox, sz=new THREE.Vector3(); b.getSize(sz); const k=1/Math.max(sz.x,sz.y,sz.z);
        geo.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2); geo.scale(k,k,k); geo.computeVertexNormals();
        const mat=rockSnow(me.material.clone()); mat.side=THREE.DoubleSide; res({name,geo,mat,h:sz.y*k}); },undefined,()=>res(null)); });
    const rs=await Promise.all(['rock_07','rock_09','stone_01','rock_face_01'].map(loadGlb)); ASSET.rocks=rs.filter(Boolean);
  }
  function applySkyPhoto(tr,id){ const cfg=ASSET.skyCfg&&ASSET.skyCfg[id], tex=ASSET.skyTex[id]; if(!cfg||!tex||T!==tr) return; const u=sky.material.uniforms, k=tr.sky;
    const des=k.sunDir, az=Math.atan2(des[0],-des[2])-Math.atan2(cfg.sunDir[0],-cfg.sunDir[2]); u.tPhoto.value=tex; u.uHas.value=1; u.uYaw.value=az; u.uExp.value=tr.id==='bull'?1.12:1.0;
    const el=Math.asin(cfg.sunDir[1]), azd=Math.atan2(des[0],-des[2]); k.sunDir=[Math.sin(azd)*Math.cos(el),Math.sin(el),-Math.cos(azd)*Math.cos(el)];
    const lift=(c,m)=>c.map(v=>Math.min(1,v+(1-v)*m)), hx=c=>{ const a=c.map(v=>Math.round(clamp(v,0,1)*255)); return (a[0]<<16)|(a[1]<<8)|a[2]; };
    const hor=lift(cfg.horizon,.18); const fogHex=hx(hor); k.fog=fogHex; scene.fog=new THREE.Fog(fogHex,k.fogNear,k.fogFar); scene.fog.color.convertSRGBToLinear(); u.fogC.value.set(fogHex).convertSRGBToLinear();
    hemi.color.setHex(hx(lift(cfg.zenith,.35))).convertSRGBToLinear(); hemi.groundColor.setHex(hx(lift(cfg.horizon,.5))).convertSRGBToLinear(); sun.color.setRGB(cfg.sunColor[0],cfg.sunColor[1],cfg.sunColor[2]).convertSRGBToLinear();
    buildMountains(k.mount,k.sunDir,fogHex); }
  function ensureSky(tr){ const id=SKY_OF[tr.id]; if(!id||!ASSET.skyCfg) return Promise.resolve(); if(ASSET.skyTex[id]){ applySkyPhoto(tr,id); return Promise.resolve(); }
    return new Promise(res=>{ new THREE.TextureLoader().load('assets/sky/'+(matchMedia('(pointer:coarse)').matches?ASSET.skyCfg[id].file.replace('.jpg','_m.jpg'):ASSET.skyCfg[id].file),t=>{ t.wrapS=THREE.RepeatWrapping; t.wrapT=THREE.ClampToEdgeWrapping; t.minFilter=THREE.LinearFilter; t.generateMipmaps=false; t.anisotropy=1; ASSET.skyTex[id]=t; applySkyPhoto(tr,id); res(); },undefined,()=>res()); }); }

  function setTrack(tr){ ST.gradeCfg=GRADES[tr.id]||GRADES.bull; ST.applyGrade();
    T=tr; cx0=0; cx0=cxRaw(0); rampCache.clear(); const k=T.sky;
    if(ST.Park){ const PL=ST.Park.layoutFor(T.id); if(PL&&PL.jumps) T.jumpList=PL.jumps; ST.Park.setTrack(T); }
    if(ST.Village){ ST.Village.setTrack(T); SNOW_UNI.uGlowK.value=ST.Village.night*.6; }
    ctx.snow.set(k.snow); ctx.snow.convertSRGBToLinear();
    const u=sky.material.uniforms; u.zen.value.set(k.zen); u.mid.value.set(k.mid); u.hor.value.set(k.hor); u.sunC.value.set(k.sun); u.sunD.value.set(...k.sunDir); u.stars.value=k.stars; u.fogC.value.set(k.fog);
    [u.zen,u.mid,u.hor,u.sunC,u.fogC].forEach(c=>c.value.convertSRGBToLinear());
    scene.fog=new THREE.Fog(k.fog,k.fogNear,k.fogFar); scene.fog.color.convertSRGBToLinear(); scene.background=null;
    hemi.color.set(k.hemiS); hemi.groundColor.set(k.hemiG); hemi.intensity=k.hemiI; sun.color.set(k.sun); sun.intensity=k.sunI; ST.renderer.toneMappingExposure=k.exp;
    ST.bloomStrength=k.neon?.75:.26; if(ST.GFX.bloom) ST.GFX.bloom.strength=ST.bloomStrength;
    SNOW_UNI.uSparkle.value=k.neon?.7:1; MATS.coin.emissiveIntensity=k.neon?1.4:.9;
    { const cc=new THREE.Color(k.hor).lerp(new THREE.Color(0xffffff),.45).convertSRGBToLinear(); clouds.forEach(m=>m.material.color.copy(cc)); clouds.forEach(m=>m.visible=true); }
    buildMountains(k.mount,k.sunDir,k.fog);
    setSites(ST.Resort?ST.Resort.sites(T):[]); if(ST.Resort) ST.Resort.setTrack(T);
    flakeMat.uniforms.alpha.value=.5+.4*T.snowfall; flakeGeo.setDrawRange(0,Math.round(FL*(.2+.8*T.snowfall)));
    sky.material.uniforms.uHas.value=0; reset(); ensureSky(tr);
    if(ST.Park) ST.Park.build(T);
    if(ST.Village) ST.Village.build(T);
  }
  function follow(p,t){ plumeSprites.forEach(sp=>{ const ph=sp.userData.ph; sp.material.opacity=.42+.18*Math.sin(t*.35+ph); sp.scale.x=(sp.scale.y>60?260:150)*(1+.08*Math.sin(t*.2+ph*1.3)); });
    clouds.forEach((m,i)=>{ m.position.set(camera.position.x,p.y-175+i*52,camera.position.z); m.material.map.offset.set(t*.004*(i?1.6:1),t*.002); });
    sky.position.copy(camera.position); sky.material.uniforms.time.value=t; mount.position.set(camera.position.x,p.y-30,camera.position.z);
    const sd=T.sky.sunDir; sun.position.set(p.x-sd[0]*0+sd[0]*120,p.y+sd[1]*120+30,p.z+sd[2]*120); sun.target.position.set(p.x,p.y,p.z); sun.target.updateMatrixWorld(); }

  ST.World={loadAssets,ensureSky,get T(){return T;},baseGround,groundY,groundN,cx,dcx,halfW,fall,update,nearItems,setTrack,follow,updateFlakes,rampAt,forRamps,lipNear,flightLine,jumpWindow,updateCoins,L,BUILD,flakes,reset,rampProfile};
})(window.ST);
