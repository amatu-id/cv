/* Reads an existing CV (PDF or DOCX) into the form. Rule-based: headings, dates and contact patterns.
   The result is always a draft for the person to review. */
'use strict';
(function () {
async function pdfLines(buf) {
  const lib = await import(new URL('vendor/pdf.min.mjs', location.href).href);
  lib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.mjs', location.href).href;
  const doc = await lib.getDocument({data:buf}).promise, out = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await doc.getPage(n), c = await pg.getTextContent();
    /* keep the file's own reading order: sorting by height would mix side columns into one line */
    let line = null;
    const push = () => { if (line && line.s.trim()) out.push(line.s.trim()); };
    for (const it of c.items) {
      if (!it.str || !it.str.trim()) continue;
      const x = it.transform[4], y = it.transform[5];
      if (line && Math.abs(line.y - y) < 2.5 && x >= line.end - 2) {
        const gap = x - line.end;
        if (gap > 18) line.s += '   '; else if (gap > 1.2 && !/\s$/.test(line.s)) line.s += ' ';
        line.s += it.str; line.end = x + (it.width || 0);
      } else { push(); line = {y, s:it.str, end:x + (it.width || 0)}; }
    }
    push();
  }
  if (!out.join('').trim()) throw new Error('PDF ini berupa gambar, tidak ada teks yang bisa dibaca.');
  return out;
}
async function inflate(u8) {
  const ds = new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
  return new Uint8Array(await ds.arrayBuffer());
}
async function docxLines(buf) {
  const u = new Uint8Array(buf), v = new DataView(buf);
  let e = u.length - 22; while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Berkas DOCX tidak valid.');
  let p = v.getUint32(e + 16, true); const n = v.getUint16(e + 10, true);
  let xml = null;
  for (let i = 0; i < n; i++) {
    const m = v.getUint16(p + 10, true), cs = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl));
    if (name === 'word/document.xml') {
      const nl2 = v.getUint16(off + 26, true), xl2 = v.getUint16(off + 28, true), st = off + 30 + nl2 + xl2, raw = u.subarray(st, st + cs);
      xml = new TextDecoder().decode(m === 0 ? raw : await inflate(raw));
      break;
    }
    p += 46 + nl + xl + cl;
  }
  if (!xml) throw new Error('Isi dokumen Word tidak ditemukan.');
  const dom = new DOMParser().parseFromString(xml, 'application/xml'), NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', out = [];
  for (const para of dom.getElementsByTagNameNS(NS, 'p')) {
    let s = ''; const bullet = para.getElementsByTagNameNS(NS, 'numPr').length > 0 || /ListBullet|ListParagraph/.test(para.getElementsByTagNameNS(NS, 'pStyle')[0]?.getAttributeNS(NS, 'val') || '');
    for (const t of para.getElementsByTagNameNS(NS, '*')) { if (t.localName === 't') s += t.textContent; else if (t.localName === 'tab') s += '   '; else if (t.localName === 'br') s += '\n'; }
    s.split('\n').forEach(x => { if (x.trim()) out.push((bullet ? '• ' : '') + x.trim()); });
  }
  return out;
}

