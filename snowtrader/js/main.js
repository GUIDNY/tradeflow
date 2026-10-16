/* Snow Rush: game flow, physics, tricks, camera, HUD. */
(function(ST){
  const {clamp,lerp,smooth,damp,lerpAngle,fmt,$,hash2}=ST;
  const {scene,camera,sun,World,Rider,Audio}=ST;
  const PI=Math.PI;

  /* ---------- save ---------- */
  const KEY='snowtrader.v1';
  let save={wallet:0,best:{},board:0,owned:[0],runs:0,track:0,muted:false,rider:3};
  try{ Object.assign(save,JSON.parse(localStorage.getItem(KEY)||'{}')); }catch(e){}
  // v3: the Meshy rider (textured ski kit, own helmet and gloves) is the default; the old riders stay selectable in the menu
  if(save.ver!==3){ save.ver=3; const mi=ST.Rider.choices.indexOf('meshy_rider'); save.rider=mi>=0?mi:3; }
  const persist=()=>{ try{ localStorage.setItem(KEY,JSON.stringify(save)); }catch(e){} };

  /* ---------- state ---------- */
  const P={x:0,y:0,z:0,vx:0,vz:0,vy:0,vyg:0,hd:0,vh:0,s:0,grounded:true,speed:0,speed3:0,gc:null,fall:null,sw:false,edge:0,body:0,fa:0,skid:0,slip:0,brakeK:0,skateK:0,charge:0,charging:false,airPitch:0,landOut:'',stumble:0,
    sp:0,fl:0,wsp:0,wfl:0,airT:0,grabT:0,grabbed:false,money:0,shown:0,combo:0,comboT:0,tricks:0,best:null,coins:0,greens:0,reds:0,wipes:0,
    stun:0,invuln:0,t:0,lean:0,crouch:.2,tuck:0,popT:9,popKind:'',landT:9,landAbs:0,shake:0,history:[],histS:0,airStart:0,finished:false,fin:0,boost:0};
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
  /* ---------- touch buttons (default; the joystick above is the alternative) ----------
     Left thumb: a steer strip, ◀ and ▶. Slide across it; a thumb on the middle (or one finger on each side) brakes. Holding a side
     turns harder the longer it is held, so a tap is a small correction and a hold is a carve.
     Right thumb: JUMP (hold to load, let go to pop) and SPEED (tuck; skate when slow; on a rail, press the nose). In the air they
     become SPIN and GRAB, and FLIP appears. A press keeps the meaning it had when it began: holding jump off the lip of a kicker
     does not become a spin, and landing while holding spin does not load a jump. */
  const tb={side:new Map(),l:false,r:false,brake:false,steer:0,spin:false,speed:false,flip:false,lastDir:1};
  const stEl=$('#steer'), bL=$('#btnL'), bR=$('#btnR'), bJ=$('#btnJump'), bG=$('#btnGrab'), bF=$('#btnFlip');
  const useJoy=()=>document.body.classList.contains('ctl-joy');
  const airborne=()=>mode==='play'&&!P.grounded&&!P.fall&&P.airT>.08;
  function stSide(e){ const r=stEl.getBoundingClientRect(), mid=r.left+r.width/2; return e.clientX<mid-20?'l':e.clientX>mid+20?'r':'b'; }
  function stSync(){ let l=false,r=false; tb.side.forEach(v=>{ if(v==='l'||v==='b') l=true; if(v==='r'||v==='b') r=true; }); tb.l=l; tb.r=r; tb.brake=l&&r;
    bL.classList.toggle('on',l); bR.classList.toggle('on',r); stEl.classList.toggle('both',tb.brake); }
  stEl.addEventListener('pointerdown',e=>{ e.preventDefault(); Audio.init(); try{ stEl.setPointerCapture(e.pointerId); }catch(_){} tb.side.set(e.pointerId,stSide(e)); stSync(); });
  stEl.addEventListener('pointermove',e=>{ if(tb.side.has(e.pointerId)){ tb.side.set(e.pointerId,stSide(e)); stSync(); } });
  const stUp=e=>{ if(tb.side.delete(e.pointerId)) stSync(); }; stEl.addEventListener('pointerup',stUp); stEl.addEventListener('pointercancel',stUp);
  function hold(btn,down,up){ const ids=new Set();
    btn.addEventListener('pointerdown',e=>{ e.preventDefault(); Audio.init(); ids.add(e.pointerId); try{ btn.setPointerCapture(e.pointerId); }catch(_){} btn.classList.add('on'); if(ids.size===1) down(); });
    const end=e=>{ if(ids.delete(e.pointerId)&&!ids.size){ btn.classList.remove('on'); up(); } }; btn.addEventListener('pointerup',end); btn.addEventListener('pointercancel',end); }
  let jCtx=null, gCtx=null;
  hold(bJ,()=>{ jCtx=!useJoy()&&airborne()?'spin':'jump'; if(jCtx==='spin') tb.spin=true; else { input.jump=true; input.jumpEdge=true; } },()=>{ input.jump=false; tb.spin=false; jCtx=null; });
  hold(bG,()=>{ gCtx=useJoy()||airborne()?'grab':'speed'; if(gCtx==='grab') input.grab=true; else tb.speed=true; },()=>{ input.grab=false; tb.speed=false; gCtx=null; });
  hold(bF,()=>{ tb.flip=true; },()=>{ tb.flip=false; });
  const KEYMAP={ArrowLeft:'l',KeyA:'l',ArrowRight:'r',KeyD:'r',ArrowUp:'u',KeyW:'u',ArrowDown:'d',KeyS:'d'};
  addEventListener('keydown',e=>{ if(e.repeat) return; Audio.init(); const k=KEYMAP[e.code]; if(k){ input.k[k]=true; e.preventDefault(); }
    if(e.code==='Space'){ e.preventDefault(); input.jump=true; input.jumpEdge=true; } if(e.code==='ShiftLeft'||e.code==='ShiftRight'||e.code==='KeyE') input.grab=true;
    if((e.code==='Escape'||e.code==='KeyP')&&(mode==='play'||mode==='pause')) togglePause(); if(e.code==='Enter'&&mode==='lift') endLift();
    if(e.code==='KeyC') cycleCam(); if(e.code==='KeyH') document.body.classList.toggle('hud-hidden'); if(e.code==='KeyR'&&mode==='play') startRun(); });
  addEventListener('keyup',e=>{ const k=KEYMAP[e.code]; if(k) input.k[k]=false; if(e.code==='Space') input.jump=false; if(e.code==='ShiftLeft'||e.code==='ShiftRight'||e.code==='KeyE') input.grab=false; });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden&&mode==='play') togglePause(); });
  addEventListener('blur',()=>{ input.k={}; input.jump=input.grab=false; tb.side.clear(); stSync(); tb.spin=tb.speed=tb.flip=false; if(mode==='play') togglePause(); });
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
  /* the board's mark in the snow: a carve cuts a narrow, darker groove under its edge; a skid or a stop smears a wide, faint swathe.
     Each point keeps its own width, offset (toward the edge that cut it) and depth; the shader darkens the middle of the groove. */
  const TR_N=170, tr={pts:[],geo:new THREE.BufferGeometry(),pos:new Float32Array(TR_N*2*3),ac:new Float32Array(TR_N*2),al:new Float32Array(TR_N*2),idx:new Uint16Array((TR_N-1)*6)};
  tr.geo.setAttribute('position',new THREE.BufferAttribute(tr.pos,3)); tr.geo.setAttribute('across',new THREE.BufferAttribute(tr.ac,1)); tr.geo.setAttribute('alpha',new THREE.BufferAttribute(tr.al,1)); tr.geo.setIndex(new THREE.BufferAttribute(tr.idx,1));
  const trailMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:true,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{col:{value:new THREE.Color(0x4a587f)}}]),
    vertexShader:'attribute float across; attribute float alpha; varying float vAc; varying float vA;\n#include <fog_pars_vertex>\nvoid main(){ vAc=across; vA=alpha; vec4 mvPosition=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
    fragmentShader:'uniform vec3 col; varying float vAc; varying float vA;\n#include <fog_pars_fragment>\nvoid main(){ float c=1.-abs(vAc*2.-1.); gl_FragColor=vec4(col,vA*(.25+.75*smoothstep(0.,.7,c)));\n#include <fog_fragment>\n}'});
  const trailMesh=new THREE.Mesh(tr.geo,trailMat); trailMesh.frustumCulled=false; trailMesh.renderOrder=2; scene.add(trailMesh);
  function trailPush(x,y,z,hd,gap){ const L=tr.pts[tr.pts.length-1]; if(L&&Math.hypot(L.x-x,L.z-z)<.7&&!gap) return;
    const e=Math.abs(P.edge||0), carve=smooth(.25,.85,e)*(1-P.skid), skid=clamp(P.skid*1.4+P.brakeK,0,1);
    const w=lerp(lerp(.15,.07,carve),.5,skid), off=carve*.11*(Math.sign(P.edge)||0), a=lerp(lerp(.3,.55,carve),.2,skid);
    tr.pts.push({x,y,z,hd,gap,w,off,a}); if(tr.pts.length>TR_N) tr.pts.shift(); rebuildTrail(); }
  function rebuildTrail(){ const n=tr.pts.length; let ic=0; for(let i=0;i<n;i++){ const p=tr.pts[i], c=Math.cos(p.hd), sn=Math.sin(p.hd), w=p.w||.15, o=p.off||0, cx=p.x+c*o, cz=p.z+sn*o;
      tr.pos.set([cx-c*w,p.y+.04,cz-sn*w,cx+c*w,p.y+.04,cz+sn*w],i*6); tr.ac[i*2]=0; tr.ac[i*2+1]=1; const fade=Math.min(1,i/12); tr.al[i*2]=tr.al[i*2+1]=(p.a||.3)*fade;
      if(i>0&&!p.gap){ const a=(i-1)*2,b=a+1,c2=i*2,d=c2+1; tr.idx[ic++]=a; tr.idx[ic++]=b; tr.idx[ic++]=c2; tr.idx[ic++]=b; tr.idx[ic++]=d; tr.idx[ic++]=c2; } }
    tr.geo.setDrawRange(0,ic); tr.geo.attributes.position.needsUpdate=true; tr.geo.attributes.across.needsUpdate=true; tr.geo.attributes.alpha.needsUpdate=true; tr.geo.index.needsUpdate=true; }

  /* ---------- run setup ---------- */
  function resetPlayer(){
    World.setTrack(track); const T=track;
    ST.Physics.reset(P,World.cx(0),0,Math.atan2(World.dcx(0),1));
    P.money=0; P.shown=0; P.combo=0; P.comboT=0; P.tricks=0; P.best=null; P.coins=0; P.greens=0; P.reds=0; P.wipes=0; P.wipeLog=[];
    P.t=0; P.history=[{s:0,m:0,v:0}]; P.histS=0; P.finished=false; P.fin=0; P.lean=0; P.shake=0; P.autoSkate=0; acc=0;
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
    R.P.t=lift.t; R.P.look=Math.sin(lift.t*.7)*28; Object.assign(R.P,{crouch:0,air:0,grab:0,tuck:0,body:0,edge:0,fa:0,om:0,charge:0,brake:0,skid:0,absorb:0,ext:0,rough:0,wobble:0,skate:0,ground:0,getup:0,dir:1}); R.pose({});
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

  /* ---------- tricks / scoring: from the physics' landing events ---------- */
  const mult=()=>Math.min(5,1+Math.floor(P.combo*.5+.001)*1)||1;
  function addMoney(v,label){ P.money+=v; if(label){ el.moneyD.textContent=(v>=0?'+':'−')+fmt(Math.abs(v)).slice(0)+' '+label; el.moneyD.style.opacity=1; clearTimeout(addMoney.h); addMoney.h=setTimeout(()=>el.moneyD.style.opacity=0,1100); } }
  /* Frontside/backside: a regular rider (left foot forward) spinning counter-clockwise seen from above opens the chest down the
     hill first: frontside. Clockwise is backside. Riding switch mirrors it. */
  function onLand(e){
    const power=clamp(e.imp/9,.12,1);
    if(e.out==='fall') return;                                   // the fall event handles the rest
    Audio.land(power); if(e.air>.3) puff(power); camPunch=Math.max(camPunch,clamp((e.imp-3)*.06,0,.38));
    if(e.air<.28) return;                                        // just a hop
    let pts=0; const parts=[], half=Math.abs(e.half), flips=Math.abs(e.flips);
    if(half){ const side=((e.spin>0)!==!!e.swTake)?'BS':'FS'; parts.push(side+' '+(half*180)); pts+=half*130*(1+(half-1)*.45); }
    if(flips){ parts.push(e.flip>0?(flips>1?flips+'× BACKFLIP':'BACKFLIP'):(flips>1?flips+'× FRONTFLIP':'FRONTFLIP')); pts+=flips*480*(1+(flips-1)*.5); }
    const grabs=(e.grabs&&e.grabs.length?e.grabs:[e.grabName]).filter(Boolean);
    if(e.grab>.3){ parts.push(grabs.join(' + ')+' GRAB'); pts+=Math.min(e.grab,3)*110+(grabs.length-1)*140; }   // chained grabs in one air score extra
    if(!half&&!flips&&e.grab<=.3){ if(e.air>.75){ parts.push('STRAIGHT AIR'); pts+=40+e.air*40; } else if(e.kind==='ollie'||e.kind==='nollie'){ parts.push(e.kind==='nollie'?'NOLLIE':'OLLIE'); pts+=e.kind==='nollie'?45:30; } }
    else if(e.kind==='nollie') pts+=40;
    if(e.air>1) pts+=(e.air-1)*90;
    if(e.lip) pts+=60;
    let name=parts.join(' + ')||'AIR'; if(e.swTake&&(half||flips||e.grab>.3)){ name='SWITCH '+name; pts*=1.15; }
    if(e.out==='stumble'){ pts*=.5; name+=' · SKETCHY'; P.shake=Math.max(P.shake,.35); }
    if(pts>=30){ P.combo++; P.comboT=6; const m=mult(), gain=Math.round(pts*m); P.tricks++; if(!P.best||gain>P.best.gain) P.best={name,gain};
      addMoney(gain,'x'+m); toast(name,'+'+fmt(gain)+(m>1?'  ·  x'+m:''),e.out==='stumble'); Audio.trick(Math.min(P.combo,6)); P.boost+=Math.min(half+flips*2,4)*.8;
      if(e.out==='clean'&&pts>=420) slowmo(pts>=900?.38:.5); }   // a big trick landed clean: a beat of slow motion
  }
  /* slow motion: the world runs slower for a moment and eases back (physics, pose, camera and particles all use the scaled time) */
  let tScale=1, slowT=0; function slowmo(k){ tScale=k; slowT=.32; }
  function stepTimeScale(dt){ if(slowT>0){ slowT-=dt; } else tScale=Math.min(1,tScale+dt*1.8); return tScale; }
  function puff(p){ const n=Math.round(10+p*22); for(let i=0;i<n;i++){ const a=Math.random()*PI*2, s=2+Math.random()*5*p; emit(P.x+Math.cos(a)*.4,P.y+.2,P.z+Math.sin(a)*.4,Math.cos(a)*s,1.5+Math.random()*3*p,Math.sin(a)*s,.45+Math.random()*.5,.7+Math.random()*.4); } }
  function onFall(e){
    P.wipeLog=(P.wipeLog||[]); P.wipeLog.push((e.why||'?')+'@'+Math.round(P.s)); P.wipes++; P.combo=0; P.comboT=0; P.shake=1; Audio.wipe();
    const loss=Math.round(Math.max(120,P.money*.12)); addMoney(-loss,'WIPEOUT'); bigText('WIPEOUT','wasted'); flash('#ff1a30',.55);
    puff(1.2); for(let i=0;i<40;i++) emit(P.x,P.y+.5,P.z,(Math.random()-.5)*9,Math.random()*7,(Math.random()-.5)*9,.8,1.2);
  }
  /* a trick that scores: combo, multiplier, best trick, toast */
  function score(name,pts,sketchy){ if(sketchy){ pts*=.5; name+=' · SKETCHY'; }
    P.combo++; P.comboT=6; const m=mult(), gain=Math.round(pts*m); P.tricks++; if(!P.best||gain>P.best.gain) P.best={name,gain};
    addMoney(gain,'x'+m); toast(name,'+'+fmt(gain)+(m>1?'  ·  x'+m:''),sketchy); Audio.trick(Math.min(P.combo,6)); }
  /* jibs: a slide on a box or a rail scores by how long it lasted, harder for rails, boardslides and presses */
  function onGrindEnd(e){ balEl.classList.remove('on'); if(e.fell||e.time<.2) return;
    const rail=e.kind==='rail', what=e.press?(e.press>0?'NOSE PRESS':'TAIL PRESS'):e.style;
    let pts=(rail?70:50)+Math.min(e.time,4)*(rail?110:80); if(e.style==='BOARDSLIDE') pts*=1.3; if(e.press) pts*=1.25;
    score((e.sw?'SWITCH ':'')+what+' · '+e.name,pts,false); }
  function onButter(e){ if(e.time<.35) return; const half=Math.abs(e.half), end=e.phys>0?'NOSE':'TAIL';
    score(half?end+' BUTTER '+half*180:end+' PRESS',40+Math.min(e.time,3)*35+half*110,!e.clean); }
  function onEvent(e){
    if(e.type==='land') onLand(e);
    else if(e.type==='takeoff'){ if(e.pop) Audio.jump(); if(e.lip) toast('PERFECT POP','',false); if(e.pop&&P.vy>4.5) fovKick=Math.max(fovKick,4.5); }
    else if(e.type==='fall') onFall(e);
    else if(e.type==='grindStart'){ balEl.classList.add('on'); balName.textContent=e.style+' · '+e.name; Audio.land(.25); }
    else if(e.type==='grindEnd') onGrindEnd(e);
    else if(e.type==='butter') onButter(e);
  }
  /* the balance meter on a jib: the needle is the lean, push the stick the other way to bring it back */
  const balEl=document.createElement('div'); balEl.id='balance'; balEl.innerHTML='<b></b><div class="track"><i></i></div>'; el.hud.appendChild(balEl);
  const balName=balEl.querySelector('b'), balNeedle=balEl.querySelector('i');
  function balanceHud(){ const G=P.grind; if(!G) return; const b=clamp(G.bal,-1.1,1.1); balNeedle.style.left=(50+b*45)+'%'; balEl.classList.toggle('warn',Math.abs(b)>.65); }

  /* ---------- the player: physics (js/physics.js) at a fixed 120 Hz, effects from its state ---------- */
  const Physics=ST.Physics, FIXED=1/120, EV=[]; let acc=0, stepN=0;
  // stick back brakes; with grab held it presses the tail instead (stick forward + grab presses the nose)
  const ctl={steer:0,fwd:0,flip:0,jump:false,grab:false,brake:false,spin:false,spinDir:1};
  function readControls(){ const iy=steerY(), h=FIXED;
    // the touch strip eases in (a hold carves harder the longer it is held) and lets go faster than it bites
    const tgt=tb.brake?0:tb.r?1:tb.l?-1:0; tb.steer=damp(tb.steer,tgt,tgt?7:12,h);
    ctl.steer=clamp(steerX()+tb.steer,-1,1); ctl.fwd=clamp(-iy+(tb.speed?1:0),-1,1); ctl.flip=clamp(iy+(tb.flip?1:0),-1,1);
    ctl.jump=!!input.jump; ctl.grab=!!input.grab; ctl.brake=(iy>.45&&!ctl.grab)||tb.brake;
    // SPIN spins the way the rider is steering, or the way it last turned on the snow
    if(P.grounded&&Math.abs(ctl.steer)>.3) tb.lastDir=Math.sign(ctl.steer);
    ctl.spin=tb.spin; ctl.spinDir=tb.r&&!tb.l?1:tb.l&&!tb.r?-1:tb.lastDir; return ctl; }
  function runPhysics(dt){ acc+=dt; let n=0; while(acc>=FIXED&&n<12){ acc-=FIXED; n++; physicsStep(FIXED); } if(n>=12) acc=0; }
  function physicsStep(h){
    readControls(); EV.length=0;
    if(mode==='play') Physics.step(P,ctl,h,EV); else Physics.finishStep(P,h,EV);
    if(mode==='play'){ runT+=h; collide(h); }
    for(let i=0;i<EV.length;i++) onEvent(EV[i]);
    stepEffects(h);
  }
  function stepEffects(h){
    stepN++; const sp=P.speed;
    if(P.comboT>0){ P.comboT-=h; if(P.comboT<=0) P.combo=0; }
    P.shake=Math.max(0,P.shake-h*1.4);
    if(!P.grounded||P.grind){ P._lastAir=true; return; }   // no snow thrown or track left in the air or on a jib
    const dx=Math.sin(P.hd), dz=-Math.cos(P.hd), rx=Math.cos(P.hd), rz=Math.sin(P.hd);
    // snow spray: thrown outward from the edge that is cutting (a carve), a sheet of it in a skid or a stop
    if(sp>2&&!(P.fall&&P.fall.ph!=='lose'&&P.fall.ph!=='down')){ const carve=Math.abs(P.edge), k=clamp(P.skid*1.7+carve*.8+(P.tuck>.5?.15:0),0,2.6)*(h*60); const n=Math.floor(k)+(Math.random()<k%1?1:0), side=-(Math.sign(P.edge)||Math.sign(P.slip)||1);
      for(let i=0;i<n;i++){ const w=(.6+Math.random())*(1+P.skid*3); emit(P.x-rx*side*.12-dx*.25+(Math.random()-.5)*.7,P.y+.08,P.z-rz*side*.12-dz*.25+(Math.random()-.5)*.7,
          P.vx*.12+rx*side*w+(Math.random()-.5)*1.4, .5+Math.random()*1.8+sp*.03+P.skid*1.3, P.vz*.12+rz*side*w+(Math.random()-.5)*1.4, .3+Math.random()*.35+P.skid*.25,.4+Math.random()*.35); } }
    if(stepN%2===0&&sp>1.5&&!(P.fall&&P.fall.ph!=='lose')){ trailPush(P.x,P.y,P.z,P.hd,P._lastAir); P._lastAir=false; }
    // the glove dragging through the snow on a deep carve throws its own spray
    const hd=Rider.handDrag; if(hd&&hd.touch&&sp>5&&stepN%2===0){ for(let i=0;i<2;i++) emit(hd.pos.x+(Math.random()-.5)*.15,hd.pos.y+.02,hd.pos.z+(Math.random()-.5)*.15,P.vx*.25+(Math.random()-.5)*1.6,.6+Math.random()*1.4,P.vz*.25+(Math.random()-.5)*1.6,.22+Math.random()*.2,.35+Math.random()*.25); }
  }

  /* ---------- pickups and hazards ---------- */
  function collide(dt){
    if(P.fall||mode!=='play') return;
    const px=P.x, py=P.y, pz=P.z;
    World.nearItems(P.s,it=>{ if(it.dead) return;
      const dx=it.x-px, dz=it.z-pz, d2=dx*dx+dz*dz;
      if(it.type==='coin'){ if(d2<it.r*it.r&&Math.abs(it.y-(py+1))<2.4){ it.dead=true; P.coins++; addMoney(it.big?25:10); P.shown+=0; Audio.coin(Math.min(P.coins%12,11)); for(let i=0;i<5;i++) emit(it.x,it.y,it.z,(Math.random()-.5)*4,Math.random()*3,(Math.random()-.5)*4,.4,.5); } }
      else if(it.type==='green'){ it.mesh.position.y=it.y+Math.sin(P.t*2+it.x)*.12; if(d2<it.r*it.r&&py<it.y+it.h+1.5){ it.dead=true; it.mesh.visible=false; P.greens++; const v=Math.round(80+it.h*30); addMoney(v,'CRYSTAL'); toast('CRYSTAL',' +'+fmt(v)); Audio.green(); P.boost+=2.2; for(let i=0;i<16;i++) emit(it.x,it.y+it.h/2,it.z,(Math.random()-.5)*6,Math.random()*5,(Math.random()-.5)*6,.55,.8); } }
      else if(it.type==='red'){ if(P.invuln<=0&&d2<it.r*it.r&&py<it.y+it.h+.3){ it.dead=true; it.mesh.visible=false; P.reds++; const v=Math.round(110+it.h*25); addMoney(-v,'ICE SPIKE'); toast('OUCH','−'+fmt(v),true); Audio.red(); P.shake=.7; P.stun=.35; P.vx*=.62; P.vz*=.62; P.combo=0; flash('#ff2244',.3); for(let i=0;i<22;i++) emit(it.x,it.y+1,it.z,(Math.random()-.5)*8,Math.random()*6,(Math.random()-.5)*8,.6,.8); } }
      else if(it.type==='rockhaz'||it.type==='rock'){ if(P.invuln<=0&&!P.fall&&d2<(it.r+.35)*(it.r+.35)&&py<it.y+1.6){ it.dead=true; Physics.hit(P,it.x,it.z,it.r,EV); } }
      else if(it.type==='tree'){ if(P.invuln<=0&&!P.fall&&d2<(it.r+.3)*(it.r+.3)&&py<it.y+4){ it.dead=true; Physics.hit(P,it.x,it.z,it.r,EV); } }
      else if(it.type==='finish'&&!P.finished&&P.s>=track.len-.5){ P.finished=true; finishRun(); }
    });
    if(!P.finished&&P.s>=track.len) { P.finished=true; finishRun(); }
  }

  /* ---------- camera ---------- */
  const CAMS=['chase','close','wide','side']; let camMode=0;
  let camHd=0, camSnap=true, heroK=0, heroSide=0, kickK=0, camSide=0, camPunch=0, fovKick=0; const camPos=new THREE.Vector3(), camLook=new THREE.Vector3(), _f=new THREE.Vector3(), _ft=new THREE.Vector3(), _g=new THREE.Vector3(), _gl=new THREE.Vector3();
  function camReset(){ camSnap=true; camHd=P.hd; }
  function cycleCam(){ camMode=(camMode+1)%CAMS.length; camSnap=true; subtitle('מצלמה: '+['רגילה','קרובה','רחבה','צד'][camMode],1200); }
  function updateCamera(dt){
    if(camera.view&&camera.view.enabled) camera.clearViewOffset();
    const sp=P.speed, air=!P.grounded;
    camHd=lerpAngle(camHd,P.speed>2.5?P.vh:P.hd,1-Math.exp(-dt*(air?1.2:3.1)));   // the camera follows the travel, not the board (a skid swings the board, not the view)
    const heroOn=air&&P.airT>.4&&!P.fall; heroK=damp(heroK,heroOn?1:0,heroOn?2.2:3.5,dt); if(heroOn&&!heroSide) heroSide=Math.random()<.5?-1:1; if(!heroOn&&heroK<.02) heroSide=0;
    const camA=camHd+(heroSide||1)*heroK*.85, fx=Math.sin(camA), fz=-Math.cos(camA);
    const cm=CAMS[camMode], cd=cm==='close'?.62:cm==='wide'?1.7:1, ch2=cm==='close'?.7:cm==='wide'?1.9:1;
    // a kicker coming up: the camera rises and looks further ahead so the jump and its landing are in the picture
    let kick=0; if(!air&&mode==='play'){ World.forRamps(P.s,P.s+40,r=>{ const d=r.s+r.L-P.s; if(d>2&&d<40&&Math.abs(World.cx(r.s)+r.u-P.x)<r.w+3) kick=Math.max(kick,1-smooth(18,40,d)); }); }
    kickK=damp(kickK,kick,3,dt);
    // carving: drift to the outside of the turn so the lean into it shows; landings punch the camera down with their impact
    camSide=damp(camSide,air?0:-clamp(P.lean,-1,1)*.85,2.5,dt); camPunch=damp(camPunch,0,9,dt);
    const vq=clamp(sp/((track.vref||24)*1.3),0,1), dist=(lerp(4.7,6.6,vq)+(air?.7:0)+kickK*.9)*(1-.28*heroK)*cd, h=(lerp(1.9,2.6,vq)+(air?.8:0)+P.tuck*-.3+kickK*.7)*(1-.35*heroK)*ch2;
    const rxC=Math.cos(camA), rzC=Math.sin(camA);
    let tx=P.x-fx*dist+rxC*camSide*cd, tz=P.z-fz*dist+rzC*camSide*cd; let ty=P.y+h-camPunch;
    if(cm==='side'){ const rx=Math.cos(camA), rz=Math.sin(camA); tx=P.x+rx*5.2-fx*1.2; tz=P.z+rz*5.2-fz*1.2; ty=P.y+1.3; }
    const gy=World.groundY(tx,tz)+1.3; if(ty<gy) ty=gy;
    _f.set(tx,ty,tz); if(camSnap){ camPos.copy(_f); camSnap=false; } else { const k=1-Math.exp(-dt*(air?6:11)); camPos.lerp(_f,k); }
    const la=CAMS[camMode]==='side'?.6:8+kickK*7, lx=P.x+fx*la, lz=P.z+fz*la, ly=P.y+(CAMS[camMode]==='side'?.9:1.2)+(air?clamp(P.vy*.06,-1.5,1.5):0)-(sp>20?.2:0)-camPunch*.5;
    camLook.lerp(new THREE.Vector3(lx,ly,lz),1-Math.exp(-dt*9));
    if(mode==='countdown'){ const k=clamp(1-countdown/2.5,0,1), e=k*k*(3-2*k), th=lerp(PI*.92,0,e)*ST.Resort.lodgeSide(), r=lerp(6.2,dist,e), ch=lerp(1.5,h,e);
      _g.set(P.x+Math.sin(th)*r*Math.cos(P.hd)+Math.sin(P.hd)*0, 0, P.z+Math.cos(th)*r); _g.y=Math.max(P.y+ch,World.groundY(_g.x,_g.z)+1.0); _gl.set(P.x,P.y+1.3,P.z); _gl.lerp(camLook,e); _g.lerp(camPos,e*e*e); }
    camera.position.copy(mode==='countdown'?_g:camPos); if(P.shake>0){ const s=P.shake*P.shake*.5; camera.position.x+=(Math.random()-.5)*s; camera.position.y+=(Math.random()-.5)*s; }
    // very fast on the snow: the lens picks up the chatter of the board
    if(!air&&mode==='play'){ const ch=smooth(.85,1.3,sp/(track.vref||24))*.018; camera.position.y+=Math.sin(P.t*41)*ch+Math.sin(P.t*67+1)*ch*.6; }
    camera.lookAt(mode==='countdown'?_gl:camLook); camera.rotateZ(-P.lean*.045-(P.fall&&P.fall.ph==='down'?Math.sin(P.t*20)*.03:0));
    fovKick=damp(fovKick,0,4,dt);
    const base=ST.baseFov||62; const f=base+clamp((sp/(track.vref||24)-.35)/1.0,0,1)*14+(P.boost>0?3:0)+heroK*5+fovKick; if(Math.abs(camera.fov-f)>.05){ camera.fov=damp(camera.fov,f,4,dt); camera.updateProjectionMatrix(); }
  }
  function menuCamera(t){ const W=innerWidth,H=innerHeight; if(W>H*1.1) camera.setViewOffset(W,H,W*.2,0,W,H); else if(camera.view&&camera.view.enabled) camera.clearViewOffset(); const a=PI+Math.sin(t*.15)*.9+.4, r=4.3; camera.position.set(P.x+Math.sin(a)*r*.6-1.2,P.y+1.45,P.z+Math.cos(a)*r); camera.lookAt(P.x,P.y+.95,P.z); camera.fov=ST.baseFov||62; camera.updateProjectionMatrix(); }

  /* ---------- rider visuals: physics state -> where the board sits, and the pose parameters (rider.js builds the body) ---------- */
  const _qb=new THREE.Quaternion(), _e=new THREE.Euler();
  function popPitch(){ // ollie: the tail snaps down and the nose comes up, pivoting on the tail; nollie: the other way round
    if(P.grounded||!P.popKind||P.popKind==='drop') return 0; const t=P.popT, D=.42; if(t>D) return 0; return (P.popKind==='nollie'?-1:1)*.4*Math.sin(Math.PI*t/D); }
  function stateName(){ const F=P.fall;
    if(F) return F.ph==='lose'?'loss of balance':F.ph==='down'?'falling':F.ph==='slide'?'sliding (fallen)':F.ph==='getup'?'getting up':'recovery';
    if(mode==='menu'||mode==='countdown') return 'standing / neutral';
    if(!P.grounded) return P.grabbed?'trick: '+P.grabName+' grab':(Math.abs(P.wsp)>2||Math.abs(P.wfl)>2)?'trick: rotation':P.airT<.15?'takeoff':'airborne';
    if(P.grind){ const G=P.grind; return (Math.abs(G.press)>.5?(G.press*(P.sw?-1:1)>0?'nose press':'tail press'):G.style.toLowerCase())+' on '+G.r.name.toLowerCase(); }
    if(P.butter) return Math.abs(P.sp)>.3?'butter (spinning on the '+(P.butter.phys>0?'nose':'tail')+')':(P.butter.phys>0?'nose':'tail')+' press';
    if(P.landT<.4) return P.landOut==='stumble'?'landing (sketchy)':'landing compression';
    if(P.stumble>0) return 'recovery';
    if(P.charging) return 'jump preparation (loading)';
    if(P.skateK>.5) return 'flat-ground skating';
    if(P.brakeK>.4) return 'braking (sideways skid)';
    if(P.skid>.35) return 'skidding turn';
    if(P.tuck>.5) return 'crouching (tuck)';
    const e=Math.abs(P.edge); if(e>.75) return 'deep carving'; if(e>.25) return 'carving';
    return P.speed<1.5?'standing / neutral':'athletic stance'; }
  function updateRider(dt,menu){
    const R=Rider, g=P.gc, F=P.fall, air=!P.grounded&&!F, bt=!!P.butter;
    // a butter turns the board flat on the snow about its pressed end: that turn belongs to the board's heading, not to an air spin
    // the physics follows the snow under the middle of the board; where the snow is hollow under it (a transition) the board rests
    // on its ends a little higher: drawn there, eased in and out so leaving or meeting a curved wall does not jump
    P.vOff=damp(P.vOff||0,P.grounded&&!F&&!P.grind&&g?g.gap:0,25,dt);
    R.root.position.set(P.x,P.y+P.vOff,P.z); R.root.rotation.set(0,-(P.hd+(bt?P.sp:0)),0);
    // the board on the snow: pitch and roll from the contact samples; in the air the rider brings it round to meet the landing
    // a press tips the board onto one end (the other end lifts off), an ollie snaps the tail down: both pivot on the end that goes down
    const pp=popPitch(), pr=-(P.press||0)*(P.pressK||0)*.17;
    // off a pipe wall the rider stands up over the lip and leans back into the wall coming down: the roll follows the wall below
    // while the board is close to it
    const airRoll=P.wallAir&&g?g.roll*(1-smooth(0,1.2,P.y-g.h)):0;
    _e.set((air?P.airPitch:(g?g.pitch:0))+pp+pr,0,air?airRoll:(g?g.roll:0),'YXZ'); _qb.setFromEuler(_e);
    R.tilt.quaternion.slerp(_qb,1-Math.exp(-dt*(air?10:35))); R.tilt.position.set(0,.7*Math.sin(Math.abs(pp+pr)),0);
    // the edge: the board rolls onto it, pivoting on the edge in the snow (not on its centre line, which would sink the other edge)
    const edge=P.edge||0, hw=.13, sg=Math.sign(edge); R.rollG.rotation.z=-edge; R.rollG.position.set(sg*hw*(1-Math.cos(edge)),hw*Math.abs(Math.sin(edge)),0);
    R.edge=edge; R.body=P.body||0; P.lean=clamp((P.body||0)/.6,-1,1);
    // spins, flips, riding switch (the whole rider and board turned round: the right foot leads)
    R.trick.rotation.order='YXZ'; R.trick.rotation.y=-((bt?0:P.sp)+(P.sw?PI:0)); R.trick.rotation.x=P.fl;
    // pose parameters: every one is a physical quantity or a phase, rider.js turns them into joint angles
    const p=R.P, sp=P.speed, vr=track.vref||16, bell=(t,d)=>t<d?Math.sin(PI*t/d):0;
    p.t=P.t; p.menu=!!menu; p.dir=P.sw?-1:1;
    p.crouch=damp(p.crouch,menu?.2:clamp(.16+.18*clamp(sp/(vr*1.3),0,1)+P.tuck*.55,0,1),8,dt);
    p.charge=damp(p.charge,P.charging?P.charge:0,16,dt);
    p.tuck=damp(p.tuck,air?(P.grabbed?.55:.3):P.tuck,9,dt);
    p.air=damp(p.air,air?1:0,14,dt); p.grab=damp(p.grab,air&&P.grabbed?1:0,12,dt); if(P.grabbed) p.grabName=P.grabName;
    p.spinW=air?P.wsp:0; p.flipW=air?P.wfl:0;
    p.body=P.body||0; p.edge=edge; p.fa=P.fa||0; p.om=damp(p.om||0,P.grounded&&!F?P.om:0,10,dt); p.slip=P.slip||0; p.speed=sp;
    p.brake=P.brakeK; p.skid=P.skid;
    p.absorb=damp(p.absorb,clamp(P.landAbs*bell(P.landT,.42)+(P.grounded&&!F?clamp(P.ayF/40,-.2,.3):0),-.2,1),18,dt);
    p.ext=damp(p.ext,Math.max(P.popKind&&P.popKind!=='drop'?bell(P.popT,.3):0,air&&P.airT<.2?.4*(1-P.airT/.2):0),18,dt);
    p.rough=damp(p.rough,P.grounded&&!F?clamp(sp/(vr*1.2),0,1)*(1-P.tuck*.4)*(P.grind?.2:1):0,4,dt);
    // presses (canonical: + = the leading end) and the balance on a jib
    p.press=damp(p.press||0,(P.press||0)*(P.pressK||0),10,dt); p.jib=damp(p.jib||0,P.grind?1:0,9,dt); p.bal=P.grind?P.grind.bal:damp(p.bal||0,0,6,dt);
    // the wind-up while loading a jump and turning, and how far the rider has turned in the air (for spotting the landing)
    p.windup=damp(p.windup||0,P.charging&&P.grounded?ctl.steer*P.charge:0,12,dt); p.spinA=air?(P.sp-(P.spU||0)):0;
    p.wobble=damp(p.wobble,(F&&F.ph==='lose'?1:0)+(P.stumble>0?.7:0),10,dt);
    p.skate=P.skateK; if(P.skate) p.skatePh=P.skate.ph;
    p.popKind=P.popKind; p.popT=P.popT; p.airT=P.airT;
    let gnd=0, gu=0; if(F){ if(F.ph==='down') gnd=clamp(F.t/.45,0,1); else if(F.ph==='slide') gnd=1; else if(F.ph==='getup'){ gnd=1; gu=clamp(F.t/.95,0,1); } else if(F.ph==='recover'){ gnd=1; gu=1; } }
    p.ground=gnd; p.getup=gu; p.fallPh=F?F.ph:'';
    R.state=stateName(); R.pose({});
    R.root.visible=true;
  }

  /* coins the camera is about to fly through would fill the screen: hide them when the lens gets close */
  function coinFade(){ World.updateCoins(tAcc,camera.position,P.s); }

  /* ---------- jump speed: approaching a kicker, say whether this speed will land on the landing (real parks mark this) ---------- */
  const jh=document.createElement('div'); jh.id='jumpHint'; el.hud.appendChild(jh); let jhState='';
  function jumpHint(){ let txt='', cls='';
    if(mode==='play'&&P.grounded&&!P.fall){ const T=track;
      World.forRamps(P.s,P.s+75,r=>{ if(txt) return; const d=r.s+r.L-P.s; if(d<8||d>75) return; if(Math.abs(World.cx(r.s)+r.u-P.x)>r.w+4) return;
        const w=World.jumpWindow(r); if(!w.hi) return;
        // the speed left at the lip after climbing the table and the kicker (energy, with ~15% lost to friction and drag)
        const v2=P.speed*P.speed+2*9.81*((T.slope*d)-(r.Hm+r.h))*.85, vl=Math.sqrt(Math.max(0,v2));
        if(vl>w.hi+.5){ txt='מהר מדי לקיקר — בלמו'; cls='bad'; } else if(vl<w.lo-.5){ txt='איטי מדי לקיקר'; cls='slow'; } else { txt='מהירות טובה לקיקר ✓'; cls='ok'; }
        txt+=' · '+Math.round(vl*3.6)+' קמ״ש בשפה · טווח \u2066'+Math.round(w.lo*3.6)+'–'+Math.round(w.hi*3.6)+'\u2069'; }); }   // LTR isolate: the range reads lo–hi in Hebrew too
    const st=txt+cls; if(st!==jhState){ jhState=st; jh.textContent=txt; jh.className=cls; jh.style.opacity=txt?1:0; } }

  /* ---------- end of run ---------- */
  function finishRun(){
    mode='finish'; P.fin=0; Audio.win(); bigText('FINISH','gold'); flash('#ffffff',.35); subtitle('חוצים את קו הסיום…',1800);
    setTimeout(()=>showResults(),2300);
  }
  function showResults(){
    const T=track, tb=Math.max(0,Math.round((T.par-runT)*25)); const total=Math.round(P.money+tb);
    const stars=1+(total>=T.goals[0]?1:0)+(total>=T.goals[1]?1:0);
    const prev=save.best[T.id]||{profit:0,stars:0}; const record=total>prev.profit;
    save.wallet+=Math.max(0,total); save.runs++; save.best[T.id]={profit:Math.max(prev.profit,total),stars:Math.max(prev.stars,stars)}; persist();
    mode='end'; el.hud.hidden=true; el.end.hidden=false; $('#endTitle').textContent=total>=T.goals[0]?'ריצה מושלמת':'סיימנו את הריצה'; $('#endTitle').className='mission'+(total<=0?' bad':'');
    $('#stars').innerHTML=[1,2,3].map(i=>'<span class="'+(i<=stars?'':'off')+'">★</span>').join('');
    const rows=[['זמן',runT.toFixed(1)+' שנ׳ (יעד '+T.par+')'],['מטבעות',P.coins+' × 10+'],['גבישים / קוצי קרח',P.greens+' / '+P.reds],['תרגילים',P.tricks+(P.best?' · <bdi dir="ltr">'+P.best.name+'</bdi>':'')],['נפילות',String(P.wipes)],['ניקוד תרגילים ואיסוף','<b class="'+(P.money<0?'neg':'')+'">'+fmt(P.money)+'</b>'],['בונוס זמן','<b>'+fmt(tb)+'</b>']];
    $('#endRows').innerHTML=rows.map(r=>'<div><span>'+r[0]+'</span><span>'+r[1]+'</span></div>').join('');
    $('#endTotal').textContent=fmt(total)+(record?' ★':''); drawProfile(); renderMenuCards();
  }
  function drawProfile(){   // speed along the run
    const c=$('#profile'), g=c.getContext('2d'), W=c.width, H=c.height; g.clearRect(0,0,W,H);
    const hist=P.history.slice(); hist.push({s:Math.min(P.s,track.len),v:P.speed*3.6}); const mx=Math.max(20,...hist.map(h=>h.v||0)), X=s=>8+s/track.len*(W-16), Y=v=>H-22-(v/mx)*(H-44);
    g.strokeStyle='rgba(255,255,255,.12)'; g.lineWidth=1; for(let i=0;i<4;i++){ const y=Y(mx*i/3); g.beginPath(); g.moveTo(0,y); g.lineTo(W,y); g.stroke(); }
    const gr=g.createLinearGradient(0,0,0,H); gr.addColorStop(0,'rgba(80,200,255,.55)'); gr.addColorStop(1,'rgba(80,200,255,.02)');
    g.beginPath(); g.moveTo(X(hist[0].s),H-22); hist.forEach(h=>g.lineTo(X(h.s),Y(h.v||0))); g.lineTo(X(hist[hist.length-1].s),H-22); g.closePath(); g.fillStyle=gr; g.fill();
    g.beginPath(); hist.forEach((h,i)=>i?g.lineTo(X(h.s),Y(h.v||0)):g.moveTo(X(h.s),Y(h.v||0))); g.strokeStyle='#7fd8ff'; g.lineWidth=3; g.lineJoin='round'; g.stroke();
    g.fillStyle='rgba(255,255,255,.8)'; g.font='700 14px sans-serif'; g.textAlign='left'; g.fillText('מהירות מקסימלית '+Math.round(mx)+' קמ״ש',10,16); g.textAlign='right'; g.fillText('מרחק '+Math.round(track.len)+' מ׳',W-10,H-6);
  }

  /* ---------- radar ---------- */
  function drawRadar(){
    const g=rg, W=220, C=110, k=.85; g.clearRect(0,0,W,W); g.save(); g.beginPath(); g.arc(C,C,C-2,0,PI*2); g.clip();
    g.fillStyle='rgba(18,26,52,.82)'; g.fillRect(0,0,W,W);
    const dx=Math.sin(camHd), dz=-Math.cos(camHd), rx=Math.cos(camHd), rz=Math.sin(camHd);
    const map=(x,z)=>{ const ax=x-P.x, az=z-P.z, f=ax*dx+az*dz, r=ax*rx+az*rz; return [C+r*k,C-f*k+22]; };
    g.fillStyle='rgba(230,240,255,.14)'; g.beginPath(); let first=true; const edgeL=[],edgeR=[];
    for(let s=P.s-30;s<=P.s+150;s+=6){ if(s<0) continue; const c=World.cx(s), w=World.halfW(s); edgeL.push(map(c-w,-s)); edgeR.push(map(c+w,-s)); }
    edgeL.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); for(let i=edgeR.length-1;i>=0;i--) g.lineTo(edgeR[i][0],edgeR[i][1]); g.closePath(); g.fill();
    g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=2; [edgeL,edgeR].forEach(E=>{ g.beginPath(); E.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.stroke(); });
    // kickers
    World.forRamps(P.s-20,P.s+150,r=>{ if(r.s<P.s-20||r.s>P.s+150) return; const p=map(World.cx(r.s)+r.u,-r.s); g.fillStyle='#ffc83a'; g.fillRect(p[0]-7,p[1]-3,14,6); });
    if(ST.Park) ST.Park.radar(P.s,map,g);
    World.nearItems(P.s,it=>{ if(it.dead) return; const col=it.type==='green'?'#16e08a':it.type==='red'?'#ff3b57':it.type==='coin'?'#ffd34a':it.type==='rockhaz'?'#9aa3b8':null; if(!col) return; const p=map(it.x,it.z); if(Math.hypot(p[0]-C,p[1]-C)>C) return; g.fillStyle=col; g.beginPath(); g.arc(p[0],p[1],it.type==='coin'?2:3.5,0,PI*2); g.fill(); });
    const fp=map(World.cx(track.len),-track.len); g.fillStyle='#fff'; g.fillRect(fp[0]-18,fp[1]-2,36,4);
    g.restore(); g.fillStyle='#fff'; g.strokeStyle='#000'; g.lineWidth=2; g.beginPath(); g.moveTo(C,C-9+22); g.lineTo(C+8,C+9+22); g.lineTo(C,C+4+22); g.lineTo(C-8,C+9+22); g.closePath(); g.fill(); g.stroke();
  }

  /* ---------- menu ---------- */
  function renderRiders(){ const row=$('#riderRow'); row.innerHTML=Rider.choices.map((n,i)=>'<button data-i="'+i+'" class="'+(i===(save.rider||0)?'sel':'')+'">'+(Rider.isAsset(n)?ST.Assets.characters[n].label:(i+1))+'</button>').join('');
    row.querySelectorAll('button').forEach(b=>b.onclick=async()=>{ const i=+b.dataset.i; if(i===save.rider&&Rider.current===Rider.choices[i]) return; const st=$('#riderState'); st.textContent='טוענים…'; try{ await Rider.swap(Rider.choices[i]); save.rider=i; persist(); applyLook(); }catch(e){ console.warn(e); st.textContent='שגיאה'; setTimeout(()=>st.textContent='',1500); return; } st.textContent=''; renderRiders(); }); }
  function menuNote(t){ let n=document.getElementById('mnote'); if(!n){ n=document.createElement('div'); n.id='mnote'; document.body.appendChild(n); } n.textContent=t; n.className='show'; clearTimeout(menuNote.h); menuNote.h=setTimeout(()=>n.className='',2400); }
  function stars(n){ return '★'.repeat(n)+'☆'.repeat(3-n); }
  function unlocked(i){ if(i===0) return true; const prev=ST.TRACKS[i-1], b=save.best[prev.id]; return !!b&&b.stars>=2; }
  function renderMenuCards(){
    $('#walletN').textContent=fmt(save.wallet);
    ST.TrailMap.render($('#trailMap'),{tracks:ST.TRACKS,sel:trackIdx,best:save.best,unlocked},i=>{ if(!unlocked(i)){ menuNote('🔒 סיימו את '+ST.TRACKS[i-1].name+' עם 2 כוכבים כדי לפתוח'); return; } trackIdx=i; save.track=i; persist(); track=ST.TRACKS[i]; menuScene(); renderMenuCards(); });
    { const t=trackIdx>=0?ST.TRACKS[trackIdx]:track, b=save.best[t.id], drop=Math.round(t.len*t.slope*.92); $('#trackInfo').innerHTML='<div class="tn">'+t.en+'</div><span class="chip '+t.diff+'">'+t.diffName+'</span><div class="tb">'+t.blurb+'</div><div class="facts"><span>אורך<b>'+t.len+' מ׳</b></span><span>ירידה<b>'+drop+' מ׳</b></span><span>יעד ניקוד<b>'+fmt(t.goals[0])+'</b></span><span>שיא<b>'+(b?fmt(b.profit):'—')+'</b></span></div>'; }
    renderRiders();
    $('#boardCards').innerHTML=Rider.BOARDS.map((b,i)=>{ const own=save.owned.includes(i); return '<div class="card'+(i===save.board?' sel':'')+'" data-b="'+i+'"><div class="sw" style="background:linear-gradient(90deg,'+b.top[0]+','+b.top[1]+')"></div><div class="nm">'+b.name+'</div><div class="meta"><span>'+(own?(i===save.board?'נבחר':'שלכם'):'לרכישה')+'</span>'+(own?'':'<span class="px">'+fmt(b.price)+'</span>')+'</div></div>'; }).join('');
        document.querySelectorAll('#boardCards .card').forEach(c=>c.onclick=()=>{ const i=+c.dataset.b, b=Rider.BOARDS[i]; if(!save.owned.includes(i)){ if(save.wallet<b.price){ c.animate([{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'none'}],{duration:220}); return; } save.wallet-=b.price; save.owned.push(i); }
      save.board=i; persist(); Rider.setBoard(i); renderMenuCards(); });
  }
  function menuScene(){ resetPlayer(); P.hd=0; ST.Physics.contact(P.x,P.z,P.hd,P.gc); P.y=P.gc.yC; mode='menu'; }
  function toMenu(){ mode='menu'; el.hud.hidden=true; el.end.hidden=true; el.pause.hidden=true; el.menu.hidden=false; Audio.music(false); menuScene(); renderMenuCards(); gr('uDesat',0); }
  function togglePause(){ if(mode==='play'){ mode='pause'; el.pause.hidden=false; } else if(mode==='pause'){ mode='play'; el.pause.hidden=true; last=performance.now(); } }
  $('#playBtn').onclick=startRun; $('#againBtn').onclick=startRun; $('#menuBtn').onclick=toMenu; $('#pause').onclick=togglePause; $('#resumeBtn').onclick=togglePause; $('#restartBtn').onclick=startRun; $('#quitBtn').onclick=toMenu;
  $('#mute').onclick=()=>{ save.muted=!save.muted; Audio.setMuted(save.muted); $('#mute').textContent=save.muted?'🔇':'🔊'; persist(); };
  $('#mute').textContent=save.muted?'🔇':'🔊';
  /* control scheme: buttons (default) or the joystick; the short how-to follows it */
  const HOWTO={buttons:['◀ ▶ פנייה (החזיקו = קארב חזק יותר) · באמצע = בלימה','קפיצה: החזיקו לטעינה ושחררו · מהירות: כפיפה','באוויר: סיבוב · תפיסה (כל תפיסה נוספת = תפיסה אחרת) · סלטה','מעקה: ◀ ▶ לאיזון · מהירות = לחיצה על האף','⌨️ חיצים · רווח · Shift · C מצלמה · H בלי ממשק'],
    joy:['🕹️ גררו לפנייה · למטה בלימה · למעלה כפיפה','⬆️ החזיקו קפיצה ושחררו','🌀 באוויר: סיבוב, סלטה, תפיסה + כיוון','🛹 מעקה וקופסה: גררו לאיזון · תפיסה + קדימה = לחיצה','⌨️ C מצלמה · H בלי ממשק · R מחדש']};
  function applyCtl(){ const joy=save.ctl==='joy'; document.body.classList.toggle('ctl-joy',joy); $('#ctlBtn').textContent=joy?'שליטה: ג׳ויסטיק ⇄ כפתורים':'שליטה: כפתורים ⇄ ג׳ויסטיק';
    $('#howtoTxt').innerHTML=HOWTO[joy?'joy':'buttons'].map(t=>'<span>'+t+'</span>').join(''); $('#btnGrab').querySelector('.g').textContent=joy?'תפיסה':'מהירות'; }
  $('#ctlBtn').onclick=()=>{ save.ctl=save.ctl==='joy'?'buttons':'joy'; persist(); applyCtl(); }; applyCtl();

  /* ---------- main loop ---------- */
  let last=performance.now(), frame=0, tAcc=0;
  function loop(now){
    requestAnimationFrame(loop);
    const raw=(now-last)/1000, dt=Math.min(.1,raw); last=now;
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
    if(mode==='countdown'){ countdown-=dt; const n=Math.ceil(countdown-.3); if(n!==lastCd){ lastCd=n; if(n>0){ bigText(String(n)); Audio.coin(n===1?4:0); } else { bigText('GO','gold'); Audio.green(); mode='play'; P.autoSkate=1.5; P.vx=Math.sin(P.hd)*.8; P.vz=-Math.cos(P.hd)*.8; subtitle(useJoy()?'גררו לפנייה · החזיקו קפיצה ושחררו · משכו למטה לבלימה':'◀ ▶ פנייה · החזיקו קפיצה ושחררו · באוויר: סיבוב ותפיסה',3800); } }
      updateRider(dt,true); updateCamera(dt); }
    else if(mode==='play'||mode==='finish'){
      if(mode==='finish') P.fin+=dt;
      dt*=stepTimeScale(dt);
      runPhysics(dt);
      // equity history
      if(P.s>=P.histS+8){ P.histS=P.s; P.history.push({s:P.s,m:P.money,v:P.speed*3.6}); }
      updateRider(dt,false); updateCamera(dt);
      const BT=!useJoy();   // tips follow the control scheme
      if(P.s<60) tip('steer',BT?'◀ ▶ לפנייה (החזיקו לקארב חזק) · אגודל באמצע = בלימה · מהירות = כפיפה':'גררו ימינה ושמאלה כדי לפנות · למטה = בלימה בהחלקה · למעלה = כפיפה למהירות',5200);
      { let rr=null; World.forRamps(P.s,P.s+45,r=>{ if(P.s>r.s-45&&P.s<r.s) rr=r; }); if(rr){ tip('ramp','החזיקו קפיצה כדי לטעון, ושחררו ממש בקצה הקיקר לקפיצה מושלמת',5200); } }
      // the park: how to ride what is coming up
      if(ST.Park&&ST.Park.rails.length){
        if(ST.Park.rails.some(r=>r.sA-P.s>4&&r.sA-P.s<40)) tip('jib','מעקה או קופסה לפניכם: עלו ישר על הרמפה · '+(BT?'◀ ▶':'גררו')+' נגד המחוג כדי לשמור על איזון · קפצו וסובבו רבע סיבוב לבורדסלייד',6000);
        if(ST.Park.pipes.some(pp=>pp.s0-P.s>0&&pp.s0-P.s<45)) tip('pipe','חצי צינור: גלשו אל הקיר באלכסון כדי לעוף מעל השפה · סיבוב באוויר = 180',6000);
        if(P.s>40&&P.speed>4) tip('press',BT?'באוויר: סיבוב + תפיסה, ולחיצה נוספת על תפיסה = תפיסה אחרת · על מעקה: מהירות = לחיצה על האף':'על השלג: תפיסה + קדימה = לחיצה על האף (אחורה = הזנב) · היגוי תוך כדי = באטר עם סיבוב',6000); }
    }
    ST.Resort.update(tAcc,P.s); updateSpray(dt); World.update(P.s); World.follow({x:P.x,y:P.y,z:P.z},tAcc);
    World.updateFlakes(tAcc,camera.position,{x:P.vx,y:0,z:P.vz});
    ST.renderer.getPixelRatio(); spMat.uniforms.px.value=ST.renderer.getPixelRatio()*innerHeight/900; World.flakes.material.uniforms.px.value=ST.renderer.getPixelRatio()*innerHeight/900;
    // HUD
    P.shown+=(P.money-P.shown)*Math.min(1,dt*7); el.money.textContent=fmt(P.shown); el.money.classList.toggle('neg',P.shown<0);
    el.spd.textContent=Math.round((P.speed3||P.speed)*3.6); const pg=clamp(P.s/track.len,0,1); el.prog.style.width=(pg*100)+'%'; el.progTxt.textContent=Math.max(0,Math.round(track.len-P.s))+' מ׳ לסיום';
    const m=mult(); el.combo.hidden=P.combo<1; if(P.combo>0){ el.comboX.textContent='x'+m; el.comboBar.style.transform='scaleX('+clamp(P.comboT/6,0,1)+')'; }
    { const vk=P.speed/(track.vref||24); el.speedfx.style.opacity=clamp((vk-.9)/.5,0,1)*.85; }
    if(frame%2===0) drawRadar(); el.radarTxt.textContent=Math.round(P.s)+' / '+track.len;
    if(subT>0){ subT-=dt*1000; if(subT<=0) el.sub.style.opacity=0; }
    el.hud.classList.toggle('air',airborne()&&!useJoy()); jumpHint(); coinFade(); balanceHud(); if(!P.grind&&balEl.classList.contains('on')) balEl.classList.remove('on');
    if(flashK>0){ flashK=Math.max(0,flashK-dt*1.8); el.flash.style.opacity=flashK; }
    gr('uSpeed',clamp((P.speed/(track.vref||24)-.85)/.6,0,1)); if(P.fall&&P.fall.ph!=='recover'&&P.fall.ph!=='getup') gr('uDesat',damp(ST.GFX.grade?ST.GFX.grade.uniforms.uDesat.value:0,.85,6,dt)); else if(ST.GFX.grade&&ST.GFX.grade.uniforms.uDesat.value>0) gr('uDesat',damp(ST.GFX.grade.uniforms.uDesat.value,0,5,dt));
    Audio.update(P.speed*(24/(track.vref||24)),P.grind?0:Math.abs(P.lean)+P.tuck*.5,!P.grounded); Audio.grind(P.grind&&mode==='play'?clamp(P.grind.v/7,.25,1):0,P.grind?P.grind.r.kind:''); Audio.spin(!P.grounded&&mode==='play'?P.wsp:0,P.sp||0);
  }

  /* ---------- boot ---------- */
  async function boot(){
    const bar=$('#loadbar'), txt=$('#loadtxt'); const set=(p,t)=>{ bar.style.width=p+'%'; if(t) txt.textContent=t; };
    set(10,'בונים את ההר…'); ST.onResize(); ST.qApply(ST.Q.lv); await World.loadAssets();
    const qt=new URLSearchParams(location.search).get('track'); const qi=ST.TRACKS.findIndex(t=>t.id===qt); if(qi>=0) save.track=qi; else if(!(save.track>=0&&save.track<ST.TRACKS.length)||!unlocked(save.track)) save.track=0; track=ST.TRACKS[save.track]; trackIdx=ST.TRACKS.indexOf(track);
    if(qt==='lab'&&ST.LAB){ track=ST.LAB; trackIdx=-1; }          // the hidden test slope (not on the trail map, not saved)
    World.setTrack(track); await World.ensureSky(track); set(35,'מלבישים את הרוכב…');
    try{ await Rider.load(false); }catch(e){ console.error('rider',e); txt.textContent='שגיאה בטעינת הרוכב'; return; }
    set(80,'מחממים את הלוח…'); Rider.setBoard(save.board); applyLook(); World.update(0,true); Audio.setMuted(save.muted); if(!(save.rider>=0&&save.rider<Rider.choices.length)) save.rider=Math.max(0,Rider.choices.indexOf('meshy_rider')); if(save.rider>0&&Rider.choices[save.rider]){ Rider.preload(Rider.choices[save.rider]).then(()=>Rider.swap(Rider.choices[save.rider])).then(()=>applyLook()).catch(e=>console.warn('rider',e)); }
    set(100); await new Promise(r=>setTimeout(r,250));
    $('#loading').remove(); mode='menu'; toMenu(); P.t=0; ST.People.preload(5);
    const q=new URLSearchParams(location.search); if(q.get('auto')==='1'){ startRun(); }
    window.READY=true; requestAnimationFrame(loop);
  }
  const isPortraitPhone=()=>innerHeight>innerWidth&&innerWidth<700; const rot=$('#rotate'); const chkRot=()=>{ rot.hidden=!isPortraitPhone()||false; }; // portrait still playable; hint only
  rot.hidden=true; addEventListener('resize',joyHome);
  ST.debug={P,setTrack:id=>{ const i=ST.TRACKS.findIndex(t=>t.id===id); if(i>=0){ trackIdx=i; track=ST.TRACKS[i]; } else if(id==='lab'){ trackIdx=-1; track=ST.LAB; } menuScene(); },cycleCam,get camMode(){ return CAMS[camMode]; },tick,startRun,startLift,beginCountdown,endLift,showResults,finishRun,get mode(){return mode;},setMode:m=>mode=m,track:()=>track,toMenu,input,ctl,stateName,runPhysics,camera:()=>({hd:camHd})};
  boot();
})(window.ST);
