/* Snow Rush: rider physics, kept apart from the pose (rider.js) and the camera (main.js). main.js steps it at a fixed 120 Hz,
   so it behaves the same at 30 or 144 frames a second.

   The model: a point mass riding the snow's height field, plus the board, which has
   - a heading (where its leading end points), which can differ from the direction of travel (the slip angle),
   - a yaw rate that follows the rider's input with a short lag (a board cannot change its turn instantly),
   - an edge: while it is engaged it kills sideways slip quickly (a carve); when it lets go the board slides sideways and
     friction eats the speed (a skid, a hockey stop),
   - a contact with the snow, sampled every step at the nose, the tail, the centre and both edges. A rigid board rests on its
     highest supports; that gives the height, the pitch, the roll and the local normal used everywhere else.
   Body lean and edge angle are not inputs: they are what a balanced rider has to do given the accelerations the physics
   produces (the body lines up with gravity minus the acceleration; the board's edge rolls further than the body, the
   difference being angulation at ankles, knees and hips).
   Units: metres, seconds, radians, real gravity. Heading 0 = travel toward -Z; positive turns right (toward +X).

   Numbers and where they come from:
   - snow friction mu ~0.05-0.1 (waxed base on groomed snow); air drag is set per run so it settles at the run's speed;
   - a good carve holds ~1 g sideways; beyond that the edge lets go;
   - a landing keeps the velocity along the slope and the legs absorb the part into it: ~5 m/s is an ordinary landing,
     ~7 m/s is a 2.5 m drop to flat (hard but rideable), above ~10 m/s it is not survivable on the feet;
   - an ollie pops 2.5-4.3 m/s (about 0.3-0.9 m high). */
