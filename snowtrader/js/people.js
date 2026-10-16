/* Snow Rush: real people. Nine Mixamo characters (textured, rigged, ~14k triangles each) plus Mixamo's Idle / Walk /
   Run / Wave clips, carried over to each skeleton bone by bone (the retarget method of the BuyToday mall game).
   Guests are spawned only near the player (and removed when far), so the crowd never costs more than ~20 figures. */
(function(ST){
  const {hash2}=ST; const {scene}=ST;
  const NAMES=['Ch02','Ch03','Ch07','Ch12','Ch21','Ch22','Ch26','Ch27','Ch33'];
  const P={names:NAMES,tpl:{},pend:{},anims:null,regs:[],active:[],ready:false,count:0};
  const coarse=matchMedia('(pointer:coarse)').matches; const MAXA=coarse?9:22;

  function loadGLTF(url){ return new Promise((res,rej)=>{ const L=new THREE.GLTFLoader(); if(window.MeshoptDecoder) L.setMeshoptDecoder(window.MeshoptDecoder); L.load(url,res,undefined,rej); }); }
  function mixRetarget(clip,srcRoot,tgtRoot){
    const W=root=>{ root.updateMatrixWorld(true); const m={}; root.traverse(o=>{ if(/^mixamorig/.test(o.name)) m[o.name]={b:o,w:o.getWorldQuaternion(new THREE.Quaternion())}; }); return m; };
    const S=W(srcRoot), T=W(tgtRoot), R={};
    Object.keys(T).forEach(n=>{ if(S[n]) R[n]=S[n].w.clone().invert().multiply(T[n].w); });
    const parentR=n=>{ const p=T[n].b.parent; if(p&&R[p.name]) return R[p.name]; return S[n].b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(p.getWorldQuaternion(new THREE.Quaternion())); };
    const tracks=[], q=new THREE.Quaternion(), ip=new THREE.Quaternion();
    clip.tracks.forEach(t=>{ const i=t.name.lastIndexOf('.'), bn=t.name.slice(0,i), prop=t.name.slice(i+1); if(prop!=='quaternion'||!R[bn]) return;
      const v=t.values.slice(), Rb=R[bn]; ip.copy(parentR(bn)).invert(); for(let k=0;k<v.length;k+=4){ q.fromArray(v,k); q.premultiply(ip).multiply(Rb); q.toArray(v,k); }
      tracks.push(new THREE.QuaternionKeyframeTrack(t.name,t.times.slice(),v)); });
    const t0=tracks.reduce((m,t)=>Math.min(m,t.times[0]),Infinity); if(t0>0&&t0<.5) tracks.forEach(t=>t.shift(-t0));   // start at the first key: no twitch on loop
    return new THREE.AnimationClip(clip.name,t0>0&&t0<.5?clip.duration-t0:clip.duration,tracks);
  }
  function skeletonUtils(){ return new Promise((res,rej)=>{ if(THREE.SkeletonUtils) return res(); const s=document.createElement('script'); s.src='lib/skeleton-utils.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
  function loadAnims(){ if(P.anims) return P.anims; return P.anims=Promise.all([skeletonUtils(),loadGLTF('assets/people/anims.glb')]).then(([,g])=>g); }
  function bone(m,n){ let b=null; m.traverse(o=>{ if(!b&&o.name==='mixamorig'+n) b=o; }); return b; }
  /* a template: the loaded character, its four clips retargeted, and the scale that makes it 1.78 m tall */
  P.template=function(name){
    if(P.tpl[name]) return Promise.resolve(P.tpl[name]); if(P.pend[name]) return P.pend[name];
    return P.pend[name]=loadAnims().then(an=>loadGLTF('assets/people/'+name+'.glb').then(g=>{
      const m=g.scene; m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; o.frustumCulled=false; (Array.isArray(o.material)?o.material:[o.material]).forEach(mt=>{ mt.metalness=0; mt.roughness=Math.max(mt.roughness||0,.65); if(mt.map) mt.map.anisotropy=4; }); } });
      m.updateMatrixWorld(true); const top=bone(m,'HeadTop_End')||bone(m,'Head'), fl=bone(m,'LeftFoot'), fr=bone(m,'RightFoot'); const v=new THREE.Vector3();
      const ty=top.getWorldPosition(v).y, fy=Math.min(fl.getWorldPosition(v).y,fr.getWorldPosition(v).y), h=(ty-fy)+.09, k=1.78/h;
      const clips={}; ['Idle','Walk','Run','Wave'].forEach(n=>{ const c=an.animations.find(a=>a.name===n); if(c) clips[n]=mixRetarget(c,an.scene,m); });
      splitOutfit(m); const T={name,scene:m,clips,k,y:-(fy-.09)*k}; P.tpl[name]=T; P.ready=true; return T; }));
  };
  P.preload=async function(n){ for(const nm of NAMES.slice(0,n||5)){ try{ await P.template(nm); }catch(e){ console.warn('people',nm,e); } await new Promise(r=>setTimeout(r,60)); } };


  /* ---- ski outfit: casual clothes become a solid-colour ski kit. Every skinned triangle is sorted by the bone that moves
     it most: torso+arms = jacket, hips+legs = trousers, feet = boots, hands = mitts; head, neck and hair keep their texture. ---- */
  const CATS={jacket:/^(Spine|Spine1|Spine2|LeftShoulder|RightShoulder|LeftArm|RightArm|LeftForeArm|RightForeArm)$/,pants:/^(Hips|LeftUpLeg|RightUpLeg|LeftLeg|RightLeg)$/,boots:/^(LeftFoot|RightFoot|LeftToeBase|RightToeBase|LeftToe_End|RightToe_End)$/,gloves:/^(Left|Right)Hand/};
  function catOf(n){ n=n.replace(/^mixamorig/,''); for(const k in CATS) if(CATS[k].test(n)) return k; return 'skin'; }
  const KEEP=/hair|eye|lash|brow|teeth/i;
  function splitOutfit(root){
    const list=[]; root.traverse(o=>{ if(o.isSkinnedMesh) list.push(o); });
    list.forEach(m=>{
      const mats=Array.isArray(m.material)?m.material:[m.material]; if(mats.some(x=>KEEP.test(x.name||''))) return;
      const g=m.geometry, a=g.attributes; if(!a.skinIndex||!a.skinWeight) return; const si=a.skinIndex.array, sw=a.skinWeight.array, bones=m.skeleton.bones;
      const idx=g.index?g.index.array:Array.from({length:a.position.count},(_,i)=>i), n=a.position.count, vcat=new Array(n);
      for(let v=0;v<n;v++){ let best=0,bw=-1; for(let q=0;q<4;q++){ const w=sw[v*4+q]; if(w>bw){ bw=w; best=si[v*4+q]; } } vcat[v]=catOf(bones[best]?bones[best].name:''); }
      const buckets={}; for(let t=0;t<idx.length;t+=3){ const c=[vcat[idx[t]],vcat[idx[t+1]],vcat[idx[t+2]]]; const k=(c[0]===c[1]||c[0]===c[2])?c[0]:c[1]; (buckets[k]=buckets[k]||[]).push(idx[t],idx[t+1],idx[t+2]); }
      Object.keys(buckets).forEach(k=>{ const geo=new THREE.BufferGeometry(); for(const name in a) geo.setAttribute(name,a[name]); geo.setIndex(new THREE.BufferAttribute(new Uint32Array(buckets[k]),1)); geo.computeBoundingSphere();
        const mesh=new THREE.SkinnedMesh(geo,k==='skin'?mats[0]:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.6,metalness:.02,skinning:true})); mesh.userData.cat=k; mesh.castShadow=true; mesh.receiveShadow=true; mesh.frustumCulled=false;
        mesh.position.copy(m.position); mesh.quaternion.copy(m.quaternion); mesh.scale.copy(m.scale); m.parent.add(mesh); mesh.bind(m.skeleton,m.bindMatrix); });
      m.parent.remove(m); });
  }
  const JACKETS=[0xffc21a,0xe8283f,0x2f79ff,0xf2f5ff,0x16c97a,0xff7a1a,0xd63bff,0x1fc8e8,0x111418], PANTS=[0x15171d,0x1fa35a,0x23304a,0x3a3f4a,0xd9d9e0,0x6b2d2d];
  function dressOutfit(model,jacket,pants){ model.traverse(o=>{ if(!o.isSkinnedMesh||!o.userData.cat||o.userData.cat==='skin') return; const c=o.userData.cat; const mt=o.material.clone();
      mt.color.setHex(c==='jacket'?jacket:c==='pants'?pants:0x0e1015).convertSRGBToLinear(); mt.roughness=c==='jacket'?.5:.7; mt.metalness=0; mt.map=null; o.material=mt; }); }
  P.dressOutfit=dressOutfit; P.JACKETS=JACKETS; P.PANTS=PANTS;

  const BEAN=[0xff3d6e,0x2f8bff,0xffc83a,0x16e08a,0xff7a1a,0xb04bff,0x22d3ee,0xf5f5f5,0xe11d48];
  const beanGeo=new THREE.SphereGeometry(.125,14,10,0,Math.PI*2,0,Math.PI*.55), pomGeo=new THREE.SphereGeometry(.045,8,6);
  function winterize(m,seed){   // a hat so a guest in street clothes reads as a skier
    const head=bone(m,'Head'); if(!head) return; m.updateMatrixWorld(true); const v=new THREE.Vector3(); head.getWorldPosition(v);
    const mat=new THREE.MeshStandardMaterial({color:BEAN[seed%BEAN.length],roughness:.9}); const hat=new THREE.Mesh(beanGeo,mat); hat.position.copy(v); hat.position.y+=.105; hat.scale.set(1,1.15,1.1); hat.castShadow=true;
    const pom=new THREE.Mesh(pomGeo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:1})); pom.position.set(0,.14,0); hat.add(pom);
    scene.add(hat); head.attach(hat); }
  function spawn(r){
    const T=P.tpl[r.ch]; if(!T) return null;
    const m=THREE.SkeletonUtils.clone(T.scene), g=new THREE.Group(); g.add(m); dressOutfit(m,JACKETS[Math.floor(hash2(r.id,13)*JACKETS.length)],PANTS[Math.floor(hash2(r.id,17)*PANTS.length)]); m.scale.multiplyScalar(T.k*(r.sc||1)); m.position.y=T.y*(r.sc||1); scene.add(g);
    const mixer=new THREE.AnimationMixer(m), acts={}; Object.keys(T.clips).forEach(n=>{ const a=mixer.clipAction(T.clips[n]); a.setLoop(THREE.LoopRepeat,Infinity); acts[n]=a; });
    const a=acts[r.type]||acts.Idle; a.play(); a.time=hash2(r.id,5)*a.getClip().duration; mixer.update(0);
    g.position.set(r.x,r.y,r.z); g.rotation.y=r.ry||0; g.updateMatrixWorld(true); winterize(m,r.id);
    return {r,g,m,mixer,t:Math.random()*10,dir:1}; }
  function kill(a){ try{ a.mixer.stopAllAction(); a.mixer.uncacheRoot(a.m); }catch(e){} scene.remove(a.g); a.g.traverse(o=>{ if(o.isMesh&&o.parent&&o.geometry&&o.geometry.userData.hat) o.geometry.dispose(); }); }
  let rid=1;
  P.add=function(ci,spec){ const W=ST.World; spec.id=rid++; spec.ci=ci; spec.y=W.groundY(spec.x,spec.z); spec.ch=NAMES[Math.floor(hash2(spec.id,9)*NAMES.length)]; P.regs.push(spec); };
  P.clear=function(ci){ P.regs=P.regs.filter(r=>{ if(r.ci===ci){ if(r.act){ kill(r.act); P.active=P.active.filter(x=>x!==r.act); } return false; } return true; }); };
  P.reset=function(){ P.active.forEach(kill); P.active=[]; P.regs=[]; };
  let warm=0;
  P.update=function(dt,px,pz){
    // spawn near, despawn far
    for(let i=0;i<P.regs.length;i++){ const r=P.regs[i], d=Math.hypot(r.x-px,r.z-pz);
      if(!r.act&&d<(coarse?90:140)&&P.active.length<MAXA){ if(!P.tpl[r.ch]){ const any=Object.keys(P.tpl)[0]; if(!any){ P.template(r.ch).catch(()=>{}); continue; } r.ch=any; } r.act=spawn(r); if(r.act) P.active.push(r.act); }
      else if(r.act&&d>200){ kill(r.act); P.active=P.active.filter(x=>x!==r.act); r.act=null; } }
    for(let i=0;i<P.active.length;i++){ const a=P.active[i]; a.mixer.update(dt); const r=a.r;
      if(r.type==='Walk'&&r.seg){ a.t+=dt*1.15*a.dir; const L=Math.hypot(r.seg[0],r.seg[1]); let u=a.t/L; if(u>1){ a.dir=-1; a.t=L; u=1; } if(u<0){ a.dir=1; a.t=0; u=0; }
        const x=r.x+r.seg[0]*u, z=r.z+r.seg[1]*u; a.g.position.set(x,ST.World.groundY(x,z),z); a.g.rotation.y=Math.atan2(r.seg[0]*a.dir,r.seg[1]*a.dir); } }
  };
  ST.People=P;
})(window.ST);
