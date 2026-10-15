/* Snow Trader: renderer, light, post-processing and the adaptive quality ladder.
   The pipeline (ACES + sRGB, procedural PMREM light, multisampled composer with bloom and a grade pass, frame-rate
   watcher that trades resolution/effects for smoothness) follows the technique of the BuyToday mall game. */
(function(ST){
  const {clamp}=ST;
  const canvas=document.getElementById('c');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.0;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(62,1,0.1,900);
  scene.add(camera);

  /* ---------- lights ---------- */
  const hemi=new THREE.HemisphereLight(0xbcd2ff,0xfff1e0,0.55); scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffd2a0,2.4); sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048); const sc=sun.shadow.camera; sc.left=-48; sc.right=48; sc.top=48; sc.bottom=-48; sc.near=1; sc.far=260;
  sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.04;
  scene.add(sun,sun.target);

  /* ---------- post ---------- */
  const GFX={on:false,composer:null,bloom:null,grade:null,want:false,failed:false,lite:false};
  GFX.want=renderer.capabilities.isWebGL2;
  const q0=new URLSearchParams(location.search).get('fx'); if(q0==='0') GFX.want=false;
  const GRADE={
    uniforms:{tDiffuse:{value:null},uPx:{value:new THREE.Vector2(1/1280,1/720)},uSharp:{value:.5},uSat:{value:1.16},uContrast:{value:1.12},uVig:{value:.34},
      uShadow:{value:new THREE.Vector3(.92,1.0,1.1)},uHigh:{value:new THREE.Vector3(1.07,1.0,.9)},uSeed:{value:0},uSpeed:{value:0},uFlash:{value:new THREE.Vector3(0,0,0)},uDesat:{value:0}},
    vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:`uniform sampler2D tDiffuse; uniform vec2 uPx; uniform float uSharp,uSat,uContrast,uVig,uSeed,uSpeed,uDesat; uniform vec3 uShadow,uHigh,uFlash; varying vec2 vUv;
      vec3 toSRGB(vec3 c){ return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c)); }
      float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))+uSeed)*43758.5453); }
      void main(){
        vec2 d0=vUv-.5; float r0=length(d0);
        vec2 uv=vUv; float ca=uSpeed*0.0035*r0; uv-=d0*uSpeed*0.012*r0;           // speed: gentle radial stretch + aberration
        vec3 c0=vec3(texture2D(tDiffuse,uv+d0*ca).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-d0*ca).b);
        vec3 a=texture2D(tDiffuse,uv+vec2(uPx.x,0.)).rgb,b=texture2D(tDiffuse,uv-vec2(uPx.x,0.)).rgb,u=texture2D(tDiffuse,uv+vec2(0.,uPx.y)).rgb,w=texture2D(tDiffuse,uv-vec2(0.,uPx.y)).rgb;
        vec3 mn=min(c0,min(min(a,b),min(u,w))),mx=max(c0,max(max(a,b),max(u,w)));
        vec3 sh=clamp(c0+(c0*4.-(a+b+u+w))*uSharp*.25,mn,mx);
        vec3 c=toSRGB(clamp(sh,0.,1.));
        float l=dot(c,vec3(.299,.587,.114));
        c=mix(c*uShadow,c*uHigh,smoothstep(.2,.8,l));                              // teal shadows, warm highlights (the film look)
        l=dot(c,vec3(.299,.587,.114));
        c=mix(vec3(l),c,uSat); c=mix(c,vec3(l),uDesat);
        c=(c-.5)*uContrast+.5;
        float v=smoothstep(.3,.95,length(d0*vec2(1.12,1.))*1.4); c*=1.-uVig*v;
        c+=uFlash; c+=(hash(vUv*1024.)-.5)/255.;
        gl_FragColor=vec4(clamp(c,0.,1.),1.);
      }`
  };
  function gfxLoad(){ if(!GFX.want||GFX.failed) return Promise.resolve(false); if(THREE.EffectComposer) return Promise.resolve(true);
    return Promise.resolve(!!THREE.EffectComposer); }
  function gfxBuild(){
    try{
      const w=innerWidth,h=innerHeight,pr=renderer.getPixelRatio();
      const rt=new THREE.WebGLMultisampleRenderTarget(w*pr,h*pr,{format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
      rt.samples=4; rt.depthTexture=new THREE.DepthTexture(); rt.depthTexture.type=THREE.UnsignedIntType;
      const C=new THREE.EffectComposer(renderer,rt);
      C.addPass(new THREE.RenderPass(scene,camera));
      GFX.bloom=null; if(!GFX.lite){ GFX.bloom=new THREE.UnrealBloomPass(new THREE.Vector2(w/2,h/2),ST.bloomStrength||.55,.55,.82); C.addPass(GFX.bloom); }
      GFX.grade=new THREE.ShaderPass(GRADE); C.addPass(GFX.grade); gfxSharp();
      GFX.composer=C; GFX.on=true; C.setSize(w,h);
    }catch(e){ console.warn('fx off',e); GFX.failed=true; GFX.on=false; GFX.composer=null; }
  }
  function gfxSharp(){ if(!GFX.grade) return; const pr=renderer.getPixelRatio(); GFX.grade.uniforms.uPx.value.set(1/(innerWidth*pr),1/(innerHeight*pr)); }
  function gfxOff(){ if(!GFX.composer) return; GFX.on=false; try{ GFX.composer.renderTarget1.dispose(); GFX.composer.renderTarget2.dispose(); }catch(e){} GFX.composer=null; }
  function render(){
    if(GFX.on&&GFX.composer){ try{ GFX.grade.uniforms.uSeed.value=(GFX.grade.uniforms.uSeed.value+.618)%10; GFX.composer.render(); return; }catch(e){ console.warn('fx off',e); GFX.failed=true; gfxOff(); } }
    renderer.render(scene,camera);
  }
  function gradeSet(k,v){ if(GFX.grade) GFX.grade.uniforms[k].value=v; }

  /* ---------- quality ladder: as sharp as this device keeps smooth ---------- */
  const QL=[{pr:.75,fx:0,sh:1},{pr:1,fx:0,sh:1},{pr:1.25,fx:1,sh:2},{pr:1.5,fx:1,sh:2},{pr:1.75,fx:2,sh:2},{pr:2,fx:2,sh:2}];
  const Q={max:Math.min(window.devicePixelRatio||1,2),lv:3,pr:0,shadow:2,times:[],winT:0,good:0,hold:0,bad:{},pin:null,ups:0,slow:0};
  (function(){ const pin=new URLSearchParams(location.search).get('q'); if(pin!==null&&QL[+pin]) Q.pin=+pin;
    let saved=null; try{ saved=localStorage.getItem('st-q1'); }catch(e){}
    const coarse=matchMedia('(pointer:coarse)').matches;
    Q.lv=Q.pin!==null?Q.pin:saved!==null&&QL[+saved]?+saved:coarse?3:5; })();
  function qApply(lv){
    const L=QL[lv]; Q.lv=lv; const pr=Math.min(L.pr,Q.max);
    if(pr!==Q.pr){ Q.pr=pr; renderer.setPixelRatio(pr); onResize(); }
    if(L.sh!==Q.shadow){ Q.shadow=L.sh; sun.shadow.mapSize.set(L.sh>1?2048:1024,L.sh>1?2048:1024); if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map=null; } }
    const lite=L.fx===1; if(GFX.on&&GFX.lite!==lite) gfxOff();
    if(L.fx&&GFX.want&&!GFX.failed){ GFX.lite=lite; if(!GFX.on) gfxLoad().then(ok=>{ if(ok&&Q.lv===lv&&!GFX.on) gfxBuild(); }); else gfxSharp(); }
    else if(GFX.on) gfxOff();
  }
  function qTick(raw,now){
    if(Q.pin!==null||document.hidden) return;
    Q.times.push(Math.min(raw,1)); Q.winT+=Math.min(raw,1); if(Q.winT<2||Q.times.length<3) return;
    const ts=Q.times.sort((a,b)=>a-b),med=ts[ts.length>>1]; Q.times=[]; Q.winT=0; if(now<Q.hold) return;
    const fps=1/med;
    if(fps<42&&Q.lv>0&&++Q.slow<2) return; if(fps>=42) Q.slow=0;
    if(fps<42&&Q.lv>0){ Q.slow=0; Q.bad[Q.lv]=true; Q.good=0; qApply(Q.lv-1); Q.hold=now+4000; try{ localStorage.setItem('st-q1',String(Q.lv)); }catch(e){} return; }
    if(fps>56){ Q.good++; if(Q.good>=4&&Q.lv<QL.length-1&&!Q.bad[Q.lv+1]&&Q.ups<2){ Q.good=0; Q.ups++; qApply(Q.lv+1); Q.hold=now+4000; } } else Q.good=0;
  }
  function onResize(){ const w=innerWidth,h=innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.fov=w<h?74:62; ST.baseFov=camera.fov; camera.updateProjectionMatrix();
    if(GFX.composer){ GFX.composer.setPixelRatio(renderer.getPixelRatio()); GFX.composer.setSize(w,h); if(GFX.bloom) GFX.bloom.resolution.set(w/2,h/2); gfxSharp(); } }
  addEventListener('resize',onResize);
  Object.assign(ST,{canvas,renderer,scene,camera,hemi,sun,GFX,render,gradeSet,qApply,qTick,onResize,Q,QL});
})(window.ST);
