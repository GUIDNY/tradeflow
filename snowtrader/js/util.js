/* Snow Rush: small helpers shared by every module (global namespace ST) */
window.ST = window.ST || {};
(function(ST){
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  const lerp=(a,b,t)=>a+(b-a)*t;
  const smooth=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
  const damp=(a,b,rate,dt)=>a+(b-a)*(1-Math.exp(-rate*dt));      // frame-rate independent easing
  function lerpAngle(a,b,t){ let d=((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI; return a+d*t; }
  function hash2(a,b){ let h=(Math.imul(a|0,374761393)+Math.imul(b|0,668265263))|0; h=Math.imul(h^(h>>>13),1274126177); h^=h>>>16; return (h>>>0)/4294967296; }
  function vnoise(x,y){ const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
    const a=hash2(xi,yi), b=hash2(xi+1,yi), c=hash2(xi,yi+1), d=hash2(xi+1,yi+1);
    const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf);
    return (a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v)*2-1; }
  const fmt=n=>Math.round(n).toLocaleString('en-US');
  const $=s=>document.querySelector(s);
  Object.assign(ST,{clamp,lerp,smooth,damp,lerpAngle,hash2,vnoise,fmt,$});
  /* Draw calls: everything static in a chunk (posts, poles, pylons, cables, buildings, nets, signs) is baked into one mesh per
     material. A chunk drops from ~100 draws (plus as many shadow draws) to ~15. Moving or vanishing things are left alone. */
  ST.bakeStatic=function(grp){
    grp.updateMatrixWorld(true); const by=new Map(), out=[];
    grp.traverse(o=>{ if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||o.userData.dyn||Array.isArray(o.material)) return; const pa=o.geometry.attributes.position; if(!pa||pa.count>4000||!o.geometry.attributes.normal) return;
      let p=o.parent, dyn=false; while(p&&p!==grp){ if(p.userData.dyn) dyn=true; p=p.parent; } if(dyn) return;
      (by.get(o.material)||by.set(o.material,[]).get(o.material)).push(o); });
    by.forEach((list,mat)=>{ if(list.length<2) return; const uv=list.every(o=>o.geometry.attributes.uv), col=!!mat.vertexColors&&list.every(o=>o.geometry.attributes.color);
      let n=0; const parts=list.map(o=>{ let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(); g.applyMatrix4(o.matrixWorld); n+=g.attributes.position.count; return g; });
      const P=new Float32Array(n*3), N=new Float32Array(n*3), U=uv?new Float32Array(n*2):null, C=col?new Float32Array(n*3):null; let k=0;
      parts.forEach(g=>{ const c=g.attributes.position.count; P.set(g.attributes.position.array,k*3); N.set(g.attributes.normal.array,k*3); if(U) U.set(g.attributes.uv.array,k*2); if(C) C.set(g.attributes.color.array,k*3); k+=c; g.dispose(); });
      const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(P,3)); geo.setAttribute('normal',new THREE.BufferAttribute(N,3)); if(U) geo.setAttribute('uv',new THREE.BufferAttribute(U,2)); if(C) geo.setAttribute('color',new THREE.BufferAttribute(C,3)); geo.computeBoundingSphere();
      const m=new THREE.Mesh(geo,mat); m.castShadow=list.some(o=>o.castShadow); m.receiveShadow=list.some(o=>o.receiveShadow); m.renderOrder=list[0].renderOrder; m.frustumCulled=true; m.matrixAutoUpdate=false;
      list.forEach(o=>o.parent.remove(o)); grp.add(m); out.push(geo); });
    return out; };

})(window.ST);
