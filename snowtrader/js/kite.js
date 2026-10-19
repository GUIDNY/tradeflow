/* Surf Rush: kitesurfing — the wind, the kite, the board on the sea, the rider.
   The wind blows side-onshore (from the sea's left, 25° in toward the beach), 17 knots. The kite flies on the "wind window",
   the quarter sphere downwind of the rider, 22 m out on its lines: azimuth az (0 = straight downwind, + toward the sea)
   and elevation el. It pulls along its lines, hardest low in the middle of the window, little at the edge or overhead,
   harder the faster it moves (its own speed adds to its airspeed), and less when the rider runs away downwind (the wind it
   flies in is the wind less the rider's speed). The kite is flown for the player: it sits ahead on the side the board is
   heading to (further to the edge when pointing upwind), sines up and down for power, goes up and over in a turn through
   the wind, and is sent up for a jump.
   The board planes on the water: it slides easily along its length and hardly at all across it (its edge and fins), so the
   kite's pull drives it along whatever line the rider holds — across the wind, a little upwind, or faster downwind. Below
   planing speed it sinks and drags. A jump: load the edge (hold), let go: the kite is sent up while the edge holds, and
   the rider pops off the water as the kite passes about 11 o'clock and its pull turns upward. Coming down, the falling
   rider drags the kite through the air and it holds them like a parachute; near the water it is brought forward again.
   Landings are clean when the board comes down on its line (a twin-tip lands either way round), after whole turns, and
   not too hard; otherwise the rider crashes in, the kite drops to the edge, relaunches, and pulls the rider up again (a
   water start). The numbers that set all this are in K.C (17 knots: ~33 km/h across the wind, 2-5 m jumps). */
