/* docx.js —— 浏览器端按范文版式生成 .docx（纯前端最小 ZIP 写入 + 校验） */
(function () {
  "use strict";

  /* ---------- 最小 ZIP（STORE 无压缩） ---------- */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(u8) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function dosTime(d) {
    var t = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() & 31) >> 1);
    var dt = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    return { t: t, d: dt };
  }

  function buildZip(entries) {
    var enc = new TextEncoder();
    var parts = [], central = [];
    var offset = 0;
    var now = dosTime(new Date());
    entries.forEach(function (e) {
      var nameU8 = enc.encode(e.name);
      var data = e.data;
      var crc = crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, now.t, true); lh.setUint16(12, now.d, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, nameU8.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), nameU8, data);
      central.push({ nameU8: nameU8, crc: crc, size: data.length, offset: offset });
      offset += 30 + nameU8.length + data.length;
    });
    var cdStart = offset, cd = [];
    var cdLen = 0;
    central.forEach(function (c) {
      var cHead = new DataView(new ArrayBuffer(46));
      cHead.setUint32(0, 0x02014b50, true);
      cHead.setUint16(4, 20, true); cHead.setUint16(6, 20, true); cHead.setUint16(8, 0x0800, true);
      cHead.setUint16(10, 0, true); cHead.setUint16(12, now.t, true); cHead.setUint16(14, now.d, true);
      cHead.setUint32(16, c.crc, true);
      cHead.setUint32(20, c.size, true); cHead.setUint32(24, c.size, true);
      cHead.setUint16(28, c.nameU8.length, true);
      cHead.setUint32(42, c.offset, true);
      cd.push(new Uint8Array(cHead.buffer), c.nameU8);
      cdLen += 46 + c.nameU8.length;
    });
    var eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true);
    eocd.setUint16(8, central.length, true); eocd.setUint16(10, central.length, true);
    eocd.setUint32(12, cdLen, true); eocd.setUint32(16, cdStart, true);
    var all = [];
    parts.forEach(function (p) { all.push(p); });
    cd.forEach(function (p) { all.push(p); });
    all.push(new Uint8Array(eocd.buffer));
    var total = all.reduce(function (n, p) { return n + p.length; }, 0);
    var out = new Uint8Array(total);
    var pos = 0;
    all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  /* ---------- 版式常量（源自范文《以色列研发智能反无人机系统Iron Drone Raider.docx》解构） ---------- */
  var STYLE = {
    pgSz: { w: 11906, h: 16838 },            // A4 纵向
    pgMar: { top: 1440, bottom: 1440, left: 1800, right: 1800, header: 851, footer: 992, gutter: 0 },
    indent: { leftChars: 50, left: 105, firstLineChars: 150, firstLine: 540 },
    title:  { eastAsia: "黑体", ascii: "Times New Roman", hAnsi: "Times New Roman", cs: "Times New Roman", sz: 36 },
    body:   { eastAsia: "仿宋_GB2312", ascii: "Times New Roman", hAnsi: "Times New Roman", cs: "Times New Roman", sz: 32 },
    sign:   { ascii: "楷体_GB2312", eastAsia: "楷体_GB2312", hAnsi: "黑体", cs: "Times New Roman", sz: 32 }
  };

  function xmlEsc(s) {
    return String(s == null ? "" : s)
      .replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/g, "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }

  function runXml(fonts, text) {
    return '<w:r><w:rPr><w:rFonts w:ascii="' + fonts.ascii + '" w:eastAsia="' + fonts.eastAsia +
      '" w:hAnsi="' + fonts.hAnsi + '" w:cs="' + fonts.cs + '" w:hint="eastAsia"/>' +
      '<w:sz w:val="' + fonts.sz + '"/><w:szCs w:val="' + fonts.sz + '"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEsc(text) + "</w:t></w:r>";
  }

  function buildDocumentXml(segs) {
    var runs = "";
    if (segs.title) runs += runXml(STYLE.title, segs.title + " ");
    if (segs.body) runs += runXml(STYLE.body, segs.body);
    if (segs.sign) runs += runXml(STYLE.sign, segs.sign);
    var ind = STYLE.indent;
    var m = STYLE.pgMar, sz = STYLE.pgSz;
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      '<w:p><w:pPr><w:ind w:leftChars="' + ind.leftChars + '" w:left="' + ind.left +
      '" w:firstLineChars="' + ind.firstLineChars + '" w:firstLine="' + ind.firstLine + '"/></w:pPr>' +
      runs + "</w:p>" +
      "<w:p/>" +
      '<w:sectPr><w:pgSz w:w="' + sz.w + '" w:h="' + sz.h + '"/>' +
      '<w:pgMar w:top="' + m.top + '" w:right="' + m.right + '" w:bottom="' + m.bottom +
      '" w:left="' + m.left + '" w:header="' + m.header + '" w:footer="' + m.footer +
      '" w:gutter="' + m.gutter + '"/></w:sectPr>' +
      "</w:body></w:document>";
  }

  function buildDocx(segs) {
    var enc = new TextEncoder();
    var docXml = buildDocumentXml(segs);
    var contentType = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      "</Types>";
    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>";
    return buildZip([
      { name: "[Content_Types].xml", data: enc.encode(contentType) },
      { name: "_rels/.rels", data: enc.encode(rels) },
      { name: "word/document.xml", data: enc.encode(docXml) }
    ]);
  }

  /* ---------- 校验：解回 document.xml 逐项比对版式 ---------- */
  function readZipEntry(blob, target) {
    return blob.arrayBuffer().then(function (ab) {
      var u8 = new Uint8Array(ab);
      var view = new DataView(ab);
      var eocdPos = -1;
      for (var i = u8.length - 22; i >= 0; i--) {
        if (view.getUint32(i, true) === 0x06054b50) { eocdPos = i; break; }
      }
      if (eocdPos < 0) throw new Error("非 zip 文件");
      var count = view.getUint16(eocdPos + 10, true);
      var cdPos = view.getUint32(eocdPos + 16, true);
      var enc = new TextDecoder();
      for (var n = 0; n < count; n++) {
        var p = cdPos;
        var sig = view.getUint32(p, true);
        if (sig !== 0x02014b50) continue;
        var method = view.getUint16(p + 10, true);
        var csize = view.getUint32(p + 20, true);
        var nlen = view.getUint16(p + 28, true);
        var elen = view.getUint16(p + 30, true);
        var clen = view.getUint16(p + 32, true);
        var name = enc.decode(u8.subarray(p + 46, p + 46 + nlen));
        var lho = view.getUint32(p + 42, true);
        if (name === target) {
          var dataStart = lho + 30 + view.getUint16(lho + 26, true) + view.getUint16(lho + 28, true);
          return enc.decode(u8.subarray(dataStart, dataStart + csize));
        }
        cdPos = p + 46 + nlen + elen + clen;
      }
      throw new Error("zip 内找不到 " + target);
    });
  }

  function verifyDocx(blob, expectSign) {
    return readZipEntry(blob, "word/document.xml").then(function (xml) {
      var items = [], ok = true;
      function chk(name, pass, detail) {
        items.push({ name: name, pass: !!pass, detail: detail });
        if (!pass) ok = false;
      }
      chk("A4 页面 11906×16838", /<w:pgSz w:w="11906" w:h="16838"\/>/.test(xml));
      chk("页边距 上1440/下1440/左1800/右1800", /<w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" w:header="851" w:footer="992" w:gutter="0"\/>/.test(xml));
      chk("首行缩进 1.5 字符/540tw & 左缩进 leftChars=50", /w:leftChars="50" w:left="105" w:firstLineChars="150" w:firstLine="540"/.test(xml));
      chk("标题字体：黑体 18pt（sz=36）", /w:eastAsia="黑体"[^>]*\/><w:sz w:val="36"/.test(xml));
      chk("正文字体：仿宋_GB2312 16pt（sz=32）", /w:eastAsia="仿宋_GB2312"[^>]*\/><w:sz w:val="32"/.test(xml));
      chk("供稿署名：楷体_GB2312 16pt", /w:ascii="楷体_GB2312" w:eastAsia="楷体_GB2312"/.test(xml));
      if (expectSign) chk("署名内容存在", xml.indexOf(xmlEsc(expectSign)) >= 0);
      return { ok: ok, items: items };
    });
  }

  window.DOCX = {
    STYLE: STYLE,
    buildDocx: buildDocx,
    verifyDocx: verifyDocx,
    fileName: function (pubDate, zhTitle, enTitle) {
      return H.ymd(new Date(pubDate || Date.now())) + "-" + H.safeFile(zhTitle || enTitle || "学报条目") + ".docx";
    }
  };
})();
