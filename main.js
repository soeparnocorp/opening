// main.js — combined immersive engine
(() => {
  // ---- config ----
  const cfg = {
    fpsLimit: 60,
    starCount: 220,
    particleCount: 120,
    rippleLifetime: 900,
    warpSpeedFactor: 0.0007, // increases warp on scroll
    mobileFPS: 30
  };

  // ---- utilities ----
  const isMobile = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent);
  const now = () => performance.now();

  // ---- canvases ----
  const glowC = document.getElementById('glowCanvas');
  const starC = document.getElementById('starfield');
  const partC = document.getElementById('particleCanvas');
  const rippleC = document.getElementById('rippleCanvas');

  const canvases = [glowC, starC, partC, rippleC];
  const ctx = { glow: glowC.getContext('2d'), star: starC.getContext('2d'), part: partC.getContext('2d'), ripple: rippleC.getContext('2d') };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvases.forEach(c => {
      c.width = Math.floor(innerWidth * dpr);
      c.height = Math.floor(innerHeight * dpr);
      c.style.width = innerWidth + 'px';
      c.style.height = innerHeight + 'px';
      c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  // ---- STARFIELD / warp ----
  const stars = [];
  function initStars(){
    stars.length = 0;
    for(let i=0;i<cfg.starCount;i++){
      stars.push({
        x: Math.random()*innerWidth,
        y: Math.random()*innerHeight,
        z: Math.random()*1.0 + 0.001,
        size: Math.random()*1.4 + 0.2,
        hue: 180 + Math.random()*70
      });
    }
  }

  // ---- PARTICLES (dust) ----
  const particles = [];
  function initParticles(){
    particles.length = 0;
    for(let i=0;i<cfg.particleCount;i++){
      particles.push({
        x: Math.random()*innerWidth,
        y: Math.random()*innerHeight,
        vx: (Math.random()-0.5)*0.2,
        vy: (Math.random()-0.5)*0.2,
        size: Math.random()*2.2 + 0.6,
        alpha: 0.05 + Math.random()*0.25
      });
    }
  }

  // ---- RIPPLES (touch waves) ----
  const ripples = []; // {x,y,r,started,life}
  function addRipple(x,y,force=1){
    ripples.push({ x, y, r: 0, started: now(), life: cfg.rippleLifetime, force});
    // limit ripple count
    if(ripples.length>12) ripples.shift();
  }

  // ---- input / parallax state ----
  const state = { mx: innerWidth/2, my: innerHeight/2, px:0, py:0, scroll:0, lastMove:now() };

  window.addEventListener('mousemove', e=>{
    state.mx = e.clientX; state.my = e.clientY; state.lastMove = now();
    // small ripple on hover move?
    // create micro ripple occasionally
    if(Math.random() < 0.02) addRipple(state.mx, state.my, 0.5);
  }, {passive:true});

  window.addEventListener('pointerdown', e => {
    addRipple(e.clientX, e.clientY, 1.4);
  }, {passive:true});

  window.addEventListener('wheel', e=>{
    state.scroll += e.deltaY;
  }, {passive:true});

  // ---- draw functions ----
  function drawGlow(dt){
    const c = ctx.glow;
    c.clearRect(0,0,innerWidth,innerHeight);
    // moving radial gradients (fake nebula)
    const grd1 = c.createRadialGradient(innerWidth*0.2, innerHeight*0.2, 0, innerWidth*0.2, innerHeight*0.2, innerWidth*0.9);
    grd1.addColorStop(0, 'rgba(40,120,200,0.06)');
    grd1.addColorStop(0.6, 'rgba(10,10,25,0.0)');

    const grd2 = c.createRadialGradient(innerWidth*0.8, innerHeight*0.7, 0, innerWidth*0.8, innerHeight*0.7, innerWidth*0.9);
    grd2.addColorStop(0, 'rgba(200,120,220,0.04)');
    grd2.addColorStop(0.6, 'rgba(0,0,0,0.0)');

    c.globalCompositeOperation = 'lighter';
    c.fillStyle = grd1;
    c.fillRect(0,0,innerWidth,innerHeight);
    c.fillStyle = grd2;
    c.fillRect(0,0,innerWidth,innerHeight);

    // subtle moving noise arcs
    c.globalCompositeOperation = 'lighter';
    for(let i=0;i<3;i++){
      const px = (Math.sin((performance.now() * 0.00008 * (i+1)) + i) * 0.5 + 0.5) * innerWidth;
      c.beginPath();
      c.fillStyle = `rgba(140,180,255,${0.01*(1+i)})`;
      c.ellipse(px, innerHeight*0.3 + Math.sin(performance.now()*0.0003*i)*30, innerWidth*0.7, innerHeight*0.6, 0, 0, Math.PI*2);
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }

  function drawStars(dt){
    const c = ctx.star;
    c.clearRect(0,0,innerWidth,innerHeight);
    // warp factor from scroll and mouse speed
    const mxFactor = ((state.mx - innerWidth/2) / innerWidth) * 0.6;
    const warp = Math.max(0.2, 1 + Math.abs(state.scroll)*cfg.warpSpeedFactor);
    for(let s of stars){
      s.z -= 0.002 * warp * (0.6 + s.size*0.4);
      if(s.z <= 0.001){ s.x = Math.random()*innerWidth; s.y = Math.random()*innerHeight; s.z = 1.0; }
      const px = (s.x - innerWidth/2) / s.z + innerWidth/2 + mxFactor*80*(1-s.z);
      const py = (s.y - innerHeight/2) / s.z + innerHeight/2;
      const size = s.size * (1.0 / s.z) * 0.9;
      const alpha = 0.6 * (1.2 - s.z);
      c.fillStyle = `rgba(220,240,255,${alpha})`;
      c.beginPath();
      c.arc(px, py, size, 0, Math.PI*2);
      c.fill();
    }
  }

  function drawParticles(dt){
    const c = ctx.part;
    c.clearRect(0,0,innerWidth,innerHeight);
    // parallax drift via mouse
    const sx = (state.mx - innerWidth/2) * 0.02;
    const sy = (state.my - innerHeight/2) * 0.02;
    for(let p of particles){
      // drift
      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;
      // wrap
      if(p.x < -20) p.x = innerWidth + 20;
      if(p.x > innerWidth + 20) p.x = -20;
      if(p.y < -20) p.y = innerHeight + 20;
      if(p.y > innerHeight + 20) p.y = -20;
      c.beginPath();
      const alpha = p.alpha;
      c.fillStyle = `rgba(200,230,255,${alpha})`;
      // slight parallax
      c.arc(p.x + sx*(p.size*0.3), p.y + sy*(p.size*0.3), p.size, 0, Math.PI*2);
      c.fill();
    }
  }

  function drawRipples(dt){
    const c = ctx.ripple;
    c.clearRect(0,0,innerWidth,innerHeight);
    const t = now();
    for(let i=ripples.length-1;i>=0;i--){
      const r = ripples[i];
      const age = t - r.started;
      if(age > r.life){ ripples.splice(i,1); continue; }
      const prog = age / r.life;
      const radius = prog * Math.max(innerWidth, innerHeight) * 0.4 * (0.9 + r.force);
      c.beginPath();
      const alpha = Math.max(0, 0.35 * (1-prog));
      const grd = c.createRadialGradient(r.x, r.y, radius*0.1, r.x, r.y, radius);
      grd.addColorStop(0, `rgba(140,200,255,${alpha*0.18})`);
      grd.addColorStop(0.6, `rgba(70,120,160,${alpha*0.06})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = grd;
      c.fillRect(0,0,innerWidth,innerHeight);

      // subtle displacement ring
      c.beginPath();
      c.strokeStyle = `rgba(200,230,255,${alpha*0.9})`;
      c.lineWidth = Math.max(1, 6*(1-prog));
      c.globalCompositeOperation = 'lighter';
      c.arc(r.x, r.y, radius*0.6, 0, Math.PI*2);
      c.stroke();
      c.globalCompositeOperation = 'source-over';
    }
  }

  // ---- main loop ----
  let last = now();
  function step(){
    const cur = now();
    const dt = Math.min(40, cur - last);
    last = cur;

    // throttle fps on mobile
    const fpsCap = isMobile ? cfg.mobileFPS : cfg.fpsLimit;
    // simple fps control using timeout recursion not perfect but ok
    drawGlow(dt);
    drawStars(dt);
    drawParticles(dt);
    drawRipples(dt);

    // decay scroll to gradually reduce warp
    state.scroll *= 0.95;

    requestAnimationFrame(step);
  }

  // ---- init and spawn ----
  function init(){
    initStars();
    initParticles();
    // sample initial ripples (gentle)
    // addRipple(innerWidth/2, innerHeight/2, 0.6);
    step();
  }

  init();

  // ---- Holographic panels: drag + inertia + parallax ----
  const panels = Array.from(document.querySelectorAll('.panel'));
  panels.forEach(p=>{
    p.style.willChange = 'transform';
    makeDraggable(p);
  });

  function makeDraggable(el){
    let isDown = false;
    let sx=0, sy=0, ox=0, oy=0;
    let velX=0, velY=0, lastT=0;
    el.addEventListener('pointerdown', e=>{
      isDown = true; el.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY;
      const st = el.getBoundingClientRect();
      ox = st.left; oy = st.top;
      velX = velY = 0;
      lastT = now();
      el.style.transition = 'none';
    });
    window.addEventListener('pointermove', e=>{
      if(!isDown) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const t = now();
      const dt = Math.max(1, t - lastT);
      velX = (dx)/dt*16; velY = (dy)/dt*16;
      el.style.transform = `translate(${ox+dx}px, ${oy+dy}px) translateZ(30px) rotateX(${(sy - e.clientY)/80}deg) rotateY(${(e.clientX - sx)/80}deg)`;
      lastT = t;
    });
    window.addEventListener('pointerup', e=>{
      if(!isDown) return;
      isDown=false;
      el.releasePointerCapture(e.pointerId);
      el.style.transition = 'transform 800ms cubic-bezier(.2,.9,.2,1)';
      // inertia simulation
      const startX = parseFloat(el.style.transform.split('translate(')[1]||ox) || ox;
      let vx = velX*6, vy = velY*6;
      let px = 0, py = 0;
      const dec = 0.95;
      const anim = () => {
        vx *= dec; vy *= dec;
        px += vx; py += vy;
        el.style.transform = `translate(${ox+px}px, ${oy+py}px) translateZ(0px)`;
        if(Math.abs(vx)+Math.abs(vy) > 0.05) requestAnimationFrame(anim);
      };
      anim();
    });
  }

  // subtle HUD parallax following mouse
  const hud = document.getElementById('hud');
  window.addEventListener('mousemove', e=>{
    const cx = (e.clientX - innerWidth/2)/innerWidth*30;
    const cy = (e.clientY - innerHeight/2)/innerHeight*30;
    hud.style.transform = `translateZ(0) translate3d(${cx}px, ${cy}px, 0)`;
  }, {passive:true});

  // small periodic UI update (hull/power)
  setInterval(()=>{
    document.getElementById('hull').textContent = (60 + Math.floor(Math.random()*35)) + '%';
    document.getElementById('power').textContent = (20 + Math.floor(Math.random()*55)) + '%';
    document.getElementById('vec').textContent = `↑ ${(Math.random()*1.4).toFixed(2)}`;
  }, 2500);

  // adapt performance: reduce particle counts on mobile
  if(isMobile){
    // drop some particles
    while(particles.length > 40) particles.pop();
    while(stars.length > 100) stars.pop();
  }

})();