const HEAD = {
  profil:/^(ringkasan( profesional)?|profil( singkat| profesional)?|tentang saya|summary|professional summary|profile|about me|objective|tujuan karir)$/,
  kerja:/^(pengalaman( kerja| profesional)?|riwayat (kerja|pekerjaan)|work experience|professional experience|employment( history)?|experience)$/,
  didik:/^(pendidikan( formal)?|riwayat pendidikan|education|academic background)$/,
  skill:/^(keahlian|keterampilan|kemampuan|kompetensi|skills?|technical skills|core competencies|keunggulan utama)$/,
  bahasa:/^(bahasa|kemampuan bahasa|languages?)$/,
  sertifikat:/^(sertifikasi|sertifikat|lisensi|certifications?|licenses?)$/,
  latih:/^(pelatihan|kursus|seminar|pendidikan non ?-?formal|training|courses)$/,
  proyek:/^(proyek|project|projects|portofolio|portfolio)$/,
  org:/^(organisasi|pengalaman organisasi|kegiatan organisasi|organizational experience|organisations?|volunteer(ing)?)$/,
  award:/^(penghargaan|prestasi|awards?|honors?|achievements?)$/,
  publik:/^(publikasi|publications?|penelitian|research)$/,
  rujuk:/^(referensi|references?)$/,
  pribadi:/^(data (pribadi|diri)|biodata|identitas( diri)?|informasi pribadi|personal (information|details))$/,
  lain:/^(informasi tambahan|additional information|lainnya)$/,
  kontak:/^(kontak|contact)$/
};
const MON = {jan:1,feb:2,mar:3,apr:4,mei:5,may:5,jun:6,jul:7,agu:8,ags:8,agt:8,aug:8,sep:9,okt:10,oct:10,nov:11,des:12,dec:12};
const MON_RE = '(?:jan|feb|mar|apr|mei|may|jun|jul|agu|ags|agt|aug|sep|okt|oct|nov|des|dec)[a-z]*\\.?';
const DPOINT = `(?:${MON_RE}\\s+)?(?:19|20)\\d\\d|(?:0?[1-9]|1[0-2])/(?:19|20)\\d\\d`;
const RANGE = new RegExp(`(${DPOINT})\\s*(?:[-–—~]|to|s\\.?d\\.?|sampai)\\s*(${DPOINT}|sekarang|saat ini|kini|present|current|now)`, 'i');
const SINGLE = new RegExp(`(${MON_RE}\\s+)?((?:19|20)\\d\\d)`, 'i');

function ym(s) {
  if (!s) return '';
  const a = /(?:0?([1-9]|1[0-2]))\/((?:19|20)\d\d)/.exec(s);
  if (a) return a[2] + '-' + a[1].padStart(2, '0');
  const y = /(19|20)\d\d/.exec(s); if (!y) return '';
  const m = /^[a-z]+/i.exec(s.trim()); const mo = m && MON[m[0].slice(0, 3).toLowerCase()];
  return y[0] + (mo ? '-' + String(mo).padStart(2, '0') : '');
}
const isBullet = l => /^[•·▪●◦*–—-]\s+/.test(l);
const unbullet = l => l.replace(/^[•·▪●◦*–—-]\s+/, '');
const looksOrg = s => /\b(pt|cv|tbk|ud|persero|yayasan|koperasi|universitas|institut|politeknik|sekolah|sma|smk|inc|ltd|llc|corp|company|group|bank|dinas|kementerian)\b/i.test(s);
const parts = s => s.split(/\s{3,}|\s\|\s|\t/).map(x => x.trim()).filter(Boolean);

function entries(lines, opt = {}) {
  /* An entry starts at a line with a date range; lines before the first bullet belong to its header. */
  const out = []; let cur = null, pending = [];
  const flush = () => { if (cur) out.push(cur); cur = null; };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (isBullet(l)) {
      if (cur) cur.bullets.push(unbullet(l)); else pending.push(unbullet(l));
      continue;
    }
    let r = RANGE.exec(l);
    if (!r && opt.single && (!cur || cur.bullets.length || cur.head.length >= 2)) { const q = new RegExp(`(?:^|\\s)(${DPOINT})\\s*$|^(${DPOINT})\\b`, 'i').exec(l); if (q) r = [q[0], q[1] || q[2], q[1] || q[2]]; }
    if (r) {
      const rest = parts(l.replace(r[0], ' ').replace(/[\s,|·–—:-]+$/, '').replace(/^[\s,|·–—:-]+/, '')).flatMap(x => { const q = /^(.+?)\s+(?:sebagai|as)\s+(.+)$/i.exec(x); return q ? [q[2], q[1]] : [x]; });
      /* a header line right before the date line belongs to this entry, not to the previous one's text */
      const hdr = [];
      if (cur && !cur.bullets.length && cur.head.length > 0 && !rest.length) { /* previous entry had no bullets */ }
      if (!rest.length && pending.length) hdr.push(...pending.splice(0));
      else if (!rest.length && cur && cur.loose.length) hdr.push(cur.loose.pop());
      flush();
      cur = {head:[...hdr, ...rest], mulai:ym(r[1]), selesai:/sekarang|saat ini|kini|present|current|now/i.test(r[2]) ? '' : ym(r[2]), kini:/sekarang|saat ini|kini|present|current|now/i.test(r[2]), bullets:[], loose:[]};
      continue;
    }
    if (cur) {
      if (!cur.bullets.length && cur.head.length < 3 && l.length < 90) cur.head.push(...parts(l));
      else if (cur.bullets.length && l.length < 70 && !/[.;]$/.test(l) && (lines[i + 1] && RANGE.test(lines[i + 1]))) cur.loose.push(l);
      else if (cur.bullets.length && /^[a-z]/.test(l)) cur.bullets[cur.bullets.length - 1] += ' ' + l;
      else cur.bullets.push(l);
    } else pending.push(l);
  }
  flush();
  return out;
}

