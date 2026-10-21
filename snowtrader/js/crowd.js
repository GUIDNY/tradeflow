/* Snow Rush · Surf Rush: people walking a town the way people walk (any town can use it; the beach does).
   A walker follows its route like a person, not like a bead on a wire:
   - it heads for a point a few metres ahead along the route, on its own side of it (people keep to the right), with a slow
     drift across the walk so no two are on a rail;
   - it speeds up and slows down gently (about 0.8 m/s² up, 1.6 down) and turns at a person's rate (about 140° a second at
     most, slower when jogging), slowing into a sharp turn; the end of a route is a short U-turn, not a flip;
   - it keeps its distance: a soft ring of personal space round everyone, and when someone is coming its way it starts to
     step aside early (each to their right when they meet head on, away from the side the other will pass), slowing behind
     someone it can't get past; the player counts as someone, and people give way to the player;
   - now and then it stops for a few seconds and turns to look somewhere (the sea, a shop window), then goes on;
   - couples walk side by side at one pace and stop together; joggers run and weave through.
   The figure's animation is the clip that matches its speed, played at the speed that keeps the planted foot still on the
   ground (js/people.js measures each clip's pace). Positions, heading, clip and speed go into the person's registration
   (r.x, r.z, r.ry, r.anim, r.spd); people.js draws whatever it is (a full figure near the camera, a stand-in further off). */
