/* Snow Trader: game flow, physics, tricks, camera, HUD. */
(function(ST){
  const {clamp,lerp,smooth,damp,lerpAngle,fmt,$,hash2}=ST;
  const {scene,camera,sun,World,Rider,Audio}=ST;
  const G=24, SLOPE_G=17.5, MAXV=34;
  const PI=Math.PI;

  /* ---------- save ---------- */
  const KEY='snowtrader.v1';
  let save={wallet:0,best:{},board:0,owned:[0],runs:0,track:0,muted:false,rider:3};
  try{ Object.assign(save,JSON.parse(localStorage.getItem(KEY)||'{}')); }catch(e){}
  if(save.ver!==2){ save.ver=2; save.rider=3; }   // v2: the Mixamo rider is the default, overriding the old saved choice (the original figure)
  const persist=()=>{ try{ localStorage.setItem(KEY,JSON.stringify(save)); }catch(e){} };

  /* ---------- state ---------- */
  const P={x:0,y:0,z:0,vx:0,vz:0,vy:0,vyg:0,hd:0,s:0,grounded:true,speed:0,
    sp:0,fl:0,wsp:0,wfl:0,airT:0,grabT:0,grabbed:false,money:0,shown:0,combo:0,comboT:0,tricks:0,best:null,coins:0,greens:0,reds:0,wipes:0,
    stun:0,invuln:0,tumble:0,t:0,lean:0,crouch:.2,tuck:0,popT:0,jumpBuf:0,shake:0,history:[],histS:0,airStart:0,finished:false,fin:0,boost:0};
  let mode='load', track=ST.TRACKS[0], trackIdx=0, runT=0, countdown=0, tipsOn=false, tipShown={};
  const input={joy:{x:0,y:0,id:null},k:{},jump:false,grab:false,jumpEdge:false};

  /* ---------- HUD refs ---------- */
  const el={hud:$('#hud'),menu:$('#menu'),money:$('#moneyN'),moneyD:$('#moneyD'),spd:$('#spdN'),prog:$('#progBar'),progTxt:$('#progTxt'),combo:$('#combo'),comboX:$('#comboX'),comboBar:$('#comboBar'),
    toast:$('#toast'),big:$('#big'),sub:$('#subtitle'),tip:$('#tip'),flash:$('#flash'),speedfx:$('#speedfx'),radar:$('#radar'),radarTxt:$('#radarTxt'),end:$('#end'),pause:$('#pausemenu')};
  const rg=el.radar.getContext('2d');

  function toast(main,small,bad){ el.toast.className=bad?'bad':''; el.toast.innerHTML=main+(small?'<small>'+small+'</small>':''); void el.toast.offsetWidth; el.toast.classList.add('show'); }
  function bigText(t,cls){ el.big.textContent=t; el.big.className=cls||''; void el.big.offsetWidth; el.big.classList.add('show'); }
  let subT=0; function subtitle(t,ms){ el.sub.textContent=t; el.sub.style.opacity=1; subT=ms||2600; }
  function tip(id,t,ms){ if(save.runs>2||tipShown[id]) return; tipShown[id]=1; el.tip.textContent=t; el.tip.hidden=false; clearTimeout(tip.h); tip.h=setTimeout(()=>el.tip.hidden=true,ms||4200); }
  let flashK=0; function flash(c,k){ el.flash.style.background=c; flashK=k; }
  const gr=ST.gradeSet;

  /* ---------- input ---------- */
  const zone=$('#joyzone'), joyEl=$('#joy'), knob=$('#knob'); let joyC={x:0,y:0};
  function joyHome(){ const r=zone.getBoundingClientRect(); joyEl.style.left=(matchMedia('(max-width:700px)').matches?72:96)+'px'; joyEl.style.top=(r.height-(matchMedia('(max-width:700px)').matches?84:110))+'px'; }
  zone.addEventListener('pointerdown',e=>{ e.preventDefault(); Audio.init(); if(input.joy.id!==null) return; input.joy.id=e.pointerId; try{zone.setPointerCapture(e.pointerId);}catch(_){}
    const r=zone.getBoundingClientRect(); joyC={x:e.clientX,y:e.clientY}; joyEl.style.left=(e.clientX-r.left)+'px'; joyEl.style.top=(e.clientY-r.top)+'px'; zone.classList.remove('idle'); moveJoy(e); });
  zone.addEventListener('pointermove',e=>{ if(e.pointerId===input.joy.id) moveJoy(e); });
  function moveJoy(e){ let dx=e.clientX-joyC.x, dy=e.clientY-joyC.y; const R=44, d=Math.hypot(dx,dy); if(d>R){ dx*=R/d; dy*=R/d; } input.joy.x=dx/R; input.joy.y=dy/R; knob.style.transform=`translate(${dx}px,${dy}px)`; }
  function endJoy(e){ if(e.pointerId!==input.joy.id) return; input.joy.id=null; input.joy.x=input.joy.y=0; knob.style.transform=''; zone.classList.add('idle'); joyHome(); }
  zone.addEventListener('pointerup',endJoy); zone.addEventListener('pointercancel',endJoy);
  const bJ=$('#btnJump'), bG=$('#btnGrab');
  bJ.addEventListener('pointerdown',e=>{ e.preventDefault(); Audio.init(); input.jump=true; input.jumpEdge=true; bJ.classList.add('on'); });
  const upJ=()=>{ input.jump=false; bJ.classList.remove('on'); }; bJ.addEventListener('pointerup',upJ); bJ.addEventListener('pointercancel',upJ); bJ.addEventListener('pointerleave',upJ);
  bG.addEventListener('pointerdown',e=>{ e.preventDefault(); Audio.init(); input.grab=true; bG.classList.add('on'); });
  const upG=()=>{ input.grab=false; bG.classList.remove('on'); }; bG.addEventListener('pointerup',upG); bG.addEventListener('pointercancel',upG); bG.addEventListener('pointerleave',upG);
  const KEYMAP={ArrowLeft:'l',KeyA:'l',ArrowRight:'r',KeyD:'r',ArrowUp:'u',KeyW:'u',ArrowDown:'d',KeyS:'d'};
  addEventListener('keydown',e=>{ if(e.repeat) return; Audio.init(); const k=KEYMAP[e.code]; if(k){ input.k[k]=true; e.preventDefault(); }
    if(e.code==='Space'){ e.preventDefault(); input.jump=true; input.jumpEdge=true; } if(e.code==='ShiftLeft'||e.code==='ShiftRight'||e.code==='KeyE') input.grab=true;
    if((e.code==='Escape'||e.code==='KeyP')&&(mode==='play'||mode==='pause')) togglePause(); if(e.code==='Enter'&&mode==='lift') endLift(); });
  addEventListener('keyup',e=>{ const k=KEYMAP[e.code]; if(k) input.k[k]=false; if(e.code==='Space') input.jump=false; if(e.code==='ShiftLeft'||e.code==='ShiftRight'||e.code==='KeyE') input.grab=false; });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden&&mode==='play') togglePause(); });
  addEventListener('blur',()=>{ input.k={}; input.jump=input.grab=false; if(mode==='play') togglePause(); });
  const steerX=()=>clamp(input.joy.x*1.25+(input.k.r?1:0)-(input.k.l?1:0),-1,1);
  const steerY=()=>clamp(input.joy.y*1.25+(input.k.d?1:0)-(input.k.u?1:0),-1,1);

  /* ---------- effects: spray + trail ---------- */
  const SP_N=420, sp={pos:new Float32Array(SP_N*3),vel:new Float32Array(SP_N*3),life:new Float32Array(SP_N),size:new Float32Array(SP_N),alpha:new Float32Array(SP_N),i:0,col:new THREE.Color(1,1,1)};
  const spGeo=new THREE.BufferGeometry(); spGeo.setAttribute('position',new THREE.BufferAttribute(sp.pos,3)); spGeo.setAttribute('size',new THREE.BufferAttribute(sp.size,1)); spGeo.setAttribute('alpha',new THREE.BufferAttribute(sp.alpha,1));
  const spMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:false,uniforms:{px:{value:1},col:{value:new THREE.Color(1,1,1)}},
    vertexShader:'attribute float size; attribute float alpha; uniform float px; varying float vA; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(size*px*90.0/-mv.z,0.0,70.0); vA=alpha; }',
    fragmentShader:'uniform vec3 col; varying float vA; void main(){ vec2 q=gl_PointCoord-.5; float a=smoothstep(.5,.0,length(q)); gl_FragColor=vec4(col,a*vA); }'});
  const sprayPts=new THREE.Points(spGeo,spMat); sprayPts.frustumCulled=false; scene.add(sprayPts);
  function emit(x,y,z,vx,vy,vz,size,life){ const i=sp.i; sp.i=(sp.i+1)%SP_N; sp.pos[i*3]=x; sp.pos[i*3+1]=y; sp.pos[i*3+2]=z; sp.vel[i*3]=vx; sp.vel[i*3+1]=vy; sp.vel[i*3+2]=vz; sp.life[i]=life; sp.size[i]=size; sp.alpha[i]=.9; }
  function updateSpray(dt){ for(let i=0;i<SP_N;i++){ if(sp.life[i]<=0){ sp.alpha[i]=0; continue; } sp.life[i]-=dt; sp.vel[i*3+1]-=9*dt; for(let k=0;k<3;k++) sp.pos[i*3+k]+=sp.vel[i*3+k]*dt; const ls=Math.max(0,sp.life[i]); sp.alpha[i]=Math.min(.85,ls*2.2); sp.size[i]*=1+dt*.9; }
    spGeo.attributes.position.needsUpdate=true; spGeo.attributes.alpha.needsUpdate=true; spGeo.attributes.size.needsUpdate=true; }
  const TR_N=170, tr={pts:[],geo:new THREE.BufferGeometry(),pos:new Float32Array(TR_N*2*3),idx:new Uint16Array((TR_N-1)*6)};
  tr.geo.setAttribute('position',new THREE.BufferAttribute(tr.pos,3)); tr.geo.setIndex(new THREE.BufferAttribute(tr.idx,1));
  const trailMesh=new THREE.Mesh(tr.geo,new THREE.MeshBasicMaterial({color:0x5b6a9c,transparent:true,opacity:.34,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,fog:true})); trailMesh.frustumCulled=false; trailMesh.renderOrder=2; scene.add(trailMesh);
  function trailPush(x,y,z,hd,gap){ const L=tr.pts[tr.pts.length-1]; if(L&&Math.hypot(L.x-x,L.z-z)<.7&&!gap) return; tr.pts.push({x,y,z,hd,gap}); if(tr.pts.length>TR_N) tr.pts.shift(); rebuildTrail(); }
  function rebuildTrail(){ const n=tr.pts.length; let ic=0; for(let i=0;i<n;i++){ const p=tr.pts[i], rx=Math.cos(p.hd)*.17, rz=Math.sin(p.hd)*.17; tr.pos.set([p.x-rx,p.y+.04,p.z-rz,p.x+rx,p.y+.04,p.z+rz],i*6);
      if(i>0&&!p.gap){ const a=(i-1)*2,b=a+1,c=i*2,d=c+1; tr.idx[ic++]=a; tr.idx[ic++]=b; tr.idx[ic++]=c; tr.idx[ic++]=b; tr.idx[ic++]=d; tr.idx[ic++]=c; } }
    tr.geo.setDrawRange(0,ic); tr.geo.attributes.position.needsUpdate=true; tr.geo.index.needsUpdate=true; }

  /* ---------- run setup ---------- */
  function resetPlayer(){
    World.setTrack(track); const T=track;
    P.s=0; P.x=World.cx(0); P.z=0; P.y=World.groundY(P.x,P.z); P.hd=0; P.vx=P.vz=P.vy=P.vyg=0; P.grounded=true; P.sp=P.fl=P.wsp=P.wfl=0; P.airT=0; P.grabT=0; P.money=0; P.shown=0; P.combo=0; P.comboT=0; P.tricks=0; P.best=null; P.coins=0; P.greens=0; P.reds=0; P.wipes=0;
    P.stun=0; P.invuln=0; P.tumble=0; P.t=0; P.history=[{s:0,m:0}]; P.histS=0; P.finished=false; P.fin=0; P.boost=0; P.crouch=.2; P.lean=0; P.tuck=0; P.shake=0; P.popT=0; P.jumpBuf=0;
    tr.pts.length=0; rebuildTrail(); runT=0; World.update(0,true);
    Rider.setBoard(save.board); applyLook();
  }
  function applyLook(){ const k=track.id; Rider.setLook({jacket:k==='bull'?0xffc21a:k==='bear'?0x2f8bff:k==='ipo'?0xff3dd8:0xffc21a,pants:k==='ipo'?0x1b1033:0x1fa35a,helmet:0x0d0e12});
    if(Rider.lens){ Rider.lens.material.color.setHex(k==='bear'?0x6fd0ff:k==='ipo'?0xff4fd8:0xff7a2e); Rider.lens.material.emissive.setHex(k==='bear'?0x2f9fff:k==='ipo'?0xff2fb8:0xff5a1e); } }
  /* ---------- the ride up: a chairlift time-lapse before every run (rope speed ~5 m/s, shown x12) ---------- */
  const lift={t:0,T:14,s0:0,s1:0,cam:new THREE.Vector3(),look:new THREE.Vector3(),on:false,fact:-1};
  const FACTS=['חבל הרכבל נע בערך 5 מטר בשנייה. כאן הקפצנו את הזמן פי 12.','מהירות ממוצעת של גולשים באתרי סקי: כ‑33 קמ״ש. מתחילים כ‑20, מתקדמים כ‑45.','בקפיצה טובה אפשר להישאר באוויר 2 עד 2.5 שניות.','את הספין מתחילים לפני שעוזבים את הקרקע. הקישו קפיצה בקצה הרמפה.','אל תסתובבו מוקדם מדי על הרמפה: נוחתים הצידה.'];
  function startLift(){
    Audio.init(); Audio.music(!save.muted);
    resetPlayer(); mode='lift'; el.menu.hidden=true; el.end.hidden=true; el.hud.hidden=false; el.hud.classList.add('lifting'); el.pause.hidden=true; $('#liftHud').hidden=false; el.tip.hidden=true; tipShown={};
    ST.Resort.liftMode=true; lift.t=0; lift.s0=track.len+34; lift.s1=-26; lift.on=true; lift.fact=-1; P.s=lift.s0; P.z=-P.s; World.update(P.s-150,true);
    const R=Rider; R.model.rotation.y=PI; R.P.sit=1; R.P.swing=1; R.root.visible=true; ST.Resort.playerChair.visible=true; lift.cam.set(0,0,0); lift.first=true; subtitle(track.en,2000);
  }
  function endLift(){
    lift.on=false; ST.Resort.liftMode=false; const R=Rider; R.model.rotation.y=PI/2; R.P.sit=0; R.P.swing=0; ST.Resort.playerChair.visible=false; el.hud.classList.remove('lifting'); $('#liftHud').hidden=true; beginCountdown();
  }
  const _tq=new THREE.Quaternion();
  function updateLift(dt){
    lift.t+=dt; const u=clamp(lift.t/lift.T,0,1), e=u*u*u*(u*(6*u-15)+10); const s=lerp(lift.s0,lift.s1,e); P.s=s; P.z=-s;
    const Rs=ST.Resort, p=Rs.cablePoint(s,-1), p2=Rs.cablePoint(s-1.5,-1); const tx=p2.x-p.x, tz=p2.z-p.z, tl=Math.hypot(tx,tz)||1, tdx=tx/tl, tdz=tz/tl, yaw=Math.atan2(tx,tz);
    const sway=Math.sin(lift.t*1.7)*.035, sway2=Math.sin(lift.t*1.1)*.03; _e.set(sway2,yaw,sway,'YXZ'); Rs.playerChair.quaternion.setFromEuler(_e); Rs.playerChair.position.set(p.x,p.y,p.z);
    const R=Rider; R.root.position.set(p.x,p.y-3.28,p.z); R.root.rotation.set(0,yaw+PI,0); R.tilt.quaternion.identity(); R.tilt.quaternion.setFromEuler(_e.set(sway2,0,sway,'YXZ')); R.trick.rotation.set(0,0,0);
    R.P.t=lift.t; R.P.look=Math.sin(lift.t*.7)*28; R.P.crouch=0; R.P.air=0; R.P.lean=0; R.P.grab=0; R.P.tuck=0; R.P.twist=0; R.pose({});
    // three shots: from the track side, from behind looking up the line, from the top station looking back
    const dirT=Rs.liftSide(); let cx,cy,cz,lx,ly,lz;
    if(u<.34){ cx=p.x+dirT*4.2; cy=p.y-1.8; cz=p.z; lx=p.x; ly=p.y-1.9; lz=p.z; }
    else if(u<.7){ cx=p.x-tdx*5.2-dirT*1.0; cy=p.y-.2; cz=p.z-tdz*5.2; lx=p.x+tdx*20; ly=p.y+1.6; lz=p.z+tdz*20; }
    else { cx=p.x+tdx*3.4+dirT*3.2; cy=p.y-.9; cz=p.z+tdz*3.4; lx=p.x; ly=p.y-1.9; lz=p.z; }
    _f.set(cx,cy,cz); _ft.set(lx,ly,lz); if(lift.first){ lift.cam.copy(_f); lift.look.copy(_ft); lift.first=false; } else { lift.cam.lerp(_f,1-Math.exp(-dt*2.6)); lift.look.lerp(_ft,1-Math.exp(-dt*3.2)); }
    camera.position.copy(lift.cam); camera.lookAt(lift.look); camera.rotateZ(sway*1.4); if(camera.fov!==(ST.baseFov||62)+6){ camera.fov=(ST.baseFov||62)+6; camera.updateProjectionMatrix(); }
    const fi=Math.min(FACTS.length-1,Math.floor(lift.t/3.4)); if(fi!==lift.fact){ lift.fact=fi; $('#liftFact').textContent=FACTS[fi]; }
    gr('uSpeed',Math.sin(u*PI)*.35); if(u>=1) endLift();
  }
  $('#liftSkip').onclick=()=>{ if(mode==='lift') endLift(); };
  function startRun(){ if(new URLSearchParams(location.search).get('nolift')==='1') beginCountdown(true); else startLift(); }
  function beginCountdown(fresh){
    Audio.init(); Audio.music(!save.muted);
    if(fresh!==false) resetPlayer(); else resetPlayer(); mode='countdown'; countdown=2.6; el.menu.hidden=true; el.end.hidden=true; el.hud.hidden=false; el.hud.classList.remove('lifting'); el.pause.hidden=true; el.tip.hidden=true; tipShown={};
    camReset(); subtitle(track.en+' · '+track.blurb,3200); lastCd=99; joyHome();
  }
  let lastCd=99;

  /* ---------- tricks / scoring ---------- */
  const mult=()=>Math.min(5,1+Math.floor(P.combo*.5+.001)*1)||1;
  function addMoney(v,label){ P.money+=v; if(label){ el.moneyD.textContent=(v>=0?'+':'−')+fmt(Math.abs(v)).slice(0)+' '+label; el.moneyD.style.opacity=1; clearTimeout(addMoney.h); addMoney.h=setTimeout(()=>el.moneyD.style.opacity=0,1100); } }
  function landTrick(){
    const spins=Math.round(Math.abs(P.sp)/PI), flips=Math.round(Math.abs(P.fl)/(2*PI)), grab=P.grabT;
    const eS=Math.abs(P.sp-Math.round(P.sp/PI)*PI), eF=Math.abs(P.fl-Math.round(P.fl/(2*PI))*2*PI);
    const ok=eS<.85&&eF<.9&&P.tumble<=0;
    const power=clamp(-P.vy/22,.15,1);
    if(P.airT<.18) return true;
    if(!ok){ wipeout('land sp='+P.sp.toFixed(1)+' fl='+P.fl.toFixed(1)+' air='+P.airT.toFixed(1)); return false; }
    Audio.land(power); puff(power);
    let pts=0, parts=[];
    if(spins){ pts+=spins*130*(1+(spins-1)*.45); parts.push((spins*180)+'°'); }
    if(flips){ pts+=flips*480*(1+(flips-1)*.5); parts.push(P.fl>0?(flips>1?flips+'× BACKFLIP':'BACKFLIP'):(flips>1?flips+'× FRONTFLIP':'FRONTFLIP')); }
    if(grab>.35){ pts+=Math.min(grab,3.5)*100; parts.push((P.grabName||'INDY')+' GRAB'); }
    if(P.airT>1.0) pts+=(P.airT-1)*90;
    if(P.perfectPop){ pts+=60; }
    P.perfectPop=false;
    if(pts>=40){ P.combo++; P.comboT=6; const m=mult(), gain=Math.round(pts*m); P.tricks++; if(!P.best||gain>P.best.gain) P.best={name:parts.join(' + ')||'AIR TIME',gain};
      addMoney(gain,'x'+m); toast(parts.join(' + ')||'BIG AIR','+'+fmt(gain)+(m>1?'  ·  x'+m:'')); Audio.trick(Math.min(P.combo,6)); P.boost+=Math.min(spins+flips*2,4)*.8; }
    // snap the visual rotation to the nearest whole turn
    P.sp=Math.round(P.sp/PI)*PI; P.fl=Math.round(P.fl/(2*PI))*2*PI;
    return true;
  }
  function puff(p){ const n=Math.round(10+p*22); for(let i=0;i<n;i++){ const a=Math.random()*PI*2, s=2+Math.random()*5*p; emit(P.x+Math.cos(a)*.4,P.y+.2,P.z+Math.sin(a)*.4,Math.cos(a)*s,1.5+Math.random()*3*p,Math.sin(a)*s,.45+Math.random()*.5,.7+Math.random()*.4); } }
  function wipeout(why){
    if(P.tumble>0||P.invuln>0) return; P.wipeLog=(P.wipeLog||[]); P.wipeLog.push((why||'?')+'@'+Math.round(P.s)); P.tumble=1.5; P.wipes++; P.combo=0; P.comboT=0; P.shake=1; Audio.wipe();
    const loss=Math.round(Math.max(120,P.money*.12)); addMoney(-loss,'STOP LOSS'); bigText('WIPEOUT','wasted'); flash('#ff1a30',.55);
    puff(1.2); for(let i=0;i<40;i++) emit(P.x,P.y+.5,P.z,(Math.random()-.5)*9,Math.random()*7,(Math.random()-.5)*9,.8,1.2);
    P.wfl=(Math.random()<.5?-1:1)*11; P.vx*=.5; P.vz*=.5;
  }
  function respawn(){
    const s=Math.max(P.s,0), nx=World.cx(s+2); P.x=nx; P.z=-(s+2); P.s=s+2; P.y=World.groundY(P.x,P.z); const a=Math.atan2(World.dcx(P.s),1); P.hd=a; P.vx=Math.sin(a)*10; P.vz=-Math.cos(a)*10; P.vy=0; P.vyg=0;
    P.grounded=true; P.tumble=0; P.invuln=2.2; P.sp=P.fl=0; P.wfl=0; P.wsp=0; P.airT=0; P.stun=0; camSnap=true; flash('#000',0); gr('uDesat',0); }

  /* ---------- player physics ---------- */
  const _n=new THREE.Vector3();
  function stepPlayer(dt){
    const sx=steerX(), iy=steerY(); P.t+=dt;
    P.invuln=Math.max(0,P.invuln-dt); P.stun=Math.max(0,P.stun-dt); P.shake=Math.max(0,P.shake-dt*1.4); P.boost=Math.max(0,P.boost-dt*.9);
    if(P.comboT>0){ P.comboT-=dt; if(P.comboT<=0) P.combo=0; }
    if(input.jumpEdge){ P.jumpBuf=.14; input.jumpEdge=false; } P.jumpBuf=Math.max(0,P.jumpBuf-dt);
    const speed=Math.hypot(P.vx,P.vz); P.speed=speed;
    const trackAng=Math.atan2(World.dcx(P.s),1);
    if(P.tumble>0){
      P.tumble-=dt; P.vx*=Math.exp(-dt*1.3); P.vz*=Math.exp(-dt*1.3); P.x+=P.vx*dt; P.z+=P.vz*dt;
      const gy=World.groundY(P.x,P.z); P.vy-=G*dt; P.y+=P.vy*dt; if(P.y<gy){ P.y=gy; P.vy=P.vy<-3?-P.vy*.35:0; P.grounded=true; }
      P.fl+=P.wfl*dt; P.sp+=P.wfl*.35*dt; P.s=-P.z; if(P.tumble<=0) respawn(); return; }
    if(P.grounded){
      const vr=track.vref||24, turn=lerp(2.7,1.5,clamp(speed/(vr*1.4),0,1));
      P.tuck=damp(P.tuck,iy<-.35?1:0,10,dt);
      if(P.stun<=0) P.hd+=sx*turn*dt;
      if(Math.abs(sx)<.1) P.hd=lerpAngle(P.hd,trackAng,1-Math.exp(-dt*.8));
      P.hd=clamp(P.hd,trackAng-1.1,trackAng+1.1);
      const dx=Math.sin(P.hd), dz=-Math.cos(P.hd);
      World.groundN(P.x,P.z,_n); const gX=-_n.x/_n.y, gZ=-_n.z/_n.y;
      P.vx+=-SLOPE_G*gX*dt; P.vz+=-SLOPE_G*gZ*dt;
      let fwd=P.vx*dx+P.vz*dz, lx=P.vx-fwd*dx, lz=P.vz-fwd*dz; const grip=3.4+Math.abs(sx)*.6; const k=Math.exp(-grip*dt); lx*=k; lz*=k;
      // a hard carve scrubs speed; a tuck cuts the drag
      const drag=(1.0+(track.drag||.0046)*fwd*fwd)*(P.tuck>.5?.62:1)+Math.abs(sx)*speed*.025;
      fwd=Math.max(2,fwd-drag*dt)+P.boost*2.2*dt;
      P.vx=dx*fwd+lx; P.vz=dz*fwd+lz;
      const sp2=Math.hypot(P.vx,P.vz); if(sp2>MAXV){ P.vx*=MAXV/sp2; P.vz*=MAXV/sp2; }
      P.x+=P.vx*dt; P.z+=P.vz*dt; P.s=-P.z;
      const gy=World.groundY(P.x,P.z), rise=(gy-P.y)/dt;
      // pop
      if(P.jumpBuf>0&&P.stun<=0){ P.jumpBuf=0; let pop=8.6+Math.min(speed,34)*.08; const r0=World.rampAt(Math.round((P.s-track.rampStart)/track.rampEvery));
        for(let kk=-1;kk<=1;kk++){ const kq=Math.round((P.s-track.rampStart)/track.rampEvery)+kk; if(kq<0) continue; const r=World.rampAt(kq), d=P.s-r.s; if(d>World.RL-2.2&&d<World.RL+.8&&Math.abs(World.cx(P.s)+r.u-P.x)<r.w){ pop+=5.2; P.perfectPop=true; toast('PERFECT POP','',false); } }
        takeoff(P.vyg+pop,true); Audio.jump(); return; }
      if(gy<P.y+P.vyg*dt-.5*G*dt*dt-.07&&speed>5&&!P.fresh){ takeoff(P.vyg,false); return; }
      P.fresh=false; P.y=gy; P.vyg=clamp(lerp(P.vyg,rise,.55),-45,45);
      P.lean=damp(P.lean,sx,9,dt); P.sp=damp(P.sp,0,12,dt); P.fl=damp(P.fl,0,12,dt);
      // carve spray + trail
      if(speed>5){ const out=Math.abs(sx)>.25||P.tuck>.5; const nsp=out?3:1; for(let i=0;i<nsp;i++){ if(Math.random()<.7) emit(P.x-dx*.5+(Math.random()-.5)*.4,P.y+.12,P.z-dz*.5+(Math.random()-.5)*.4,-dx*speed*.12+(Math.random()-.5)*2.4+(-dz)*sx*speed*.12,.6+Math.random()*2.2+speed*.03,-dz*speed*.12+(Math.random()-.5)*2.4+dx*sx*speed*.12,.35+Math.random()*.35,.45+Math.random()*.3); }
        trailPush(P.x,P.y,P.z,P.hd,P._lastAir); P._lastAir=false; }
    } else {
      P.airT+=dt; P.vy-=G*dt;
      P.x+=P.vx*dt; P.z+=P.vz*dt; P.y+=P.vy*dt; P.s=-P.z; P.vx*=Math.exp(-dt*.03); P.vz*=Math.exp(-dt*.03);
      P.wsp=damp(P.wsp,sx*9.4,7,dt); P.wfl=damp(P.wfl,iy*7.2,7,dt); P.sp+=P.wsp*dt; P.fl+=P.wfl*dt;
      if(input.grab){ if(P.grabT===0){ P.grabName=Math.abs(sx)>Math.abs(iy)?(sx>0?'MUTE':'INDY'):(iy<0?'METHOD':'STALEFISH'); } P.grabT+=dt; }
      P.grabbed=input.grab; P.lean=damp(P.lean,0,6,dt);
      if(P.airT>.35) tip('air','באוויר: ימינה/שמאלה = ספין · למעלה/למטה = סלטה · החזיקו תפיסה',5200);
      const gy=World.groundY(P.x,P.z);
      if(P.y<=gy){ P.y=gy; P.grounded=true; P.fresh=true; P.vyg=P.vy; P._lastAir=true; const ok=landTrick(); if(ok){ const nx=World.groundN(P.x,P.z,_n); const dx=Math.sin(P.hd),dz=-Math.cos(P.hd); const into=P.vy; const sp0=Math.hypot(P.vx,P.vz); const vdot=(P.vx*(-_n.x)+P.vz*(-_n.z)); P.vy=0; P.vyg=0; P.speedPenalty=0; const loss=clamp(-into/60,0,.2); P.vx*=1-loss; P.vz*=1-loss; } P.airT=0; P.grabT=0; P.wsp=P.wfl=0; P.grabbed=false; }
    }
  }
  function takeoff(vy,pop){ P.grounded=false; P.vy=vy; P.airT=0; P.sp=0; P.fl=0; P.grabT=0; P.wsp=P.wfl=0; P.airStart=P.y; if(pop) P.jumpBuf=0; }

  /* ---------- pickups and hazards ---------- */
  function collide(dt){
    if(P.tumble>0||mode!=='play') return;
    const px=P.x, py=P.y, pz=P.z;
    World.nearItems(P.s,it=>{ if(it.dead) return;
      const dx=it.x-px, dz=it.z-pz, d2=dx*dx+dz*dz;
      if(it.type==='coin'){ it.mesh.rotation.y+=dt*3.4; if(d2<it.r*it.r&&Math.abs(it.y-(py+1))<2.4){ it.dead=true; it.mesh.visible=false; P.coins++; addMoney(it.big?25:10); P.shown+=0; Audio.coin(Math.min(P.coins%12,11)); for(let i=0;i<5;i++) emit(it.x,it.y,it.z,(Math.random()-.5)*4,Math.random()*3,(Math.random()-.5)*4,.4,.5); } }
      else if(it.type==='green'){ it.mesh.position.y=it.y+Math.sin(P.t*2+it.x)*.12; if(d2<it.r*it.r&&py<it.y+it.h+1.5){ it.dead=true; it.mesh.visible=false; P.greens++; const v=Math.round(80+it.h*30); addMoney(v,'BULL'); toast('BULLISH',' +'+fmt(v)); Audio.green(); P.boost+=2.2; for(let i=0;i<16;i++) emit(it.x,it.y+it.h/2,it.z,(Math.random()-.5)*6,Math.random()*5,(Math.random()-.5)*6,.55,.8); } }
      else if(it.type==='red'){ if(P.invuln<=0&&d2<it.r*it.r&&py<it.y+it.h+.3){ it.dead=true; it.mesh.visible=false; P.reds++; const v=Math.round(110+it.h*25); addMoney(-v,'BEAR TRAP'); toast('BEARISH','−'+fmt(v),true); Audio.red(); P.shake=.7; P.stun=.35; P.vx*=.62; P.vz*=.62; P.combo=0; flash('#ff2244',.3); for(let i=0;i<22;i++) emit(it.x,it.y+1,it.z,(Math.random()-.5)*8,Math.random()*6,(Math.random()-.5)*8,.6,.8); } }
      else if(it.type==='rockhaz'||it.type==='rock'){ if(P.invuln<=0&&d2<(it.r+.35)*(it.r+.35)&&py<it.y+1.6){ it.dead=true; wipeout('rock'); } }
      else if(it.type==='tree'){ if(P.invuln<=0&&d2<(it.r+.3)*(it.r+.3)&&py<it.y+4){ it.dead=true; wipeout('tree'); } }
      else if(it.type==='finish'&&!P.finished&&P.s>=track.len-.5){ P.finished=true; finishRun(); }
    });
    if(!P.finished&&P.s>=track.len) { P.finished=true; finishRun(); }
  }

  /* ---------- camera ---------- */
  let camHd=0, camSnap=true, heroK=0, heroSide=0; const camPos=new THREE.Vector3(), camLook=new THREE.Vector3(), _f=new THREE.Vector3(), _ft=new THREE.Vector3(), _g=new THREE.Vector3(), _gl=new THREE.Vector3();
  function camReset(){ camSnap=true; camHd=P.hd; }
  function updateCamera(dt){
    if(camera.view&&camera.view.enabled) camera.clearViewOffset();
    const sp=P.speed, air=!P.grounded;
    camHd=lerpAngle(camHd,P.hd,1-Math.exp(-dt*(air?1.2:3.1)));
    const heroOn=air&&P.airT>.4&&P.tumble<=0; heroK=damp(heroK,heroOn?1:0,heroOn?2.2:3.5,dt); if(heroOn&&!heroSide) heroSide=Math.random()<.5?-1:1; if(!heroOn&&heroK<.02) heroSide=0;
    const camA=camHd+(heroSide||1)*heroK*.85, fx=Math.sin(camA), fz=-Math.cos(camA);
    const vq=clamp(sp/((track.vref||24)*1.3),0,1), dist=(lerp(5.4,7.4,vq)+(air?.7:0))*(1-.28*heroK), h=(lerp(2.1,2.9,vq)+(air?.8:0)+P.tuck*-.3)*(1-.35*heroK);
    const tx=P.x-fx*dist, tz=P.z-fz*dist; let ty=P.y+h;
    const gy=World.groundY(tx,tz)+1.3; if(ty<gy) ty=gy;
    _f.set(tx,ty,tz); if(camSnap){ camPos.copy(_f); camSnap=false; } else { const k=1-Math.exp(-dt*(air?6:11)); camPos.lerp(_f,k); }
    const lx=P.x+fx*8, lz=P.z+fz*8, ly=P.y+1.2+(air?clamp(P.vy*.06,-1.5,1.5):0)-(sp>20?.2:0);
    camLook.lerp(new THREE.Vector3(lx,ly,lz),1-Math.exp(-dt*9));
    if(mode==='countdown'){ const k=clamp(1-countdown/2.5,0,1), e=k*k*(3-2*k), th=lerp(PI*.92,0,e)*ST.Resort.lodgeSide(), r=lerp(6.2,dist,e), ch=lerp(1.5,h,e);
      _g.set(P.x+Math.sin(th)*r*Math.cos(P.hd)+Math.sin(P.hd)*0, 0, P.z+Math.cos(th)*r); _g.y=Math.max(P.y+ch,World.groundY(_g.x,_g.z)+1.0); _gl.set(P.x,P.y+1.3,P.z); _gl.lerp(camLook,e); _g.lerp(camPos,e*e*e); }
    camera.position.copy(mode==='countdown'?_g:camPos); if(P.shake>0){ const s=P.shake*P.shake*.5; camera.position.x+=(Math.random()-.5)*s; camera.position.y+=(Math.random()-.5)*s; }
    camera.lookAt(mode==='countdown'?_gl:camLook); camera.rotateZ(-P.lean*.045-(P.tumble>0?Math.sin(P.t*20)*.03:0));
    const base=ST.baseFov||62; const f=base+clamp((sp/(track.vref||24)-.35)/1.0,0,1)*14+(P.boost>0?3:0)+heroK*5; if(Math.abs(camera.fov-f)>.05){ camera.fov=damp(camera.fov,f,4,dt); camera.updateProjectionMatrix(); }
  }
  function menuCamera(t){ const W=innerWidth,H=innerHeight; if(W>H*1.1) camera.setViewOffset(W,H,W*.2,0,W,H); else if(camera.view&&camera.view.enabled) camera.clearViewOffset(); const a=PI+Math.sin(t*.15)*.9+.4, r=4.3; camera.position.set(P.x+Math.sin(a)*r*.6-1.2,P.y+1.45,P.z+Math.cos(a)*r); camera.lookAt(P.x,P.y+.95,P.z); camera.fov=ST.baseFov||62; camera.updateProjectionMatrix(); }

  /* ---------- rider visuals ---------- */
  const _qa=new THREE.Quaternion(), _qb=new THREE.Quaternion(), _up=new THREE.Vector3(0,1,0), _ln=new THREE.Vector3(), _e=new THREE.Euler();
  function updateRider(dt,menu){
    const R=Rider; R.root.position.set(P.x,P.y,P.z); R.root.rotation.y=-P.hd;
    if(P.grounded&&P.tumble<=0){ World.groundN(P.x,P.z,_n); _ln.copy(_n); _ln.applyAxisAngle(_up,P.hd);  // into the board's own frame (heading undone)
      _ln.set(_n.x*Math.cos(-P.hd)+_n.z*Math.sin(-P.hd)*0,0,0); const c=Math.cos(P.hd), s=Math.sin(P.hd); const lx=_n.x*c+_n.z*s, lz=-_n.x*s+_n.z*c; _ln.set(lx,_n.y,lz).normalize();
      _qb.setFromUnitVectors(_up,_ln); R.tilt.quaternion.slerp(_qb,1-Math.exp(-dt*14)); R.tilt.rotation.z+=0; _e.set(0,0,-P.lean*.42); _qa.setFromEuler(_e); R.tilt.quaternion.multiply(_qa); }
    else { _qb.identity(); R.tilt.quaternion.slerp(_qb,1-Math.exp(-dt*6)); _e.set(clamp(-P.vy*.012,-.3,.35),0,0); }
    R.trick.rotation.order='YXZ'; R.trick.rotation.y=-P.sp; R.trick.rotation.x=P.fl;
    const air=!P.grounded&&P.tumble<=0; const tgt={crouch:menu?.25:P.grounded?clamp(.16+.2*clamp(P.speed/36,0,1)+P.tuck*.65+(P.jumpBuf>0?.3:0),0,1):(.58),
      air:air?1:0,grab:air&&P.grabbed?1:0,lean:P.lean,tuck:P.grounded?P.tuck*.7:(P.grabbed?0:.35),twist:air?clamp(P.wsp*-4,-30,30):0};
    const p=R.P; ['crouch','air','grab','lean','tuck','twist'].forEach(k=>{ p[k]=damp(p[k],tgt[k],k==='air'?14:9,dt); });
    if(P.tumble>0){ p.crouch=1; p.air=1; p.tuck=1; }
    R.pose({});
    // blink while invulnerable
    R.root.visible=P.invuln<=0||Math.floor(P.t*14)%2===0;
  }

  /* ---------- end of run ---------- */
  function finishRun(){
    mode='finish'; P.fin=0; Audio.win(); bigText('FINISH','gold'); flash('#ffffff',.35); subtitle('סוגרים פוזיציה…',1800);
    setTimeout(()=>showResults(),2300);
  }
  function showResults(){
    const T=track, tb=Math.max(0,Math.round((T.par-runT)*25)); const total=Math.round(P.money+tb);
    const stars=1+(total>=T.goals[0]?1:0)+(total>=T.goals[1]?1:0);
    const prev=save.best[T.id]||{profit:0,stars:0}; const record=total>prev.profit;
    save.wallet+=Math.max(0,total); save.runs++; save.best[T.id]={profit:Math.max(prev.profit,total),stars:Math.max(prev.stars,stars)}; persist();
    mode='end'; el.hud.hidden=true; el.end.hidden=false; $('#endTitle').textContent=total>=T.goals[0]?'רווח נלקח':'סגרנו בקושי'; $('#endTitle').className='mission'+(total<=0?' bad':'');
    $('#stars').innerHTML=[1,2,3].map(i=>'<span class="'+(i<=stars?'':'off')+'">★</span>').join('');
    const rows=[['זמן',runT.toFixed(1)+' שנ׳ (יעד '+T.par+')'],['מטבעות',P.coins+' × $10+'],['נרות ירוקים / אדומים',P.greens+' / '+P.reds],['תרגילים',P.tricks+(P.best?' · <bdi dir="ltr">'+P.best.name+'</bdi>':'')],['נפילות (סטופ‑לוס)',String(P.wipes)],['רווח מהריצה','<b class="'+(P.money<0?'neg':'')+'">'+fmt(P.money)+'</b>'],['בונוס זמן','<b>'+fmt(tb)+'</b>']];
    $('#endRows').innerHTML=rows.map(r=>'<div><span>'+r[0]+'</span><span>'+r[1]+'</span></div>').join('');
    $('#endTotal').textContent=fmt(total)+(record?' ★':''); drawCandles(); renderMenuCards();
  }
  function drawCandles(){
    const c=$('#candles'), g=c.getContext('2d'), W=c.width, H=c.height; g.clearRect(0,0,W,H);
    const hist=P.history, n=18, per=track.len/n, cs=[]; let last=0;
    for(let i=0;i<n;i++){ const a=i*per, b=a+per, pts=hist.filter(h=>h.s>=a&&h.s<b); const open=last; let close=open, hi=open, lo=open; pts.forEach(p=>{ hi=Math.max(hi,p.m); lo=Math.min(lo,p.m); close=p.m; }); last=close; cs.push({o:open,c:close,h:hi,l:lo}); }
    const all=cs.flatMap(c=>[c.h,c.l,0]), mx=Math.max(...all), mn=Math.min(...all), rng=(mx-mn)||1, Y=v=>H-18-(v-mn)/rng*(H-40);
    g.strokeStyle='rgba(255,255,255,.12)'; g.lineWidth=1; g.beginPath(); g.moveTo(0,Y(0)); g.lineTo(W,Y(0)); g.stroke();
    const bw=W/n; cs.forEach((c,i)=>{ const up=c.c>=c.o, col=up?'#16e08a':'#ff3b57'; g.strokeStyle=col; g.fillStyle=col; const x=i*bw+bw/2; g.lineWidth=2; g.beginPath(); g.moveTo(x,Y(c.h)); g.lineTo(x,Y(c.l)); g.stroke(); const y1=Y(Math.max(c.o,c.c)), y2=Y(Math.min(c.o,c.c)); g.fillRect(x-bw*.3,y1,bw*.6,Math.max(3,y2-y1)); });
  }

  /* ---------- radar ---------- */
  function drawRadar(){
    const g=rg, W=220, C=110, k=.85; g.clearRect(0,0,W,W); g.save(); g.beginPath(); g.arc(C,C,C-2,0,PI*2); g.clip();
    g.fillStyle='rgba(18,26,52,.82)'; g.fillRect(0,0,W,W);
    const dx=Math.sin(P.hd), dz=-Math.cos(P.hd), rx=Math.cos(P.hd), rz=Math.sin(P.hd);
    const map=(x,z)=>{ const ax=x-P.x, az=z-P.z, f=ax*dx+az*dz, r=ax*rx+az*rz; return [C+r*k,C-f*k+22]; };
    g.fillStyle='rgba(230,240,255,.14)'; g.beginPath(); let first=true; const edgeL=[],edgeR=[];
    for(let s=P.s-30;s<=P.s+150;s+=6){ if(s<0) continue; const c=World.cx(s), w=World.halfW(s); edgeL.push(map(c-w,-s)); edgeR.push(map(c+w,-s)); }
    edgeL.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); for(let i=edgeR.length-1;i>=0;i--) g.lineTo(edgeR[i][0],edgeR[i][1]); g.closePath(); g.fill();
    g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=2; [edgeL,edgeR].forEach(E=>{ g.beginPath(); E.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.stroke(); });
    // kickers
    for(let kq=Math.max(0,Math.round((P.s-track.rampStart)/track.rampEvery)-1);kq<Math.round((P.s-track.rampStart)/track.rampEvery)+3;kq++){ const r=World.rampAt(kq); if(r.s<P.s-20||r.s>P.s+150) continue; const p=map(World.cx(r.s)+r.u,-r.s); g.fillStyle='#ffc83a'; g.fillRect(p[0]-7,p[1]-3,14,6); }
    World.nearItems(P.s,it=>{ if(it.dead) return; const col=it.type==='green'?'#16e08a':it.type==='red'?'#ff3b57':it.type==='coin'?'#ffd34a':it.type==='rockhaz'?'#9aa3b8':null; if(!col) return; const p=map(it.x,it.z); if(Math.hypot(p[0]-C,p[1]-C)>C) return; g.fillStyle=col; g.beginPath(); g.arc(p[0],p[1],it.type==='coin'?2:3.5,0,PI*2); g.fill(); });
    const fp=map(World.cx(track.len),-track.len); g.fillStyle='#fff'; g.fillRect(fp[0]-18,fp[1]-2,36,4);
    g.restore(); g.fillStyle='#fff'; g.strokeStyle='#000'; g.lineWidth=2; g.beginPath(); g.moveTo(C,C-9+22); g.lineTo(C+8,C+9+22); g.lineTo(C,C+4+22); g.lineTo(C-8,C+9+22); g.closePath(); g.fill(); g.stroke();
  }

  /* ---------- menu ---------- */
  function renderRiders(){ const row=$('#riderRow'); row.innerHTML=Rider.choices.map((n,i)=>'<button data-i="'+i+'" class="'+(i===(save.rider||0)?'sel':'')+'">'+(i+1)+'</button>').join('');
    row.querySelectorAll('button').forEach(b=>b.onclick=async()=>{ const i=+b.dataset.i; if(i===save.rider&&Rider.current===Rider.choices[i]) return; const st=$('#riderState'); st.textContent='טוענים…'; try{ await Rider.swap(Rider.choices[i]); save.rider=i; persist(); applyLook(); }catch(e){ console.warn(e); st.textContent='שגיאה'; setTimeout(()=>st.textContent='',1500); return; } st.textContent=''; renderRiders(); }); }
  function menuNote(t){ let n=document.getElementById('mnote'); if(!n){ n=document.createElement('div'); n.id='mnote'; document.body.appendChild(n); } n.textContent=t; n.className='show'; clearTimeout(menuNote.h); menuNote.h=setTimeout(()=>n.className='',2400); }
  function stars(n){ return '★'.repeat(n)+'☆'.repeat(3-n); }
  function unlocked(i){ if(i===0) return true; const prev=ST.TRACKS[i-1], b=save.best[prev.id]; return !!b&&b.stars>=2; }
  function renderMenuCards(){
    $('#walletN').textContent=fmt(save.wallet);
    ST.TrailMap.render($('#trailMap'),{tracks:ST.TRACKS,sel:trackIdx,best:save.best,unlocked},i=>{ if(!unlocked(i)){ menuNote('🔒 סיימו את '+ST.TRACKS[i-1].name+' עם 2 כוכבים כדי לפתוח'); return; } trackIdx=i; save.track=i; persist(); track=ST.TRACKS[i]; menuScene(); renderMenuCards(); });
    { const t=ST.TRACKS[trackIdx], b=save.best[t.id], drop=Math.round(t.len*t.slope*.92); $('#trackInfo').innerHTML='<div class="tn">'+t.en+'</div><span class="chip '+t.diff+'">'+t.diffName+'</span><div class="tb">'+t.blurb+'</div><div class="facts"><span>אורך<b>'+t.len+' מ׳</b></span><span>ירידה<b>'+drop+' מ׳</b></span><span>יעד רווח<b>'+fmt(t.goals[0])+'</b></span><span>שיא<b>'+(b?fmt(b.profit):'—')+'</b></span></div>'; }
    renderRiders();
    $('#boardCards').innerHTML=Rider.BOARDS.map((b,i)=>{ const own=save.owned.includes(i); return '<div class="card'+(i===save.board?' sel':'')+'" data-b="'+i+'"><div class="sw" style="background:linear-gradient(90deg,'+b.top[0]+','+b.top[1]+')"></div><div class="nm">'+b.name+'</div><div class="meta"><span>'+(own?(i===save.board?'נבחר':'שלכם'):'לרכישה')+'</span>'+(own?'':'<span class="px">'+fmt(b.price)+'</span>')+'</div></div>'; }).join('');
        document.querySelectorAll('#boardCards .card').forEach(c=>c.onclick=()=>{ const i=+c.dataset.b, b=Rider.BOARDS[i]; if(!save.owned.includes(i)){ if(save.wallet<b.price){ c.animate([{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'none'}],{duration:220}); return; } save.wallet-=b.price; save.owned.push(i); }
      save.board=i; persist(); Rider.setBoard(i); renderMenuCards(); });
  }
  function menuScene(){ resetPlayer(); P.hd=World.dcx(0)*0; mode='menu'; }
  function toMenu(){ mode='menu'; el.hud.hidden=true; el.end.hidden=true; el.pause.hidden=true; el.menu.hidden=false; Audio.music(false); menuScene(); renderMenuCards(); gr('uDesat',0); }
  function togglePause(){ if(mode==='play'){ mode='pause'; el.pause.hidden=false; } else if(mode==='pause'){ mode='play'; el.pause.hidden=true; last=performance.now(); } }
  $('#playBtn').onclick=startRun; $('#againBtn').onclick=startRun; $('#menuBtn').onclick=toMenu; $('#pause').onclick=togglePause; $('#resumeBtn').onclick=togglePause; $('#restartBtn').onclick=startRun; $('#quitBtn').onclick=toMenu;
  $('#mute').onclick=()=>{ save.muted=!save.muted; Audio.setMuted(save.muted); $('#mute').textContent=save.muted?'🔇':'🔊'; persist(); };
  $('#mute').textContent=save.muted?'🔇':'🔊';

  /* ---------- main loop ---------- */
  let last=performance.now(), frame=0, tAcc=0;
  function loop(now){
    requestAnimationFrame(loop);
    const raw=(now-last)/1000, dt=Math.min(.05,raw); last=now;
    if(mode==='play'||mode==='countdown'||mode==='finish'||mode==='lift') ST.qTick(raw,now);
    tick(dt); ST.render();
  }
  const _sv=new THREE.Vector3(); const flareEl=document.getElementById('flare'), fl=[...flareEl.children];
  function updateFlare(){ if(!track||!track.sky||mode==='load'){ flareEl.style.opacity=0; return; } const sd=track.sky.sunDir; _sv.set(sd[0],sd[1],sd[2]).normalize().multiplyScalar(900).add(camera.position); _sv.project(camera);
    const vis=_sv.z<1&&Math.abs(_sv.x)<1.6&&Math.abs(_sv.y)<1.6&&sd[1]>.05; if(!vis){ flareEl.style.opacity=0; return; }
    const W=innerWidth,H=innerHeight, sx=(_sv.x*.5+.5)*W, sy=(-_sv.y*.5+.5)*H, cx=W/2, cy=H/2, near=1-Math.min(1,Math.hypot(_sv.x,_sv.y)/1.5);
    const k=track.id==='ridge'?.25:track.sky.neon?.5:1; flareEl.style.opacity=(.25+.75*near)*k;
    const pos=[[sx,sy],[sx+(cx-sx)*.55,sy+(cy-sy)*.55],[sx+(cx-sx)*1.0,sy+(cy-sy)*1.0],[sx+(cx-sx)*1.5,sy+(cy-sy)*1.5]]; fl.forEach((e,i)=>{ e.style.left=pos[i][0]+'px'; e.style.top=pos[i][1]+'px'; }); }
  function tick(dt){
    tAcc+=dt; frame++; updateFlare();
    if(mode==='pause') return;
    ST.People.update(dt,camera.position.x,camera.position.z);
    if(mode==='lift'){ updateLift(dt); ST.Resort.update(tAcc*12,P.s-60); World.update(P.s-150); World.follow({x:camera.position.x,y:P.y,z:camera.position.z},tAcc); World.updateFlakes(tAcc,camera.position,{x:0,y:0,z:0}); spMat.uniforms.px.value=ST.renderer.getPixelRatio()*innerHeight/900; World.flakes.material.uniforms.px.value=ST.renderer.getPixelRatio()*innerHeight/900; return; }
    if(mode==='menu'||mode==='load'){ P.t+=dt; updateRider(dt,true); menuCamera(tAcc); ST.Resort.update(tAcc,P.s+40); World.update(P.s); World.follow(P,tAcc); World.updateFlakes(tAcc,camera.position,{x:0,y:0,z:0}); return; }
    if(mode==='countdown'){ countdown-=dt; const n=Math.ceil(countdown-.3); if(n!==lastCd){ lastCd=n; if(n>0){ bigText(String(n)); Audio.coin(n===1?4:0); } else { bigText('GO','gold'); Audio.green(); mode='play'; P.vx=Math.sin(P.hd)*5; P.vz=-Math.cos(P.hd)*5; subtitle('גררו לסיבוב · קפיצה בקצה הרמפה · תרגילים באוויר',3600); } }
      updateRider(dt,true); updateCamera(dt); }
    else if(mode==='play'||mode==='finish'){
      runT+=mode==='play'?dt:0; if(mode==='finish'){ P.vx*=Math.exp(-dt*.7); P.vz*=Math.exp(-dt*.7); P.fin+=dt; }
      if(mode==='play') stepPlayer(dt); else { P.x+=P.vx*dt; P.z+=P.vz*dt; P.s=-P.z; P.y=World.groundY(P.x,P.z); P.hd=lerpAngle(P.hd,Math.atan2(World.dcx(P.s),1),dt); P.tuck=0; P.lean=0; }
      if(mode==='play') collide(dt);
      // equity history
      if(P.s>=P.histS+8){ P.histS=P.s; P.history.push({s:P.s,m:P.money}); }
      updateRider(dt,false); updateCamera(dt);
      if(P.s<60) tip('steer','גררו ימינה ושמאלה כדי לסוב · החזיקו למעלה כדי להתכופף',4600);
      { const kq=Math.round((P.s-track.rampStart)/track.rampEvery); if(kq>=0){ const r=World.rampAt(kq); if(P.s>r.s-45&&P.s<r.s) tip('ramp','קפיצה! לחצו על הכפתור ממש בקצה הרמפה לקפיצה מושלמת',4800); } }
    }
    ST.Resort.update(tAcc,P.s); updateSpray(dt); World.update(P.s); World.follow({x:P.x,y:P.y,z:P.z},tAcc);
    World.updateFlakes(tAcc,camera.position,{x:P.vx,y:0,z:P.vz});
    ST.renderer.getPixelRatio(); spMat.uniforms.px.value=ST.renderer.getPixelRatio()*innerHeight/900; World.flakes.material.uniforms.px.value=ST.renderer.getPixelRatio()*innerHeight/900;
    // HUD
    P.shown+=(P.money-P.shown)*Math.min(1,dt*7); el.money.textContent=fmt(P.shown); el.money.classList.toggle('neg',P.shown<0);
    el.spd.textContent=Math.round(P.speed*3.6); const pg=clamp(P.s/track.len,0,1); el.prog.style.width=(pg*100)+'%'; el.progTxt.textContent=Math.max(0,Math.round(track.len-P.s))+' מ׳ לסיום';
    const m=mult(); el.combo.hidden=P.combo<1; if(P.combo>0){ el.comboX.textContent='x'+m; el.comboBar.style.transform='scaleX('+clamp(P.comboT/6,0,1)+')'; }
    { const vk=P.speed/(track.vref||24); el.speedfx.style.opacity=clamp((vk-.9)/.5,0,1)*.85; }
    if(frame%2===0) drawRadar(); el.radarTxt.textContent=Math.round(P.s)+' / '+track.len;
    if(subT>0){ subT-=dt*1000; if(subT<=0) el.sub.style.opacity=0; }
    if(flashK>0){ flashK=Math.max(0,flashK-dt*1.8); el.flash.style.opacity=flashK; }
    gr('uSpeed',clamp((P.speed/(track.vref||24)-.85)/.6,0,1)); if(P.tumble>0) gr('uDesat',damp(ST.GFX.grade?ST.GFX.grade.uniforms.uDesat.value:0,.85,6,dt)); else if(ST.GFX.grade&&ST.GFX.grade.uniforms.uDesat.value>0) gr('uDesat',damp(ST.GFX.grade.uniforms.uDesat.value,0,5,dt));
    Audio.update(P.speed*(24/(track.vref||24)),Math.abs(P.lean)+P.tuck*.5,!P.grounded);
  }

  /* ---------- boot ---------- */
  async function boot(){
    const bar=$('#loadbar'), txt=$('#loadtxt'); const set=(p,t)=>{ bar.style.width=p+'%'; if(t) txt.textContent=t; };
    set(10,'בונים את ההר…'); ST.onResize(); ST.qApply(ST.Q.lv);
    const qt=new URLSearchParams(location.search).get('track'); const qi=ST.TRACKS.findIndex(t=>t.id===qt); if(qi>=0) save.track=qi; else if(!(save.track>=0&&save.track<ST.TRACKS.length)||!unlocked(save.track)) save.track=0; track=ST.TRACKS[save.track]; trackIdx=ST.TRACKS.indexOf(track); World.setTrack(track); set(35,'מלבישים את הרוכב…');
    try{ await Rider.load(false); }catch(e){ console.error('rider',e); txt.textContent='שגיאה בטעינת הרוכב'; return; }
    set(80,'מחממים את השוק…'); Rider.setBoard(save.board); applyLook(); World.update(0,true); Audio.setMuted(save.muted); if(!(save.rider>=0&&save.rider<Rider.choices.length)) save.rider=3; if(save.rider>0&&Rider.choices[save.rider]){ ST.People.template(Rider.choices[save.rider]).then(()=>Rider.swap(Rider.choices[save.rider])).then(()=>applyLook()).catch(e=>console.warn('rider',e)); }
    set(100); await new Promise(r=>setTimeout(r,250));
    $('#loading').remove(); mode='menu'; toMenu(); P.t=0; ST.People.preload(5);
    const q=new URLSearchParams(location.search); if(q.get('auto')==='1'){ startRun(); }
    window.READY=true; requestAnimationFrame(loop);
  }
  const isPortraitPhone=()=>innerHeight>innerWidth&&innerWidth<700; const rot=$('#rotate'); const chkRot=()=>{ rot.hidden=!isPortraitPhone()||false; }; // portrait still playable; hint only
  rot.hidden=true; addEventListener('resize',joyHome);
  ST.debug={P,tick,startRun,startLift,beginCountdown,endLift,showResults,finishRun,get mode(){return mode;},setMode:m=>mode=m,track:()=>track,toMenu,input};
  boot();
})(window.ST);
