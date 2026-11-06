/* Application shell: storage, form panels, template gallery, settings, preview, downloads. */
'use strict';
(function () {
const $ = id => document.getElementById(id);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k in e && k !== 'list' && k !== 'form') e[k] = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
}

/* ---------- storage ---------- */
const IDX = 'cv.index', DOC = id => 'cv.doc.' + id;
let index = {cur:null, list:[]}, doc = null, panel = 'pribadi', galTab = 'ats', sampleDoc = null;
const jget = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (_) { return f; } };

/* Older or partial records (import, restore) always gain any missing field. */
function hydrate(d) {
  const b = CV.blank(), out = Object.assign(b, d);
  out.p = Object.assign(CV.blank().p, d.p || {});
  out.p.tampil = Object.assign(CV.blank().p.tampil, (d.p && d.p.tampil) || {});
  out.lain = Object.assign(CV.blank().lain, d.lain || {});
  out.hide = d.hide || {}; out.titles = d.titles || {};
  return out;
}
function load() {
  index = jget(IDX, {cur:null, list:[]});
  index.list = (index.list || []).filter(x => localStorage.getItem(DOC(x.id)));
  if (!index.list.length) { const d = CV.blank(); index = {cur:d.id, list:[]}; persist(d); doc = d; return; }
  if (!index.list.some(x => x.id === index.cur)) index.cur = index.list[0].id;
  doc = hydrate(jget(DOC(index.cur), CV.blank()));
}
function persist(d) {
  const row = index.list.find(x => x.id === d.id);
  const name = d.name, upd = Date.now();
  if (row) { row.name = name; row.upd = upd; } else index.list.unshift({id:d.id, name, upd});
  try {
    localStorage.setItem(DOC(d.id), JSON.stringify(d));
    localStorage.setItem(IDX, JSON.stringify(index));
    return true;
  } catch (e) { toast('Penyimpanan peramban penuh. Hapus CV yang tidak terpakai atau ganti foto.'); return false; }
}
let saveT = 0, dirty = false;
function saveNow() { if (!dirty) return; dirty = false; clearTimeout(saveT); if (persist(doc)) showSaved(); }
function showSaved() {
  const t = new Date(), a = window.AMATU && AMATU.pending && AMATU.pending();
  $('saved').textContent = (a ? 'Menyinkronkan' : 'Tersimpan') + ' ' + String(t.getHours()).padStart(2, '0') + '.' + String(t.getMinutes()).padStart(2, '0');
}
function touch() { dirty = true; clearTimeout(saveT); saveT = setTimeout(saveNow, 800); schedule(); navCounts(); }
addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

/* ---------- toast + menu ---------- */
let toastT = 0;
function toast(msg, act, fn) {
  const t = $('toast'); t.innerHTML = ''; t.append(h('span', null, msg));
  if (act) t.append(h('button', {onclick() { t.hidden = true; fn(); }}, act));
  t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, act ? 7000 : 4000);
}
function closeMenu() { $('menu').hidden = true; }
function openMenu(anchor, items, alignRight) {
  const m = $('menu'); m.innerHTML = '';
  items.forEach(it => {
    if (it === '-') return m.append(h('hr'));
    if (it.head) return m.append(h('h5', null, it.head));
    const b = h('button', {class:(it.cur ? 'cur ' : '') + (it.del ? 'del' : ''), onclick() { closeMenu(); it.fn(); }}, it.label);
    if (it.sub) b.append(h('small', null, it.sub));
    m.append(b);
  });
  m.hidden = false;
  const r = anchor.getBoundingClientRect(), w = m.offsetWidth;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, alignRight ? r.right - w : r.left)) + 'px';
  m.style.top = Math.min(r.bottom + 5, innerHeight - m.offsetHeight - 8) + 'px';
}
document.addEventListener('pointerdown', e => { if (!$('menu').hidden && !$('menu').contains(e.target) && !e.target.closest('#docBtn,#dlMore')) closeMenu(); });

/* ---------- field builders ---------- */
function text(obj, key, label, o = {}) {
  const input = h('input', {type:o.type || 'text', value:obj[key] || '', placeholder:o.ph || '', autocomplete:o.ac || 'off', inputMode:o.mode, list:o.list});
  const err = o.check ? h('div', {class:'err', hidden:true}) : null;
  const wrap = h('div', {class:'f' + (o.w ? ' w' + o.w : '')}, h('label', null, label, o.req ? h('span', {class:'req'}, ' *') : null), input, err, o.hint ? h('p', {class:'hint'}, o.hint) : null);
  const validate = () => { if (!o.check) return; const m = input.value && o.check(input.value); err.hidden = !m; err.textContent = m || ''; wrap.classList.toggle('bad', !!m); };
  input.addEventListener('input', () => { obj[key] = input.value; validate(); touch(); o.on && o.on(); });
  input.addEventListener('blur', () => { if (o.blur) { const v = o.blur(input.value); if (v !== input.value) { input.value = v; obj[key] = v; touch(); } } validate(); });
  validate();
  return wrap;
}
function area(obj, key, label, o = {}) {
  const ta = h('textarea', {rows:o.rows || 5, placeholder:o.ph || ''}, obj[key] || '');
  ta.value = obj[key] || '';
  ta.addEventListener('input', () => { obj[key] = ta.value; touch(); o.on && o.on(); });
  return h('div', {class:'f' + (o.w ? ' w' + o.w : '')}, h('label', null, label), ta, o.hint ? h('p', {class:'hint'}, o.hint) : null);
}
function select(obj, key, label, opts, o = {}) {
  const s = h('select', null, opts.map(x => { const [v, t] = Array.isArray(x) ? x : [x, x || '—']; return h('option', {value:v}, t); }));
  s.value = obj[key] == null ? '' : String(obj[key]);
  s.addEventListener('change', () => { obj[key] = o.num ? +s.value : s.value; touch(); o.on && o.on(); });
  return h('div', {class:'f' + (o.w ? ' w' + o.w : '')}, h('label', null, label), s, o.hint ? h('p', {class:'hint'}, o.hint) : null);
}
function check(obj, key, label, o = {}) {
  const c = h('input', {type:'checkbox', checked:!!obj[key]});
  c.addEventListener('change', () => { obj[key] = c.checked; touch(); o.on && o.on(); });
  return h('label', {class:'chk'}, c, label);
}
const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
function monthYear(obj, key, label, o = {}) {
  const now = new Date().getFullYear(), m0 = /^(\d{4})(?:-(\d{1,2}))?$/.exec(obj[key] || '');
  const mo = h('select', {'aria-label':label + ' bulan'}, h('option', {value:''}, 'Bulan'), BULAN.map((b, i) => h('option', {value:String(i + 1).padStart(2, '0')}, b)));
  const yr = h('select', {'aria-label':label + ' tahun'}, h('option', {value:''}, 'Tahun'));
  for (let y = now + 6; y >= 1960; y--) yr.append(h('option', {value:String(y)}, y));
  if (m0) { yr.value = m0[1]; mo.value = m0[2] ? m0[2].padStart(2, '0') : ''; }
  const up = () => { obj[key] = yr.value ? yr.value + (mo.value ? '-' + mo.value : '') : ''; touch(); o.on && o.on(); };
  mo.addEventListener('change', up); yr.addEventListener('change', up);
  return h('div', {class:'f' + (o.w ? ' w' + o.w : ''), hidden:o.hidden}, h('label', null, label), h('div', {class:'my'}, mo, yr));
}
function grid(...kids) { return h('div', {class:'grid'}, kids); }
function yearText(obj, key, label, w) { return text(obj, key, label, {w, mode:'numeric', ph:'2024'}); }

