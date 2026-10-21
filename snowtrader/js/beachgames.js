/* Surf Rush: ball games on the sand, played by the town's people (js/people.js draws them; the game moves them).
   - Beach volleyball at the court: two a side. The ball goes over the net in arcs; the team that gets it passes it up to the
     partner, who sends it over; whoever it is coming to runs under it, faces it and plays it (a forearm pass, a smash). Now
     and then nobody gets there: the ball drops in the sand, bounces, rolls, and someone walks over, picks it up, walks back
     behind the line and serves.
   - Matkot at the water's edge, the paddle ball of every Israeli beach: two players eight metres apart keeping a small hard
     ball going as fast as they can, each stepping across to meet it, the dry 'tock' of the wooden paddles on every hit.
   The hit is a quick pose (People: Bump, Spike, Swing) crossfaded in and out; the ball is a mesh with a shadow. */
(function(ST){
  const {clamp,hash2}=ST; const PI=Math.PI, G=9.81, wrapA=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const GM={list:[]};
  const gyAt=(x,z)=>ST.World.groundY(x,z);
  /* a player of a game moves like a person: toward a point, faster the further it is (a run when far), turning to face where
     it goes, or (shuffling a step or two) facing what it watches */
  function moveTo(r,tx,tz,face,dt,vmax){ const dx=tx-r.x, dz=tz-r.z, d=Math.hypot(dx,dz); r.v=r.v||0;
    const want=d>.08?Math.min(vmax,d*2.4):0; r.v+=clamp(want-r.v,-4*dt,3*dt); if(r.v<0) r.v=0;
    if(d>.08){ const k=Math.min(1,r.v*dt/d); r.x+=dx*k; r.z+=dz*k; }
    const far=d>1.4&&r.v>1.2, h=far?Math.atan2(dx,dz):face; r.ry=wrapA((r.ry||0)+clamp(wrapA(h-(r.ry||0)),-6*dt,6*dt));
    r.y=gyAt(r.x,r.z); if(!r.hit||r.hit<=0) r.anim=r.v>1.9?'Run':r.v>.25?'Walk':'Idle'; r.spd=r.v; return d; }
  function pose(r,name,t){ r.hit=t; r.anim=name; }
  function tickPose(r,dt){ if(r.hit>0){ r.hit-=dt; if(r.hit<=0) r.anim='Idle'; } }
  // a ball in flight from p0 that reaches p1 after T seconds
  function launch(B,p0,p1,T){ B.p.copy(p0); B.v.set((p1.x-p0.x)/T,(p1.y-p0.y)/T+.5*G*T,(p1.z-p0.z)/T); B.t=0; B.T=T; }
  function ballMesh(r,col,col2){ const g=new THREE.SphereGeometry(r,16,12), c=[], a=new THREE.Color(col).convertSRGBToLinear(), b=new THREE.Color(col2).convertSRGBToLinear(), p=g.attributes.position;
    for(let i=0;i<p.count;i++){ const y=p.getY(i)/r, x=p.getX(i)/r, k=Math.sin(Math.atan2(y,x)*3)>0?a:b; c.push(k.r,k.g,k.b); } g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5})); m.castShadow=true; return m; }
  /* ---------- volleyball ---------- */
  GM.volleyball=function(T,spot,group){ const vx=spot.x, zc=T.wz(vx,spot.d), sides=[-1,1], seat=[-1,1];
    const B={p:new THREE.Vector3(),v:new THREE.Vector3(),t:0,T:1,mesh:ballMesh(.11,0xffd23a,0x1f6fe0)}; group.add(B.mesh);
    const ps=[]; sides.forEach((sx,ti)=>seat.forEach((sz,j)=>ps.push({team:ti,sx,home:{x:vx+sx*3.6,z:zc+sz*2}})));
    const S={mode:'serve',timer:1.5,server:0,rec:-1,kind:'',miss:false,last:-1,touches:0}; const _a=new THREE.Vector3(), _b=new THREE.Vector3();
    const faceNet=pl=>pl.sx<0?PI/2:-PI/2, hand=(r,h)=>_a.set(r.x+Math.sin(r.ry)*.35,gyAt(r.x,r.z)+h,r.z+Math.cos(r.ry)*.35);
    const nearest=(team,x,z)=>{ let best=-1, bd=1e9; ps.forEach((pl,i)=>{ if(pl.team!==team) return; const r=pl.r, d=Math.hypot(r.x-x,r.z-z); if(d<bd){ bd=d; best=i; } }); return best; };
    function sendOver(from,kind,miss){ const ot=1-ps[from].team, sx=ps.find(q=>q.team===ot).sx, tx=vx+sx*(2.2+Math.random()*4.4), tz=zc+(Math.random()*2-1)*3.6;
      const rec=nearest(ot,tx,tz), r0=ps[from].r; let ty=.85; if(miss){ ty=0; } const p1=_b.set(tx,gyAt(tx,tz)+ty,tz);
      if(miss){ const rr=ps[rec].r, dx=tx-rr.x, dz=tz-rr.z, d=Math.hypot(dx,dz)||1; p1.x=rr.x+dx/d*(d+2.4); p1.z=rr.z+dz/d*(d+2.4); p1.y=gyAt(p1.x,p1.z)+.11; }
      launch(B,hand(r0,kind==='serve'?2.6:2.5),p1,kind==='serve'?1.75:1.05+Math.random()*.35); Object.assign(S,{mode:'flight',rec,kind,miss,last:from,touches:0}); }
    function passTo(from,partner){ const r0=ps[from].r, h=ps[partner].home, tx=vx+ps[partner].sx*1.4, tz=h.z*.6+zc*.4;
      launch(B,hand(r0,.9),_b.set(tx,gyAt(tx,tz)+2.45,tz),1.15); Object.assign(S,{mode:'flight',rec:partner,kind:'set',miss:false,last:from}); }
    const step=(dt)=>{ ps.forEach(pl=>tickPose(pl.r,dt));
      if(S.mode==='flight'){ B.t+=dt; B.v.y-=G*dt; B.p.addScaledVector(B.v,dt);
        // the receiver goes to meet it: where the ball will be at the end of its flight (its own hand height)
        const rec=ps[S.rec], r=rec.r, tl=Math.max(0,B.T-B.t), px=B.p.x+B.v.x*tl, pz=B.p.z+B.v.z*tl, ball=Math.atan2(B.p.x-r.x,B.p.z-r.z);
        moveTo(r,px-Math.sin(r.ry)*.3,pz-Math.cos(r.ry)*.3,ball,dt,S.miss?2.2:4.2);
        ps.forEach((pl,i)=>{ if(i!==S.rec) moveTo(pl.r,pl.home.x,pl.home.z,Math.atan2(B.p.x-pl.r.x,B.p.z-pl.r.z),dt,2); });
        if(B.t>=B.T&&!S.miss){ // played: the team's first touch goes up to the partner, the second goes over
          const pl=rec, partner=ps.findIndex((q,i)=>q.team===pl.team&&i!==S.rec);
          if(S.kind==='set'){ pose(r,'Spike',.4); sendOver(S.rec,'attack',Math.random()<.16); }
          else { pose(r,'Bump',.45); passTo(S.rec,partner); } }
        else if(S.miss&&B.p.y<=gyAt(B.p.x,B.p.z)+.11){ S.mode='down'; S.timer=1.4; B.p.y=gyAt(B.p.x,B.p.z)+.11; B.v.y=Math.abs(B.v.y)*.38; B.v.x*=.55; B.v.z*=.55; } }
      else if(S.mode==='down'){ // bouncing, rolling to a stop in the sand
        B.v.y-=G*dt; B.p.addScaledVector(B.v,dt); const gy=gyAt(B.p.x,B.p.z)+.11; if(B.p.y<gy){ B.p.y=gy; B.v.y=Math.abs(B.v.y)*.38; B.v.x*=.6; B.v.z*=.6; if(B.v.y<.4) B.v.y=0; }
        if(B.v.y===0){ const f=Math.exp(-3*dt); B.v.x*=f; B.v.z*=f; }
        ps.forEach(pl=>moveTo(pl.r,pl.home.x,pl.home.z,Math.atan2(B.p.x-pl.r.x,B.p.z-pl.r.z),dt,1.4));
        S.timer-=dt; if(S.timer<=0){ S.mode='fetch'; S.server=nearest(ps[S.rec].team,B.p.x,B.p.z); } }
      else if(S.mode==='fetch'){ const pl=ps[S.server], r=pl.r, d=moveTo(r,B.p.x,B.p.z,Math.atan2(B.p.x-r.x,B.p.z-r.z),dt,1.6);
        ps.forEach((q,i)=>{ if(i!==S.server) moveTo(q.r,q.home.x,q.home.z,Math.atan2(r.x-q.r.x,r.z-q.r.z),dt,1.4); });
        if(d<.55){ S.mode='return'; pose(r,'Bump',.35); } }
      else if(S.mode==='return'){ const pl=ps[S.server], r=pl.r, bx=vx+pl.sx*8.2, bz=zc+(S.server%2?1.5:-1.5); B.p.copy(hand(r,1.05));
        const d=moveTo(r,bx,bz,faceNet(pl),dt,1.5); ps.forEach((q,i)=>{ if(i!==S.server) moveTo(q.r,q.home.x,q.home.z,faceNet(q),dt,1.4); });
        if(d<.2&&Math.abs(wrapA(r.ry-faceNet(pl)))<.2){ S.mode='serve'; S.timer=1.1; } }
      else if(S.mode==='serve'){ const pl=ps[S.server], r=pl.r; S.timer-=dt; moveTo(r,r.x,r.z,faceNet(pl),dt,1);
        const u=clamp(1-S.timer/1.1,0,1), toss=u<.35?0:Math.sin(PI*(u-.35)/.65)*1.6; B.p.copy(hand(r,1.4+toss));   // the toss
        if(S.timer<=0){ pose(r,'Spike',.4); sendOver(S.server,'serve',Math.random()<.1); } }
      B.mesh.position.copy(B.p); B.mesh.rotation.x+=dt*4; B.mesh.rotation.y+=dt*2.3; };
    return {ps,B,S,step,spot,kind:'volleyball',
      add(PP,ci){ ps.forEach((pl,i)=>{ const o={x:pl.home.x,z:pl.home.z,type:'Idle',ry:faceNet(pl)}; o.beh=(r,dt)=>{ pl.r=r; if(r.x===undefined||r.v===undefined){ r.v=0; } if(i===0) game.tick(dt); }; PP.add(ci,o); pl.r=o; }); },
      tickT:-1}; };
  /* ---------- matkot ---------- */
  const PADDLE=(()=>{ const g=new THREE.BoxGeometry(.2,.012,.27), h=new THREE.BoxGeometry(.035,.03,.11); h.translate(0,0,-.18); const m=new THREE.MeshStandardMaterial({color:new THREE.Color(0xb98a52).convertSRGBToLinear(),roughness:.6}); return {g,h,m}; })();
  function attachPaddle(r){ const a=r.act; if(!a||a.paddle) return; const T=a.T, find=k=>{ let b=null; a.m.traverse(o=>{ if(!b&&o.name===T.map[k]) b=o; }); return b; }, w=find('WristR'), fa=find('LowerArmR'); if(!w||!fa) return;
    a.m.updateMatrixWorld(true); const wp=w.getWorldPosition(new THREE.Vector3()), dir=wp.clone().sub(fa.getWorldPosition(new THREE.Vector3())).normalize();
    const p=new THREE.Group(); p.add(new THREE.Mesh(PADDLE.g,PADDLE.m)); p.add(new THREE.Mesh(PADDLE.h,PADDLE.m)); p.children.forEach(c=>c.castShadow=true);
    ST.scene.add(p); p.position.copy(wp).addScaledVector(dir,.2); p.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir); p.updateMatrixWorld(true); w.attach(p); a.paddle=p; }
  GM.matkot=function(T,spot,group){ const x0=spot.x, d0=spot.d, gap=8.4;
    const B={p:new THREE.Vector3(),v:new THREE.Vector3(),t:0,T:1,mesh:ballMesh(.024,0x15161a,0x2a2b30)}; group.add(B.mesh);
    const ps=[0,1].map(i=>{ const x=x0+i*gap, z=T.wz(x,d0+(i?.6:0)); return {home:{x,z},i}; });
    const S={mode:'serve',timer:1.2,server:0,rec:1,miss:false,rally:0}; const _a=new THREE.Vector3(), _b=new THREE.Vector3();
    const face=i=>{ const o=ps[1-i].r||ps[1-i].home, s=ps[i].r||ps[i].home; return Math.atan2(o.x-s.x,o.z-s.z); };
    const hand=r=>_a.set(r.x+Math.sin(r.ry)*.42+Math.cos(r.ry)*.22,gyAt(r.x,r.z)+1.12,r.z+Math.cos(r.ry)*.42-Math.sin(r.ry)*.22);
    function hit(from){ const to=1-from, r0=ps[from].r, h=ps[to].home, ax=h.x-r0.x, az=h.z-r0.z, al=Math.hypot(ax,az)||1, side=(Math.random()*2-1)*.75, miss=Math.random()<.05+Math.min(.06,S.rally*.003);
      let tx=h.x+(-az/al)*side+(ax/al)*(-.4), tz=h.z+(ax/al)*side+(az/al)*(-.4), ty=gyAt(tx,tz)+.85+Math.random()*.55;
      if(miss){ tx+=(-az/al)*Math.sign(side||1)*2.6+ax/al*2; tz+=(ax/al)*Math.sign(side||1)*2.6+az/al*2; ty=gyAt(tx,tz)+.03; }
      const p0=hand(r0).clone(), dist=Math.hypot(tx-p0.x,tz-p0.z), sp=11+Math.min(5,S.rally*.25)+Math.random()*2;
      launch(B,p0,_b.set(tx,ty,tz),dist/sp); Object.assign(S,{mode:'flight',rec:to,miss}); S.rally++;
      pose(r0,'Swing',.24); const cp=ST.camera.position, dd=Math.hypot(cp.x-p0.x,cp.z-p0.z); if(ST.Audio&&ST.Audio.tock) ST.Audio.tock(clamp(1-dd/55,0,1)); }
    const step=dt=>{ ps.forEach(pl=>{ tickPose(pl.r,dt); attachPaddle(pl.r); });
      if(S.mode==='flight'){ B.t+=dt; B.v.y-=G*dt; B.p.addScaledVector(B.v,dt); const rec=ps[S.rec], r=rec.r, tl=Math.max(0,B.T-B.t);
        const px=B.p.x+B.v.x*tl, pz=B.p.z+B.v.z*tl; moveTo(r,S.miss?r.x:px-Math.sin(face(S.rec))*.42,S.miss?r.z:pz-Math.cos(face(S.rec))*.42,face(S.rec),dt,2.4);
        moveTo(ps[1-S.rec].r,ps[1-S.rec].home.x,ps[1-S.rec].home.z,face(1-S.rec),dt,1.6);
        if(!S.miss&&B.t>=B.T) hit(S.rec);
        else if(S.miss&&B.p.y<=gyAt(B.p.x,B.p.z)+.03){ S.mode='down'; S.timer=1; B.v.multiplyScalar(.25); B.v.y=1; S.rally=0; } }
      else if(S.mode==='down'){ B.v.y-=G*dt; B.p.addScaledVector(B.v,dt); const gy=gyAt(B.p.x,B.p.z)+.024; if(B.p.y<gy){ B.p.y=gy; B.v.y=Math.abs(B.v.y)*.3; B.v.x*=.5; B.v.z*=.5; if(B.v.y<.3) B.v.y=0; }
        S.timer-=dt; if(S.timer<=0){ S.mode='fetch'; S.server=S.rec; } }
      else if(S.mode==='fetch'){ const r=ps[S.server].r, d=moveTo(r,B.p.x,B.p.z,Math.atan2(B.p.x-r.x,B.p.z-r.z),dt,1.5); if(d<.45){ S.mode='return'; pose(r,'Bump',.3); } }
      else if(S.mode==='return'){ const pl=ps[S.server], r=pl.r; B.p.copy(hand(r)); const d=moveTo(r,pl.home.x,pl.home.z,face(S.server),dt,1.5); if(d<.2){ S.mode='serve'; S.timer=.7; } }
      else if(S.mode==='serve'){ const r=ps[S.server].r; S.timer-=dt; moveTo(r,r.x,r.z,face(S.server),dt,1); B.p.copy(hand(r)); B.p.y+=Math.sin(PI*clamp(1-S.timer/.7,0,1))*.35; if(S.timer<=0) hit(S.server); }
      B.mesh.position.copy(B.p); };
    return {ps,B,S,step,spot,kind:'matkot',
      add(PP,ci){ ps.forEach((pl,i)=>{ const o={x:pl.home.x,z:pl.home.z,type:'Idle',ry:0}; o.beh=(r,dt)=>{ pl.r=r; if(i===0) game.tick(dt); }; PP.add(ci,o); pl.r=o; }); }}; };
  let game=null;
  /* a set of games for a town: every game steps once a frame (from its first player's turn in People.update) */
  GM.build=function(T,group,list){ GM.list.forEach(g=>{ if(g.B&&g.B.mesh.parent) g.B.mesh.parent.remove(g.B.mesh); }); GM.list=[];
    for(const it of list){ const g=GM[it.kind](T,it,group); g.ps.forEach((pl,i)=>{ pl.home.y=gyAt(pl.home.x,pl.home.z); }); GM.list.push(g); }
    game={tick:dt=>{ const f=ST.People.frame; if(game.f===f) return; game.f=f; for(const g of GM.list){ if(g.ps.every(pl=>pl.r&&pl.r.x!==undefined)) g.step(Math.min(dt,.05)); } }};
    return GM.list; };
  GM.register=function(PP,ci){ GM.list.forEach(g=>g.add(PP,ci)); };
  ST.Games=GM;
})(window.ST);
