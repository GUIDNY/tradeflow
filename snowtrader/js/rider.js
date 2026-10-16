/* Snow Trader: the rider. The hero figure of the mall game (Mixamo-named skeleton, one skinned body, wardrobe nodes)
   is dressed for the mountain and posed procedurally: every bone is driven in WORLD axes from the pose the skin was
   bound in, so a pose is a handful of readable angles instead of a clip. */
(function(ST){
  const {clamp,lerp,damp}=ST; const {scene,renderer}=ST;
  const RAD=Math.PI/180;
  let R_rollG=null;
  const root=new THREE.Group();            // position + heading
  const tilt=new THREE.Group();            // follows the ground normal, rolls into carves
  const trick=new THREE.Group();           // spin / flip in the air
  const rig=new THREE.Group();             // lets the whole body crouch
  const rollG=new THREE.Group(); R_rollG=rollG; root.add(tilt); tilt.scale.setScalar(1.0); tilt.add(rollG); rollG.add(trick); trick.add(rig); scene.add(root);

  const R={root,tilt,trick,rig,model:null,bones:{},bind:{},order:[],ready:false,sole:0,
    look:{jacket:0xff3d6e,pants:0x23283a,helmet:0x15161c,board:0,skin:0xd9a07a,hair:0x2b1b10}};

  /* ---------- the board ---------- */
  const BOARDS=[
    {id:'rookie',name:'Pro White',price:0,top:['#f6f9ff','#c9d6ee'],stripe:true,edge:0x10131a,glow:0xff3d4f},
    {id:'bull',name:'Bull Run',price:900,top:['#ffb020','#ff3d6e'],edge:0x2a1020,glow:0xffb020},
    {id:'bear',name:'Bear Market',price:2600,top:['#38b6ff','#2a3cff'],edge:0x0b1630,glow:0x38b6ff},
    {id:'ipo',name:'IPO Gold',price:6500,top:['#fff2a8','#c98a00'],edge:0x3a2600,glow:0xffd34a}];
  R.BOARDS=BOARDS; R.rollG=R_rollG;
  function boardTex(b){ const c=document.createElement('canvas'); c.width=256; c.height=1024; const g=c.getContext('2d');
    const gr=g.createLinearGradient(0,0,0,1024); gr.addColorStop(0,b.top[0]); gr.addColorStop(1,b.top[1]); g.fillStyle=gr; g.fillRect(0,0,256,1024);
    g.globalAlpha=.22; g.fillStyle='#000'; for(let i=0;i<9;i++){ g.fillRect(60+(i%2)*80,120+i*100,30,70+(i*37)%50); } g.globalAlpha=1;
    if(b.stripe){ g.save(); g.translate(128,512); g.rotate(-.5); g.fillStyle='#e8283f'; g.fillRect(-260,-70,520,46); g.fillStyle='#1f6bff'; g.fillRect(-260,-14,520,30); g.fillStyle='#0f1218'; g.fillRect(-260,28,520,16); g.restore(); }
    g.fillStyle=b.stripe?'rgba(20,24,40,.85)':'rgba(255,255,255,.9)'; for(let i=0;i<5;i++){ const h=60+((i*53)%90), x=36+i*42; g.fillRect(x+9,300-h/2-14+0,4,h+28); g.fillRect(x,300-h/2,22,h); }
    g.strokeStyle='rgba(255,255,255,.85)'; g.lineWidth=10; g.strokeRect(10,10,236,1004);
    const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=4; return t; }
  /* A freestyle board at real size: 156 cm, 29 cm at the tips, 25 cm at the waist (sidecut), 1.8 cm thick, rounded tips that kick
     up, a touch of camber, a steel edge all round, a sintered base, and two bindings (highback, ankle and toe straps) set
     56 cm apart with the front foot turned out 20 degrees and the rear 8 degrees. */
  function makeBoard(b){
    const grp=new THREE.Group(), L=1.56, wt=.29, ww=.25, cap=.15;
    const hw=z=>{ const t=2*z/L; let w=.5*(ww+(wt-ww)*t*t); const e=Math.abs(z)-(L/2-cap); if(e>0) w*=Math.sqrt(Math.max(0,1-(e/cap)*(e/cap)*.96)); return w; };
    const outline=()=>{ const pts=[]; const N=64; for(let i=0;i<=N;i++){ const z=-L/2+L*i/N; pts.push([hw(z),z]); } for(let i=N;i>=0;i--){ const z=-L/2+L*i/N; pts.push([-hw(z),z]); } return pts; };
    const sh=new THREE.Shape(); outline().forEach(([x,z],i)=>i?sh.lineTo(x,-z):sh.moveTo(x,-z));
    const prof=(geo,lift)=>{ const p=geo.attributes.position; for(let i=0;i<p.count;i++){ const z=p.getZ(i), az=Math.abs(z); let y=p.getY(i); y+=(1-Math.pow(z/(L/2),2))*.008;     // camber
        if(az>.5){ const t=(az-.5)/(L/2-.5); y+=t*t*.075; } p.setY(i,y+lift); }
      // texture coordinates in board space: u across, v along
      const uv=new Float32Array(p.count*2); for(let i=0;i<p.count;i++){ uv[i*2]=p.getX(i)/.3+.5; uv[i*2+1]=p.getZ(i)/L+.5; } geo.setAttribute('uv',new THREE.BufferAttribute(uv,2)); geo.computeVertexNormals(); };
    const body=new THREE.ExtrudeGeometry(sh,{depth:.012,bevelEnabled:true,bevelThickness:.003,bevelSize:.004,bevelSegments:2,curveSegments:12}); body.rotateX(-Math.PI/2); prof(body,.014);
    const baseG=new THREE.ExtrudeGeometry(sh,{depth:.004,bevelEnabled:false,curveSegments:12}); baseG.rotateX(-Math.PI/2); prof(baseG,.0);
    const edgeG=new THREE.ExtrudeGeometry(sh,{depth:.01,bevelEnabled:true,bevelThickness:.002,bevelSize:.0045,bevelSegments:1,curveSegments:12}); edgeG.rotateX(-Math.PI/2); prof(edgeG,.003);
    const top=new THREE.MeshStandardMaterial({map:boardTex(b),roughness:.28,metalness:.05}), steel=new THREE.MeshStandardMaterial({color:0xc4c9d2,roughness:.3,metalness:.95}), base=new THREE.MeshStandardMaterial({color:0x14161b,roughness:.75});
    const eMesh=new THREE.Mesh(edgeG,steel); eMesh.castShadow=true; grp.add(eMesh);
    const bMesh=new THREE.Mesh(baseG,base); bMesh.position.y=-.002; grp.add(bMesh);
    const tMesh=new THREE.Mesh(body,top); tMesh.position.y=.004; tMesh.castShadow=true; grp.add(tMesh);
    // bindings
    const plastic=new THREE.MeshStandardMaterial({color:0x15171d,roughness:.55,metalness:.1}), accent=new THREE.MeshStandardMaterial({color:b.glow,roughness:.45,emissive:b.glow,emissiveIntensity:.18}), strap=new THREE.MeshStandardMaterial({color:0x23262e,roughness:.8});
    const binding=(z,yaw)=>{ const g=new THREE.Group(); g.position.set(0,.03,z); g.rotation.y=yaw*Math.PI/180;
      const plate=new THREE.Mesh(new THREE.CylinderGeometry(.095,.1,.014,24),plastic); plate.position.y=.007; g.add(plate);
      const hl=new THREE.Mesh(new THREE.BoxGeometry(.016,.15,.16),plastic); hl.position.set(-.1,.075,0); hl.rotation.z=-.22; g.add(hl);           // highback behind the heel
      const hr=new THREE.Mesh(new THREE.BoxGeometry(.016,.15,.16),plastic); hr.position.set(.1,.075,0); hr.rotation.z=.22; g.add(hr);
      const bk=new THREE.Mesh(new THREE.BoxGeometry(.2,.16,.016),plastic); bk.position.set(0,.09,-.085); bk.rotation.x=.2; g.add(bk);
      const ank=new THREE.Mesh(new THREE.BoxGeometry(.21,.034,.07),strap); ank.position.set(0,.085,.03); g.add(ank);
      const toe=new THREE.Mesh(new THREE.BoxGeometry(.2,.03,.06),strap); toe.position.set(0,.05,.16); g.add(toe);
      const bu=new THREE.Mesh(new THREE.BoxGeometry(.04,.036,.072),accent); bu.position.set(.105,.085,.03); g.add(bu);
      g.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); return g; };
    grp.add(binding(-.28,20),binding(.28,-8));
    grp.userData.edge=steel; return grp;
  }
  let boardObj=null;
  R.setBoard=function(i){ if(boardObj){ trick.remove(boardObj); } boardObj=makeBoard(BOARDS[i]||BOARDS[0]); boardObj.position.y=-.9; trick.add(boardObj); R.boardIndex=i; };
  trick.position.y=.9; rig.position.y=-.9;   // spin and flips turn about the body's centre, not the soles

  /* ---------- the figure ---------- */
  const MIX=['Hips','Abdomen','Torso','Chest','Neck','Head','ShoulderL','UpperArmL','LowerArmL','WristL','ShoulderR','UpperArmR','LowerArmR','WristR','UpperLegL','LowerLegL','FootL','UpperLegR','LowerLegR','FootR'];
  const BN={}; MIX.forEach(k=>BN[k]=k);   // the loader strips the dots from node names (UpperArm.L -> UpperArmL)

  function loadGLTF(url){ return new Promise((res,rej)=>{ const L=new THREE.GLTFLoader(); if(window.MeshoptDecoder) L.setMeshoptDecoder(window.MeshoptDecoder); L.load(url,res,undefined,rej); }); }
  function poseToBind(rootObj){   // every bone back to the pose the skin was bound in (the file saves its nodes in another one)
    rootObj.updateMatrixWorld(true); const W=new Map();
    rootObj.traverse(o=>{ if(!o.isSkinnedMesh) return; o.skeleton.bones.forEach((b,i)=>{ if(!W.has(b)) W.set(b,new THREE.Matrix4().copy(o.skeleton.boneInverses[i]).invert().premultiply(o.bindMatrix)); }); });
    const inv=new THREE.Matrix4(), m=new THREE.Matrix4(), sc=new THREE.Vector3();
    const walk=o=>{ if(W.has(o)){ const pw=W.get(o.parent)||o.parent.matrixWorld; m.copy(inv.copy(pw).invert()).multiply(W.get(o)); const s0=o.scale.clone(); m.decompose(o.position,o.quaternion,sc); o.scale.copy(s0); o.updateMatrixWorld(true); }
      o.children.forEach(walk); };
    walk(rootObj); rootObj.updateMatrixWorld(true);
  }
  const _q=new THREE.Quaternion(), _q2=new THREE.Quaternion(), _e=new THREE.Euler(), _v=new THREE.Vector3();

  R.load=async function(girl){
    await Promise.all([new Promise(r=>{ if(window.MeshoptDecoder) MeshoptDecoder.ready.then(r); else r(); })]);
    const gl=await loadGLTF('assets/hero-'+(girl?'w':'m')+'.glb'); const model=gl.scene;
    poseToBind(model);
    const B={}; model.traverse(o=>{ if(o.isBone) B[o.name]=o; });
    // feet hang off the root in the file (they were IK targets): hang them off the shins so they follow
    ['L','R'].forEach(sd=>{ if(B['Foot'+sd]&&B['LowerLeg'+sd]) B['LowerLeg'+sd].attach(B['Foot'+sd]); });
    model.updateMatrixWorld(true);
    // wardrobe: a ski-slope outfit
    model.traverse(x=>{ if(/^P_/.test(x.name)){ const [,slot,id]=x.name.split('_'); x.visible=slot==='feet'||(slot==='head'&&id===(girl?'pony':'casual'))||(slot==='top'&&id==='hoodie')||(slot==='legs'&&id==='long'); }
      if(/^L_/.test(x.name)) x.visible=false;
      if(x.isMesh){ x.castShadow=true; x.receiveShadow=true; x.frustumCulled=false; } });
    R.mats={}; model.traverse(x=>{ if(x.isMesh) (Array.isArray(x.material)?x.material:[x.material]).forEach(mt=>{ if(/^R_/.test(mt.name)) R.mats[mt.name.slice(2)]=mt; }); });
    R.model=model; R.bones={}; MIX.forEach(k=>{ if(B[BN[k]]) R.bones[k]=B[BN[k]]; });
    const depth=o=>{ let d=0; while(o.parent){ d++; o=o.parent; } return d; }; R.order=Object.keys(R.bones).sort((a,b)=>depth(R.bones[a])-depth(R.bones[b]));   // parents first
    R.bind={}; R.order.forEach(k=>{ R.bind[k]=R.bones[k].getWorldQuaternion(new THREE.Quaternion()); });   // model still unrotated here
    rig.add(model); model.rotation.y=Math.PI/2; model.scale.setScalar(1.0);
    R.heroModel=model; R.heroMats=R.mats; R.dress(); R.addGear(); R.ready=true; R.pose({}); return model;
  };
  /* ---------- any Mixamo-rigged character as the rider ---------- */
  const MXMAP={Hips:'Hips',Abdomen:'Spine',Torso:'Spine1',Chest:'Spine2',Neck:'Neck',Head:'Head',ShoulderL:'LeftShoulder',UpperArmL:'LeftArm',LowerArmL:'LeftForeArm',WristL:'LeftHand',ShoulderR:'RightShoulder',UpperArmR:'RightArm',LowerArmR:'RightForeArm',WristR:'RightHand',
    UpperLegL:'LeftUpLeg',LowerLegL:'LeftLeg',FootL:'LeftFoot',UpperLegR:'RightUpLeg',LowerLegR:'RightLeg',FootR:'RightFoot'};
  R.droop=0; R.choices=['hero'].concat(ST.People?ST.People.names:[]); R.current='hero';
  function adopt(model,boneFor,k,rotY){
    if(R.model&&R.model.parent) R.model.parent.remove(R.model);
    if(R.gear&&R.gear.parent) R.gear.parent.remove(R.gear);
    model.rotation.set(0,0,0); model.scale.setScalar(k); model.position.set(0,0,0); rig.add(model); model.updateMatrixWorld(true);
    R.model=model; R.bones={}; MIX.forEach(key=>{ const b=boneFor(key); if(b) R.bones[key]=b; });
    const depth=o=>{ let d=0; while(o.parent){ d++; o=o.parent; } return d; }; R.order=Object.keys(R.bones).sort((a,b)=>depth(R.bones[a])-depth(R.bones[b]));
    R.bind={}; R.order.forEach(key=>{ R.bind[key]=R.bones[key].getWorldQuaternion(new THREE.Quaternion()); });
    // how far the arms hang in the bind pose (T-pose 0, A-pose ~45): the pose subtracts it
    const a=R.bones.UpperArmL, f=R.bones.LowerArmL; let dr=0; if(a&&f){ const pa=a.getWorldPosition(new THREE.Vector3()), pf=f.getWorldPosition(new THREE.Vector3()); const d=pf.sub(pa); dr=Math.asin(clamp(-d.y/Math.max(d.length(),1e-6),-1,1))*180/Math.PI; } R.droop=dr;
    model.rotation.y=rotY; R.addGear(); R.pose({}); }
  R.swap=async function(name){
    if(name===R.current) return; const prev=R.current;
    if(name==='hero'){ const hm=R.heroModel; const B={}; hm.traverse(o=>{ if(o.isBone) B[o.name]=o; }); adopt(hm,key=>B[key],1.0,Math.PI/2); R.mats=R.heroMats; R.current='hero'; R.dress(); return; }
    const T=await ST.People.template(name), m=THREE.SkeletonUtils.clone(T.scene);
    m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; o.frustumCulled=false; } }); ST.People.dressOutfit(m,R.look.jacket,R.look.pants);
    const find=n=>{ let b=null; m.traverse(o=>{ if(!b&&o.name==='mixamorig'+n) b=o; }); return b; };
    adopt(m,key=>find(MXMAP[key]),T.k,Math.PI/2); R.mats={}; R.current=name; };
  R.dress=function(){ if(R.current!=='hero'&&R.current) return; const k=R.look, M=R.mats; const set=(n,c)=>{ if(M[n]) M[n].color.setHex(c).convertSRGBToLinear(); };
    set('Skin',k.skin); set('Skin2',k.skin); set('Hair',k.hair); set('Hair2',k.hair); set('Top',k.jacket); set('Top2',0x1a1c22); set('Accent',0xffffff); set('Pants',k.pants); set('Shoe',0x22242b); set('Sole',0xeeeeee);
    if(M.Top){ M.Top.roughness=.55; M.Top.metalness=.05; } };
  R.addGear=function(){
    const head=R.bones.Head; if(!head) return;
    const hp=head.getWorldPosition(new THREE.Vector3()), mp=R.model.getWorldPosition(new THREE.Vector3());
    const gear=new THREE.Group();
    const helm=new THREE.Mesh(new THREE.SphereGeometry(.156,24,16,0,Math.PI*2,0,Math.PI*.6),new THREE.MeshStandardMaterial({color:R.look.helmet,roughness:.92,metalness:0})); helm.scale.set(1,.98,1.12); helm.position.set(0,.105,-.015); helm.castShadow=true; gear.add(helm); R.helm=helm;
    const strap=new THREE.Mesh(new THREE.TorusGeometry(.148,.016,8,28),new THREE.MeshStandardMaterial({color:0x0c0d11,roughness:.6})); strap.rotation.x=Math.PI/2; strap.position.set(0,.115,.0); strap.scale.set(1,1.1,1); gear.add(strap);
    const lens=new THREE.Mesh(new THREE.BoxGeometry(.2,.082,.06),new THREE.MeshStandardMaterial({color:0xff7a2e,roughness:.12,metalness:.9,emissive:0xff5a1e,emissiveIntensity:.5})); lens.position.set(0,.108,.125); lens.geometry.translate(0,0,0); gear.add(lens); R.lens=lens;
    const frame=new THREE.Mesh(new THREE.BoxGeometry(.225,.1,.05),new THREE.MeshStandardMaterial({color:0x101218,roughness:.5})); frame.position.set(0,.108,.118); gear.add(frame);
    // black mitts on both wrists, like the reference
    ['WristL','WristR'].forEach(k=>{ const wb=R.bones[k]; if(!wb) return; const wp=wb.getWorldPosition(new THREE.Vector3()); const glove=new THREE.Mesh(new THREE.BoxGeometry(.11,.1,.17),new THREE.MeshStandardMaterial({color:0x0e1015,roughness:.7})); glove.castShadow=true; scene.add(glove); glove.position.copy(wp); R.model.updateMatrixWorld(true); wb.attach(glove); R.glovePieces=(R.glovePieces||[]).concat(glove); });
    gear.position.copy(hp.clone().sub(mp)).multiplyScalar(0); R.gear=gear;
    // gear is authored in the head's local frame: bone-local = world-up/forward only if the bone is bound upright; attach keeps the world pose
    rig.add(gear); gear.position.copy(rig.worldToLocal(hp.clone())); gear.rotation.set(0,R.model.rotation.y,0); gear.updateMatrixWorld(true); head.attach(gear);
  };

  /* pose: world-axis offsets from the bind pose. Angles in degrees; the model faces +Z, its left is +X, up is +Y. */
  R.P={crouch:0,lean:0,air:0,grab:0,twist:0,tuck:0,fall:0,t:0,sit:0,swing:0,look:0,absorb:0,ext:0,rough:0,speedK:0,om:0};
  R.rollMax=.6;
  function rot(k,ax,ay,az,order){ R.drive[k]=_q2.clone().setFromEuler(new THREE.Euler(ax*RAD,ay*RAD,az*RAD,order||'ZYX')); }
  /* The pose is built from joint angles in the figure's own frame (+Z is where it faces, +X its left = the way it travels,
     regular stance: left foot forward). rot(bone, pitch, yaw, roll) are ABSOLUTE offsets from the bind pose. The figure is
     always lowered until the soles touch the board, so every knee bend moves the hips the way a real rider's do. */
  R.pose=function(p){
    if(!R.ready) return; const P=Object.assign(R.P,p), a=P.air, g=P.grab, ln=P.lean, tw=P.twist, tk=P.tuck, k=P.sit||0, mx=(a0,b0)=>a0+(b0-a0)*k;
    R.drive={};
    // every joint is its own damped spring with its own stiffness and damping: they answer the same input at different speeds,
    // so knees, ankles, hips, each spine segment, shoulders, elbows and wrists move separately instead of as one block
    const now=P.t, dt=clamp(now-(R._lt==null?now-.016:R._lt),.001,.05); R._lt=now; R.S=R.S||{};
    const S=(n,tg,f,z)=>{ const o=R.S[n]||(R.S[n]={x:tg,v:0}); const h=dt/2, w=f*f; for(let i=0;i<2;i++){ o.v+=(w*(tg-o.x)-2*z*f*o.v)*h; o.x+=o.v*h; } return o.x; };
    const toe=Math.max(0,ln), heel=Math.max(0,-ln), sw=Math.sin(P.t*2.2)*P.swing, om=clamp((P.om||0)/1.6,-1,1);   // om: turn rate, -1..1
    const kn=clamp(14+P.crouch*46+tk*10+P.absorb*34-P.ext*30+a*16+g*22,0,100);
    const buzz=P.rough*(Math.sin(P.t*17)*1.6+Math.sin(P.t*29+1)*1.1);   // the board chattering over snow
    // knees: the leading one is soft and slow, the trailing one quick and a little springy; the board's chatter reaches them out of step
    const kF=S('kF',kn*1.08+toe*4+buzz,8,.5), kB=S('kB',kn*0.96+heel*3-buzz*.7+Math.abs(om)*5,12,.62);
    const hipYaw=8+tw*.25;
    const yawU=tw*.55+ln*10;
    // legs: thigh forward by the knee angle, shin back by about as much, so the hips stay over the feet; a wide stance with the toes turned out
    rot('UpperLegL',mx(-(kF+4),-84+sw*.3),   mx(S('hyL',16+tw*.15+om*5,10,.7),7),  mx(S('hrL',9+kn*.05+om*3,9,.6),0));
    rot('UpperLegR',mx(-(kB+4),-86-sw*.3),   mx(S('hyR',2+tw*.15-om*4,10,.7),-5),  mx(S('hrR',-(9+kn*.05)+om*3,9,.6),0));
    rot('LowerLegL',mx(kF*.94,-4+sw),        mx(16,7), 0);
    rot('LowerLegR',mx(kB*.94,-8-sw),        mx(2,-5), 0);
    // ankles: boots flex over the shin on toe/heel pressure and roll with the edge (small, the boot is stiff)
    rot('FootL',mx(S('anL',toe*5-heel*6-kF*.06+buzz*.5,15,.55),0),mx(20,0),mx(S('arL',ln*-6,14,.6),0));
    rot('FootR',mx(S('anR',toe*4-heel*7-kB*.06-buzz*.5,15,.55),0),mx(-8,0),mx(S('arR',ln*-6,14,.6),0));
    // trunk: each segment follows a beat behind the one below it, so a turn twists the spine and the head leads
    const fold=kn*.16+tk*12+g*14;
    rot('Hips',   mx(S('hpP',2+toe*5-heel*3,11,.7),-6),               mx(S('hpY',hipYaw-om*3,12,.75),0),  S('hpR',ln*6+om*3,10,.7));
    rot('Abdomen',mx(S('abP',8+fold*.45+toe*3,9,.7),-4),              mx(S('abY',18+yawU*.7-om*4,9,.65),0), S('abR',ln*-5-om*3,8,.65));
    rot('Torso',  mx(S('toP',10+fold*.4+toe*3-heel*3,8,.65),-4),      mx(S('toY',32+yawU-om*7,7.5,.6),0), S('toR',ln*-4-om*4,7,.6));
    rot('Chest',  mx(S('chP',8+fold*.15+buzz*.4,7,.6),-2),            mx(S('chY',46+yawU-om*9,6.5,.55),0), S('chR',ln*-2-om*4,6,.55));
    rot('Neck',  mx(-(10+kn*.10+tk*8)+S('neP',-buzz*.5,12,.6),-4),     mx(S('neY',66+yawU*.9+P.look*.2+om*14,6,.6),P.look*.5), S('neR',-ln*5,6,.6));
    rot('Head',  mx(-(8+kn*.07+tk*6),-4),                              mx(S('heY',84+yawU*.9+P.look*.3+om*22,5.5,.55),P.look),  S('heR',-ln*4,5.5,.6));
    // arms: out along the board for balance, wide in the air, tucked in a tuck; the turn swings them against the body, elbows and wrists each on their own
    const spread=mx(52+a*22-tk*36-P.crouch*8+P.ext*16,16)-(R.droop||0);
    rot('ShoulderL',0,0,S('shL',-om*6+a*5,9,.6)); rot('ShoulderR',0,0,S('shR',om*6-a*5,9,.6));
    rot('UpperArmL', mx(S('uLp',-16-kn*.12-tk*18+g*20+P.ext*10+om*10,8,.5),-28), mx(S('uLy',-6-a*8+ln*8+om*16,8,.5),-6), -spread+S('uLr',ln*14-g*40+om*10,8,.5));
    rot('UpperArmR', mx(S('uRp',-12-kn*.12-tk*18+P.ext*10-om*10,7.5,.5),-28),    mx(S('uRy',6+a*8-om*16,7.5,.5),6),   spread+S('uRr',ln*14-om*10,7.5,.5));
    rot('LowerArmL', mx(S('eL',-30-a*10+g*30-kF*.15-buzz*1.5,11,.42),-58), 0, -(spread*.3)-g*10);
    rot('LowerArmR', mx(S('eR',-28-a*10-kB*.15+buzz*1.5-om*8,9.5,.42),-58),  0,  spread*.3);
    rot('WristL',S('wLp',-8+om*10+buzz*2,18,.4),S('wLy',om*10,16,.4),S('wLr',-6-ln*6,16,.4));
    rot('WristR',S('wRp',-8-om*10-buzz*2,17,.4),S('wRy',-om*10,15,.4),S('wRr',6-ln*6,15,.4));
    if(g>0.01&&k<.5){ rot('UpperArmL',16+g*24, -50-g*24, -spread*.6-g*34); rot('LowerArmL',14+g*30, 0, -g*10); }
    // apply: top-down
    R.model.updateMatrixWorld(true); const F=R.model.getWorldQuaternion(new THREE.Quaternion());   // the figure's own frame: deltas turn with it
    R.order.forEach(kk=>{ const b=R.bones[kk], par=b.parent; par.updateWorldMatrix(true,false); par.getWorldQuaternion(_q);
      const d=R.drive[kk]; if(!d) return; const target=_q2.copy(F).multiply(d).multiply(R.bind[kk]); b.quaternion.copy(_q.invert().multiply(target)); b.updateMatrix(); b.updateMatrixWorld(true); });
    // keep the soles on the board: measure the ankle heights, lower the whole figure
    R.model.position.y=0; R.model.updateMatrixWorld(true);
    let low=1e9; ['FootL','FootR'].forEach(kk=>{ if(R.bones[kk]){ R.bones[kk].getWorldPosition(_v); R.model.parent.worldToLocal(_v); low=Math.min(low,_v.y); } });
    if(low<1e8) R.model.position.y=.205-low;
    // angulation: the board rolls onto its edge further than the body leans; the hips push inside the turn
    rig.rotation.z=((R.edge||0)-(R.body||0))*(1-k); rig.position.x=ln*(.04+.06*Math.abs(ln))*(1-k);
    if(boardObj) boardObj.rotation.y=-tw*.012*(1-k);   // in a spin the board follows the shoulders a beat later
  };

  /* shared trail ribbon, spray + landing puff */
  R.setLook=function(o){ Object.assign(R.look,o); R.dress(); if(R.current!=='hero'&&R.model) ST.People.dressOutfit(R.model,R.look.jacket,R.look.pants); if(R.helm) R.helm.material.color.setHex(R.look.helmet); };
  ST.Rider=R;
})(window.ST);
