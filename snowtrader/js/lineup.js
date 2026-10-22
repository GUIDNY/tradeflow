/* Surf Rush: the other surfers at the surf spot. A real lineup is never empty: a handful of surfers sit on their boards just
   outside where the waves break, facing out to sea and rising and falling on the swell. When a wave breaks near one of them
   (and it isn't the player's, and the player isn't waiting for it close by), that one takes it: up on the board and along
   the face just ahead of the curl, down it and back up it, until the wave runs out or nears the sand; then over the back of
   it, lying down to paddle back out, and sitting up again in the lineup. One surfer to a wave, as the etiquette goes.
   Simple figures (they are seen from the beach, from the lineup or from the next wave), three poses each: sitting, paddling,
   standing. Positions come from the waves' own model (js/coast.js), so they ride the water that is drawn. */
(function(ST){
  const {lerp,clamp,damp}=ST, PI=Math.PI, Cst=ST.Coast, S=Cst.SURF, wrapA=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const L={list:[],grp:new THREE.Group(),taken:new Map()}; L.grp.name='lineup';
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55});
  // a part of a figure: a shape in one colour (vertex colours, so the whole pose bakes into one mesh)
  function part(g,geo,c,x,y,z,rx,ry,rz){ const m=new THREE.Mesh(geo.index?geo.toNonIndexed():geo,mat), cc=new THREE.Color(c).convertSRGBToLinear(), n=m.geometry.attributes.position.count, a=new Float32Array(n*3);
    for(let i=0;i<n;i++){ a[i*3]=cc.r; a[i*3+1]=cc.g; a[i*3+2]=cc.b; } m.geometry.setAttribute('color',new THREE.BufferAttribute(a,3)); m.position.set(x,y,z); m.rotation.set(rx||0,ry||0,rz||0); g.add(m); return m; }
  const BOX=(w,h,d)=>new THREE.BoxGeometry(w,h,d), BALL=r=>new THREE.SphereGeometry(r,10,7);
  /* the board along z (its nose at +z), the surfer on it: a. sitting astride, legs in the water; b. lying on it, arms in the
     water to paddle; c. standing sideways on it (front foot toward the nose), knees bent, arms out */
  function surfer(board,suit,skin,hair){ const poses={};
    const deck=()=>{ const g=new THREE.Group(), b=part(g,BALL(1),board,0,0,0); b.scale.set(.27,.045,.98); part(g,BOX(.012,.02,1.7),0xd8c9a8,0,.042,0); return g; };   // the board and its stringer
    { const g=deck(); part(g,BOX(.34,.5,.2),suit,0,.4,-.22,-.12); part(g,BALL(.11),skin,0,.76,-.18); part(g,BALL(.115),hair,0,.8,-.2).scale.set(1,.7,1);
      for(const s of [-1,1]){ part(g,BOX(.11,.12,.4),suit,s*.13,.1,-.05,.15); part(g,BOX(.1,.46,.1),suit,s*.15,-.18,.12); part(g,BOX(.07,.38,.07),suit,s*.22,.32,-.14,.25,0,s*.25); }
      poses.sit=g; }
    { const g=deck(); part(g,BOX(.32,.17,.62),suit,0,.12,.02); part(g,BALL(.11),skin,0,.25,.42); part(g,BALL(.115),hair,0,.28,.4).scale.set(1,.75,1);
      for(const s of [-1,1]){ part(g,BOX(.12,.11,.72),suit,s*.08,.1,-.62); part(g,BOX(.07,.07,.55),suit,s*.27,-.05,.32,.55); }
      poses.pad=g; }
    { const g=deck(), body=new THREE.Group(); g.add(body);
      for(const [z,lean] of [[.33,-.35],[-.33,.35]]){ part(body,BOX(.11,.45,.12),suit,0,.22,z+lean*.25,lean); part(body,BOX(.12,.44,.13),suit,0,.6,z*.55,-lean*.6); }
      part(body,BOX(.36,.56,.22),suit,0,1.06,.06,.3,PI/2); part(body,BALL(.11),skin,0,1.45,.2); part(body,BALL(.115),hair,0,1.48,.18).scale.set(1,.7,1);
      for(const s of [-1,1]) part(body,BOX(.07,.07,.55),suit,0,1.18,s*.42,0,0,s*.35);   // arms out, along the board
      poses.std=g; }
    const g=new THREE.Group(); for(const k in poses){ poses[k].updateMatrixWorld(true); ST.bakeStatic(poses[k]); poses[k].visible=false; g.add(poses[k]); } g.userData.poses=poses; return g; }
  const BOARDS=[0xfbfaf4,0xf6f3ea,0xffd166,0x9be7ff,0xfbfaf4,0xff9f80,0xeeeeee], SKIN=[0xc98e66,0xe0b08a,0x8d5a3b,0xd9a07a,0xb07a52,0xe8c3a0], HAIR=[0x2b1b10,0x111111,0xc9a26b,0x6b3a1f,0x3a2a1a,0xe0c080];
  /* n surfers: each has a place in the lineup (along the crest from the peak, beyond the break), a way of looking about */
  L.build=function(n){ if(L.list.length) return; n=n||6;
    for(let i=0;i<n;i++){ const r=k=>{ const v=Math.sin((i+1)*(k+5)*91.17)*43758.5453; return v-Math.floor(v); };
      const g=surfer(BOARDS[i%BOARDS.length],0x15171c,SKIN[i%SKIN.length],HAIR[(i*2)%HAIR.length]); L.grp.add(g);
      L.list.push({g,i,st:'sit',hx:(i-(n-1)/2)*9+(r(1)-.5)*5,ho:6+r(2)*10,look:(r(3)-.5)*1.4,ph:r(4)*6.28,x:0,z:0,y:0,h:PI,bank:0,pitch:0,bankT:0,t:0,w:-1,ahead:0,f:.4,lastRide:-99+i*7,init:false}); }
    ST.scene.add(L.grp); };
  const waves=[], _w={}, _la={};
  const show=(a,k)=>{ const P=a.g.userData.poses; for(const p in P) P[p].visible=p===k; };
  const home=(a,t)=>{ const x=S.peak+a.hx+3*Math.sin(t*.05+a.ph), off=S.breakOff(2.6)+a.ho; return {x,z:Cst.shoreZ(x)-off}; };
  /* every frame: who sits, who paddles for a wave, who rides, who paddles back out */
  const offOf=a=>Cst.shoreZ(a.x)-a.z;   // how far out a surfer is
  L.update=function(dt,player){ if(!L.list.length||dt<=0) return; const t=Cst.time; Cst.surfWaves(t,waves);
    const pl=player||{}, plOn=pl.focus;   // the wave the player rides (Coast.surfFocus), and where the player is (in the water)
    for(const wi of [...L.taken.keys()]) if(!waves.some(w=>w.i===wi)) L.taken.delete(wi);
    for(const a of L.list){ a.t+=dt;
      if(!a.init){ const H=home(a,t); a.x=H.x; a.z=H.z; a.init=true; }
      const w=a.w>=0?waves.find(q=>q.i===a.w):null;
      if(a.st==='sit'||a.st==='back'){
        const H=home(a,t), dx=H.x-a.x, dz=H.z-a.z, d=Math.hypot(dx,dz);
        if(a.st==='back'){ if(d>.5){ const v=Math.min(1.3,d); a.x+=dx/d*v*dt; a.z+=dz/d*v*dt; } a.h+=wrapA(Math.atan2(dx,dz)-a.h)*Math.min(1,dt*3); if(d<2.5){ a.st='sit'; a.t=0; } }
        else { a.x+=dx*Math.min(1,dt*.2); a.z+=dz*Math.min(1,dt*.2); a.h+=wrapA(PI+a.look+.35*Math.sin(t*.13+a.ph)-a.h)*Math.min(1,dt*1.2); }   // face the sea, looking about now and then
        // a wave coming that will break close by: paddle for it (not the player's, not one the player waits for, one surfer to a wave)
        if(a.st==='sit'&&t-a.lastRide>18){ const oa=offOf(a); for(const q of waves){ const side=(a.x-q.px)*S.dir;
          if(q.dtb<-7||q.dtb>0||L.taken.has(q.i)||q.i===plOn||side<-3||side>10) continue; const gap=q.off-oa; if(gap<=0||gap>11) continue;
          if(pl.x!=null&&Math.hypot(pl.x-q.px,pl.z-(Cst.shoreZ(q.px)-q.ob))<30) continue;
          L.taken.set(q.i,a.i); a.st='paddle'; a.w=q.i; a.t=0; break; } } }
      else if(a.st==='paddle'){   // turned to the beach, paddling as the wave comes up behind
        if(!w||w.dtb>1.5){ a.st='back'; a.t=0; a.w=-1; }
        else { a.h+=wrapA(0-a.h)*Math.min(1,dt*4); a.z+=1.4*dt;
          if(w.off-offOf(a)<=.6){ a.st='ride'; a.t=0; a.ahead=(a.x-w.px)*S.dir; a.f=.05; a.lastRide=t; } } }
      if(a.st==='ride'){
        if(!w||a.t>9||w.off<26||w.px+S.dir*(S.peel*Math.max(w.dtb,0)+a.ahead)>S.x1-25){ a.st='back'; a.t=0; if(w) L.taken.delete(w.i); a.w=-1; }   // the wave runs out: kick out over the back
        else { const f0=a.f; a.ahead=damp(a.ahead,3.2+1.6*Math.sin(a.t*1.25+a.ph),1.6,dt); a.f=damp(a.f,.42+.26*Math.sin(a.t*2.1+a.ph),a.t<1?1.5:2.5,dt);   // ahead of the curl; down the face and back up it
          const x=w.px+S.dir*(S.peel*Math.max(w.dtb,0)+a.ahead), Lw=Cst.lipAt(w,a.ahead,_la); a.Lf=a.t<dt*1.5?Math.max(.6,Lw.Lf):damp(a.Lf,Math.max(.6,Lw.Lf),4,dt); const z=Cst.shoreZ(x)-w.off+a.Lf*a.f;   // the face's length eased (it changes at once when the wave breaks)
          const vx=(x-a.x)/dt, vz=(z-a.z)/dt; a.x=x; a.z=z;
          // heading: along its line over the water (the wave's own speed to the shore taken out: the board points along the face)
          const want=Math.atan2(vx,(vz-S.c)*.6); if(isFinite(want)&&a.t>.15) a.h+=wrapA(want-a.h)*Math.min(1,dt*6);
          a.bankT=clamp(.3*S.dir*Math.sign(f0-a.f||1),-.45,.45); } }
      Cst.water(a.x,a.z,null,_w); a.y=_w.y+(a.st==='ride'?.02:0);
      const ride=a.st==='ride'; a.pitch=damp(a.pitch,clamp(_w.nz*(ride?.8:.6),-.45,.45),5,dt); a.bank=damp(a.bank,clamp(-_w.nx*(ride?1:.6),-.5,.5)+(ride?a.bankT||0:0),5,dt);
      show(a,ride&&a.t>.55?'std':a.st==='sit'?'sit':'pad');   // up on the board half a second after the wave takes it
      a.g.position.set(a.x,a.y-.04,a.z); a.g.rotation.set(a.pitch,a.h,a.bank,'YXZ'); } };
  L.visible=on=>{ L.grp.visible=on; };
  ST.Lineup=L;
})(window.ST);
