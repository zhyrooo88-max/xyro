(function(){
  const KEY='xtzyyy-theme';
  const themes=['dark','light','night'];
  function applyTheme(theme){
    if(!themes.includes(theme)) theme='dark';
    document.documentElement.dataset.theme=theme;
    localStorage.setItem(KEY,theme);
    document.querySelectorAll('[data-theme-choice]').forEach(b=>b.classList.toggle('active',b.dataset.themeChoice===theme));
  }
  function initTheme(){
    const saved=localStorage.getItem(KEY)||'dark';
    applyTheme(saved);
    document.querySelectorAll('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>applyTheme(b.dataset.themeChoice)));
  }
  async function globalStatus(){
    document.querySelectorAll('[data-global-status]').forEach(el=>el.textContent='CHECKING');
    document.querySelectorAll('[data-global-dot]').forEach(el=>el.classList.remove('online','offline'));
    try{
      const t=performance.now();
      const r=await fetch('/api/v1/status/global',{cache:'no-store'});
      const d=await r.json();
      const online=r.ok && d.status===true && d.service?.status==='online';
      document.querySelectorAll('[data-global-status]').forEach(el=>el.textContent=online?'ONLINE':'DEGRADED');
      document.querySelectorAll('[data-global-detail]').forEach(el=>el.textContent=`Global API · ${Math.round(performance.now()-t)} ms`);
      document.querySelectorAll('[data-global-dot]').forEach(el=>el.classList.add(online?'online':'offline'));
      document.querySelectorAll('[data-global-uptime]').forEach(el=>el.textContent=d.service?.uptimeHuman||'—');
      document.querySelectorAll('[data-global-version]').forEach(el=>el.textContent=d.service?.version||'—');
      document.querySelectorAll('[data-global-time]').forEach(el=>el.textContent=d.timestamp?new Date(d.timestamp).toLocaleString('id-ID'):'—');
    }catch(e){
      document.querySelectorAll('[data-global-status]').forEach(el=>el.textContent='OFFLINE');
      document.querySelectorAll('[data-global-detail]').forEach(el=>el.textContent='Global status tidak dapat diakses');
      document.querySelectorAll('[data-global-dot]').forEach(el=>el.classList.add('offline'));
    }
  }
  function shootingStars(){
    const canvas=document.querySelector('#starsCanvas'); if(!canvas) return;
    const ctx=canvas.getContext('2d'); let w=0,h=0,dpr=1,stars=[];
    function resize(){dpr=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);}
    function spawn(){return{x:Math.random()*w*1.2-w*.1,y:Math.random()*h*.55-h*.1,vx:5+Math.random()*7,vy:3+Math.random()*5,len:60+Math.random()*100,life:0,max:30+Math.random()*35};}
    function reset(s){Object.assign(s,spawn());}
    resize(); addEventListener('resize',resize);
    for(let i=0;i<18;i++){const s=spawn();s.life=Math.random()*s.max;stars.push(s)}
    function frame(){ctx.clearRect(0,0,w,h); if(document.documentElement.dataset.theme==='night'){
      for(const s of stars){s.life++;s.x+=s.vx;s.y+=s.vy;if(s.life>s.max||s.x>w+150||s.y>h+100)reset(s);const a=Math.max(0,1-s.life/s.max);ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.x-s.len,s.y-s.len*.58);ctx.strokeStyle=`rgba(255,255,255,${a*.75})`;ctx.lineWidth=1.5;ctx.stroke();ctx.beginPath();ctx.arc(s.x,s.y,1.4,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,${a})`;ctx.fill();}
    } requestAnimationFrame(frame)} frame();
  }
  function year(){document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear())}
  document.addEventListener('DOMContentLoaded',()=>{initTheme();globalStatus();shootingStars();year();setInterval(globalStatus,30000)});
})();
