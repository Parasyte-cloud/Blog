(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let noticeTimer;
  const announce = text => { const el=document.getElementById('notice'); if(!el)return;el.textContent=text;el.classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>el.classList.remove('visible'),4200); };
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click',async()=>{
    try { await navigator.clipboard.writeText(button.dataset.copy); announce('Article link copied.'); }
    catch { announce('Copy is unavailable. Copy the address from your browser instead.'); }
  }));
  const toggle=document.querySelector('.motion-toggle');
  toggle?.addEventListener('click',()=>{const paused=document.documentElement.classList.toggle('motion-paused');toggle.setAttribute('aria-pressed',String(paused));toggle.setAttribute('aria-label',paused?'Resume decorative motion':'Pause decorative motion');toggle.textContent=paused?'Resume motion':'Pause motion';});
  if ('IntersectionObserver' in window && !reduced.matches) {
    document.documentElement.classList.add('js-reveal');
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}}),{threshold:.08});
    document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
  }
  const progress=document.querySelector('.reading-progress'), article=document.getElementById('article-body');
  if(progress&&article){let queued=false;const update=()=>{const rect=article.getBoundingClientRect();const total=rect.height-window.innerHeight+120;progress.value=Math.max(0,Math.min(100,(120-rect.top)/Math.max(1,total)*100));queued=false;};window.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update);}},{passive:true});window.addEventListener('resize',update);update();}
})();