/* ---------- repeating lists ---------- */
const JENJANG = ['','SMA','SMK','MA','D1','D2','D3','D4','S1','S2','S3','Profesi','Lainnya'];
const LISTS = {
  kerja:{title:'Pengalaman Kerja',lead:'Mulai dari yang terbaru. Tulis satu pencapaian per baris, awali dengan kata kerja, dan sertakan angka bila ada.',add:'Tambah pekerjaan',sort:true,
    head:e => [e.posisi || 'Pekerjaan baru', [e.perusahaan, dateTxt(e)].filter(Boolean).join(' · ')],
    make:() => ({id:CV.uid(),posisi:'',perusahaan:'',lokasi:'',tipe:'Purnawaktu',bidang:'',mulai:'',selesai:'',kini:false,uraian:''}),
    form:(e, card) => [grid(text(e,'posisi','Jabatan',{req:1,w:3,on:card.refresh,ph:'Project Engineer'}),text(e,'perusahaan','Perusahaan',{req:1,w:3,on:card.refresh,ph:'PT Karya Sejahtera'}),text(e,'lokasi','Kota',{w:2,ph:'Jakarta'}),select(e,'tipe','Jenis',['Purnawaktu','Paruh waktu','Kontrak','Magang','Lepas'],{w:2}),text(e,'bidang','Bidang usaha',{w:2,ph:'Konstruksi'}),...dates(e,card)),area(e,'uraian','Uraian dan pencapaian',{rows:6,ph:'Mengendalikan biaya proyek senilai Rp120 miliar; selesai sesuai anggaran.\nMenurunkan pekerjaan ulang dari 4% menjadi 2%.',hint:'Setiap baris menjadi satu poin.'})]},
  didik:{title:'Pendidikan',lead:'Dari jenjang tertinggi. IPK boleh dikosongkan.',add:'Tambah pendidikan',sort:true,
    head:e => [[e.jenjang, e.jurusan].filter(Boolean).join(' ') || e.institusi || 'Pendidikan baru', [e.institusi, dateTxt(e)].filter(Boolean).join(' · ')],
    make:() => ({id:CV.uid(),jenjang:'S1',jurusan:'',institusi:'',lokasi:'',mulai:'',selesai:'',kini:false,ipk:'',skala:'4,00',uraian:''}),
    form:(e, card) => [grid(select(e,'jenjang','Jenjang',JENJANG,{w:2,on:card.refresh}),text(e,'jurusan','Jurusan',{w:4,on:card.refresh,ph:'Teknik Sipil'}),text(e,'institusi','Institusi',{req:1,w:4,on:card.refresh,ph:'Universitas Nasional'}),text(e,'lokasi','Kota',{w:2}),...dates(e,card,'Sedang menempuh'),text(e,'ipk','IPK',{w:3,mode:'decimal',ph:'3,50'}),text(e,'skala','Skala',{w:3,mode:'decimal'})),area(e,'uraian','Keterangan',{rows:3,ph:'Skripsi, predikat, atau beasiswa'})]},
  skill:{title:'Keahlian',lead:'Kelompokkan agar mudah dipindai. Pisahkan setiap keahlian dengan koma, dan gunakan istilah yang sama dengan lowongan.',add:'Tambah kelompok',
    head:e => [e.kelompok || 'Keahlian', (e.items || '').slice(0, 60)],
    make:() => ({id:CV.uid(),kelompok:'',items:''}),
    form:(e, card) => [grid(text(e,'kelompok','Nama kelompok',{on:card.refresh,ph:'Perangkat lunak'}),area(e,'items','Daftar keahlian',{rows:3,on:card.refresh,ph:'AutoCAD, Microsoft Excel, Primavera P6'}))]},
  bahasa:{title:'Bahasa',lead:'Sertakan skor resmi bila ada.',add:'Tambah bahasa',
    head:e => [e.nama || 'Bahasa baru', [e.level, e.skor].filter(Boolean).join(' · ')],
    make:() => ({id:CV.uid(),nama:'',level:'Menengah',skor:''}),
    form:(e, card) => [grid(text(e,'nama','Bahasa',{w:2,on:card.refresh,ph:'Inggris'}),select(e,'level','Tingkat',['Dasar','Menengah','Mahir','Profesional','Penutur asli'],{w:2,on:card.refresh}),text(e,'skor','Skor tes',{w:2,on:card.refresh,ph:'TOEFL 550'}))]},
  sertifikat:{title:'Sertifikasi',lead:'Sertifikat profesi dan lisensi yang masih relevan.',add:'Tambah sertifikat',
    head:e => [e.nama || 'Sertifikat baru', [e.penerbit, e.tahun].filter(Boolean).join(' · ')],
    make:() => ({id:CV.uid(),nama:'',penerbit:'',tahun:'',berlaku:'',nomor:''}),
    form:(e, card) => [grid(text(e,'nama','Nama sertifikat',{req:1,on:card.refresh}),text(e,'penerbit','Lembaga penerbit',{on:card.refresh}),yearText(e,'tahun','Tahun terbit',2),yearText(e,'berlaku','Berlaku sampai',2),text(e,'nomor','Nomor',{w:2}))]},
  latih:{title:'Pelatihan',lead:'Kursus dan pelatihan yang mendukung jabatan yang dituju.',add:'Tambah pelatihan',
    head:e => [e.nama || 'Pelatihan baru', [e.penyelenggara, e.tahun].filter(Boolean).join(' · ')],
    make:() => ({id:CV.uid(),nama:'',penyelenggara:'',tahun:'',durasi:''}),
    form:(e, card) => [grid(text(e,'nama','Nama pelatihan',{req:1,on:card.refresh}),text(e,'penyelenggara','Penyelenggara',{on:card.refresh}),yearText(e,'tahun','Tahun',3),text(e,'durasi','Durasi',{w:3,ph:'40 jam'}))]},
  proyek:{title:'Proyek',lead:'Proyek penting, termasuk portofolio pribadi atau tugas akhir.',add:'Tambah proyek',sort:true,
    head:e => [e.nama || 'Proyek baru', [e.peran, dateTxt(e)].filter(Boolean).join(' · ')],
    make:() => ({id:CV.uid(),nama:'',peran:'',klien:'',mulai:'',selesai:'',kini:false,nilai:'',tautan:'',uraian:''}),
    form:(e, card) => [grid(text(e,'nama','Nama proyek',{req:1,on:card.refresh}),text(e,'peran','Peran',{w:3,on:card.refresh}),text(e,'klien','Klien',{w:3}),...dates(e,card,'Masih berjalan'),text(e,'nilai','Nilai proyek',{w:3,ph:'Rp25 miliar'}),text(e,'tautan','Tautan',{w:3,mode:'url'})),area(e,'uraian','Uraian',{rows:4,hint:'Setiap baris menjadi satu poin.'})]},
  org:{title:'Organisasi',lead:'Kepanitiaan, himpunan, asosiasi profesi, atau kegiatan sukarela.',add:'Tambah organisasi',sort:true,
    head:e => [e.peran || e.nama || 'Organisasi baru', [e.nama, dateTxt(e)].filter(Boolean).join(' · ')],
    make:() => ({id:CV.uid(),peran:'',nama:'',mulai:'',selesai:'',kini:false,uraian:''}),
    form:(e, card) => [grid(text(e,'peran','Peran',{w:3,on:card.refresh}),text(e,'nama','Organisasi',{w:3,on:card.refresh}),...dates(e,card,'Masih aktif')),area(e,'uraian','Uraian',{rows:3,hint:'Setiap baris menjadi satu poin.'})]},
  award:{title:'Penghargaan',lead:'Penghargaan, beasiswa, dan prestasi yang bisa diverifikasi.',add:'Tambah penghargaan',
    head:e => [e.nama || 'Penghargaan baru', [e.pemberi, e.tahun].filter(Boolean).join(' · ')],
    make:() => ({id:CV.uid(),nama:'',pemberi:'',tahun:'',uraian:''}),
    form:(e, card) => [grid(text(e,'nama','Nama penghargaan',{req:1,on:card.refresh}),text(e,'pemberi','Pemberi',{w:4,on:card.refresh}),yearText(e,'tahun','Tahun',2))]},
  publik:{title:'Publikasi',lead:'Jurnal, prosiding, buku, atau artikel.',add:'Tambah publikasi',
    head:e => [e.judul || 'Publikasi baru', [e.penerbit, e.tahun].filter(Boolean).join(' · ')],
    make:() => ({id:CV.uid(),judul:'',penerbit:'',tahun:'',tautan:''}),
    form:(e, card) => [grid(text(e,'judul','Judul',{req:1,on:card.refresh}),text(e,'penerbit','Jurnal atau penerbit',{w:4,on:card.refresh}),yearText(e,'tahun','Tahun',2),text(e,'tautan','Tautan atau DOI',{mode:'url'}))]},
  rujuk:{title:'Referensi',lead:'Minta izin orang yang bersangkutan sebelum mencantumkannya.',add:'Tambah referensi',
    head:e => [e.nama || 'Referensi baru', [e.jabatan, e.instansi].filter(Boolean).join(', ')],
    make:() => ({id:CV.uid(),nama:'',jabatan:'',instansi:'',telp:'',email:''}),
    form:(e, card) => [grid(text(e,'nama','Nama',{req:1,on:card.refresh}),text(e,'jabatan','Jabatan',{w:3,on:card.refresh}),text(e,'instansi','Instansi',{w:3,on:card.refresh}),text(e,'telp','Telepon',{w:3,type:'tel',blur:CV.normPhone}),text(e,'email','Email',{w:3,type:'email'}))]},
  ekstra:{title:'Bagian Tambahan',lead:'Bagian dengan judul sendiri, misalnya Kegiatan Sukarela atau Hak Paten.',add:'Tambah bagian',
    head:e => [e.judul || 'Bagian baru', CV.lines(e.isi).length + ' poin'],
    make:() => ({id:CV.uid(),judul:'',isi:''}),
    form:(e, card) => [grid(text(e,'judul','Judul bagian',{on:card.refresh}),area(e,'isi','Isi',{rows:5,on:card.refresh,hint:'Setiap baris menjadi satu poin.'}))]}
};
function dateTxt(e) { const a = CV.fmtYM(e.mulai, 'id', 'short'), b = e.kini ? 'Sekarang' : CV.fmtYM(e.selesai, 'id', 'short'); return a && b ? a + ' – ' + b : a || b; }
function dates(e, card, nowLabel) {
  let endWrap;
  const start = monthYear(e, 'mulai', 'Mulai', {w:3, on:card.refresh});
  endWrap = monthYear(e, 'selesai', 'Selesai', {w:3, hidden:e.kini, on:card.refresh});
  const now = h('div', {class:'f'}, check(e, 'kini', nowLabel || 'Masih bekerja di sini', {on() { endWrap.hidden = e.kini; card.refresh(); }}));
  return [start, endWrap, now];
}
let openCard = null;
function listPanel(key) {
  const L = LISTS[key], box = h('div'), arr = doc[key];
  const rerender = () => { box.innerHTML = ''; arr.forEach((e, i) => box.append(cardFor(e, i))); navCounts(); };
  function cardFor(e, i) {
    const tb = h('b'), ts = h('span');
    const card = {refresh() { const [a, b] = L.head(e); tb.textContent = a; ts.textContent = b || ''; }};
    card.refresh();
    const isOpen = openCard === e.id;
    const body = isOpen ? h('div', {class:'card-b'}, L.form(e, card)) : null;
    const stop = fn => ev => { ev.stopPropagation(); fn(); };
    const head = h('div', {class:'card-h', onclick() { openCard = isOpen ? null : e.id; rerender(); }},
      h('div', {class:'card-t'}, tb, ts),
      h('button', {class:'ib', title:'Naikkan', 'aria-label':'Naikkan', disabled:i === 0, onclick:stop(() => { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); touch(); rerender(); })}, '↑'),
      h('button', {class:'ib', title:'Turunkan', 'aria-label':'Turunkan', disabled:i === arr.length - 1, onclick:stop(() => { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); touch(); rerender(); })}, '↓'),
      h('button', {class:'ib', title:'Salin', 'aria-label':'Salin', onclick:stop(() => { const c = JSON.parse(JSON.stringify(e)); c.id = CV.uid(); arr.splice(i + 1, 0, c); openCard = c.id; touch(); rerender(); })}, '⧉'),
      h('button', {class:'ib', title:'Hapus', 'aria-label':'Hapus', onclick:stop(() => { const removed = arr.splice(i, 1)[0]; touch(); rerender(); toast('Dihapus.', 'Urungkan', () => { arr.splice(i, 0, removed); touch(); rerender(); }); })}, '×'));
    return h('div', {class:'card'}, head, body);
  }
  rerender();
  const add = h('button', {class:'add', onclick() { const e = L.make(); arr.push(e); openCard = e.id; touch(); rerender(); }}, '+ ' + L.add);
  const kids = [h('h2', null, L.title), h('p', {class:'lead'}, L.lead), box, add];
  if (L.sort) kids.push(h('div', {class:'row-end'}, h('span'), h('button', {class:'btn lnk sm', onclick() {
    arr.sort((a, b) => (b.kini ? 1e9 : (CV.ymIdx(b.selesai) ?? CV.ymIdx(b.mulai) ?? 0)) - (a.kini ? 1e9 : (CV.ymIdx(a.selesai) ?? CV.ymIdx(a.mulai) ?? 0)) || (CV.ymIdx(b.mulai) ?? 0) - (CV.ymIdx(a.mulai) ?? 0));
    touch(); rerender();
  }}, 'Urutkan dari yang terbaru')));
  if (key === 'rujuk') kids.push(h('div', {style:'margin-top:12px'}, check(doc, 'rujukMinta', 'Tulis “Tersedia atas permintaan” bila tidak ada nama yang dicantumkan')));
  return kids;
}

