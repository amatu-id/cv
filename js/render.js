/* Turns structure() into A4/Letter pages. Blocks are measured off-screen, then placed page by page,
   so the preview, the thumbnails and the PDF share exactly one layout. */
'use strict';
(function () {
const E = CV.esc;
const PAPER = {a4:[793.7, 1122.5], letter:[816, 1056]};
CV.PAPER = PAPER;

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(h, w, t) { const a = hexRgb(h), b = hexRgb(w); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
function lum(h) { const c = hexRgb(h).map(v => { v /= 255; return v < .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }

function vars(d, T, t) {
  const [W, H] = PAPER[d.paper] || PAPER.a4;
  const acc = T.color || T.group === 'design' ? (d.accent || T.acc) : '#111827';
  const fsPt = Math.max(8, (d.fs || T.fs || 10) - 1.2 * t);
  const sp = (d.sp || 1) * (1 - .5 * t), mg = (d.mg || 1) * (T.mg || 1) * (1 - .22 * t);
  const fb = d.font || T.fb, fh = T.fh || (d.font || T.fb);
  const on = lum(acc) > .45 ? '#111827' : '#ffffff';
  return `--W:${W}px;--H:${H}px;--fs:${(fsPt * 96 / 72).toFixed(3)}px;--sp:${sp.toFixed(3)};--lh:${(1.36 - .08 * t).toFixed(3)};--mx:${(54 * mg).toFixed(1)}px;--my:${(46 * mg).toFixed(1)}px;--ac:${acc};--on:${on};--on2:${mix(on, acc, .24)};--t1:${mix(acc, '#ffffff', .92)};--t2:${mix(acc, '#ffffff', .82)};--t3:${mix(acc, '#ffffff', .55)};--dk:${mix(acc, '#000000', .18)};--fb:'${fb}';--fh:'${fh}';--fm:'${T.fm || fb}'`;
}

function photoOn(d, T) { return d.photo === 'on' ? true : d.photo === 'off' ? false : !!T.photo; }

/* ---------- block builders ---------- */
const link = (it) => it.href ? `<a href="${E(it.href)}">${E(it.text)}</a>` : E(it.text);

function contactLine(st, T) {
  const sep = T.group === 'ats' ? ' | ' : ' · ';
  return st.contact.map((c, i) => `<span class="ci">${link(c)}</span>${i < st.contact.length - 1 ? `<span class="cs">${sep}</span>` : ''}`).join('');
}
function contactGrid(st) {
  return st.contact.map(c => `<div class="cg"><span class="ck">${E(c.label)}</span><span class="cv-v">${link(c)}</span></div>`).join('');
}
function initials(name) { return (name || '').replace(/,.*$/, '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase(); }

function headHtml(st, d, T) {
  const ph = photoOn(d, T) && st.photo && T.photoIn === 'head' ? `<img class="ph" alt="" src="${E(st.photo)}">` : '';
  const ct = T.contact === 'head' || !T.contact ? (st.contact.length ? `<div class="ct">${contactLine(st, T)}</div>` : '')
    : T.contact === 'grid' ? (st.contact.length ? `<div class="ctg">${contactGrid(st)}</div>` : '') : '';
  return `<div class="hd"><div class="hd-t">${st.name ? `<div class="nm">${E(st.name)}</div>` : ''}${st.jabatan ? `<div class="jb">${E(st.jabatan)}</div>` : ''}${ct}</div>${ph}</div>`;
}

function entryHtml(it, style, keep, inSide) {
  const m = it.meta ? `<div class="m">${E(it.meta)}</div>` : '';
  const lk = it.link ? `<div class="m"><a href="${E(it.link.href)}">${E(it.link.text)}</a></div>` : '';
  const cls = 'b eh' + (it.compact ? ' cp' : '');
  const k = keep ? ' data-k="1"' : '';
  const orgLoc = [it.o, it.l].filter(Boolean).join(', ');
  if (inSide || style === 'stack') return `<div class="${cls} st"${k}><div class="t">${E(it.t)}</div>${orgLoc ? `<div class="o">${E(orgLoc)}</div>` : ''}${it.d ? `<div class="d">${E(it.d)}</div>` : ''}${m}${lk}</div>`;
  if (style === 'stackdate') return `<div class="${cls} sd"${k}><i class="dot"></i><div class="r"><div class="t">${E(it.t)}</div>${it.d ? `<div class="d">${E(it.d)}</div>` : ''}</div>${orgLoc ? `<div class="o">${E(orgLoc)}</div>` : ''}${m}${lk}</div>`;
  if (style === 'inline') return `<div class="${cls} il"${k}><div class="r"><div class="t">${E(it.t)}${orgLoc ? `<span class="o">${it.t ? ', ' : ''}${E(orgLoc)}</span>` : ''}</div>${it.d ? `<div class="d">${E(it.d)}</div>` : ''}</div>${m}${lk}</div>`;
  if (style === 'dateleft') return `<div class="${cls} dl"${k}><div class="d">${E(it.d)}</div><div class="dl-b"><div class="t">${E(it.t)}</div>${orgLoc ? `<div class="o">${E(orgLoc)}</div>` : ''}${m}${lk}</div></div>`;
  if (style === 'orgfirst' && !it.compact) return `<div class="${cls} of"${k}><div class="r"><div class="t2">${E(it.o || it.t)}</div>${it.l ? `<div class="l">${E(it.l)}</div>` : ''}</div>${it.o && it.t ? `<div class="r"><div class="o">${E(it.t)}</div>${it.d ? `<div class="d">${E(it.d)}</div>` : ''}</div>` : (it.d ? `<div class="r"><div></div><div class="d">${E(it.d)}</div></div>` : '')}${m}${lk}</div>`;
  return `<div class="${cls}"${k}><div class="r"><div class="t">${E(it.t)}</div>${it.d ? `<div class="d">${E(it.d)}</div>` : ''}</div>${orgLoc ? `<div class="r r2"><div class="o">${E(it.o)}</div>${it.l ? `<div class="l">${E(it.l)}</div>` : ''}</div>` : ''}${m}${lk}</div>`;
}

function sectionBlocks(sec, T, inSide, num, d) {
  const out = [], dotted = T.dots && T.dots.includes(sec.key);
  const tag = dotted ? ' tl' : '';
  const n = T.numbered ? `<span class="no">${String(num).padStart(2, '0')}</span>` : '';
  out.push({html:`<div class="b h" data-k="1">${n}<span class="ht">${E(sec.title)}</span></div>`});
  sec.items.forEach((it, idx) => {
    if (it.kind === 'para') { out.push({html:`<div class="b pa">${E(it.text)}</div>`}); return; }
    if (it.kind === 'bullet') { out.push({html:`<div class="b li"><span class="mk">•</span><span class="tx">${E(it.text)}</span></div>`}); return; }
    if (it.kind === 'kv') { out.push({html:`<div class="b kv"><span class="k">${E(it.label)}</span><span class="v">${E(it.text)}</span></div>`}); return; }
    if (it.kind === 'line') {
      if (sec.key === 'skill' && inSide && T.skill === 'chips') {
        out.push({html:`<div class="b sg">${it.label ? `<div class="sl">${E(it.label)}</div>` : ''}<div class="chips">${it.items.map(x => `<span class="chip">${E(x)}</span>`).join(' ')}</div></div>`});
      } else if (sec.key === 'skill' && inSide) {
        out.push({html:`<div class="b sg">${it.label ? `<div class="sl">${E(it.label)}</div>` : ''}<div class="sv">${E(it.text)}</div></div>`});
      } else if (sec.key === 'bahasa' && T.lang === 'dots' && it.level) {
        const dots = [1,2,3,4,5].map(i => `<i class="ld${i <= it.level ? ' on' : ''}"></i>`).join('');
        out.push({html:`<div class="b lg"><div class="lg-n">${E(it.label)}<span class="lg-s"> ${E(it.text)}</span></div><div class="lds">${dots}</div></div>`});
      } else {
        out.push({html:`<div class="b ln">${it.label ? `<b>${E(it.label)}${it.text ? ':' : ''}</b> ` : ''}${E(it.text)}</div>`});
      }
      return;
    }
    const bl = it.bullets || [];
    const style = T.entry;
    const cls = tag + (idx === sec.items.length - 1 ? ' last' : '');
    let eh = entryHtml(it, style, bl.length > 0, inSide);
    if (dotted && !eh.includes('class="dot"')) eh = eh.replace('>', '><i class="dot"></i>');
    if (!dotted) eh = eh.replace('<i class="dot"></i>', '');
    if (cls) eh = eh.replace('class="b eh', 'class="b' + cls + ' eh');
    out.push({html:eh, keep:bl.length > 0});
    bl.forEach((b, i) => out.push({html:`<div class="b li${tag}${style === 'dateleft' && !inSide ? ' ind' : ''}${idx === sec.items.length - 1 ? ' last' : ''}"><span class="mk">•</span><span class="tx">${E(b)}</span></div>`}));
  });
  return out;
}

/* Everything the layout needs, independent of page breaks. */
function assemble(d, T) {
  const st = CV.structure(d), keys = CV.orderedKeys(d, T);
  const sideKeys = T.layout === 'one' ? [] : (T.side || []);
  const main = [], side = [];
  const headIn = T.headIn || 'top';
  const headBlock = {html:`<div class="b hb">${headHtml(st, d, T)}</div>`};
  if (T.layout !== 'one' && headIn === 'main') main.push(headBlock);
  if (T.layout !== 'one' && T.photoIn === 'side' && photoOn(d, T) && st.photo) side.push({html:`<div class="b phb"><img class="ph" alt="" src="${E(st.photo)}"></div>`});
  if (T.mono && initials(st.name)) side.push({html:`<div class="b mono"><span>${E(initials(st.name))}</span></div>`});
  if (sideKeys.includes('kontak') && st.contact.length) {
    side.push({html:`<div class="b h" data-k="1"><span class="ht">${E(CV.title(d, 'kontak'))}</span></div>`});
    st.contact.forEach(c => side.push({html:`<div class="b kv cvk"><span class="k">${E(c.label)}</span><span class="v">${link(c)}</span></div>`}));
  }
  /* side sections follow the template's order so sidebars stay balanced */
  const mainKeys = keys.filter(k => !sideKeys.includes(k));
  let num = 1;
  mainKeys.forEach(k => { if (st.secs[k]) main.push(...sectionBlocks(st.secs[k], T, false, num++, d)); });
  keys.filter(k => sideKeys.includes(k)).sort((a, b) => sideKeys.indexOf(a) - sideKeys.indexOf(b)).forEach(k => { if (st.secs[k]) side.push(...sectionBlocks(st.secs[k], T, true, num++, d)); });
  return {st, main, side, top: headIn === 'top' || T.layout === 'one' ? headHtml(st, d, T) : ''};
}

const blk = a => a.map(b => b.html).join('');

function pageShell(T, styleVars, cfg) {
  const cols = T.layout === 'one'
    ? `<div class="cv-cols"><div class="cv-col cv-main">${cfg.main}</div></div>`
    : `<div class="cv-cols"><div class="cv-col cv-main">${cfg.main}</div><div class="cv-col cv-side">${cfg.side}</div></div>`;
  return `<div class="cv t-${T.id} l-${T.layout}${cfg.first ? ' first' : ''}${cfg.measure ? ' measure' : ''}${cfg.top ? ' has-top' : ''}" style="${styleVars};--sw:${T.sideW || '30%'}">${cfg.top ? `<div class="cv-top">${cfg.top}</div>` : ''}${cols}</div>`;
}

/* Places blocks onto pages. Heading and entry headers stay attached to what follows them. */
function place(col, blocks, avail) {
  const els = [...col.children];
  const pages = [[]]; let pi = 0, startTop = null, lastBottom = 0, i = 0;
  while (i < els.length) {
    let j = i; while (j < els.length - 1 && els[j].dataset.k) j++;
    const top = els[i].getBoundingClientRect().top, bottom = els[j].getBoundingClientRect().bottom;
    if (startTop === null) startTop = top;
    if (bottom - startTop > avail(pi) && pages[pi].length) { pi++; pages[pi] = []; startTop = top; }
    for (let x = i; x <= j; x++) pages[pi].push(blocks[x]);
    lastBottom = bottom - startTop;
    i = j + 1;
  }
  return {pages, fill: lastBottom / avail(pi)};
}

function paginate(d, T, stage, t) {
  const A = assemble(d, T), sv = vars(d, T, t);
  stage.innerHTML = pageShell(T, sv, {first:true, measure:true, top:A.top, main:blk(A.main), side:blk(A.side)});
  const page = stage.firstElementChild;
  const H = parseFloat(sv.match(/--H:([\d.]+)/)[1]);
  const topEl = page.querySelector('.cv-top'), topH = topEl ? topEl.getBoundingClientRect().height : 0;
  const scale = page.getBoundingClientRect().width / page.offsetWidth || 1;
  const run = (col, blocks) => {
    if (!col || !blocks.length) return {pages:[[]], fill:0};
    const cs = getComputedStyle(col), pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
    const my = parseFloat(sv.match(/--my:([\d.]+)/)[1]);
    const a0 = (H - topH / scale - pt - pb) * scale, an = (H - my - pb) * scale;
    return place(col, blocks, i => i === 0 ? a0 : an);
  };
  const m = run(page.querySelector('.cv-main'), A.main), s = run(page.querySelector('.cv-side'), A.side);
  const n = Math.max(m.pages.length, s.pages.length);
  const html = [];
  for (let i = 0; i < n; i++) {
    html.push(pageShell(T, sv, {first:i === 0, top:i === 0 ? A.top : '', main:blk(m.pages[i] || []), side:blk(s.pages[i] || [])}));
  }
  const fill = m.pages.length >= s.pages.length ? m.fill : s.fill;
  return {html, n, fill};
}

/* Auto-fit: 'auto' pulls in a nearly empty last page, 1 / 2 force a page limit, 'free' leaves it alone. */
CV.layout = function (d, stage) {
  const T = CV.tpl(d.tpl), fit = d.fit;
  let r = paginate(d, T, stage, 0), t = 0, over = false;
  const target = fit === 'auto' ? (r.n > 1 && r.fill < .3 ? r.n - 1 : r.n) : fit === 'free' ? r.n : +fit;
  if (r.n > target) {
    const ceil = fit === 'auto' ? .4 : 1;
    let lo = 0, hi = ceil, best = null;
    const atMax = paginate(d, T, stage, hi);
    if (atMax.n <= target) {
      best = {r:atMax, t:hi};
      for (let k = 0; k < 6; k++) {
        const mid = (lo + hi) / 2, q = paginate(d, T, stage, mid);
        if (q.n <= target) { best = {r:q, t:mid}; hi = mid; } else lo = mid;
      }
    }
    if (best) { r = best.r; t = best.t; }
    else if (fit !== 'auto') over = true;   /* cannot fit: keep the readable size and say so */
  }
  stage.innerHTML = '';
  return {pages:r.html, n:r.n, t, over, target, T};
};

/* Fonts must be ready before measuring, otherwise line breaks shift after they load. */
const loaded = new Map();
CV.ensureFonts = async function (d, T) {
  const fams = new Set([d.font || T.fb, T.fh || (d.font || T.fb), T.fm].filter(Boolean)), jobs = [];
  fams.forEach(f => (CV.FONT_WEIGHTS[f] || ['400']).forEach(s => {
    const key = f + s;
    if (!loaded.has(key)) loaded.set(key, document.fonts.load(`${s.endsWith('i') ? 'italic ' : ''}${s.replace('i', '')} 16px "${f}"`, 'Aag').catch(() => {}));
    jobs.push(loaded.get(key));
  }));
  await Promise.all(jobs);
};
})();
