(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let noticeTimer;
  // Theme toggle. Writes the same cookies as the main site so the choice follows the visitor across ridearrivo.com.
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const writeCookie = (name, value) => {
    const shared = /(^|\.)ridearrivo\.com$/.test(location.hostname) ? '; Domain=.ridearrivo.com' : '';
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    try { document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${shared}${secure}`; } catch {}
  };
  const paintTheme = () => {
    const mode = root.getAttribute('data-theme-mode') || 'light';
    const theme = mode === 'system' ? (systemDark.matches ? 'dark' : 'light') : mode;
    root.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#091521' : '#fbfaf7');
    document.querySelectorAll('.theme-toggle').forEach(b => { const next = theme === 'dark' ? 'light' : 'dark'; b.setAttribute('aria-label', `Switch to ${next} mode`); b.setAttribute('title', `Switch to ${next} mode`); b.setAttribute('aria-pressed', String(theme === 'dark')); });
  };
  document.querySelectorAll('.theme-toggle').forEach(button => button.addEventListener('click', () => {
    const now = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light', next = now === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme-mode', next); writeCookie('arrivo_theme_mode', next); writeCookie('arrivo_theme', next); paintTheme();
  }));
  systemDark.addEventListener?.('change', () => { if (root.getAttribute('data-theme-mode') === 'system') paintTheme(); });
  paintTheme();
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
  const journeyPanels=[...document.querySelectorAll('[data-journey-panel]')];
if(journeyPanels.length){
let active=Math.max(0,journeyPanels.findIndex(panel=>panel.classList.contains('is-active')));
const setActive=index=>{active=(index+journeyPanels.length)%journeyPanels.length;journeyPanels.forEach((panel,i)=>{const on=i===active;panel.classList.toggle('is-active',on);panel.setAttribute('aria-pressed',String(on));});};
journeyPanels.forEach((panel,index)=>{panel.addEventListener('mouseenter',()=>setActive(index));panel.addEventListener('focus',()=>setActive(index));panel.addEventListener('click',()=>setActive(index));});
setInterval(()=>{if(document.hidden||reduced.matches||document.documentElement.classList.contains('motion-paused'))return;setActive(active+1);},4200);
}
const progress=document.querySelector('.reading-progress'), article=document.getElementById('article-body');
  if(progress&&article){let queued=false;const update=()=>{const rect=article.getBoundingClientRect();const total=rect.height-window.innerHeight+120;progress.value=Math.max(0,Math.min(100,(120-rect.top)/Math.max(1,total)*100));queued=false;};window.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update);}},{passive:true});window.addEventListener('resize',update);update();}
})();
