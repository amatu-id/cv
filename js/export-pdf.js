/* Writes a real-text PDF by reading the laid-out pages from the DOM: every line of text stays a text
   operator with an embedded font and a ToUnicode map, so ATS parsers and text search can read it. */
'use strict';
(function () {
let libs = null;
function script(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Gagal memuat ' + src)); document.head.appendChild(s); }); }
async function loadLibs() {
  if (!libs) libs = Promise.all([script('vendor/pdf-lib.min.js'), script('vendor/fontkit.umd.min.js')]);
  await libs;
  return window.PDFLib;
}
const fontBytes = {};
function fontUrl(fam, st) { return 'fonts/' + fam.replace(/ /g, '') + '-' + st + '.woff'; }
async function getBytes(fam, st) {
  const k = fam + st;
  if (!fontBytes[k]) fontBytes[k] = fetch(fontUrl(fam, st)).then(r => { if (!r.ok) throw new Error('Font tidak tersedia: ' + k); return r.arrayBuffer(); });
  return fontBytes[k];
}
function pickStyle(fam, weight, italic) {
  const all = CV.FONT_WEIGHTS[fam] || ['400'];
  const pool = all.filter(s => s.endsWith('i') === italic);
  const list = pool.length ? pool : all;
  let best = list[0], bd = 1e9;
  for (const s of list) { const d = Math.abs(parseInt(s, 10) - weight); if (d < bd) { bd = d; best = s; } }
  return best;
}
function parseColor(c) {
  const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null;
  const p = m[1].split(/[ ,/]+/).map(parseFloat);
  if (p.length > 3 && p[3] === 0) return null;
  return [p[0] / 255, p[1] / 255, p[2] / 255];
}

async function build(d, pagesHtml, stage) {
  const L = await loadLibs();
  const pdf = await L.PDFDocument.create();
  pdf.registerFontkit(window.fontkit);
  const [W, H] = CV.PAPER[d.paper] || CV.PAPER.a4;
  const PX = .75, PW = W * PX, PH = H * PX;
  const embedded = {}, images = new Map(), ascents = {};

  const probe = (fam, st, weight, italic) => {
    const key = fam + st;
    if (ascents[key] != null) return ascents[key];
    const box = document.createElement('div');
    box.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;line-height:normal;font:${italic ? 'italic ' : ''}${weight} 100px "${fam}";`;
    box.innerHTML = '<span>Hg</span><span style="display:inline-block;width:0;height:0"></span>';
    stage.appendChild(box);
    const a = box.children[0].getBoundingClientRect(), b = box.children[1].getBoundingClientRect();
    const scale = box.getBoundingClientRect().height / box.offsetHeight || 1;
    ascents[key] = (b.bottom - a.top) / scale / 100;
    box.remove();
    return ascents[key];
  };
  const getFont = async (fam, st) => {
    const k = fam + st;
    if (!embedded[k]) embedded[k] = pdf.embedFont(await getBytes(fam, st), {subset:true, customName:fam.replace(/ /g, '') + '-' + st});
    return embedded[k];
  };

  /* collect first (fonts are async), then draw in order */
  stage.innerHTML = pagesHtml.join('');
  const pageEls = [...stage.querySelectorAll('.cv')];
  const unknown = new Set();

  for (const pageEl of pageEls) {
    const page = pdf.addPage([PW, PH]);
    const base = pageEl.getBoundingClientRect(), S = base.width / pageEl.offsetWidth || 1;
    const X = v => (v - base.left) / S * PX, Y = v => PH - (v - base.top) / S * PX, LEN = v => v / S * PX;
    const ops = [], runs = [], links = [];

    const roundPath = (x, y, w, h, r) => {
      /* x,y = top-left in PDF space, h grows downward */
      const k = .5523 * r, o = L;
      if (r <= 0) return [o.moveTo(x, y), o.lineTo(x + w, y), o.lineTo(x + w, y - h), o.lineTo(x, y - h), o.closePath()];
      return [o.moveTo(x + r, y), o.lineTo(x + w - r, y), o.appendBezierCurve(x + w - r + k, y, x + w, y - r + k, x + w, y - r),
        o.lineTo(x + w, y - h + r), o.appendBezierCurve(x + w, y - h + r - k, x + w - r + k, y - h, x + w - r, y - h),
        o.lineTo(x + r, y - h), o.appendBezierCurve(x + r - k, y - h, x, y - h + r - k, x, y - h + r),
        o.lineTo(x, y - r), o.appendBezierCurve(x, y - r + k, x + r - k, y, x + r, y), o.closePath()];
    };

    const walk = el => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const rects = el.getBoundingClientRect();
      const x = X(rects.left), y = Y(rects.top), w = LEN(rects.width), h = LEN(rects.height);

      if (el !== pageEl && w > 0 && h > 0) {
        const bg = parseColor(cs.backgroundColor);
        const fr = parseFloat(cs.borderTopLeftRadius) || 0;
        const r = Math.min(cs.borderTopLeftRadius.endsWith('%') ? (fr / 100) * Math.min(w, h) : fr * PX, w / 2, h / 2);
        if (bg) ops.push({t:'fill', c:bg, path:roundPath(x, y, w, h, r)});
        const sides = [['Top', x, y, w, parseFloat(cs.borderTopWidth) * PX], ['Bottom', x, y - h + parseFloat(cs.borderBottomWidth) * PX, w, parseFloat(cs.borderBottomWidth) * PX]];
        const lw = parseFloat(cs.borderLeftWidth) * PX, rw = parseFloat(cs.borderRightWidth) * PX;
        for (const [n, sx, sy, sw, sh] of sides) {
          const c = parseColor(cs['border' + n + 'Color']);
          if (sh > 0 && cs['border' + n + 'Style'] !== 'none' && c && r === 0) ops.push({t:'fill', c, path:roundPath(sx, sy, sw, sh, 0)});
        }
        const lc = parseColor(cs.borderLeftColor), rc = parseColor(cs.borderRightColor);
        if (lw > 0 && cs.borderLeftStyle !== 'none' && lc && r === 0) ops.push({t:'fill', c:lc, path:roundPath(x, y, lw, h, 0)});
        if (rw > 0 && cs.borderRightStyle !== 'none' && rc && r === 0) ops.push({t:'fill', c:rc, path:roundPath(x + w - rw, y, rw, h, 0)});
        if (r > 0 && parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') {
          const c = parseColor(cs.borderTopColor), bw = parseFloat(cs.borderTopWidth) * PX;
          if (c) ops.push({t:'stroke', c, w:bw, path:roundPath(x + bw / 2, y - bw / 2, w - bw, h - bw, Math.max(0, r - bw / 2))});
        }
        if (el.tagName === 'IMG' && el.src) ops.push({t:'img', el, x, y, w, h, r});
      }
      if (el.tagName === 'A' && el.getAttribute('href')) {
        for (const q of el.getClientRects()) links.push({href:el.getAttribute('href'), x:X(q.left), y:Y(q.bottom), w:LEN(q.width), h:LEN(q.height)});
      }
      for (const n of el.childNodes) {
        if (n.nodeType === 1) walk(n);
        else if (n.nodeType === 3 && n.data.trim()) textNode(n, cs);
      }
    };

    const textNode = (node, cs) => {
      const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      const italic = cs.fontStyle === 'italic', weight = parseInt(cs.fontWeight, 10) || 400;
      const st = pickStyle(fam, weight, italic);
      const size = parseFloat(cs.fontSize);
      const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0;
      const color = parseColor(cs.color) || [0, 0, 0];
      const tt = cs.textTransform;
      const asc = probe(fam, st, weight, italic);
      const re = /\S+/g, range = document.createRange(), lines = [];
      let m;
      while ((m = re.exec(node.data))) {
        range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
        const rs = [...range.getClientRects()].filter(r => r.width > 0);
        if (!rs.length) continue;
        let spans = [{a:m.index, b:m.index + m[0].length, r:rs[0], right:rs[rs.length - 1].right}];
        if (rs.length > 1 && Math.abs(rs[0].top - rs[rs.length - 1].top) > 2) {
          /* a long token wrapped across lines: split per character */
          spans = [];
          for (let i = m.index; i < m.index + m[0].length; i++) {
            range.setStart(node, i); range.setEnd(node, i + 1);
            const q = range.getClientRects()[0]; if (!q) continue;
            const s = spans[spans.length - 1];
            if (s && Math.abs(s.r.top - q.top) < 2) { s.b = i + 1; s.right = q.right; } else spans.push({a:i, b:i + 1, r:q, right:q.right});
          }
        }
        for (const s of spans) {
          const line = lines[lines.length - 1];
          if (line && Math.abs(line.top - s.r.top) < 2) { line.b = s.b; line.right = s.right; }
          else lines.push({a:s.a, b:s.b, top:s.r.top, left:s.r.left, right:s.right});
        }
      }
      for (const ln of lines) {
        let text = node.data.slice(ln.a, ln.b).replace(/\s+/g, ' ');
        if (tt === 'uppercase') text = text.toUpperCase(); else if (tt === 'lowercase') text = text.toLowerCase();
        runs.push({text, fam, st, size:size * PX, ls:ls * PX, color, x:X(ln.left), baseY:Y(ln.top + asc * size * S), width:LEN(ln.right - ln.left)});
      }
    };

    walk(pageEl);

    /* paint shapes and images first, in DOM order, then text */
    for (const o of ops) {
      if (o.t === 'fill') page.pushOperators(L.pushGraphicsState(), L.setFillingRgbColor(o.c[0], o.c[1], o.c[2]), ...o.path, L.fill(), L.popGraphicsState());
      else if (o.t === 'stroke') page.pushOperators(L.pushGraphicsState(), L.setStrokingRgbColor(o.c[0], o.c[1], o.c[2]), L.setLineWidth(o.w), ...o.path, L.stroke(), L.popGraphicsState());
      else if (o.t === 'img') {
        let im = images.get(o.el.src);
        if (!im) {
          const cv = document.createElement('canvas'), n = Math.min(o.el.naturalWidth || 480, 720), hn = Math.round(n * (o.h / o.w));
          cv.width = n; cv.height = hn;
          const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, n, hn);
          const iw = o.el.naturalWidth || n, ih = o.el.naturalHeight || hn, sc = Math.max(n / iw, hn / ih), dw = iw * sc, dh = ih * sc;
          c.drawImage(o.el, (n - dw) / 2, (hn - dh) / 2, dw, dh);
          const b = await (await fetch(cv.toDataURL('image/jpeg', .9))).arrayBuffer();
          im = await pdf.embedJpg(b); images.set(o.el.src, im);
        }
        page.pushOperators(L.pushGraphicsState(), ...roundPath(o.x, o.y, o.w, o.h, o.r), L.clip(), L.endPath());
        page.drawImage(im, {x:o.x, y:o.y - o.h, width:o.w, height:o.h});
        page.pushOperators(L.popGraphicsState());
      }
    }

    /* a real space between neighbouring runs on one baseline keeps words apart for text extraction */
    for (let i = 0; i < runs.length - 1; i++) {
      const a = runs[i], b = runs[i + 1];
      if (Math.abs(a.baseY - b.baseY) >= 1.5) continue;
      const gap = b.x - (a.x + a.width);
      if (gap > 0 && gap < a.size * .5 && a.fam === b.fam && a.st === b.st && a.size === b.size && a.ls === b.ls && String(a.color) === String(b.color)) {
        a.text += ' ' + b.text; a.width = b.x + b.width - a.x; runs.splice(i + 1, 1); i--;   /* same style: one text run */
      } else if (gap > a.size * .08) a.tail = ' ';
    }
    for (const r of runs) {
      const font = await getFont(r.fam, r.st);
      const cp = font.getCharacterSet();
      let text = '';
      for (const ch of r.text) { if (cp.includes(ch.codePointAt(0))) text += ch; else { unknown.add(ch); text += ' '; } }
      if (!text.trim()) continue;
      const natural = font.widthOfTextAtSize(text, r.size) + r.ls * [...text].length;
      const th = natural > 0 ? Math.min(1.08, Math.max(.92, r.width / natural)) : 1;
      page.pushOperators(L.setCharacterSpacing(r.ls), L.setCharacterSqueeze(th * 100));
      page.drawText(text + (r.tail || ''), {x:r.x, y:r.baseY, size:r.size, font, color:L.rgb(r.color[0], r.color[1], r.color[2])});
      page.pushOperators(L.setCharacterSpacing(0), L.setCharacterSqueeze(100));
    }
    if (links.length) {
      const annots = pdf.context.obj([]);
      for (const k of links) {
        const a = pdf.context.obj({Type:'Annot', Subtype:'Link', Rect:[k.x, k.y, k.x + k.w, k.y + k.h], Border:[0, 0, 0], A:{Type:'Action', S:'URI', URI:L.PDFString.of(k.href)}});
        annots.push(pdf.context.register(a));
      }
      page.node.set(L.PDFName.of('Annots'), annots);
    }
  }
  stage.innerHTML = '';

  const p = d.p, name = CV.fullName(p) || 'CV';
  pdf.setTitle('CV ' + name + (p.jabatan ? ' - ' + p.jabatan : ''));
  pdf.setAuthor(name);
  if (p.jabatan) pdf.setSubject(p.jabatan);
  const kw = d.skill.flatMap(s => (s.items || '').split(',').map(x => x.trim())).filter(Boolean);
  if (kw.length) pdf.setKeywords(kw);
  pdf.setCreator('Amatu CV'); pdf.setProducer('Amatu CV');
  pdf.setLanguage(d.lang === 'en' ? 'en-US' : 'id-ID');
  const bytes = await pdf.save({useObjectStreams:true});
  return {bytes, unknown:[...unknown]};
}
CV.buildPdf = build;
})();