(function(ST){
  const {clamp,lerp,damp}=ST;
  const PI=Math.PI, TAU=PI*2;
  const wrap=a=>{ a=(a+PI)%TAU; if(a<0) a+=TAU; return a-PI; };
  const C=ST.PHYS={
    g:9.81, mu:.08,
    aMax:9.6,                      // most sideways acceleration an engaged edge holds (~0.98 g)
    muEdge:1.25,                   // the edge's hold when something forces the board sideways (landing crooked)
    grip:16,                       // how fast an engaged edge kills sideways slip (1/s)
    yawTau:.07,                    // the board's yaw rate follows the input this quickly (s)
    muSkid:.5, muSit:.62,          // sliding sideways on the base / on your backside
    brakeAng:1.45,                 // hockey stop: the board swings ~83 degrees across the line of travel
    half:.70, edgeHalf:.125,       // contact points: nose and tail 0.70 m from the centre, edges 0.125 m
    popTap:2.2, popFull:3.6, popLip:.6, chargeT:.45, relBuf:.12,
    landClean:7.5, landFall:11, yawFall:1.05, yawStumble:.5, pitchFall:1.0, pitchStumble:.55,
    spinRate:8.4, flipRate:6.4,
    skatePush:1.25, skateMax:4.2, skatePeriod:.78,
    vMax:34
  };
  const W=()=>ST.World;

  /* ---------- the snow under the board ---------- */
  function contact(x,z,hd,out){
    const gy=W().groundY, fx=Math.sin(hd), fz=-Math.cos(hd), rx=Math.cos(hd), rz=Math.sin(hd), L=C.half, E=C.edgeHalf;
    const yC=gy(x,z), yN=gy(x+fx*L,z+fz*L), yT=gy(x-fx*L,z-fz*L), yR=gy(x+rx*E,z+rz*E), yL=gy(x-rx*E,z-rz*E);
    out=out||{}; out.yC=yC; out.yN=yN; out.yT=yT; out.yL=yL; out.yR=yR;
    out.h=Math.max(yC,(yN+yT)/2,(yL+yR)/2);                 // a rigid board rests on its highest supports
    out.gf=(yN-yT)/(2*L); out.gr=(yR-yL)/(2*E);             // rise per metre along the board and across it
    out.pitch=Math.atan(out.gf); out.roll=Math.atan(out.gr);
    const gx=out.gf*fx+out.gr*rx, gz=out.gf*fz+out.gr*rz, n=1/Math.sqrt(1+gx*gx+gz*gz);
    out.gx=gx; out.gz=gz; out.nx=-gx*n; out.ny=n; out.nz=-gz*n;
    out.gap=out.h-yC;                                       // > 0: the snow dips under the middle of the board
    return out; }

  /* ---------- state ---------- */
  function reset(P,x,z,hd){
    Object.assign(P,{x,z,hd,vx:0,vz:0,vy:0,om:0,omegaS:0,grounded:true,fresh:true,speed:0,speed3:0,vh:hd,slip:0,skid:0,edge:0,body:0,fa:0,
      axF:0,azF:0,ayF:0,charge:0,charging:false,relBuf:0,tuck:0,braking:false,brakeK:0,brakeSide:0,sw:false,fall:null,skate:null,skateK:0,
      airT:0,sp:0,fl:0,wsp:0,wfl:0,grabT:0,grabbed:false,grabName:'',airPitch:0,popT:9,popKind:'',landT:9,landAbs:0,landOut:'',stumble:0,stun:0,invuln:0,boost:0,lipPop:false});
    P.gc=contact(x,z,hd,P.gc); P.y=P.gc.h; P.s=-z; }

  /* ---------- one step ---------- */
  function step(P,ctl,dt,ev){
    const vx0=P.vx, vz0=P.vz, vy0=P.vy;
    P.t+=dt; P.stun=Math.max(0,P.stun-dt); P.invuln=Math.max(0,P.invuln-dt); P.boost=Math.max(0,P.boost-dt*.9); P.popT+=dt; P.landT+=dt; P.stumble=Math.max(0,P.stumble-dt);
    if(P.fall) stepFall(P,ctl,dt,ev);
    else if(P.grounded) stepGround(P,ctl,dt,ev);
    else stepAir(P,ctl,dt,ev);
    P.speed=Math.hypot(P.vx,P.vz); P.speed3=Math.hypot(P.vx,P.vz,P.grounded?P.vy:0); P.s=-P.z;
    if(P.speed>.4) P.vh=Math.atan2(P.vx,-P.vz);
    P.slip=wrap(P.hd-P.vh);
    // the accelerations the rider feels (smoothed): they set how the body has to lean
    const k=1-Math.exp(-dt/.09); P.axF+=((P.vx-vx0)/dt-P.axF)*k; P.azF+=((P.vz-vz0)/dt-P.azF)*k; P.ayF+=((P.grounded?(P.vy-vy0)/dt:0)-P.ayF)*k;
    lean(P,dt);
  }

  /* Balance: the body lines up with gravity minus the acceleration of the body. Its tilt across the board (toward the board's
     right side) is Phi; the board's edge rolls further, Psi = Phi/(1-ANG): the difference is angulation (taken as 30% of the edge
     angle, a calibration value, not a law). Fore-aft, the body leans the same way but much less (riders keep their weight centred). */
  const ANG=.30;
  function lean(P,dt){
    if(!P.grounded||P.fall&&P.fall.ph!=='lose'){ P.body=damp(P.body,0,6,dt); P.edge=damp(P.edge,0,6,dt); P.fa=damp(P.fa,0,6,dt); return; }
    const g=P.gc, fx=Math.sin(P.hd), fz=-Math.cos(P.hd), rx=Math.cos(P.hd), rz=Math.sin(P.hd);
    const ar=P.axF*rx+P.azF*rz, af=P.axF*fx+P.azF*fz, up=C.g*g.ny+P.ayF*g.ny;      // up: the support the snow gives
    let phi=Math.atan2(ar,Math.max(2,up));
    if(P.braking||P.fall) phi*=1;                                                   // a stop leans the body back against the slide
    const cap=.82; phi=clamp(phi,-cap,cap);
    P.body=damp(P.body,phi,14,dt); P.edge=clamp(P.body/(1-ANG),-1.15,1.15);
    P.fa=damp(P.fa,clamp(Math.atan2(af,Math.max(2,up))*.45,-.22,.22),6,dt);
  }

  /* air drag per run: set so a rider settles at the run's reference speed on its average slope (friction mu, real g) */
  function tuneDrag(T){ const S=T.slope, v=T.vref||14; return Math.max(.003,(C.g*S/(1+S*S)-C.mu*C.g/Math.sqrt(1+S*S))/(v*v)); }

  /* ---------- on the snow ---------- */
  function stepGround(P,ctl,dt,ev,noInput){
    const T=W().T, gc=P.gc, vr0=T.vref||14;
    let speed=Math.hypot(P.vx,P.vz);
    const trackAng=Math.atan2(W().dcx(P.s),1);
    const sx=(noInput||P.stun>0)?0:ctl.steer, fwd=noInput?0:ctl.fwd;
    // --- jump: hold to load the legs, let go to pop ---
    let release=false;
    if(!noInput&&ctl.jump&&P.stun<=0){ P.charge=Math.min(1,P.charge+dt/C.chargeT); P.charging=true; }
    else if(P.charging){ P.charging=false; release=true; }
    if(P.relBuf>0){ release=true; P.relBuf=0; }
    // --- braking: swing the board across the line of travel and slide it ---
    const wantBrake=!noInput&&ctl.brake&&P.stun<=0;
    if(wantBrake&&!P.braking){ P.braking=true; P.brakeSide=Math.abs(sx)>.3?Math.sign(sx):(P.sw?1:-1); }   // default: a heel-side stop
    if(!wantBrake) P.braking=false;
    P.brakeK=damp(P.brakeK,P.braking?1:0,P.braking?7:4,dt);
    // --- skating (unstrapped rear foot pushes) when crawling and asking to go ---
    const wantSkate=!noInput&&(fwd>.5||P.autoSkate>0)&&speed<C.skateMax&&!P.braking;
    if(P.autoSkate>0) P.autoSkate-=dt;
    if(wantSkate&&!P.skate) P.skate={ph:0,pushed:false};
    if(P.skate){ P.skate.ph+=dt/C.skatePeriod; if(P.skate.ph>=.35&&!P.skate.pushed){ P.skate.pushed=true; const f=C.skatePush*(1-speed/C.skateMax*.6); P.vx+=Math.sin(P.hd)*f; P.vz+=-Math.cos(P.hd)*f; ev.push({type:'push'}); }
      if(P.skate.ph>=1){ if(wantSkate){ P.skate.ph-=1; P.skate.pushed=false; } else P.skate=null; } }
    P.skateK=damp(P.skateK,P.skate?1:0,P.skate?8:5,dt);
    P.tuck=damp(P.tuck,(fwd>.35&&speed>C.skateMax&&!P.braking)?1:0,10,dt);
    // --- yaw ---
    const vh=speed>.8?Math.atan2(P.vx,-P.vz):trackAng;
    const rateMax=Math.min(lerp(2.0,1.1,clamp(speed/(vr0*1.4),0,1)),C.aMax/Math.max(speed,4.5));
    let omT;
    if(P.braking){ const tgt=vh+P.brakeSide*C.brakeAng; omT=clamp(wrap(tgt-P.hd)*7,-4,4); }
    else { const sl=wrap(P.hd-vh); omT=sx*rateMax-clamp(sl*(speed>2?4:1.5),-3,3);           // a board left skewed swings back in line
      if(Math.abs(sx)<.1&&speed>2) omT+=wrap(trackAng-P.hd)*.6;                            // with no input the rider settles onto the trail
      if(speed<1.2&&Math.abs(sx)<.1) omT+=wrap(trackAng-P.hd)*1.5; }                        // stopped: point back down the hill
    P.om+=(omT-P.om)*(1-Math.exp(-dt/C.yawTau)); P.hd+=P.om*dt; P.omegaS=P.om;
    const lim=P.braking?2.9:1.35, off=wrap(P.hd-trackAng); if(Math.abs(off)>lim){ P.hd=trackAng+Math.sign(off)*lim; P.om=0; }
    // --- forces, in the board's frame ---
    contact(P.x,P.z,P.hd,gc);
    const fx=Math.sin(P.hd), fz=-Math.cos(P.hd), rx=Math.cos(P.hd), rz=Math.sin(P.hd);
    const G2=1+gc.gx*gc.gx+gc.gz*gc.gz, N=C.g/Math.sqrt(G2);                 // N: the snow's push per kg (ignoring curvature)
    P.vx+=-C.g*gc.gx/G2*dt; P.vz+=-C.g*gc.gz/G2*dt;                         // gravity along the snow
    if(P.boost>0&&speed>1){ P.vx+=P.vx/speed*2.2*dt; P.vz+=P.vz/speed*2.2*dt; }
    let vf=P.vx*fx+P.vz*fz, vr=P.vx*rx+P.vz*rz;
    // along the board: base friction, air drag (less in a tuck), and a little edge scrub while carving hard
    const dq=T.dq||(T.dq=tuneDrag(T)), lat=Math.abs(P.om*speed);
    const drag=C.mu*N+dq*vf*vf*(1-.38*P.tuck)+.04*lat;
    vf=Math.sign(vf)*Math.max(0,Math.abs(vf)-drag*dt);
    // across the board: an engaged edge grips (fast, up to its hold); braking or a let-go edge slides (Coulomb friction)
    const sliding=P.braking||P.brakeK>.5;
    let dv;
    if(sliding) dv=Math.min(Math.abs(vr),C.muSkid*N*(1+P.brakeK*.4)*dt);
    else dv=Math.min(Math.abs(vr)*(1-Math.exp(-C.grip*dt)),C.muEdge*N*dt);
    vr=Math.sign(vr)*(Math.abs(vr)-dv);
    P.skid=damp(P.skid,clamp(Math.abs(vr)/2.5,0,1),10,dt);
    P.vx=fx*vf+rx*vr; P.vz=fz*vf+rz*vr;
    const s2=Math.hypot(P.vx,P.vz); if(s2>C.vMax){ P.vx*=C.vMax/s2; P.vz*=C.vMax/s2; }
    // --- move, then follow the snow (or leave it) ---
    P.x+=P.vx*dt; P.z+=P.vz*dt;
    contact(P.x,P.z,P.hd,gc);
    const h=gc.h;
    if(!P.fresh&&s2>3.5&&h<P.y+P.vy*dt-.5*C.g*dt*dt-.012){ takeoff(P,P.vy,null,ev); return; }   // the snow falls away faster than gravity can follow
    if(release&&!noInput){ const lip=W().lipNear(-P.z,P.x,1.7,.35), pop=lerp(C.popTap,C.popFull,P.charge)+(lip?C.popLip:0);
      P.y=h; takeoff(P,P.vy+pop,{kind:fwd<-.4?'nollie':'ollie',lip:!!lip,charge:P.charge},ev); P.charge=0; return; }
    P.vy=(h-P.y)/dt; P.y=h; P.fresh=false;
  }

  function takeoff(P,vy,pop,ev){
    P.grounded=false; P.vy=vy; P.airT=0; P.sp=0; P.fl=0; P.wsp=0; P.wfl=0; P.grabT=0; P.grabbed=false; P.grabName='';
    P.airPitch=P.gc.pitch; P.popKind=pop?pop.kind:'drop'; P.popT=0; P.lipPop=!!(pop&&pop.lip); P.charge=0; P.charging=false; P.skate=null; P.braking=false;
    P.airStart=P.y; P.swTake=P.sw; ev.push({type:'takeoff',pop:!!pop,kind:P.popKind,lip:P.lipPop,charge:pop?pop.charge:0}); }

  /* ---------- in the air ---------- */
  function stepAir(P,ctl,dt,ev){
    const T=W().T; P.airT+=dt;
    P.vy-=C.g*dt;
    const sp=Math.hypot(P.vx,P.vz), k=Math.exp(-(T.dq||.006)*sp*dt*.6); P.vx*=k; P.vz*=k;
    P.x+=P.vx*dt; P.z+=P.vz*dt; P.y+=P.vy*dt;
    // spins and flips follow the stick; a grab is chosen by where the stick points when the grab starts
    P.wsp=damp(P.wsp,ctl.steer*C.spinRate,7,dt); P.wfl=damp(P.wfl,P.grabbed?0:ctl.flip*C.flipRate,7,dt); P.sp+=P.wsp*dt; P.fl+=P.wfl*dt;
    if(ctl.grab){ if(!P.grabbed){ P.grabName=Math.abs(ctl.steer)>Math.abs(ctl.flip)&&Math.abs(ctl.steer)>.35?(ctl.steer>0?'INDY':'MUTE'):ctl.flip>.35?'TAIL':ctl.flip<-.35?'NOSE':'INDY'; } P.grabbed=true; P.grabT+=dt; }
    else P.grabbed=false;
    if(!ctl.jump&&P.charging){ P.charging=false; P.relBuf=C.relBuf; }               // let go just before landing: pop on touchdown
    P.relBuf=Math.max(0,P.relBuf-dt); if(ctl.jump&&!P.charging) P.charging=true;    // and a press in the air loads for the landing
    // the rider brings the board's pitch round to meet the snow below (a skill: lands flat-based on the landing)
    const g=contact(P.x,P.z,P.hd,P.gc); P.airPitch=damp(P.airPitch,g.pitch,2.4,dt);
    if(P.y<=g.h) land(P,ctl,ev);
  }

  function land(P,ctl,ev){
    const g=contact(P.x,P.z,P.hd,P.gc);
    const vn=P.vx*g.nx+P.vy*g.ny+P.vz*g.nz, imp=Math.max(0,-vn);
    let tx=P.vx-vn*g.nx, ty=P.vy-vn*g.ny, tz=P.vz-vn*g.nz; const tl=Math.hypot(tx,ty,tz), keep=tl>0?Math.max(0,tl-.12*imp)/tl:0;   // the snow takes a little of the speed along it
    P.vx=tx*keep; P.vz=tz*keep; P.y=g.h; P.vy=ty*keep;
    const half=Math.round(P.sp/PI), spinR=P.sp-half*PI, flips=Math.round(P.fl/TAU), flipR=P.fl-flips*TAU;
    const yawErr=Math.abs(spinR), pitchErr=Math.abs(flipR)+Math.abs(P.airPitch-g.pitch)*.5;
    let out='clean';
    if(imp>C.landFall||yawErr>C.yawFall||pitchErr>C.pitchFall) out='fall';
    else if(imp>C.landClean||yawErr>C.yawStumble||pitchErr>C.pitchStumble) out='stumble';
    if(half%2!==0) P.sw=!P.sw;                                                     // an odd number of half turns lands switch
    const air=P.airT, ev1={type:'land',imp,out,half,flips,spin:P.sp,flip:P.fl,yawErr,pitchErr,air,grab:P.grabT,grabName:P.grabName,kind:P.popKind,lip:P.lipPop,swTake:P.swTake,sw:P.sw};
    P.sp=spinR; P.fl=flipR; P.grounded=true; P.fresh=true; P.airT=0; P.wsp=P.wfl=0; P.grabbed=false; P.grabT=0;
    P.landT=0; P.landAbs=clamp(imp/7.5,.15,1); P.landOut=out;
    if(out==='stumble'){ P.stumble=.7; P.vx*=.88; P.vz*=.88; }
    ev.push(ev1);
    if(out==='fall') startFall(P,'land',ev);
    else if(P.relBuf>0){ P.charge=Math.max(P.charge,.3); }          // released just before touchdown: it pops on the first step on the snow
  }

  /* ---------- falling, sliding, getting up ---------- */
  function startFall(P,why,ev){
    if(P.fall) return;
    P.fall={ph:why==='hit'?'down':'lose',t:0,why,side:P.sw?1:-1}; P.braking=false; P.skate=null; P.charging=false; P.charge=0;
    if(!P.grounded){ P.grounded=true; P.y=P.gc.h; P.vy=0; }
    ev.push({type:'fall',why}); }
  function stepFall(P,ctl,dt,ev){
    const F=P.fall, T=W().T; F.t+=dt;
    if(F.ph==='lose'){ stepGround(P,ctl,dt,ev,true); P.edge+=Math.sin(F.t*31)*.05; if(F.t>.35){ F.ph='down'; F.t=0; } return; }
    const gc=contact(P.x,P.z,P.hd,P.gc), speed=Math.hypot(P.vx,P.vz), trackAng=Math.atan2(W().dcx(-P.z),1);
    const vh=speed>.5?Math.atan2(P.vx,-P.vz):trackAng;
    if(F.ph==='down'||F.ph==='slide'){
      // the board swings across the slope and the rider sits down on the uphill side, sliding to a stop
      const tgt=vh+F.side*1.5; P.om=clamp(wrap(tgt-P.hd)*6,-5,5); P.hd+=P.om*dt;
      const G2=1+gc.gx*gc.gx+gc.gz*gc.gz, N=C.g/Math.sqrt(G2);
      P.vx+=-C.g*gc.gx/G2*dt; P.vz+=-C.g*gc.gz/G2*dt;
      const sp=Math.hypot(P.vx,P.vz), mu=F.ph==='down'?lerp(C.muSkid,C.muSit,F.t/.45):C.muSit, dv=Math.min(sp,mu*N*dt);
      if(sp>0){ P.vx-=P.vx/sp*dv; P.vz-=P.vz/sp*dv; }
      P.x+=P.vx*dt; P.z+=P.vz*dt; contact(P.x,P.z,P.hd,gc); P.vy=(gc.h-P.y)/dt; P.y=gc.h;
      if(F.ph==='down'&&F.t>.45){ F.ph='slide'; F.t=0; }
      else if(F.ph==='slide'&&(Math.hypot(P.vx,P.vz)<.45||F.t>1.6)){ F.ph='getup'; F.t=0; P.vx=P.vz=0; P.vy=0; ev.push({type:'getup'}); }
      return; }
    P.vx=P.vz=P.vy=0; contact(P.x,P.z,P.hd,gc); P.y=gc.h;
    if(F.ph==='getup'){ if(F.t>.95){ F.ph='recover'; F.t=0; } return; }
    if(F.ph==='recover'){   // stand on the heel edge, swing the board back down the hill and go
      const tgt=trackAng; P.om=clamp(wrap(tgt-P.hd)*5,-3.5,3.5); P.hd+=P.om*dt;
      if(F.t>.6){ P.fall=null; P.invuln=1.2; P.om=0; const v=1.6; P.vx=Math.sin(P.hd)*v; P.vz=-Math.cos(P.hd)*v; P.fresh=true; ev.push({type:'recovered'}); } }
  }

  /* an obstacle (rock, tree): stop hard, fall, and get pushed clear of it */
  function hit(P,ox,oz,r,ev){
    if(P.fall||P.invuln>0) return false;
    const dx=P.x-ox, dz=P.z-oz, d=Math.hypot(dx,dz)||1; P.x=ox+dx/d*(r+.6); P.z=oz+dz/d*(r+.6);
    const sp=Math.hypot(P.vx,P.vz); P.vx=dx/d*sp*.25; P.vz=dz/d*sp*.25;
    startFall(P,'hit',ev); return true; }

  /* the finish: no input, the rider throws a hockey stop */
  const BRAKE={steer:0,fwd:0,flip:0,jump:false,grab:false,brake:true};
  function finishStep(P,dt,ev){ step(P,BRAKE,dt,ev); }

  ST.Physics={C,contact,reset,step,startFall,hit,finishStep,wrap,tuneDrag};
})(window.ST);
