import { CATEGORIES } from './policy.mjs';
import { BOOK_RIDE_URL } from "./offerings.mjs";
import { audienceSwitch, servicesBand, waitingRoom, driverIntro, orientation } from './sections.mjs';
import { dbFor, listingOptions, publicFeed, publicPost, publicAttachments, readingMinutes, VISIBLE_SQL } from './content.mjs';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const E = escapeHtml;
const MAIN = 'https://www.ridearrivo.com';
function safeLink(value) {
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function inline(value) {
  // A small, deliberately restricted Markdown grammar. Raw HTML never executes.
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^\s)]+\))/g;
  let html = '', offset = 0;
  for (const match of value.matchAll(pattern)) {
    html += E(value.slice(offset, match.index));
    const token = match[0];
    if (token[0] === '`') html += `<code>${E(token.slice(1,-1))}</code>`;
    else if (token.startsWith('**')) html += `<strong>${E(token.slice(2,-2))}</strong>`;
    else {
      const parts = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const href = safeLink(parts[2]);
      html += href ? `<a href="${E(href)}" rel="noopener noreferrer">${E(parts[1])}</a>` : E(parts[1]);
    }
    offset = match.index + token.length;
  }
  return html + E(value.slice(offset));
}
export function markdownParts(body) {
  const lines = String(body || '').replace(/\r\n?/g,'\n').split('\n');
  let html = '', paragraph = [], list = [], code = [], fenced = false, index = 0;
  const headings = [];
  const flush = () => { if (paragraph.length) { html += `<p>${inline(paragraph.join(' '))}</p>`; paragraph = []; } if (list.length) { html += `<ul>${list.map(v=>`<li>${inline(v)}</li>`).join('')}</ul>`; list = []; } };
  for (const line of lines) {
    if (/^```/.test(line)) { flush(); if (fenced) { html += `<pre><code>${E(code.join('\n'))}</code></pre>`; code=[]; } fenced=!fenced; continue; }
    if (fenced) { code.push(line); continue; }
    const heading=/^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) { flush(); const level=Math.max(2,heading[1].length),id=`section-${++index}`; headings.push({id,title:heading[2]}); html += `<h${level} id="${id}">${inline(heading[2])}</h${level}>`; }
    else if (/^[-*]\s+/.test(line)) { if (paragraph.length) flush(); list.push(line.replace(/^[-*]\s+/,'')); }
    else if (/^>\s?/.test(line)) { flush(); html += `<blockquote><p>${inline(line.replace(/^>\s?/,''))}</p></blockquote>`; }
    else if (!line.trim()) flush();
    else { if (list.length) flush(); paragraph.push(line); }
  }
  flush(); if (code.length) html += `<pre><code>${E(code.join('\n'))}</code></pre>`;
  return { html, headings };
}
export const renderMarkdown = body => markdownParts(body).html;
export function siteOrigin(env) {
  try { const u=new URL(env.SITE_URL || 'https://blog.ridearrivo.com'); if(u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash) return u.origin; } catch {}
  return 'https://blog.ridearrivo.com';
}
const date = value => new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Lagos'}).format(new Date(value));
const arrow = '<span aria-hidden="true">&#8599;</span>';
function header(active='riders') { return `<a class="skip" href="#main">Skip to content</a><header class="site-header"><div class="nav-wrap"><a class="brand" href="/" aria-label="RideArrivo Journal home"><img class="wm-light" src="/assets/wordmark-on-light.png" alt="RideArrivo" width="173" height="42"><img class="wm-dark" src="/assets/wordmark.png" alt="" width="173" height="42" aria-hidden="true"><span>JOURNAL</span></a><nav aria-label="Main navigation"><a${active==='riders'?' class="nav-current" aria-current="page"':''} href="/">Riders</a><a${active==='drivers'?' class="nav-current" aria-current="page"':''} href="/drivers">Drivers</a><a class="nav-services" href="/#services">Services</a><a class="button small" href="${BOOK_RIDE_URL}">Book a ride ${arrow}</a><button class="theme-toggle" type="button" aria-label="Switch to dark mode" title="Switch to dark mode"><svg class="icon-moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg><svg class="icon-sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7"/></svg></button></nav></div></header>`; }
function footer() { return `<footer><div class="footer-top"><a class="brand" href="/"><img class="wm-light" src="/assets/wordmark-on-light.png" alt="RideArrivo" width="173" height="42"><img class="wm-dark" src="/assets/wordmark.png" alt="" width="173" height="42" aria-hidden="true"><span>JOURNAL</span></a><p>Better journeys start with a little insight.</p><a href="${MAIN}">Visit RideArrivo ${arrow}</a></div><div class="footer-bottom"><span>&copy; ${new Date().getFullYear()} RideArrivo. All rights reserved.</span><nav aria-label="Footer navigation"><a href="/">Riders</a><a href="/drivers">Drivers</a><a href="/rss.xml">RSS feed</a><a href="/admin">Staff sign-in</a><a href="${MAIN}">Main website</a></nav></div><div class="parasyte-sig"><a href="https://www.parasyte.cloud" target="_blank" rel="noopener noreferrer" aria-label="Built by Parasyte"><img src="/assets/parasyte-wordmark.png" alt="Parasyte" width="120" height="22" loading="lazy"></a></div></footer>`; }
function shell({title,description,canonical,image,body,indexable=false,article=null,active='riders'}) {
  const data = article ? {'@context':'https://schema.org','@type':'BlogPosting',headline:article.title,description:article.excerpt,datePublished:article.published_at,dateModified:article.updated_at,author:{'@type':'Organization',name:'RideArrivo'},publisher:{'@type':'Organization',name:'RideArrivo',url:MAIN},mainEntityOfPage:canonical,image} : {'@context':'https://schema.org','@type':'Blog',name:'RideArrivo Journal',url:canonical,description};
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fbfaf7"><meta name="color-scheme" content="light dark"><title>${E(title)}</title><meta name="description" content="${E(description)}"><meta name="robots" content="${indexable?'index,follow':'noindex,follow'}"><link rel="canonical" href="${E(canonical)}"><link rel="icon" href="/assets/favicon.png"><link rel="alternate" type="application/rss+xml" title="RideArrivo Journal" href="/rss.xml"><meta property="og:site_name" content="RideArrivo Journal"><meta property="og:type" content="${article?'article':'website'}"><meta property="og:title" content="${E(title)}"><meta property="og:description" content="${E(description)}"><meta property="og:url" content="${E(canonical)}"><meta property="og:image" content="${E(image)}"><meta name="twitter:card" content="summary_large_image">${article?`<meta property="article:published_time" content="${E(article.published_at)}"><meta property="article:modified_time" content="${E(article.updated_at)}">`:''}<script src="/theme.js"></script><link rel="stylesheet" href="/journal.css"><script src="/journal.js" defer></script><script type="application/ld+json">${JSON.stringify(data).replace(/</g,'\\u003c')}</script></head><body>${header(active)}<main id="main">${body}</main>${footer()}<div id="notice" class="notice" role="status" aria-live="polite"></div></body></html>`;
}
function cover(post, className='', eager=false) {
  const fallback = post.category === 'Travel guides' ? '/assets/arrival.webp' : post.category === 'For drivers' ? '/assets/journey.webp' : '/assets/fleet.webp';
  const src=post.cover_media_id?`/media/${post.cover_media_id}`:fallback;
  return `<img class="${E(className)}" src="${E(src)}" alt="${E(post.cover_media_id?post.cover_alt:'Illustrative RideArrivo brand image')}" loading="${eager?'eager':'lazy'}" decoding="async" width="1200" height="800">`;
}
function postCard(post) {
  if(post.content_type==='quick_post') return `<article class="story-card quick-post-card">${post.cover_media_id?`<a class="quick-post-image" href="/stories/${E(post.slug)}" tabindex="-1" aria-hidden="true">${cover(post)}</a>`:''}<div class="story-copy"><div class="eyebrow">QUICK WRITEUP<span class="dot"></span>${E(post.category)}</div><p class="quick-post-body">${E(post.body||post.title)}</p><div class="byline"><span>RideArrivo Editorial</span><time datetime="${E(post.published_at)}">${date(post.published_at)}</time></div><a class="text-link" href="/stories/${E(post.slug)}">Open update ${arrow}</a></div></article>`;
  return `<article class="story-card"><a class="story-cover" href="/stories/${E(post.slug)}" tabindex="-1" aria-hidden="true">${cover(post)}<span class="image-arrow">${arrow}</span></a><div class="story-copy"><div class="eyebrow">${E(post.category)}<span class="dot"></span>${post.reading_minutes} min read</div><h3><a href="/stories/${E(post.slug)}">${E(post.title)}</a></h3><p>${E(post.excerpt)}</p><div class="byline"><span>RideArrivo Editorial</span><time datetime="${E(post.published_at)}">${date(post.published_at)}</time></div></div></article>`;
}
function attachmentDownloads(items=[]) {
  if(!items.length)return '';
  return `<section class="article-downloads" aria-labelledby="downloads-title"><span class="eyebrow">FILES FROM THIS STORY</span><h2 id="downloads-title">Downloads</h2><div class="download-list">${items.map(item=>`<a class="download-item" href="/attachments/${E(item.id)}"><span><strong>${E(item.original_filename)}</strong><small>${E(item.mime_type)} &middot; ${Math.max(1,Math.ceil(Number(item.byte_size||0)/1024))} KiB</small></span><span aria-hidden="true">&#8595;</span></a>`).join('')}</div></section>`;
}
function journeyShowcase() {
  const steps = [
    ['Share your details','Enter your pickup and destination.'],
    ['Pick your vehicle','Choose the ride that fits you.'],
    ['Choose how to pay','Pay securely your way.'],
    ['Track in real time','See your driver\'s live location.'],
    ['Rate and relax','Arrive safely and share your feedback.']
  ];
  return `<section class="journey-showcase reveal" aria-label="Five steps from booking to arrival"><div class="journey-heading"><div><span class="eyebrow">THE RIDE, STEP BY STEP</span><h2>Five moments. One smooth journey.</h2></div><p>From the first detail to the final rating, see how a RideArrivo trip comes together.</p></div><div class="journey-stage" data-journey-stage>${steps.map((step,index)=>`<button class="journey-panel${index===0?' is-active':''}" type="button" data-journey-panel="${index+1}" aria-pressed="${index===0?'true':'false'}" aria-label="Step ${index+1}: ${E(step[0])}. ${E(step[1])}"><img src="/assets/journey-steps/step-${index+1}.webp" alt="" width="1122" height="1402" loading="lazy" decoding="async"></button>`).join('')}</div><p class="journey-hint">Hover, focus or swipe through the five steps.</p></section>`;
}
function promo() { return `<section class="promo reveal"><div class="promo-photo"><img src="/assets/journey.webp" alt="A comfortable journey with RideArrivo" width="1200" height="800" loading="lazy"></div><div class="promo-copy"><span class="eyebrow">FROM READING TO RIDING</span><h2>Your next chapter<br>starts with a <em>ride.</em></h2><p>Explore RideArrivo and plan the journey that comes next.</p><a class="button" href="${MAIN}">Discover RideArrivo ${arrow}</a></div><div class="promo-orbit" aria-hidden="true"></div></section>`; }
export function renderHome(feed,env,request,audience='riders') {
  const origin=siteOrigin(env), drivers=audience==='drivers', base=drivers?'/drivers':'/', shownCategory=drivers?'':feed.category, filtered=Boolean(feed.query||shownCategory||feed.page>1);
  const first=feed.posts.find(p=>p.content_type!=='quick_post');
  const hero = filtered ? `<section class="filter-heading"><span class="eyebrow">${drivers?'THE DRIVER SIDE':'THE JOURNAL'}</span><h1>${feed.query?'Search results':E(shownCategory||'All stories')}</h1><p>${feed.query?`Stories matching &ldquo;${E(feed.query)}&rdquo;.`:'Find your next read.'}</p><a class="text-link" href="${base}">&#8592; Back to ${drivers?'the driver side':'the journal'}</a></section>`
    : drivers ? audienceSwitch('drivers')+driverIntro()+orientation()
    : `${audienceSwitch('riders')}<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span>THE RIDEARRIVO JOURNAL</div><h1>Know the road<br>before you <em>ride.</em></h1><p>What is changing in Lagos transport, and every way RideArrivo gets you where you are going.</p><div class="hero-actions"><a class="button" href="${BOOK_RIDE_URL}">Book a ride ${arrow}</a><a class="button ghost" href="#services">See all services</a></div></div><div class="hero-visual"><img src="/assets/hero.jpg" alt="A navy vehicle outside an illuminated airport, with a plane overhead; illustrative RideArrivo brand scene" width="1600" height="900" fetchpriority="high"></div></section>${servicesBand()}`;
  const featured=first&&!filtered&&!drivers?`<section class="featured reveal"><div class="section-title"><div><span class="eyebrow">TRENDING NOW</span><h2>The story to read first</h2></div></div><article class="featured-grid"><a class="featured-image" href="/stories/${E(first.slug)}" aria-label="Read ${E(first.title)}">${cover(first,'',true)}</a><div class="featured-copy"><div class="eyebrow">${E(first.category)}<span class="dot"></span>${first.reading_minutes} min read</div><h2><a href="/stories/${E(first.slug)}">${E(first.title)}</a></h2><p>${E(first.excerpt)}</p><a class="button ghost" href="/stories/${E(first.slug)}">Read the story ${arrow}</a><div class="byline"><span>RideArrivo Editorial</span><time datetime="${E(first.published_at)}">${date(first.published_at)}</time></div></div></article></section>`:'';
  const queryParams=new URLSearchParams(); if(feed.query)queryParams.set('q',feed.query); if(shownCategory)queryParams.set('category',shownCategory);
  const anchor=drivers?'#driver-stories':'#stories';
  const pageLink=p=>{const q=new URLSearchParams(queryParams);q.set('page',p);return base+'?'+q.toString()+anchor;};
  const rest=featured?feed.posts.filter(p=>p!==first):feed.posts;
  const cards=rest.map(postCard).join('');
  const cats=drivers?[]:['',...CATEGORIES.filter(c=>c!=='For drivers')];
  const catNav=cats.length?`<nav class="categories" aria-label="Article categories">${cats.map(c=>{const q=new URLSearchParams();if(c)q.set('category',c);if(feed.query)q.set('q',feed.query);return `<a ${shownCategory===c?'aria-current="page"':''} href="${base}${q.size?'?'+E(q):''}${anchor}">${E(c||'All stories')}</a>`;}).join('')}</nav>`:'';
  const emptyTitle=filtered?'No stories found.':drivers?'Driver stories are on the way.':'New stories. New perspectives.';
  const emptyText=filtered?'Try another topic or browse all stories.':drivers?'We are preparing guides and news for drivers. Until then, you can apply to drive today.':'Our first stories will appear here as soon as they are published. Until then, explore every way RideArrivo can move you.';
  const emptyHref=filtered?base:drivers?'https://www.ridearrivo.com/driver.html':'#services';
  const emptyLabel=filtered?'Browse all stories':drivers?'Apply to drive':'See all services';
  const stories=`<section class="stories" id="${drivers?'driver-stories':'stories'}"><div class="section-title"><div><span class="eyebrow">${drivers?'FOR DRIVERS':'THE READING ROOM'}</span><h2>${filtered?'Explore the stories':drivers?'News and guides for drivers':'What is happening in transport'}</h2></div><form class="search" role="search" method="get" action="${base}"><label class="sr-only" for="story-search">Search articles</label><input id="story-search" name="q" type="search" placeholder="Search stories" value="${E(feed.query)}" maxlength="100">${shownCategory?`<input type="hidden" name="category" value="${E(shownCategory)}">`:''}<button type="submit" aria-label="Search articles">&#8594;</button></form></div>${catNav}${feed.total?`<p class="result-count">${feed.total} ${feed.total===1?'story':'stories'}${feed.page>1?` &middot; Page ${feed.page}`:''}</p>${cards?`<div class="story-grid">${cards}</div>`:(featured?'':'<p>No articles on this page. Return to the previous page.</p>')}`:`<div class="empty-state"><span class="eyebrow">${filtered?'A FRESH SEARCH':'SOMETHING GOOD IS ON THE WAY'}</span><h3>${emptyTitle}</h3><p>${emptyText}</p><a class="button ghost" href="${emptyHref}">${emptyLabel} ${arrow}</a></div>`}<nav class="pagination" aria-label="Pagination">${feed.page>1?`<a href="${E(pageLink(feed.page-1))}">&#8592; Previous</a>`:''}${feed.page*feed.page_size<feed.total?`<a href="${E(pageLink(feed.page+1))}">Next stories &#8594;</a>`:''}</nav></section>`;
  const title=drivers?'Drive with RideArrivo | Driver news, guides and how to join':'RideArrivo Journal | Lagos transport news and every RideArrivo service';
  const description=drivers?'How to become a RideArrivo driver, what to prepare, and news and guides for drivers in Lagos.':'Lagos transport news, travel guides and a clear guide to every RideArrivo service: airport transfers, chauffeur, moves and charter.';
  return shell({title,description,canonical:origin+base,image:origin+'/assets/share.png',body:hero+featured+stories+(!filtered&&!drivers?journeyShowcase():'')+waitingRoom()+promo(),indexable:new URL(request.url).origin===origin&&!filtered,active:audience});
}
export function renderArticle(post,env,request,related=[],attachments=[]) {
  const origin=siteOrigin(env),canonical=origin+'/stories/'+post.slug,{html,headings}=markdownParts(post.body),downloads=attachmentDownloads(attachments);
  if(post.content_type==='quick_post') return shell({title:post.title+' | RideArrivo Journal',description:post.body.slice(0,200),canonical,image:origin+(post.cover_media_id?`/media/${post.cover_media_id}`:'/assets/share.png'),indexable:new URL(request.url).origin===origin,article:post,body:`<section class="quick-post-page"><a class="back-link" href="/">&#8592; Back to the journal</a><div class="quick-post-panel"><div class="eyebrow">QUICK WRITEUP<span class="dot"></span>${E(post.category)}</div>${post.cover_media_id?`<figure class="quick-post-cover">${cover(post,'',true)}</figure>`:''}<div class="quick-post-prose">${html}</div>${downloads}<div class="article-meta"><span class="editorial-avatar" aria-hidden="true">R.</span><span>RideArrivo Editorial<small><time datetime="${E(post.published_at)}">${date(post.published_at)}</time></small></span><div class="share-controls"><a class="button ghost small" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonical)}" target="_blank" rel="noopener noreferrer">Share ${arrow}</a><button class="button ghost small" type="button" data-copy="${E(canonical)}">Copy link</button></div></div></div></section>${promo()}`});
  return shell({title:post.title+' | RideArrivo Journal',description:post.excerpt,canonical,image:origin+(post.cover_media_id?`/media/${post.cover_media_id}`:'/assets/share.png'),indexable:new URL(request.url).origin===origin,article:post,body:`<progress class="reading-progress" max="100" value="0" aria-label="Article reading progress"></progress><section class="article-heading"><a class="back-link" href="/">&#8592; Back to the journal</a><div class="eyebrow">${E(post.category)}<span class="dot"></span>${readingMinutes(post.body)} MIN READ</div><h1>${E(post.title)}</h1><p class="article-deck">${E(post.excerpt)}</p><div class="article-meta"><span class="editorial-avatar" aria-hidden="true">R.</span><span>RideArrivo Editorial<small><time datetime="${E(post.published_at)}">${date(post.published_at)}</time></small></span><div class="share-controls"><a class="button ghost small" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonical)}" target="_blank" rel="noopener noreferrer" aria-label="Share this article on LinkedIn (opens a new tab)">Share on LinkedIn ${arrow}</a><button class="button ghost small" type="button" data-copy="${E(canonical)}">Copy link</button></div></div></section><figure class="article-cover">${cover(post,'',true)}${!post.cover_media_id?'<figcaption>Illustrative RideArrivo brand image.</figcaption>':''}</figure><div class="article-layout"><aside class="article-aside"><span class="eyebrow">IN THIS STORY</span><nav aria-label="On this page">${headings.map(h=>`<a href="#${E(h.id)}">${E(h.title.replace(/\*\*/g,''))}</a>`).join('')}</nav><a class="text-link" href="${MAIN}">Explore RideArrivo ${arrow}</a></aside><article class="prose" id="article-body">${html}${downloads}<div class="article-end"><span class="eyebrow">THE JOURNEY CONTINUES</span><h2>Ready for what comes next?</h2><p>Get more information about RideArrivo, explore our services and plan your next journey on our main website.</p><a class="button" href="${MAIN}">Visit the RideArrivo website ${arrow}</a></div></article></div>${related.length?`<section class="stories"><div class="section-title"><h2>Keep exploring.</h2><a class="text-link" href="/">All stories ${arrow}</a></div><div class="story-grid">${related.map(postCard).join('')}</div></section>`:''}${promo()}`});
}
export async function routePublic(request,env,services) {
  const url=new URL(request.url),origin=siteOrigin(env);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
  const response=(body,status=200,type='text/html; charset=utf-8')=>new Response(body,{status,headers:{'Content-Type':type}});
  if(url.pathname==='/')return response(renderHome(await publicFeed(dbFor(env),{...listingOptions(url),exclude_category:'For drivers'},services.now()),env,request,'riders'));
  if(url.pathname==='/drivers'||url.pathname==='/drivers/'){const o=listingOptions(url);return response(renderHome(await publicFeed(dbFor(env),{...o,category:'For drivers'},services.now()),env,request,'drivers'));}
  if(url.pathname==='/rss.xml'||url.pathname==='/sitemap.xml') {
    const rows=await dbFor(env).prepare(`SELECT * FROM ra_blog_posts WHERE ${VISIBLE_SQL} ORDER BY published_at DESC,id LIMIT 5000`).bind(services.now().toISOString()).all();
    if(url.pathname==='/sitemap.xml')return response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${E(origin)}/</loc></url><url><loc>${E(origin)}/drivers</loc></url>${rows.results.map(p=>`<url><loc>${E(origin+'/stories/'+p.slug)}</loc><lastmod>${E(p.updated_at)}</lastmod></url>`).join('')}</urlset>`,200,'application/xml; charset=utf-8');
    return response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>RideArrivo Journal</title><link>${E(origin)}</link><description>Perspectives for the journey.</description><language>en</language>${rows.results.slice(0,50).map(p=>`<item><title>${E(p.title)}</title><link>${E(origin+'/stories/'+p.slug)}</link><guid isPermaLink="true">${E(origin+'/stories/'+p.slug)}</guid><description>${E(p.excerpt)}</description><pubDate>${new Date(p.published_at).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`,200,'application/rss+xml; charset=utf-8');
  }
  const match=/^\/stories\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(url.pathname);
  if(match){const db=dbFor(env),post=await publicPost(db,match[1],services.now());if(post){const [related,attachments]=await Promise.all([publicFeed(db,{query:'',category:post.category,page:1,page_size:4},services.now()),publicAttachments(db,post.id)]);return response(renderArticle(post,env,request,related.posts.filter(p=>p.id!==post.id).slice(0,3),attachments));}}
  return response(shell({title:'Story not found | RideArrivo Journal',description:'This story is not available.',canonical:origin+'/',image:origin+'/assets/share.png',body:'<section class="empty-state error-page"><span class="eyebrow">404 / A DIFFERENT DIRECTION</span><h1>This story is not available.</h1><p>It may not be published yet, or the address may have changed.</p><a class="button" href="/">Back to the journal &#8594;</a></section>'}),404);
}
