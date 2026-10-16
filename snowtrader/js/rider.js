/* Snow Trader: the rider. The hero figure of the mall game (Mixamo-named skeleton, one skinned body, wardrobe nodes)
   is dressed for the mountain and posed procedurally: every bone is driven in WORLD axes from the pose the skin was
   bound in, so a pose is a handful of readable angles instead of a clip. */
(function(ST){
  const {clamp,lerp,damp}=ST; const {scene,renderer}=ST;
  const RAD=Math.PI/180;
  const root=new THREE.Group();            // position + heading
  const tilt=new THREE.Group();            // follows the ground normal, rolls into carves
  const trick=new THREE.Group();           // spin / flip in the air
  const rig=new THREE.Group();             // lets the whole body crouch
  root.add(tilt); tilt.scale.setScalar(1.2); tilt.add(trick); trick.add(rig); scene.add(root);

  const R={root,tilt,trick,rig,model:null,bones:{},bind:{},order:[],ready:false,sole:0,
    look:{jacket:0xff3d6e,pants:0x23283a,helmet:0x15161c,board:0,skin:0xd9a07a,hair:0x2b1b10}};

  /* ---------- the board ---------- */
  const BOARDS=[
    {id:'rookie',name:'Pro White',price:0,top:['#f6f9ff','#c9d6ee'],stripe:true,edge:0x10131a,glow:0xff3d4f},
    {id:'bull',name:'Bull Run',price:900,top:['#ffb020','#ff3d6e'],edge:0x2a1020,glow:0xffb020},
    {id:'bear',name:'Bear Market',price:2600,top:['#38b6ff','#2a3cff'],edge:0x0b1630,glow:0x38b6ff},
    {id:'ipo',name:'IPO Gold',price:6500,top:['#fff2a8','#c98a00'],edge:0x3a2600,glow:0xffd34a}];
  R.BOARDS=BOARDS;
  function boardTex(b){ const c=document.createElement('canvas'); c.width=256; c.height=1024; const g=c.getContext('2d');
    const gr=g.createLinearGradient(0,0,0,1024); gr.addColorStop(0,b.top[0]); gr.addColorStop(1,b.top[1]); g.fillStyle=gr; g.fillRect(0,0,256,1024);
    g.globalAlpha=.22; g.fillStyle='#000'; for(let i=0;i<9;i++){ g.fillRect(60+(i%2)*80,120+i*100,30,70+(i*37)%50); } g.globalAlpha=1;
    if(b.stripe){ g.save(); g.translate(128,512); g.rotate(-.5); g.fillStyle='#e8283f'; g.fillRect(-260,-70,520,46); g.fillStyle='#1f6bff'; g.fillRect(-260,-14,520,30); g.fillStyle='#0f1218'; g.fillRect(-260,28,520,16); g.restore(); }
    g.fillStyle=b.stripe?'rgba(20,24,40,.85)':'rgba(255,255,255,.9)'; for(let i=0;i<5;i++){ const h=60+((i*53)%90), x=36+i*42; g.fillRect(x+9,300-h/2-14+0,4,h+28); g.fillRect(x,300-h/2,22,h); }
    g.strokeStyle='rgba(255,255,255,.85)'; g.lineWidth=10; g.strokeRect(10,10,236,1004);
    const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=4; return t; }
  function makeBoard(b){
    const grp=new THREE.Group(), Lh=.8, W=.155, sh=new THREE.Shape();
    sh.moveTo(-W,-Lh+.1); sh.quadraticCurveTo(-W,-Lh,0,-Lh-.12); sh.quadraticCurveTo(W,-Lh,W,-Lh+.1); sh.lineTo(W,Lh-.1); sh.quadraticCurveTo(W,Lh,0,Lh+.12); sh.quadraticCurveTo(-W,Lh,-W,Lh-.1); sh.lineTo(-W,-Lh+.1);
    const geo=new THREE.ExtrudeGeometry(sh,{depth:.045,bevelEnabled:true,bevelThickness:.018,bevelSize:.016,bevelSegments:2,curveSegments:10}); geo.rotateX(-Math.PI/2); geo.translate(0,.012,0);
    // upturned tips
    const p=geo.attributes.position; for(let i=0;i<p.count;i++){ const z=Math.abs(p.getZ(i)); if(z>Lh-.32){ const t=(z-(Lh-.32))/.44; p.setY(i,p.getY(i)+t*t*.2); } } geo.computeVertexNormals();
    const top=new THREE.MeshStandardMaterial({map:boardTex(b),roughness:.35,metalness:.15}), edge=new THREE.MeshStandardMaterial({color:b.edge,roughness:.5,metalness:.5,emissive:b.glow,emissiveIntensity:ST.World&&ST.World.T&&ST.World.T.id==='ipo'?.9:.18});
    const m=new THREE.Mesh(geo,[edge,top].length?top:top); m.castShadow=true; grp.add(m);
    const under=new THREE.Mesh(geo,edge); under.scale.set(1.02,.55,1.0); under.position.y=-.012; grp.add(under);
    const bm=new THREE.MeshStandardMaterial({color:0x14161d,roughness:.5,metalness:.4});
    [-.3,.3].forEach(z=>{ const bnd=new THREE.Mesh(new THREE.BoxGeometry(.25,.07,.14),bm); bnd.position.set(0,.1,z); bnd.castShadow=true; grp.add(bnd);
      const st=new THREE.Mesh(new THREE.BoxGeometry(.29,.035,.1),new THREE.MeshStandardMaterial({color:b.glow,roughness:.4,emissive:b.glow,emissiveIntensity:.35})); st.position.set(0,.14,z); grp.add(st); });
    grp.userData.edge=edge; return grp;
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
  R.P={crouch:0,lean:0,air:0,grab:0,twist:0,tuck:0,fall:0,t:0,sit:0,swing:0,look:0};
  function rot(k,ax,ay,az,order){ R.drive[k]=_q2.clone().setFromEuler(new THREE.Euler(ax*RAD,ay*RAD,az*RAD,order||'ZYX')); }
  R.pose=function(p){
    if(!R.ready) return; const P=Object.assign(R.P,p), c=P.crouch, a=P.air, g=P.grab, ln=P.lean, tw=P.twist, tk=P.tuck;
    R.drive={};
    const k=P.sit||0, mx=(a0,b0)=>a0+(b0-a0)*k;   // mx(riding value, seated value)
    // absolute angles in the figure's own frame (+Z faces, +X is its left = the way it travels): rot(bone, pitch, yaw, roll)
    const yawBody=tw*.5, sw=Math.sin(P.t*2.2)*P.swing;
    rot('UpperLegL',mx(-(30+c*40+a*14+g*20),-84+sw*.3),  mx(14+yawBody*.3,7), -4);
    rot('UpperLegR',mx(-(36+c*36+a*14+g*10),-86-sw*.3),  mx(10+yawBody*.3,-5),  4);
    rot('LowerLegL',mx(26+c*34+a*8+g*34,-4+sw),    mx(14,7), 0);
    rot('LowerLegR',mx(32+c*30+a*8+g*24,-8-sw),    mx(10,-5), 0);
    rot('Hips',   mx(2,-6),                    mx(6+yawBody*.4,0),  ln*7);
    rot('Abdomen',mx(10+c*12+tk*16,-4),       mx(18+yawBody,0),    ln*-6);
    rot('Torso',  mx(12+c*10+tk*12,-4),       mx(32+yawBody,0),    ln*-5);
    rot('Chest',  mx(8+tk*8,-2),              mx(46+yawBody,0),    ln*-3);
    rot('Neck',  mx(-(10+c*6+tk*10),-4),      mx(66+yawBody,P.look*.5),    0);
    rot('Head',  mx(-(8+c*4+tk*8),-4),        mx(84+yawBody,P.look),    0);
    // arms: out along the board for balance, wider in the air, tucked in a tuck, the leading hand down to the board in a grab; seated: resting on the lap
    const spread=mx(46+a*24-tk*30-c*8,16)-(R.droop||0)*(1-k*.0);
    rot('UpperArmL', mx(-14-c*6-tk*18+g*30,-28), mx(-6-a*8,-6), -spread+ln*14-g*40);
    rot('UpperArmR', mx(-10-c*6-tk*18,-28),       mx(6+a*8,6),  spread+ln*14);
    rot('LowerArmL', mx(-26-a*10+g*40,-58), 0, -(spread*.35)-g*10);
    rot('LowerArmR', mx(-24-a*10,-58),      0,  spread*.35);
    if(g>0.01&&k<.5){ rot('UpperArmL',20+g*70, -10, -spread+ln*14-g*34-10); rot('LowerArmL',10+g*30, 0, 0); }
    // apply: top-down
    const parentOf=k=>{ let p=R.bones[k].parent; while(p&&!Object.keys(R.bones).some(n=>R.bones[n]===p)) p=p.parent; return p; };
    R.model.updateMatrixWorld(true); const F=R.model.getWorldQuaternion(new THREE.Quaternion());   // the figure's own frame: deltas turn with it
    R.order.forEach(k=>{ const b=R.bones[k], par=b.parent; par.updateWorldMatrix(true,false); par.getWorldQuaternion(_q);
      const d=R.drive[k]; if(!d) return; const target=_q2.copy(F).multiply(d).multiply(R.bind[k]); b.quaternion.copy(_q.invert().multiply(target)); b.updateMatrix(); b.updateMatrixWorld(true); });
    // keep the soles on the board: measure the ankle heights, lower the whole figure
    R.model.position.y=0; R.model.updateMatrixWorld(true);
    let low=1e9; ['FootL','FootR'].forEach(k=>{ if(R.bones[k]){ R.bones[k].getWorldPosition(_v); R.model.parent.worldToLocal(_v); low=Math.min(low,_v.y); } });
    if(low<1e8) R.model.position.y=.205-low;
  };

  /* shared trail ribbon, spray + landing puff */
  R.setLook=function(o){ Object.assign(R.look,o); R.dress(); if(R.current!=='hero'&&R.model) ST.People.dressOutfit(R.model,R.look.jacket,R.look.pants); if(R.helm) R.helm.material.color.setHex(R.look.helmet); };
  ST.Rider=R;
})(window.ST);