function parse(lines) {
  const d = CV.blank(), secs = {head:[]}; let key = 'head';
  for (const raw of lines) {
    const l = raw.trim(); if (!l) continue;
    const test = l.replace(/[:：]\s*$/, '').replace(/^\s*(?:\d{1,2}|[a-h]|[ivx]{1,4})[.)]\s+/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
    let hit = null;
    if (test.length < 40) for (const k in HEAD) if (HEAD[k].test(test)) { hit = k; break; }
    if (hit) { key = hit; secs[key] = secs[key] || []; continue; }
    (secs[key] = secs[key] || []).push(l);
  }
  const p = d.p, all = [...secs.head, ...(secs.kontak || []), ...(secs.pribadi || [])], text = all.join(' | ');
  const em = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(text); if (em) p.email = em[0];
  const li = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|,]+/i.exec(text); if (li) p.linkedin = CV.shortUrl(li[0]);
  const gh = /(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s|,]+/i.exec(text); if (gh) p.github = CV.shortUrl(gh[0]);
  const ph = /(?:\+?62|0)[\s\-.]?8\d{1,2}[\s\-.]?\d{3,4}[\s\-.]?\d{3,5}/.exec(text); if (ph) p.telp = CV.normPhone(ph[0]);
  const web = /(?:https?:\/\/)?(?:www\.)?(?!linkedin|github)[a-z0-9-]+\.(?:com|id|co\.id|net|org|io|dev|me)(?:\/[^\s|,]*)?/i.exec(text.replace(em ? em[0] : '', '')); if (web) p.web = CV.shortUrl(web[0]);
  const free = secs.head.filter(l => !/@|\d{5,}|linkedin|github|https?:|\+62/i.test(l) && !/^(curriculum vitae|daftar riwayat hidup|riwayat hidup|resume|cv)$/i.test(l.trim()) && !/^[^:]{2,30}\s*:\s*\S/.test(l));
  if (free[0]) {
    const m = /^([^,]+)(?:,\s*(.+))?$/.exec(free[0]);
    p.nama = /^[A-Z\s.'-]+$/.test(m[1]) ? m[1].toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()) : m[1];
    if (m[2]) p.gBelakang = m[2];
  }
  if (free[1] && free[1].split(/\s+/).length <= 8 && !/,\s*[A-Z]/.test(free[1])) p.jabatan = free[1];
  const seg = all.flatMap(l => l.split(/\s\|\s|\s·\s|\s{3,}/)).map(x => x.trim()).filter(x => x !== free[0] && x !== free[1]);
  const loc = seg.find(x => /^[A-Z][\p{L} .]+,\s*[A-Z][\p{L} .]+$/u.test(x));
  if (loc) { const [a, b] = loc.split(/,\s*/); p.kota = a; p.provinsi = b; }

  if (secs.profil) d.ringkasan = secs.profil.map(unbullet).join(' ');

  d.kerja = entries(secs.kerja || []).map(e => {
    let [a = '', b = '', c = ''] = e.head;
    if (looksOrg(a) && !looksOrg(b)) [a, b] = [b, a];
    let lokasi = c;
    const cm = /^(.*),\s*([A-Z][\p{L} ]+)$/u.exec(b); if (!lokasi && cm && looksOrg(cm[1])) { b = cm[1]; lokasi = cm[2]; }
    return {id:CV.uid(),posisi:a,perusahaan:b,lokasi,tipe:'',bidang:'',mulai:e.mulai,selesai:e.selesai,kini:e.kini,uraian:e.bullets.join('\n')};
  });
  d.didik = entries(secs.didik || [], {single:true}).map(e => {
    const joined = e.head.join(' '), uni = e.head.find(x => /universitas|institut|politeknik|sekolah|sma|smk|akademi|university|institute|college/i.test(x)) || e.head[1] || '';
    const oth = e.head.find(x => x !== uni) || '';
    const j = /\b(S1|S-1|S2|S-2|S3|S-3|D3|D-3|D4|D-4|SMA|SMK|sarjana|magister|doktor|diploma|bachelor|master|doctor)\b/i.exec(oth);
    const jm = j ? ({'s-1':'S1',sarjana:'S1',bachelor:'S1','s-2':'S2',magister:'S2',master:'S2','s-3':'S3',doktor:'S3',doctor:'S3','d-3':'D3',diploma:'D3','d-4':'D4'}[j[1].toLowerCase()] || j[1].toUpperCase()) : '';
    const ipk = /(?:ipk|gpa)\s*:?\s*([\d.,]+)(?:\s*(?:\/|dari|of)\s*([\d.,]+))?/i.exec(joined + ' ' + e.bullets.join(' '));
    return {id:CV.uid(),jenjang:jm,jurusan:oth.replace(j ? j[0] : '', '').replace(/^\s*(of|in|,|-|–)\s*/i, '').trim(),institusi:uni,lokasi:'',mulai:e.mulai,selesai:e.selesai,kini:e.kini,ipk:ipk ? ipk[1] : '',skala:ipk && ipk[2] ? ipk[2] : '',uraian:e.bullets.filter(b => !/ipk|gpa/i.test(b)).join('\n')};
  });
  d.skill = (secs.skill || []).map(unbullet).map(l => {
    const m = /^([^:]{2,30}):\s*(.+)$/.exec(l);
    return {id:CV.uid(),kelompok:m ? m[1] : '',items:(m ? m[2] : l)};
  });
  /* bare one-per-line skills collapse into one list */
  if (d.skill.length > 3 && d.skill.every(s => !s.kelompok && !s.items.includes(','))) d.skill = [{id:CV.uid(),kelompok:'',items:d.skill.map(s => s.items).join(', ')}];
  const yearTail = l => { const m = SINGLE.exec(l); return m ? {tahun:m[2], rest:l.replace(m[0], ' ').replace(/[\s,|·–—()-]+$/, '').trim()} : {tahun:'', rest:l}; };
  const split2 = s => { const q = parts(s); if (q.length > 1) return q; const m = /^(.+?)\s[–—-]\s(.+)$/.exec(s) || /^(.+?),\s(.+)$/.exec(s); return m ? [m[1], m[2]] : [s]; };
  d.bahasa = (secs.bahasa || []).flatMap(l => unbullet(l).split(/,|\s\|\s/)).map(x => x.trim()).filter(Boolean).map(x => { const m = /^([^:(–—-]+)[:(–—-]\s*([^)]*)\)?$/.exec(x); return {id:CV.uid(),nama:(m ? m[1] : x).trim(),level:'',skor:m ? m[2].trim() : ''}; });
  d.sertifikat = (secs.sertifikat || []).map(unbullet).map(l => { const y = yearTail(l), [a, b = ''] = split2(y.rest); return {id:CV.uid(),nama:a,penerbit:b,tahun:y.tahun,berlaku:'',nomor:''}; });
  d.latih = (secs.latih || []).map(unbullet).map(l => { const y = yearTail(l), [a, b = ''] = split2(y.rest); return {id:CV.uid(),nama:a,penyelenggara:b,tahun:y.tahun,durasi:''}; });
  d.award = (secs.award || []).map(unbullet).map(l => { const y = yearTail(l), [a, b = ''] = split2(y.rest); return {id:CV.uid(),nama:a,pemberi:b,tahun:y.tahun,uraian:''}; });
  d.publik = (secs.publik || []).map(unbullet).map(l => { const y = yearTail(l), [a, b = ''] = split2(y.rest); return {id:CV.uid(),judul:a,penerbit:b,tahun:y.tahun,tautan:''}; });
  d.proyek = entries(secs.proyek || []).map(e => ({id:CV.uid(),nama:e.head[0] || '',peran:e.head[1] || '',klien:'',mulai:e.mulai,selesai:e.selesai,kini:e.kini,nilai:'',tautan:'',uraian:e.bullets.join('\n')}));
  d.org = entries(secs.org || []).map(e => { let [a = '', b = ''] = e.head; if (looksOrg(a) && !looksOrg(b)) [a, b] = [b, a]; return {id:CV.uid(),peran:a,nama:b,mulai:e.mulai,selesai:e.selesai,kini:e.kini,uraian:e.bullets.join('\n')}; });
  if (secs.rujuk && secs.rujuk.join(' ').match(/permintaan|request/i)) d.rujukMinta = true;
  const BLN = {januari:1,februari:2,maret:3,april:4,mei:5,juni:6,juli:7,agustus:8,september:9,oktober:10,november:11,desember:12,january:1,february:2,march:3,may:5,june:6,july:7,august:8,october:10,december:12};
  const isoDate = v => { const m = /(\d{1,2})[\s/-]+([\p{L}]+|\d{1,2})[\s/-]+((?:19|20)\d\d)/u.exec(v); if (!m) return ''; const mo = /\d/.test(m[2]) ? +m[2] : BLN[m[2].toLowerCase()] || MON[m[2].slice(0, 3).toLowerCase()]; return mo ? m[3] + '-' + String(mo).padStart(2, '0') + '-' + m[1].padStart(2, '0') : ''; };
  const pick = (v, list) => list.find(o => o.toLowerCase() === v.trim().toLowerCase()) || v.trim();
  for (const l of [...(secs.pribadi || []), ...secs.head]) {
    const m = /^([^:]{2,34}?)\s*:\s*(.+)$/.exec(unbullet(l)); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (/^nama/.test(k) && !p.nama) p.nama = v;
    else if (/lahir|birth/.test(k)) { const q = /^([^,]+),\s*(.+)$/.exec(v); p.lahirTempat = q ? q[1] : p.lahirTempat; p.lahirTgl = isoDate(v); p.tampil.lahir = true; }
    else if (/warga|national/.test(k)) { p.warga = v; p.tampil.warga = true; }
    else if (/\bsim\b|driving/.test(k)) { p.sim = v; p.tampil.sim = true; }
    else if (/kelamin|gender/.test(k)) p.jk = /^(l|laki|pria|male)/i.test(v) ? 'Laki-laki' : /^(p|wanita|perempuan|female)/i.test(v) ? 'Perempuan' : v;
    else if (/status|marital/.test(k)) p.status = /belum|single/i.test(v) ? 'Belum menikah' : /kawin|nikah|married/i.test(v) ? 'Menikah' : v;
    else if (/agama|religion/.test(k)) p.agama = pick(v, ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu']);
    else if (/alamat|address|domisili/.test(k)) { p.alamat = v; const q = /,\s*([A-Z][\p{L} .]+?)\s*(\d{5})?\s*$/u.exec(v); if (q && !p.kota) p.kota = q[1]; if (q && q[2]) p.kodepos = q[2]; }
    else if (/tujuan|posisi|jabatan|position/.test(k) && !p.jabatan) p.jabatan = v;
  }
  if (!p.kota) {
    /* a location label followed by its value, otherwise a short place-like segment of the contact line */
    const li = seg.findIndex(x => /^(lokasi|location|domisili|kota|city)$/i.test(x));
    const LABEL = /^(lokasi|location|telepon|phone|email|linkedin|situs|website|github|alamat|address|kontak|contact|curriculum vitae|resume)$/i;
    const one = li >= 0 && seg[li + 1] ? seg[li + 1] : seg.find(x => /^[A-Z][\p{L}.]+(?: [A-Z][\p{L}.]+){0,2}$/u.test(x) && x !== x.toUpperCase() && !LABEL.test(x));
    if (one && !/@|\d/.test(one) && !LABEL.test(one)) p.kota = one;
  }
  return d;
}
CV.importFile = async function (file) {
  const buf = await file.arrayBuffer(), name = file.name.toLowerCase();
  let lines;
  if (name.endsWith('.pdf')) lines = await pdfLines(buf);
  else if (name.endsWith('.docx')) lines = await docxLines(buf);
  else throw new Error('Gunakan berkas PDF atau DOCX.');
  return parse(lines);
};
CV.parseLines = parse;
})();
