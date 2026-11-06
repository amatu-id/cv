/* Data model: empty CV, sample CV, label tables, and structure(): data -> ordered sections.
   Every output (preview, PDF, DOCX, plain text, ATS check) reads from structure(). */
'use strict';
const CV = window.CV = {};

CV.SECTIONS = ['profil','kerja','proyek','didik','skill','sertifikat','latih','bahasa','org','award','publik','ekstra','lain','pribadi','rujuk'];

const TITLES = {
  id:{kontak:'Kontak',profil:'Ringkasan Profesional',kerja:'Pengalaman Kerja',didik:'Pendidikan',skill:'Keahlian',bahasa:'Bahasa',sertifikat:'Sertifikasi',latih:'Pelatihan',proyek:'Proyek',org:'Pengalaman Organisasi',award:'Penghargaan',publik:'Publikasi',rujuk:'Referensi',pribadi:'Data Pribadi',lain:'Informasi Tambahan',ekstra:'Bagian Tambahan'},
  en:{kontak:'Contact',profil:'Professional Summary',kerja:'Work Experience',didik:'Education',skill:'Skills',bahasa:'Languages',sertifikat:'Certifications',latih:'Training',proyek:'Projects',org:'Organizational Experience',award:'Awards',publik:'Publications',rujuk:'References',pribadi:'Personal Information',lain:'Additional Information',ekstra:'Additional Section'}
};
const WORDS = {
  id:{now:'Sekarang',gpa:'IPK',of:'dari',ref:'Tersedia atas permintaan.',lahir:'Tempat, tanggal lahir',jk:'Jenis kelamin',status:'Status pernikahan',agama:'Agama',warga:'Kewarganegaraan',nik:'NIK',npwp:'NPWP',sim:'SIM',tb:'Tinggi / berat badan',alamat:'Alamat',gaji:'Gaji yang diharapkan',siap:'Ketersediaan mulai kerja',tempat:'Penempatan',minat:'Minat',yr:'thn',mo:'bln',nomor:'No.',valid:'berlaku s.d.',email:'Email',telp:'Telepon',lokasi:'Lokasi',linkedin:'LinkedIn',web:'Situs',github:'GitHub',klien:'Klien',nilai:'Nilai'},
  en:{now:'Present',gpa:'GPA',of:'of',ref:'Available upon request.',lahir:'Place, date of birth',jk:'Gender',status:'Marital status',agama:'Religion',warga:'Nationality',nik:'National ID',npwp:'Tax ID',sim:'Driving license',tb:'Height / weight',alamat:'Address',gaji:'Expected salary',siap:'Availability',tempat:'Relocation',minat:'Interests',yr:'yr',mo:'mo',nomor:'No.',valid:'valid until',email:'Email',telp:'Phone',lokasi:'Location',linkedin:'LinkedIn',web:'Website',github:'GitHub',klien:'Client',nilai:'Value'}
};
const VALUE_EN = {'Laki-laki':'Male','Perempuan':'Female','Belum menikah':'Single','Menikah':'Married','Cerai':'Divorced','Islam':'Islam','Kristen':'Christian','Katolik':'Catholic','Hindu':'Hindu','Buddha':'Buddhist','Konghucu':'Confucian','Indonesia':'Indonesian','Segera':'Immediately','2 minggu':'2 weeks','1 bulan':'1 month','2 bulan':'2 months','3 bulan':'3 months','Purnawaktu':'Full-time','Paruh waktu':'Part-time','Kontrak':'Contract','Magang':'Internship','Lepas':'Freelance','Bersedia di seluruh Indonesia':'Willing to relocate within Indonesia','Bersedia di luar negeri':'Willing to relocate abroad','Tidak bersedia':'Not willing to relocate','Dasar':'Basic','Menengah':'Intermediate','Mahir':'Advanced','Profesional':'Professional','Penutur asli':'Native'};
const JENJANG_EN = {'SMA':'High School','SMK':'Vocational High School','MA':'Islamic High School','D1':'Diploma 1','D2':'Diploma 2','D3':'Diploma 3','D4':'Applied Bachelor','S1':'Bachelor','S2':'Master','S3':'Doctorate','Profesi':'Professional Degree'};
const MON_S = {id:['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']};
const MON_L = {id:['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'],en:['January','February','March','April','May','June','July','August','September','October','November','December']};

