/* Surf Rush: wave surfing — the surfer on the board, on the moving face of a breaking wave (the waves: js/coast.js).
   The board is pushed by gravity down the slope of the water it is on, and dragged by the water around it, which is not still:
   under a wave it moves shoreward (all of it in the whitewater). Along its length the board slides and planes; across it the
   rail holds. So a board pointed along the face is carried with the wave while it angles a little down it, a board pointed
   straight down runs to the bottom, and one pointed up climbs toward the lip and slows; that is all trimming, bottom turns
   and top turns are. Lying down, the surfer paddles (a slow board that slides sideways easily); when a wave's face picks the
   board up fast enough, the surfer pops to the feet. Going fast up the face, the lip throws the board into the air (or the
   surfer ollies off it). The whitewater knocks a standing surfer off; so does being on the lip when it pitches, or a nose
   that digs in on a steep drop. When the wave has gone under the board, or runs out on the shoulder or the sand, the ride
   is over. The numbers are in SF.C. */
(function(ST){
  const {clamp,lerp,damp,smooth}=ST; const {scene,camera}=ST; const PI=Math.PI, TAU=2*PI, DEG=PI/180, G=9.81, Cst=ST.Coast;
  const SF={}; const MASS=75;
  const C=SF.C={
    paddle:150, paddleV:2.6,        // N, lying down and paddling, less as the board goes faster (about 2 m/s flat out)
    idleDrag:170,                   // lying still, legs in the water: a wave lifts the board and goes on under it
    proneGrip:90, proneGripV:10,    // a board with a body on it slides sideways easily (N per m/s)
    c1slow:65, c1plan:6, c2:2.6,    // drag along the board: N per m/s sinking and planing, N per (m/s)²
    plan0:1.8, plan1:3.6,           // planing comes in between these speeds through the water (m/s)
    grip:240, gripV:32,             // the rail across the board, standing (N per m/s, more at speed)
    turn0:1.0, turnV:.22, turnMax:3.2, proneTurn:1.3,   // rad/s
    pump:110,                       // N, pumping the board on the face
    pop:.42, popMin:2.6,            // seconds to stand up; m/s the board must already have (the wave has it)
    lipV:2.4,                       // m/s up the face at the lip that throws the board into the air
    ollie:2.2,                      // m/s of pop off the lip with the jump button
    spinW:6.5,                      // rad/s
    landYaw:.7, landImp:9, landAlong:.45   // a clean landing (on a face that falls away: harder impacts are fine)
  };
  const S={x:0,z:0,y:0,vx:0,vz:0,vy:0,h:0,ph:'wait',phT:0,t:0,speed:0,edge:0,lean:0,pump:0,spin:0,wsp:0,grab:0,grabbed:false,grabName:'',grabs:[],
    vys:0,wave:null,waveI:-1,f:0,face:null,air:false,airT:0,jump:null,land:0,landImp:0,yawRes:0,tube:0,prevJump:false,prevGrab:false,why:''};
  SF.S=S; SF.events=[]; const ev=e=>SF.events.push(e);
  const _w={}, _w2={};
  /* lying on the board at (x,z), facing heading h, waiting for a wave */
  SF.reset=function(at){ Object.assign(S,{x:at.x,z:at.z,vx:0,vz:0,vy:0,h:at.h||0,ph:'wait',phT:0,speed:0,edge:0,lean:0,pump:0,spin:0,wsp:0,grab:0,grabbed:false,grabName:'',grabs:[],
      vys:0,wave:null,waveI:-1,f:0,face:null,air:false,airT:0,jump:null,land:0,landImp:0,yawRes:0,tube:0,prevJump:false,prevGrab:false,why:''});
    Cst.water(S.x,S.z,null,_w); S.y=_w.y; SF.events.length=0; };
  function setPh(p,why){ S.ph=p; S.phT=0; if(why) S.why=why; }
  function wipe(why){ setPh('wipe',why); S.air=false; S.grabbed=false; S.spin=0; S.wsp=0; ev({type:'wipe',why}); }
  const GRABS=['RAIL','TAIL','NOSE','STALE'];
  function assist(a,w){ const n=a/TAU; if(w>.5){ const t=Math.ceil(n-.02)*TAU; return t-a<.6*TAU?t:Math.floor(n)*TAU; } if(w<-.5){ const t=Math.floor(n+.02)*TAU; return a-t<.6*TAU?t:Math.ceil(n)*TAU; } return Math.round(n)*TAU; }
  /* one physics step; c = {steer -1..1 (+ = right), paddle (held), pop (pressed: stand up / ollie), pump (held), spin (held, air), spinDir, grab (held, air)} */
  SF.step=function(dt,c){ S.t+=dt; S.phT+=dt; S.yawRes=damp(S.yawRes,0,9,dt);
    const W=Cst.water(S.x,S.z,null,_w); S.face=W.sw;
    if(S.ph==='wipe'||S.ph==='out'){
      // in the water: carried by it (the whitewater rolls the surfer in), slowly
      S.vx=damp(S.vx,W.ux*.8,2,dt); S.vz=damp(S.vz,W.uz*.8,2,dt); S.x+=S.vx*dt; S.z+=S.vz*dt; S.y=W.y-(S.ph==='wipe'?.45:.15); S.speed=Math.hypot(S.vx,S.vz);
      S.prevJump=c.pop; S.prevGrab=c.grab; return; }
    if(S.ph==='air') return airStep(dt,c);
    const prone=S.ph==='wait'||S.ph==='paddle'||S.ph==='pop', fx=Math.sin(S.h), fz=Math.cos(S.h), lx=fz, lz=-fx;
    // steering: lying down the arms turn the board; standing, it carves (sharper at speed)
    const sp0=Math.hypot(S.vx-W.ux,S.vz-W.uz);
    if(S.ph!=='pop') S.h-=c.steer*(prone?C.proneTurn:clamp(C.turn0+C.turnV*sp0,C.turn0,C.turnMax))*dt;
    // through the water: along the board it planes, across it the rail (or the lying body) holds
    const rvx=S.vx-W.ux, rvz=S.vz-W.uz, vf=rvx*fx+rvz*fz, vl=rvx*lx+rvz*lz;
    const plan=smooth(C.plan0,C.plan1,Math.abs(vf)), c1=S.ph==='wait'?C.idleDrag:lerp(C.c1slow,C.c1plan,plan), kl=prone?C.proneGrip+C.proneGripV*Math.min(Math.abs(vf),6):C.grip+C.gripV*Math.min(Math.abs(vf),10);
    let ax=-(c1+C.c2*Math.abs(vf))*vf/MASS*fx-kl*vl/MASS*lx, az=-(c1+C.c2*Math.abs(vf))*vf/MASS*fz-kl*vl/MASS*lz;
    // gravity down the slope of the water (on a steep face the surface takes some of it)
    const s2=W.nx*W.nx+W.nz*W.nz, gk=G/(1+s2); ax+=W.nx*gk; az+=W.nz*gk;
    // the surfer's own push: paddling lying down, pumping standing on a face
    if(prone&&S.ph!=='pop'&&c.paddle){ const th=C.paddle*Math.max(0,1-vf/C.paddleV); ax+=th/MASS*fx; az+=th/MASS*fz; if(S.ph==='wait') setPh('paddle'); } else if(S.ph==='paddle'&&!c.paddle) setPh('wait');   // arms push no faster than they move
    S.pump=damp(S.pump,!prone&&c.pump?1:0,6,dt); if(!prone&&c.pump){ const onFace=smooth(.08,.3,Math.sqrt(s2)); ax+=C.pump/MASS*onFace*fx; az+=C.pump/MASS*onFace*fz; }
    S.vx+=ax*dt; S.vz+=az*dt; S.x+=S.vx*dt; S.z+=S.vz*dt;
    // on the surface: how fast it carries the board up or down; off the lip into the air
    const W2=Cst.water(S.x,S.z,null,_w2), vys=(W2.y-S.y)/dt, ys0=S.y; S.y=W2.y;
    S.speed=Math.hypot(S.vx,S.vz); const sw=W2.sw; S.face=sw; S.f=sw&&sw.Hu>.1?clamp(sw.y/sw.Hu,0,1.2):0;
    const popNow=c.pop&&!S.prevJump;
    const climbing=sw&&(S.vx-W2.ux)*sw.nx+(S.vz-W2.uz)*sw.nz<-.5;   // going up the face through the water (not dropping down it)
    if(S.ph==='ride'&&sw&&sw.u>-1.2&&sw.u<1.5&&(climbing&&S.vys>C.lipV&&vys<S.vys-C.lipV*.8||popNow&&S.f>.55)){
      // the lip throws the board with it: shoreward as fast as the water there (so it comes down on the wave, not behind it)
      const vIn=S.vx*sw.nx+S.vz*sw.nz, want=Math.hypot(W2.ux,W2.uz)*.95; if(vIn<want){ S.vx+=(want-vIn)*.85*sw.nx; S.vz+=(want-vIn)*.85*sw.nz; }
      takeoff(ys0,Math.max(S.vys,0)+(popNow?C.ollie:0)); S.prevJump=c.pop; S.prevGrab=c.grab; return; }
    S.vys=vys;
    // standing up: when the wave has the board; a dig-in on a steep drop, or the whitewater, knocks the surfer off
    if(prone&&S.ph!=='pop'&&popNow&&S.speed>C.popMin){ setPh('pop'); S.wave=sw?sw.w:null; S.waveI=sw?sw.w.i:-1; ev({type:'pop'}); }
    else if(S.ph==='pop'&&S.phT>=C.pop){ const down=-(W2.nx*fx+W2.nz*fz);   // the slope along the board (+ = the nose points downhill)
      if(down>.95) wipe('pearl'); else if(W2.brk>.5) wipe('whitewater'); else { setPh('ride'); ev({type:'ride'}); } }
    else if(S.ph==='ride'){
      if(W2.brk>.5) wipe('whitewater');
      else if(sw&&sw.qa<1.2&&sw.qa>-2&&S.f>.72&&sw.u<.5) wipe('lip');        // on the lip as it pitches: over the falls
      else if(W2.depth<1.1||sw&&sw.w.off<22) end('kick');   // the wave dies in the shallows: the surfer kicks out
      else if(!sw||sw.u>9||sw.Hu<.35) end(sw&&sw.u>9?'over':'flat'); }
    else if(prone&&W2.brk>.6&&S.ph!=='pop') wipe('caught inside');
    // the rail in the water and the lean into a carve
    const turn=prone?0:c.steer*clamp(sp0/6,0,1); S.edge=damp(S.edge,prone?0:clamp(turn*.55,-.6,.6),8,dt); S.lean=damp(S.lean,S.edge*1.15,6,dt);
    S.tube=S.ph==='ride'&&sw&&sw.qa>0&&sw.qa<4.5&&sw.k>.75&&S.f<.7?Math.min(1,S.tube+dt*3):Math.max(0,S.tube-dt*3);
    S.prevJump=c.pop; S.prevGrab=c.grab; if(S.land>0) S.land-=dt; };
  function end(why){ setPh('out',why); ev({type:'end',why}); }
  function takeoff(y0,vy){ setPh('air'); S.air=true; S.airT=0; S.vy=vy; S.spin=0; S.wsp=0; S.grabs=[]; S.grabbed=false; S.jump={y0,maxY:y0,t0:S.t}; ev({type:'air',vy:+vy.toFixed(1)}); }
  function airStep(dt,c){ S.airT+=dt;
    // the surfer brings the board round in the air to point where it is going, ready to land on the face (not while spinning)
    if(!c.spin&&Math.abs(S.wsp)<1){ const d=Math.atan2(Math.sin(Math.atan2(S.vx,S.vz)-S.h),Math.cos(Math.atan2(S.vx,S.vz)-S.h)); S.h+=clamp(d,-2.6*dt,2.6*dt); }
    S.vy-=G*dt; S.vx-=S.vx*.04*dt; S.vz-=S.vz*.04*dt; S.x+=S.vx*dt; S.z+=S.vz*dt; S.y+=S.vy*dt; if(S.jump) S.jump.maxY=Math.max(S.jump.maxY,S.y);
    if(c.spin) S.wsp=damp(S.wsp,(c.spinDir||1)*C.spinW,6,dt); else { const t=assist(S.spin,S.wsp); S.wsp=damp(S.wsp,clamp((t-S.spin)*6,-C.spinW,C.spinW),5,dt); }
    S.spin+=S.wsp*dt;
    if(c.grab&&!S.prevGrab){ S.grabbed=true; const n=GRABS[S.grabs.length%GRABS.length]; S.grabName=n; if(!S.grabs.includes(n)) S.grabs.push(n); }
    if(!c.grab) S.grabbed=false; S.grab=damp(S.grab,S.grabbed?1:0,10,dt);
    const W=Cst.water(S.x,S.z,null,_w2); S.face=W.sw; S.speed=Math.hypot(S.vx,S.vz);
    if(S.y<=W.y&&S.vy<W.vy) land(W);
    S.prevJump=c.pop; S.prevGrab=c.grab; }
  function land(W){ const J=S.jump||{y0:S.y,maxY:S.y,t0:S.t}, h=Math.max(0,J.maxY-J.y0), turns=Math.round(S.spin/TAU), yawErr=Math.abs(S.spin-turns*TAU), imp=W.vy-S.vy;
    const rvx=S.vx-W.ux, rvz=S.vz-W.uz, rs=Math.hypot(rvx,rvz), along=rs>.5?(Math.sin(S.h)*rvx+Math.cos(S.h)*rvz)/rs:1;
    const clean=yawErr<C.landYaw&&imp<C.landImp&&along>C.landAlong&&W.brk<.5;
    S.air=false; S.y=W.y; S.vy=0; S.vys=W.vy; S.land=.4; S.landImp=imp; S.yawRes=S.spin-turns*TAU; S.spin=0; S.wsp=0; S.grab=0; S.grabbed=false; S.jump=null;
    const out={type:'land',h:+h.toFixed(2),air:+(S.t-J.t0).toFixed(2),turns:Math.abs(turns),grabs:S.grabs.slice(),clean,imp:+imp.toFixed(1)};
    if(clean) setPh('ride'); else { S.yawRes=0; wipe(yawErr>=C.landYaw?'sideways':imp>=C.landImp?'too hard':W.brk>=.5?'whitewater':'off the line'); }
    ev(out); }
  /* ---------- the surfboard: a 6'2" shortboard (1.9 m, 52 cm wide), pointed nose, squash tail, rocker, three fins ----------
     Laid out like the snowboard (along Z, its deck at the feet), its nose toward -Z; the middle of the board sits forward of the
     feet so the back foot is on the tail pad. */
  function makeBoard(col){ const L=1.9, N=48, grp=new THREE.Group(), inner=new THREE.Group(); grp.add(inner);
    const HW=[[0,.165],[.08,.2],[.25,.245],[.45,.262],[.62,.25],[.78,.2],[.9,.13],[.97,.06],[1,0]];   // half widths from the tail (0) to the nose (1)
    const hw=t=>{ for(let i=1;i<HW.length;i++){ if(t<=HW[i][0]){ const a=HW[i-1], b=HW[i], u=(t-a[0])/(b[0]-a[0]); return lerp(a[1],b[1],u*u*(3-2*u)); } } return 0; };
    const zOf=t=>L/2-t*L, rock=t=>t<.3?.05*Math.pow(1-t/.3,2):t>.55?.14*Math.pow((t-.55)/.45,2):0;
    const sh=new THREE.Shape(); for(let i=0;i<=N;i++){ const t=i/N; const z=zOf(t); i?sh.lineTo(hw(t),-z):sh.moveTo(hw(t),-z); } for(let i=N;i>=0;i--){ const t=i/N; sh.lineTo(-hw(t),-zOf(t)); }
    const geo=new THREE.ExtrudeGeometry(sh,{depth:.055,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:2,curveSegments:6}); geo.rotateX(-PI/2);
    const pa=geo.attributes.position; for(let i=0;i<pa.count;i++){ const z=pa.getZ(i), t=clamp((L/2-z)/L,0,1); pa.setY(i,pa.getY(i)*(.55+.45*Math.sin(PI*clamp(t,.02,.98)))+rock(t)+.012); } geo.computeVertexNormals();
    // the deck: a gradient, the stringer, a tail pad, the name
    const cv=document.createElement('canvas'); cv.width=128; cv.height=512; const g=cv.getContext('2d'); const gr=g.createLinearGradient(0,0,0,512); gr.addColorStop(0,col[0]); gr.addColorStop(.55,col[1]); gr.addColorStop(1,col[2]||col[1]);
    g.fillStyle=gr; g.fillRect(0,0,128,512); g.fillStyle='rgba(60,40,20,.55)'; g.fillRect(62,0,4,512);
    g.fillStyle='#1d1f24'; g.fillRect(14,420,100,80); g.fillStyle='rgba(255,255,255,.12)'; for(let y=426;y<496;y+=9) g.fillRect(18,y,92,3);
    g.save(); g.translate(64,190); g.rotate(-PI/2); g.fillStyle='rgba(255,255,255,.85)'; g.font='bold 34px Anton, Impact'; g.textAlign='center'; g.fillText('SURF RUSH',0,12); g.restore();
    const tex=new THREE.CanvasTexture(cv); tex.encoding=THREE.sRGBEncoding; const uv=new Float32Array(pa.count*2); for(let i=0;i<pa.count;i++){ uv[i*2]=pa.getX(i)/.56+.5; uv[i*2+1]=(L/2-pa.getZ(i))/L; } geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    const deck=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:tex,roughness:.3,metalness:.02})); deck.castShadow=true; inner.add(deck);
    const finM=new THREE.MeshStandardMaterial({color:0x22262e,roughness:.4}); [[-.13,.78,.1],[.13,.78,.1],[0,.86,.12]].forEach(([x,z,h])=>{ const f=new THREE.Mesh(new THREE.BoxGeometry(.008,h,.11),finM); f.position.set(x,.012-h/2+rock(clamp((L/2-z)/L,0,1)),z); f.rotation.y=x*.6; inner.add(f); });
    grp.userData.surfboard=1; grp.userData.inner=inner; return grp; }
  SF.makeBoard=makeBoard;
  SF.BOARDS=[{name:'Classic',col:['#fffdf5','#f4efe1','#e8dfc8']},{name:'Sunburst',col:['#ffd166','#ff7b54','#ef476f']},{name:'Lagoon',col:['#e0fbfc','#5ce1e6','#118ab2']},{name:'Night',col:['#3a3f58','#22223b','#0b0b14']}];
  /* the stance: goofy (right foot forward) rides this left-hand wave facing it */
  SF.stance={goofy:true};
  function placeBoard(b){ const g=SF.stance.goofy, inner=b.userData.inner; inner.rotation.y=g?PI:0; inner.position.z=g?.3:-.3; }
  SF.placeBoard=placeBoard;
  /* ---------- spray: off the rail in a turn, from the lip where the wave pitches, bursts on a wipeout ---------- */
  const SPN=520, sp={pos:new Float32Array(SPN*3),vel:new Float32Array(SPN*3),life:new Float32Array(SPN),max:new Float32Array(SPN),size:new Float32Array(SPN),i:0};
  const spGeo=new THREE.BufferGeometry(); spGeo.setAttribute('position',new THREE.BufferAttribute(sp.pos,3)); spGeo.setAttribute('aLife',new THREE.BufferAttribute(sp.life,1)); spGeo.setAttribute('aMax',new THREE.BufferAttribute(sp.max,1)); spGeo.setAttribute('aSize',new THREE.BufferAttribute(sp.size,1));
  const spMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{px:{value:1}},vertexShader:'attribute float aLife; attribute float aMax; attribute float aSize; uniform float px; varying float vA; void main(){ vA=aMax>0.?clamp(aLife/aMax,0.,1.):0.; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=aSize*px*(1.4-vA*.6)*300./max(1.,-mv.z); }',
    fragmentShader:'varying float vA; void main(){ vec2 d=gl_PointCoord-.5; float r=length(d); if(r>.5) discard; gl_FragColor=vec4(vec3(.95,.98,1.),smoothstep(.5,.15,r)*vA*.85); }'});
  const spPts=new THREE.Points(spGeo,spMat); spPts.frustumCulled=false;
  function emit(x,y,z,vx,vy,vz,size,life){ const i=sp.i; sp.i=(sp.i+1)%SPN; sp.pos[i*3]=x; sp.pos[i*3+1]=y; sp.pos[i*3+2]=z; sp.vel[i*3]=vx; sp.vel[i*3+1]=vy; sp.vel[i*3+2]=vz; sp.life[i]=life; sp.max[i]=life; sp.size[i]=size; }
  function updateSpray(dt){ for(let i=0;i<SPN;i++){ if(sp.life[i]<=0) continue; sp.life[i]-=dt; sp.vel[i*3+1]-=9*dt; for(let k=0;k<3;k++) sp.pos[i*3+k]+=sp.vel[i*3+k]*dt; }
    spGeo.attributes.position.needsUpdate=true; spGeo.attributes.aLife.needsUpdate=true; spGeo.attributes.aMax.needsUpdate=true; spGeo.attributes.aSize.needsUpdate=true; spMat.uniforms.px.value=ST.renderer.getPixelRatio()*innerHeight/900; }
  SF.splash=function(x,y,z,n,k){ for(let i=0;i<n;i++){ const a=Math.random()*PI*2, s=1+Math.random()*3.5*k; emit(x+Math.cos(a)*.5,y+.1,z+Math.sin(a)*.5,Math.cos(a)*s,2+Math.random()*4*k,Math.sin(a)*s,.25+Math.random()*.35,.5+Math.random()*.7); } };
  const grp=new THREE.Group(); grp.name='surf'; grp.add(spPts); SF.group=grp; let built=false;
  SF.build=function(){ if(built) return; built=true; scene.add(grp); grp.visible=false; };
  SF.show=function(on){ grp.visible=on; };
  /* ---------- every frame: the board on the water, the surfer's pose, spray ---------- */
  const _n=new THREE.Vector3(), _q=new THREE.Quaternion(), _y=new THREE.Vector3(0,1,0), _wv={};
  let stroke=0;
  SF.visuals=function(dt,R){ const prone=S.ph==='wait'||S.ph==='paddle'||S.ph==='pop'&&S.phT<C.pop*.55, goofy=SF.stance.goofy, dir=goofy?-1:1;
    const W=Cst.water(S.x,S.z,null,_wv), fx=Math.sin(S.h), fz=Math.cos(S.h);
    const sink=S.ph==='wipe'?-.5:S.air?0:prone?lerp(-.07,-.02,smooth(1,4,S.speed)):lerp(-.1,-.02,smooth(1.5,5,S.speed));
    R.root.position.set(S.x,S.y+sink,S.z); const yaw=Math.atan2(-fx,-fz); R.root.rotation.set(0,yaw,0);
    // the board on the surface (its slope, into the root's frame), the rail into a turn
    _n.set(W.nx,1,W.nz).normalize().applyAxisAngle(_y,-yaw); _q.setFromUnitVectors(_y,S.air?_y:_n); R.tilt.quaternion.slerp(_q,1-Math.exp(-dt*(S.air?4:14))); R.tilt.position.set(0,0,0);
    const e=S.edge, hw=.24; R.rollG.rotation.z=-e; R.rollG.position.set(Math.sign(e)*hw*(1-Math.cos(e)),hw*Math.abs(Math.sin(e)),0);
    R.trick.rotation.order='YXZ'; R.trick.rotation.y=(goofy?PI:0)-(S.spin+S.yawRes); R.trick.rotation.x=0; R.trick.rotation.z=0;
    const p=R.P; p.t=S.t; p.menu=false; p.dir=dir;
    if(prone){ stroke+=dt*(S.ph==='paddle'?1.15:0); p.prone=1; p.noseZ=goofy?1:-1; p.paddle=damp(p.paddle||0,S.ph==='paddle'?1:0,6,dt); p.stroke=stroke; p.deck=.075; p.handsTo=null; R.pose({}); R.root.visible=true; updateSpray(dt); return; }
    p.prone=0; p.sit=0; p.handsTo=null;
    const pump=S.pump*Math.sin(S.t*7.5);
    p.crouch=damp(p.crouch,S.ph==='wipe'?.2:clamp(.42+S.pump*.18+pump*.12+(S.land>0?.3:0)+(S.ph==='pop'?.45:0)+S.tube*.35,0,1),8,dt);
    p.charge=0; p.tuck=damp(p.tuck,S.air?(S.grabbed?.55:.3):S.tube*.6,9,dt); p.air=damp(p.air,S.air?1:0,12,dt); p.grab=damp(p.grab,S.grab,12,dt); if(S.grabbed) p.grabName=S.grabName==='RAIL'?'INDY':S.grabName;
    p.spinW=S.air?S.wsp:0; p.flipW=0; p.body=S.lean; p.edge=S.edge; p.fa=pump*.12; p.om=0; p.slip=0; p.speed=S.speed; p.brake=0; p.skid=0;
    p.absorb=damp(p.absorb,S.land>0?clamp(S.landImp/6,0,1):0,16,dt); p.ext=0; p.rough=0; p.press=0; p.jib=0; p.bal=0; p.windup=0; p.spinA=S.air?S.spin:0; p.wobble=0; p.skate=0; p.popKind=''; p.popT=9; p.airT=S.airT;
    const wiped=S.ph==='wipe'; p.ground=wiped?1:0; p.getup=0; p.fallPh=wiped?'down':'';
    R.pose({}); R.root.visible=true;
    // spray off the rail in a turn, and a sheet off the tail at speed
    if(S.ph==='ride'&&S.speed>3.5){ const n=Math.min(7,Math.floor(Math.abs(S.edge)*14+S.speed*.25)); const sx=Math.sign(S.edge||1), ox=fz*sx, oz=-fx*sx;
      for(let i=0;i<n;i++) emit(S.x-fx*.6+ox*.25,S.y+.05,S.z-fz*.6+oz*.25,ox*(1.2+Math.random()*2.4)-fx*1.5,1.4+Math.random()*2.6*Math.abs(S.edge)+S.speed*.08,oz*(1.2+Math.random()*2.4)-fz*1.5,.12+Math.random()*.18,.35+Math.random()*.35); }
    // the lip: where the wave pitches over, a curtain of spray
    const sw=S.face; if(sw&&sw.w.dtb>0&&Math.random()<.85){ const w=sw.w, xp=w.px+Cst.SURF.peel*w.dtb*Cst.SURF.dir; for(let k=0;k<3;k++){ const x=xp+(Math.random()-.7)*3; if(x<Cst.SURF.x0+40||x>Cst.SURF.x1-40) continue;
      const z=Cst.shoreZ(x)-w.off+.3, o={}; Cst.surfAt(x,z,Cst.time,o); emit(x,(o.Hu||1.5)*.95+Math.random()*.4,z,(Math.random()-.5)*1.5,1+Math.random()*2.5,2.5+Math.random()*3,.3+Math.random()*.3,.5+Math.random()*.5); } }
    updateSpray(dt); };
  /* ---------- the camera ----------
     Waiting and paddling: in front, a little to the side, looking back past the surfer at the waves coming in. Riding: behind
     and in front of the wave (never inside it), looking down the line; further back in the air. */
  const cam={p:new THREE.Vector3(),l:new THREE.Vector3(),first:true,k:0}, _a=new THREE.Vector3(), _b=new THREE.Vector3(), _cw={};
  SF.camera=function(dt){ const sd=10/170*Math.cos(S.x/170)+4/53*Math.cos(S.x/53+1.3), nl=Math.hypot(sd,1), nx=-sd/nl, nz=1/nl, ax=1/nl, az=sd/nl;   // shoreward and along the shore
    const riding=S.ph==='ride'||S.ph==='air'||S.ph==='pop'&&S.phT>C.pop*.5||(S.ph==='wipe'||S.ph==='out')&&cam.k>.5;
    cam.k=damp(cam.k,riding?1:0,riding?2.2:1.2,dt);
    const vx=S.speed>1.5?S.vx/S.speed:Math.sin(S.h), vz=S.speed>1.5?S.vz/S.speed:Math.cos(S.h), air=S.air?1:0;
    // the lineup view
    _a.set(S.x+nx*8.5+ax*3,S.y+2.3,S.z+nz*8.5+az*3); _b.set(S.x-nx*7,S.y+.9,S.z-nz*7);
    // the ride view: behind along the board's travel, shifted shoreward off the face
    const ra=S.ph==='ride'||S.ph==='air'?1:0;
    _a.lerp(new THREE.Vector3(S.x-vx*(5+air*2)+nx*3.2,S.y+1.5+air*1.2,S.z-vz*(5+air*2)+nz*3.2),cam.k);
    _b.lerp(new THREE.Vector3(S.x+vx*5-nx*.6,S.y+1.1+air*.8,S.z+vz*5-nz*.6),cam.k);
    _a.y+=Math.sin(PI*clamp(cam.k,0,1))*2.4;   // swinging round from in front to behind, it goes up and over rather than through the surfer
    if(cam.first){ cam.p.copy(_a); cam.l.copy(_b); cam.first=false; } else { cam.p.lerp(_a,1-Math.exp(-dt*3.4)); cam.l.lerp(_b,1-Math.exp(-dt*5)); }
    { const dx=cam.p.x-S.x, dz=cam.p.z-S.z, d=Math.hypot(dx,dz); if(d<4.2&&d>1e-3){ cam.p.x=S.x+dx/d*4.2; cam.p.z=S.z+dz/d*4.2; } }   // never closer than 4 m
    const Wc=Cst.water(cam.p.x,cam.p.z,null,_cw); if(cam.p.y<Wc.y+.9) cam.p.y=Wc.y+.9;
    camera.position.copy(cam.p); camera.lookAt(cam.l); const fov=(ST.baseFov||62)+(ra?clamp(S.speed-5,0,6)*.8:0)+air*4; if(Math.abs(camera.fov-fov)>.05){ camera.fov=damp(camera.fov,fov,3,dt); camera.updateProjectionMatrix(); }
    if(camera.view&&camera.view.enabled) camera.clearViewOffset(); };
  SF.camReset=()=>{ cam.first=true; cam.k=0; };
  ST.Surf=SF;
})(window.ST);
