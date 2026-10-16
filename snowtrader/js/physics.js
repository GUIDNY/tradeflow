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
    vMax:34,
    muRail:.11, muBox:.15, grindCool:.35, pressRate:3.2
  };
  const W=()=>ST.World;

  /* ---------- the snow under the board ---------- */
  function contact(x,z,hd,out){
    const gy=W().groundY, fx=Math.sin(hd), fz=-Math.cos(hd), rx=Math.cos(hd), rz=Math.sin(hd), L=C.half, E=C.edgeHalf;
    const yC=gy(x,z), yN=gy(x+fx*L,z+fz*L), yT=gy(x-fx*L,z-fz*L), yR=gy(x+rx*E,z+rz*E), yL=gy(x-rx*E,z-rz*E);
    out=out||{}; out.yC=yC; out.yN=yN; out.yT=yT; out.yL=yL; out.yR=yR;
    out.h=Math.max(yC,(yN+yT)/2,(yL+yR)/2);                 // a rigid board rests on its highest supports
    out.gf=(yN-yT)/(2*L); out.gr=(yR-yL)/(2*E);             // rise per metre along the board and across it (how the board sits)
    out.pitch=Math.atan(out.gf); out.roll=Math.atan(out.gr);
    // The motion follows the snow under the middle of the board (the rider's weight is over it), with the slope there. Where the
    // snow is hollow under the board (a halfpipe transition) the board itself rests on its ends, `gap` higher: that is how it is
    // drawn, but the legs take it up, so it is not a height the rider has to climb. (Following the resting height instead would
    // make energy appear and vanish as the board turns on a curved wall; the slope across the whole board would flatten the wall.)
    const e=.05, gx=(gy(x+e,z)-gy(x-e,z))/(2*e), gz=(gy(x,z+e)-gy(x,z-e))/(2*e), n=1/Math.sqrt(1+gx*gx+gz*gz);
    out.gx=gx; out.gz=gz; out.nx=-gx*n; out.ny=n; out.nz=-gz*n;
    out.gap=out.h-yC;                                       // > 0: the snow dips under the middle of the board (drawn only)
    return out; }

  /* ---------- state ---------- */
  function reset(P,x,z,hd){
    Object.assign(P,{x,z,hd,vx:0,vz:0,vy:0,om:0,omegaS:0,grounded:true,fresh:true,speed:0,speed3:0,vh:hd,slip:0,skid:0,edge:0,body:0,fa:0,
      axF:0,azF:0,ayF:0,charge:0,charging:false,relBuf:0,tuck:0,braking:false,brakeK:0,brakeSide:0,sw:false,fall:null,skate:null,skateK:0,
      airT:0,sp:0,fl:0,wsp:0,wfl:0,grabT:0,grabbed:false,grabName:'',airPitch:0,popT:9,popKind:'',landT:9,landAbs:0,landOut:'',stumble:0,stun:0,invuln:0,boost:0,lipPop:false,
      grind:null,grindCool:0,press:0,pressK:0,butter:null,forceFall:false,vyT:null,spU:0,unwind:null,wallAir:false,spinT:null,grabSeq:0,grabList:[]});
    P.gc=contact(x,z,hd,P.gc); P.y=P.gc.yC; P.s=-z; }

  /* ---------- one step ---------- */
  function step(P,ctl,dt,ev){
    const vx0=P.vx, vz0=P.vz, vy0=P.vy;
    P.t+=dt; P.stun=Math.max(0,P.stun-dt); P.invuln=Math.max(0,P.invuln-dt); P.boost=Math.max(0,P.boost-dt*.9); P.popT+=dt; P.landT+=dt; P.stumble=Math.max(0,P.stumble-dt);
    P.grindCool=Math.max(0,P.grindCool-dt);
    if(P.fall) stepFall(P,ctl,dt,ev);
    else if(P.grind) stepGrind(P,ctl,dt,ev);
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
    if(P.grind){ P.body=damp(P.body,P.grind.bal*.28,10,dt); P.edge=0; P.fa=damp(P.fa,-P.grind.press*.12,8,dt); return; }   // on a jib: flat base, the body sways with the balance
    if(!P.grounded||P.fall&&P.fall.ph!=='lose'){ P.body=damp(P.body,0,6,dt); P.edge=damp(P.edge,0,6,dt); P.fa=damp(P.fa,0,6,dt); return; }
    const g=P.gc, fx=Math.sin(P.hd), fz=-Math.cos(P.hd), rx=Math.cos(P.hd), rz=Math.sin(P.hd);
    // the push the rider feels (gravity minus acceleration, per kg), split along the snow's normal and the board's two axes laid
    // on the snow: on a halfpipe wall the big push is along the normal (it squeezes the legs), not across the board
    // (air drag pushes on the body itself, not through the feet, so it is taken out: gliding at a steady speed the rider stands
    //  square to the snow, as before, instead of leaning back against gravity)
    const dq=(W().T.dq||.006)*Math.hypot(P.vx,P.vz), ry=g.gx*rx+g.gz*rz, fy=g.gx*fx+g.gz*fz, rl=Math.sqrt(1+ry*ry), fl=Math.sqrt(1+fy*fy);
    const Fx=P.axF+dq*P.vx, Fy=P.ayF+C.g+dq*(g.gx*P.vx+g.gz*P.vz), Fz=P.azF+dq*P.vz;
    const ar=(Fx*rx+Fy*ry+Fz*rz)/rl, af=(Fx*fx+Fy*fy+Fz*fz)/fl, up=Fx*g.nx+Fy*g.ny+Fz*g.nz;
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
    // --- press / butter: hold grab and push the stick forward (nose) or back (tail); steer while pressing to spin on the snow ---
    const wantPress=!noInput&&ctl.grab&&Math.abs(fwd)>.4&&speed>2.2&&!P.braking&&P.stun<=0;
    if(wantPress&&!P.butter){ P.butter={end:Math.sign(fwd),phys:Math.sign(fwd)*(P.sw?-1:1),t:0,spin:0}; }
    if(P.butter){ const B=P.butter; B.t+=dt;
      if(wantPress){ const a0=P.hd+B.spin; B.spin+=ctl.steer*C.pressRate*dt; P.sp=B.spin; const a1=P.hd+B.spin, e=B.end*C.half*.85;
        // the board turns about its pressed end: that end stays where it is and the rest of the board (and the rider) swings round it
        P.x-=e*(Math.sin(a1)-Math.sin(a0)); P.z-=e*(Math.cos(a0)-Math.cos(a1)); }
      else endButter(P,ev); }
    P.pressK=damp(P.pressK,P.butter?1:0,10,dt); P.press=P.butter?P.butter.end:P.press;
    const wantSkate=!noInput&&!P.butter&&(fwd>.5||P.autoSkate>0)&&speed<C.skateMax&&!P.braking;
    if(P.autoSkate>0) P.autoSkate-=dt;
    if(wantSkate&&!P.skate) P.skate={ph:0,pushed:false};
    if(P.skate){ P.skate.ph+=dt/C.skatePeriod; if(P.skate.ph>=.35&&!P.skate.pushed){ P.skate.pushed=true; const f=C.skatePush*(1-speed/C.skateMax*.6); P.vx+=Math.sin(P.hd)*f; P.vz+=-Math.cos(P.hd)*f; ev.push({type:'push'}); }
      if(P.skate.ph>=1){ if(wantSkate){ P.skate.ph-=1; P.skate.pushed=false; } else P.skate=null; } }
    P.skateK=damp(P.skateK,P.skate?1:0,P.skate?8:5,dt);
    P.tuck=damp(P.tuck,(fwd>.35&&speed>C.skateMax&&!P.braking&&!P.butter)?1:0,10,dt);
    // --- yaw ---
    const vh=speed>.8?Math.atan2(P.vx,-P.vz):trackAng;
    const rateMax=Math.min(lerp(2.0,1.1,clamp(speed/(vr0*1.4),0,1)),C.aMax/Math.max(speed,4.5));
    let omT;
    if(P.butter){ omT=0; }   // the board is pivoting on its pressed end; travel holds its line
    else if(P.braking){ const tgt=vh+P.brakeSide*C.brakeAng; omT=clamp(wrap(tgt-P.hd)*7,-4,4); }
    else { const sl=wrap(P.hd-vh); omT=sx*rateMax-clamp(sl*(speed>2?4:1.5),-3,3);           // a board left skewed swings back in line
      const inPark=ST.Park&&ST.Park.inFeature(P.s,P.x-W().cx(P.s));
      if(Math.abs(sx)<.1&&speed>2&&!inPark) omT+=wrap(trackAng-P.hd)*.6;                    // with no input the rider settles onto the trail (not in a pipe)
      if(speed<1.2&&Math.abs(sx)<.1) omT+=wrap(trackAng-P.hd)*1.5; }                        // stopped: point back down the hill
    P.om+=(omT-P.om)*(1-Math.exp(-dt/C.yawTau)); P.hd+=P.om*dt; P.omegaS=P.om;
    const lim=P.braking?2.9:1.35, off=wrap(P.hd-trackAng); if(Math.abs(off)>lim){ P.hd=trackAng+Math.sign(off)*lim; P.om=0; }
    // --- forces, in the board's frame (a butter samples the snow along the board as it is turned on its pressed end) ---
    const hdC=P.butter?P.hd+P.sp:P.hd;
    contact(P.x,P.z,hdC,gc);
    const fx=Math.sin(P.hd), fz=-Math.cos(P.hd);
    const G2=1+gc.gx*gc.gx+gc.gz*gc.gz, N=C.g/Math.sqrt(G2);                 // N: the snow's push per kg (ignoring curvature)
    P.vx+=-C.g*gc.gx/G2*dt; P.vz+=-C.g*gc.gz/G2*dt;                         // gravity along the snow
    if(P.boost>0&&speed>1){ P.vx+=P.vx/speed*2.2*dt; P.vz+=P.vz/speed*2.2*dt; }
    // the board's two axes laid on the snow (along it, f3; across it to its right, r3 = f3 x normal): friction and the edge act
    // along these. Horizontal axes would be wrong on a steep wall, where a centimetre sideways is several centimetres up, and the
    // edge could then add speed instead of taking it away.
    const fy=gc.gx*fx+gc.gz*fz, fl=Math.sqrt(1+fy*fy), f3x=fx/fl, f3y=fy/fl, f3z=fz/fl;
    let r3x=f3y*gc.nz-f3z*gc.ny, r3y=f3z*gc.nx-f3x*gc.nz, r3z=f3x*gc.ny-f3y*gc.nx; const r3l=Math.hypot(r3x,r3y,r3z); r3x/=r3l; r3y/=r3l; r3z/=r3l;
    const vy3=gc.gx*P.vx+gc.gz*P.vz;                                        // the velocity is in the snow's plane: this is its vertical part
    let vf=P.vx*f3x+vy3*f3y+P.vz*f3z, vr=P.vx*r3x+vy3*r3y+P.vz*r3z;
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
    P.vx=f3x*vf+r3x*vr; P.vz=f3z*vf+r3z*vr;
    const s2=Math.hypot(P.vx,P.vz); if(s2>C.vMax){ P.vx*=C.vMax/s2; P.vz*=C.vMax/s2; }
    // --- move, then follow the snow (or leave it) ---
    P.x+=P.vx*dt; P.z+=P.vz*dt;
    const gAx=gc.gx, gAz=gc.gz;                                              // the slope this step was integrated on
    contact(P.x,P.z,hdC,gc);
    const h=gc.yC;
    if(tryGrind(P,ev)) return;
    // the snow falls away faster than gravity can follow. (The vertical speed used is the slope's own, gradient x ground speed:
    // the height difference between steps jitters on steep walls, where a millimetre sideways is centimetres up.)
    const vT0=P.vyT==null?P.vy:P.vyT;
    if(!P.fresh&&s2>3.5&&h<P.y+vT0*dt-.5*C.g*dt*dt-.012){ takeoff(P,vT0,null,ev); return; }
    bend(P,gAx,gAz,gc); P.vyT=gc.gx*P.vx+gc.gz*P.vz;
    if(release&&!noInput){ const lip=W().lipNear(-P.z,P.x,1.7,.35), pop=lerp(C.popTap,C.popFull,P.charge)+(lip?C.popLip:0);
      P.y=h; takeoff(P,P.vyT+pop,{kind:fwd<-.4?'nollie':'ollie',lip:!!lip,charge:P.charge,wind:Math.abs(ctl.steer)>.3?ctl.steer:0},ev); P.charge=0; return; }
    P.vy=(h-P.y)/dt; P.y=h; P.fresh=false;
  }
  /* The snow curves under the board (a kicker, a transition, a bump): the velocity turns with it and keeps its speed, because the
     snow's push is square to the motion and does no work. Only the part of the velocity along the change of slope turns, so riding
     up a halfpipe wall turns the speed across the pipe into height and leaves the speed along the pipe alone.
     (Carrying the ground speed as a horizontal vector without this would add speed on every concave curve: up a near-vertical wall,
     several times the speed the rider came in with.) */
  function bend(P,gAx,gAz,g){
    const vyA=gAx*P.vx+gAz*P.vz, V2=P.vx*P.vx+vyA*vyA+P.vz*P.vz;
    const dn=(-g.gx*P.vx+vyA-g.gz*P.vz)/(1+g.gx*g.gx+g.gz*g.gz);                  // the velocity into the new surface (normal n=(-gx,1,-gz))
    const tx=P.vx+dn*g.gx, ty=vyA-dn, tz=P.vz+dn*g.gz, k=Math.sqrt(V2/Math.max(1e-9,tx*tx+ty*ty+tz*tz));
    // the board lies in the snow's surface too, so the surface carries it round with the velocity: seen from above, a board
    // pointing diagonally up a wall swings toward the line of the pipe as the wall steepens, without the rider turning it
    if(P.vx*P.vx+P.vz*P.vz>2.25) P.hd=wrap(P.hd+wrap(Math.atan2(tx,-tz)-Math.atan2(P.vx,-P.vz)));
    P.vx=tx*k; P.vz=tz*k; }

  function takeoff(P,vy,pop,ev){
    if(P.butter) endButter(P,ev);
    const Wd=W(), su=-P.z, side=ST.Park?ST.Park.wallSide(su,P.x-Wd.cx(su)):0;
    P.wallAir=false;
    if(side&&vy>2){ const dc=Wd.dcx(su), n=Math.hypot(1,dc), lx=1/n, lz=dc/n, vl=P.vx*lx+P.vz*lz;   // across the run, +u
      if(vl*side>0){ const want=-side*.35; P.vx+=lx*(want-vl); P.vz+=lz*(want-vl); P.wallAir=true; } }
    P.grounded=false; P.vy=vy; P.airT=0; P.sp=0; P.spU=0; P.unwind=null; P.spinT=null; P.fl=0; P.wfl=0; P.grabT=0; P.grabbed=false; P.grabName=''; P.grabSeq=0; P.grabList=[];
    P.wsp=pop&&pop.wind?pop.wind*C.spinRate*.55:0;   // let go of a loaded jump while turning: the spin starts with the pop (a wind-up)
    P.airPitch=P.gc.pitch; P.popKind=pop?pop.kind:'drop'; P.popT=0; P.lipPop=!!(pop&&pop.lip); P.charge=0; P.charging=false; P.skate=null; P.braking=false;
    if(P.wallAir) P.airPitch=clamp(Math.atan2(vy,Math.hypot(P.vx,P.vz)),-1,1.05);   // off a wall the board leaves pointing along its velocity, nose up
    P.airStart=P.y; P.swTake=P.sw; ev.push({type:'takeoff',pop:!!pop,kind:P.popKind,lip:P.lipPop,charge:pop?pop.charge:0}); }

  /* ---------- in the air ---------- */
  function stepAir(P,ctl,dt,ev){
    const T=W().T; P.airT+=dt;
    P.vy-=C.g*dt;
    const sp=Math.hypot(P.vx,P.vz), k=Math.exp(-(T.dq||.006)*sp*dt*.6); P.vx*=k; P.vz*=k;
    P.x+=P.vx*dt; P.z+=P.vz*dt; P.y+=P.vy*dt;
    /* Spins: the stick, or the SPIN button (turning the way the rider steers, or last turned on the snow), drives the rotation.
       When the spin input stops the rider spots the landing and times the rest of the turn to come down square: the target is
       the half turn nearest to where the rotation was heading (the angle a third of a second on at the present rate), reached
       just as the board meets the snow. A fast spin let go at 270 carries round to 360; a slow 20-degree drift comes back to
       straight; with too little air left it does not get there, and the landing shows it. */
    const spinIn=ctl.spin?(ctl.spinDir||1):ctl.steer, own0=P.sp-(P.spU||0);
    if(Math.abs(spinIn)>.15){ P.spinT=null; P.wsp=damp(P.wsp,spinIn*C.spinRate,7,dt); }
    else if(P.airT>.1&&(P.spinT!=null||Math.abs(own0)>.25||Math.abs(P.wsp)>1)){
      const tl=Math.max(.05,timeToLand(P)-.05);
      if(P.spinT==null) P.spinT=Math.round((own0+P.wsp*Math.min(tl,.33))/PI)*PI;
      P.wsp=damp(P.wsp,clamp((P.spinT-own0)/tl,-C.spinRate*1.5,C.spinRate*1.5),16,dt); }
    else P.wsp=damp(P.wsp,0,7,dt);
    P.sp+=P.wsp*dt;
    if(P.spinT!=null){ const own1=P.sp-(P.spU||0); if((P.spinT-own1)*(P.spinT-own0)<=0){ P.sp+=P.spinT-own1; P.wsp=0; } }   // arrived: no overshoot
    P.wfl=damp(P.wfl,P.grabbed?0:ctl.flip*C.flipRate,7,dt); P.fl+=P.wfl*dt;
    // off a boardslide the rider turns the board back in line with the travel by itself (that part is not a spin)
    if(P.unwind!=null){ const d=(P.unwind-P.spU)*(1-Math.exp(-9*dt)); P.spU+=d; P.sp+=d; }
    // off a pipe wall the rider comes back down the same wall: the board is brought round to lie along the line it will land on
    // (the velocity along the wall below), either end first; like the spin unwind, that turn is not part of a trick
    if(P.wallAir){ const g0=P.gc, vn=P.vx*g0.nx+P.vy*g0.ny+P.vz*g0.nz, tx=P.vx-vn*g0.nx, tz=P.vz-vn*g0.nz;
      if(tx*tx+tz*tz>1){ const e=wrap(2*(Math.atan2(tx,-tz)-(P.hd+P.sp)))/2, d=e*(1-Math.exp(-3.5*dt)); P.sp+=d; P.spU=(P.spU||0)+d; } }
    // grabs: the stick picks one (right Indy, left Mute, back Tail, forward Nose); with no direction each new grab in the same air
    // is the next of Indy, Tail, Mute, Nose, so tapping grab again chains grabs
    if(ctl.grab){ if(!P.grabbed){ const dg=Math.abs(ctl.steer)>Math.abs(ctl.flip)&&Math.abs(ctl.steer)>.35?(ctl.steer>0?'INDY':'MUTE'):ctl.flip>.35?'TAIL':ctl.flip<-.35?'NOSE':null;
        P.grabName=dg||GRABS[(P.grabSeq||0)%GRABS.length]; P.grabSeq=(P.grabSeq||0)+1; if(P.grabList.indexOf(P.grabName)<0) P.grabList.push(P.grabName); } P.grabbed=true; P.grabT+=dt; }
    else P.grabbed=false;
    if(!ctl.jump&&P.charging){ P.charging=false; P.relBuf=C.relBuf; }               // let go just before landing: pop on touchdown
    P.relBuf=Math.max(0,P.relBuf-dt); if(ctl.jump&&!P.charging) P.charging=true;    // and a press in the air loads for the landing
    // the rider brings the board's pitch round to meet the snow below (a skill: lands flat-based on the landing)
    const g=contact(P.x,P.z,P.hd,P.gc); P.airPitch=damp(P.airPitch,g.pitch,2.4,dt);
    if(!P.forceFall&&tryGrind(P,ev)) return;
    if(P.y<=g.yC) land(P,ctl,ev);
  }

  const GRABS=['INDY','TAIL','MUTE','NOSE'];
  /* time until the board meets the snow, with the snow taken as a plane under the rider (re-estimated every step, so it is good
     where it matters: close to the landing) */
  function timeToLand(P){ const g=P.gc, s=g.gx*P.vx+g.gz*P.vz, a=.5*C.g, b=s-P.vy, c=g.yC-P.y, d=b*b-4*a*c; return d<=0?0:(-b+Math.sqrt(d))/(2*a); }
  function land(P,ctl,ev){
    const g=contact(P.x,P.z,P.hd,P.gc);
    const vn=P.vx*g.nx+P.vy*g.ny+P.vz*g.nz, imp=Math.max(0,-vn);
    let tx=P.vx-vn*g.nx, ty=P.vy-vn*g.ny, tz=P.vz-vn*g.nz; const tl=Math.hypot(tx,ty,tz), keep=tl>0?Math.max(0,tl-.12*imp)/tl:0;   // the snow takes a little of the speed along it
    P.vx=tx*keep; P.vz=tz*keep; P.y=g.yC; P.vy=ty*keep;
    const half=Math.round((P.sp-(P.spU||0))/PI), flips=Math.round(P.fl/TAU), flipR=P.fl-flips*TAU;
    // which end of the board leads now? N is where the regular nose points; the end nearer the travel leads (in a pipe the travel
    // reverses, so coming down without a spin is riding fakie)
    const spd=Math.hypot(P.vx,P.vz), vhL=spd>.5?Math.atan2(P.vx,-P.vz):P.hd, N=P.hd+P.sp+(P.sw?PI:0);
    const noseLeads=Math.abs(wrap(N-vhL))<=PI/2, lead=noseLeads?N:N+PI;
    const yawErr=Math.abs(wrap(lead-vhL)), pitchErr=Math.abs(flipR)+Math.abs(P.airPitch-g.pitch)*.5;
    let out='clean';
    if(P.forceFall||imp>C.landFall||yawErr>C.yawFall||pitchErr>C.pitchFall) out='fall';
    else if(imp>C.landClean||yawErr>C.yawStumble||pitchErr>C.pitchStumble) out='stumble';
    P.forceFall=false; P.sw=!noseLeads; P.hd=wrap(lead); P.vyT=P.vy;
    const air=P.airT, ev1={type:'land',imp,out,half,flips,spin:P.sp,flip:P.fl,yawErr,pitchErr,air,grab:P.grabT,grabName:P.grabName,grabs:P.grabList.slice(),kind:P.popKind,lip:P.lipPop,swTake:P.swTake,sw:P.sw};
    P.sp=0; P.spU=0; P.unwind=null; P.spinT=null; P.fl=flipR; P.grounded=true; P.fresh=true; P.airT=0; P.wsp=P.wfl=0; P.grabbed=false; P.grabT=0; P.wallAir=false;
    P.landT=0; P.landAbs=clamp(imp/7.5,.15,1); P.landOut=out;
    if(out==='stumble'){ P.stumble=.7; P.vx*=.88; P.vz*=.88; }
    ev.push(ev1);
    if(out==='fall') startFall(P,'land',ev);
    else if(P.relBuf>0){ P.charge=Math.max(P.charge,.3); }          // released just before touchdown: it pops on the first step on the snow
  }

  /* ---------- jibs: boxes and rails ----------
     A rider locks onto a jib when the base arrives at its top (within a few centimetres of height and a hand's width across)
     moving along it, not across it. On it: gravity along the jib, low friction (metal 0.11, plastic box 0.15), and a balance the
     rider keeps with the stick (rails are harder than wide boxes). The board rides along it (50-50) or across it (boardslide),
     whichever is closer to how it arrived; stick forward/back presses the nose or the tail. Let go of a loaded jump to pop off;
     run out of jib and you fly off its end; lose the balance and you fall off. */
  function tryGrind(P,ev){
    if(!ST.Park||!ST.Park.rails.length||P.grindCool>0||P.fall) return false;
    let got=null;
    ST.Park.railsNear(P.x,P.z,r=>{ if(got) return; const c=ST.Park.closest(r,P.x,P.y,P.z); if(!c) return;
      const tol=r.w+(r.kind==='rail'?.3:.2), dy=P.y-c.p.y; if(c.dh>tol) return;
      const sp=Math.hypot(P.vx,P.vz), vh=Math.atan2(P.vx,-P.vz), hdir=Math.atan2(c.dir.x,-c.dir.z), a=wrap(vh-hdir);
      // riding on (a ride-on ramp ends just below the top) or coming down onto the top from the air
      if(dy>-.3&&dy<(P.grounded?.32:.06)&&(P.grounded||P.vy<1.5)&&sp>1.5&&Math.abs(Math.cos(a))>.55){ got={r,c,dirSign:Math.cos(a)>=0?1:-1}; return; }
      // not on it: a rider whose board is below the top inside its footprint has run into it
      if(P.grounded&&dy<-.3&&c.dh<r.w+.15&&c.t>.2&&c.t<r.len-.2) got={hit:true,r,c}; });
    if(!got) return false;
    if(got.hit){ if(P.invuln>0) return false; hit(P,got.c.p.x,got.c.p.z,got.r.w+.05,ev); return true; }
    const {r,c,dirSign}=got, travel=Math.atan2(c.dir.x*dirSign,-c.dir.z*dirSign);
    // B: where the leading end of the board points (as the physics carries it); N: where its nose points
    const B=P.hd+P.sp, N=B+(P.sw?PI:0), relB=wrap(B-travel), relN=wrap(N-travel), across=Math.abs(Math.sin(relB))>.7;
    const fromAir=!P.grounded, spinP=P.sp-(P.spU||0), half=Math.sign(spinP)*Math.round(Math.max(0,Math.abs(spinP)-(across?PI/2:0))/PI);   // the quarter turn into a boardslide is the slide, not a spin
    if(fromAir) ev.push({type:'land',imp:0,out:'clean',half,flips:0,spin:spinP,flip:0,yawErr:0,pitchErr:0,air:P.airT,grab:P.grabT,grabName:P.grabName,kind:P.popKind,lip:false,swTake:P.swTake,sw:P.sw,onto:r.name});
    let lead, sw;
    if(across){ lead=travel+Math.sign(Math.sin(relB))*PI/2; sw=P.sw; }                    // boardslide: the board across the jib
    else { const nose=Math.cos(relN)>=0; lead=nose?N:N+PI; sw=!nose; }                     // 50-50: whichever end points along it leads
    const v=Math.max(2,Math.hypot(P.vx,P.vz)*Math.abs(Math.cos(wrap(Math.atan2(P.vx,-P.vz)-travel))));
    // where on the top the board came down: a box keeps it (it is wide), a rail pulls it onto its line within a few frames
    const nl=Math.hypot(c.dir.x,c.dir.z)||1, nx=-c.dir.z/nl, nz=c.dir.x/nl, lat=((P.x-c.p.x)*nx+(P.z-c.p.z)*nz)*dirSign;
    P.grind={r,t:c.t,dir:dirSign,v,style:across?'BOARDSLIDE':'50-50',lead:wrap(lead-travel),time:0,bal:0,balV:0,press:0,pressT:0,seed:(c.t*7.3+P.t)%6.28,fromAir,
      off:lat,offMax:r.kind==='rail'?0:Math.max(0,r.w-.15),dy:P.y-c.p.y};
    P.sw=sw; P.sp=0; P.spU=0; P.unwind=null; P.fl=0; P.wsp=P.wfl=0; P.grounded=true; P.airT=0; P.grabbed=false; P.grabT=0; P.charging=false; P.charge=0; P.skate=null; P.braking=false; P.butter=null; P.landT=0; P.landAbs=fromAir?.35:.1; P.landOut='clean';
    ev.push({type:'grindStart',name:r.name,kind:r.kind,style:P.grind.style,sw});
    return true; }
  function stepGrind(P,ctl,dt,ev){
    const G=P.grind, r=G.r, T=W().T; G.time+=dt;
    const at=ST.Park.at(r,G.t), d=at.dir, tx=d.x*G.dir, ty=d.y*G.dir, tz=d.z*G.dir;            // direction of travel along the jib
    const mu=r.kind==='rail'?C.muRail:C.muBox, cosI=Math.sqrt(Math.max(0,1-ty*ty));
    G.v+=(-C.g*ty-mu*C.g*cosI-(T.dq||.006)*G.v*G.v)*dt; G.t+=G.v*G.dir*dt;
    /* balance: an inverted pendulum (left alone, a lean grows) pushed about by the jib; the stick moves the body (push toward the
       side you want to go). A rail is narrower than a box and less forgiving; a wide butter box hardly asks anything. */
    const hard=r.kind==='rail'?1:(r.butter?.35:.55);
    const kick=(Math.sin(P.t*2.7+G.seed)*1.1+Math.sin(P.t*5.3+G.seed*2.1)*.6)*hard;
    G.balV+=(kick+G.bal*2.5*hard+ctl.steer*2.6)*dt; G.balV*=Math.exp(-dt*2.2); G.bal+=G.balV*dt;
    // presses (along the jib only: a boardslide has no end on the jib to press)
    const want=G.style==='50-50'?(ctl.fwd>.5?1:ctl.fwd<-.5?-1:0):0;
    G.press=damp(G.press,want,8,dt); if(Math.abs(G.press)>.6) G.pressT+=dt; P.press=Math.sign(G.press); P.pressK=Math.abs(G.press);
    // release a loaded jump: pop off the jib
    let release=false; if(ctl.jump){ P.charge=Math.min(1,P.charge+dt/C.chargeT); P.charging=true; } else if(P.charging){ P.charging=false; release=true; }
    const off=G.t<-.05||G.t>r.len+.05||G.v<.5, lost=Math.abs(G.bal)>1;
    const p=ST.Park.at(r,clamp(G.t,0,r.len)).p, th=Math.atan2(tx,-tz), hl=Math.hypot(tx,tz)||1, nx=-tz/hl, nz=tx/hl;
    G.off=G.offMax?clamp(G.off,-G.offMax,G.offMax):damp(G.off,0,14,dt); G.dy=damp(G.dy,0,G.dy<0?45:14,dt);   // below the top (off a ride-on ramp): up onto it within a few frames
    P.x=p.x+nx*G.off; P.z=p.z+nz*G.off; P.y=p.y+G.dy; P.vx=tx*G.v; P.vz=tz*G.v; P.vy=ty*G.v;
    P.hd=wrap(th+G.lead+G.bal*.12); P.om=0;
    // what the visuals need: the board's pitch along its length, and a flat roll
    const g=P.gc; g.pitch=G.style==='50-50'?Math.atan2(ty,cosI):0; g.roll=G.style==='50-50'?0:-Math.atan2(ty,cosI)*Math.sign(Math.sin(G.lead)); g.h=g.yC=P.y; g.gap=0;
    if(off||lost||release){
      const fell=lost&&!release, phys=P.sw?-1:1;
      ev.push({type:'grindEnd',name:r.name,kind:r.kind,style:G.style,time:G.time,pressT:G.pressT,press:G.pressT>G.time*.45?Math.sign(G.press||1)*phys:0,fell,butter:r.butter,sw:P.sw});
      P.grind=null; P.grindCool=C.grindCool; P.press=0; P.pressK=0;
      if(fell){ P.forceFall=true; const s=Math.sign(G.bal); P.vx+=Math.cos(P.hd)*s*1.2; P.vz+=Math.sin(P.hd)*s*1.2; }   // thrown off the side it leaned to
      const pop=release?lerp(C.popTap,C.popFull,P.charge):0;
      takeoff(P,P.vy+pop+(off&&!release?.4:0),release?{kind:'ollie',lip:false,charge:P.charge}:null,ev); P.charge=0;
      if(G.style==='BOARDSLIDE'&&!fell) P.unwind=wrap(th-P.hd); }   // out of a boardslide the board turns back in line
  }
  /* a butter ends when the press is let go: the board settles on whichever end now leads */
  function endButter(P,ev){ const B=P.butter; if(!B) return; P.butter=null;
    const spd=Math.hypot(P.vx,P.vz), vh=spd>.5?Math.atan2(P.vx,-P.vz):P.hd, N=P.hd+P.sp+(P.sw?PI:0), nose=Math.abs(wrap(N-vh))<=PI/2, lead=nose?N:N+PI, err=Math.abs(wrap(lead-vh));
    const half=Math.round(B.spin/PI); P.sw=!nose; P.hd=wrap(lead); P.sp=0;
    ev.push({type:'butter',end:B.end,phys:B.phys,half,spin:B.spin,time:B.t,err,clean:err<.5});
    if(err>.9){ P.stumble=.6; P.vx*=.85; P.vz*=.85; } }

  /* ---------- falling, sliding, getting up ---------- */
  function startFall(P,why,ev){
    if(P.fall) return;
    P.fall={ph:why==='hit'?'down':'lose',t:0,why,side:P.sw?1:-1}; P.braking=false; P.skate=null; P.charging=false; P.charge=0;
    if(!P.grounded){ P.grounded=true; P.y=P.gc.yC; P.vy=0; }
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
      P.x+=P.vx*dt; P.z+=P.vz*dt; contact(P.x,P.z,P.hd,gc); P.vy=(gc.yC-P.y)/dt; P.y=gc.yC;
      if(F.ph==='down'&&F.t>.45){ F.ph='slide'; F.t=0; }
      else if(F.ph==='slide'&&(Math.hypot(P.vx,P.vz)<.45||F.t>1.6)){ F.ph='getup'; F.t=0; P.vx=P.vz=0; P.vy=0; ev.push({type:'getup'}); }
      return; }
    P.vx=P.vz=P.vy=0; contact(P.x,P.z,P.hd,gc); P.y=gc.yC;
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

  ST.Physics={C,contact,reset,step,startFall,hit,finishStep,wrap,tuneDrag,tryGrind};
})(window.ST);