(function(ST){
  const {clamp,hash2}=ST; const PI=Math.PI, wrapA=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const C={};
  const K={look0:2.4, lookV:.8,          // m ahead to aim at (+ per m/s)
    acc:.8, dec:1.6, accJog:1.4,        // m/s²
    turn:2.4, turnJog:1.6,              // rad/s
    r:.3,                               // a body's radius (m); the player's .4
    space:.38, push:1.25,               // personal space (m) beyond touching, and how hard it pushes (m/s per unit)
    see:3.2, horizon:2.6,               // how far ahead someone is noticed (m), and how many seconds of their path are looked at
    side:1.1 };                         // how hard a walker steps aside (m/s)
  C.K=K;
  C.agents=[]; C.player={x:0,z:0,vx:0,vz:0,on:false};
  /* the player each frame (a town's walker: where, how fast): people see it and give way */
  C.setPlayer=function(x,z,vx,vz,on){ const p=C.player; p.x=x; p.z=z; p.vx=vx||0; p.vz=vz||0; p.on=!!on; };
  // a grid of who is where (2 m cells), rebuilt once a frame
  const CELL=2, grid=new Map(); let gridFrame=-1;
  const key=(i,j)=>i*73856093^j*19349663;
  function buildGrid(){ grid.clear(); for(const a of C.agents){ if(a.hide) continue; const k=key(Math.floor(a.x/CELL),Math.floor(a.z/CELL)); let b=grid.get(k); if(!b) grid.set(k,b=[]); b.push(a); } }
  function near(x,z,f){ const i0=Math.floor(x/CELL), j0=Math.floor(z/CELL); for(let i=i0-2;i<=i0+2;i++) for(let j=j0-2;j<=j0+2;j++){ const b=grid.get(key(i,j)); if(b) for(const a of b) f(a); } }
  const _o={x:0,z:0,dx:0,dz:1}, _t={x:0,z:0,dx:0,dz:1};
  /* how a walker moves. opt: {path, speed (m/s), phase (0..1 along the route), seed, lane (m right of the route's middle),
     jog (runs), pauseEvery (s, ~), pauseFor (s, ~), look (a heading to face when it stops: e.g. the sea), leader (walk beside
     that registration), side (-1 left, +1 right of the leader), place (the town: out(p,r) pushes out of walls)} */
  C.walker=function(opt){ const seed=opt.seed||1;
    return (r,dt,t)=>{
      if(r.c===undefined) init(r,opt,seed);
      if(gridFrame!==ST.People.frame){ gridFrame=ST.People.frame; buildGrid(); }
      step(r,dt,opt);
    }; };
  function init(r,opt,seed){ const P=opt.path; r.c=1; r.t=(opt.phase||0)*P.len; r.wd=hash2(seed,21)<.5?1:-1; if(opt.leader) r.wd=0;
    P.at(r.t,_o); const l=Math.hypot(_o.dx,_o.dz)||1, rx=-_o.dz/l*r.wd, rz=_o.dx/l*r.wd; r.lane=opt.lane!=null?opt.lane:.7+hash2(seed,22)*2.2;
    r.x=_o.x+rx*r.lane; r.z=_o.z+rz*r.lane; r.h=Math.atan2(_o.dx*(r.wd||1),_o.dz*(r.wd||1)); r.v=0; r.v0=opt.speed||1.25; r.pause=0; r.np=(opt.pauseEvery||16)*(.4+hash2(seed,23)*1.2);
    r.dph=hash2(seed,24)*6.28; r.y=ST.World.groundY(r.x,r.z); r.ry=r.h; r.anim='Idle'; r.spd=0; C.agents.push(r); }
  function step(r,dt,opt){ const P=opt.path, jog=!!opt.jog, L=opt.leader;
    // where it wants to go: on its route a few metres on, on its side of the walk (or beside its partner)
    let tx, tz, vWant=r.v0;
    if(L&&L.c){ // beside the partner: on the partner's left or right, abreast
      const fx=Math.sin(L.h), fz=Math.cos(L.h), rx=-fz, rz=fx, s=opt.side||1; tx=L.x+rx*.62*s+fx*(.4+L.v*.5); tz=L.z+rz*.62*s+fz*(.4+L.v*.5);
      const ahead=(r.x-L.x)*fx+(r.z-L.z)*fz; vWant=Math.max(0,L.v+clamp(-ahead*1.2,-.6,.6)); r.pause=L.pause>0?Math.max(r.pause,.01):0;
      if(L.pause>0){ vWant=0; r.look=L.look; } }
    else {
      if(r.pause>0){ r.pause-=dt; vWant=0; }
      else if(!jog){ r.np-=dt; if(r.np<=0){ r.np=(opt.pauseEvery||16)*(.5+hash2(opt.seed||1,Math.floor(r.t)+7)); r.pause=(opt.pauseFor||3.5)*(.5+hash2(opt.seed||1,Math.floor(r.t)+9));
          r.look=opt.look!=null?opt.look+(hash2(opt.seed||1,Math.floor(r.t))-.5)*1.2:r.h+(hash2(opt.seed||1,Math.floor(r.t)+5)-.5)*2.4; } }
      // progress along the route: the part of its own motion that goes along it, and a pull to its true place on it
      P.at(r.t,_o); let l=Math.hypot(_o.dx,_o.dz)||1; const ux=_o.dx/l, uz=_o.dz/l, along=(r.x-_o.x)*ux+(r.z-_o.z)*uz;
      r.t+=along*Math.min(1,dt*4);
      if(!P.loop){ if(r.t>=P.len-.5&&r.wd>0){ r.wd=-1; } else if(r.t<=.5&&r.wd<0){ r.wd=1; } }
      const la=K.look0+K.lookV*r.v; P.at(r.t+r.wd*la,_t); l=Math.hypot(_t.dx,_t.dz)||1;
      const rx=-_t.dz/l*r.wd, rz=_t.dx/l*r.wd, lane=r.lane+.55*Math.sin(r.t*.13+r.dph)+.25*Math.sin(r.t*.37+2*r.dph);   // keep right, drift across the walk
      tx=_t.x+rx*lane; tz=_t.z+rz*lane; }
    let dx=tx-r.x, dz=tz-r.z; const dl=Math.hypot(dx,dz)||1; dx/=dl; dz/=dl;
    // the others: personal space, and stepping aside for someone on a collision course (people give way to the player)
    const fx=Math.sin(r.h), fz=Math.cos(r.h), vx=fx*r.v, vz=fz*r.v; let ax=0, az=0, slow=1;
    const other=(ox,oz,ovx,ovz,orad,weight)=>{ const px=ox-r.x, pz=oz-r.z, d=Math.hypot(px,pz); if(d<1e-3||d>K.see+2) return; const touch=K.r+orad;
      // personal space: a soft push apart, hard when touching
      const sp=Math.exp(-(d-touch)/K.space)*K.push*weight; ax-=px/d*sp; az-=pz/d*sp;
      // where the two will be closest, over the next few seconds
      const rvx=vx-ovx, rvz=vz-ovz, rv2=rvx*rvx+rvz*rvz; if(rv2<.01) return; const tc=clamp((px*rvx+pz*rvz)/rv2,0,K.horizon); if(tc<=0) return;
      const cx=px-rvx*tc, cz=pz-rvz*tc, cd=Math.hypot(cx,cz), need=touch+.35; if(cd>=need) return;
      const ahead=px*fx+pz*fz; if(ahead<-.3) return;   // behind: its business to get round
      // step aside, away from the side it will pass on (head on: to the right)
      let s=(-fz)*cx+fx*cz; s=Math.abs(s)<.08?-1:Math.sign(s);   // + = it passes on the right: go left
      const k=(1-cd/need)*(1-tc/K.horizon*.7)*K.side*weight; ax+=-s*(-fz)*k; az+=-s*fx*k;
      // someone slower just ahead on the same line, that it can't get round yet: slow down
      const ovf=ovx*fx+ovz*fz; if(ahead>0&&ahead<1.6+r.v*.6&&Math.abs(px*(-fz)+pz*fx)<.7&&ovf<r.v) slow=Math.min(slow,clamp((ahead-touch)/1.2,0,1)*(1-ovf/Math.max(r.v,.1))+ovf/Math.max(r.v,.1)); };
    near(r.x,r.z,a=>{ if(a===r||a.hide) return; other(a.x,a.z,Math.sin(a.h)*a.v,Math.cos(a.h)*a.v,K.r,a===L?.25:1); });
    const pl=C.player; if(pl.on) other(pl.x,pl.z,pl.vx,pl.vz,.4,1.6);
    // the way it heads: the goal plus the step aside; how fast: slower into a sharp turn, behind someone, stopped
    let hx=dx*Math.max(vWant,.6)+ax, hz=dz*Math.max(vWant,.6)+az; const stopped=vWant<.05&&r.v<.15;
    let hWant=stopped&&r.look!=null&&!L?r.look:Math.atan2(hx,hz); if(stopped&&L&&L.pause>0) hWant=r.look!=null?r.look:r.h;
    const err=wrapA(hWant-r.h), tr=(jog?K.turnJog:K.turn)*(stopped?.6:1);
    r.h=wrapA(r.h+clamp(err,-tr*dt,tr*dt));
    vWant*=clamp(Math.cos(Math.min(Math.abs(err),PI/2))*1.15,.15,1)*slow;
    r.v+=clamp(vWant-r.v,-K.dec*dt,(jog?K.accJog:K.acc)*dt); if(r.v<0) r.v=0;
    // move along its heading (people walk forward: the push apart only bends the heading), then out of walls and posts
    const p={x:r.x+Math.sin(r.h)*r.v*dt,z:r.z+Math.cos(r.h)*r.v*dt};
    // overlapping someone (a crowd squeezed together, the player walking into it): it gives way bodily
    near(p.x,p.z,a=>{ if(a===r||a.hide) return; const qx=p.x-a.x, qz=p.z-a.z, d=Math.hypot(qx,qz), m=2*K.r*.9; if(d<m&&d>1e-4){ p.x+=qx/d*(m-d)*.5; p.z+=qz/d*(m-d)*.5; } });
    if(pl.on){ const qx=p.x-pl.x, qz=p.z-pl.z, d=Math.hypot(qx,qz), m=K.r+.42; if(d<m&&d>1e-4){ p.x=pl.x+qx/d*m; p.z=pl.z+qz/d*m; } }
    if(opt.place&&opt.place.out) opt.place.out(p,K.r);
    r.x=p.x; r.z=p.z; r.y=ST.World.groundY(r.x,r.z); r.ry=r.h;
    r.anim=r.v<.12?'Idle':jog&&r.v>1.5?'Run':'Walk'; r.spd=r.v; }
  /* forget a town's walkers (People.clear drops their registrations) */
  C.clear=function(){ C.agents.length=0; gridFrame=-1; };
  ST.Crowd=C;
})(window.ST);
