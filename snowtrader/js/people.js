/* Snow Rush: real people. Nine Mixamo characters (textured, rigged, ~14k triangles each) plus Mixamo's Idle / Walk /
   Run / Wave clips, carried over to each skeleton bone by bone (the retarget method of the BuyToday mall game), and a
   sitting pose made here from the Idle pose (thighs forward, shins down).
   Level of detail: every registered person can be shown two ways. The nearest few (14 on a desktop, 7 on a phone) are full
   skinned figures; everyone else within ~230 m is a 360-triangle stand-in drawn with all the others in one instanced mesh,
   in the same jacket, trousers and hat, legs and arms swinging when they walk. A person can have a behaviour (beh) that
   moves it each frame (village walkers, the lift queue...); the figure, whichever it is, just follows. */
(function(ST){
  const {hash2,clamp}=ST; const {scene}=ST;
  const NAMES=['Ch02','Ch03','Ch07','Ch12','Ch21','Ch22','Ch26','Ch27','Ch33'];
  const P={names:NAMES,tpl:{},pend:{},anims:null,regs:[],active:[],ready:false,count:0};
  const coarse=matchMedia('(pointer:coarse)').matches; const MAXA=coarse?7:14;   // full figures alive at once (the nearest)
  const R_DET=coarse?60:95, R_IMP=coarse?170:240;                               // full figures within R_DET, stand-ins within R_IMP

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
      splitOutfit(m); mergeParts(m); const T={name,scene:m,clips,k,y:-(fy-.09)*k}; P.tpl[name]=T; P.ready=true; return T; }));
  };
  /* sitting: the Idle pose with each thigh turned forward and each shin back down (turns made in world space, so they suit
     every skeleton); the figure is lowered so its feet stay on the ground (T.sitY) */
  function sitClip(T){ if(T.sit) return T.sit; const m=THREE.SkeletonUtils.clone(T.scene), mx=new THREE.AnimationMixer(m); mx.clipAction(T.clips.Idle).play(); mx.update(0); m.updateMatrixWorld(true);
    const X=new THREE.Vector3(1,0,0), _a=new THREE.Quaternion(), _b=new THREE.Quaternion(), _c=new THREE.Quaternion(), v=new THREE.Vector3();
    const turn=(n,ang)=>{ const b=bone(m,n); if(!b) return; _a.setFromAxisAngle(X,ang); b.getWorldQuaternion(_b); _a.multiply(_b); b.parent.getWorldQuaternion(_c); b.quaternion.copy(_c.invert().multiply(_a)); b.updateMatrixWorld(true); };
    const footY=()=>{ m.updateMatrixWorld(true); return Math.min(bone(m,'LeftFoot').getWorldPosition(v).y,bone(m,'RightFoot').getWorldPosition(v).y); }, f0=footY();
    ['Left','Right'].forEach(sd=>{ turn(sd+'UpLeg',-1.48); turn(sd+'Leg',1.42); turn(sd+'Arm',-.42); turn(sd+'ForeArm',-.75); }); turn('Spine1',.08);
    T.sitY=-(footY()-f0)*T.k;   // metres to lower the figure
    const tracks=[]; m.traverse(o=>{ if(o.isBone){ const q=o.quaternion; tracks.push(new THREE.QuaternionKeyframeTrack(o.name+'.quaternion',[0,1],[q.x,q.y,q.z,q.w,q.x,q.y,q.z,q.w])); } });
    mx.stopAllAction(); return T.sit=new THREE.AnimationClip('Sit',1,tracks); }
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
  /* Draw calls: a character arrives as 5-18 skinned pieces. All of them hang on the same 65 bones, so they are merged: every
     piece of clothing into ONE mesh whose colours come from uniforms (a per-vertex category picks jacket, trousers, boots or
     mitts), and the textured pieces (skin, hair) into one mesh per material. 12-18 draws per figure become 2-4. */
  const CAT_ID={jacket:0,pants:1,boots:2,gloves:3};
  function outfitMaterial(){ const m=new THREE.MeshStandardMaterial({color:0xffffff,skinning:true,roughness:.62,metalness:0});
    const cols=m.userData.cols={jacket:new THREE.Color(1,1,1),pants:new THREE.Color(.1,.1,.12),boots:new THREE.Color(.03,.03,.04),gloves:new THREE.Color(.03,.03,.04)};
    m.onBeforeCompile=sh=>{ sh.uniforms.uJ={value:cols.jacket}; sh.uniforms.uP={value:cols.pants}; sh.uniforms.uB={value:cols.boots}; sh.uniforms.uG={value:cols.gloves};
      sh.vertexShader='attribute float aCat;\nvarying float vCat;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vCat=aCat;');
      sh.fragmentShader='uniform vec3 uJ,uP,uB,uG;\nvarying float vCat;\n'+sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.rgb*=vCat<.5?uJ:vCat<1.5?uP:vCat<2.5?uB:uG;'); };
    m.customProgramCacheKey=()=>'st-outfit'; return m; }
  function sameSkeleton(a,b){ if(a.skeleton.bones.length!==b.skeleton.bones.length) return false; for(let i=0;i<a.skeleton.bones.length;i++){ if(a.skeleton.bones[i]!==b.skeleton.bones[i]) return false; if(!a.skeleton.boneInverses[i].equals(b.skeleton.boneInverses[i])) return false; } return a.bindMatrix.equals(b.bindMatrix); }
  // the models are compressed (meshopt): positions, normals, UVs and skin weights can be normalised integers; read them as floats
  const NORM={Int8Array:127,Uint8Array:255,Int16Array:32767,Uint16Array:65535,Int32Array:2147483647,Uint32Array:4294967295};
  function rd(at,i,k){ const v=at.isInterleavedBufferAttribute?at.data.array[i*at.data.stride+at.offset+k]:at.array[i*at.itemSize+k]; if(!at.normalized) return v; const m=NORM[at.array.constructor.name]; return m?Math.max(v/m,-1):v; }
  function mergeGeoms(list,withUv,cat){ let nv=0,ni=0; list.forEach(m=>{ const g=m.geometry; nv+=g.attributes.position.count; ni+=g.index?g.index.count:g.attributes.position.count; });
    const pos=new Float32Array(nv*3), nor=new Float32Array(nv*3), si=new Float32Array(nv*4), sw=new Float32Array(nv*4), uv=withUv?new Float32Array(nv*2):null, ct=cat?new Float32Array(nv):null, idx=new Uint32Array(ni); let vo=0, io=0;
    list.forEach(m=>{ const g=m.geometry, a=g.attributes, n=a.position.count;
      for(let i=0;i<n;i++){ const o=vo+i; for(let k=0;k<3;k++){ pos[o*3+k]=rd(a.position,i,k); nor[o*3+k]=rd(a.normal,i,k); }
        let ws=0; for(let k=0;k<4;k++){ si[o*4+k]=rd(a.skinIndex,i,k); sw[o*4+k]=rd(a.skinWeight,i,k); ws+=sw[o*4+k]; } if(ws>0&&Math.abs(ws-1)>1e-3) for(let k=0;k<4;k++) sw[o*4+k]/=ws;
        if(uv&&a.uv){ uv[o*2]=rd(a.uv,i,0); uv[o*2+1]=rd(a.uv,i,1); } if(ct) ct[o]=CAT_ID[m.userData.cat]; }
      if(g.index){ const ix=g.index.array; for(let i=0;i<ix.length;i++) idx[io+i]=ix[i]+vo; io+=ix.length; } else { for(let i=0;i<n;i++) idx[io+i]=vo+i; io+=n; }
      vo+=n; });
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(pos,3)); geo.setAttribute('normal',new THREE.BufferAttribute(nor,3)); geo.setAttribute('skinIndex',new THREE.BufferAttribute(si,4)); geo.setAttribute('skinWeight',new THREE.BufferAttribute(sw,4));
    if(uv) geo.setAttribute('uv',new THREE.BufferAttribute(uv,2)); if(ct) geo.setAttribute('aCat',new THREE.BufferAttribute(ct,1)); geo.setIndex(new THREE.BufferAttribute(idx,1)); geo.computeBoundingSphere(); return geo; }
  function mergeParts(root){
    const list=[]; root.traverse(o=>{ if(o.isSkinnedMesh&&!o.morphTargetInfluences) list.push(o); }); if(list.length<2) return;
    const base=list[0]; if(!list.every(m=>sameSkeleton(m,base))) return;   // only if they truly share the skeleton (same bones, inverse binds and bind matrix:
    // a skinned vertex ends up at sum(w * bone * inverseBind * bindMatrix * v), so pieces under different nodes still merge)
    const host=base.parent, hpos=base.position.clone(), hq=base.quaternion.clone(), hs=base.scale.clone(), skel=base.skeleton, bindM=base.bindMatrix.clone();
    const groups=new Map(); list.forEach(m=>{ const c=m.userData.cat, key=(c&&c!=='skin')?'outfit':'mat:'+m.material.uuid; (groups.get(key)||groups.set(key,[]).get(key)).push(m); });
    groups.forEach((ms,key)=>{ if(key!=='outfit'&&ms.length<2) return; const outfit=key==='outfit', withUv=ms.every(m=>m.geometry.attributes.uv);
      const geo=mergeGeoms(ms,withUv,outfit), mat=outfit?outfitMaterial():ms[0].material, mesh=new THREE.SkinnedMesh(geo,mat);
      mesh.userData.cat=outfit?'outfit':ms[0].userData.cat; mesh.castShadow=true; mesh.receiveShadow=true; mesh.frustumCulled=false;
      mesh.position.copy(hpos); mesh.quaternion.copy(hq); mesh.scale.copy(hs); host.add(mesh); mesh.bind(skel,bindM);
      ms.forEach(m=>{ if(m.parent) m.parent.remove(m); }); }); }

  const JACKETS=[0xffc21a,0xe8283f,0x2f79ff,0xf2f5ff,0x16c97a,0xff7a1a,0xd63bff,0x1fc8e8,0x111418], PANTS=[0x15171d,0x1fa35a,0x23304a,0x3a3f4a,0xd9d9e0,0x6b2d2d];
  function dressOutfit(model,jacket,pants){ model.traverse(o=>{ if(!o.isSkinnedMesh||!o.userData.cat||o.userData.cat==='skin') return; const c=o.userData.cat;
      if(c==='outfit'){ if(!o.userData.own){ o.material=outfitMaterial(); o.userData.own=true; } const C=o.material.userData.cols; C.jacket.setHex(jacket).convertSRGBToLinear(); C.pants.setHex(pants).convertSRGBToLinear(); return; }
      const mt=o.material.clone();
      mt.color.setHex(c==='jacket'?jacket:c==='pants'?pants:0x0e1015).convertSRGBToLinear(); mt.roughness=c==='jacket'?.5:.7; mt.metalness=0; mt.map=null; o.material=mt; }); }
  P.dressOutfit=dressOutfit; P.JACKETS=JACKETS; P.PANTS=PANTS;

  const BEAN=[0xff3d6e,0x2f8bff,0xffc83a,0x16e08a,0xff7a1a,0xb04bff,0x22d3ee,0xf5f5f5,0xe11d48];
  const beanGeo=new THREE.SphereGeometry(.125,14,10,0,Math.PI*2,0,Math.PI*.55), pomGeo=new THREE.SphereGeometry(.045,8,6);
  function winterize(m,seed){   // a hat so a guest in street clothes reads as a skier
    const head=bone(m,'Head'); if(!head) return; m.updateMatrixWorld(true); const v=new THREE.Vector3(); head.getWorldPosition(v);
    // beanie and pompom as one mesh (vertex colours), no shadow: one small draw per figure instead of four
    const c=new THREE.Color(BEAN[seed%BEAN.length]), g=hatGeo(c), hat=new THREE.Mesh(g,hatMat); g.userData.hat=1; hat.position.copy(v); hat.position.y+=.105; hat.scale.set(1,1.15,1.1);
    scene.add(hat); head.attach(hat); }
  const hatMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9});
  function hatGeo(c){ const a=beanGeo.clone(), b=pomGeo.clone(); b.translate(0,.14,0); const n1=a.attributes.position.count, n2=b.attributes.position.count, pos=new Float32Array((n1+n2)*3), nor=new Float32Array((n1+n2)*3), col=new Float32Array((n1+n2)*3);
    pos.set(a.attributes.position.array,0); pos.set(b.attributes.position.array,n1*3); nor.set(a.attributes.normal.array,0); nor.set(b.attributes.normal.array,n1*3);
    for(let i=0;i<n1+n2;i++){ const w=i>=n1; col[i*3]=w?1:c.r; col[i*3+1]=w?1:c.g; col[i*3+2]=w?1:c.b; }
    const ia=a.index.array, ib=b.index.array, idx=new Uint32Array(ia.length+ib.length); idx.set(ia,0); for(let i=0;i<ib.length;i++) idx[ia.length+i]=ib[i]+n1;
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.BufferAttribute(nor,3)); g.setAttribute('color',new THREE.BufferAttribute(col,3)); g.setIndex(new THREE.BufferAttribute(idx,1)); g.computeBoundingSphere(); a.dispose(); b.dispose(); return g; }
  function spawn(r){
    const T=P.tpl[r.ch]; if(!T) return null;
    const m=THREE.SkeletonUtils.clone(T.scene), g=new THREE.Group(); g.add(m); dressOutfit(m,JACKETS[Math.floor(hash2(r.id,13)*JACKETS.length)],PANTS[Math.floor(hash2(r.id,17)*PANTS.length)]); m.scale.multiplyScalar(T.k*(r.sc||1)); m.position.y=T.y*(r.sc||1); scene.add(g);
    const mixer=new THREE.AnimationMixer(m), acts={}; Object.keys(T.clips).forEach(n=>{ const a=mixer.clipAction(T.clips[n]); a.setLoop(THREE.LoopRepeat,Infinity); acts[n]=a; });
    const want=r.anim||r.type; if(want==='Sit') acts.Sit=mixer.clipAction(sitClip(T)); const a=acts[want]||acts.Idle; a.play(); a.time=hash2(r.id,5)*a.getClip().duration; mixer.update(0);
    g.position.set(r.x,r.y+(want==='Sit'?T.sitY:0),r.z); g.rotation.y=r.ry||0; g.updateMatrixWorld(true); winterize(m,r.id);
    return {r,g,m,mixer,acts,T,cur:acts[want]?want:'Idle',t:Math.random()*10,dir:1}; }
  function setAnim(a,name){ if(a.cur===name) return; if(name==='Sit'&&!a.acts.Sit) a.acts.Sit=a.mixer.clipAction(sitClip(a.T)); const act=a.acts[name]||a.acts.Idle, prev=a.acts[a.cur];
    act.reset(); act.setLoop(THREE.LoopRepeat,Infinity); act.play(); if(prev&&prev!==act) prev.crossFadeTo(act,name==='Sit'||a.cur==='Sit'?.2:.35,false); a.cur=name; }
  function kill(a){ try{ a.mixer.stopAllAction(); a.mixer.uncacheRoot(a.m); }catch(e){} scene.remove(a.g); a.g.traverse(o=>{ if(o.isMesh&&o.geometry&&o.geometry.userData.hat){ o.geometry.dispose(); if(o.parent) o.parent.remove(o); } }); }
  let rid=1;
  P.add=function(ci,spec){ const W=ST.World; spec.id=rid++; spec.ci=ci; spec.y=spec.yFix!=null?spec.yFix:W.groundY(spec.x,spec.z); spec.ch=NAMES[Math.floor(hash2(spec.id,9)*NAMES.length)]; P.regs.push(spec); };
  P.clear=function(ci){ P.regs=P.regs.filter(r=>{ if(r.ci===ci){ if(r.act){ kill(r.act); P.active=P.active.filter(x=>x!==r.act); } return false; } return true; }); };
  P.reset=function(){ P.active.forEach(kill); P.active=[]; P.regs=[]; };
  /* the old guests' walk: back and forth along a segment from where they were placed */
  function segWalk(r,dt){ if(r.x0===undefined){ r.x0=r.x; r.z0=r.z; r.st=0; r.sd=1; } r.st+=dt*1.15*r.sd; const L=Math.hypot(r.seg[0],r.seg[1]); let u=r.st/L; if(u>1){ r.sd=-1; r.st=L; u=1; } if(u<0){ r.sd=1; r.st=0; u=0; }
    r.x=r.x0+r.seg[0]*u; r.z=r.z0+r.seg[1]*u; r.y=ST.World.groundY(r.x,r.z); r.ry=Math.atan2(r.seg[0]*r.sd,r.seg[1]*r.sd); r.spd=1.15; r.anim='Walk'; }
  let rankT=0;
  P.update=function(dt,px,pz){
    P.frame=(P.frame||0)+1; P.time=(P.time||0)+dt;
    for(let i=0;i<P.regs.length;i++){ const r=P.regs[i]; if(r.beh) r.beh(r,dt,P.time); else if(r.type==='Walk'&&r.seg) segWalk(r,dt); const dx=r.x-px, dz=r.z-pz; r.d2=dx*dx+dz*dz; }
    // who gets a full figure: the nearest MAXA within R_DET (one that has a figure keeps it until it is ~20% farther than a rival)
    rankT-=dt; if(rankT<=0||!P.want){ rankT=.3; const cand=[]; for(const r of P.regs) if(!r.hide&&r.d2<R_DET*R_DET) cand.push(r);
      cand.sort((a,b)=>(a.act?a.d2*.7:a.d2)-(b.act?b.d2*.7:b.d2)); P.want=new Set(cand.slice(0,MAXA));
      for(const r of P.regs){ if(r.act&&!P.want.has(r)){ kill(r.act); P.active=P.active.filter(x=>x!==r.act); r.act=null; } } }
    let budget=2;   // cloning a figure costs a few ms: at most two a frame
    for(const r of P.want){ if(budget<=0) break; if(r.act||r.hide) continue; if(!P.tpl[r.ch]){ const any=Object.keys(P.tpl)[0]; if(!any){ P.template(r.ch).catch(()=>{}); break; } r.ch=any; } r.act=spawn(r); if(r.act){ P.active.push(r.act); budget--; } }
    for(let i=0;i<P.active.length;i++){ const a=P.active[i], r=a.r, d=Math.sqrt(r.d2), every=d<45?1:d<90?2:3, an=r.anim||r.type;
      a.g.visible=!r.hide; if(r.hide) continue; setAnim(a,an); a.g.position.set(r.x,r.y+(a.cur==='Sit'?a.T.sitY||0:0),r.z); a.g.rotation.y=r.ry||0;
      if(a.cur==='Walk') a.acts.Walk.timeScale=clamp((r.spd||1.15)/1.2,.6,1.5);
      a.acc=(a.acc||0)+dt; if(P.frame%every===0){ a.mixer.update(a.acc); a.acc=0; }
      const sh=d<32; if(a.sh!==sh){ a.sh=sh; a.m.traverse(o=>{ if(o.isMesh) o.castShadow=sh; }); } }
    updateStandIns(dt);
  };
  /* ---------- stand-ins: one instanced mesh for every distant person (and one for the seated) ----------
     A box-and-sphere figure 1.78 m tall. Vertex attribute grp = what moves (0 body, 1/2 legs, 3/4 arms), col = what colour
     (0 jacket, 1 trousers, 2 skin, 3 hat, 4 boots and gloves); per instance: jacket, trousers, hat colours and the walk phase. */
  function figureGeo(sit,board){ const parts=[], add=(g,grp,col)=>{ const n=g.attributes.position.count; g.setAttribute('grp',new THREE.Float32BufferAttribute(new Array(n).fill(grp),1)); g.setAttribute('col',new THREE.Float32BufferAttribute(new Array(n).fill(col),1)); if(g.index) g=g.toNonIndexed(); parts.push(g); };
    const bx=(w,h,d,x,y,z,grp,col,rx)=>{ const g=new THREE.BoxGeometry(w,h,d); if(rx) g.rotateX(rx); g.translate(x,y,z); add(g,grp,col); };
    const hipY=sit?.5:.92, dy=hipY-.92;
    [[1,.1],[2,-.1]].forEach(([grp,x])=>{ if(sit){ bx(.16,.17,.46,x,hipY,.2,grp,1); bx(.15,.46,.17,x,.25,.42,grp,1); bx(.16,.12,.27,x,.06,.46,grp,4); }
      else { bx(.16,.84,.18,x,.5,0,grp,1); bx(.16,.12,.27,x,.06,.04,grp,4); } });
    bx(.37,.32,.23,0,1.0+dy,0,0,0); bx(.44,.4,.26,0,1.32+dy,0,0,0); bx(.2,.08,.2,0,1.54+dy,0,0,0);
    [[3,.27],[4,-.27]].forEach(([grp,x])=>{ if(sit){ bx(.11,.32,.12,x,1.32+dy,.02,grp,0); bx(.1,.12,.3,x,1.12+dy,.16,grp,0); bx(.09,.1,.1,x,1.1+dy,.33,grp,4); }
      else { bx(.11,.33,.12,x,1.33,0,grp,0); bx(.1,.29,.11,x,1.04,0,grp,0); bx(.09,.1,.09,x,.85,0,grp,4); } });
    const hd=new THREE.SphereGeometry(.115,10,8); hd.translate(0,1.66+dy,.01); add(hd,0,2); const hat=new THREE.SphereGeometry(.125,10,6,0,Math.PI*2,0,Math.PI*.5); hat.translate(0,1.69+dy,0); add(hat,0,3);
    const pom=new THREE.SphereGeometry(.045,6,5); pom.translate(0,1.83+dy,0); add(pom,0,3);
    if(board){ bx(1.45,.035,.27,0,-.01,.46,0,4); bx(.2,.06,.25,.25,.03,.46,0,3); bx(.2,.06,.25,-.25,.03,.46,0,3); }   // a snowboard hanging from the boots (bindings in the hat colour)
    let n=0; parts.forEach(g=>n+=g.attributes.position.count); const pos=new Float32Array(n*3), nor=new Float32Array(n*3), gr=new Float32Array(n), cl=new Float32Array(n); let o=0;
    parts.forEach(g=>{ const c=g.attributes.position.count; pos.set(g.attributes.position.array,o*3); nor.set(g.attributes.normal.array,o*3); gr.set(g.attributes.grp.array,o); cl.set(g.attributes.col.array,o); o+=c; });
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(pos,3)); geo.setAttribute('normal',new THREE.BufferAttribute(nor,3)); geo.setAttribute('grp',new THREE.BufferAttribute(gr,1)); geo.setAttribute('col',new THREE.BufferAttribute(cl,1)); return geo; }
  function standInMat(){ const m=new THREE.MeshStandardMaterial({roughness:.75,metalness:0});
    m.onBeforeCompile=sh=>{ sh.vertexShader=sh.vertexShader.replace('#include <common>',`#include <common>
        attribute float grp; attribute float col; attribute vec3 iJ; attribute vec3 iP; attribute vec3 iH; attribute vec2 iW; varying vec3 vPC;
        vec3 swingX(vec3 p,float py,float a){ p.y-=py; float c=cos(a), s=sin(a); return vec3(p.x,p.y*c-p.z*s,p.y*s+p.z*c)+vec3(0.,py,0.); }`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        float sw=sin(iW.x)*iW.y;
        if(grp==1.) transformed=swingX(transformed,.92,sw); else if(grp==2.) transformed=swingX(transformed,.92,-sw);
        else if(grp==3.) transformed=swingX(transformed,1.46,-sw*.8); else if(grp==4.) transformed=swingX(transformed,1.46,sw*.8);
        transformed.y+=abs(cos(iW.x))*.035*step(.01,iW.y);
        vPC=col<.5?iJ:col<1.5?iP:col<2.5?vec3(.86,.62,.47):col<3.5?iH:vec3(.035,.035,.04);`);
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vPC;').replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.rgb*=vPC;'); };
    m.customProgramCacheKey=()=>'st-standin'; return m; }
  const SI=[false,true].map(sit=>{ const N=sit?48:180, geo=figureGeo(sit), mk=n=>new THREE.InstancedBufferAttribute(new Float32Array(N*n),n);
    geo.setAttribute('iJ',mk(3)); geo.setAttribute('iP',mk(3)); geo.setAttribute('iH',mk(3)); geo.setAttribute('iW',mk(2));
    const im=new THREE.InstancedMesh(geo,standInMat(),N); im.count=0; im.frustumCulled=false; im.castShadow=false; im.receiveShadow=true; scene.add(im); return {im,geo,N}; });
  const _m=new THREE.Matrix4(), _q=new THREE.Quaternion(), _p=new THREE.Vector3(), _s=new THREE.Vector3(1,1,1), _y=new THREE.Vector3(0,1,0), _cc=new THREE.Color();
  const lin=(hex,arr,i)=>{ _cc.setHex(hex).convertSRGBToLinear(); arr[i*3]=_cc.r; arr[i*3+1]=_cc.g; arr[i*3+2]=_cc.b; };
  function updateStandIns(dt){ const cnt=[0,0];
    for(const r of P.regs){ if(r.act&&r.act.g.visible||r.hide||r.d2>R_IMP*R_IMP) continue; const sit=(r.anim||r.type)==='Sit'?1:0, S=SI[sit], i=cnt[sit]; if(i>=S.N) continue; cnt[sit]++;
      _q.setFromAxisAngle(_y,r.ry||0); _p.set(r.x,r.y,r.z); _m.compose(_p,_q,_s); S.im.setMatrixAt(i,_m);
      const g=S.geo.attributes; lin(JACKETS[Math.floor(hash2(r.id,13)*JACKETS.length)],g.iJ.array,i); lin(PANTS[Math.floor(hash2(r.id,17)*PANTS.length)],g.iP.array,i); lin(BEAN[r.id%BEAN.length],g.iH.array,i);
      const walk=(r.anim||r.type)==='Walk'; r.wph=(r.wph||hash2(r.id,3)*6.28)+(walk?(r.spd||1.15)*dt*4.4:0); g.iW.array[i*2]=r.wph; g.iW.array[i*2+1]=walk?.42:0; }
    SI.forEach((S,k)=>{ S.im.count=cnt[k]; S.im.instanceMatrix.needsUpdate=true; ['iJ','iP','iH','iW'].forEach(n=>S.geo.attributes[n].needsUpdate=true); }); }
  P.standIns=()=>SI.map(S=>S.im.count);
  /* a snowboarder in a riding stance: board along +Z, body side-on facing +X (a goofy rider; turn it round for a regular one) */
  function riderGeo(){ const parts=[], add=(g,col)=>{ const n=g.attributes.position.count; g.setAttribute('grp',new THREE.Float32BufferAttribute(new Array(n).fill(0),1)); g.setAttribute('col',new THREE.Float32BufferAttribute(new Array(n).fill(col),1)); if(g.index) g=g.toNonIndexed(); parts.push(g); };
    const bx=(w,h,d,x,y,z,col,rz,rx)=>{ const g=new THREE.BoxGeometry(w,h,d); if(rx) g.rotateX(rx); if(rz) g.rotateZ(rz); g.translate(x,y,z); add(g,col); };
    bx(.28,.03,1.55,0,.02,0,3); [-1,1].forEach(sd=>{ bx(.27,.13,.15,0,.1,sd*.24,4); bx(.14,.46,.15,.09,.37,sd*.22,1,-.4); bx(.15,.42,.16,.07,.72,sd*.17,1,.55);
      bx(.11,.11,.48,.05,1.24,sd*.4,0,0,sd*.35); bx(.1,.1,.1,.05,1.12,sd*.62,4); });
    bx(.24,.2,.36,-.02,.93,0,1); bx(.27,.5,.42,.05,1.2,0,0,-.2); bx(.12,.08,.12,.1,1.47,0,2);
    const hd=new THREE.SphereGeometry(.115,10,8); hd.translate(.11,1.58,0); add(hd,2); const hat=new THREE.SphereGeometry(.125,10,6,0,Math.PI*2,0,Math.PI*.5); hat.translate(.11,1.61,0); add(hat,3);
    let n=0; parts.forEach(g=>n+=g.attributes.position.count); const pos=new Float32Array(n*3), nor=new Float32Array(n*3), gr=new Float32Array(n), cl=new Float32Array(n); let o=0;
    parts.forEach(g=>{ const c=g.attributes.position.count; pos.set(g.attributes.position.array,o*3); nor.set(g.attributes.normal.array,o*3); gr.set(g.attributes.grp.array,o); cl.set(g.attributes.col.array,o); o+=c; });
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(pos,3)); geo.setAttribute('normal',new THREE.BufferAttribute(nor,3)); geo.setAttribute('grp',new THREE.BufferAttribute(gr,1)); geo.setAttribute('col',new THREE.BufferAttribute(cl,1)); return geo; }
  function instSet(geo,N,shadow){ const mk=n=>new THREE.InstancedBufferAttribute(new Float32Array(N*n),n); geo.setAttribute('iJ',mk(3)); geo.setAttribute('iP',mk(3)); geo.setAttribute('iH',mk(3)); geo.setAttribute('iW',mk(2));
    const im=new THREE.InstancedMesh(geo,standInMat(),N); im.count=0; im.frustumCulled=false; im.castShadow=!!shadow; scene.add(im); const a=geo.attributes;
    return {im,set(i,p,q,seed){ _m.compose(p,q,_s); im.setMatrixAt(i,_m); lin(JACKETS[Math.floor(hash2(seed,13)*JACKETS.length)],a.iJ.array,i); lin(PANTS[Math.floor(hash2(seed,17)*PANTS.length)],a.iP.array,i); lin(BEAN[seed%BEAN.length],a.iH.array,i); },
      done(n){ im.count=n; im.instanceMatrix.needsUpdate=true; a.iJ.needsUpdate=a.iP.needsUpdate=a.iH.needsUpdate=true; }}; }
  P.slopeRiders=N=>instSet(riderGeo(),N,true);
  /* seated riders for the chairlift, boards on their feet: set(i, position, quaternion, seed) then done(n) */
  P.seatedRiders=N=>instSet(figureGeo(true,true),N,true);

  ST.People=P;
})(window.ST);