CV.uid = () => Math.random().toString(36).slice(2, 10);
CV.lines = s => String(s || '').split(/\r?\n/).map(x => x.replace(/^\s*(?:[•·▪●◦*–—-]\s+)?/, '').trim()).filter(Boolean);
CV.esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- blank + sample ---------- */
CV.blank = () => ({
  v:1, id:CV.uid(), name:'CV Baru', tpl:'ats-standar', accent:null, font:null,
  lang:'id', fs:null, sp:1, mg:1, paper:'a4', fit:'auto', photo:'auto', dateFmt:'short', dur:false,
  order:null, hide:{}, titles:{},
  p:{nama:'',gDepan:'',gBelakang:'',jabatan:'',foto:'',email:'',telp:'',alamat:'',kota:'',provinsi:'',kodepos:'',linkedin:'',web:'',github:'',
     lahirTempat:'',lahirTgl:'',jk:'',status:'',agama:'',warga:'',nik:'',npwp:'',sim:'',tinggi:'',berat:'',
     tampil:{alamat:false,lahir:false,jk:false,status:false,agama:false,warga:false,nik:false,npwp:false,sim:false,tb:false}},
  ringkasan:'', kerja:[], didik:[], skill:[], bahasa:[], sertifikat:[], latih:[], proyek:[], org:[], award:[], publik:[], rujuk:[], rujukMinta:false, ekstra:[],
  lain:{gaji:'',siap:'',tempat:'',minat:''}
});

