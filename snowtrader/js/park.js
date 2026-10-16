/* Snow Rush: the snowpark (Summit Park, plus a few features in the test lab).
   - Terrain features shape the snow itself (World.groundY asks Park.terrain): a halfpipe, a quarter pipe, a wall ride and
     the small snow ramps that lead onto jibs. A height field cannot stand vertical, so walls top out near 80 degrees; the
     physics launches riders straight up off them (js/physics.js).
   - Jumps (three lanes side by side: small, medium, large; a big air; a gap jump) are table-tops in World's jump list.
   - Jibs (boxes and rails) are objects with a grind line, a polyline along their top that the physics can lock onto.
   Track coordinates: s = distance down the run, u = metres across it (World.cx(s) is its centre line). */
(function(ST){
  const {clamp,smooth,lerp}=ST; const {scene}=ST;
  const PI=Math.PI;
  const Park={pipes:[],walls:[],wedges:[],rails:[],group:null,T:null,mats:null};

  /* ---------- layouts ---------- */
  const L_=-15, C_=0, R_=15;                       // the three lanes: beginner (left), intermediate (centre), pro (right)
  const LAYOUT={
    ipo:{
      jumps:[ // line 1: small / medium / large side by side
        {name:'S1',s:170,u:L_,h:.7,w:3.4,Hm:1.5,face:24,b:.12,Tb:4,v:11},{name:'M1',s:175,u:C_,h:1.2,w:4.2,Hm:3,face:27,b:.15,Tb:9,v:14},{name:'L1',s:180,u:R_,h:1.8,w:5,Hm:4.5,face:31,b:.2,Tb:14,v:16},
        // line 2: bigger, with a big air on the pro lane
        {name:'S2',s:500,u:L_,h:.9,w:3.6,Hm:2,face:25,b:.12,Tb:6,v:12},{name:'M2',s:505,u:C_,h:1.5,w:4.4,Hm:3.5,face:29,b:.16,Tb:11,v:15},{name:'BIG AIR',s:510,u:R_,h:2.4,w:5.6,Hm:6,face:34,b:.25,Tb:18,v:18},
        // pro line: a gap jump (case it and you drop into the gap)
        {name:'GAP',s:1150,u:R_,h:1.6,w:4.8,Hm:4,face:30,b:.2,Tb:12,v:16,gap:3.2},{name:'M3',s:1160,u:C_,h:1.3,w:4.2,Hm:3,face:28,b:.15,Tb:10,v:14}],
      pipes:[{s0:650,s1:900,uc:0,flat:11,R:4.6,H:5.0,deck:3}],
      walls:[{s0:960,s1:1015,side:1,u0:16,R:4,H:3.6,name:'QUARTER PIPE'},{s0:1030,s1:1072,side:-1,u0:-18,R:1.6,H:2.6,name:'WALL RIDE'}],
      jibs:[
        {kind:'box',name:'RIDE-ON BOX',s:300,u:L_,len:8,h:.45,w:.5,ramp:{len:3.5,h:.45},color:0x2f8bff},
        {kind:'box',name:'BUTTER BOX',s:360,u:L_,len:6,h:.25,w:1.2,ramp:{len:2.5,h:.25},color:0xffc21a,butter:true},
        {kind:'rail',name:'RAIL',s:300,u:C_,len:8,h:.8,w:.05,ramp:{len:4,h:.55},color:0xd8dde6},
        {kind:'rail',name:'RAINBOW RAIL',s:375,u:C_,len:9,h:.75,arc:.7,w:.05,ramp:{len:4,h:.6},color:0xff3d8b},
        {kind:'rail',name:'KINK RAIL',s:300,u:R_,len:9,h:1.15,kink:{at:3,drop:2.2},w:.05,ramp:{len:5,h:.95},color:0x16e08a},
        {kind:'box',name:'FLAT-DOWN BOX',s:385,u:R_,len:8,h:.9,kink:{at:3,drop:1.6},w:.55,ramp:{len:4.5,h:.75},color:0xb04bff},
        {kind:'box',name:'LONG BOX',s:1220,u:L_,len:14,h:.5,w:.6,ramp:{len:3.5,h:.5},color:0x22d3ee},
        {kind:'rail',name:'LONG RAIL',s:1225,u:C_,len:12,h:.85,w:.05,ramp:{len:4.5,h:.6},color:0xff7a1a}]
    },
    lab:{ jumps:[{name:'LAB KICKER',s:170,u:0,h:1,w:5}],          // one kicker, clear of the park features below it
      pipes:[{s0:560,s1:700,uc:0,flat:12,R:4.4,H:4.6,deck:3}],
      walls:[{s0:430,s1:470,side:1,u0:14,R:3.6,H:3.2,name:'QUARTER PIPE'}],
      jibs:[{kind:'box',name:'RIDE-ON BOX',s:250,u:-8,len:8,h:.45,w:.5,ramp:{len:3.5,h:.45},color:0x2f8bff},
        {kind:'rail',name:'RAIL',s:250,u:8,len:8,h:.8,w:.05,ramp:{len:4,h:.55},color:0xd8dde6},
        {kind:'box',name:'BUTTER BOX',s:330,u:-8,len:6,h:.25,w:1.2,ramp:{len:2.5,h:.25},color:0xffc21a,butter:true},
        {kind:'rail',name:'RAINBOW RAIL',s:335,u:8,len:9,h:.75,arc:.7,w:.05,ramp:{len:4,h:.6},color:0xff3d8b}] }
  };
  Park.layoutFor=id=>LAYOUT[id]||null;

  /* ---------- terrain: halfpipe, quarter pipe, wall ride, ramps onto jibs ---------- */
  // a wall's height at distance x past where its transition starts: a circular transition of radius R, steepening to ~80 degrees,
  // then a short near-vertical part to its full height H, a flat deck, and the back of the wall falling away
  function wallY(x,R,H,deck){ if(x<=0) return 0; const xs=R*.985;
    if(x<xs){ return R-Math.sqrt(R*R-x*x); }                                 // the round transition
    const ys=R-Math.sqrt(R*R-xs*xs), k=6;                                   // near vertical: 6 m up per metre across
    const xv=xs+(H-ys)/k; if(x<xv) return ys+(x-xs)*k;
    if(x<xv+deck) return H;                                                 // the deck
    return H*(1-smooth(xv+deck,xv+deck+H*1.4,x)); }                         // the back of the wall
  function along(s,s0,s1,ramp){ return smooth(s0-ramp,s0,s)*(1-smooth(s1,s1+ramp,s)); }   // walls rise at the entry and taper at the exit
  Park.terrain=function(s,u){
    let y=0;
    for(const p of Park.pipes){ if(s<p.s0-24||s>p.s1+24) continue; const a=along(s,p.s0,p.s1,22); if(a<=0) continue; const x=Math.abs(u-p.uc)-p.flat/2; y+=wallY(x,p.R,p.H,p.deck)*a; }
    for(const w of Park.walls){ if(s<w.s0-14||s>w.s1+14) continue; const a=along(s,w.s0,w.s1,12); if(a<=0) continue; const x=(u-w.u0)*w.side; y+=wallY(x,w.R,w.H,1.5)*a; }
    for(const r of Park.wedges){ const d=s-r.s0; if(d<0||d>r.len+.6) continue; const du=Math.abs(u-r.u); if(du>r.w+1.2) continue;
      const k=d<r.len?Math.pow(d/r.len,1.3):(1-(d-r.len)/.6); y+=r.h*k*(1-smooth(r.w-.2,r.w+1.2,du)); }
    return y; };
  /* is (s,u) on a pipe or quarter-pipe wall? returns the wall's outward direction across the run (+1 / -1), or 0 */
  Park.wallSide=function(s,u){
    for(const p of Park.pipes){ if(s<p.s0-20||s>p.s1+20) continue; const x=Math.abs(u-p.uc)-p.flat/2; if(x>p.R*.6&&x<p.R+1.6) return Math.sign(u-p.uc)||1; }
    for(const w of Park.walls){ if(s<w.s0-10||s>w.s1+10) continue; const x=(u-w.u0)*w.side; if(x>w.R*.6&&x<w.R+1.6) return w.side; }
    return 0; };
  /* inside a halfpipe or in front of a quarter pipe / wall: the rider rides across the run here, so the physics stops easing
     the board back down the fall line */
  Park.inFeature=function(s,u){
    for(const p of Park.pipes){ if(s>p.s0-10&&s<p.s1+10&&Math.abs(u-p.uc)<p.flat/2+p.R+2) return true; }
    for(const w of Park.walls){ if(s>w.s0-8&&s<w.s1+8){ const x=(u-w.u0)*w.side; if(x>-6&&x<w.R+2) return true; } }
    return false; };
  /* keep pickups and hazards off the park features */
  Park.busy=function(s){ for(const p of Park.pipes) if(s>p.s0-30&&s<p.s1+30) return true; for(const w of Park.walls) if(s>w.s0-16&&s<w.s1+16) return true;
    for(const j of Park.rails) if(s>j.sA-30&&s<j.sB+14) return true; return false; };

  /* ---------- jibs: geometry of the grind line ---------- */
  function jibLine(j){   // points along the top (track coordinates: s, u, height over the snow)
    const pts=[], n=j.arc?12:j.kink?3:2;
    if(j.kink){ pts.push([j.s,j.u,j.h],[j.s+j.kink.at,j.u,j.h],[j.s+j.len,j.u,j.h-j.kink.drop]); }
    else for(let i=0;i<n;i++){ const t=i/(n-1); pts.push([j.s+j.len*t,j.u,j.h+(j.arc?j.arc*Math.sin(PI*t):0)]); }
    return pts; }
  function toWorld(sp){ const W=ST.World, s=sp[0], x=W.cx(s)+sp[1], z=-s, y=W.groundY(x,z)+sp[2]; return new THREE.Vector3(x,y,z); }

  /* ---------- build ---------- */
  function mats(){ if(Park.mats) return Park.mats;
    const M=Park.mats={metal:new THREE.MeshStandardMaterial({color:0xc9d0da,metalness:.9,roughness:.28}),post:new THREE.MeshStandardMaterial({color:0x2a2f3a,metalness:.6,roughness:.45}),
      top:new THREE.MeshStandardMaterial({color:0xf2f4f8,roughness:.35,metalness:.05}),pipeLip:new THREE.MeshStandardMaterial({color:0x3a7bff,emissive:0x1b4fff,emissiveIntensity:.6,roughness:.5}),
      flag:new THREE.MeshStandardMaterial({color:0xff3d8b,side:THREE.DoubleSide,roughness:.8})};
    return M; }
  function tube(a,b,r,mat){ const d=new THREE.Vector3().subVectors(b,a), L=d.length(); const g=new THREE.CylinderGeometry(r,r,L,12,1); g.rotateX(PI/2); g.translate(0,0,L/2);
    const m=new THREE.Mesh(g,mat); m.position.copy(a); m.lookAt(b); m.castShadow=true; return m; }
  function buildJib(j,grp){
    const M=mats(), line=jibLine(j).map(toWorld), col=new THREE.MeshStandardMaterial({color:j.color,roughness:.5,metalness:.15});
    for(let i=0;i<line.length-1;i++){ const a=line[i], b=line[i+1];
      if(j.kind==='rail'){ grp.add(tube(a,b,j.w,M.metal)); }
      else { // a box: a slick top over a coloured body down to the snow
        const d=new THREE.Vector3().subVectors(b,a), L=d.length(), mid=a.clone().add(b).multiplyScalar(.5), yaw=Math.atan2(d.x,d.z), pitch=-Math.asin(clamp(d.y/L,-1,1));
        const body=new THREE.Mesh(new THREE.BoxGeometry(j.w*2,j.h,L),col); body.castShadow=body.receiveShadow=true; body.position.copy(mid); body.position.y-=j.h/2; body.rotation.set(pitch,yaw,0,'YXZ'); grp.add(body);
        const top=new THREE.Mesh(new THREE.BoxGeometry(j.w*2+.04,.04,L+.02),M.top); top.position.copy(mid); top.position.y-=.02; top.rotation.set(pitch,yaw,0,'YXZ'); top.receiveShadow=true; grp.add(top); } }
    if(j.kind==='rail'){ // posts down to the snow every couple of metres
      const tot=line.reduce((a,p,i)=>i?a+p.distanceTo(line[i-1]):0,0); let acc=0;
      for(let i=0;i<line.length-1;i++){ const a=line[i], b=line[i+1], L=a.distanceTo(b), np=Math.max(1,Math.round(L/2.5)); for(let k=0;k<=np;k++){ if(i>0&&k===0) continue; const p=a.clone().lerp(b,k/np), gy=ST.World.groundY(p.x,p.z);
          const post=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,Math.max(.1,p.y-gy),8),M.post); post.position.set(p.x,(p.y+gy)/2,p.z); post.castShadow=true; grp.add(post); } acc+=L; }
      const base=new THREE.Mesh(new THREE.BoxGeometry(.5,.08,tot+.4),col); const mid=line[0].clone().lerp(line[line.length-1],.5); base.position.set(mid.x,ST.World.groundY(mid.x,mid.z)+.04,mid.z); base.rotation.y=Math.atan2(line[line.length-1].x-line[0].x,line[line.length-1].z-line[0].z); grp.add(base); }
    // the grind line the physics uses: world points, cumulative lengths, contact half-width
    const cum=[0]; for(let i=1;i<line.length;i++) cum.push(cum[i-1]+line[i].distanceTo(line[i-1]));
    return {name:j.name,kind:j.kind,butter:!!j.butter,pts:line,cum,len:cum[cum.length-1],w:j.kind==='rail'?.05:j.w,sA:j.s,sB:j.s+j.len,
      box:{minX:Math.min(...line.map(p=>p.x))-1,maxX:Math.max(...line.map(p=>p.x))+1,minZ:Math.min(...line.map(p=>p.z))-1,maxZ:Math.max(...line.map(p=>p.z))+1}}; }
  function buildPipeDecor(p,grp){ // coping lights along both lips, and banners at the entry
    const M=mats(), W=ST.World; for(const side of [-1,1]){ for(let s=p.s0+4;s<p.s1-4;s+=6){ const x0=Math.abs(p.flat/2)+p.R*.985+(p.H-(p.R-Math.sqrt(p.R*p.R-(p.R*.985)**2)))/6, u=p.uc+side*(x0+.2), x=W.cx(s)+u, z=-s;
        const m=new THREE.Mesh(new THREE.BoxGeometry(.25,.12,5.6),M.pipeLip); m.position.set(x,W.groundY(x,z)+.06,z); m.rotation.y=-Math.atan2(W.dcx(s),1); grp.add(m); } } }
  function buildFlags(T,grp){ const M=mats(), W=ST.World; const L=Park.layoutFor(T.id); if(!L||!L.jumps) return;
    L.jumps.forEach(j=>{ [-1,1].forEach(sd=>{ const s=j.s-6, u=j.u+sd*(j.w+.8), x=W.cx(s)+u, z=-s, y=W.groundY(x,z);
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,2.4,6),M.post); pole.position.set(x,y+1.2,z); grp.add(pole);
      const f=new THREE.Mesh(new THREE.PlaneGeometry(.8,.5),M.flag); f.position.set(x+.4,y+2.1,z); grp.add(f); }); }); }

  Park.setTrack=function(T){
    if(Park.group){ scene.remove(Park.group); Park.group.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); Park.group=null; }
    Park.pipes=[]; Park.walls=[]; Park.wedges=[]; Park.rails=[]; Park.T=T;
    const L=Park.layoutFor(T.id); if(!L) return;
    Park.pipes=L.pipes.map(p=>Object.assign({},p)); Park.walls=L.walls.map(w=>Object.assign({},w));
    Park.wedges=L.jibs.filter(j=>j.ramp).map(j=>({s0:j.s-j.ramp.len-.3,len:j.ramp.len,h:j.ramp.h,u:j.u,w:Math.max(.9,j.w*1.6)}));
  };
  /* meshes need the final ground (World.setTrack must have run): called from World.setTrack after the terrain is ready */
  Park.build=function(T){ const L=Park.layoutFor(T.id); if(!L) return; const grp=new THREE.Group(); grp.name='park';
    // a jib's height is measured from the snow it stands on, not from the ramp that leads onto it (that ramp's tail runs under
    // the first metre of the jib and would lift its start)
    const wd=Park.wedges; Park.wedges=[]; Park.rails=L.jibs.map(j=>buildJib(j,grp)); Park.wedges=wd;
    Park.pipes.forEach(p=>buildPipeDecor(p,grp)); buildFlags(T,grp);
    ST.bakeStatic(grp); scene.add(grp); Park.group=grp; };
  Park.railsNear=function(x,z,fn){ for(const r of Park.rails){ const b=r.box; if(x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ) fn(r); } };
  /* closest point on a rail's grind line: {t (metres along), p (world point), dir (unit, along increasing t), dh (horizontal distance)} */
  const _a=new THREE.Vector3(), _d=new THREE.Vector3();
  Park.closest=function(r,x,y,z){ let best=null;
    for(let i=0;i<r.pts.length-1;i++){ const a=r.pts[i], b=r.pts[i+1]; _d.subVectors(b,a); const L2=_d.x*_d.x+_d.z*_d.z; let t=L2>0?((x-a.x)*_d.x+(z-a.z)*_d.z)/L2:0; t=clamp(t,0,1);
      const px=a.x+_d.x*t, pz=a.z+_d.z*t, dh=Math.hypot(x-px,z-pz); if(!best||dh<best.dh){ const segL=_d.length(); best={i,dh,t:r.cum[i]+segL*t,p:new THREE.Vector3(px,a.y+_d.y*t,pz),dir:_d.clone().divideScalar(segL||1)}; } }
    return best; };
  Park.at=function(r,t){ t=clamp(t,0,r.len); let i=0; while(i<r.pts.length-2&&r.cum[i+1]<t) i++; const a=r.pts[i], b=r.pts[i+1], L=r.cum[i+1]-r.cum[i], f=L>0?(t-r.cum[i])/L:0;
    return {p:a.clone().lerp(b,f),dir:new THREE.Vector3().subVectors(b,a).divideScalar(L||1),i}; };
  Park.radar=function(ps,map,g){ for(const r of Park.rails){ if(r.sB<ps-20||r.sA>ps+150) continue; const a=map(r.pts[0].x,r.pts[0].z), b=map(r.pts[r.pts.length-1].x,r.pts[r.pts.length-1].z);
      g.strokeStyle=r.kind==='rail'?'#e6ecf5':'#7fc8ff'; g.lineWidth=3; g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke(); }
    for(const p of Park.pipes){ if(p.s1<ps-20||p.s0>ps+150) continue; const W=ST.World; [-1,1].forEach(sd=>{ g.strokeStyle='#3a7bff'; g.lineWidth=4; g.beginPath(); for(let s=Math.max(p.s0,ps-20);s<=Math.min(p.s1,ps+150);s+=8){ const q=map(W.cx(s)+p.uc+sd*(p.flat/2+p.R),-s); s===Math.max(p.s0,ps-20)?g.moveTo(q[0],q[1]):g.lineTo(q[0],q[1]); } g.stroke(); }); } };
  ST.Park=Park;
})(window.ST);
