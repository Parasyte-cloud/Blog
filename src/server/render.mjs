import { CATEGORIES } from './policy.mjs';
import { dbFor, listingOptions, publicFeed, publicPost, readingMinutes, VISIBLE_SQL } from './content.mjs';
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
function header() { return `<a class="skip" href="#main">Skip to content</a><header class="site-header"><div class="nav-wrap"><a class="brand" href="/" aria-label="RideArrivo Journal home"><img src="/assets/wordmark.png" alt="RideArrivo" width="173" height="42"><span>JOURNAL</span></a><nav aria-label="Main navigation"><a class="nav-current" href="/">The journal</a><a href="${MAIN}">Explore RideArrivo ${arrow}</a><a class="button small" href="${MAIN}/">Plan your ride ${arrow}</a></nav></div></header>`; }
function footer() { return `<footer><div class="footer-top"><a class="brand" href="/"><img src="/assets/wordmark.png" alt="RideArrivo" width="173" height="42"><span>JOURNAL</span></a><p>Better journeys start with a little insight.</p><a href="${MAIN}">Visit RideArrivo ${arrow}</a></div><div class="footer-bottom"><span>&copy; ${new Date().getFullYear()} RideArrivo. All rights reserved.</span><nav aria-label="Footer navigation"><a href="/rss.xml">RSS feed</a><a href="/admin">Staff sign-in</a><a href="${MAIN}">Main website</a></nav></div></footer>`; }
function shell({title,description,canonical,image,body,indexable=false,article=null}) {
  const data = article ? {'@context':'https://schema.org','@type':'BlogPosting',headline:article.title,description:article.excerpt,datePublished:article.published_at,dateModified:article.updated_at,author:{'@type':'Organization',name:'RideArrivo'},publisher:{'@type':'Organization',name:'RideArrivo',url:MAIN},mainEntityOfPage:canonical,image} : {'@context':'https://schema.org','@type':'Blog',name:'RideArrivo Journal',url:canonical,description};
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#091521"><title>${E(title)}</title><meta name="description" content="${E(description)}"><meta name="robots" content="${indexable?'index,follow':'noindex,follow'}"><link rel="canonical" href="${E(canonical)}"><link rel="icon" href="/assets/favicon.png"><link rel="alternate" type="application/rss+xml" title="RideArrivo Journal" href="/rss.xml"><meta property="og:site_name" content="RideArrivo Journal"><meta property="og:type" content="${article?'article':'website'}"><meta property="og:title" content="${E(title)}"><meta property="og:description" content="${E(description)}"><meta property="og:url" content="${E(canonical)}"><meta property="og:image" content="${E(image)}"><meta name="twitter:card" content="summary_large_image">${article?`<meta property="article:published_time" content="${E(article.published_at)}"><meta property="article:modified_time" content="${E(article.updated_at)}">`:''}<link rel="stylesheet" href="/journal.css"><script src="/journal.js" defer></script><script type="application/ld+json">${JSON.stringify(data).replace(/</g,'\\u003c')}</script></head><body>${header()}<main id="main">${body}</main>${footer()}<div id="notice" class="notice" role="status" aria-live="polite"></div></body></html>`;
}
function cover(post, className='', eager=false) {
  const fallback = post.category === 'Travel guides' ? '/assets/arrival.webp' : post.category === 'For drivers' ? '/assets/journey.webp' : '/assets/fleet.webp';
  const src=post.cover_media_id?`/media/${post.cover_media_id}`:fallback;
  return `<img class="${E(className)}" src="${E(src)}" alt="${E(post.cover_media_id?post.cover_alt:'Illustrative RideArrivo brand image')}" loading="${eager?'eager':'lazy'}" decoding="async" width="1200" height="800">`;
}
function postCard(post) { return `<article class="story-card"><a class="story-cover" href="/stories/${E(post.slug)}" tabindex="-1" aria-hidden="true">${cover(post)}<span class="image-arrow">${arrow}</span></a><div class="story-copy"><div class="eyebrow">${E(post.category)}<span class="dot"></span>${post.reading_minutes} min read</div><h3><a href="/stories/${E(post.slug)}">${E(post.title)}</a></h3><p>${E(post.excerpt)}</p><div class="byline"><span>RideArrivo Editorial</span><time datetime="${E(post.published_at)}">${date(post.published_at)}</time></div></div></article>`; }
function promo() { return `<section class="promo reveal"><div class="promo-photo"><img src="/assets/journey.webp" alt="A comfortable journey with RideArrivo" width="1200" height="800" loading="lazy"></div><div class="promo-copy"><span class="eyebrow">FROM READING TO RIDING</span><h2>Your next chapter<br>starts with a <em>ride.</em></h2><p>Explore RideArrivo and plan the journey that comes next.</p><a class="button" href="${MAIN}">Discover RideArrivo ${arrow}</a></div><div class="promo-orbit" aria-hidden="true"></div></section>`; }
export function renderHome(feed,env,request) {
  const origin=siteOrigin(env), filtered=Boolean(feed.query||feed.category||feed.page>1);
  const first=feed.posts[0];
  const hero = !filtered ? `<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span>THE RIDEARRIVO JOURNAL</div><h1>More than<br>a destination.<br><em>A perspective.</em></h1><p>Stories for the journey. Fresh perspectives on mobility, life in Lagos and arriving well.</p><a class="text-link" href="#stories">Explore the journal <span aria-hidden="true">&#8595;</span></a><div class="hero-bottom"><span>INSIGHT. INSPIRATION. ARRIVAL.</span><button class="motion-toggle" type="button" aria-pressed="false" aria-label="Pause decorative motion">Pause motion</button></div></div><div class="hero-visual"><img src="/assets/hero.jpg" alt="A navy vehicle outside an illuminated airport, with a plane overhead; illustrative RideArrivo brand scene" width="1600" height="900" fetchpriority="high"><div class="light-sweep" aria-hidden="true"></div><div class="hero-caption"><span class="eyebrow">A DIFFERENT WAY TO ARRIVE</span><span>Lagos, through a new lens.</span><span class="caption-mark" aria-hidden="true">R.</span></div></div></section><div class="journal-ribbon"><span>THE JOURNEY CONTINUES</span><span aria-hidden="true">&#10022;</span><span>LAGOS &amp; BEYOND</span><span aria-hidden="true">&#10022;</span><span>IDEAS THAT MOVE US</span><span aria-hidden="true">&#10022;</span><span>ARRIVE. RELAX.</span></div>` : `<section class="filter-heading"><span class="eyebrow">THE JOURNAL</span><h1>${feed.query?'Search results':E(feed.category||'All stories')}</h1><p>${feed.query?`Stories matching &ldquo;${E(feed.query)}&rdquo;.`:'Find your next perspective.'}</p><a class="text-link" href="/">&#8592; Back to the journal</a></section>`;
  const featured=first&&!filtered?`<section class="featured reveal"><div class="section-title"><span class="eyebrow">IN FOCUS</span><span>THE LATEST PERSPECTIVE</span></div><article class="featured-grid"><a class="featured-image" href="/stories/${E(first.slug)}" aria-label="Read ${E(first.title)}">${cover(first,'',true)}</a><div class="featured-copy"><div class="eyebrow">${E(first.category)}<span class="dot"></span>${first.reading_minutes} min read</div><h2><a href="/stories/${E(first.slug)}">${E(first.title)}</a></h2><p>${E(first.excerpt)}</p><a class="button ghost" href="/stories/${E(first.slug)}">Read the story ${arrow}</a><div class="byline"><span>RideArrivo Editorial</span><time datetime="${E(first.published_at)}">${date(first.published_at)}</time></div></div></article></section>`:'';
  const queryParams=new URLSearchParams(); if(feed.query)queryParams.set('q',feed.query); if(feed.category)queryParams.set('category',feed.category);
  const pageLink=p=>{const q=new URLSearchParams(queryParams);q.set('page',p);return '/?'+q.toString()+'#stories';};
  const cards=feed.posts.map(postCard).join('');
  const stories=`<section class="stories" id="stories"><div class="section-title"><div><span class="eyebrow">THE READING ROOM</span><h2>${filtered?'Explore the stories':'A little insight.<br>A better journey.'}</h2></div><form class="search" role="search" method="get" action="/"><label class="sr-only" for="story-search">Search articles</label><input id="story-search" name="q" type="search" placeholder="Find your next read" value="${E(feed.query)}" maxlength="100">${feed.category?`<input type="hidden" name="category" value="${E(feed.category)}">`:''}<button type="submit" aria-label="Search articles">&#8594;</button></form></div><nav class="categories" aria-label="Article categories">${['',...CATEGORIES].map(c=>{const q=new URLSearchParams();if(c)q.set('category',c);if(feed.query)q.set('q',feed.query);return `<a ${feed.category===c?'aria-current="page"':''} href="/${q.size?'?'+E(q):''}#stories">${E(c||'All stories')}</a>`;}).join('')}</nav>${feed.total?`<p class="result-count">${feed.total} ${feed.total===1?'story':'stories'}${feed.page>1?` &middot; Page ${feed.page}`:''}</p><div class="story-grid">${cards||'<p>No articles on this page. Return to the previous page.</p>'}</div>`:`<div class="empty-state"><span class="eyebrow">${filtered?'A FRESH SEARCH':'SOMETHING GOOD IS ON THE WAY'}</span><h3>${filtered?'No stories found.':'New stories. New perspectives.'}</h3><p>${filtered?'Try another topic or browse all stories.':'Our first stories will appear here as soon as they are published. Until then, explore the world of RideArrivo.'}</p><a class="button ghost" href="${filtered?'/':MAIN}">${filtered?'Browse all stories':'Explore RideArrivo'} ${arrow}</a></div>`}<nav class="pagination" aria-label="Pagination">${feed.page>1?`<a href="${E(pageLink(feed.page-1))}">&#8592; Previous</a>`:''}${feed.page*feed.page_size<feed.total?`<a href="${E(pageLink(feed.page+1))}">Next stories &#8594;</a>`:''}</nav></section>`;
  return shell({title:'RideArrivo Journal | Perspectives for the journey',description:'Stories, travel inspiration and thoughtful perspectives on mobility from RideArrivo.',canonical:origin+'/',image:origin+'/assets/share.png',body:hero+featured+stories+promo(),indexable:new URL(request.url).origin===origin&&!filtered});
}
export function renderArticle(post,env,request,related=[]) {
  const origin=siteOrigin(env),canonical=origin+'/stories/'+post.slug,{html,headings}=markdownParts(post.body);
  return shell({title:post.title+' | RideArrivo Journal',description:post.excerpt,canonical,image:origin+(post.cover_media_id?`/media/${post.cover_media_id}`:'/assets/share.png'),indexable:new URL(request.url).origin===origin,article:post,body:`<progress class="reading-progress" max="100" value="0" aria-label="Article reading progress"></progress><section class="article-heading"><a class="back-link" href="/">&#8592; Back to the journal</a><div class="eyebrow">${E(post.category)}<span class="dot"></span>${readingMinutes(post.body)} MIN READ</div><h1>${E(post.title)}</h1><p class="article-deck">${E(post.excerpt)}</p><div class="article-meta"><span class="editorial-avatar" aria-hidden="true">R.</span><span>RideArrivo Editorial<small><time datetime="${E(post.published_at)}">${date(post.published_at)}</time></small></span><div class="share-controls"><a class="button ghost small" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonical)}" target="_blank" rel="noopener noreferrer" aria-label="Share this article on LinkedIn (opens a new tab)">Share on LinkedIn ${arrow}</a><button class="button ghost small" type="button" data-copy="${E(canonical)}">Copy link</button></div></div></section><figure class="article-cover">${cover(post,'',true)}${!post.cover_media_id?'<figcaption>Illustrative RideArrivo brand image.</figcaption>':''}</figure><div class="article-layout"><aside class="article-aside"><span class="eyebrow">IN THIS STORY</span><nav aria-label="On this page">${headings.map(h=>`<a href="#${E(h.id)}">${E(h.title.replace(/\*\*/g,''))}</a>`).join('')}</nav><a class="text-link" href="${MAIN}">Explore RideArrivo ${arrow}</a></aside><article class="prose" id="article-body">${html}<div class="article-end"><span class="eyebrow">THE JOURNEY CONTINUES</span><h2>Ready for what comes next?</h2><p>Get more information about RideArrivo, explore our services and plan your next journey on our main website.</p><a class="button" href="${MAIN}">Visit the RideArrivo website ${arrow}</a></div></article></div>${related.length?`<section class="stories"><div class="section-title"><h2>Keep exploring.</h2><a class="text-link" href="/">All stories ${arrow}</a></div><div class="story-grid">${related.map(postCard).join('')}</div></section>`:''}${promo()}`});
}
export async function routePublic(request,env,services) {
  const url=new URL(request.url),origin=siteOrigin(env);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
  const response=(body,status=200,type='text/html; charset=utf-8')=>new Response(body,{status,headers:{'Content-Type':type}});
  if(url.pathname==='/')return response(renderHome(await publicFeed(dbFor(env),listingOptions(url),services.now()),env,request));
  if(url.pathname==='/rss.xml'||url.pathname==='/sitemap.xml') {
    const rows=await dbFor(env).prepare(`SELECT * FROM ra_blog_posts WHERE ${VISIBLE_SQL} ORDER BY published_at DESC,id LIMIT 5000`).bind(services.now().toISOString()).all();
    if(url.pathname==='/sitemap.xml')return response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${E(origin)}/</loc></url>${rows.results.map(p=>`<url><loc>${E(origin+'/stories/'+p.slug)}</loc><lastmod>${E(p.updated_at)}</lastmod></url>`).join('')}</urlset>`,200,'application/xml; charset=utf-8');
    return response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>RideArrivo Journal</title><link>${E(origin)}</link><description>Perspectives for the journey.</description><language>en</language>${rows.results.slice(0,50).map(p=>`<item><title>${E(p.title)}</title><link>${E(origin+'/stories/'+p.slug)}</link><guid isPermaLink="true">${E(origin+'/stories/'+p.slug)}</guid><description>${E(p.excerpt)}</description><pubDate>${new Date(p.published_at).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`,200,'application/rss+xml; charset=utf-8');
  }
  const match=/^\/stories\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(url.pathname);
  if(match){const post=await publicPost(dbFor(env),match[1],services.now());if(post){const related=await publicFeed(dbFor(env),{query:'',category:post.category,page:1,page_size:4},services.now());return response(renderArticle(post,env,request,related.posts.filter(p=>p.id!==post.id).slice(0,3)));}}
  return response(shell({title:'Story not found | RideArrivo Journal',description:'This story is not available.',canonical:origin+'/',image:origin+'/assets/share.png',body:'<section class="empty-state error-page"><span class="eyebrow">404 / A DIFFERENT DIRECTION</span><h1>This story is not available.</h1><p>It may not be published yet, or the address may have changed.</p><a class="button" href="/">Back to the journal &#8594;</a></section>'}),404);
}