CV.sample = () => Object.assign(CV.blank(), {
  name:'Contoh CV',
  p:{nama:'Rina Kartika Dewi',gDepan:'',gBelakang:'S.T., M.T.',jabatan:'Project Engineer',foto:'',email:'rina.kartika@contoh.id',telp:'+62 812-3456-7890',alamat:'Jl. Cihampelas No. 45',kota:'Bandung',provinsi:'Jawa Barat',kodepos:'40131',linkedin:'linkedin.com/in/rinakartika',web:'',github:'',
     lahirTempat:'Bandung',lahirTgl:'1992-05-12',jk:'Perempuan',status:'Menikah',agama:'',warga:'Indonesia',nik:'',npwp:'',sim:'A',tinggi:'',berat:'',
     tampil:{alamat:false,lahir:true,jk:false,status:false,agama:false,warga:true,nik:false,npwp:false,sim:true,tb:false}},
  ringkasan:'Project Engineer dengan 9 tahun pengalaman pada proyek gedung dan infrastruktur bernilai hingga Rp420 miliar. Terbiasa menangani perencanaan jadwal, pengendalian biaya, dan koordinasi subkontraktor dari tahap tender hingga serah terima. Memegang sertifikat SKA Ahli Madya Teknik Bangunan Gedung.',
  kerja:[
    {id:'k1',posisi:'Senior Project Engineer',perusahaan:'PT Karya Beton Nusantara',lokasi:'Jakarta',tipe:'Purnawaktu',bidang:'',mulai:'2021-03',selesai:'',kini:true,uraian:'Mengendalikan jadwal dan biaya proyek gedung perkantoran 28 lantai senilai Rp420 miliar; selesai 12 hari lebih awal dari kontrak.\nMenyusun ulang metode pengecoran pelat lantai sehingga pemakaian bekisting berkurang 18%.\nMemimpin tim 6 engineer dan mengoordinasikan 14 subkontraktor.\nMenerapkan pelaporan progres mingguan berbasis Primavera P6 yang kemudian dipakai di 3 proyek lain.'},
    {id:'k2',posisi:'Project Engineer',perusahaan:'PT Wijaya Bangun Persada',lokasi:'Surabaya',tipe:'Purnawaktu',bidang:'',mulai:'2017-06',selesai:'2021-02',kini:false,uraian:'Menangani pembangunan 2 jembatan beton pratekan dengan total nilai kontrak Rp185 miliar.\nMenyusun RAB dan analisa harga satuan untuk 9 dokumen tender; 4 di antaranya dimenangkan.\nMenekan pekerjaan ulang dari 4,1% menjadi 1,6% melalui inspeksi bersama sebelum pengecoran.'},
    {id:'k3',posisi:'Site Engineer',perusahaan:'CV Mandala Konstruksi',lokasi:'Bandung',tipe:'Kontrak',bidang:'',mulai:'2015-08',selesai:'2017-05',kini:false,uraian:'Mengawasi pekerjaan struktur ruko 3 lantai sebanyak 42 unit, termasuk uji beton dan pembesian.\nMembuat as-built drawing dan laporan harian untuk konsultan pengawas.'}
  ],
  didik:[
    {id:'d1',jenjang:'S2',jurusan:'Manajemen Konstruksi',institusi:'Universitas Parahyangan Raya',lokasi:'Bandung',mulai:'2019-08',selesai:'2021-08',kini:false,ipk:'3,78',skala:'4,00',uraian:''},
    {id:'d2',jenjang:'S1',jurusan:'Teknik Sipil',institusi:'Institut Teknologi Priangan',lokasi:'Bandung',mulai:'2010-08',selesai:'2015-02',kini:false,ipk:'3,52',skala:'4,00',uraian:'Skripsi: Analisis biaya siklus hidup perkerasan kaku pada jalan kabupaten.'}
  ],
  skill:[
    {id:'s1',kelompok:'Teknik',items:'Estimasi biaya, Analisa harga satuan, Manajemen kontrak FIDIC, Pengendalian mutu, Metode kerja struktur'},
    {id:'s2',kelompok:'Perangkat lunak',items:'Primavera P6, Microsoft Project, AutoCAD, SAP2000, Revit, Microsoft Excel'},
    {id:'s3',kelompok:'Manajerial',items:'Koordinasi subkontraktor, Negosiasi, Pelaporan ke pemilik proyek'}
  ],
  bahasa:[{id:'b1',nama:'Indonesia',level:'Penutur asli',skor:''},{id:'b2',nama:'Inggris',level:'Profesional',skor:'TOEFL ITP 557'}],
  sertifikat:[
    {id:'c1',nama:'SKA Ahli Madya Teknik Bangunan Gedung',penerbit:'LPJK',tahun:'2022',berlaku:'2027',nomor:''},
    {id:'c2',nama:'Project Management Professional (PMP)',penerbit:'Project Management Institute',tahun:'2020',berlaku:'',nomor:''},
    {id:'c3',nama:'Ahli K3 Konstruksi Muda',penerbit:'BNSP',tahun:'2018',berlaku:'',nomor:''}
  ],
  latih:[{id:'l1',nama:'Primavera P6 Professional Advanced',penyelenggara:'Lembaga Pelatihan Konstruksi Mandiri',tahun:'2019',durasi:'40 jam'}],
  proyek:[], org:[{id:'o1',peran:'Anggota Bidang Pendidikan',nama:'Himpunan Ahli Konstruksi Jawa Barat',mulai:'2018-01',selesai:'',kini:true,uraian:''}],
  award:[], publik:[], rujukMinta:true,
  lain:{gaji:'',siap:'1 bulan',tempat:'Bersedia di seluruh Indonesia',minat:''}
});

