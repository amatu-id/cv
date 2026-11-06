/* ATS check: concrete rules against the CV data, and exact-word matching against a job ad.
   It reports what is present or missing. It does not claim to predict any vendor's score. */
'use strict';
(function () {
const STOP = new Set(('dan atau yang di ke dari untuk dengan pada dalam ini itu sebagai akan oleh para serta adalah dapat harus memiliki mempunyai minimal maksimal min maks tahun bulan kami anda kamu saya kita mereka ia juga lebih atas bawah antara tidak bisa sudah telah secara sesuai seperti karena agar hingga sampai setiap semua seluruh lain lainnya bagi tentang terhadap kerja pekerjaan perusahaan posisi lowongan dibutuhkan dicari kandidat pelamar syarat persyaratan kualifikasi tanggung jawab tugas deskripsi lamaran kirim kirimkan cv melamar segera berpengalaman pengalaman diutamakan mampu baik sangat tinggi wajib bersedia penempatan siap usia pria wanita domisili lulusan terkait bidang orang hari jam the a an and or of to in on for with at by from as is are be will you your we our this that have has must should can may able who what when where which their they them it its about into over under not all any more most other such than then there these those been being were was job role position company team work working experience required requirements responsibilities qualifications candidate candidates apply skills skill strong good excellent ability years year including plus etc menguasai memahami mengerti menggunakan membuat menyusun melakukan dicari diharapkan sertifikat sertifikasi laporan senior junior staf staff').split(/\s+/));
const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}+#./ -]+/gu, ' ').replace(/\s+/g, ' ');

CV.keywords = function (ad) {
  const clean = String(ad || ''); if (!clean.trim()) return [];
  const uni = new Map(), bi = new Map();
  const good = w => w.length > 1 && !STOP.has(w.toLowerCase()) && !/^\d+$/.test(w);
  /* word pairs only count inside one phrase, never across a comma or a sentence end */
  clean.split(/[,;:()\n•]+|\.(?:\s|$)/).forEach(phrase => {
    const words = phrase.split(/[^\p{L}\p{N}+#.\-/]+/u).map(w => w.replace(/^[.\-/]+|[.\-/]+$/g, '')).filter(Boolean);
    words.forEach((w, i) => {
      if (!good(w)) return;
      const k = w.toLowerCase(), cap = /^[A-Z0-9]/.test(w);
      const u = uni.get(k) || {term:w, n:0, cap:false};
      u.n++; u.cap = u.cap || (cap && (i > 0 || /^[A-Z0-9+#.\-/]{2,}$/.test(w))); if (cap && !/^[A-Z]/.test(u.term)) u.term = w;
      uni.set(k, u);
      const nx = words[i + 1];
      if (nx && good(nx)) {
        const key = k + ' ' + nx.toLowerCase(), b = bi.get(key) || {term:w + ' ' + nx, n:0, cap:cap && /^[A-Z0-9]/.test(nx)};
        b.n++; bi.set(key, b);
      }
    });
  });
  const res = [], used = new Set();
  [...bi.entries()].filter(([, v]) => v.n >= 2 || v.cap).sort((a, b) => b[1].n - a[1].n).slice(0, 14).forEach(([k, v]) => { res.push(v.term); k.split(' ').forEach(x => used.add(x)); });
  [...uni.entries()].filter(([k, v]) => !used.has(k) && (v.n >= 2 || v.cap || /[+#/]|\d/.test(k))).sort((a, b) => (b[1].n + (b[1].cap ? 1 : 0)) - (a[1].n + (a[1].cap ? 1 : 0))).slice(0, 26 - res.length).forEach(([, v]) => res.push(v.term));
  return res;
};
CV.matchKeywords = function (d, T, ad) {
  const text = ' ' + norm(CV.toText(d, T)) + ' ';
  const hit = [], miss = [];
  CV.keywords(ad).forEach(k => { (text.includes(' ' + norm(k).trim() + ' ') || text.includes(norm(k).trim()) ? hit : miss).push(k); });
  return {hit, miss};
};

CV.checks = function (d, T, pages) {
  const out = [], p = d.p;
  const add = (ok, text, go, level) => out.push({ok, text, go, level:level || 'rec'});
  add(!!p.nama.trim(), 'Nama lengkap terisi', 'pribadi', 'req');
  add(!!p.jabatan.trim(), 'Jabatan yang dituju tertulis di bawah nama', 'pribadi', 'req');
  add(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email.trim()), 'Email valid', 'pribadi', 'req');
  add(p.telp.replace(/\D/g, '').length >= 9, 'Nomor telepon terisi', 'pribadi', 'req');
  add(!!p.kota.trim(), 'Kota domisili terisi', 'pribadi', 'req');
  const sum = d.ringkasan.trim().split(/\s+/).filter(Boolean).length;
  add(sum >= 25 && sum <= 90, sum ? `Ringkasan ${sum} kata (disarankan 25–90)` : 'Ringkasan profesional terisi', 'profil');
  const k = d.kerja.filter(e => e.posisi || e.perusahaan);
  if (k.length) {
    add(k.every(e => e.posisi && e.perusahaan), 'Setiap pekerjaan punya jabatan dan perusahaan', 'kerja', 'req');
    add(k.every(e => e.mulai && (e.kini || e.selesai)), 'Setiap pekerjaan punya tanggal mulai dan selesai', 'kerja', 'req');
    add(k.every(e => e.kini || CV.ymIdx(e.selesai) == null || CV.ymIdx(e.mulai) == null || CV.ymIdx(e.selesai) >= CV.ymIdx(e.mulai)), 'Tanggal selesai tidak mendahului tanggal mulai', 'kerja', 'req');
    const bl = k.flatMap(e => CV.lines(e.uraian));
    add(k.slice(0, 2).every(e => CV.lines(e.uraian).length >= 2), 'Dua pekerjaan terakhir punya minimal 2 poin uraian', 'kerja');
    const num = bl.filter(b => /\d/.test(b)).length;
    if (bl.length) add(num / bl.length >= .4, `${num} dari ${bl.length} poin memuat angka (disarankan minimal 40%)`, 'kerja');
    const saya = bl.filter(b => /\b(saya|aku|I|my)\b/.test(b)).length;
    if (bl.length) add(saya === 0, saya ? `${saya} poin memakai kata ganti orang pertama; awali dengan kata kerja` : 'Poin uraian tanpa kata ganti orang pertama', 'kerja');
    const long = bl.filter(b => b.length > 220).length;
    if (bl.length) add(long === 0, long ? `${long} poin lebih dari 220 karakter; pecah menjadi dua` : 'Panjang setiap poin wajar', 'kerja');
  } else {
    add(false, 'Pengalaman kerja, magang, atau organisasi terisi', 'kerja');
  }
  const ed = d.didik.filter(e => e.institusi || e.jurusan);
  add(ed.length > 0, 'Pendidikan terisi', 'didik', 'req');
  if (ed.length) add(ed.every(e => e.selesai || e.kini), 'Setiap pendidikan punya tahun lulus', 'didik');
  const skillN = d.skill.flatMap(s => (s.items || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean)).length;
  add(skillN >= 6, `${skillN} keahlian tertulis (disarankan minimal 6)`, 'skill');
  add(T.group === 'ats', T.group === 'ats' ? 'Template satu kolom tanpa grafik' : 'Template ini berkolom atau berwarna. Untuk portal lamaran pakai CV ATS', 'template', 'tpl');
  const photo = d.photo === 'on' || (d.photo === 'auto' && T.photo);
  add(!(T.group === 'ats' && photo && p.foto), 'Tanpa foto di format ATS', 'atur');
  const maxP = CV.expMonths(d) >= 120 ? 3 : 2;
  add(pages <= maxP, `${pages} halaman (disarankan maksimal ${maxP})`, 'atur');
  const sens = [];
  if (p.tampil.agama && p.agama) sens.push('agama');
  if (p.tampil.nik && p.nik) sens.push('NIK');
  if (p.tampil.npwp && p.npwp) sens.push('NPWP');
  add(!sens.length, sens.length ? `${sens.join(', ')} ikut tercetak; cantumkan hanya bila diminta` : 'Data sensitif tidak tercetak', 'pribadi');
  return out;
};
})();
