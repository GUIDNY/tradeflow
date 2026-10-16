/* Snow Rush: real people. Nine Mixamo characters (textured, rigged, ~14k triangles each) plus Mixamo's Idle / Walk /
   Run / Wave clips, carried over to each skeleton bone by bone (the retarget method of the BuyToday mall game).
   Guests are spawned only near the player (and removed when far), so the crowd never costs more than ~20 figures. */
(function(ST){
  const {hash2}=ST; const {scene}=ST;
  const NAMES=['Ch02','Ch03','Ch07','Ch12','Ch21','Ch22','Ch26','Ch27','Ch33'];
  const P={names:NAMES,tpl:{},pend:{},anims:null,regs:[],active:[],ready:false,count:0};
  const coarse=matchMedia('(pointer:coarse)').matches; const MAXA=coarse?7:14;   // figures alive at once near the player

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
    const a=acts[r.type]||acts.Idle; a.play(); a.time=hash2(r.id,5)*a.getClip().duration; mixer.update(0);
    g.position.set(r.x,r.y,r.z); g.rotation.y=r.ry||0; g.updateMatrixWorld(true); winterize(m,r.id);
    return {r,g,m,mixer,t:Math.random()*10,dir:1}; }
  function kill(a){ try{ a.mixer.stopAllAction(); a.mixer.uncacheRoot(a.m); }catch(e){} scene.remove(a.g); a.g.traverse(o=>{ if(o.isMesh&&o.geometry&&o.geometry.userData.hat){ o.geometry.dispose(); if(o.parent) o.parent.remove(o); } }); }
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
    P.frame=(P.frame||0)+1;
    for(let i=0;i<P.active.length;i++){ const a=P.active[i], r=a.r, d=Math.hypot(r.x-px,r.z-pz), every=d<45?1:d<90?2:3;
      a.acc=(a.acc||0)+dt; if(P.frame%every===0){ a.mixer.update(a.acc); a.acc=0; }
      const sh=d<32; if(a.sh!==sh){ a.sh=sh; a.m.traverse(o=>{ if(o.isMesh) o.castShadow=sh; }); }
      if(r.type==='Walk'&&r.seg){ a.t+=dt*1.15*a.dir; const L=Math.hypot(r.seg[0],r.seg[1]); let u=a.t/L; if(u>1){ a.dir=-1; a.t=L; u=1; } if(u<0){ a.dir=1; a.t=0; u=0; }
        const x=r.x+r.seg[0]*u, z=r.z+r.seg[1]*u; a.g.position.set(x,ST.World.groundY(x,z),z); a.g.rotation.y=Math.atan2(r.seg[0]*a.dir,r.seg[1]*a.dir); } }
  };
  ST.People=P;
})(window.ST);