/* ---------- personal data ---------- */
function pribadiPanel() {
  const p = doc.p;
  const photoBox = h('div', {class:'ph-b'});
  const paintPhoto = () => { photoBox.style.backgroundImage = p.foto ? `url("${p.foto}")` : ''; delBtn.hidden = !p.foto; upBtn.textContent = p.foto ? 'Ganti foto' : 'Unggah foto'; };
  const upBtn = h('button', {class:'btn sm', onclick() { $('filePhoto').click(); }}, 'Unggah foto');
  const delBtn = h('button', {class:'btn sm', onclick() { p.foto = ''; touch(); paintPhoto(); }}, 'Hapus');
  CV.onPhoto = () => paintPhoto();
  paintPhoto();
  const pd = (label, key, fields, hint) => {
    const c = h('input', {type:'checkbox', checked:!!p.tampil[key]});
    c.addEventListener('change', () => { p.tampil[key] = c.checked; touch(); });
    return h('div', {class:'pd'}, h('div', {class:'grid'}, fields), h('label', {class:'chk'}, c, 'Cantumkan'), hint ? h('p', {class:'hint'}, hint) : null);
  };
  return [
    h('h2', null, 'Data Pribadi'),
    h('p', {class:'lead'}, 'Kolom bertanda * dibutuhkan semua format CV.'),
    h('h3', null, 'Identitas'),
    grid(
      text(p, 'nama', 'Nama lengkap', {req:1, ph:'Sesuai KTP', ac:'name'}),
      text(p, 'gDepan', 'Gelar depan', {w:2, ph:'Dr., Ir.'}),
      text(p, 'gBelakang', 'Gelar belakang', {w:4, ph:'S.T., M.T.'}),
      text(p, 'jabatan', 'Jabatan yang dituju', {req:1, ph:'Project Engineer', hint:'Samakan dengan judul di lowongan.'})
    ),
    h('h3', null, 'Foto'),
    h('div', {class:'photo'}, photoBox, h('div', {class:'col'}, h('div', {class:'row'}, upBtn, delBtn), h('p', {class:'hint'}, 'Latar polos, wajah jelas, pakaian formal. Foto hanya tampil pada template yang menyediakannya.'))),
    h('h3', null, 'Kontak'),
    grid(
      text(p, 'telp', 'Telepon / WhatsApp', {req:1, w:3, type:'tel', ph:'0812 3456 7890', ac:'tel', blur:CV.normPhone}),
      text(p, 'email', 'Email', {req:1, w:3, type:'email', ph:'nama@email.com', ac:'email', check:v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Format email belum benar.'}),
      text(p, 'kota', 'Kota', {req:1, w:2, ph:'Bandung'}),
      text(p, 'provinsi', 'Provinsi', {w:2, ph:'Jawa Barat', list:'provs'}),
      text(p, 'kodepos', 'Kode pos', {w:2, mode:'numeric'}),
      text(p, 'alamat', 'Alamat lengkap', {ph:'Jl. Merdeka No. 10, RT 01/RW 02'}),
      h('div', {class:'f'}, check(p.tampil, 'alamat', 'Cantumkan alamat lengkap, bukan hanya kota dan provinsi'))
    ),
    h('datalist', {id:'provs'}, ['Aceh','Sumatera Utara','Sumatera Barat','Riau','Kepulauan Riau','Jambi','Sumatera Selatan','Kepulauan Bangka Belitung','Bengkulu','Lampung','DKI Jakarta','Banten','Jawa Barat','Jawa Tengah','DI Yogyakarta','Jawa Timur','Bali','Nusa Tenggara Barat','Nusa Tenggara Timur','Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan','Kalimantan Timur','Kalimantan Utara','Sulawesi Utara','Gorontalo','Sulawesi Tengah','Sulawesi Barat','Sulawesi Selatan','Sulawesi Tenggara','Maluku','Maluku Utara','Papua','Papua Barat','Papua Selatan','Papua Tengah','Papua Pegunungan','Papua Barat Daya'].map(x => h('option', {value:x}))),
    h('h3', null, 'Profil daring'),
    grid(
      text(p, 'linkedin', 'LinkedIn', {mode:'url', ph:'linkedin.com/in/nama', blur:CV.shortUrl}),
      text(p, 'web', 'Situs atau portofolio', {w:3, mode:'url', blur:CV.shortUrl}),
      text(p, 'github', 'GitHub', {w:3, mode:'url', blur:CV.shortUrl})
    ),
    h('h3', null, 'Data tambahan'),
    h('p', {class:'hint', style:'margin-bottom:6px'}, 'Hanya data yang dicentang yang dicetak. Sisanya tetap tersimpan untuk formulir lamaran.'),
    pd('lahir', 'lahir', [text(p, 'lahirTempat', 'Tempat lahir', {w:3}), text(p, 'lahirTgl', 'Tanggal lahir', {w:3, type:'date'})]),
    pd('warga', 'warga', [text(p, 'warga', 'Kewarganegaraan', {ph:'Indonesia'})]),
    pd('jk', 'jk', [select(p, 'jk', 'Jenis kelamin', ['', 'Laki-laki', 'Perempuan'])]),
    pd('status', 'status', [select(p, 'status', 'Status pernikahan', ['', 'Belum menikah', 'Menikah', 'Cerai'])]),
    pd('agama', 'agama', [select(p, 'agama', 'Agama', ['', 'Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'])], 'Umumnya tidak perlu, kecuali diminta pemberi kerja.'),
    pd('sim', 'sim', [text(p, 'sim', 'SIM', {ph:'A, C'})]),
    pd('tb', 'tb', [text(p, 'tinggi', 'Tinggi (cm)', {w:3, mode:'numeric'}), text(p, 'berat', 'Berat (kg)', {w:3, mode:'numeric'})]),
    pd('nik', 'nik', [text(p, 'nik', 'NIK', {mode:'numeric'})], 'Rawan disalahgunakan. Cantumkan hanya bila diminta.'),
    pd('npwp', 'npwp', [text(p, 'npwp', 'NPWP', {mode:'numeric'})], 'Cantumkan hanya bila diminta.')
  ];
}

function profilPanel() {
  const count = h('span', {class:'hint'});
  const upd = () => { const n = doc.ringkasan.trim().split(/\s+/).filter(Boolean).length; count.textContent = n + ' kata · disarankan 25–90'; };
  const ar = area(doc, 'ringkasan', 'Ringkasan', {rows:8, on:upd, ph:'Jabatan, lama pengalaman, bidang keahlian, dan satu pencapaian utama. Dua sampai empat kalimat.'});
  upd();
  return [
    h('h2', null, 'Ringkasan Profesional'),
    h('p', {class:'lead'}, 'Bagian pertama yang dibaca perekrut.'),
    ar,
    h('div', {class:'row-end'}, count, h('button', {class:'btn sm', onclick() {
      const s = CV.autoSummary(doc);
      if (!s) return toast('Isi jabatan, pengalaman, atau keahlian lebih dulu.');
      const old = doc.ringkasan; doc.ringkasan = s; ar.querySelector('textarea').value = s; upd(); touch();
      if (old) toast('Ringkasan diganti.', 'Urungkan', () => { doc.ringkasan = old; ar.querySelector('textarea').value = old; upd(); touch(); });
    }}, 'Susun otomatis dari data')),
    h('p', {class:'hint', style:'margin-top:8px'}, 'Disusun hanya dari data yang sudah diisi. Tambahkan satu pencapaian utama agar lebih kuat.')
  ];
}
function lainPanel() {
  const l = doc.lain;
  return [h('h2', null, 'Informasi Tambahan'), h('p', {class:'lead'}, 'Dicetak bila diisi. Gaji sebaiknya hanya dicantumkan bila diminta.'),
    grid(text(l, 'gaji', 'Gaji yang diharapkan', {ph:'Rp12.000.000 per bulan'}),
      select(l, 'siap', 'Ketersediaan mulai kerja', ['', 'Segera', '2 minggu', '1 bulan', '2 bulan', '3 bulan'], {w:3}),
      select(l, 'tempat', 'Penempatan', ['', 'Bersedia di seluruh Indonesia', 'Bersedia di luar negeri', 'Tidak bersedia'], {w:3}),
      text(l, 'minat', 'Minat', {ph:'Fotografi arsitektur, lari jarak jauh'}))];
}

/* ---------- template gallery ---------- */
let thumbJob = 0;
function photoSample() {
  const c = document.createElement('canvas'); c.width = c.height = 240;
  const x = c.getContext('2d'); x.fillStyle = '#c9ced6'; x.fillRect(0, 0, 240, 240);
  x.fillStyle = '#8c95a3'; x.beginPath(); x.arc(120, 96, 46, 0, 7); x.fill(); x.beginPath(); x.ellipse(120, 240, 86, 86, 0, 0, 7); x.fill();
  return c.toDataURL('image/jpeg', .8);
}
function getSample() { if (!sampleDoc) { sampleDoc = CV.sample(); sampleDoc.p.foto = photoSample(); } return sampleDoc; }
function viewDoc() {
  if (!CV.isEmpty(doc)) return doc;
  const s = getSample();
  return Object.assign({}, s, {tpl:doc.tpl, accent:doc.accent, font:doc.font, lang:'id', fs:doc.fs, sp:doc.sp, mg:doc.mg, paper:doc.paper, fit:doc.fit, photo:doc.photo, dateFmt:doc.dateFmt, dur:doc.dur});
}
function templatePanel() {
  const seg = h('div', {class:'seg'},
    h('button', {class:galTab === 'ats' ? 'on' : '', onclick() { galTab = 'ats'; showPanel('template'); }}, 'CV ATS (' + CV.TEMPLATES.filter(t => t.group === 'ats').length + ')'),
    h('button', {class:galTab === 'design' ? 'on' : '', onclick() { galTab = 'design'; showPanel('template'); }}, 'CV Menarik (' + CV.TEMPLATES.filter(t => t.group === 'design').length + ')'));
  const lead = galTab === 'ats' ? 'Satu kolom tanpa grafik, teks terbaca penuh oleh sistem pelacak lamaran. Pakai untuk portal lamaran dan situs karier.' : 'Tata letak visual untuk dikirim langsung ke perekrut, atau dibawa saat wawancara. Data tetap sama saat berganti template.';
  const gal = h('div', {class:'gal'});
  const list = CV.TEMPLATES.filter(t => t.group === galTab), job = ++thumbJob;
  list.forEach(t => {
    const th = h('span', {class:'tc-th'});
    const card = h('button', {class:'tc' + (doc.tpl === t.id ? ' on' : ''), 'data-tpl':t.id, onclick() {
      doc.tpl = t.id; doc.accent = null; doc.font = null; doc.fs = null;
      gal.querySelectorAll('.tc').forEach(x => x.classList.toggle('on', x === card));
      paintTplBtn(); touch(); 
    }}, th, h('span', {class:'tc-m'}, h('b', null, t.name), h('span', null, t.desc)));
    gal.append(card);
  });
  /* thumbnails render one per frame, the person can click before they finish */
  (async () => {
    for (const t of list) {
      if (job !== thumbJob) return;
      const dv = Object.assign({}, getSample(), {tpl:t.id, accent:null, font:null, fs:null, fit:'auto', paper:'a4'});
      await CV.ensureFonts(dv, t);
      if (job !== thumbJob) return;
      const r = CV.layout(dv, $('stage'));
      const th = gal.querySelector(`[data-tpl="${t.id}"] .tc-th`); if (!th) return;
      const w = th.clientWidth || 180, inner = h('div', {html:r.pages[0], style:`transform:scale(${w / CV.PAPER[dv.paper][0]})`});
      th.innerHTML = ''; th.append(inner);
      await new Promise(res => requestAnimationFrame(res));
    }
  })();
  return [h('h2', null, 'Pilih Template'), h('p', {class:'lead'}, lead), seg, gal];
}

/* ---------- settings ---------- */
function aturPanel() {
  const T = CV.tpl(doc.tpl), usesColor = T.color;
  const swatch = h('div', {class:'sw'});
  const paintSw = () => {
    swatch.innerHTML = ''; const cur = doc.accent || T.acc;
    CV.PALETTE.forEach(([c, n]) => swatch.append(h('button', {class:cur === c ? 'on' : '', title:n, 'aria-label':n, style:`background:${c}`, onclick() { doc.accent = c; touch(); paintSw(); }})));
    const inp = h('input', {type:'color', value:cur, title:'Warna lain'}); inp.addEventListener('input', () => { doc.accent = inp.value; touch(); }); swatch.append(inp);
  };
  paintSw();
  const fonts = T.group === 'ats' ? CV.FONTS_ATS : CV.FONTS_DESIGN;
  const fontOpt = [['', 'Bawaan template (' + T.fb + ')'], ...fonts.map(f => [f[0], f[1]])];
  const sizeVal = h('output'), size = h('input', {type:'range', min:8.5, max:12.5, step:.5, value:doc.fs || T.fs});
  const paintSize = () => sizeVal.textContent = size.value + ' pt'; paintSize();
  size.addEventListener('input', () => { doc.fs = +size.value; paintSize(); touch(); });
  return [h('h2', null, 'Pengaturan Tampilan'), h('p', {class:'lead'}, 'Berlaku untuk template ' + T.name + '.'),
    h('h3', null, 'Warna dan huruf'),
    usesColor ? h('div', {class:'f', style:'margin-bottom:10px'}, h('label', null, 'Warna aksen'), swatch) : h('p', {class:'hint', style:'margin-bottom:10px'}, 'Template ATS ini hitam putih. Pilih ATS Aksen Warna bila ingin berwarna.'),
    grid(select(doc, 'font', 'Huruf', fontOpt, {on() { touch(); }}),
      h('div', {class:'f'}, h('label', null, 'Ukuran huruf'), h('div', {class:'rng'}, size, sizeVal))),
    h('h3', null, 'Tata letak'),
    grid(select(doc, 'sp', 'Jarak antarbagian', [['0.8','Rapat'],['1','Normal'],['1.25','Longgar']], {w:3, num:true}),
      select(doc, 'mg', 'Margin', [['0.75','Sempit'],['1','Normal'],['1.2','Lebar']], {w:3, num:true}),
      select(doc, 'paper', 'Ukuran kertas', [['a4','A4'],['letter','Letter']], {w:3}),
      select(doc, 'fit', 'Jumlah halaman', [['auto','Otomatis'],['1','Muat 1 halaman'],['2','Muat 2 halaman'],['free','Tanpa penyesuaian']], {w:3, hint:'Otomatis merapatkan isi bila halaman terakhir hampir kosong.'})),
    h('h3', null, 'Isi'),
    grid(select(doc, 'lang', 'Bahasa judul dan tanggal', [['id','Indonesia'],['en','English']], {w:3, hint:'Isi tulisan tidak diterjemahkan.'}),
      select(doc, 'dateFmt', 'Format tanggal', [['short','Mar 2021'],['long','Maret 2021'],['num','03/2021'],['year','2021']], {w:3}),
      select(doc, 'photo', 'Foto', [['auto','Ikuti template'],['on','Selalu tampilkan'],['off','Sembunyikan']], {w:3}),
      h('div', {class:'f w3', style:'justify-content:flex-end;height:54px'}, check(doc, 'dur', 'Tampilkan lama kerja')))];
}
function susunPanel() {
  const T = CV.tpl(doc.tpl), box = h('div');
  const names = {profil:'Ringkasan',kerja:'Pengalaman Kerja',proyek:'Proyek',didik:'Pendidikan',skill:'Keahlian',sertifikat:'Sertifikasi',latih:'Pelatihan',bahasa:'Bahasa',org:'Organisasi',award:'Penghargaan',publik:'Publikasi',ekstra:'Bagian Tambahan',lain:'Informasi Tambahan',pribadi:'Data Pribadi',rujuk:'Referensi'};
  const order = () => doc.order && doc.order.length ? doc.order : (T.order || CV.SECTIONS).slice();
  const draw = () => {
    box.innerHTML = '';
    const o = order();
    o.forEach((k, i) => {
      const inp = h('input', {type:'text', value:(doc.titles && doc.titles[k]) || CV.title(doc, k), 'aria-label':'Judul ' + names[k]});
      inp.addEventListener('input', () => { doc.titles = doc.titles || {}; doc.titles[k] = inp.value.trim(); if (!doc.titles[k]) delete doc.titles[k]; touch(); });
      const c = h('input', {type:'checkbox', checked:!doc.hide[k], title:'Tampilkan di CV', 'aria-label':'Tampilkan ' + names[k]});
      const row = h('div', {class:'ord' + (doc.hide[k] ? ' off' : '')}, c, inp,
        (T.side || []).includes(k) ? h('span', {class:'hint'}, 'kolom samping') : h('span'),
        h('div', {class:'mv'},
          h('button', {class:'ib', 'aria-label':'Naikkan', disabled:i === 0, onclick() { const n = o.slice(); n.splice(i - 1, 0, n.splice(i, 1)[0]); doc.order = n; touch(); draw(); }}, '↑'),
          h('button', {class:'ib', 'aria-label':'Turunkan', disabled:i === o.length - 1, onclick() { const n = o.slice(); n.splice(i + 1, 0, n.splice(i, 1)[0]); doc.order = n; touch(); draw(); }}, '↓')));
      c.addEventListener('change', () => { if (c.checked) delete doc.hide[k]; else doc.hide[k] = true; row.classList.toggle('off', !c.checked); touch(); });
      box.append(row);
    });
  };
  draw();
  return [h('h2', null, 'Susunan Bagian'), h('p', {class:'lead'}, 'Atur urutan, sembunyikan, atau ganti judul. Bagian kosong tidak dicetak. Judul baku lebih mudah dikenali ATS.'), box,
    h('div', {class:'row-end'}, h('span'), h('button', {class:'btn lnk sm', onclick() { doc.order = null; doc.titles = {}; doc.hide = {}; touch(); draw(); }}, 'Kembalikan susunan template'))];
}

/* ---------- ATS check ---------- */
let adText = '', lastPages = 1;
function cekPanel() {
  const T = CV.tpl(doc.tpl), list = CV.checks(doc, T, lastPages), ok = list.filter(c => c.ok).length;
  const rows = list.slice().sort((a, b) => a.ok - b.ok).map(c => h('div', {class:'ck ' + (c.ok ? 'ok' : 'no')}, h('i', null, c.ok ? '✓' : '!'), h('span', null, c.text),
    c.ok ? h('span') : h('button', {class:'btn lnk sm', onclick() { if (c.level === 'tpl') galTab = 'ats'; showPanel(c.go); }}, c.level === 'tpl' ? 'Lihat CV ATS' : 'Perbaiki')));
  const result = h('div');
  const runMatch = () => {
    result.innerHTML = ''; if (!adText.trim()) return;
    const m = CV.matchKeywords(doc, T, adText), n = m.hit.length + m.miss.length;
    if (!n) return result.append(h('p', {class:'hint'}, 'Belum ditemukan kata kunci. Tempel teks lowongan yang lebih lengkap.'));
    result.append(h('p', {style:'margin:8px 0 2px'}, h('b', null, m.hit.length + ' dari ' + n), ' kata kunci lowongan ada di CV ini.'));
    if (m.miss.length) {
      result.append(h('p', {class:'hint'}, 'Belum ada. Tambahkan hanya yang memang Anda kuasai; klik untuk memasukkan ke Keahlian.'));
      result.append(h('div', {class:'kw'}, m.miss.map(k => h('button', {onclick() {
        let g = doc.skill.find(s => /lainnya|other/i.test(s.kelompok)) || doc.skill[doc.skill.length - 1];
        if (!g) { g = {id:CV.uid(),kelompok:'',items:''}; doc.skill.push(g); }
        g.items = [g.items, k].filter(Boolean).join(', '); touch(); runMatch();
      }}, '+ ' + k))));
    }
    if (m.hit.length) result.append(h('p', {class:'hint'}, 'Sudah ada:'), h('div', {class:'kw'}, m.hit.map(k => h('span', {class:'y'}, k))));
  };
  const ta = h('textarea', {rows:6, placeholder:'Tempel teks lowongan di sini'}); ta.value = adText;
  ta.addEventListener('input', () => { adText = ta.value; runMatch(); });
  runMatch();
  const plain = CV.toText(doc, T);
  return [h('h2', null, 'Cek ATS'), h('p', {class:'lead'}, 'Pemeriksaan aturan umum format ATS. Setiap sistem berbeda, jadi ini panduan dan bukan skor resmi.'),
    h('div', {class:'ck-sum'}, h('b', null, ok + '/' + list.length), h('span', null, 'aturan terpenuhi')), rows,
    h('h3', null, 'Cocokkan dengan lowongan'), h('div', {class:'f'}, ta), result,
    h('h3', null, 'Teks yang terbaca sistem'), h('p', {class:'hint'}, 'Urutan isi saat dibaca mesin. Bisa ditempel ke formulir portal lamaran.'),
    h('div', {class:'txt'}, plain),
    h('button', {class:'btn sm', onclick() { navigator.clipboard.writeText(plain).then(() => toast('Teks disalin.')); }}, 'Salin teks')];
}

/* ---------- navigation ---------- */
const NAV = [
  ['DATA', [['pribadi','Data Pribadi'],['profil','Ringkasan'],['kerja','Pengalaman Kerja'],['didik','Pendidikan'],['skill','Keahlian'],['bahasa','Bahasa'],['sertifikat','Sertifikasi'],['latih','Pelatihan'],['proyek','Proyek'],['org','Organisasi'],['award','Penghargaan'],['publik','Publikasi'],['rujuk','Referensi'],['ekstra','Bagian Tambahan'],['lain','Informasi Tambahan']]],
  ['TAMPILAN', [['template','Template'],['atur','Pengaturan'],['susun','Susunan Bagian']]],
  ['PERIKSA', [['cek','Cek ATS']]]
];
function renderNav() {
  const n = $('nav'); n.innerHTML = '';
  NAV.forEach(([g, items]) => { n.append(h('h4', null, g)); items.forEach(([k, t]) => n.append(h('button', {'data-k':k, class:panel === k ? 'on' : '', onclick() { showPanel(k); }}, h('span', null, t), h('span', {class:'ct', 'data-ct':k})))); });
  navCounts();
}
function navCounts() {
  document.querySelectorAll('[data-ct]').forEach(e => { const a = doc[e.dataset.ct]; e.textContent = Array.isArray(a) && a.length ? a.length : ''; });
}
function showPanel(k) {
  panel = k; thumbJob++;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  const f = $('form'); f.innerHTML = '';
  const kids = k === 'pribadi' ? pribadiPanel() : k === 'profil' ? profilPanel() : k === 'lain' ? lainPanel() : k === 'template' ? templatePanel() : k === 'atur' ? aturPanel() : k === 'susun' ? susunPanel() : k === 'cek' ? cekPanel() : listPanel(k);
  f.append(...kids.flat().filter(Boolean));
  f.scrollTop = 0;
  const b = document.querySelector(`#nav button[data-k="${k}"]`);
  if (b && b.scrollIntoView && $('nav').scrollWidth > $('nav').clientWidth) b.scrollIntoView({block:'nearest', inline:'center'});
}

/* ---------- preview ---------- */
let renderT = 0, zoom = 0, layoutR = null, renderSeq = 0;
function schedule() { clearTimeout(renderT); renderT = setTimeout(renderPreview, 140); }
async function renderPreview() {
  const seq = ++renderSeq, d = viewDoc(), T = CV.tpl(d.tpl);
  await CV.ensureFonts(d, T);
  if (seq !== renderSeq) return;
  layoutR = CV.layout(d, $('stage'));
  lastPages = layoutR.n;
  paintPages();
  const info = $('pvInfo'), empty = CV.isEmpty(doc);
  info.innerHTML = '';
  info.append(`${T.name} · ${layoutR.n} halaman`);
  if (empty) info.append(' · Contoh, terganti saat data diisi');
  if (layoutR.over) info.append(h('b', null, ` · Isi tidak muat ${layoutR.target} halaman`));
}
function paintPages() {
  if (!layoutR) return;
  const d = viewDoc(), [W, H] = CV.PAPER[d.paper] || CV.PAPER.a4, box = $('pvs');
  const avail = box.clientWidth - (innerWidth <= 760 ? 24 : 40);
  const fit = Math.max(.25, Math.min(1.35, avail / W)), s = zoom ? zoom : fit;
  const wrap = $('pages'); const top = box.scrollTop;
  wrap.innerHTML = layoutR.pages.map(p => `<div class="pg" style="width:${W * s}px;height:${H * s}px"><div style="transform:scale(${s})">${p}</div></div>`).join('');
  box.scrollTop = top;
}
function setZoom(dir) {
  const d = viewDoc(), W = (CV.PAPER[d.paper] || CV.PAPER.a4)[0], box = $('pvs');
  const cur = zoom || Math.max(.25, Math.min(1.35, (box.clientWidth - 40) / W));
  zoom = dir ? Math.max(.3, Math.min(2, cur + dir * .1)) : 0; paintPages();
}
new ResizeObserver(() => { if (layoutR) paintPages(); }).observe($('pvs'));

/* ---------- downloads ---------- */
function baseName() {
  const p = doc.p; const parts = ['CV', p.nama, p.jabatan].filter(Boolean).join(' ').replace(/[\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '_');
  return parts || 'CV';
}
function save(blob, name) {
  const u = URL.createObjectURL(blob), a = h('a', {href:u, download:name});
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
}
function needData() { if (CV.isEmpty(doc)) { toast('Isi data dulu. Yang tampil sekarang baru contoh.'); return true; } if (!doc.p.nama.trim()) { toast('Nama lengkap belum diisi.'); showPanel('pribadi'); return true; } return false; }
async function dlPdf() {
  if (needData()) return;
  const b = $('dlPdf'); b.disabled = true; b.textContent = 'Menyiapkan…';
  try {
    saveNow(); await CV.ensureFonts(doc, CV.tpl(doc.tpl));
    const r = CV.layout(doc, $('stage'));
    /* own stage: typing or thumbnails must not disturb the page while it is being read */
    const st = h('div', {class:'stage'}); document.body.append(st);
    const out = await CV.buildPdf(doc, r.pages, st).finally(() => st.remove());
    save(new Blob([out.bytes], {type:'application/pdf'}), baseName() + '.pdf');
    toast(out.unknown.length ? 'Terunduh. Karakter ini tidak tersedia di huruf yang dipilih: ' + out.unknown.join(' ') : `PDF terunduh, ${r.n} halaman.`);
  } catch (e) { console.error(e); toast('PDF gagal dibuat: ' + e.message); }
  b.disabled = false; b.textContent = 'Unduh PDF';
}
function dlDocx() { if (needData()) return; saveNow(); save(CV.buildDocx(doc), baseName() + '.docx'); toast('Word terunduh dalam format satu kolom.'); }
function dlTxt() { if (needData()) return; save(new Blob([CV.toText(doc, CV.tpl(doc.tpl))], {type:'text/plain;charset=utf-8'}), baseName() + '.txt'); }
function dlJson() { saveNow(); save(new Blob([JSON.stringify(doc, null, 1)], {type:'application/json'}), baseName() + '.json'); }

/* ---------- documents ---------- */
function switchDoc(id) { saveNow(); index.cur = id; localStorage.setItem(IDX, JSON.stringify(index)); doc = hydrate(jget(DOC(id), CV.blank())); openCard = null; afterSwitch(); }
function addDoc(d, name) { saveNow(); d.id = CV.uid(); if (name) d.name = name; doc = hydrate(d); index.cur = d.id; persist(doc); openCard = null; afterSwitch(); }
function afterSwitch() { $('docName').textContent = doc.name; paintTplBtn(); showPanel(panel); renderPreview(); }
function paintTplBtn() { $('tplBtn').textContent = 'Template: ' + CV.tpl(doc.tpl).name; }
function docMenu() {
  const items = [{head:'CV tersimpan'}];
  index.list.slice().sort((a, b) => b.upd - a.upd).forEach(x => items.push({label:x.name, cur:x.id === doc.id, fn() { if (x.id !== doc.id) switchDoc(x.id); }}));
  items.push('-',
    {label:'CV baru', fn() { addDoc(CV.blank(), 'CV Baru'); showPanel('pribadi'); }},
    {label:'Isi dari CV lama', sub:'Baca PDF atau DOCX ke formulir', fn() { $('fileImport').click(); }},
    {label:'Salin untuk lowongan lain', fn() { addDoc(JSON.parse(JSON.stringify(doc)), doc.name + ' (salinan)'); toast('Salinan dibuat.'); }},
    {label:'Ganti nama', fn() { const n = prompt('Nama CV', doc.name); if (n && n.trim()) { doc.name = n.trim(); $('docName').textContent = doc.name; dirty = true; saveNow(); } }},
    {label:'Isi dengan data contoh', fn() { const s = CV.sample(); s.tpl = doc.tpl; addDoc(s, 'Contoh CV'); }},
    '-',
    {label:'Unduh cadangan data', sub:'Berkas JSON', fn:dlJson},
    {label:'Pulihkan dari cadangan', fn() { $('fileJson').click(); }},
    '-',
    {label:'Hapus CV ini', del:true, fn() {
      if (!confirm('Hapus "' + doc.name + '"?')) return;
      dirty = false; clearTimeout(saveT);
      localStorage.removeItem(DOC(doc.id)); index.list = index.list.filter(x => x.id !== doc.id);
      if (index.list.length) { index.cur = index.list[0].id; localStorage.setItem(IDX, JSON.stringify(index)); doc = hydrate(jget(DOC(index.cur), CV.blank())); }
      else { doc = CV.blank(); index.cur = doc.id; persist(doc); }
      afterSwitch();
    }});
  openMenu($('docBtn'), items);
}
$('docBtn').addEventListener('click', () => $('menu').hidden ? docMenu() : closeMenu());
$('tplBtn').addEventListener('click', () => { galTab = CV.tpl(doc.tpl).group; showPanel('template'); setView('form'); });
$('dlPdf').addEventListener('click', dlPdf);
$('dlMore').addEventListener('click', () => { if (!$('menu').hidden) return closeMenu(); openMenu($('dlMore'), [
  {label:'PDF', sub:'Sesuai template yang dipilih', fn:dlPdf},
  {label:'Word (.docx)', sub:'Satu kolom siap ATS, bisa diedit', fn:dlDocx},
  {label:'Teks (.txt)', sub:'Untuk ditempel ke formulir portal', fn:dlTxt}
], true); });
$('zOut').addEventListener('click', () => setZoom(-1));
$('zIn').addEventListener('click', () => setZoom(1));
$('zFit').addEventListener('click', () => setZoom(0));
function setView(v) { $('work').dataset.v = v; document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); if (v === 'prev') requestAnimationFrame(paintPages); }
$('tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); });

$('fileImport').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  toast('Membaca ' + f.name + '…');
  try {
    const d = await CV.importFile(f);
    if (CV.isEmpty(d)) throw new Error('Tidak ada data yang bisa dikenali.');
    d.tpl = doc.tpl; addDoc(d, (d.p.nama || 'CV') + ' (impor)'); showPanel('pribadi');
    toast(`Terbaca: ${d.kerja.length} pekerjaan, ${d.didik.length} pendidikan, ${d.skill.length} kelompok keahlian. Periksa kembali isinya.`);
  } catch (err) { console.error(err); toast('Gagal membaca berkas: ' + err.message); }
});
$('fileJson').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (!d || !d.p) throw new Error('bukan cadangan Amatu CV'); addDoc(d, d.name); toast('Cadangan dipulihkan sebagai CV baru.'); }
  catch (err) { toast('Berkas tidak bisa dipulihkan: ' + err.message); }
});