(function(ST){
  const {clamp,lerp,damp,smooth}=ST; const {scene,camera}=ST; const PI=Math.PI, TAU=2*PI, DEG=PI/180, Cst=ST.Coast;
  const K={};
  /* ---------- the wind ---------- */
  const WIND={knots:17}; WIND.v=WIND.knots*.5144;
  const D=new THREE.Vector3(Math.cos(25*DEG),0,Math.sin(25*DEG));          // downwind
  const CW=new THREE.Vector3(D.z,0,-D.x);                                   // crosswind (toward the sea)
  K.WIND=WIND; K.D=D; K.CW=CW;
  const LINES=22, MASS=82, G=9.81;
  /* the numbers that make it ride (one place, so the tests and the tuning see the same ones) */
  const C=K.C={
    P0:17.2,        // the kite's pull per (m/s)² of wind, parked in the middle of the window (N)
    winExp:1.25,    // how fast the pull falls toward the window's edge
    ksK:.5,         // the kite's own motion across the sky adds to its airspeed (per rad/s)
    appK:.35,       // riding downwind takes wind from the kite, upwind gives it more (the apparent wind it flies in)
    depow:.65,      // the bar pushed out
    sendK:40, sendW:3.4,  // the kite sent up for a jump: its spring and top speed
    edgeDrag:.15,   // an edge holding against the pull drags (N per N it holds)
    c1slow:70, c1plan:7, c2:3.3,   // the board's drag along its length: N per m/s, sinking and planing; N per (m/s)²
    plan0:2.2, plan1:4.2,          // planing comes in between these speeds (m/s)
    grip:300, gripV:40, gripLoad:220,   // the edge and the fins across the board: N per m/s, more at speed and when loaded
    slope:.6,       // the waves' slope pushes the board down their face
    turn0:.9, turnV:.13, turnMax:2.3,   // carving: rad/s, more at speed
    pop0:1.6, popCharge:2.2, popV:.18,  // the pop off the edge: m/s, + a full load, + per m/s of speed
    popDrag:60,     // the edge dug in hard while the kite goes up (N per m/s)
    send:.55, popEl:46, popMax:.32,   // the kite sent up for a jump (s after the pop); the rider leaves the water as it passes this elevation (deg), or after this long (s)
    para:35,        // the kite as a parachute coming down: N per (m/s)² of fall
    spinW:7.2, flipW:6.2,          // rad/s at full rotation
    landYaw:.75, landRoll:.9, landImp:8.5, landAlong:.55   // the limits of a clean landing
  };
  /* ---------- the state ---------- */
  const S={x:0,z:0,y:0,vx:0,vz:0,vy:0,h:0,sw:false,air:false,airT:0,edge:0,lean:0,t:0,speed:0,maxSpeed:0,
    kite:{az:0,el:1.3,vaz:0,vel:0,side:1},pull:0,pullV:new THREE.Vector3(),charge:0,charging:false,send:0,redirect:0,
    spin:0,wsp:0,flip:0,wfl:0,grab:0,grabbed:false,grabName:'',grabs:[],fall:null,jump:null,ys:0,vys:0,land:0,landImp:0,dist:0,yawRes:0,rollRes:0,far:0,prevJump:false,prevGrab:false,prepop:0,jumpQ:0};
  K.S=S; K.events=[];
  const ev=e=>K.events.push(e);
  /* ---------- the kite on the wind window ---------- */
  const _k=new THREE.Vector3();
  function kiteDir(az,el,out){ const ce=Math.cos(el); return (out||_k).set(ce*(Math.cos(az)*D.x+Math.sin(az)*CW.x),Math.sin(el),ce*(Math.cos(az)*D.z+Math.sin(az)*CW.z)); }
  K.kiteDir=kiteDir;
  /* The kite is flown for the rider: where it should be on the window for what the rider is doing, reached by a damped spring
     whose speed is limited (a kite crosses the sky at 1-2.5 rad/s). The pull grows toward the window's middle and with the
     kite's own speed, and falls when the rider runs away downwind (less wind reaches the kite). */
  function flyKite(dt,c){ const k=S.kite, F=S.fall;
    // the side: the one the board points toward, once it is turned well past straight downwind (the rider sends the kite
    // over as the board comes round); changing it takes the kite up and over the top
    const hc=Math.sin(S.h)*CW.x+Math.cos(S.h)*CW.z;
    if(!F&&!S.air&&Math.abs(hc)>.42&&Math.sign(hc)!==k.side) k.side=Math.sign(hc);
    const s=k.side, upw=clamp(-(Math.sin(S.h)*D.x+Math.cos(S.h)*D.z),0,1);   // how far the board points upwind
    let tAz=s*(55+22*upw), tEl=30, wmax=1.25, stiff=9, dmp=5.2;
    const hd=Math.sin(S.h)*D.x+Math.cos(S.h)*D.z;   // 1 = the board points straight downwind
    if(F){ if(F.ph==='down'||F.ph==='swim'){ tAz=s*82; tEl=8; } else { tAz=s*(F.ph==='relaunch'?60:45); tEl=F.ph==='relaunch'?72:24; wmax=F.ph==='start'?1.9:1.1; } }
    else if(S.send>0){ const q=S.jumpQ; tAz=s*lerp(30,10,q); tEl=lerp(62,82,q); wmax=C.sendW; stiff=C.sendK; dmp=2*.8*Math.sqrt(C.sendK); }
    else if(S.redirect>0){ tAz=s*38; tEl=54; wmax=1.0; }   // coming down: the kite forward again, so the rider lands going somewhere
    else if(S.air){ tAz=s*20; tEl=74; wmax=.9; }           // hanging at the top
    else if(hd>.77){ tAz=s*22; tEl=64; wmax=1.5; }   // carving downwind (a turn): the kite goes up toward the top, ready to cross
    else if(c.power){ const ph=S.t*TAU/1.25; tAz=s*(38+18*Math.sin(ph)); tEl=21+9*Math.cos(ph); wmax=2; }
    else if(c.depow){ tEl=42; }
    tAz*=DEG; tEl*=DEG;
    // a transition: over the top to the other side (up first if it is low), then down into the new side
    const crossing=!F&&!S.air&&Math.sign(k.az)!==s&&Math.abs(k.az)>.06;
    if(crossing||(!F&&!S.air&&Math.abs(k.az)<.4)){ tEl=Math.max(tEl,66*DEG); wmax=Math.max(wmax,1.6); if(crossing&&k.el<45*DEG) tAz=k.az; }
    k.vaz+=((tAz-k.az)*stiff-k.vaz*dmp)*dt; k.vel+=((tEl-k.el)*stiff-k.vel*dmp)*dt; const w=Math.hypot(k.vaz,k.vel); if(w>wmax){ k.vaz*=wmax/w; k.vel*=wmax/w; }
    k.az=clamp(k.az+k.vaz*dt,-1.45,1.45); k.el=clamp(k.el+k.vel*dt,.05,1.45);
    const win=Math.pow(Math.max(0,Math.cos(k.el)*Math.cos(k.az)),C.winExp), ks=Math.min(Math.hypot(k.vaz*Math.cos(k.el),k.vel),2.5);
    const vD=S.vx*D.x+S.vz*D.z, Wa=Math.max(1.5,WIND.v-C.appK*vD), fk=F&&F.ph!=='start'?.15:1;
    // falling under the kite: the rider pulls it down through the air, which holds them up (the float of a kite jump)
    const para=S.air&&S.vy<0?C.para*S.vy*S.vy*Math.sin(k.el):0;
    S.pull=C.P0*Wa*Wa*win*Math.pow(1+C.ksK*ks,2)*(c.depow&&!S.air&&!F?C.depow:1)*fk+para; kiteDir(k.az,k.el,S.pullV).multiplyScalar(S.pull); }
  /* ---------- the board on the sea ---------- */
  const _w={}, _w2={};
  K.reset=function(at){ Object.assign(S,{x:at.x,z:at.z,vx:0,vz:0,vy:0,h:at.h!=null?at.h:Math.atan2(CW.x,CW.z),sw:false,air:false,airT:0,edge:0,lean:0,speed:0,maxSpeed:0,charge:0,charging:false,send:0,redirect:0,
      spin:0,wsp:0,flip:0,wfl:0,grab:0,grabbed:false,grabName:'',grabs:[],jump:null,land:0,landImp:0,dist:0,yawRes:0,rollRes:0,far:0,prevJump:false,prevGrab:false,prepop:0,jumpQ:0});
    const k=S.kite; k.az=82*DEG*(at.side||1); k.el=10*DEG; k.vaz=0; k.vel=0; k.side=at.side||1; Cst.water(S.x,S.z,null,_w); S.y=_w.y; S.ys=_w.y; S.vys=0;
    S.fall={ph:'relaunch',t:0}; K.events.length=0; };
  const GRABS=['INDY','MUTE','TAIL','NOSE','STALE'];
  // let go of a spin or a roll: it finishes on the next whole turn if that is near enough ahead, else unwinds to the last one
  function assist(a,w){ const n=a/TAU; if(w>.5){ const t=Math.ceil(n-.02)*TAU; return t-a<.6*TAU?t:Math.floor(n)*TAU; } if(w<-.5){ const t=Math.floor(n+.02)*TAU; return a-t<.6*TAU?t:Math.ceil(n)*TAU; } return Math.round(n)*TAU; }
  function fall(why,extra){ S.fall=Object.assign({ph:'down',t:0},extra||{}); S.charging=false; S.charge=0; ev({type:'crash',why}); }
  /* one physics step; c = controls {steer -1..1 (+ = right), power, depow, jump (held), spin (held, air), spinDir (±1), grab (held), flip (held)} */
  K.step=function(dt,c){ S.t+=dt; const W=Cst.water(S.x,S.z,null,_w); flyKite(dt,c); const F=S.fall;
    const fx=Math.sin(S.h), fz=Math.cos(S.h), lx=fz, lz=-fx;   // along the board (its heading) and across it (to its left)
    S.yawRes=damp(S.yawRes,0,9,dt); S.rollRes=damp(S.rollRes,0,9,dt);
    if(F){ F.t+=dt;
      // in the water: the kite at the edge of the window drags the rider slowly; out of the shallows first
      S.vx=damp(S.vx,S.pullV.x/140,1.5,dt); S.vz=damp(S.vz,S.pullV.z/140,1.5,dt); if(F.shallow&&W.depth<1.4){ S.vz=Math.min(S.vz,-1.6); }
      S.x+=S.vx*dt; S.z+=S.vz*dt; S.y=W.y-.35; S.air=false; S.edge=damp(S.edge,0,4,dt); S.lean=damp(S.lean,0,4,dt);
      if(F.ph==='down'&&F.t>.8){ F.ph='swim'; F.t=0; } else if(F.ph==='swim'&&F.t>1.2&&!(F.shallow&&W.depth<1.4)){ F.ph='relaunch'; F.t=0; if(F.shallow) S.kite.side=1; }
      else if(F.ph==='relaunch'&&F.t>1.4){ F.ph='start'; F.t=0; }
      else if(F.ph==='start'&&S.pull>520){ S.fall=null; const s=S.kite.side; S.h=Math.atan2(CW.x*s,CW.z*s); const v0=3.2; S.vx=Math.sin(S.h)*v0; S.vz=Math.cos(S.h)*v0; S.y=W.y; S.ys=W.y; S.vys=0; ev({type:'up'}); }
      S.speed=Math.hypot(S.vx,S.vz); S.prevJump=c.jump; S.prevGrab=c.grab; return; }
    const vf=S.vx*fx+S.vz*fz, vl=S.vx*lx+S.vz*lz, sp=Math.hypot(S.vx,S.vz);
    if(!S.air){
      // steering: the board carves round, quicker at speed
      const wTurn=clamp(C.turn0+C.turnV*Math.abs(vf),C.turn0,C.turnMax)*(c.depow?1.15:1); S.h-=c.steer*wTurn*dt;
      // the kite's pull, the drag along the board (it sinks and drags below planing speed), the edge across it, the waves' slope
      const plan=smooth(C.plan0,C.plan1,Math.abs(vf)), c1=lerp(C.c1slow,C.c1plan,plan)+(S.prepop>0?C.popDrag:0), kl=C.grip+C.gripV*Math.min(Math.abs(vf),12)+(S.charging||S.prepop>0?C.gripLoad:0);
      let ax=S.pullV.x/MASS, az=S.pullV.z/MASS; const fd=-(c1+C.c2*Math.abs(vf)+C.edgeDrag*kl*Math.abs(vl)/Math.max(Math.abs(vf),1))*vf/MASS, fl=-kl*vl/MASS;
      ax+=fd*fx+fl*lx+W.nx*G*C.slope; az+=fd*fz+fl*lz+W.nz*G*C.slope;
      S.vx+=ax*dt; S.vz+=az*dt;
      if(S.vx*fx+S.vz*fz<-.5) S.h+=PI;   // pushed backwards: now heading the other way (a twin-tip rides both ways)
      S.x+=S.vx*dt; S.z+=S.vz*dt;
      // on the surface: its rise and fall
      const W2=Cst.water(S.x,S.z,null,_w2), vys=(W2.y-S.ys)/dt; S.ys=W2.y; S.y=W2.y; S.vys=vys;
      // a jump: load the edge (hold); let go and the kite is sent up, the edge dug in against it; the rider pops off the water as
      // the kite passes about 11 o'clock and its pull turns upward
      S.charging=c.jump&&sp>3&&!(S.prepop>0); if(S.charging) S.charge=Math.min(1,S.charge+dt/.7); else if(!(S.prepop>0)) S.charge=Math.max(0,S.charge-dt*2);
      if(S.prevJump&&!c.jump&&sp>3&&S.charge>.12&&!(S.prepop>0)){ S.prepop=C.popMax; S.jumpQ=S.charge; S.send=9; S.charge=0; }
      if(S.prepop>0){ S.prepop-=dt;
        if(S.kite.el>C.popEl*DEG||S.prepop<=0){ const q=S.jumpQ; S.prepop=0; S.vy=C.pop0+C.popCharge*q+C.popV*sp+Math.max(0,vys)*.6; S.air=true; S.airT=0; S.send=C.send; S.redirect=0;
          S.jump={y0:S.y,maxY:S.y,t0:S.t,charge:q,v0:sp}; S.spin=S.wsp=S.flip=S.wfl=0; S.grabs=[]; S.grabT=0; ev({type:'jump',charge:q,v:+sp.toFixed(1)}); } }
      // the lean back against the kite (its horizontal pull against the weight) and the heel edge in the water
      const pullH=Math.hypot(S.pullV.x,S.pullV.z); S.lean=damp(S.lean,Math.atan2(pullH*.92,MASS*G),6,dt); S.edge=damp(S.edge,clamp(S.lean*.7+(S.charging?.18:0),0,.85),8,dt);
      if(S.land>0) S.land-=dt;
      // the shallows: the fins catch the sand
      if(W2.depth<.5) fall('shallow',{shallow:true});
    } else {
      // in the air: gravity, the kite's pull, a little drag; spins and back rolls
      S.airT+=dt; if(S.send>0) S.send-=dt;
      if(!(S.redirect>0)&&S.send<=0&&S.vy<-1){ Cst.water(S.x,S.z,null,_w2); if(S.y-_w2.y<2.6+Math.max(0,-S.vy-3)*.5) S.redirect=9; }
      S.vx+=(S.pullV.x/MASS-S.vx*.05)*dt; S.vz+=(S.pullV.z/MASS-S.vz*.05)*dt; S.vy+=(S.pullV.y/MASS-G-S.vy*.06)*dt;
      S.x+=S.vx*dt; S.z+=S.vz*dt; S.y+=S.vy*dt; if(S.jump) S.jump.maxY=Math.max(S.jump.maxY,S.y);
      if(c.spin) S.wsp=damp(S.wsp,(c.spinDir||1)*C.spinW,6,dt); else { const t=assist(S.spin,S.wsp); S.wsp=damp(S.wsp,clamp((t-S.spin)*6,-C.spinW,C.spinW),5,dt); }
      S.spin+=S.wsp*dt;   // + = turning right, the way the board turns when steered right
      if(c.flip) S.wfl=damp(S.wfl,C.flipW,5,dt); else { const t=assist(S.flip,S.wfl); S.wfl=damp(S.wfl,clamp((t-S.flip)*5,-C.flipW,C.flipW),4,dt); }
      S.flip+=S.wfl*dt;
      if(c.grab&&!S.prevGrab){ S.grabbed=true; const n=GRABS[S.grabs.length%GRABS.length]; S.grabName=n; if(!S.grabs.includes(n)) S.grabs.push(n); }
      if(!c.grab) S.grabbed=false; S.grab=damp(S.grab,S.grabbed?1:0,10,dt); if(S.grabbed) S.grabT+=dt;
      const W2=Cst.water(S.x,S.z,null,_w2);
      if(S.y<=W2.y&&S.vy<0) land(W2);
      S.lean=damp(S.lean,.25,3,dt); S.edge=damp(S.edge,0,3,dt); }
    // out of the riding area: a hint, and the sea nudges the rider back
    const off=Cst.shoreZ(S.x)-S.z, fx2=S.x<-340?1:S.x>400?-1:0, fz2=off>420?1:0; S.far=fx2||fz2?Math.min(1,S.far+dt):Math.max(0,S.far-dt);
    if(fx2) S.vx+=fx2*1.2*dt; if(fz2) S.vz+=fz2*1.2*dt;
    S.prevJump=c.jump; S.prevGrab=c.grab; S.speed=Math.hypot(S.vx,S.vz); S.maxSpeed=Math.max(S.maxSpeed,S.speed); S.dist+=S.speed*dt; };
  function land(W){ const J=S.jump||{y0:S.y,maxY:S.y,t0:S.t}, h=Math.max(0,J.maxY-J.y0), turns=Math.round(S.spin/TAU), yawErr=Math.abs(S.spin-turns*TAU), rolls=Math.round(S.flip/TAU), rollErr=Math.abs(S.flip-rolls*TAU), imp=-S.vy;
    const sp=Math.hypot(S.vx,S.vz), along=sp>.5?(Math.sin(S.h)*S.vx+Math.cos(S.h)*S.vz)/sp:1;
    const clean=yawErr<C.landYaw&&rollErr<C.landRoll&&imp<C.landImp&&Math.abs(along)>C.landAlong;
    S.air=false; S.y=W.y; S.ys=W.y; S.vys=0; S.vy=0; S.land=.45; S.landImp=imp; if(along<0) S.h+=PI;   // a twin-tip lands either way round
    S.yawRes=S.spin-turns*TAU; S.rollRes=S.flip-rolls*TAU;
    const out={type:'land',h:+h.toFixed(2),air:+(S.t-J.t0).toFixed(2),turns:Math.abs(turns),spinDir:Math.sign(turns),rolls:Math.abs(rolls),grabs:S.grabs.slice(),grabT:S.grabT||0,clean,imp:+imp.toFixed(1),
      sketchy:clean&&(yawErr>.45||imp>7)};
    S.spin=0; S.flip=0; S.wsp=0; S.wfl=0; S.grab=0; S.grabbed=false; S.jump=null; S.send=0; S.redirect=0;
    if(!clean){ S.yawRes=S.rollRes=0; fall(yawErr>=C.landYaw?'sideways':rollErr>=C.landRoll?'rotation':imp>=C.landImp?'too hard':'off the line'); }
    ev(out); }
  /* ---------- meshes: the kite, its lines and bar, the board ----------
     The kite: a 12 m² leading-edge inflatable, the freeride kind. 7.5 m of leading edge laid flat; in the air about 5.5 m
     across and 2 m deep (flatter in the middle, curving hard into the tips); a 2 m chord in the middle tapering to 45 cm at the
     swept-back tips; the leading edge an inflated tube 18 cm thick in the middle and 8 at the tips, and three struts along the
     chord on the side toward the rider; the canopy cambered, billowing between the struts, in big panels of colour with the
     logo across the middle. The bridle: each front line ends in a pigtail ~2.7 m under the kite that fans out to four points
     on its half of the leading edge; the back lines tie to the wingtips. In the kite's own frame: x across the span, y away
     from the rider (the tips bend toward -y), z upwind (the leading edge forward). */
  K.KITES=[{name:'Fire',a:0xff3b30,b:0xffffff,c:0x111111},{name:'Ocean',a:0x00a6fb,b:0xffffff,c:0x0b2545},{name:'Lime',a:0x9ef01a,b:0x111111,c:0xffffff},{name:'Sunset',a:0xff8800,b:0xffd000,c:0x7b2cbf}];
  const KD={S:3.75,a:.232,b:.0144,c0:2,c1:.45,sweep:.7,r0:.09,r1:.04,struts:[-1.85,0,1.85],bridle:[.35,1.15,1.95,2.75],pig:{x:1.05,y:-2.7}};
  // the leading edge at arc length s from the middle: where (x,y,z), its outward normal (nx,ny), the chord and the tube's radius there
  function leAt(s,o){ const as=Math.min(Math.abs(s),KD.S), sg=s<0?-1:1, n=24, ds=as/n; let x=0,y=0;
    for(let i=0;i<n;i++){ const t=(i+.5)*ds, th=KD.a*t+KD.b*t*t*t; x+=Math.cos(th)*ds; y-=Math.sin(th)*ds; }
    const th=KD.a*as+KD.b*as*as*as, u=as/KD.S; o.x=sg*x; o.y=y; o.z=-KD.sweep*u*u; o.nx=sg*Math.sin(th); o.ny=Math.cos(th); o.c=lerp(KD.c0,KD.c1,Math.pow(u,1.6)); o.r=lerp(KD.r0,KD.r1,Math.pow(u,1.4)); return o; }
  // between two struts the canopy billows and its trailing edge curves in
  const panelK=s=>{ const B=[-KD.S].concat(KD.struts,[KD.S]); for(let i=0;i<B.length-1;i++) if(s>=B[i]&&s<=B[i+1]){ const f=Math.sin(PI*(s-B[i])/(B[i+1]-B[i])); return f*f; } return 0; };
  // a point on the canopy: span s, chord fraction u (0 the leading edge, 1 the trailing edge)
  const _ka={};
  function canopyAt(s,u,o){ const L=leAt(s,_ka), pk=panelK(s), c=L.c*(1-.05*pk*u*u), cam=c*(.085+.025*pk)*Math.pow(u,.6)*(1-u)/.347;
    o.set(L.x+L.nx*cam,L.y+L.ny*cam,L.z-L.r*.6-c*u); return o; }
  // the canopy's look: panels parallel to the leading edge, a big block of colour, the logo across the middle (one per scheme)
  const kiteTex={};
  function kiteTexture(sc){ const key=sc.name; if(kiteTex[key]) return kiteTex[key];
    const cv=document.createElement('canvas'); cv.width=1024; cv.height=256; const g=cv.getContext('2d'), hex=c=>'#'+new THREE.Color(c).getHexString();
    const A=hex(sc.a), B=hex(sc.b), Cc=hex(sc.c);
    g.fillStyle=B; g.fillRect(0,0,1024,256);
    g.fillStyle=A; g.beginPath(); g.moveTo(0,0); g.lineTo(380,0); g.bezierCurveTo(330,90,300,170,250,256); g.lineTo(0,256); g.fill();   // the outer panels in the main colour
    g.beginPath(); g.moveTo(1024,0); g.lineTo(644,0); g.bezierCurveTo(694,90,724,170,774,256); g.lineTo(1024,256); g.fill();
    g.fillStyle=Cc; g.fillRect(0,0,1024,22); g.fillRect(0,0,60,256); g.fillRect(964,0,60,256);   // a band behind the leading edge, the tips
    g.fillStyle=A; g.globalAlpha=.9; g.fillRect(380,200,264,56); g.globalAlpha=1;   // a stripe along the trailing edge in the middle
    g.strokeStyle='rgba(0,0,0,.16)'; g.lineWidth=2; for(const v of [64,128,192]){ g.beginPath(); g.moveTo(0,v); g.lineTo(1024,v); g.stroke(); }   // the seams of the panels
    for(const u of KD.struts.map(s=>(s+KD.S)/(2*KD.S)*1024)){ g.strokeStyle='rgba(0,0,0,.22)'; g.lineWidth=5; g.beginPath(); g.moveTo(u,0); g.lineTo(u,240); g.stroke(); }
    g.save(); g.translate(512,118); g.fillStyle=sc.b===0x111111?'#ffffff':Cc; g.font='bold 92px Anton, Impact, sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('SURF RUSH',0,0);
    g.font='bold 34px Anton, Impact, sans-serif'; g.fillText('12',300,62); g.restore();
    const t=new THREE.CanvasTexture(cv); t.encoding=THREE.sRGBEncoding; t.anisotropy=4; return kiteTex[key]=t; }
  // the geometry: the canopy (a textured surface), the tubes (leading edge and struts, a solid colour), the bridle (lines)
  function kiteGeo(sc){ const NS=44, NC=12, P=[], U=[], I=[], v=new THREE.Vector3();
    for(let i=0;i<=NS;i++){ const s=-KD.S+2*KD.S*i/NS; for(let j=0;j<=NC;j++){ const u=Math.pow(j/NC,1.2); canopyAt(s,u,v); P.push(v.x,v.y,v.z); U.push(i/NS,1-u); } }
    for(let i=0;i<NS;i++) for(let j=0;j<NC;j++){ const a=i*(NC+1)+j, b=a+NC+1; I.push(a,b,a+1,a+1,b,b+1); }
    const canopy=new THREE.BufferGeometry(); canopy.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); canopy.setAttribute('uv',new THREE.Float32BufferAttribute(U,2)); canopy.setIndex(I); canopy.computeVertexNormals();
    // the tubes: a ring of 10 round the leading edge at each step; each strut a tapering tube along the chord on the rider's side
    const T=[], TI=[], ring=(cx,cy,cz,ax,ay,az,r,k)=>{ // a ring round the axis (ax,ay,az)
      const a=new THREE.Vector3(ax,ay,az).normalize(), b=Math.abs(a.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0), e1=new THREE.Vector3().crossVectors(a,b).normalize(), e2=new THREE.Vector3().crossVectors(a,e1);
      for(let q=0;q<k;q++){ const t=q/k*2*PI; T.push(cx+(e1.x*Math.cos(t)+e2.x*Math.sin(t))*r,cy+(e1.y*Math.cos(t)+e2.y*Math.sin(t))*r,cz+(e1.z*Math.cos(t)+e2.z*Math.sin(t))*r); } };
    const tube=(n,k)=>{ const base=T.length/3-(n+1)*k; for(let i=0;i<n;i++) for(let q=0;q<k;q++){ const a=base+i*k+q, b=base+i*k+(q+1)%k, c=a+k, d=b+k; TI.push(a,c,b,b,c,d); } };
    const L0={}, L1={}, NL=44; for(let i=0;i<=NL;i++){ const s=-KD.S+2*KD.S*i/NL; leAt(s,L0); leAt(Math.min(KD.S,s+.02),L1); const tx=L1.x-L0.x||1e-4, ty=L1.y-L0.y, tz=L1.z-L0.z; ring(L0.x,L0.y,L0.z-L0.r*.3,tx,ty,tz,L0.r,10); } tube(NL,10);
    for(const st of KD.struts){ const NSt=8; for(let i=0;i<=NSt;i++){ const u=lerp(.04,.86,i/NSt), p0=canopyAt(st,u,new THREE.Vector3()), p1=canopyAt(st,Math.min(1,u+.02),new THREE.Vector3()), Ls=leAt(st,{}); const r=Ls.r*.55*(1-.6*i/NSt);
        ring(p0.x-Ls.nx*r*.9,p0.y-Ls.ny*r*.9,p0.z,p1.x-p0.x,p1.y-p0.y,p1.z-p0.z||-1e-4,r,8); } tube(NSt,8); }
    const tubes=new THREE.BufferGeometry(); tubes.setAttribute('position',new THREE.Float32BufferAttribute(T,3)); tubes.setIndex(TI); tubes.computeVertexNormals();
    // the bridle: from each pigtail to four points along the front of the tube on its side; and the pigtails' own short lines
    const BR=[]; for(const sg of [-1,1]){ const pg=[sg*KD.pig.x,KD.pig.y,leAt(0,{}).z-.35]; for(const s of KD.bridle){ const L=leAt(sg*s,{}); BR.push(...pg,L.x-L.nx*L.r,L.y-L.ny*L.r,L.z+L.r*.3); } }
    const bridle=new THREE.BufferGeometry(); bridle.setAttribute('position',new THREE.Float32BufferAttribute(BR,3));
    return {canopy,tubes,bridle}; }
  const tubeMats={}, canopyMats={};
  function kiteObj(sc,withBridle){ const G=kiteGeo(sc), g=new THREE.Group();
    const cm=canopyMats[sc.name]||(canopyMats[sc.name]=new THREE.MeshStandardMaterial({map:kiteTexture(sc),roughness:.62,metalness:0,side:THREE.DoubleSide}));
    const tm=tubeMats[sc.name]||(tubeMats[sc.name]=new THREE.MeshStandardMaterial({color:new THREE.Color(sc.c===0xffffff||sc.b===0x111111?0x16181d:sc.c).convertSRGBToLinear(),roughness:.5,metalness:0}));
    const c=new THREE.Mesh(G.canopy,cm), t=new THREE.Mesh(G.tubes,tm); c.castShadow=t.castShadow=true; g.add(c); g.add(t);
    if(withBridle){ const b=new THREE.LineSegments(G.bridle,new THREE.LineBasicMaterial({color:0x3a3a3a,transparent:true,opacity:.7})); b.frustumCulled=false; g.add(b); }
    g.userData.kite=1; return g; }
  K.kiteGeo=kiteGeo; K.kiteObj=kiteObj;
  /* where the lines attach, in the kite's frame: the back lines at the wingtips (the trailing corner), the front lines at the
     pigtails under the kite */
  const KP=(()=>{ const T=canopyAt(KD.S,1,new THREE.Vector3()), z0=leAt(0,{}).z-.35; return {tipL:new THREE.Vector3(-T.x,T.y,T.z),tipR:T.clone(),frL:new THREE.Vector3(-KD.pig.x,KD.pig.y,z0),frR:new THREE.Vector3(KD.pig.x,KD.pig.y,z0)}; })();
  function makeKiteboard(){ const grp=new THREE.Group(), L=1.38, W=.42; const sh=new THREE.Shape(); const N=40; const hw=z=>{ const t=Math.abs(z)/(L/2); return W/2*Math.sqrt(Math.max(0,1-Math.pow(Math.max(0,t-.62)/.38,2.2))); };
    for(let i=0;i<=N;i++){ const z=-L/2+L*i/N; i?sh.lineTo(hw(z),-z):sh.moveTo(hw(z),-z); } for(let i=N;i>=0;i--){ const z=-L/2+L*i/N; sh.lineTo(-hw(z),-z); }
    const top=new THREE.ExtrudeGeometry(sh,{depth:.022,bevelEnabled:true,bevelThickness:.004,bevelSize:.006,bevelSegments:1,curveSegments:8}); top.rotateX(-PI/2);
    const p=top.attributes.position; for(let i=0;i<p.count;i++){ const z=p.getZ(i), t=Math.abs(z)/(L/2); p.setY(i,p.getY(i)+Math.pow(t,3)*.055); } top.computeVertexNormals();
    // the deck: a bold graphic in canvas
    const cv=document.createElement('canvas'); cv.width=128; cv.height=512; const g=cv.getContext('2d'); const gr=g.createLinearGradient(0,0,0,512); gr.addColorStop(0,'#ff3b30'); gr.addColorStop(.5,'#ffd000'); gr.addColorStop(1,'#00a6fb'); g.fillStyle=gr; g.fillRect(0,0,128,512);
    g.fillStyle='rgba(255,255,255,.9)'; g.font='bold 54px Anton, Impact'; g.save(); g.translate(64,256); g.rotate(-PI/2); g.textAlign='center'; g.fillText('SURF RUSH',0,18); g.restore();
    const tex=new THREE.CanvasTexture(cv); tex.encoding=THREE.sRGBEncoding; const uv=new Float32Array(p.count*2); for(let i=0;i<p.count;i++){ uv[i*2]=p.getX(i)/W+.5; uv[i*2+1]=p.getZ(i)/L+.5; } top.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    const deck=new THREE.Mesh(top,new THREE.MeshStandardMaterial({map:tex,roughness:.35,metalness:.05})); deck.castShadow=true; grp.add(deck);
    // pads and straps, fins
    const pad=new THREE.MeshStandardMaterial({color:0x22252b,roughness:.8}), strap=new THREE.MeshStandardMaterial({color:0x111111,roughness:.6}), fin=new THREE.MeshStandardMaterial({color:0x333333,roughness:.4});
    for(const z of [-.27,.27]){ const pd=new THREE.Mesh(new THREE.BoxGeometry(.16,.025,.24),pad); pd.position.set(0,.045,z); grp.add(pd); const st=new THREE.Mesh(new THREE.TorusGeometry(.085,.022,6,12,PI),strap); st.rotation.y=PI/2; st.position.set(0,.05,z+.02); st.scale.set(1,.9,1.2); grp.add(st); }
    for(const [x,z] of [[-.15,-.62],[.15,-.62],[-.15,.62],[.15,.62]]){ const f=new THREE.Mesh(new THREE.BoxGeometry(.006,.045,.06),fin); f.position.set(x,-.02,z); grp.add(f); }
    grp.userData.kiteboard=1; return grp; }
  K.makeKiteboard=makeKiteboard;
  /* ---------- spray, the wake, the buoys ---------- */
  const SPN=420, sp={pos:new Float32Array(SPN*3),vel:new Float32Array(SPN*3),life:new Float32Array(SPN),max:new Float32Array(SPN),size:new Float32Array(SPN),i:0};
  const spGeo=new THREE.BufferGeometry(); spGeo.setAttribute('position',new THREE.BufferAttribute(sp.pos,3)); spGeo.setAttribute('aLife',new THREE.BufferAttribute(sp.life,1)); spGeo.setAttribute('aMax',new THREE.BufferAttribute(sp.max,1)); spGeo.setAttribute('aSize',new THREE.BufferAttribute(sp.size,1));
  const spMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{px:{value:1}},vertexShader:'attribute float aLife; attribute float aMax; attribute float aSize; uniform float px; varying float vA; void main(){ vA=aMax>0.?clamp(aLife/aMax,0.,1.):0.; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=aSize*px*(1.4-vA*.6)*300./max(1.,-mv.z); }',
    fragmentShader:'varying float vA; void main(){ vec2 d=gl_PointCoord-.5; float r=length(d); if(r>.5) discard; gl_FragColor=vec4(vec3(.95,.98,1.),smoothstep(.5,.15,r)*vA*.85); }'});
  const spPts=new THREE.Points(spGeo,spMat); spPts.frustumCulled=false;
  function emit(x,y,z,vx,vy,vz,size,life){ const i=sp.i; sp.i=(sp.i+1)%SPN; sp.pos[i*3]=x; sp.pos[i*3+1]=y; sp.pos[i*3+2]=z; sp.vel[i*3]=vx; sp.vel[i*3+1]=vy; sp.vel[i*3+2]=vz; sp.life[i]=life; sp.max[i]=life; sp.size[i]=size; }
  function updateSpray(dt){ for(let i=0;i<SPN;i++){ if(sp.life[i]<=0) continue; sp.life[i]-=dt; sp.vel[i*3+1]-=9*dt; for(let k=0;k<3;k++) sp.pos[i*3+k]+=sp.vel[i*3+k]*dt; }
    spGeo.attributes.position.needsUpdate=true; spGeo.attributes.aLife.needsUpdate=true; spGeo.attributes.aMax.needsUpdate=true; spGeo.attributes.aSize.needsUpdate=true; spMat.uniforms.px.value=ST.renderer.getPixelRatio()*innerHeight/900; }
  K.splash=function(x,y,z,n,k){ for(let i=0;i<n;i++){ const a=Math.random()*PI*2, s=1+Math.random()*3.5*k; emit(x+Math.cos(a)*.5,y+.1,z+Math.sin(a)*.5,Math.cos(a)*s,2+Math.random()*4*k,Math.sin(a)*s,.25+Math.random()*.3,.5+Math.random()*.6); } };
  // the wake: a ribbon on the water behind the board, foam along its two edges (where the board cut the water), spreading and fading
  const WK=64, wk={pts:[],geo:new THREE.BufferGeometry()}; { const pos=new Float32Array(WK*2*3), al=new Float32Array(WK*2), u=new Float32Array(WK*2), idx=[]; for(let i=0;i<WK;i++){ u[i*2]=-1; u[i*2+1]=1; } for(let i=0;i<WK-1;i++){ const a=i*2; idx.push(a,a+2,a+1,a+1,a+2,a+3); }
    wk.geo.setAttribute('position',new THREE.BufferAttribute(pos,3)); wk.geo.setAttribute('aA',new THREE.BufferAttribute(al,1)); wk.geo.setAttribute('aU',new THREE.BufferAttribute(u,1)); wk.geo.setIndex(idx); }
  const wkMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:'attribute float aA; attribute float aU; varying float vA; varying float vU; varying vec2 vP; void main(){ vA=aA; vU=aU; vec4 w=modelMatrix*vec4(position,1.); vP=w.xz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader:'varying float vA; varying float vU; varying vec2 vP; float h(vec2 p){ return fract(sin(dot(floor(p),vec2(127.1,311.7)))*43758.5453); } void main(){ float e=abs(vU), n=h(vP*5.)*.5+h(vP*13.)*.5; float a=(smoothstep(.55,.92,e)*(1.-smoothstep(.92,1.,e))*.85+.1*(1.-e))*vA*(.55+.6*n); if(a<.01) discard; gl_FragColor=vec4(.95,.98,1.,a); }'});
  const wkMesh=new THREE.Mesh(wk.geo,wkMat); wkMesh.frustumCulled=false; wkMesh.renderOrder=2;
  const WK_LIFE=3.2;
  function updateWake(dt){ const L=wk.pts[wk.pts.length-1]; if(!S.air&&!S.fall&&S.speed>2.5&&(!L||Math.hypot(L.x-S.x,L.z-S.z)>.8)){ const pt={x:S.x,z:S.z,h:Math.atan2(S.vx,S.vz),t:S.t,w:.16+.012*S.speed};
      if(L&&L.gap) wk.pts.push(Object.assign({},pt,{gap:1}));   // a new stretch after a jump or a fall: no ribbon across the gap
      wk.pts.push(pt); while(wk.pts.length>WK) wk.pts.shift(); }
    else if(S.air||S.fall){ if(L) L.gap=1; }
    const pos=wk.geo.attributes.position.array, al=wk.geo.attributes.aA.array, n=wk.pts.length, W={};
    for(let i=0;i<WK;i++){ const p=wk.pts[i]; if(!p){ al[i*2]=al[i*2+1]=0; continue; } const age=S.t-p.t; if(age>WK_LIFE||p.gap){ al[i*2]=al[i*2+1]=0; continue; }
      Cst.water(p.x,p.z,null,W); const a=(1-age/WK_LIFE)*Math.min(1,i/(n||1)*3), w=p.w*(1+age*.6), cx=Math.cos(p.h), cz=-Math.sin(p.h);
      pos[i*6]=p.x-cx*w; pos[i*6+1]=W.y+.03; pos[i*6+2]=p.z-cz*w; pos[i*6+3]=p.x+cx*w; pos[i*6+4]=W.y+.03; pos[i*6+5]=p.z+cz*w; al[i*2]=al[i*2+1]=a; }
    wk.geo.attributes.position.needsUpdate=true; wk.geo.attributes.aA.needsUpdate=true; }
  // buoys: ride past one to take it (a new one bobs up elsewhere)
  const buoys=[], buoyGeo=(()=>{ const a=new THREE.CylinderGeometry(.45,.6,1.3,12); a.translate(0,.3,0); return a; })(), buoyMat=new THREE.MeshStandardMaterial({color:new THREE.Color(0xff6a00).convertSRGBToLinear(),roughness:.5}), flagMat=new THREE.MeshStandardMaterial({color:new THREE.Color(0xffd400).convertSRGBToLinear(),roughness:.6,side:THREE.DoubleSide});
  function placeBuoy(b,i){ for(let k=0;k<20;k++){ const x=-200+Math.random()*460, off=40+Math.random()*190, z=Cst.shoreZ(x)-off; if(Math.hypot(x-S.x,z-S.z)<35) continue; b.x=x; b.z=z; break; } b.g.visible=true; }
  K.buoys=buoys;
  /* ---------- the group in the scene ---------- */
  const grp=new THREE.Group(); grp.name='kite'; K.group=grp; let kiteMesh=null, lines=null, bar=null, loop=null; K.kiteMesh=null;
  /* the control bar, 50 cm (its own frame: x along the bar toward the left hand, y toward the kite): a black bar with grips,
     a float on each end where the back lines come through, the centre line through a hole in the middle with a stopper ball
     and the trim strap above, and the V where it splits into the two front lines 1.15 m above the bar */
  const KM=(c,r)=>new THREE.MeshStandardMaterial({color:new THREE.Color(c).convertSRGBToLinear(),roughness:r==null?.5:r,metalness:0});
  function barAssembly(){ const g=new THREE.Group(), blk=KM(0x15161a,.55), grip=KM(0x3a3d44,.9), fl=KM(0xff6a1a,.6), red=KM(0xe0202a,.45);
    const tube=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.5,10),blk); tube.rotation.z=PI/2; g.add(tube);
    for(const sg of [-1,1]){ const gp=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.16,10),grip); gp.rotation.z=PI/2; gp.position.x=sg*.15; g.add(gp);
      const f=new THREE.Mesh(new THREE.CylinderGeometry(.026,.022,.11,10),fl); f.position.set(sg*.25,.045,0); g.add(f);
      const cap=new THREE.Mesh(new THREE.SphereGeometry(.026,10,6,0,2*PI,0,PI/2),blk); cap.position.set(sg*.25,.1,0); g.add(cap); }
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.06,10),blk); g.add(hub);
    const stop=new THREE.Mesh(new THREE.SphereGeometry(.03,10,8),red); stop.position.y=.2; g.add(stop);   // the stopper ball above the bar
    const trim=new THREE.Mesh(new THREE.BoxGeometry(.03,.14,.02),blk); trim.position.y=.38; g.add(trim);   // the trim strap
    const v=new THREE.Mesh(new THREE.SphereGeometry(.012,6,4),blk); v.position.y=1.15; g.add(v);   // the V
    g.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); return g; }
  /* the chicken loop on the harness hook (its frame: y along the centre line toward the bar): the loop, and the red quick release above it */
  function loopAssembly(){ const g=new THREE.Group(), blk=KM(0x15161a,.6), red=KM(0xe0202a,.45);
    const l=new THREE.Mesh(new THREE.TorusGeometry(.045,.008,6,14),blk); l.scale.set(1,1.4,1); l.position.y=.03; g.add(l);
    const qr=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.07,10),red); qr.position.y=.12; g.add(qr);
    g.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); return g; }
  K.build=function(scheme){ if(kiteMesh){ grp.remove(kiteMesh); kiteMesh=kiteObj(scheme,true); grp.add(kiteMesh); K.kiteMesh=kiteMesh; return; }
    kiteMesh=kiteObj(scheme,true); grp.add(kiteMesh); K.kiteMesh=kiteMesh;
    // five lines: the back lines from the bar's ends to the wingtips, the front lines from the V to the pigtails, the centre line from the chicken loop up through the bar to the V
    const lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(10*3),3)); lines=new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0x2a2a2a,transparent:true,opacity:.8})); lines.frustumCulled=false; grp.add(lines);
    bar=barAssembly(); grp.add(bar); loop=loopAssembly(); grp.add(loop);
    grp.add(spPts); grp.add(wkMesh);
    for(let i=0;i<10;i++){ const g=new THREE.Group(); const m=new THREE.Mesh(buoyGeo,buoyMat); m.castShadow=true; g.add(m); const pole=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,1.6,5),new THREE.MeshStandardMaterial({color:0x333333})); pole.position.y=1.6; g.add(pole);
      const fl=new THREE.Mesh(new THREE.PlaneGeometry(.7,.45),flagMat); fl.position.set(.36,2.15,0); g.add(fl); const b={g,x:0,z:0,i}; buoys.push(b); grp.add(g); }
    scene.add(grp); grp.visible=false; };
  K.show=function(on){ grp.visible=on; for(const k in harnessCache) harnessCache[k].g.visible=on; if(on){ wk.pts.length=0; buoys.forEach((b,i)=>placeBuoy(b,i)); } };
  /* ---------- every frame: the rider's pose, the kite, lines, bar, spray, wake, buoys ---------- */
  const _v=new THREE.Vector3(), _v2=new THREE.Vector3(), _q=new THREE.Quaternion(), _m=new THREE.Matrix4(), _e=new THREE.Euler(), _bx=new THREE.Vector3(), _by=new THREE.Vector3(), _bz=new THREE.Vector3();
  const harness=new THREE.Vector3(), kitePos=new THREE.Vector3(), hands={L:new THREE.Vector3(),R:new THREE.Vector3(),C:new THREE.Vector3()}, _eL=new THREE.Vector3(), _eR=new THREE.Vector3(), _vs=new THREE.Vector3(), _eC=new THREE.Vector3();
  /* the harness: a waist harness, its hard back band round the rider's middle (sized to the model: the cross-section of the
     trunk's own skin at the belly, the arms left out) and the spreader bar across the front with its hook, which the chicken
     loop goes over. Built once per rider model, fixed to the belly's bone; shown on the water only. */
  const harnessCache={};
  function harnessFor(R){ const m=R.model, b=R.bones&&(R.bones.Abdomen||R.bones.Hips); if(!m||!b) return null; let H=harnessCache[m.uuid]; if(H){ H.g.visible=K.group.visible; return H; }
    m.updateMatrixWorld(true); const trunk=new Set(['Hips','Abdomen','Torso','Chest'].map(k=>R.bones[k]).filter(Boolean));
    const up=(R.bones.Chest||R.bones.Torso||b).getWorldPosition(new THREE.Vector3()).sub((R.bones.Hips||b).getWorldPosition(new THREE.Vector3())).normalize(), c0=b.getWorldPosition(new THREE.Vector3()).addScaledVector(up,.06);   // worn at the bottom of the ribs
    // the figure faces its +Z (the toe edge): forward, square to the trunk
    const fw=new THREE.Vector3(0,0,1).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion())); fw.addScaledVector(up,-fw.dot(up)).normalize(); const sd=new THREE.Vector3().crossVectors(up,fw);
    let mnF=1e9,mxF=-1e9,mnS=1e9,mxS=-1e9,n=0; const v=new THREE.Vector3(), d=new THREE.Vector3(), bp=new THREE.Vector3(), t=new THREE.Vector3(), mm=new THREE.Matrix4();
    // (a compressed model stores its numbers as normalized integers: read them as the shader does)
    const NORM={Int8Array:127,Uint8Array:255,Int16Array:32767,Uint16Array:65535}, GET=['getX','getY','getZ','getW'];
    const aget=(a,i,k)=>{ const x=a[GET[k]](i); if(!a.normalized) return x; const arr=a.isInterleavedBufferAttribute?a.data.array:a.array, q=NORM[arr.constructor.name]; return q?Math.max(x/q,-1):x; };
    m.traverse(o=>{ if(!o.isSkinnedMesh||!o.geometry.attributes.skinIndex) return; const G=o.geometry, pa=G.attributes.position, si=G.attributes.skinIndex, sw=G.attributes.skinWeight, N=pa.count, bones=o.skeleton.bones, inv=o.skeleton.boneInverses;
      for(let i=0;i<N;i+=2){ let best=0, bi=0, sum=0; for(let k=0;k<4;k++){ const w=aget(sw,i,k); sum+=w; if(w>best){ best=w; bi=si[GET[k]](i); } } if(!trunk.has(bones[bi])||sum<=0) continue;
        bp.set(aget(pa,i,0),aget(pa,i,1),aget(pa,i,2)).applyMatrix4(o.bindMatrix); v.set(0,0,0);
        for(let k=0;k<4;k++){ const w=aget(sw,i,k); if(w<=0) continue; const j=si[GET[k]](i); mm.multiplyMatrices(bones[j].matrixWorld,inv[j]); v.addScaledVector(t.copy(bp).applyMatrix4(mm),w/sum); }
        v.applyMatrix4(o.bindMatrixInverse).applyMatrix4(o.matrixWorld); d.subVectors(v,c0); const h=d.dot(up); if(Math.abs(h)>.045) continue;
        const f=d.dot(fw), s=d.dot(sd); mnF=Math.min(mnF,f); mxF=Math.max(mxF,f); mnS=Math.min(mnS,s); mxS=Math.max(mxS,s); n++; } });
    if(n<8){ mnF=-.11; mxF=.11; mnS=-.15; mxS=.15; }
    const cf=(mnF+mxF)/2, cs=(mnS+mxS)/2, rf=(mxF-mnF)/2+.014, rs=(mxS-mnS)/2+.014;
    // the band: an ellipse round the trunk, taller at the back (20 cm) than at the front (7 cm), a shell of 1.2 cm
    const g=new THREE.Group(), NB=36, P=[], I=[];
    for(let i=0;i<=NB;i++){ const a=i/NB*2*PI, ca=Math.cos(a), sa=Math.sin(a), back=(1-ca)/2, h=.035+.065*back;   // a=0 the front
      for(const [hh,rr] of [[-h,1],[h,1],[h,1.07],[-h,1.07]]) P.push(sa*rs*rr,hh,ca*rf*rr); }
    for(let i=0;i<NB;i++) for(let k=0;k<4;k++){ const a=i*4+k, b2=i*4+(k+1)%4, c=a+4, e=b2+4; I.push(a,c,b2,b2,c,e); }
    const bg=new THREE.BufferGeometry(); bg.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); bg.setIndex(I); bg.computeVertexNormals();
    const shell=new THREE.Mesh(bg,KM(0x1b1d22,.45)); shell.castShadow=true; g.add(shell);
    const acc=new THREE.Mesh(new THREE.TorusGeometry(1,.012,4,36,PI*.9),KM(0xff6a1a,.5)); acc.rotation.x=PI/2; acc.rotation.z=PI*.55; acc.scale.set(rs*1.075,rf*1.075,1); acc.position.y=.04; g.add(acc);   // a coloured trim round the back
    // the spreader bar: a curved steel plate across the front, and the hook standing out of it toward the kite
    const sp=new THREE.Mesh(new THREE.CylinderGeometry(rs*.95,rs*.95,.07,18,1,true,-PI*.28,PI*.56),KM(0xb9bec6,.3)); sp.material.metalness=.8; sp.scale.z=rf/rs*1.05+.08; sp.position.z=-.02; g.add(sp);
    const hookG=new THREE.Group(), steel=KM(0xc9ced6,.25); steel.metalness=.85; const hk=new THREE.Mesh(new THREE.TorusGeometry(.035,.009,6,12,PI*1.2),steel); hk.rotation.y=PI/2; hk.rotation.z=-PI*.35; hookG.add(hk);
    const stem=new THREE.Mesh(new THREE.BoxGeometry(.03,.05,.04),steel); stem.position.z=-.03; hookG.add(stem); hookG.position.set(0,-.005,rf*1.07+.035); g.add(hookG);
    const hook=new THREE.Object3D(); hook.position.set(0,.01,rf*1.07+.05); g.add(hook);
    // into the world at the belly, in the trunk's frame; then onto the bone (it keeps that place on it)
    const M=new THREE.Matrix4().makeBasis(sd,up,fw); g.quaternion.setFromRotationMatrix(M); g.position.copy(c0).addScaledVector(fw,cf).addScaledVector(sd,cs);
    scene.add(g); g.updateMatrixWorld(true); b.attach(g);
    H={g,hook,fit:{n,rf:+rf.toFixed(3),rs:+rs.toFixed(3)}}; harnessCache[m.uuid]=H; K.harness=H; return H; }
  K.harnessFor=harnessFor;
  const KPOSE=K.POSE={lean:.95,upright:1,hipsIn:.1};   // the riding pose: how much of the balancing lean the body shows, no bend at the waist, hips toward the bar
  K.visuals=function(dt,R){ const F=S.fall, k=S.kite;
    // the rider's frame: toes toward the kite (downwind), the board along the travel line
    const vx=S.speed>.4?S.vx/S.speed:Math.sin(S.h), vz=S.speed>.4?S.vz/S.speed:Math.cos(S.h);
    const travelH=S.air?S.h:Math.atan2(vx,vz); let tx=D.x-(D.x*Math.sin(travelH)+D.z*Math.cos(travelH))*Math.sin(travelH), tz=D.z-(D.x*Math.sin(travelH)+D.z*Math.cos(travelH))*Math.cos(travelH); const tl=Math.hypot(tx,tz)||1; tx/=tl; tz/=tl;
    const yaw=Math.atan2(-tz,tx), sink=S.air||F?0:lerp(-.14,-.02,smooth(1,4,S.speed)); R.root.position.set(S.x,S.y+sink,S.z); R.root.rotation.set(0,yaw,0);   // a board that is not planing sinks under the rider
    const noseX=tz, noseZ=-tx, dir=(noseX*Math.sin(travelH)+noseZ*Math.cos(travelH))>=0?1:-1; S.sw=dir<0;
    // the board on the sea's slope; in the air: spins (about the vertical) and backrolls (about the travel line)
    // the board rolls onto its heel edge (the side away from the kite), pivoting on that edge
    const e=S.edge, hw=.2; R.tilt.quaternion.identity(); R.tilt.position.set(0,0,0); R.rollG.rotation.z=e; R.rollG.position.set(-hw*(1-Math.cos(e)),hw*Math.abs(Math.sin(e)),0);
    R.trick.rotation.order='YXZ'; R.trick.rotation.y=-(S.spin+S.yawRes); R.trick.rotation.x=0; R.trick.rotation.z=S.flip+S.rollRes;
    // the kite: 22 m out along its lines from the harness
    R.root.updateMatrixWorld(true); harness.set(S.x,S.y+1.1,S.z); { const H=harnessFor(R); if(H) H.hook.getWorldPosition(harness); else { const hb=R.bones&&(R.bones.Abdomen||R.bones.Hips); if(hb) hb.getWorldPosition(harness); } }   // the harness hook, in front of the belly
    kiteDir(k.az,k.el,_v); kitePos.copy(harness).addScaledVector(_v,LINES);
    // the kite faces into the wind: its leading edge toward the upwind side of its lines; the span across
    _by.copy(_v); _bz.copy(D).multiplyScalar(-1); _bz.addScaledVector(_by,-_bz.dot(_by)).normalize(); _bx.crossVectors(_by,_bz).normalize();
    _m.makeBasis(_bx,_by,_bz); kiteMesh.quaternion.setFromRotationMatrix(_m); kiteMesh.position.copy(kitePos); kiteMesh.updateMatrixWorld(true);
    // the bar: in front of the harness toward the kite, across the lines; the lines from its ends to the kite's tips
    // (the bar slides on the line from the harness to the kite: it sits where the hands hold it, a bent arm's length from the shoulders)
    let d=.45; if(R.bones&&R.bones.UpperArmL&&R.len){ const m=R.bones.UpperArmL.getWorldPosition(_bx).add(R.bones.UpperArmR.getWorldPosition(_by)).multiplyScalar(.5).sub(harness), along=m.dot(_v), perp2=Math.max(0,m.lengthSq()-along*along), reach=.96*(R.len.armL[0]+R.len.armL[1]);
      d=clamp(along+Math.sqrt(Math.max(0,reach*reach-perp2)),.18,.75); }
    // the bar lies across the lines, turned about them to lie along the shoulders (the left hand on the left)
    hands.C.copy(harness).addScaledVector(_v,d);
    if(R.bones&&R.bones.UpperArmL){ R.bones.UpperArmL.getWorldPosition(_v2).sub(R.bones.UpperArmR.getWorldPosition(_bz)); _v2.addScaledVector(_v,-_v2.dot(_v)); }
    if(!R.bones||!R.bones.UpperArmL||_v2.lengthSq()<1e-4){ _v2.crossVectors(_v,_by.set(0,1,0)); const nose=_bz.set(noseX,0,noseZ); if(_v2.dot(nose)*dir<0) _v2.multiplyScalar(-1); }
    _v2.normalize();
    hands.L.copy(hands.C).addScaledVector(_v2,.17); hands.R.copy(hands.C).addScaledVector(_v2,-.17);
    // a hand the arm can't reach is brought in to the end of the nearly straight arm (the bar then goes to the hands, below)
    if(R.bones&&R.bones.UpperArmL&&R.len) for(const [h,b,L] of [[hands.L,'UpperArmL',R.len.armL],[hands.R,'UpperArmR',R.len.armR]]){ const sp=R.bones[b].getWorldPosition(_eC), d=h.distanceTo(sp), mx=.97*(L[0]+L[1]); if(d>mx) h.sub(sp).multiplyScalar(mx/d).add(sp); }
    // the bar's frame: x along it (to the left hand), y up the lines; the chicken loop on the hook, along the centre line
    _bz.crossVectors(_v2,_v).normalize(); _bx.crossVectors(_v,_bz); _m.makeBasis(_bx,_v,_bz); bar.quaternion.setFromRotationMatrix(_m); bar.position.copy(hands.C);
    loop.quaternion.copy(bar.quaternion); loop.position.copy(harness);
    const la=lines.geometry.attributes.position.array, wp=p=>p.clone().applyMatrix4(kiteMesh.matrixWorld);
    const tl2=wp(KP.tipL), tr2=wp(KP.tipR), fl=wp(KP.frL), fr=wp(KP.frR); const sideL=tl2.distanceTo(hands.L)<tr2.distanceTo(hands.L);
    const eL=_eL.copy(hands.C).addScaledVector(_bx,.25).addScaledVector(_v,.1), eR=_eR.copy(hands.C).addScaledVector(_bx,-.25).addScaledVector(_v,.1), vs=_vs.copy(hands.C).addScaledVector(_v,1.15);
    const seg=(i,a,b)=>{ la.set([a.x,a.y,a.z,b.x,b.y,b.z],i*6); };
    seg(0,eL,sideL?tl2:tr2); seg(1,eR,sideL?tr2:tl2); seg(2,vs,sideL?fl:fr); seg(3,vs,sideL?fr:fl); seg(4,_eC.copy(harness).addScaledVector(_v,.15),vs); lines.geometry.attributes.position.needsUpdate=true;
    // the pose: planted on the board, leaning back against the pull, hands on the bar
    // how far the body leans back: the kite pulls the hook sideways and up, so the lean that balances the pull over the edge is
    // more than the sideways pull alone gives (riders lean 25-40 degrees back)
    { const pv=S.pullV||_v, ph=Math.hypot(pv.x,pv.z); S.vlean=damp(S.vlean||0,clamp(Math.atan2(ph,Math.max(MASS*G*.35,MASS*G-Math.max(0,pv.y)*.85)),0,.8),4,dt); }
    const p=R.P, bell=(t,d)=>t<d?Math.sin(PI*t/d):0; p.t=S.t; p.menu=false; p.dir=dir; p.surf=0; p.handTo=null; p.prone=0; p.push=0;   // (the surf session's pose inputs off)
    p.crouch=damp(p.crouch,F?.2:clamp(.28+S.charge*.5+(S.land>0?.3:0)+(S.air?.15:0),0,1),8,dt);
    p.charge=damp(p.charge,S.charge,14,dt); p.tuck=damp(p.tuck,S.air?(S.grabbed?.55:.3):0,9,dt);
    p.air=damp(p.air,S.air?1:0,12,dt); p.grab=damp(p.grab,S.grab,12,dt); if(S.grabbed) p.grabName=S.grabName;
    p.spinW=S.air?S.wsp:0; p.flipW=S.air?S.wfl:0; p.body=-dir*(S.air||F?S.lean:S.vlean*KPOSE.lean); p.edge=-dir*S.edge; p.upright=S.air||F?0:KPOSE.upright; p.hipsIn=S.air||F?0:KPOSE.hipsIn*clamp(S.vlean/.6,0,1); p.fa=0; p.om=0; p.slip=0; p.speed=S.speed; p.brake=0; p.skid=0;   // leaning back on the heels (the pose's + is toward the toes)
    p.absorb=damp(p.absorb,S.land>0?clamp(S.landImp/7,0,1)*bell(.45-S.land,.45):0,16,dt); p.ext=damp(p.ext,S.air&&S.airT<.25?.5:0,16,dt); p.rough=damp(p.rough,!S.air&&!F?clamp(S.speed/14,0,1)*.6:0,4,dt);
    p.press=0; p.jib=0; p.bal=0; p.windup=damp(p.windup||0,F?0:S.air?.6:1.4,6,dt); p.spinA=S.air?S.spin:0; p.wobble=0; p.skate=0; p.popKind=''; p.popT=9; p.airT=S.airT;   // windup: the trunk turned toward the kite (the bar square to the shoulders)
    let gnd=0, gu=0; if(F){ if(F.ph==='down') gnd=clamp(F.t/.5,0,1); else if(F.ph==='swim'||F.ph==='relaunch') gnd=1; else { gnd=1; gu=clamp(S.pull/520,0,1)*.9; } }
    p.ground=gnd; p.getup=gu; p.fallPh=F?F.ph:''; p.handsTo=F&&F.ph!=='start'?null:hands;
    R.pose({}); R.root.visible=true;
    // the bar in the hands as they are now (a short-armed figure can't always reach the centre line: then the bar comes to its
    // hands, and the centre line bends a few degrees through it); its ends, the V and the lines follow
    if(p.handsTo&&R.bones&&R.bones.WristL&&R.bones.WristR){ const wl=R.bones.WristL.getWorldPosition(_eL), wr=R.bones.WristR.getWorldPosition(_eR);
      _eC.addVectors(wl,wr).multiplyScalar(.5).addScaledVector(_v,.05); _bx.subVectors(wl,wr); _bx.addScaledVector(_v,-_bx.dot(_v));
      if(_bx.lengthSq()>1e-4){ _bx.normalize(); _bz.crossVectors(_bx,_v).normalize(); _bx.crossVectors(_v,_bz); _m.makeBasis(_bx,_v,_bz); bar.quaternion.setFromRotationMatrix(_m); }
      bar.position.copy(_eC); const la=lines.geometry.attributes.position.array, put=(i,q)=>{ la[i]=q.x; la[i+1]=q.y; la[i+2]=q.z; };
      put(0,_eL.copy(_eC).addScaledVector(_bx,.25).addScaledVector(_v,.1)); put(6,_eR.copy(_eC).addScaledVector(_bx,-.25).addScaledVector(_v,.1));
      _vs.copy(_eC).addScaledVector(_v,1.15); put(12,_vs); put(18,_vs); put(27,_vs); lines.geometry.attributes.position.needsUpdate=true; }
    // spray off the edge at speed, a burst on landing
    if(!S.air&&!F&&S.speed>3){ const n=Math.min(6,Math.floor(S.speed*.25+S.edge*4)); const ux=-tx, uz=-tz; for(let i=0;i<n;i++) emit(S.x+ux*.3+(Math.random()-.5)*.6,S.y+.05,S.z+uz*.3+(Math.random()-.5)*.6,ux*(1+Math.random()*2)-vx*S.speed*.15,1.2+Math.random()*2.2*S.edge,uz*(1+Math.random()*2)-vz*S.speed*.15,.12+Math.random()*.16,.35+Math.random()*.3); }
    updateSpray(dt); updateWake(dt);
    // buoys bob; ride past one to take it
    buoys.forEach(b=>{ if(!b.g.visible) return; Cst.water(b.x,b.z,null,_w); b.g.position.set(b.x,_w.y-.2,b.z); b.g.rotation.set(_w.nz*.3,S.t*.2+b.i,-_w.nx*.3);
      if(Math.hypot(b.x-S.x,b.z-S.z)<3.6&&!F){ b.g.visible=false; ev({type:'buoy',i:b.i}); setTimeout(()=>placeBuoy(b,b.i),1500); } }); };
  /* the chase camera: behind the rider and a little upwind (the kite downwind across the picture), further back in the air */
  const cam={p:new THREE.Vector3(),l:new THREE.Vector3(),first:true};
  K.camera=function(dt){ const vx=S.speed>1?S.vx/S.speed:Math.sin(S.h), vz=S.speed>1?S.vz/S.speed:Math.cos(S.h), air=S.air?1:0, up=S.air?Math.max(0,S.y-(S.jump?S.jump.y0:S.y)):0;
    // in the air the camera drops to the rider's height and looks up, so the lines and the kite above come into the picture
    const back=6+S.speed*.1+air*2.5, side=1.8+air*1.5, hgt=lerp(2.3,1.1,air);
    _v.set(S.x-vx*back-D.x*side,S.y+hgt,S.z-vz*back-D.z*side); _v2.set(S.x+vx*4+D.x*2,S.y+1.2+air*(1.6+up*.25),S.z+vz*4+D.z*2);
    if(cam.first){ cam.p.copy(_v); cam.l.copy(_v2); cam.first=false; } else { cam.p.lerp(_v,1-Math.exp(-dt*3.2)); cam.l.lerp(_v2,1-Math.exp(-dt*5)); }
    const Wc=Cst.water(cam.p.x,cam.p.z,null,_w); if(cam.p.y<Wc.y+.8) cam.p.y=Wc.y+.8;
    camera.position.copy(cam.p); camera.lookAt(cam.l); const fov=(ST.baseFov||62)+clamp(S.speed-8,0,10)*.6+air*4; if(Math.abs(camera.fov-fov)>.05){ camera.fov=damp(camera.fov,fov,3,dt); camera.updateProjectionMatrix(); }
    if(camera.view&&camera.view.enabled) camera.clearViewOffset(); };
  K.camReset=()=>{ cam.first=true; };
  /* ---------- other kiters on the bay ----------
     A few riders out on the water, seen from the beach and while riding: each runs a loop across the wind (out to sea on one line,
     back on another a little downwind, a carving turn at each end with its kite crossing over the top), and now and then jumps
     with the kite sent up. They are 40 m and more away, so each is one simple figure on its board (one mesh), its kite and two
     lines. */
  const AIS=[], aiGrp=new THREE.Group(); aiGrp.name='kiters'; K.ai=AIS; K.aiGroup=aiGrp;
  const figMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7});
  function figure(top,board){ const g=new THREE.Group(), lin=c=>new THREE.Color(c).convertSRGBToLinear();
    const part=(geo,c,x,y,z,rx,ry,rz)=>{ const m=new THREE.Mesh(geo.toNonIndexed(),figMat); const cc=lin(c), n=m.geometry.attributes.position.count, a=new Float32Array(n*3); for(let i=0;i<n;i++){ a[i*3]=cc.r; a[i*3+1]=cc.g; a[i*3+2]=cc.b; }
      m.geometry.setAttribute('color',new THREE.BufferAttribute(a,3)); m.position.set(x,y,z); m.rotation.set(rx||0,ry||0,rz||0); return m; };
    // the board along z, the rider over it facing +x (the kite), leaning back toward -x
    g.add(part(new THREE.BoxGeometry(.4,.035,1.36),board,0,.02,0));
    const body=new THREE.Group(); body.rotation.z=.42; g.add(body);
    for(const z of [-.24,.24]){ body.add(part(new THREE.BoxGeometry(.13,.5,.15),0x15171c,.02,.3,z*.92,0,0,-.18)); body.add(part(new THREE.BoxGeometry(.14,.46,.16),0x15171c,-.04,.74,z*.8,0,0,.2)); }
    body.add(part(new THREE.BoxGeometry(.24,.56,.36),top,-.07,1.22,0)); body.add(part(new THREE.SphereGeometry(.12,8,6),0xc98e66,-.05,1.63,0)); body.add(part(new THREE.SphereGeometry(.125,8,6,0,PI*2,0,PI*.5),0x2b1b10,-.07,1.66,0));
    for(const z of [-.15,.15]) body.add(part(new THREE.BoxGeometry(.5,.08,.08),top,.22,1.24,z,0,0,-.62));
    g.updateMatrixWorld(true); ST.bakeStatic(g); return g; }
  K.aiBuild=function(n){ if(AIS.length) return; const tops=[0xff3b30,0xffd166,0x2ec4b6,0xf72585,0xffffff,0x4361ee], boards=[0xffffff,0x111111,0xffb703,0x00b4d8,0xe63946,0x80ed99];
    for(let i=0;i<(n||5);i++){ const rnd=k=>{ const v=Math.sin((i+1)*(k+3)*78.233)*43758.5453; return v-Math.floor(v); };
      const g=figure(tops[i%tops.length],boards[(i+2)%boards.length]); aiGrp.add(g);
      const km=kiteObj(K.KITES[(i+1)%K.KITES.length],false); aiGrp.add(km);
      const lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12),3)); const ln=new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0x303030,transparent:true,opacity:.6})); ln.frustumCulled=false; aiGrp.add(ln);
      const x=-170+i*95+rnd(1)*40, L=110+rnd(2)*80, off=45+L/2+rnd(3)*40, c=new THREE.Vector3(x,0,Cst.shoreZ(x)-off);
      AIS.push({g,km,ln,c,L,r:7,v:7.8+rnd(4)*1.8,s:rnd(5)*(2*L+2*PI*7),face:0,jump:null,nextJump:4+rnd(6)*10,x:0,y:0,z:0}); }
    scene.add(aiGrp); };
  const _a=new THREE.Vector3(), _t=new THREE.Vector3(), _aw={};
  K.aiUpdate=function(dt){ for(const a of AIS){ const L=a.L, r=a.r, P=2*L+2*PI*r; a.s=(a.s+a.v*dt)%P; let s=a.s, side, az, el=30*DEG, ph=0;
      // where on the loop: out along +CW (upwind line), the far turn downwind, back along -CW, the near turn
      if(s<L){ _a.copy(a.c).addScaledVector(CW,s-L/2).addScaledVector(D,-r); _t.copy(CW); side=1; az=55*DEG; }
      else if((s-=L)<PI*r){ ph=s/r; const e=_t.copy(a.c).addScaledVector(CW,L/2); _a.copy(e).addScaledVector(D,-r*Math.cos(ph)).addScaledVector(CW,r*Math.sin(ph)); _t.copy(D).multiplyScalar(Math.sin(ph)).addScaledVector(CW,Math.cos(ph)); side=Math.cos(ph)>=0?1:-1; az=55*DEG*Math.cos(ph); el=(30+40*Math.sin(ph))*DEG; }
      else if((s-=PI*r)<L){ _a.copy(a.c).addScaledVector(CW,L/2-s).addScaledVector(D,r); _t.copy(CW).multiplyScalar(-1); side=-1; az=-55*DEG; }
      else { s-=L; ph=s/r; const e=_t.copy(a.c).addScaledVector(CW,-L/2); _a.copy(e).addScaledVector(D,r*Math.cos(ph)).addScaledVector(CW,-r*Math.sin(ph)); _t.copy(D).multiplyScalar(-Math.sin(ph)).addScaledVector(CW,-Math.cos(ph)); side=Math.cos(ph)>=0?-1:1; az=-55*DEG*Math.cos(ph); el=(30+40*Math.sin(ph))*DEG; }
      // now and then a jump on a straight: the kite goes up, the rider with it
      let hy=0; if(a.jump){ a.jump.t+=dt; const u=a.jump.t/a.jump.T; if(u>=1){ a.jump=null; a.nextJump=6+Math.random()*14; } else { hy=a.jump.H*Math.sin(PI*u); el=Math.max(el,(30+48*Math.sin(PI*Math.min(1,u*1.6)))*DEG); az*=1-.7*Math.sin(PI*u); } }
      else if(!ph){ a.nextJump-=dt; if(a.nextJump<=0) a.jump={t:0,T:1.9+Math.random()*1.1,H:2+Math.random()*4.5}; }
      Cst.water(_a.x,_a.z,null,_aw); a.x=_a.x; a.z=_a.z; a.y=_aw.y+hy;
      // the rider faces the kite's side of its line (toes downwind), turned round smoothly in the transitions
      let tx=D.x-(D.x*_t.x+D.z*_t.z)*_t.x, tz=D.z-(D.x*_t.x+D.z*_t.z)*_t.z; const tl=Math.hypot(tx,tz); if(tl<.25){ tx=_t.x*side; tz=_t.z*side; } const want=Math.atan2(-tz,tx);
      let d=want-a.face; d=Math.atan2(Math.sin(d),Math.cos(d)); a.face+=d*(1-Math.exp(-dt*5)); a.g.position.set(a.x,a.y-.03,a.z); a.g.rotation.set(0,a.face,0);
      // its kite and lines
      kiteDir(az,el,_v); const hx=a.x, hy2=a.y+1.15, hz=a.z; a.km.position.set(hx+_v.x*LINES,hy2+_v.y*LINES,hz+_v.z*LINES);
      _by.copy(_v); _bz.copy(D).multiplyScalar(-1); _bz.addScaledVector(_by,-_bz.dot(_by)).normalize(); _bx.crossVectors(_by,_bz).normalize(); _m.makeBasis(_bx,_by,_bz); a.km.quaternion.setFromRotationMatrix(_m); a.km.updateMatrixWorld(true);
      const la=a.ln.geometry.attributes.position.array, tL=KP.tipL.clone().applyMatrix4(a.km.matrixWorld), tR=KP.tipR.clone().applyMatrix4(a.km.matrixWorld);
      _v2.crossVectors(_v,_by.set(0,1,0)).normalize().multiplyScalar(.22); la.set([hx+_v.x*.45+_v2.x,hy2+_v.y*.45,hz+_v.z*.45+_v2.z,tR.x,tR.y,tR.z,hx+_v.x*.45-_v2.x,hy2+_v.y*.45,hz+_v.z*.45-_v2.z,tL.x,tL.y,tL.z]); a.ln.geometry.attributes.position.needsUpdate=true; } };
  ST.Kite=K;
})(window.ST);
