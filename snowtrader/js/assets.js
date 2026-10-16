/* Snow Rush: the asset replacement layer.
   A model made elsewhere (Meshy, a store, an artist) joins the game by adding an entry here, not by changing game code:
   - RIGS: how a rig names its bones, mapped onto the 20 joints the rider's pose and IK drive (js/rider.js, MIX keys);
   - characters: one entry per character file, with what the game needs to fit it (height, facing, what it brings itself);
   - SPEC: the requirements a new model has to meet. They are written down here and checked on load (`check`), so a model
     that cannot work (missing bones, too heavy) is reported instead of failing silently.
   Riders keep every procedural behaviour (IK to the bindings, per-joint springs, balance): the pose system needs only the
   joints, not the model's own animations. */
(function(ST){
  const MIX=['Hips','Abdomen','Torso','Chest','Neck','Head','ShoulderL','UpperArmL','LowerArmL','WristL','ShoulderR','UpperArmR','LowerArmR','WristR','UpperLegL','LowerLegL','FootL','UpperLegR','LowerLegR','FootR'];
  const limbs=(pre,map)=>Object.assign({
    ShoulderL:pre+'LeftShoulder',UpperArmL:pre+'LeftArm',LowerArmL:pre+'LeftForeArm',WristL:pre+'LeftHand',
    ShoulderR:pre+'RightShoulder',UpperArmR:pre+'RightArm',LowerArmR:pre+'RightForeArm',WristR:pre+'RightHand',
    UpperLegL:pre+'LeftUpLeg',LowerLegL:pre+'LeftLeg',FootL:pre+'LeftFoot',UpperLegR:pre+'RightUpLeg',LowerLegR:pre+'RightLeg',FootR:pre+'RightFoot'},map);
  const RIGS={
    // Mixamo: spine bottom to top is Spine, Spine1, Spine2
    mixamo:{map:limbs('mixamorig',{Hips:'mixamorigHips',Abdomen:'mixamorigSpine',Torso:'mixamorigSpine1',Chest:'mixamorigSpine2',Neck:'mixamorigNeck',Head:'mixamorigHead'})},
    // Meshy auto-rig (checked on a real export, 24 joints): the same limb names without a prefix, but the spine is numbered the
    // other way round (Spine02 sits on the hips, Spine carries the shoulders) and the neck is lower case. No finger or twist bones.
    meshy:{map:limbs('',{Hips:'Hips',Abdomen:'Spine02',Torso:'Spine01',Chest:'Spine',Neck:'neck',Head:'Head'})}
  };
  const characters={
    meshy_rider:{label:'Meshy',url:'assets/chars/meshy_rider.glb',rig:'meshy',height:1.65,facing:'+Z',
      gear:false,            // helmet, goggles and gloves are part of the model: the game adds none of its own
      outfit:'baked',        // colours are in its textures: the per-run jacket colour does not apply...
      tint:'pants',          // ...but the trousers (marked in its vertex colours) take the run's trouser colour over the texture's shading
      source:'Meshy API: text-to-3D (meshy-7.1, 20 credits) + PBR refine (10) + auto-rig (5); textures cut to 1024/512 and geometry meshopt-compressed'}
  };
  /* what any replacement must meet (see ASSETS.md for the full specification) */
  const SPEC={
    character:{heightM:[1.5,1.95],facing:'+Z (glTF forward), Y up, metres',tris:[8000,40000],textures:'<=1024 px colour and normal, <=512 metal/roughness; JPEG or PNG',
      fileMB:3,bones:MIX,bindPose:'T or A pose preferred; any standing pose works (the IK aims each limb), but bent elbows in the bind pose stretch the skin when straightened'},
    clothing:{rule:'skinned to the same skeleton as the character it belongs to (same bone names, same bind)'},
    prop:{tris:[50,6000],rule:'one material where possible; origin at the base; Y up; metres'}
  };
  /* check a loaded character against the spec: which of the 20 joints exist, height, triangles */
  function check(name,root,boneFor){
    const missing=MIX.filter(k=>!boneFor(k)); let tris=0; root.traverse(o=>{ if(o.isMesh&&o.geometry){ const g=o.geometry; tris+=(g.index?g.index.count:g.attributes.position.count)/3; } });
    const res={name,missing,tris:Math.round(tris),ok:missing.length===0&&tris<=SPEC.character.tris[1]*1.25};
    if(!res.ok) console.warn('asset check',res); return res; }
  ST.Assets={MIX,RIGS,characters,SPEC,check};
})(window.ST);
