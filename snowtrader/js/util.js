/* Snow Trader: small helpers shared by every module (global namespace ST) */
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
  const fmt=n=>'$'+Math.round(n).toLocaleString('en-US');
  const $=s=>document.querySelector(s);
  Object.assign(ST,{clamp,lerp,smooth,damp,lerpAngle,hash2,vnoise,fmt,$});
})(window.ST);
