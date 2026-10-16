/* Snow Rush: the rider. The hero figure of the mall game (Mixamo-named skeleton, one skinned body, wardrobe nodes)
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
    {id:'bull',name:'Sunrise',price:900,top:['#ffb020','#ff3d6e'],edge:0x2a1020,glow:0xffb020},
    {id:'bear',name:'Glacier',price:2600,top:['#38b6ff','#2a3cff'],edge:0x0b1630,glow:0x38b6ff},
    {id:'ipo',name:'Gold Edition',price:6500,top:['#fff2a8','#c98a00'],edge:0x3a2600,glow:0xffd34a}];
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
    ST.bakeStatic(grp);   // the two bindings (a dozen parts) become one mesh per material
    grp.userData.edge=steel; return grp;
  }
  let boardObj=null;
  R.setBoard=function(i){ if(boardObj){ trick.remove(boardObj); } boardObj=makeBoard(BOARDS[i]||BOARDS[0]); boardObj.position.y=-.9; trick.add(boardObj); R.boardIndex=i; R.boardObj=boardObj; };
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
  const _q=new THREE.Quaternion(), _q2=new THREE.Quaternion(), _e=new THREE.Euler(), _v=new THREE.Vector3(), _v2=new THREE.Vector3(), _v3=new THREE.Vector3(), _v4=new THREE.Vector3(), _v5=new THREE.Vector3(), _v6=new THREE.Vector3(), _p0=new THREE.Vector3(), _p1=new THREE.Vector3(), _p2=new THREE.Vector3(), _dq=new THREE.Quaternion(), _wq=new THREE.Quaternion(), _pq=new THREE.Quaternion();
  /* where each ankle must be, in the rig frame (board level): over the middle of each binding (front foot forward = -Z), ankle height of a boot on a binding */
  R.bindT={L:new THREE.Vector3(0,.205,-.28),R:new THREE.Vector3(0,.205,.28)}; R.ikOn=true;
  /* rotate a bone (about its own joint) so the segment toward its child points at a world target */
  function aimBone(bone,child,target){ bone.updateWorldMatrix(true,false); child.updateWorldMatrix(true,false); bone.getWorldPosition(_p0); child.getWorldPosition(_p1);
    _v.subVectors(_p1,_p0).normalize(); _v2.subVectors(target,_p0).normalize(); _dq.setFromUnitVectors(_v,_v2); bone.getWorldQuaternion(_wq); _wq.premultiply(_dq);
    bone.parent.getWorldQuaternion(_pq); bone.quaternion.copy(_pq.invert().multiply(_wq)); bone.updateMatrix(); bone.updateMatrixWorld(true); }

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
    R.heroModel=model; R.heroMats=R.mats; measureLimbs(); R.dress(); R.addGear(); R.ready=true; R.pose({}); return model;
  };
  /* ---------- any Mixamo-rigged character as the rider ---------- */
  const MXMAP={Hips:'Hips',Abdomen:'Spine',Torso:'Spine1',Chest:'Spine2',Neck:'Neck',Head:'Head',ShoulderL:'LeftShoulder',UpperArmL:'LeftArm',LowerArmL:'LeftForeArm',WristL:'LeftHand',ShoulderR:'RightShoulder',UpperArmR:'RightArm',LowerArmR:'RightForeArm',WristR:'RightHand',
    UpperLegL:'LeftUpLeg',LowerLegL:'LeftLeg',FootL:'LeftFoot',UpperLegR:'RightUpLeg',LowerLegR:'RightLeg',FootR:'RightFoot'};
  R.droop=0; R.choices=['hero'].concat(ST.People?ST.People.names:[]).concat(ST.Assets?Object.keys(ST.Assets.characters):[]); R.current='hero'; R.spec=null;
  function adopt(model,boneFor,k,rotY){
    if(R.model&&R.model.parent) R.model.parent.remove(R.model);
    if(R.gear&&R.gear.parent) R.gear.parent.remove(R.gear);
    model.rotation.set(0,0,0); model.scale.setScalar(k); model.position.set(0,0,0); rig.add(model); model.updateMatrixWorld(true);
    R.model=model; R.bones={}; MIX.forEach(key=>{ const b=boneFor(key); if(b) R.bones[key]=b; });
    const depth=o=>{ let d=0; while(o.parent){ d++; o=o.parent; } return d; }; R.order=Object.keys(R.bones).sort((a,b)=>depth(R.bones[a])-depth(R.bones[b]));
    R.bind={}; R.order.forEach(key=>{ R.bind[key]=R.bones[key].getWorldQuaternion(new THREE.Quaternion()); });
    // how far the arms hang in the bind pose (T-pose 0, A-pose ~45): the pose subtracts it
    const a=R.bones.UpperArmL, f=R.bones.LowerArmL; let dr=0; if(a&&f){ const pa=a.getWorldPosition(new THREE.Vector3()), pf=f.getWorldPosition(new THREE.Vector3()); const d=pf.sub(pa); dr=Math.asin(clamp(-d.y/Math.max(d.length(),1e-6),-1,1))*180/Math.PI; } R.droop=dr;
    measureLimbs(); model.rotation.y=rotY; R.addGear(); R.S={}; R.pose({}); }
  /* a character from the asset registry (js/assets.js): any rig whose bones the registry can name, scaled to its spec height */
  const charCache={};
  R.isAsset=name=>!!(ST.Assets&&ST.Assets.characters[name]);
  R.loadAsset=function(name){ if(charCache[name]) return charCache[name];
    const spec=ST.Assets.characters[name];
    return charCache[name]=loadGLTF(spec.url).then(gl=>{ const m=gl.scene; poseToBind(m);
      m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; o.frustumCulled=false; (Array.isArray(o.material)?o.material:[o.material]).forEach(mt=>{ if(mt.map) mt.map.anisotropy=4; }); } });
      const map=ST.Assets.RIGS[spec.rig].map, B={}; m.traverse(o=>{ if(o.isBone) B[o.name]=o; }); const boneFor=k=>B[map[k]]||null;
      // height from the skeleton (a compressed skinned mesh keeps its scale in the skin matrices, so its bounding box says
      // nothing): the highest bone (the head's end) to the ankles, plus the ankle's height above the sole
      m.updateMatrixWorld(true); const v=new THREE.Vector3(); let top=-1e9; m.traverse(o=>{ if(o.isBone) top=Math.max(top,o.getWorldPosition(v).y); });
      const fy=Math.min(boneFor('FootL').getWorldPosition(v).y,boneFor('FootR').getWorldPosition(v).y), k=spec.height/Math.max(.1,top-fy+.09);
      if(spec.tint) tintable(m);
      return {spec,scene:m,boneFor,k,check:ST.Assets.check(name,m,boneFor)}; }); };
  /* A baked texture can still take the run's colours where the model marks a region (vertex colour, red = trousers; written when
     the asset is prepared, from the bind pose: below the jacket hem, not the boots). The texture's own light and dark (folds,
     seams) is kept and only its colour is replaced; very dark texels (boots, zips) are left as they are, and so is the
     jacket's yellow where its hem hangs over the trousers (redder than any trouser texel). */
  function tintable(m){ m.traverse(o=>{ if(!o.isMesh||!o.geometry.attributes.color) return; const g=o.geometry; g.setAttribute('aTint',g.attributes.color); g.deleteAttribute('color');
    const mt=o.material; mt.vertexColors=false; const col=mt.userData.pants=new THREE.Color(R.look.pants).convertSRGBToLinear();
    mt.onBeforeCompile=sh=>{ sh.uniforms.uPants={value:col};
      sh.vertexShader='attribute vec4 aTint;\nvarying float vTint;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vTint=aTint.r;');
      sh.fragmentShader='uniform vec3 uPants;\nvarying float vTint;\n'+sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n { float tl=dot(diffuseColor.rgb,vec3(.299,.587,.114)); float tk=vTint*smoothstep(.015,.05,tl)*(1.-smoothstep(.08,.16,diffuseColor.r-diffuseColor.g)); diffuseColor.rgb=mix(diffuseColor.rgb,uPants*clamp(tl/.17,0.,1.7),tk); }'); };
    mt.customProgramCacheKey=()=>'st-tint'; mt.needsUpdate=true; }); }
  R.preload=name=>name==='hero'?Promise.resolve():R.isAsset(name)?R.loadAsset(name):ST.People.template(name);
  R.swap=async function(name){
    if(name===R.current) return; const prev=R.current;
    if(name==='hero'){ R.spec=null; const hm=R.heroModel; const B={}; hm.traverse(o=>{ if(o.isBone) B[o.name]=o; }); adopt(hm,key=>B[key],1.0,Math.PI/2); R.mats=R.heroMats; R.current='hero'; R.dress(); return; }
    if(R.isAsset(name)){ const A=await R.loadAsset(name); R.spec=A.spec; adopt(A.scene,A.boneFor,A.k,A.spec.facing==='-Z'?-Math.PI/2:Math.PI/2); R.mats={}; R.current=name; R.assetCheck=A.check; return; }
    R.spec=null;
    const T=await ST.People.template(name), m=THREE.SkeletonUtils.clone(T.scene);
    m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; o.frustumCulled=false; } }); ST.People.dressOutfit(m,R.look.jacket,R.look.pants);
    const find=n=>{ let b=null; m.traverse(o=>{ if(!b&&o.name==='mixamorig'+n) b=o; }); return b; };
    adopt(m,key=>find(MXMAP[key]),T.k,Math.PI/2); R.mats={}; R.current=name; };
  R.dress=function(){ if(R.current!=='hero'&&R.current) return; const k=R.look, M=R.mats; const set=(n,c)=>{ if(M[n]) M[n].color.setHex(c).convertSRGBToLinear(); };
    set('Skin',k.skin); set('Skin2',k.skin); set('Hair',k.hair); set('Hair2',k.hair); set('Top',k.jacket); set('Top2',0x1a1c22); set('Accent',0xffffff); set('Pants',k.pants); set('Shoe',0x22242b); set('Sole',0xeeeeee);
    if(M.Top){ M.Top.roughness=.55; M.Top.metalness=.05; } };
  R.addGear=function(){
    if(R.spec&&R.spec.gear===false){ R.helm=null; R.lens=null; return; }   // the model brings its own helmet, goggles and gloves
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

  /* ---------- pose v3 ----------
     Built every frame from physical quantities that main.js copies from the physics into R.P:
     1. the upper body: joint angles in a frame that leans with the body (gravity minus acceleration), not with the board;
     2. the pelvis: placed from the knee bend the stance asks for, shifted toward the heels or toes by angulation and fore/aft by
        the rider's weight; sitting on the snow and getting up move it along their own path;
     3. the legs: two-bone IK from each hip to its binding on the board, knees over the toes; the feet stay flat in the bindings
        (the rear foot leaves its binding only to skate);
     4. the arms: balance, and IK when a hand has to reach something (a grab, the snow when sitting down or getting up).
     Riding switch (right foot forward) is the same pose mirrored. Every angle is a damped spring with its own stiffness, so the
     joints answer the same input at different speeds instead of moving as one block.
     Angles are in degrees, in the figure's own frame: +Z where it faces (the toe edge), +X its left (the nose when regular), +Y up. */
  R.P={t:0,dir:1,menu:false,sit:0,swing:0,look:0,crouch:.2,charge:0,tuck:0,air:0,grab:0,grabName:'',spinW:0,flipW:0,body:0,edge:0,fa:0,om:0,slip:0,speed:0,
    brake:0,skid:0,absorb:0,ext:0,rough:0,wobble:0,skate:0,skatePh:0,popKind:'',popT:9,airT:0,ground:0,getup:0,fallPh:'',press:0,jib:0,bal:0,windup:0,spinA:0};
  const AH=.205, BIND=.28, PAIRS=[['ShoulderL','ShoulderR'],['UpperArmL','UpperArmR'],['LowerArmL','LowerArmR'],['WristL','WristR'],['UpperLegL','UpperLegR'],['LowerLegL','LowerLegR'],['FootL','FootR']];
  const UPPER=['Hips','Abdomen','Torso','Chest','Neck','Head','ShoulderL','UpperArmL','LowerArmL','WristL','ShoulderR','UpperArmR','LowerArmR','WristR'];
  const smooth01=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
  function measureLimbs(){ const b=R.bones, p=new THREE.Vector3(), q=new THREE.Vector3(); R.model.updateMatrixWorld(true); R.len={};
    const d=(a,c)=>b[a]&&b[c]?b[a].getWorldPosition(p).distanceTo(b[c].getWorldPosition(q)):.4;
    ['L','R'].forEach(sd=>{ R.len['leg'+sd]=[d('UpperLeg'+sd,'LowerLeg'+sd),d('LowerLeg'+sd,'Foot'+sd)]; R.len['arm'+sd]=[d('UpperArm'+sd,'LowerArm'+sd),d('LowerArm'+sd,'Wrist'+sd)]; }); }
  R.measureLimbs=measureLimbs;
  /* two-bone IK: put `end` (the child of `mid`) on target t, bending the middle joint toward `pole` */
  function ik2(top,mid,end,t,pole,L1,L2,info,key){
    const H=top.getWorldPosition(new THREE.Vector3()), to=_v5.subVectors(t,H); let d=to.length(); if(info) info.reach[key]=d/(L1+L2);
    d=clamp(d,Math.abs(L1-L2)+1e-3,(L1+L2)*.995); to.normalize();
    const a2=(L1*L1-L2*L2+d*d)/(2*d), h2=Math.sqrt(Math.max(0,L1*L1-a2*a2));
    const pl=_v6.copy(pole); pl.addScaledVector(to,-pl.dot(to)); if(pl.lengthSq()<1e-6) pl.set(0,1,0).addScaledVector(to,-to.y); pl.normalize();
    const K=H.clone().addScaledVector(to,a2).addScaledVector(pl,h2), E=H.clone().addScaledVector(to,d);
    aimBone(top,mid,K); aimBone(mid,end,E);
    if(info){ end.getWorldPosition(_p2); info.err[key]=_p2.distanceTo(t); } }
  R.pose=function(p){
    if(!R.ready) return; const P=Object.assign(R.P,p), seated=(P.sit||0)>.5;
    const now=P.t, dt=clamp(now-(R._lt==null?now-.016:R._lt),.001,.05); R._lt=now; R.S=R.S||{};
    const S=(n,tg,f,z)=>{ const o=R.S[n]||(R.S[n]={x:tg,v:0}); const h=dt/2, w=f*f; for(let i=0;i<2;i++){ o.v+=(w*(tg-o.x)-2*z*f*o.v)*h; o.x+=o.v*h; } return o.x; };
    const E={}; const rot=(k,x,y,z)=>{ E[k]=[x,y,z]; };
    const dir=P.dir<0?-1:1, DEG=180/Math.PI;
    if(seated){ poseSeated(P,rot); }
    else {
      // ---- canonical inputs (as if riding regular: left foot forward); a switch rider gets the mirror image ----
      const toeB=dir*P.body*DEG, toeE=dir*P.edge*DEG, lamRel=toeB-toeE;                      // lean toward the toes: body, board, body relative to board
      const omC=dir*P.om, slipC=dir*P.slip*DEG, a=P.air, g=P.grab, tk=P.tuck, ch=P.charge, wob=P.wobble, br=P.brake;
      const gu=P.getup||0, sitW=(P.ground||0)*(1-smooth01(.15,.85,gu)), bump=Math.sin(Math.PI*clamp(gu,0,1))*(P.ground>0?1:0), live=1-sitW;
      const buzz=P.rough*(Math.sin(P.t*17)*1.6+Math.sin(P.t*29+1)*1.1);                        // the board chattering over the snow
      const flipK=clamp(Math.abs(P.flipW)/6,0,1), gn0=P.grabName||'INDY';
      // knee bend (degrees from straight): stance, speed crouch, loading for a jump, absorbing, the pop's extension, tucks in the air
      const eAbs=Math.abs(toeE)*(1-a);
      const def=R._grabDef||0;
      // a deep carve at speed: the rider sinks, bends into the turn and drags the inside glove through the snow
      const drag=smooth01(44,60,eAbs)*smooth01(6,10,P.speed||0)*live*(1-a)*(1-br);
      let kn=28+P.crouch*45+ch*55+P.absorb*42-P.ext*28+a*(tk*55+g*(55+def*160)+flipK*25)+br*18+P.skate*8+eAbs*.75+(toeE<0?eAbs*.35:0)+(1-a)*tk*20+drag*24;
      kn=clamp(kn,4,145);
      // a press loads one leg: the knee over the pressed end folds, the other straightens as its end of the board lifts.
      // On a jib the knees stay soft and the body sways with the balance (balC: + toward the toes).
      const pr=P.press||0, prL=Math.max(0,pr), prT=Math.max(0,-pr), jb=P.jib||0, balC=dir*(P.bal||0)*jb;
      const kF=S('kF',kn*1.03+buzz+(toeE>0?3:0)+prL*32-prT*16+jb*6,8.5,.5), kB=S('kB',kn*.98-buzz*.7+Math.abs(omC)*4+(toeE<0?3:0)+prT*32-prL*16+jb*6,12,.62);
      const fold=S('fold',kn*.2+tk*(1-a)*55+tk*a*10+g*(70+def*120)+ch*22+bump*60+Math.abs(pr)*10,9,.7);
      // where the travel is, seen from the figure (it faces the toe edge, the nose is to its left): eyes and shoulders go there
      const look=clamp(90+slipC-omC*16+(P.menu?Math.sin(P.t*.5)*14:0),-20,115);
      // spinning: the shoulders lead the rotation; loading a jump while turning winds them the other way first (the wind-up)
      const twist=dir*(-P.spinW*4.2+(P.windup||0)*34);
      const side=S('side',clamp(omC*6,-12,12)+wob*Math.sin(P.t*9)*10+drag*Math.sign(toeE)*20,7,.5);   // a side bend into the turn, a sway when losing it
      // spotting: in a spin the eyes stay on where the rider is going for as long as the neck allows, then whip round
      const spinC=dir*(P.spinA||0)*DEG, spotOn=a*smooth01(15,40,Math.abs(spinC)), spot=spotOn*clamp(((90+spinC-look+540)%360)-180,-80,80);
      // ---- the trunk ----
      // how far the trunk leans forward (absolute, each segment a little more than the one below: a curved back), the head kept up
      const lean=clamp(fold*.62,0,85), gEnd=g*(gn0==='NOSE'?-22:gn0==='TAIL'?22:0);      // nose/tail grabs bend the trunk toward that end
      rot('Hips',   S('hpP',lean*.78-sitW*14,11,.7),               S('hpY',look*.08+P.skate*22,12,.75),                  S('hpR',side*.3+gEnd*.5,10,.7));
      rot('Abdomen',S('abP',lean*.9-sitW*10,9,.7),                 S('abY',look*.14+twist*.25,9,.65),                    S('abR',side*.4+gEnd*.8,8,.65));
      rot('Torso',  S('toP',lean*.96-sitW*8+buzz*.3,8,.65),        S('toY',look*.21+twist*.35,7.5,.6),                   S('toR',side*.35+gEnd,7,.6));
      rot('Chest',  S('chP',lean+2-sitW*6+buzz*.4,7,.6),           S('chY',look*.29+twist*.4,6.5,.55),                   S('chR',side*.25+gEnd,6,.55));
      rot('Neck',   S('neP',lean*.42-4+sitW*8-buzz*.4,12,.6),      S('neY',look*.6+twist*.2+spot*.45,6,.6),              S('neR',-side*.2,6,.6));
      rot('Head',   S('heP',4+lean*.08+sitW*6,10,.6),              S('heY',look*.92+twist*.1+spot*.85+(P.menu?Math.sin(P.t*.31)*8:0),7,.6), S('heR',-side*.15-lamRel*.15,5.5,.6));
      // ---- the arms: a neutral starting shape here; the hands are placed further down (targets + IK) ----
      rot('ShoulderL',0,0,S('shL',-omC*5+a*5+ch*4,9,.6)); rot('ShoulderR',0,0,S('shR',omC*5-a*5-ch*4,9,.6));
      rot('UpperArmL',0,-12,-(62-(R.droop||0))); rot('UpperArmR',0,12,62-(R.droop||0));
      rot('LowerArmL',0,-30,-(62-(R.droop||0))); rot('LowerArmR',0,30,62-(R.droop||0));
      rot('WristL',S('wLp',-6+omC*8+buzz*2,18,.4),S('wLy',omC*8,16,.4),S('wLr',-10,16,.4));
      rot('WristR',S('wRp',-6-omC*8-buzz*2,17,.4),S('wRy',-omC*8,15,.4),S('wRr',10,15,.4));
      // hand targets (metres from each shoulder, figure frame: x toward the nose for the front arm, y up, z toward the toes)
      const tkG=tk*(1-a), mix=(base,list)=>{ const o=base.slice(); list.forEach(([w,v])=>{ for(let i=0;i<3;i++) o[i]+=(v[i]-o[i])*clamp(w,0,1); }); return o; };
      const wavF=[Math.cos(P.t*10)*.24,Math.sin(P.t*10)*.28,0], wavB=[Math.cos(P.t*10+2.4)*.24,Math.sin(P.t*10+2.4)*.28,0];
      const carveZ=.14*clamp(Math.abs(toeE)/50,0,1)*(1-a), heelUp=toeE<0?.1*clamp(-toeE/50,0,1):0;
      let hF=mix([.25,-.33,.13+carveZ],[[P.menu?1:0,[.1,-.46,.07]],[a,[.4,-.1,.06]],[tkG,[.1,-.28,.38]],[br,[.43,-.2,.1]],[ch,[.18,-.4,-.2]],[P.ext,[.28,-.04,.3]],[P.skate,[.35,-.25,.2]]]);
      let hB=mix([-.24,-.38,.06+carveZ],[[P.menu?1:0,[-.1,-.46,.06]],[a,[-.4,-.1,0]],[tkG,[-.08,-.28,.36]],[br,[-.4,-.22,.05]],[ch,[-.16,-.4,-.22]],[P.ext,[-.26,-.04,.28]],[P.skate,[-.3,-.3,-.05]]]);
      hF[1]+=heelUp; hB[1]+=heelUp; for(let i=0;i<3;i++){ hF[i]+=wavF[i]*wob; hB[i]+=wavB[i]*wob; }
      // on a jib the arms go out along the board for balance and swing against the lean; a press reaches toward the pressed end
      if(jb>.01){ hF=mix(hF,[[jb,[.52,-.1,.02]]]); hB=mix(hB,[[jb,[-.52,-.13,0]]]); hF[2]-=balC*.2; hB[2]-=balC*.2; hF[1]+=balC*.1; hB[1]-=balC*.1; }
      hF[0]+=prL*.1-prT*.12; hB[0]+=prL*.12-prT*.1; hF[1]+=prT*.1; hB[1]+=prL*.1;
      // spinning: the arms lead the rotation; turning: the front hand reaches into the turn a little
      hF[2]+=clamp(-twist/90,-.3,.3); hB[2]-=clamp(-twist/90,-.3,.3); hF[2]+=clamp(omC*.05,-.1,.1);
      R._hands={F:hF.map((v,i)=>S('hF'+i,v,9-i,.55)),B:hB.map((v,i)=>S('hB'+i,v,8-i,.55))};
      // the lean of the whole upper body relative to the board: angulation across it, the weight fore and aft along it
      R._lean={pitch:S('lamRel',lamRel*live,12,.75),roll:-dir*S('faL',(P.fa*DEG*.9+pr*8)*live,8,.7)};
      R._legs={kF,kB,sitW,bump,gu,live}; R._drag={k:drag,toe:toeE>0};
      // pelvis targets in the board frame (x toward the toes, z along the board, front foot at -z when regular)
      const ecx=.12*Math.tanh(toeE/9);                                                         // the edge carrying the weight
      const px=S('px',(-.05-P.crouch*.05+ecx+.85*Math.sin(lamRel/DEG*live))*live+sitW*-.42+bump*.12,10,.75);
      const pz=S('pz',-dir*(.35*P.fa+.06*P.skate+.14*pr)*live,9,.75);                         // a press moves the hips over the pressed end
      R._pelvis={px,pz};
    }
    // mirror for switch: swap left and right, negate yaw and roll (the bind pose is left-right symmetric)
    if(!seated&&dir<0){ PAIRS.forEach(([l,r])=>{ const t=E[l]; E[l]=E[r]; E[r]=t; }); for(const k in E){ const e=E[k]; if(e){ e[1]=-e[1]; e[2]=-e[2]; } } }
    R.drive={}; for(const k in E){ const e=E[k]; if(e) R.drive[k]=new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0]*RAD,e[1]*RAD,e[2]*RAD,'ZYX')); }
    // ---- frames: the board's (the figure facing the toe edge) and the leaning body's ----
    R.model.position.set(0,0,0); root.updateMatrixWorld(true);
    const Fb=R.model.getWorldQuaternion(new THREE.Quaternion()), Fu=Fb.clone();
    if(!seated&&R._lean) Fu.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(R._lean.pitch*RAD,0,R._lean.roll*RAD,'ZYX')));
    const applyAbs=(kk,F)=>{ const b=R.bones[kk]; if(!b||!R.drive[kk]) return; const par=b.parent; par.updateWorldMatrix(true,false); par.getWorldQuaternion(_q);
      const target=_q2.copy(F).multiply(R.drive[kk]).multiply(R.bind[kk]); b.quaternion.copy(_q.invert().multiply(target)); b.updateMatrix(); b.updateMatrixWorld(true); };
    const bp=R.bones;
    if(seated){ R.order.forEach(kk=>applyAbs(kk,Fb)); R.model.updateMatrixWorld(true);
      let low=1e9; ['FootL','FootR'].forEach(kk=>{ if(bp[kk]){ bp[kk].getWorldPosition(_v); rig.worldToLocal(_v); low=Math.min(low,_v.y); } });
      if(low<1e8) R.model.position.y=.205-low; R.ik={on:false,state:'seated (FK)'}; finishBoard(P,0); return; }
    // legs start each frame from a neutral bend (so IK never inherits yesterday's twist); feet sit on their bindings
    const kL=dir>0?R._legs.kF:R._legs.kB, kR=dir>0?R._legs.kB:R._legs.kF, yawL=20, yawR=-8;
    R.drive.UpperLegL=new THREE.Quaternion().setFromEuler(new THREE.Euler(-(kL*.6+6)*RAD,yawL*RAD,4*RAD,'ZYX')); R.drive.LowerLegL=new THREE.Quaternion().setFromEuler(new THREE.Euler(kL*RAD,yawL*RAD,0,'ZYX'));
    R.drive.UpperLegR=new THREE.Quaternion().setFromEuler(new THREE.Euler(-(kR*.6+6)*RAD,yawR*RAD,-4*RAD,'ZYX')); R.drive.LowerLegR=new THREE.Quaternion().setFromEuler(new THREE.Euler(kR*RAD,yawR*RAD,0,'ZYX'));
    const toeL=P.edge*dir*DEG, ankL=clamp(toeL*.12,-6,6);
    R.drive.FootL=new THREE.Quaternion().setFromEuler(new THREE.Euler(S('anL',ankL-kL*.05,15,.55)*RAD,yawL*RAD,0,'ZYX'));
    R.drive.FootR=new THREE.Quaternion().setFromEuler(new THREE.Euler(S('anR',ankL-kR*.05,15,.55)*RAD,yawR*RAD,0,'ZYX'));
    // skating: the rear foot is out of its binding, pointing down the line and pushing on the snow beside the board
    const rear=dir>0?'R':'L', sk=P.skate||0;
    if(sk>.01){ const yawS=lerp(rear==='R'?yawR:yawL,dir*62,sk); R.drive['Foot'+rear]=new THREE.Quaternion().setFromEuler(new THREE.Euler(-10*sk*RAD,yawS*RAD,0,'ZYX')); }
    R.order.forEach(kk=>applyAbs(kk,UPPER.includes(kk)?Fu:Fb));
    R.model.updateMatrixWorld(true);
    // ---- pelvis: height from the leg bend each knee asks for, then move the whole figure there ----
    const L=R.len||(measureLimbs(),R.len), legL=L.legL, legR=L.legR;
    const hipW=bp.Hips.getWorldPosition(new THREE.Vector3()), hipR=rig.worldToLocal(hipW.clone());
    const jL=rig.worldToLocal(bp.UpperLegL.getWorldPosition(new THREE.Vector3())).sub(hipR), jR=rig.worldToLocal(bp.UpperLegR.getWorldPosition(new THREE.Vector3())).sub(hipR);
    const T={L:R.bindT.L.clone(),R:R.bindT.R.clone()};
    // a grab tweaks the board against the body (Indy and Mute tip the toe edge up, Tail and Nose lift that end); the feet stay on it
    // because their targets turn with it
    const gwT=P.grab||0, gnT=P.grabName||'INDY', tq=R._tweakQ||(R._tweakQ=new THREE.Quaternion());
    tq.setFromEuler(_e.set(S('twP',gwT*(gnT==='TAIL'?-dir*.3:gnT==='NOSE'?dir*.3:gnT==='MUTE'?-dir*.12:dir*.12),9,.6),0,S('twR',gwT*(gnT==='TAIL'||gnT==='NOSE'?0:.32),9,.6),'XYZ'));
    T.L.applyQuaternion(tq); T.R.applyQuaternion(tq);
    if(sk>.01){ const f=-dir, ph=((P.skatePh||0)%1+1)%1, z1=f*.05, z2=-f*.55; let x=.32,y=.1,z;
      if(ph<.12){ z=z1; y=lerp(.3,.1,ph/.12); } else if(ph<.55){ z=lerp(z1,z2,(ph-.12)/.43); } else { const u=(ph-.55)/.45; z=lerp(z2,z1,u); y=.1+.22*Math.sin(Math.PI*u); }
      T[rear].lerp(new THREE.Vector3(x,y,z),sk); }
    const {px,pz}=R._pelvis, {sitW}=R._legs;
    const ext=(k,l)=>Math.sqrt(l[0]*l[0]+l[1]*l[1]+2*l[0]*l[1]*Math.cos(k*RAD));
    const pyFor=(j,t,k,l)=>{ const d=ext(k,l), dx=t.x-(px+j.x), dz=t.z-(pz+j.z); return t.y+Math.sqrt(Math.max(.0001,d*d-dx*dx-dz*dz))-j.y; };
    let py=Math.min(pyFor(jL,T.L,kL,legL),pyFor(jR,T.R,kR,legR));
    py=lerp(py,.17,sitW);
    R.model.position.set(px-hipR.x,py-hipR.y,pz-hipR.z); R.model.updateMatrixWorld(true);
    // ---- legs: IK to the bindings, knees over the toes ----
    const info={on:true,err:{},reach:{},state:sk>.5?'skate: rear foot free':'feet locked to bindings'}, fwd=_v3.set(0,0,1).applyQuaternion(Fb), up=_v4.set(0,1,0).applyQuaternion(Fb);
    const wT={L:rig.localToWorld(T.L.clone()),R:rig.localToWorld(T.R.clone())};
    ['L','R'].forEach(sd=>{ const yaw=(sd==='L'?yawL:yawR)*RAD, pole=fwd.clone().applyAxisAngle(up,yaw); if(sitW>.3) pole.addScaledVector(up,sitW*.8);
      ik2(bp['UpperLeg'+sd],bp['LowerLeg'+sd],bp['Foot'+sd],wT[sd],pole,L['leg'+sd][0],L['leg'+sd][1],info,sd); applyAbs('Foot'+sd,Fb); });
    // ---- arms: every frame the hands go to targets and the elbows are solved; a grab reaches for the board, sitting for the snow ----
    const f=-dir, front=dir>0?'L':'R', back=dir>0?'R':'L', handT={}, H=R._hands;
    const toW=(sd,o)=>{ const sh=bp['UpperArm'+sd].getWorldPosition(new THREE.Vector3()); const x=dir>0?o[0]:-o[0]; return sh.add(new THREE.Vector3(x,o[1],o[2]).applyQuaternion(Fu)); };
    handT[front]={p:toW(front,H.F)}; handT[back]={p:toW(back,H.B)};
    const gw=(P.grab||0), gn=P.grabName||'INDY'; let gArm=null;
    if(gw>.01){ const tgt=gn==='MUTE'?[front,.16,.17,f*.06]:gn==='NOSE'?[front,.03,.18,f*.6]:gn==='TAIL'?[back,.03,.18,-f*.6]:[back,.16,.17,-f*.04]; gArm=tgt[0];
      handT[gArm].p.lerp(rig.localToWorld(new THREE.Vector3(tgt[1],tgt[2],tgt[3]).applyQuaternion(tq)),clamp(gw,0,1)); }
    // a deep carve: the inside glove goes down to the snow beside the board (front hand on the toe side, back hand on the heel side)
    const D=R._drag; R.handDrag=null;
    if(D&&D.k>.02&&!gArm){ const hs=D.toe?front:back, zz=D.toe?-dir*.22:dir*.3, xe=D.toe?.16:-.16;
      const pe=rig.localToWorld(new THREE.Vector3(xe,0,zz)), pa=rig.localToWorld(new THREE.Vector3(xe+(D.toe?1:-1),0,zz)), dx=pa.x-pe.x, dz=pa.z-pe.z, dl=Math.hypot(dx,dz)||1;
      const sx=pe.x+dx/dl*.3, sz=pe.z+dz/dl*.3; handT[hs].p.lerp(new THREE.Vector3(sx,ST.World.groundY(sx,sz)+.04,sz),D.k); R.handDrag={sd:hs,k:D.k,touch:false,pos:new THREE.Vector3()}; }
    const sw2=Math.max(R._legs.sitW,R._legs.bump*.8*(R._legs.gu<.55?1:0));
    if(sw2>.01) ['L','R'].forEach(sd=>{ if(sd===gArm) return; handT[sd].p.lerp(rig.localToWorld(new THREE.Vector3(-.66,.05,(sd==='L'?-1:1)*.3)),clamp(sw2,0,1)); });
    info.hands={}; info.reach.armL=0; info.reach.armR=0;
    ['L','R'].forEach(sd=>{ if(!bp['UpperArm'+sd]) return; const side=new THREE.Vector3(sd==='L'?1:-1,0,0).applyQuaternion(Fu), back3=new THREE.Vector3(0,0,-1).applyQuaternion(Fu), down=new THREE.Vector3(0,-1,0).applyQuaternion(Fu);
      const pole=side.multiplyScalar(.5).addScaledVector(back3,.7).addScaledVector(down,.2), sub={reach:{},err:{}};
      ik2(bp['UpperArm'+sd],bp['LowerArm'+sd],bp['Wrist'+sd],handT[sd].p,pole,L['arm'+sd][0],L['arm'+sd][1],sub,'a'); applyAbs('Wrist'+sd,Fu);
      info.reach['arm'+sd]=+sub.reach.a.toFixed(2); info.hands[sd]=+(sub.err.a*100).toFixed(1); });
    // a grab the hand cannot reach yet: next frame the knees come up and the body folds a little more
    R._grabDef=gArm?damp(R._grabDef||0,clamp((info.reach['arm'+gArm]||0)-.92,0,.5),6,dt):damp(R._grabDef||0,0,4,dt);
    if(R.handDrag){ const hd=R.handDrag; bp['Wrist'+hd.sd].getWorldPosition(hd.pos); hd.touch=hd.pos.y-ST.World.groundY(hd.pos.x,hd.pos.z)<.14; }
    info.targets=[wT.L,wT.R]; info.handPts=[handT.L.p,handT.R.p]; R.ik=info;
    finishBoard(P,1);
  };
  // the board is strapped to the feet: it never lags them (and turns with a grab's tweak, which the feet follow)
  function finishBoard(P,live){ rig.rotation.set(0,0,0); rig.position.set(0,-.9,0); if(boardObj){ if(live&&R._tweakQ) boardObj.quaternion.copy(R._tweakQ); else boardObj.rotation.set(0,0,0); } }
  /* the chairlift seat: no IK, the legs hang */
  function poseSeated(P,rot){ const sw=Math.sin(P.t*2.2)*P.swing;
    rot('UpperLegL',-84+sw*.3,7,0); rot('UpperLegR',-86-sw*.3,-5,0); rot('LowerLegL',-4+sw,7,0); rot('LowerLegR',-8-sw,-5,0); rot('FootL',0,0,0); rot('FootR',0,0,0);
    rot('Hips',-6,0,0); rot('Abdomen',-4,0,0); rot('Torso',-4,0,0); rot('Chest',-2,0,0); rot('Neck',-4,P.look*.5,0); rot('Head',-4,P.look,0);
    const spread=16-(R.droop||0); rot('UpperArmL',-28,-6,-spread); rot('UpperArmR',-28,6,spread); rot('LowerArmL',-58,0,-spread*.3); rot('LowerArmR',-58,0,spread*.3); }

  /* shared trail ribbon, spray + landing puff */
  R.setLook=function(o){ Object.assign(R.look,o); R.dress(); if(R.current!=='hero'&&R.model&&!(R.spec&&R.spec.outfit==='baked')) ST.People.dressOutfit(R.model,R.look.jacket,R.look.pants); if(R.helm) R.helm.material.color.setHex(R.look.helmet);
    if(R.spec&&R.spec.tint&&R.model) R.model.traverse(x=>{ if(x.material&&x.material.userData.pants) x.material.userData.pants.setHex(R.look.pants).convertSRGBToLinear(); }); };
  ST.Rider=R;
})(window.ST);
