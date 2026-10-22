/* Snow Rush: walking about a town (the snow village, the beach) — the controller both worlds share.
   A place says what the ground is and what is solid: ground(x,z) -> y; out(p,r) pushes a point {x,z} out of walls, posts and
   stalls; inside(x,z,pad) -> is there a wall (for the camera); bounds(p) keeps the walker within the place.
   Touch: a joystick that appears wherever the left thumb lands (to its rim = run), and a drag on the right half turns the
   camera (a mouse always turns the camera). Keys come in through step(). The camera swings behind the walker as it walks
   (not while the player turns it by hand), comes in front of a wall rather than looking through it, and with a sheet open it
   frames the walker in the part of the screen the sheet leaves free ('show' brings it round to the front). */
(function(ST){
  const {clamp,damp}=ST; const PI=Math.PI, wrapA=a=>Math.atan2(Math.sin(a),Math.cos(a));
  ST.makeWalker=function(opt){ opt=opt||{};
    const WALK_V=opt.walk||1.25, RUN_V=opt.run||3.6;
    const W={x:0,z:0,y:0,hd:0,v:0,vEff:0,camYaw:0,camPitch:.3,tx:0,ty:0,tz:0,snap:true,dragT:0,wave:0,sheet:null,moved:0,place:null,
      joy:{id:null,cx:0,cy:0,x:0,y:0,cam:null,lx:0,ly:0}};
    W.setPlace=pl=>{ W.place=pl; };
    /* stand at {x,z,hd} (the camera snaps behind) */
    W.put=function(at){ const pl=W.place; W.hd=at.hd||0; W.v=0; W.vEff=0; W.camYaw=W.hd+PI; W.camPitch=.3; W.snap=true; W.wave=0; W.moved=0;
      const p={x:at.x,z:at.z}; if(pl&&pl.out) pl.out(p,.4); W.x=p.x; W.z=p.z; W.y=pl?pl.ground(W.x,W.z):0; };
    /* the floating joystick and the camera drag on a full-screen zone; onDown(e) may take the touch (return true) */
    W.bindTouch=function(zone,joyEl,knobEl,onDown){ const J=W.joy;
      zone.addEventListener('pointerdown',e=>{ e.preventDefault(); if(onDown&&onDown(e)) return;
        const left=e.pointerType!=='mouse'&&e.clientX<innerWidth*.5;
        if(left&&J.id===null){ J.id=e.pointerId; J.cx=e.clientX; J.cy=e.clientY; J.x=J.y=0; joyEl.style.left=e.clientX+'px'; joyEl.style.top=e.clientY+'px'; joyEl.hidden=false; knobEl.style.transform=''; }
        else if(J.cam===null){ J.cam=e.pointerId; J.lx=e.clientX; J.ly=e.clientY; }
        try{ zone.setPointerCapture(e.pointerId); }catch(_){} });
      zone.addEventListener('pointermove',e=>{ if(e.pointerId===J.id){ let dx=e.clientX-J.cx, dy=e.clientY-J.cy; const R=52, d=Math.hypot(dx,dy); if(d>R){ dx*=R/d; dy*=R/d; } J.x=dx/R; J.y=dy/R; knobEl.style.transform=`translate(${dx}px,${dy}px)`; }
        else if(e.pointerId===J.cam){ const k=e.pointerType==='mouse'?.0055:.0085; W.camYaw-=(e.clientX-J.lx)*k; W.camPitch=clamp(W.camPitch+(e.clientY-J.ly)*k*.6,.05,.85); J.lx=e.clientX; J.ly=e.clientY; W.dragT=1.6; } });
      const up=e=>{ if(e.pointerId===J.id){ J.id=null; J.x=J.y=0; joyEl.hidden=true; } if(e.pointerId===J.cam) J.cam=null; };
      zone.addEventListener('pointerup',up); zone.addEventListener('pointercancel',up);
      zone.addEventListener('wheel',e=>{ W.camPitch=clamp(W.camPitch+e.deltaY*.0008,.05,.85); },{passive:true}); };
    /* one step: k = {u,d,l,r,run} from the keys; the stick (or the keys) relative to the camera; the stick at its rim, or Shift, runs */
    W.step=function(dt,k){ const pl=W.place, J=W.joy; k=k||{};
      let ix=J.x+(k.r?1:0)-(k.l?1:0), iy=J.y+(k.d?1:0)-(k.u?1:0), mag=Math.hypot(ix,iy); if(mag>1){ ix/=mag; iy/=mag; mag=1; }
      if(W.sheet) mag=0;
      const run=mag>.12&&(k.run||Math.hypot(J.x,J.y)>.93); let want=mag<.12?0:run?RUN_V:WALK_V*clamp((mag-.12)/.55,.4,1);
      if(want>0){ const fx=-Math.sin(W.camYaw), fz=-Math.cos(W.camYaw), mx=fx*(-iy)+(-fz)*ix, mz=fz*(-iy)+fx*ix, tgt=Math.atan2(mx,mz), d=wrapA(tgt-W.hd);
        const tm=run?4.5:6; W.hd=wrapA(W.hd+clamp(d*(1-Math.exp(-dt*(run?6.5:8.5))),-tm*dt,tm*dt)); want*=Math.max(.2,Math.cos(Math.min(Math.abs(d),PI/2))); }   // turn first (at most ~340°/s walking, ~260° running: a person pivots, not a top), then go
      W.v=damp(W.v,want,want>W.v?4.5:9,dt);
      const p={x:W.x+Math.sin(W.hd)*W.v*dt,z:W.z+Math.cos(W.hd)*W.v*dt};
      if(pl&&pl.out) pl.out(p,.4);
      // step round the people close by
      if(ST.People) for(const a of ST.People.active){ const r=a.r; if(r.hide) continue; const dx=p.x-r.x, dz=p.z-r.z, dl=Math.hypot(dx,dz); if(dl<.75&&dl>1e-3){ p.x=r.x+dx/dl*.75; p.z=r.z+dz/dl*.75; } }
      if(pl&&pl.bounds) pl.bounds(p);
      const moved=Math.hypot(p.x-W.x,p.z-W.z); W.vEff=damp(W.vEff,moved/Math.max(dt,1e-4),14,dt); W.moved+=moved;
      W.x=p.x; W.z=p.z; W.y=pl?pl.ground(W.x,W.z):0;
      if(W.wave>0) W.wave-=dt; if(W.dragT>0) W.dragT-=dt; };
    /* the camera; o = {show (the walker from the front), sheet (a sheet is open)} */
    const _c=new THREE.Vector3(), _l=new THREE.Vector3();
    W.cam=function(camera,dt,o){ o=o||{}; const pl=W.place, Wd=innerWidth, H=innerHeight, portrait=H>Wd*1.05, show=!!o.show;
      let yawT=null; if(show) yawT=W.hd+.45; else if(W.vEff>.5&&W.dragT<=0) yawT=W.hd+PI;
      if(yawT!=null) W.camYaw+=wrapA(yawT-W.camYaw)*(1-Math.exp(-dt*(show?3.5:1.5*clamp(W.vEff/1.6,.5,1.6))));
      const k=W.snap?1:1-Math.exp(-dt*9); W.tx+=(W.x-W.tx)*k; W.tz+=(W.z-W.tz)*k; W.ty+=(W.y-W.ty)*(W.snap?1:1-Math.exp(-dt*6));
      const pitch=show?.1:W.camPitch, look=show?.95:1.35; let dist=show?(portrait?3.6:3.1):(portrait?5.4:4.5)+clamp(W.vEff-2,0,2)*.35;
      const ox=Math.sin(W.camYaw)*Math.cos(pitch), oy=Math.sin(pitch), oz=Math.cos(W.camYaw)*Math.cos(pitch), ty=W.ty+look;
      // a wall between: the camera comes in front of it
      if(pl&&pl.inside){ for(let t=.18;t<=1.001;t+=.06){ const x=W.tx+ox*dist*t, z=W.tz+oz*dist*t; if(pl.inside(x,z,.35)){ dist=Math.max(1.3,dist*(t-.08)); break; } } }
      _c.set(W.tx+ox*dist,ty+oy*dist,W.tz+oz*dist); if(pl) _c.y=Math.max(_c.y,pl.ground(_c.x,_c.z)+.5);
      camera.position.copy(_c); _l.set(W.tx,ty,W.tz); camera.lookAt(_l);
      const fov=(ST.baseFov||62)+(portrait?12:-2)+(show?-6:0); if(W.snap||Math.abs(camera.fov-fov)>.05){ camera.fov=W.snap?fov:damp(camera.fov,fov,5,dt); camera.updateProjectionMatrix(); }
      // with a sheet open the walker is framed where the sheet leaves room: above it (upright phone) or beside it
      const want=o.sheet?(portrait?[0,H*.21]:[Wd*.2,0]):null;
      if(want) camera.setViewOffset(Wd,H,want[0],want[1],Wd,H); else if(camera.view&&camera.view.enabled) camera.clearViewOffset();
      W.snap=false; };
    return W; };
})(window.ST);