/* ---------- photo crop ---------- */
const ph = {img:null, x:0, y:0, z:1};
function drawPhoto() {
  const c = $('photoCv'), x = c.getContext('2d'), N = c.width, im = ph.img; if (!im) return;
  const base = N / Math.min(im.naturalWidth, im.naturalHeight), s = base * ph.z, w = im.naturalWidth * s, hh = im.naturalHeight * s;
  ph.x = Math.min(0, Math.max(N - w, ph.x)); ph.y = Math.min(0, Math.max(N - hh, ph.y));
  x.fillStyle = '#fff'; x.fillRect(0, 0, N, N); x.drawImage(im, ph.x, ph.y, w, hh);
}
$('filePhoto').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const im = new Image();
  im.onload = () => { URL.revokeObjectURL(im.src); ph.img = im; ph.z = 1; $('photoZoom').value = 1; const N = 560, b = N / Math.min(im.naturalWidth, im.naturalHeight); ph.x = (N - im.naturalWidth * b) / 2; ph.y = Math.min(0, (N - im.naturalHeight * b) * .25); drawPhoto(); $('photoDlg').showModal(); };
  im.onerror = () => toast('Gambar tidak bisa dibuka. Gunakan JPG atau PNG.');
  im.src = URL.createObjectURL(f);
});
$('photoZoom').addEventListener('input', e => {
  const N = 560, oz = ph.z, nz = +e.target.value, cx = (N / 2 - ph.x) / oz, cy = (N / 2 - ph.y) / oz;
  ph.z = nz; ph.x = N / 2 - cx * nz; ph.y = N / 2 - cy * nz; drawPhoto();
});
(() => {
  const c = $('photoCv'); let sx = 0, sy = 0, on = false;
  c.addEventListener('pointerdown', e => { on = true; sx = e.clientX; sy = e.clientY; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e => { if (!on) return; const k = c.width / c.clientWidth; ph.x += (e.clientX - sx) * k; ph.y += (e.clientY - sy) * k; sx = e.clientX; sy = e.clientY; drawPhoto(); });
  c.addEventListener('pointerup', () => on = false);
})();
$('photoCancel').addEventListener('click', () => $('photoDlg').close());
$('photoOk').addEventListener('click', () => {
  doc.p.foto = $('photoCv').toDataURL('image/jpeg', .86); $('photoDlg').close(); touch(); CV.onPhoto && CV.onPhoto();
});

/* ---------- start ---------- */
load();
$('work').dataset.v = 'form';
$('docName').textContent = doc.name;
paintTplBtn(); renderNav(); showPanel(panel); renderPreview();
window.CVAPP = {get doc() { return doc; }, set doc(v) { doc = hydrate(v); afterSwitch(); }, renderPreview, showPanel, dlPdf, get layout() { return layoutR; }};
})();
