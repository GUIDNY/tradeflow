/* Snow Rush: the asset replacement layer.
   A model made elsewhere (Meshy, a store, an artist) joins the game by adding an entry here, not by changing game code:
   - RIGS: how a rig names its bones, mapped onto the 20 joints the rider's pose and IK drive (js/rider.js, MIX keys);
   - characters: one entry per character file, with what the game needs to fit it (height, facing, what it brings itself);
   - SPEC: the requirements a new model has to meet. They are written down here and checked on load (`check`), so a model
     that cannot work (missing bones, too heavy) is reported instead of failing silently.
   Riders keep every procedural behaviour (IK to the bindings, per-joint springs, balance): the pose system needs only the
   joints, not the model's own animations.
   The rest of the game can be swapped the same way, by listing a model here: village guests (people), the rider's helmet,
   goggles and mitts (gear), garments skinned to a character's skeleton (parts), and trees, buildings and props (world).
   Whatever is not listed is built in code as before, so an empty list changes nothing. Listed models are loaded once at
   boot (preload) and a model that fails to load is reported and replaced by the generator's own. */
(function(ST){
  const MIX=['Hips','Abdomen','Torso','Chest','Neck','Head','ShoulderL','UpperArmL','LowerArmL','WristL','ShoulderR','UpperArmR','LowerArmR','WristR','UpperLegL','LowerLegL','FootL','UpperLegR','LowerLegR','FootR'];
  const limbs=(pre,map)=>Object.assign({
    ShoulderL:pre+'LeftShoulder',UpperArmL:pre+'LeftArm',LowerArmL:pre+'LeftForeArm',WristL:pre+'LeftHand',
    ShoulderR:pre+'RightShoulder',UpperArmR:pre+'RightArm',LowerArmR:pre+'RightForeArm',WristR:pre+'RightHand',
    UpperLegL:pre+'LeftUpLeg',LowerLegL:pre+'LeftLeg',FootL:pre+'LeftFoot',UpperLegR:pre+'RightUpLeg',LowerLegR:pre+'RightLeg',FootR:pre+'RightFoot'},map);
  const RIGS={
    // Mixamo: spine bottom to top is Spine, Spine1, Spine2
    mixamo:{top:'mixamorigHeadTop_End',map:limbs('mixamorig',{Hips:'mixamorigHips',Abdomen:'mixamorigSpine',Torso:'mixamorigSpine1',Chest:'mixamorigSpine2',Neck:'mixamorigNeck',Head:'mixamorigHead'})},
    // Meshy auto-rig (checked on a real export, 24 joints): the same limb names without a prefix, but the spine is numbered the
    // other way round (Spine02 sits on the hips, Spine carries the shoulders) and the neck is lower case. No finger or twist bones.
    meshy:{top:'head_end',map:limbs('',{Hips:'Hips',Abdomen:'Spine02',Torso:'Spine01',Chest:'Spine',Neck:'neck',Head:'Head'})}
  };
  const characters={
    meshy_rider:{label:'Meshy',url:'assets/chars/meshy_rider.glb',rig:'meshy',height:1.65,facing:'+Z',
      gear:false,            // helmet, goggles and gloves are part of the model: the game adds none of its own
      outfit:'baked',        // colours are in its textures: the per-run jacket colour does not apply...
      tint:'pants',          // ...but the trousers (marked in its vertex colours) take the run's trouser colour over the texture's shading
      source:'Meshy API: text-to-3D (meshy-7.1, 20 credits) + PBR refine (10) + auto-rig (5); textures cut to 1024/512 and geometry meshopt-compressed'}
  };
  /* village guests (js/people.js). The nine Mixamo guests come in street clothes and are repainted as a ski kit ('paint': each
     triangle by the bone that moves it); a model made in ski clothes keeps its own ('baked'), and with tint:'pants' its
     trousers take a colour per guest. hat: the game's beanie. weight: how often the crowd picks it (0 = only where a guest is
     asked for by name). standIn: the colours of its distant stand-in, so the switch between the two is not seen. */
  const people={};
  ['Ch02','Ch03','Ch07','Ch12','Ch21','Ch22','Ch26','Ch27','Ch33'].forEach(n=>people[n]={url:'assets/people/'+n+'.glb',rig:'mixamo',height:1.78,outfit:'paint',hat:true,weight:1});
  // the Meshy rider works as a guest too. Weight 0: a crowd of the player's double would confuse, so it appears only where asked for
  people.meshy_rider={url:'assets/chars/meshy_rider.glb',rig:'meshy',height:1.65,outfit:'baked',tint:'pants',hat:false,weight:0,standIn:{jacket:0xd8a514,hat:0x1b1d24}};
  /* the rider's helmet, goggles and mitts (js/rider.js addGear), worn by every rider that does not bring its own (gear:false):
     helmet:{url, tint:true}  goggles:{url}  mitts:{url} (a left mitt; the right one is its mirror image) */
  const gear={};
  /* world models, in place of what the generators build:
     trees:     {spruce|fir: {near:url, far:url}}   instanced per chunk, near and far swapped by distance; scaled to the generated tree's height
     buildings: {<sign id>|house|lodge: {url, fit:'footprint'}}   a village building by its sign (alpenrose, cafe...), any house, the lodges along the run
     props:     {church|hut|bench|lamp|xtree|signpost|flag|stand: {url, height?}}   instanced at the generator's spots */
  const world={trees:{},buildings:{},props:{}};
  /* what any replacement must meet (see ASSETS.md for the full specification) */
  const SPEC={
    character:{heightM:[1.5,1.95],facing:'+Z (glTF forward), Y up, metres',tris:[8000,40000],textures:'<=1024 px colour and normal, <=512 metal/roughness; JPEG or PNG',
      fileMB:3,bones:MIX,bindPose:'T or A pose preferred; any standing pose works (the IK aims each limb), but bent elbows in the bind pose stretch the skin when straightened'},
    clothing:{rule:'skinned to the same skeleton as the character it belongs to (same bone names, same bind)'},
    gear:{rule:'origin at the head pivot (helmet, goggles) or the wrist (left mitt); +Z forward, Y up, metres, sized for a 1.78 m figure',tris:[200,4000]},
    tree:{tris:{near:[100,600],far:[20,120]},rule:'origin at the foot of the trunk, Y up; any height (scaled to the generated tree); snow baked into the texture'},
    building:{tris:[2000,10000],rule:'origin at ground level in the middle of the footprint, +Z = front (the street side); a plinth reaching 1.5 m below the origin'},
    prop:{tris:[50,6000],rule:'one material where possible; origin at the base; Y up; metres'}
  };
  // a page can add or override entries before the game starts (the asset test does): window.ST_ASSETS_EXTRA={people:{...},world:{trees:{...}}}
  const EX=window.ST_ASSETS_EXTRA;
  if(EX){ [['characters',characters],['people',people],['gear',gear]].forEach(([k,o])=>{ if(EX[k]) for(const n in EX[k]) o[n]=Object.assign({},o[n],EX[k][n]); });
    if(EX.world) ['trees','buildings','props'].forEach(k=>Object.assign(world[k],EX.world[k]||{})); }

  /* ---------- loading ---------- */
  const cache={};
  function load(url){ return cache[url]||(cache[url]=new Promise((res,rej)=>{ const L=new THREE.GLTFLoader(); if(window.MeshoptDecoder) L.setMeshoptDecoder(window.MeshoptDecoder); L.load(url,res,undefined,rej); })); }
  /* every bone back to the pose the skin was bound in (some files save their nodes in another pose) */
  function poseToBind(rootObj){
    rootObj.updateMatrixWorld(true); const W=new Map();
    rootObj.traverse(o=>{ if(!o.isSkinnedMesh) return; o.skeleton.bones.forEach((b,i)=>{ if(!W.has(b)) W.set(b,new THREE.Matrix4().copy(o.skeleton.boneInverses[i]).invert().premultiply(o.bindMatrix)); }); });
    const inv=new THREE.Matrix4(), m=new THREE.Matrix4(), sc=new THREE.Vector3();
    const walk=o=>{ if(W.has(o)){ const pw=W.get(o.parent)||o.parent.matrixWorld; m.copy(inv.copy(pw).invert()).multiply(W.get(o)); const s0=o.scale.clone(); m.decompose(o.position,o.quaternion,sc); o.scale.copy(s0); o.updateMatrixWorld(true); }
      o.children.forEach(walk); };
    walk(rootObj); rootObj.updateMatrixWorld(true);
  }
  // compressed models (meshopt, KHR_mesh_quantization) can keep positions, normals and UVs as normalised integers: read as floats
  const NORM={Int8Array:127,Uint8Array:255,Int16Array:32767,Uint16Array:65535};
  function floatAttr(a){ const n=a.count, k=a.itemSize, out=new Float32Array(n*k), m=a.normalized?NORM[(a.isInterleavedBufferAttribute?a.data.array:a.array).constructor.name]:0;
    for(let i=0;i<n;i++) for(let j=0;j<k;j++){ const v=a.isInterleavedBufferAttribute?a.data.array[i*a.data.stride+a.offset+j]:a.array[i*k+j]; out[i*k+j]=m?Math.max(v/m,-1):v; }
    return new THREE.BufferAttribute(out,k); }
  /* a static model as parts ready for instancing: each mesh's geometry in model space (floats, with the node transforms
     applied), its material. The whole is centred and set on y=0 (o.keepY: centred across but its own ground level kept, for
     a building whose plinth reaches below it; o.keep: left exactly as authored, for gear), then scaled: to a height
     (o.height), into a box (o.fit=[w,h,d], uniform scale) or left in its own metres */
  function flatten(gl,o){ const root=gl.scene; root.updateMatrixWorld(true); const parts=[], box=new THREE.Box3();
    root.traverse(m=>{ if(!m.isMesh||m.isSkinnedMesh) return; const src=m.geometry, g=new THREE.BufferGeometry();
      ['position','normal','uv'].forEach(n=>{ if(src.attributes[n]) g.setAttribute(n,floatAttr(src.attributes[n])); }); if(src.index) g.setIndex(src.index.clone());
      g.applyMatrix4(m.matrixWorld); if(!g.attributes.normal) g.computeVertexNormals(); g.computeBoundingBox(); box.union(g.boundingBox);
      const mats=Array.isArray(m.material)?m.material:[m.material]; mats.forEach(mt=>{ if(mt.map) mt.map.anisotropy=4; });
      parts.push({geo:g,mat:m.material}); });
    if(!parts.length) return null;
    const size=box.getSize(new THREE.Vector3()); let k=1;
    if(o&&o.height) k=o.height/Math.max(size.y,1e-3); else if(o&&Array.isArray(o.fit)) k=Math.min(o.fit[0]/Math.max(size.x,1e-3),o.fit[1]/Math.max(size.y,1e-3),o.fit[2]/Math.max(size.z,1e-3));
    const keep=o&&o.keep, ty=keep||o&&o.keepY?0:-box.min.y;
    parts.forEach(p=>{ if(!keep) p.geo.translate(-(box.min.x+box.max.x)/2,ty,-(box.min.z+box.max.z)/2); p.geo.scale(k,k,k); p.geo.computeBoundingSphere(); });
    return {parts,size:size.multiplyScalar(k),tris:parts.reduce((t,p)=>t+(p.geo.index?p.geo.index.count:p.geo.attributes.position.count)/3,0)}; }
  /* the parts merged into one geometry (one group per material), for an InstancedMesh: trees */
  function mergeFlat(F){ let nv=0, ni=0; F.parts.forEach(p=>{ nv+=p.geo.attributes.position.count; ni+=p.geo.index?p.geo.index.count:p.geo.attributes.position.count; });
    const pos=new Float32Array(nv*3), nor=new Float32Array(nv*3), uv=new Float32Array(nv*2), idx=new Uint32Array(ni), g=new THREE.BufferGeometry(), mats=[]; let vo=0, io=0;
    F.parts.forEach((p,pi)=>{ const a=p.geo.attributes, n=a.position.count; pos.set(a.position.array,vo*3); nor.set(a.normal.array,vo*3); if(a.uv) uv.set(a.uv.array,vo*2);
      const st=io; if(p.geo.index){ const ix=p.geo.index.array; for(let i=0;i<ix.length;i++) idx[io+i]=ix[i]+vo; io+=ix.length; } else { for(let i=0;i<n;i++) idx[io+i]=vo+i; io+=n; }
      if(Array.isArray(p.mat)&&p.geo.groups.length) p.geo.groups.forEach(gr=>{ g.addGroup(st+gr.start,gr.count,mats.length); mats.push(p.mat[gr.materialIndex]); });   // a mesh with several materials keeps them
      else { g.addGroup(st,io-st,mats.length); mats.push(Array.isArray(p.mat)?p.mat[0]:p.mat); } vo+=n; });
    g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.BufferAttribute(nor,3)); g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.setIndex(new THREE.BufferAttribute(idx,1)); g.computeBoundingSphere();
    return {geo:g,mat:mats.length===1?mats[0]:mats}; }
  /* garments made for a character, skinned to a skeleton with the same bone names: each skinned mesh is moved onto the
     character's own bones (keeping its own bind), so it follows every pose and every IK correction of the body */
  function wear(root,gl){ const B={}; root.traverse(o=>{ if(o.isBone) B[o.name]=o; }); let n=0, miss=[];
    gl.scene.updateMatrixWorld(true); const list=[]; gl.scene.traverse(o=>{ if(o.isSkinnedMesh) list.push(o); });
    list.forEach(o=>{ const bones=o.skeleton.bones.map(b=>B[b.name]); if(bones.some(b=>!b)){ miss=miss.concat(o.skeleton.bones.filter(b=>!B[b.name]).map(b=>b.name)); return; }
      const m=new THREE.SkinnedMesh(o.geometry,o.material); m.name='part:'+o.name; m.castShadow=true; m.receiveShadow=true; m.frustumCulled=false; m.userData.part=1;
      root.add(m); m.bind(new THREE.Skeleton(bones,o.skeleton.boneInverses.map(x=>x.clone())),o.bindMatrix.clone()); n++; });
    if(miss.length) console.warn('asset part: bones missing on the character',[...new Set(miss)].slice(0,8));
    return n; }
  function wearAll(root,spec){ return Promise.all((spec.parts||[]).map(u=>load(u.url||u).then(gl=>wear(root,gl)).catch(e=>{ console.warn('asset part',u,e); return 0; }))); }
  /* a baked texture that takes a colour where the model marks a region (vertex colour red = trousers): the texture keeps its
     light and dark (folds, seams), only its colour is replaced; very dark texels (boots, zips) and the jacket's yellow hem are
     left as they are. The colour is the material's userData.pants. */
  function tintable(root,hex){ root.traverse(o=>{ if(!o.isMesh||!o.geometry.attributes.color) return; const g=o.geometry; g.setAttribute('aTint',g.attributes.color); g.deleteAttribute('color');
    o.material=tintMat(o.material,hex); }); }
  function tintMat(src,hex){ const mt=src.userData.pants?src.clone():src; mt.vertexColors=false; const col=mt.userData.pants=new THREE.Color(hex).convertSRGBToLinear();
    mt.onBeforeCompile=sh=>{ sh.uniforms.uPants={value:col};
      sh.vertexShader='attribute vec4 aTint;\nvarying float vTint;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vTint=aTint.r;');
      sh.fragmentShader='uniform vec3 uPants;\nvarying float vTint;\n'+sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n { float tl=dot(diffuseColor.rgb,vec3(.299,.587,.114)); float tk=vTint*smoothstep(.015,.05,tl)*(1.-smoothstep(.08,.16,diffuseColor.r-diffuseColor.g)); diffuseColor.rgb=mix(diffuseColor.rgb,uPants*clamp(tl/.17,0.,1.7),tk); }'); };
    mt.customProgramCacheKey=()=>'st-tint'; mt.needsUpdate=true; return mt; }
  /* boot: load every listed gear and world model (nothing listed = nothing to do). got.* holds what loaded */
  const got={gear:{},trees:{},buildings:{},props:{}};
  let pre=null;
  function preload(){ if(pre) return pre; const jobs=[], tryLoad=(url,f)=>jobs.push(load(url).then(f).catch(e=>console.warn('asset',url,e&&e.message||e)));
    for(const k in gear) if(gear[k]&&gear[k].url) tryLoad(gear[k].url,gl=>{ const F=flatten(gl,{keep:true}); if(F){ F.spec=gear[k]; got.gear[k]=F; } });
    for(const k in world.trees){ const t=world.trees[k]; if(!t||!t.near) continue; const one={};
      tryLoad(t.near,gl=>{ one.near=gl; }); if(t.far&&t.far!==t.near) tryLoad(t.far,gl=>{ one.far=gl; }); got.trees[k]=one; }
    for(const k in world.buildings){ const b=world.buildings[k]; if(b&&b.url) tryLoad(b.url,gl=>{ const F=flatten(gl,{keepY:true,height:b.height}); if(F){ F.spec=b; got.buildings[k]=F; } }); }
    for(const k in world.props){ const b=world.props[k]; if(b&&b.url) tryLoad(b.url,gl=>{ const F=flatten(gl,{height:b.height,fit:b.fit}); if(F){ F.spec=b; got.props[k]=F; } }); }
    return pre=Promise.all(jobs).then(()=>{ for(const k in got.trees){ const one=got.trees[k]; if(!one.near){ delete got.trees[k]; continue; } got.trees[k]={nearGl:one.near,farGl:one.far||one.near}; } return got; }); }
  /* check a loaded character against the spec: which of the 20 joints exist, height, triangles */
  function check(name,root,boneFor){
    const missing=MIX.filter(k=>!boneFor(k)); let tris=0; root.traverse(o=>{ if(o.isMesh&&o.geometry){ const g=o.geometry; tris+=(g.index?g.index.count:g.attributes.position.count)/3; } });
    const res={name,missing,tris:Math.round(tris),ok:missing.length===0&&tris<=SPEC.character.tris[1]*1.25};
    if(!res.ok) console.warn('asset check',res); return res; }
  ST.Assets={MIX,RIGS,characters,people,gear,world,SPEC,check,load,poseToBind,flatten,mergeFlat,wear,wearAll,tintable,tintMat,preload,got};
})(window.ST);
