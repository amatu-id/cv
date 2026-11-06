/* Word export: single-column document with real heading styles and bullet lists. Always ATS-safe,
   whichever template is on screen. Written directly as OOXML, zipped without compression. */
'use strict';
(function () {
const X = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = ~0; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (~c) >>> 0; };

function zip(files) {
  const enc = new TextEncoder(), chunks = [], central = [];
  let off = 0;
  const now = new Date(), time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const [name, text] of files) {
    const n = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
    h.setUint16(26, n.length, true); h.setUint16(28, 0, true);
    chunks.push(new Uint8Array(h.buffer), n, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, n.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), n);
    off += 30 + n.length + data.length;
  }
  const csize = central.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  return new Blob([...chunks, ...central, new Uint8Array(e.buffer)], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}

CV.buildDocx = function (d) {
  const T = CV.tpl(d.tpl), st = CV.structure(d);
  const map = {Arimo:'Arial',Carlito:'Calibri',Tinos:'Times New Roman'};
  const fontName = map[d.font || T.fb] || (/(Serif|Garamond)/.test(d.font || T.fb) ? 'Times New Roman' : 'Arial');
  const size = Math.round((d.fs || T.fs || 10) * 2);
  const accent = (T.color && T.group === 'ats' ? (d.accent || T.acc) : '#000000').replace('#', '').toUpperCase();
  const paper = d.paper === 'letter' ? [12240, 15840] : [11906, 16838];
  const mg = Math.round(54 * 15 * (d.mg || 1) * (T.group === 'ats' ? (T.mg || 1) : 1));
  const tw = paper[0] - mg * 2;
  const run = (t, o = {}) => t ? `<w:r>${o.b || o.i || o.c ? `<w:rPr>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.c ? `<w:color w:val="${o.c}"/>` : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${X(t)}</w:t></w:r>` : '';
  const tab = '<w:r><w:tab/></w:r>';
  const tabs = `<w:tabs><w:tab w:val="right" w:pos="${tw}"/></w:tabs>`;
  const body = [];
  const P = (inner, ppr = '') => body.push(`<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${inner}</w:p>`);

  if (st.name) P(run(st.name), '<w:pStyle w:val="Title"/>');
  if (st.jabatan) P(run(st.jabatan), '<w:pStyle w:val="Subtitle"/>');
  if (st.contact.length) P(run(st.contact.map(c => c.text).join(' | ')), '<w:spacing w:after="60"/>');

  for (const k of CV.orderedKeys(d, T)) {
    const s = st.secs[k]; if (!s) continue;
    P(run(s.title), '<w:pStyle w:val="Heading1"/>');
    s.items.forEach(it => {
      if (it.kind === 'para') P(run(it.text));
      else if (it.kind === 'bullet') P(run(it.text), '<w:pStyle w:val="ListBullet"/>');
      else if (it.kind === 'line') P(run(it.label ? it.label + ': ' : '', {b:true}) + run(it.text), '<w:spacing w:after="20"/>');
      else if (it.kind === 'kv') P(run(it.label + ': ', {b:true}) + run(it.text), '<w:spacing w:after="20"/>');
      else {
        P(run(it.t, {b:true}) + (it.d ? tab + run(it.d) : ''), `<w:keepNext/>${tabs}<w:spacing w:before="${it.compact ? 40 : 100}" w:after="0"/>`);
        if (it.o || it.l) P(run(it.o) + (it.l ? (it.o ? tab : '') + run(it.l) : ''), `${it.bullets.length ? '<w:keepNext/>' : ''}${tabs}<w:spacing w:after="0"/>`);
        if (it.meta) P(run(it.meta, {i:true}), '<w:spacing w:after="0"/>');
        if (it.link) P(run(it.link.text), '<w:spacing w:after="0"/>');
        it.bullets.forEach(b => P(run(b), '<w:pStyle w:val="ListBullet"/>'));
      }
    });
  }
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const docx = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="${paper[0]}" w:h="${paper[1]}"/><w:pgMar w:top="${mg - 90}" w:right="${mg}" w:bottom="${mg - 90}" w:left="${mg}" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const rf = `<w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}" w:eastAsia="${fontName}"/>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr>${rf}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:lang w:val="${d.lang === 'en' ? 'en-US' : 'id-ID'}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="40" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="20"/></w:pPr><w:rPr><w:b/><w:color w:val="${accent}"/><w:sz w:val="${size * 2}"/><w:szCs w:val="${size * 2}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="20"/></w:pPr><w:rPr><w:sz w:val="${size + 2}"/><w:szCs w:val="${size + 2}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${accent}"/></w:pBdr><w:spacing w:before="200" w:after="60"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:caps/><w:color w:val="${accent}"/><w:sz w:val="${size + 1}"/><w:szCs w:val="${size + 1}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="10"/></w:pPr></w:style></w:styles>`;
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${NS}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="284" w:hanging="227"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  return zip([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ['word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`],
    ['word/document.xml', docx], ['word/styles.xml', styles], ['word/numbering.xml', numbering],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X('CV ' + st.name)}</dc:title><dc:creator>${X(st.name)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`]
  ]);
};
})();