/* A CV counts as empty until the person has typed something of substance. */
CV.isEmpty = d => !(d.p.nama || d.p.jabatan || d.p.email || d.p.telp || d.ringkasan || d.kerja.length || d.didik.length || d.skill.length);

/* ---------- formatting ---------- */
CV.fmtYM = (v, lang, fmt) => {
  if (!v) return '';
  const m = /^(\d{4})(?:-(\d{1,2}))?$/.exec(v); if (!m) return String(v);
  const y = m[1], mo = m[2] ? +m[2] - 1 : -1;
  if (fmt === 'year' || mo < 0) return y;
  if (fmt === 'num') return String(mo + 1).padStart(2, '0') + '/' + y;
  return (fmt === 'long' ? MON_L : MON_S)[lang][mo] + ' ' + y;
};
CV.fmtDate = (iso, lang) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return iso || ''; return +m[3] + ' ' + MON_L[lang][+m[2] - 1] + ' ' + m[1]; };
const ymIdx = v => { const m = /^(\d{4})(?:-(\d{1,2}))?$/.exec(v || ''); return m ? +m[1] * 12 + (m[2] ? +m[2] - 1 : 0) : null; };
const nowIdx = () => { const n = new Date(); return n.getFullYear() * 12 + n.getMonth(); };
CV.ymIdx = ymIdx;
function range(e, d) {
  const w = WORDS[d.lang], a = CV.fmtYM(e.mulai, d.lang, d.dateFmt), b = e.kini ? w.now : CV.fmtYM(e.selesai, d.lang, d.dateFmt);
  return a && b ? (a === b ? a : a + ' – ' + b) : (a || b);
}
function durText(e, d) {
  const a = ymIdx(e.mulai), b = e.kini ? nowIdx() : ymIdx(e.selesai);
  if (a == null || b == null || b < a) return '';
  const n = b - a + 1, y = Math.floor(n / 12), m = n % 12, w = WORDS[d.lang];
  return [y ? y + ' ' + w.yr : '', m ? m + ' ' + w.mo : ''].filter(Boolean).join(' ');
}
/* Total working months, overlapping jobs counted once. */
CV.expMonths = d => {
  const r = d.kerja.map(e => [ymIdx(e.mulai), e.kini ? nowIdx() : ymIdx(e.selesai)]).filter(x => x[0] != null && x[1] != null && x[1] >= x[0]).sort((a, b) => a[0] - b[0]);
  let tot = 0, end = -1;
  for (const [a, b] of r) { const s = Math.max(a, end + 1); if (b >= s) tot += b - s + 1; end = Math.max(end, b); }
  return tot;
};
CV.fullName = p => [p.gDepan, p.nama].filter(Boolean).join(' ') + (p.gBelakang ? (p.nama ? ', ' : '') + p.gBelakang : '');
CV.normPhone = s => {
  const raw = String(s || '').trim(); if (!raw) return '';
  let n = raw.replace(/[^\d+]/g, '');
  if (/^0/.test(n)) n = '+62' + n.slice(1); else if (/^62/.test(n)) n = '+' + n;
  const m = /^\+62(8\d{2})(\d{3,4})(\d{3,5})$/.exec(n);
  return m ? '+62 ' + m[1] + '-' + (m[2] + m[3]).replace(/^(\d{4})(\d+)$/, '$1-$2') : raw;
};
CV.shortUrl = s => String(s || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
CV.href = s => { const u = String(s || '').trim(); return !u ? '' : /^https?:\/\//i.test(u) ? u : 'https://' + u; };
const tv = (d, v) => d.lang === 'en' ? (VALUE_EN[v] || v) : v;
const dec = (d, v) => d.lang === 'en' ? String(v).replace(',', '.') : String(v).replace('.', ',');

/* ---------- structure ---------- */
CV.title = (d, key) => (d.titles && d.titles[key]) || TITLES[d.lang][key];
CV.word = (d, k) => WORDS[d.lang][k];

CV.contact = d => {
  const p = d.p, w = WORDS[d.lang], out = [];
  const loc = [p.kota, p.provinsi].filter(Boolean).join(', ');
  if (p.tampil.alamat && p.alamat) out.push({k:'alamat',label:w.alamat,text:[p.alamat, loc, p.kodepos].filter(Boolean).join(', ')});
  else if (loc) out.push({k:'lokasi',label:w.lokasi,text:loc});
  if (p.telp) out.push({k:'telp',label:w.telp,text:p.telp,href:'tel:' + p.telp.replace(/[^\d+]/g, '')});
  if (p.email) out.push({k:'email',label:w.email,text:p.email,href:'mailto:' + p.email});
  if (p.linkedin) out.push({k:'linkedin',label:w.linkedin,text:CV.shortUrl(p.linkedin),href:CV.href(p.linkedin)});
  if (p.web) out.push({k:'web',label:w.web,text:CV.shortUrl(p.web),href:CV.href(p.web)});
  if (p.github) out.push({k:'github',label:w.github,text:CV.shortUrl(p.github),href:CV.href(p.github)});
  return out;
};

CV.structure = d => {
  const w = WORDS[d.lang], s = {}, L = CV.lines;
  const add = (key, items) => { if (items.length && !(d.hide && d.hide[key])) s[key] = {key, title:CV.title(d, key), items}; };

  if (d.ringkasan.trim()) add('profil', d.ringkasan.split(/\n{2,}/).map(t => ({kind:'para',text:t.replace(/\s*\n\s*/g,' ').trim()})));

  add('kerja', d.kerja.filter(e => e.posisi || e.perusahaan).map(e => {
    const dur = d.dur ? durText(e, d) : '';
    return {kind:'entry',t:e.posisi,o:e.perusahaan,l:e.lokasi,d:range(e, d) + (dur ? ' (' + dur + ')' : ''),meta:[tv(d, e.tipe), e.bidang].filter(x => x && x !== 'Purnawaktu' && x !== 'Full-time').join(' · '),bullets:L(e.uraian)};
  }));
  add('proyek', d.proyek.filter(e => e.nama).map(e => ({kind:'entry',t:e.nama,o:[e.peran, e.klien ? (w.klien + ': ' + e.klien) : ''].filter(Boolean).join(' · '),l:'',d:range(e, d),meta:e.nilai ? w.nilai + ': ' + e.nilai : '',bullets:L(e.uraian),link:e.tautan ? {text:CV.shortUrl(e.tautan),href:CV.href(e.tautan)} : null})));
  add('didik', d.didik.filter(e => e.institusi || e.jurusan).map(e => {
    const j = d.lang === 'en' ? (JENJANG_EN[e.jenjang] || e.jenjang) : e.jenjang;
    const gpa = e.ipk ? w.gpa + ' ' + dec(d, e.ipk) + (e.skala ? ' ' + w.of + ' ' + dec(d, e.skala) : '') : '';
    return {kind:'entry',t:[j, e.jurusan].filter(Boolean).join(d.lang === 'en' && e.jurusan && j ? ' of ' : ' '),o:e.institusi,l:e.lokasi,d:range(e, d),meta:gpa,bullets:L(e.uraian)};
  }));
  add('skill', d.skill.filter(e => e.items && e.items.trim()).map(e => {
    const items = e.items.split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
    return {kind:'line',label:e.kelompok,text:items.join(', '),items};
  }));
  add('sertifikat', d.sertifikat.filter(e => e.nama).map(e => ({kind:'entry',compact:true,t:e.nama,o:e.penerbit,l:'',d:e.tahun,meta:[e.nomor ? w.nomor + ' ' + e.nomor : '', e.berlaku ? w.valid + ' ' + e.berlaku : ''].filter(Boolean).join(' · '),bullets:[]})));
  add('latih', d.latih.filter(e => e.nama).map(e => ({kind:'entry',compact:true,t:e.nama,o:e.penyelenggara,l:'',d:e.tahun,meta:e.durasi,bullets:[]})));
  add('bahasa', d.bahasa.filter(e => e.nama).map(e => {
    const lv = [tv(d, e.level), e.skor].filter(Boolean).join(', ');
    return {kind:'line',label:tv(d, e.nama) === e.nama && d.lang === 'en' ? e.nama : tv(d, e.nama),text:lv,level:({'Dasar':1,'Menengah':2,'Mahir':3,'Profesional':4,'Penutur asli':5})[e.level] || 0};
  }));
  add('org', d.org.filter(e => e.nama || e.peran).map(e => ({kind:'entry',t:e.peran,o:e.nama,l:'',d:range(e, d),meta:'',bullets:L(e.uraian)})));
  add('award', d.award.filter(e => e.nama).map(e => ({kind:'entry',compact:true,t:e.nama,o:e.pemberi,l:'',d:e.tahun,meta:'',bullets:L(e.uraian)})));
  add('publik', d.publik.filter(e => e.judul).map(e => ({kind:'entry',compact:true,t:e.judul,o:e.penerbit,l:'',d:e.tahun,meta:'',bullets:[],link:e.tautan ? {text:CV.shortUrl(e.tautan),href:CV.href(e.tautan)} : null})));

  /* custom sections are stored one per entry, each rendered under its own heading */
  const ex = (d.ekstra || []).filter(e => e.judul && e.isi && e.isi.trim());
  ex.forEach((e, i) => { if (!(d.hide && d.hide.ekstra)) s['ekstra' + (i ? i : '')] = {key:'ekstra' + (i ? i : ''),title:e.judul,items:L(e.isi).map(t => ({kind:'bullet',text:t}))}; });

  const pr = [], p = d.p, ta = p.tampil;
  if (ta.lahir && (p.lahirTempat || p.lahirTgl)) pr.push([w.lahir, [p.lahirTempat, CV.fmtDate(p.lahirTgl, d.lang)].filter(Boolean).join(', ')]);
  if (ta.jk && p.jk) pr.push([w.jk, tv(d, p.jk)]);
  if (ta.status && p.status) pr.push([w.status, tv(d, p.status)]);
  if (ta.agama && p.agama) pr.push([w.agama, tv(d, p.agama)]);
  if (ta.warga && p.warga) pr.push([w.warga, tv(d, p.warga)]);
  if (ta.sim && p.sim) pr.push([w.sim, p.sim]);
  if (ta.tb && (p.tinggi || p.berat)) pr.push([w.tb, [p.tinggi ? p.tinggi + ' cm' : '', p.berat ? p.berat + ' kg' : ''].filter(Boolean).join(' / ')]);
  if (ta.nik && p.nik) pr.push([w.nik, p.nik]);
  if (ta.npwp && p.npwp) pr.push([w.npwp, p.npwp]);
  add('pribadi', pr.map(x => ({kind:'kv',label:x[0],text:x[1]})));

  const la = [], li = d.lain || {};
  if (li.gaji) la.push([w.gaji, li.gaji]);
  if (li.siap) la.push([w.siap, tv(d, li.siap)]);
  if (li.tempat) la.push([w.tempat, tv(d, li.tempat)]);
  if (li.minat) la.push([w.minat, li.minat]);
  add('lain', la.map(x => ({kind:'kv',label:x[0],text:x[1]})));

  const rf = d.rujuk.filter(e => e.nama).map(e => ({kind:'entry',compact:true,t:e.nama,o:[e.jabatan, e.instansi].filter(Boolean).join(', '),l:'',d:'',meta:[e.telp, e.email].filter(Boolean).join(' · '),bullets:[]}));
  add('rujuk', rf.length ? rf : d.rujukMinta ? [{kind:'para',text:w.ref}] : []);

  return {name:CV.fullName(d.p), jabatan:d.p.jabatan, contact:CV.contact(d), photo:d.p.foto, secs:s};
};

/* Section keys in final order, custom sections expanded in place of 'ekstra'. */
CV.orderedKeys = (d, T) => {
  const base = (d.order && d.order.length ? d.order : T.order || CV.SECTIONS).slice();
  CV.SECTIONS.forEach(k => { if (!base.includes(k)) base.push(k); });
  const out = [];
  base.forEach(k => { if (k === 'ekstra') (d.ekstra || []).forEach((_, i) => out.push('ekstra' + (i ? i : ''))); else out.push(k); });
  return out;
};

/* Plain text exactly as a parser should read it. Used for .txt export, ATS check and keyword match. */
CV.toText = (d, T) => {
  const st = CV.structure(d), out = [];
  if (st.name) out.push(st.name);
  if (st.jabatan) out.push(st.jabatan);
  if (st.contact.length) out.push(st.contact.map(c => c.text).join(' | '));
  for (const k of CV.orderedKeys(d, T)) {
    const s = st.secs[k]; if (!s) continue;
    out.push('', s.title.toUpperCase());
    for (const it of s.items) {
      if (it.kind === 'para') out.push(it.text);
      else if (it.kind === 'bullet') out.push('- ' + it.text);
      else if (it.kind === 'line') out.push((it.label ? it.label + ': ' : '') + it.text);
      else if (it.kind === 'kv') out.push(it.label + ': ' + it.text);
      else {
        out.push([it.t, it.d].filter(Boolean).join(' | '));
        const sub = [it.o, it.l].filter(Boolean).join(', ');
        if (sub) out.push(sub);
        if (it.meta) out.push(it.meta);
        if (it.link) out.push(it.link.text);
        it.bullets.forEach(b => out.push('- ' + b));
      }
    }
  }
  return out.join('\n');
};

/* Filled-in summary from the person's own data; no invented claims. */
CV.autoSummary = d => {
  const en = d.lang === 'en', p = d.p, s = [], k = d.kerja.filter(e => e.posisi), last = k[0];
  const yrs = Math.floor(CV.expMonths(d) / 12), job = p.jabatan || (last && last.posisi) || '';
  const fields = d.skill.flatMap(e => (e.items || '').split(',').map(x => x.trim())).filter(Boolean).slice(0, 4);
  const ed = d.didik[0];
  if (en) {
    if (job) s.push(job + (yrs ? ' with ' + yrs + ' year' + (yrs > 1 ? 's' : '') + ' of experience' : '') + '.');
    if (last && last.perusahaan) s.push((last.kini ? 'Currently ' : 'Most recently ') + last.posisi + ' at ' + last.perusahaan + '.');
    if (fields.length) s.push('Skilled in ' + fields.join(', ') + '.');
    if (ed && ed.institusi) s.push('Holds a ' + [JENJANG_EN[ed.jenjang] || ed.jenjang, ed.jurusan].filter(Boolean).join(' of ') + ' from ' + ed.institusi + '.');
    const c = d.sertifikat[0]; if (c && c.nama) s.push('Certified: ' + c.nama + '.');
  } else {
    if (job) s.push(job + (yrs ? ' dengan ' + yrs + ' tahun pengalaman' : '') + '.');
    if (last && last.perusahaan) s.push((last.kini ? 'Saat ini menjabat ' : 'Terakhir menjabat ') + last.posisi + ' di ' + last.perusahaan + '.');
    if (fields.length) s.push('Menguasai ' + fields.join(', ') + '.');
    if (ed && ed.institusi) s.push('Lulusan ' + [ed.jenjang, ed.jurusan].filter(Boolean).join(' ') + ' ' + ed.institusi + '.');
    const c = d.sertifikat[0]; if (c && c.nama) s.push('Memegang sertifikat ' + c.nama + '.');
  }
  return s.join(' ');
};
