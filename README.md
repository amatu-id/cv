# Amatu CV

Pembuat curriculum vitae di peramban: isi data sekali, CV tersusun otomatis dalam 8 format ATS dan 12 template visual.

- **Keluaran:** PDF teks asli (huruf tertanam, bisa dicari dan dibaca ATS), Word `.docx` satu kolom, teks `.txt`.
- **Cek ATS:** aturan format dan pencocokan kata kunci dengan teks lowongan.
- **Isi dari CV lama:** baca PDF atau DOCX ke formulir.

Tidak ada langkah build. Sumber: `js/model.js` (data dan `structure()`), `js/templates.js` + `css/cv.css` (template), `js/render.js` (pemenggalan halaman), `js/export-pdf.js`, `js/export-docx.js`, `js/check.js`, `js/import.js`, `js/app.js` (antarmuka). Font dibuat ulang dengan `tools/build-fonts.py`.

Data tersimpan di `localStorage` (`cv.index`, `cv.doc.<id>`) dan disinkronkan per akun oleh `/amatu.js` Portal AMATU.
