import { ORIENTATION, OFFERINGS, DRIVER_APPLY_URL, DRIVER_STEPS, DRIVER_CHECKLIST, DRIVER_FAQ, SOCIALS } from './offerings.mjs';
const E = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const arrow = '<span aria-hidden="true">&#8599;</span>';
const MAIN = 'https://www.ridearrivo.com';

export function audienceSwitch(active) {
  const item = (key, href, label) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<nav class="audience" aria-label="Choose your side of the journal">${item('riders', '/', 'For riders')}${item('drivers', '/drivers', 'For drivers')}</nav>`;
}

// Click-to-open cards. Native <details name="..."> gives keyboard, screen reader and
// no-JavaScript support, and the shared name keeps one card open at a time.
export function servicesBand() {
  const cards = OFFERINGS.map(o => `<details class="svc" name="services" id="svc-${E(o.id)}"><summary><span class="svc-group">${E(o.group)}</span><span class="svc-name">${E(o.name)}</span><span class="svc-tag">${E(o.tag)}</span><span class="svc-more" aria-hidden="true"></span></summary><div class="svc-body"><p class="svc-lead">${E(o.summary)}</p><p class="svc-best"><strong>Best for:</strong> ${E(o.best)}</p><ul>${o.points.map(p => `<li>${E(p)}</li>`).join('')}</ul><div class="svc-actions"><span class="svc-status">${E(o.status)}</span><a class="button" href="${E(o.cta.href)}">${E(o.cta.label)} ${arrow}</a></div></div></details>`).join('');
  return `<section class="services" id="services" aria-labelledby="services-title"><div class="services-head"><div><span class="eyebrow">WHAT WE OFFER</span><h2 id="services-title">Every way to move with RideArrivo</h2></div><p>Tap a card to see what it is, who it suits and how to book.</p></div><div class="svc-grid">${cards}</div></section>`;
}

export function waitingRoom() {
  return `<section class="waiting" aria-labelledby="waiting-title"><div class="waiting-copy"><span class="eyebrow">NOT READY TO BOOK?</span><h2 id="waiting-title">Take a seat. Read a little. Ride when you are ready.</h2><p>We publish what is changing in Lagos transport so you can plan with confidence. When you want a ride, we are one tap away.</p><div class="waiting-actions"><a class="button" href="${MAIN}/book.html">Book a ride ${arrow}</a><a class="button ghost" href="https://wa.me/2348162706078">Chat on WhatsApp ${arrow}</a></div></div><div class="waiting-side"><h3>Follow RideArrivo</h3><ul class="social-list">${SOCIALS.map(([n, h]) => `<li><a href="${E(h)}" rel="noopener noreferrer">${E(n)} ${arrow}</a></li>`).join('')}<li><a href="/rss.xml">RSS feed</a></li></ul><p class="waiting-driver">Driving instead? <a href="/drivers">Go to the driver side</a>.</p></div></section>`;
}

export function driverIntro() {
  return `<section class="driver-hero"><div><div class="eyebrow"><span class="live-dot"></span>THE DRIVER SIDE</div><h1>Drive with RideArrivo.</h1><p class="lead">Join a professional driver network built around Lagos airport pickups. Here is how joining works, what you need, and what is changing on the road.</p><div class="hero-actions"><a class="button" href="${E(DRIVER_APPLY_URL)}">Apply to drive ${arrow}</a><a class="button ghost" href="#orientation">Read the orientation</a></div></div><ol class="steps" aria-label="How joining works">${DRIVER_STEPS.map(([t, d], i) => `<li><span class="step-num" aria-hidden="true">${i + 1}</span><div><h3>${E(t)}</h3><p>${E(d)}</p></div></li>`).join('')}</ol></section><section class="driver-detail"><div class="need"><span class="eyebrow">BEFORE YOU APPLY</span><h2>What to have ready</h2><ul class="checklist">${DRIVER_CHECKLIST.map(c => `<li>${E(c)}</li>`).join('')}</ul></div><div class="faq"><span class="eyebrow">QUESTIONS DRIVERS ASK</span><h2>Straight answers</h2>${DRIVER_FAQ.map(([q, a]) => `<details class="faq-item" name="driver-faq"><summary>${E(q)}</summary><p>${E(a)}</p></details>`).join('')}</div></section>`;
}

export function orientation() {
  const list = items => items.length ? `<ul>${items.map(i => `<li>${E(i)}</li>`).join('')}</ul>` : '';
  const cards = ORIENTATION.map(m => `<details class="svc ori" name="orientation" id="ori-${E(m.id)}"><summary><span class="svc-group">Orientation</span><span class="svc-name">${E(m.title)}</span><span class="svc-tag">${E(m.blurb)}</span><span class="svc-more" aria-hidden="true"></span></summary><div class="ori-body"><div class="ori-col do"><h3>Do</h3>${list(m.do)}</div>${m.dont.length ? `<div class="ori-col dont"><h3>Avoid</h3>${list(m.dont)}</div>` : ''}</div></details>`).join('');
  return `<section class="services orientation" id="orientation" aria-labelledby="ori-title"><div class="services-head"><div><span class="eyebrow">DRIVER ORIENTATION</span><h2 id="ori-title">How a RideArrivo driver looks, speaks and drives</h2></div><p>Read these before your first trip. Tap a topic to open it.</p></div><div class="svc-grid">${cards}</div></section>`;
}
