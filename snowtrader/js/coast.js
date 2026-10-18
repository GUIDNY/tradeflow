/* Surf Rush: the beach — the land, the sea and the sky.
   A bay on a warm sea. The shoreline runs along x (z = shoreZ(x)); the land rises toward +z: a wide sand beach, a promenade
   2.2 m up, the town on a gentle slope, dry hills behind. Toward -z the seabed slopes gently to a sandbar ~65 m out (2 m deep)
   and on into deeper water.
   The sea is a sum of Gerstner waves (two swells rolling in toward the beach, a wind sea and a chop). The same function runs
   on the GPU (the water mesh's vertices) and here (waterY: the height the board rides on, solved for the point that the
   waves' sideways motion brings over (x,z)), so the board sits on the surface you see. The waves fade where the water gets
   shallow and run up the sand as swash; foam gathers at the waterline, on the bar and on steep crests. The sky is a dome
   (gradient, sun, soft clouds) that also lights the scene as its environment (the sea reflects it). */
(function(ST){
  const {clamp,lerp,smooth,hash2,vnoise}=ST; const {scene,renderer,camera,sun,hemi}=ST; const PI=Math.PI;
  const C={};
  /* ---------- the land and the seabed ---------- */
  const shoreZ=x=>10*Math.sin(x/170)+4*Math.sin(x/53+1.3);
  const seabed=a=>Math.max(-14,-.045*a+.9*Math.exp(-((a-65)/14)*((a-65)/14))-.035*Math.max(0,a-110));   // a = metres offshore
  const PROM0=44, PROM1=60, PROM_Y=2.2;   // the promenade: from 44 to 60 m inland, 2.2 m above the sea
  function land(x,d){   // d = metres inland from the waterline
    if(d<38) return .04*d+(d>24?.18*Math.sin(x*.21)*Math.sin(d*.6)*smooth(24,30,d):0);   // the beach (small dunes at its back)
    if(d<PROM0) return lerp(.04*38,PROM_Y,smooth(38,PROM0,d));
    if(d<PROM1) return PROM_Y;
    if(d<190) return PROM_Y+(d-PROM1)*.025;
    const e=d-190; return PROM_Y+130*.025+Math.pow(e,1.32)*.13*(1+.35*vnoise(x*.011,d*.011))+6*vnoise(x*.02,d*.02)*smooth(0,60,e); }
  function groundY(x,z){ const d=z-shoreZ(x); return d<0?seabed(-d):land(x,d); }
  C.shoreZ=shoreZ; C.groundY=groundY; C.PROM={d0:PROM0,d1:PROM1,y:PROM_Y}; C.inland=(x,z)=>z-shoreZ(x);
  /* ---------- the sea: Gerstner waves (direction, wavelength, amplitude, steepness) ---------- */
  const G=9.81, WAVES=[[.17,1,48,.42,.55],[-.32,1,31,.2,.5],[.82,.57,11,.085,.6],[.35,.94,5.3,.035,.5]].map(([dx,dz,L,A,Q])=>{ const l=Math.hypot(dx,dz), k=2*PI/L; return {dx:dx/l,dz:dz/l,k,w:Math.sqrt(G*k),A,Q:Q/(k*A*4)}; });
  C.WAVES=WAVES; C.time=0;
  // how much of the waves is left where the water is d metres deep (they die at the waterline)
  const ampAt=depth=>smooth(-.1,2.6,depth);
  const depthAt=(x,z)=>{ const d=z-shoreZ(x); return d<0?-seabed(-d):-land(x,d); };
  /* the sea surface at (x,z) and time t: height, the surface's vertical speed, its normal (slopes along x and z) */
  function surf(x0,z0,t,out){ const m=ampAt(depthAt(x0,z0)); let dx=0,dz=0,y=0,vy=0,sx=0,sz=0;
    for(const W of WAVES){ const th=W.k*(W.dx*x0+W.dz*z0)-W.w*t, c=Math.cos(th), s=Math.sin(th), A=W.A*m;
      dx+=W.Q*A*W.dx*c; dz+=W.Q*A*W.dz*c; y+=A*s; vy+=-A*W.w*c; sx+=A*W.k*W.dx*c; sz+=A*W.k*W.dz*c; }
    // swash: near the waterline the sea runs up the sand and back with the first swell
    const sw=1-m; if(sw>0){ const W=WAVES[0], th=W.k*(W.dx*x0+W.dz*z0)-W.w*t; y+=sw*.22*Math.sin(th); vy+=-sw*.22*W.w*Math.cos(th); }
    out.dx=dx; out.dz=dz; out.y=y; out.vy=vy; out.sx=sx; out.sz=sz; return out; }
  const _s={dx:0,dz:0,y:0,vy:0,sx:0,sz:0};
  /* the surface over the point (x,z): the waves carry each water particle in a small circle, so find the particle that is there */
  C.water=function(x,z,t,out){ t=t==null?C.time:t; out=out||{}; let x0=x, z0=z; for(let i=0;i<3;i++){ surf(x0,z0,t,_s); x0=x-_s.dx; z0=z-_s.dz; } surf(x0,z0,t,_s);
    out.y=_s.y; out.vy=_s.vy; out.nx=-_s.sx; out.nz=-_s.sz; out.depth=depthAt(x,z); return out; };
  C.waterY=(x,z,t)=>C.water(x,z,t,_w).y; const _w={};
  /* ---------- GLSL: the same sea ---------- */
  const GLSL_SEA=`
    uniform float uT;
    float shoreZ(float x){ return 10.*sin(x/170.)+4.*sin(x/53.+1.3); }
    float seabed(float a){ return max(-14.,-.045*a+.9*exp(-((a-65.)/14.)*((a-65.)/14.))-.035*max(0.,a-110.)); }
    float depthAt(vec2 p){ float d=p.y-shoreZ(p.x); return d<0.?-seabed(-d):-(.04*d); }
    void sea(vec2 p,out vec3 disp,out vec3 tx,out vec3 tz,out float crest){ float depth=depthAt(p), m=smoothstep(-.1,2.6,depth); disp=vec3(0.); tx=vec3(1.,0.,0.); tz=vec3(0.,0.,1.); crest=0.;
      ${WAVES.map((W,i)=>`{ vec2 D=vec2(${W.dx.toFixed(5)},${W.dz.toFixed(5)}); float k=${W.k.toFixed(5)}, A=${W.A.toFixed(4)}*m, Q=${W.Q.toFixed(4)}; float th=k*dot(D,p)-${W.w.toFixed(5)}*uT, c=cos(th), s=sin(th);
        disp+=vec3(Q*A*D.x*c,A*s,Q*A*D.y*c); tx+=vec3(-Q*A*k*D.x*D.x*s,A*k*D.x*c,-Q*A*k*D.x*D.y*s); tz+=vec3(-Q*A*k*D.x*D.y*s,A*k*D.y*c,-Q*A*k*D.y*D.y*s); crest+=${i<2?'1.':'.5'}*Q*A*k*s; }`).join('\n      ')}
      float sw=1.-m; float th0=${WAVES[0].k.toFixed(5)}*dot(vec2(${WAVES[0].dx.toFixed(5)},${WAVES[0].dz.toFixed(5)}),p)-${WAVES[0].w.toFixed(5)}*uT; disp.y+=sw*.22*sin(th0); }`;
  C.GLSL_SEA=GLSL_SEA;
  /* ---------- the sky: dome and environment ---------- */
  const SKY={sun:new THREE.Vector3(-.36,.52,-.78).normalize(),zen:new THREE.Color(.16,.38,.78),hor:new THREE.Color(.7,.83,.95),sunC:new THREE.Color(1,.93,.78)};
  C.SKY=SKY;
  function skyMaterial(){ return new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{uSun:{value:SKY.sun},uZen:{value:SKY.zen},uHor:{value:SKY.hor},uSunC:{value:SKY.sunC},uT:{value:0}},
    vertexShader:'varying vec3 vDir; void main(){ vDir=normalize(position); vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p; gl_Position.z=gl_Position.w*.99999; }',
    fragmentShader:`uniform vec3 uSun,uZen,uHor,uSunC; uniform float uT; varying vec3 vDir;
      float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*vn(p); p*=2.03; a*=.5; } return v; }
      void main(){ vec3 d=normalize(vDir); float h=max(d.y,0.);
        vec3 c=mix(uHor,uZen,pow(smoothstep(0.,.9,h),.6)); c=mix(c,uHor*1.05,smoothstep(.0,-.25,d.y));
        float sd=max(dot(d,uSun),0.); c+=uSunC*(pow(sd,700.)*7.+pow(sd,48.)*.35+pow(sd,6.)*.12);
        // fair-weather cumulus, thickest a little above the horizon, lit on the sun's side
        vec2 cp=d.xz/(d.y+.16)*1.6+vec2(uT*.004,0.); float cl=smoothstep(.52,.78,fbm(cp))*smoothstep(.02,.16,d.y)*(1.-smoothstep(.45,.85,d.y));
        vec3 cc=mix(vec3(.78,.82,.9),vec3(1.,.98,.95),.55+.45*sd); c=mix(c,cc,cl*.85);
        gl_FragColor=vec4(c,1.); }`}); }
  const skyMesh=new THREE.Mesh(new THREE.SphereGeometry(860,48,24),skyMaterial()); skyMesh.renderOrder=-10; skyMesh.frustumCulled=false;
  /* ---------- meshes ---------- */
  const grp=new THREE.Group(); grp.name='coast'; C.group=grp;
  // the land: a grid, fine on the beach and the promenade, coarser inland; colours by what the ground is
  function landMesh(){ const X0=-520, X1=520, NX=200, ds=[]; for(let d=-24;d<70;d+=1) ds.push(d); for(let d=70;d<200;d+=3) ds.push(d); for(let d=200;d<=760;d+=10) ds.push(d);
    const NZ=ds.length, pos=new Float32Array((NX+1)*NZ*3), col=new Float32Array((NX+1)*NZ*3), idx=[]; const c=new THREE.Color(), t=new THREE.Color();
    for(let i=0;i<=NX;i++){ const x=lerp(X0,X1,i/NX); for(let j=0;j<NZ;j++){ const d=ds[j], z=shoreZ(x)+d, y=d<0?seabed(-d):land(x,d), k=(i*NZ+j)*3; pos[k]=x; pos[k+1]=y; pos[k+2]=z;
        const n=hash2(i*7+3,j*13+1);
        if(d<-.5) c.setRGB(.55,.5,.38);                                                   // under the water (seen through the swash)
        else if(d<7) c.setRGB(.66,.58,.44).lerp(t.setRGB(.9,.81,.64),smooth(0,7,d));          // wet sand
        else if(d<PROM0-2) c.setRGB(.9,.8,.62).multiplyScalar(.95+.07*n);                    // dry sand
        else if(d<PROM1+1) c.setRGB(.84,.8,.74);                                            // the promenade
        else if(d<192) c.setRGB(.8,.77,.71).multiplyScalar(.96+.05*n);                       // the town
        else { const g=smooth(192,260,d), r=vnoise(x*.03,d*.03); c.setRGB(.74,.68,.5).lerp(t.setRGB(.5+.08*r,.55+.06*r,.33),g); }   // dry grass and scrub on the hills
        c.convertSRGBToLinear(); col[k]=c.r; col[k+1]=c.g; col[k+2]=c.b;   // the palette is sRGB; vertex colours are linear
        if(i<NX&&j<NZ-1){ const a=i*NZ+j, b=(i+1)*NZ+j; idx.push(a,a+1,b,b,a+1,b+1); } } }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('color',new THREE.BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals();
    const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0});
    m.onBeforeCompile=sh=>{ sh.vertexShader='varying vec3 vWp;\n'+sh.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vWp=(modelMatrix*vec4(transformed,1.)).xyz;');
      sh.fragmentShader='varying vec3 vWp;\nfloat h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\nfloat vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }\n'
        +sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n { float g=vn(vWp.xz*7.)*.5+vn(vWp.xz*1.3)*.5; float rip=sin(vWp.x*2.1+vWp.z*.9+vn(vWp.xz*.5)*4.)*.5+.5; diffuseColor.rgb*=.9+.12*g+.04*rip*step(vWp.y,2.); }'); };
    m.customProgramCacheKey=()=>'st-coast-land';
    const mesh=new THREE.Mesh(g,m); mesh.receiveShadow=true; mesh.name='land'; return mesh; }
  // the sea: a grid that follows the camera, dense under it and sparse toward the horizon; the waves are made in its vertex shader
  function seaMesh(){ const N=170, pos=new Float32Array((N+1)*(N+1)*3), idx=[]; const f=t=>700*(.06*t+.94*t*Math.abs(t)*Math.abs(t));
    for(let i=0;i<=N;i++) for(let j=0;j<=N;j++){ const k=(i*(N+1)+j)*3; pos[k]=f(i/N*2-1); pos[k+1]=0; pos[k+2]=f(j/N*2-1); if(i<N&&j<N){ const a=i*(N+1)+j, b=a+N+1; idx.push(a,a+1,b,a+1,b+1,b); } }   // facing up
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setIndex(idx); g.computeBoundingSphere(); g.boundingSphere.radius=1e5;
    const m=new THREE.MeshStandardMaterial({color:0x1b5f7a,roughness:.18,metalness:0});
    m.onBeforeCompile=sh=>{ sh.uniforms.uT=SEA_U.uT; sh.uniforms.uCam=SEA_U.uCam; sh.uniforms.uSun={value:SKY.sun}; sh.uniforms.uZen={value:SKY.zen}; sh.uniforms.uHor={value:SKY.hor}; sh.uniforms.uSunC={value:SKY.sunC}; sh.uniforms.uDbg=SEA_U.uDbg;
      sh.vertexShader='uniform vec3 uCam;\nvarying vec3 vWp; varying float vDepth; varying float vCrest; varying float vFar;\n'+GLSL_SEA+'\n'+sh.vertexShader
        .replace('#include <beginnormal_vertex>',`vec3 wp0=(modelMatrix*vec4(position,1.)).xyz; vec3 dsp, tx, tz; float crest; sea(wp0.xz,dsp,tx,tz,crest);
          float far=smoothstep(180.,420.,length(wp0.xz-uCam.xz)); dsp*=1.-far; tx=mix(tx,vec3(1.,0.,0.),far); tz=mix(tz,vec3(0.,0.,1.),far);
          vec3 objectNormal=normalize(cross(tz,tx)); vDepth=depthAt(wp0.xz); vCrest=crest*(1.-far); vFar=far;`)
        .replace('#include <begin_vertex>','vec3 transformed=position+dsp;')
        .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vWp=(modelMatrix*vec4(transformed,1.)).xyz;');
      sh.fragmentShader='uniform float uT; uniform vec3 uSun,uZen,uHor,uSunC; uniform vec4 uDbg;\nvarying vec3 vWp; varying float vDepth; varying float vCrest; varying float vFar;\nfloat h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\nfloat vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }\n'+sh.fragmentShader
        .replace('#include <color_fragment>',`#include <color_fragment>
          float dep=max(vDepth,0.);
          vec3 deep=vec3(.004,.045,.095), mid=vec3(.012,.13,.19), shal=vec3(.05,.26,.27), sand=vec3(.4,.36,.24);
          vec3 wc=mix(shal,mid,smoothstep(.4,3.5,dep)); wc=mix(wc,deep,smoothstep(3.,14.,dep)); wc=mix(sand,wc,smoothstep(0.,.55,dep));
          // foam: the waterline's lace, the bar's broken water, whitecaps on steep crests
          float n1=vn(vWp.xz*.9+vec2(uT*.35,uT*.12)), n2=vn(vWp.xz*3.1-vec2(uT*.2,uT*.5));
          float shore=smoothstep(.55,.0,dep)*(.55+.45*sin(dep*9.-uT*1.6+n1*3.));
          float bar=smoothstep(2.6,2.1,dep)*smoothstep(1.2,2.0,dep)*smoothstep(.25,.6,vCrest+n1*.3);
          float caps=smoothstep(.42,.62,vCrest+n2*.25)*.65;
          float foam=clamp(max(shore,max(bar,caps))*(.6+.4*n2),0.,1.)*(1.-vFar)*uDbg.x;
          diffuseColor.rgb=mix(wc,vec3(.95,.97,.98),foam); fFoam=foam;`)
        .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          { float e=.35; vec2 q=vWp.xz*.55+vec2(uT*.11,uT*.07); float a=vn(q), b=vn(q+vec2(e,0.)), c=vn(q+vec2(0.,e)); vec2 q2=vWp.xz*1.9-vec2(uT*.23,uT*.17); float a2=vn(q2), b2=vn(q2+vec2(e,0.)), c2=vn(q2+vec2(0.,e));
            vec3 pn=vec3((a-b)*.32+(a2-b2)*.2,0.,(a-c)*.32+(a2-c2)*.2)*(1.-vFar*.8); normal=normalize(normal+(viewMatrix*vec4(pn,0.)).xyz); }`)
        .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor=mix(roughnessFactor,.65,fFoam);')
        .replace('#include <dithering_fragment>',`#include <dithering_fragment>
          { // the sky in the sea: the reflected ray's sky colour (the dome's gradient and the sun), weighted by Fresnel
            vec3 nw=normalize(inverseTransformDirection(normal,viewMatrix)), vw=normalize(vWp-cameraPosition), r=reflect(vw,nw); r.y=abs(r.y);
            vec3 sky=mix(uHor,uZen,pow(smoothstep(0.,.9,r.y),.6)); float sd=max(dot(r,uSun),0.); sky+=uSunC*(pow(sd,900.)*9.+pow(sd,60.)*.25);
            float fr=.02+.98*pow(1.-max(dot(-vw,nw),0.),5.); fr=mix(fr,.04,fFoam);
            gl_FragColor.rgb=mix(gl_FragColor.rgb,sky,clamp(fr,0.,1.)*(1.-vFar*.25)*uDbg.y); if(uDbg.z>.5) gl_FragColor.rgb=vec3(fFoam,clamp(vDepth/10.,0.,1.),vCrest*2.); }`)
        .replace('void main() {','float fFoam=0.;\nvoid main() {'); };
    m.customProgramCacheKey=()=>'st-sea';
    const mesh=new THREE.Mesh(g,m); mesh.receiveShadow=true; mesh.frustumCulled=false; mesh.name='sea'; return mesh; }
  const SEA_U={uT:{value:0},uCam:{value:new THREE.Vector3()},uDbg:{value:new THREE.Vector4(1,1,0,0)}}; C.SEA_U=SEA_U;
  /* ---------- build, light, follow ---------- */
  let built=false, sea=null;
  C.build=function(){ if(built) return; built=true;
    grp.add(skyMesh); grp.add(landMesh()); sea=seaMesh(); grp.add(sea); scene.add(grp);
    scene.background=SKY.hor.clone(); scene.fog=new THREE.Fog(SKY.hor.clone().lerp(new THREE.Color(1,1,1),.1),260,880);
    hemi.color.setRGB(.62,.76,1); hemi.groundColor.setRGB(.95,.86,.7); hemi.intensity=.5;
    sun.color.copy(SKY.sunC); sun.intensity=2.25;
    ST.gradeCfg={shadow:[.94,1.0,1.08],high:[1.06,1.01,.93],sat:1.14,contrast:1.06,vig:.24}; if(ST.applyGrade) ST.applyGrade(); };
  /* every frame: the waves' clock, the sea under the camera, the sun's shadow box over the player */
  C.update=function(dt,focus){ C.time+=dt; SEA_U.uT.value=C.time; skyMesh.material.uniforms.uT.value=C.time; const cp=camera.position;
    if(sea){ const s=2.5; sea.position.set(Math.round(cp.x/s)*s,0,Math.round(cp.z/s)*s); SEA_U.uCam.value.copy(cp); }
    skyMesh.position.copy(cp);
    const f=focus||cp, sd=SKY.sun; sun.position.set(f.x+sd.x*140,f.y+sd.y*140,f.z+sd.z*140); sun.target.position.set(f.x,f.y,f.z); sun.target.updateMatrixWorld(); };
  /* the world interface the shared modules expect (people stand on it, the rider's hands find the ground) */
  ST.World=Object.assign(ST.World||{},{groundY:(x,z)=>Math.max(groundY(x,z),-.2)});
  ST.Coast=C;
})(window.ST);
