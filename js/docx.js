/* docx.js —— 浏览器端按范文版式生成 .docx（纯前端最小 ZIP 写入 + 校验）。
   版式（STYLE）支持多模板：内置规范版式 + 用户上传范文 .docx 自动解构（电脑端）。 */
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

  /* 生成/校验时使用哪个版式：style 缺省 = 内置规范版式 */
  function pickStyle(style) {
    if (!style || !style.pgSz || !style.pgMar || !style.title || !style.body) return STYLE;
    return style;
  }

  function xmlEsc(s) {
    return String(s == null ? "" : s)
      .replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/g, "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }

  function runXml(fonts, text) {
    return '<w:r><w:rPr><w:rFonts w:ascii="' + xmlEsc(fonts.ascii) + '" w:eastAsia="' + xmlEsc(fonts.eastAsia) +
      '" w:hAnsi="' + xmlEsc(fonts.hAnsi) + '" w:cs="' + xmlEsc(fonts.cs) + '" w:hint="eastAsia"/>' +
      '<w:sz w:val="' + fonts.sz + '"/><w:szCs w:val="' + fonts.sz + '"/></w:rPr>' +
      '<w:t xml:space="preserve">' + xmlEsc(text) + "</w:t></w:r>";
  }

  function buildDocumentXml(segs, style) {
    var st = pickStyle(style);
    var runs = "";
    if (segs.title) runs += runXml(st.title, segs.title + " ");
    if (segs.body) runs += runXml(st.body, segs.body);
    if (segs.sign) runs += runXml(st.sign, segs.sign);
    var ind = st.indent || STYLE.indent;
    var m = st.pgMar, sz = st.pgSz;
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      '<w:p><w:pPr><w:ind w:leftChars="' + (ind.leftChars | 0) + '" w:left="' + (ind.left | 0) +
      '" w:firstLineChars="' + (ind.firstLineChars | 0) + '" w:firstLine="' + (ind.firstLine | 0) + '"/></w:pPr>' +
      runs + "</w:p>" +
      "<w:p/>" +
      '<w:sectPr><w:pgSz w:w="' + (sz.w | 0) + '" w:h="' + (sz.h | 0) + '"/>' +
      '<w:pgMar w:top="' + (m.top | 0) + '" w:right="' + (m.right | 0) + '" w:bottom="' + (m.bottom | 0) +
      '" w:left="' + (m.left | 0) + '" w:header="' + ((m.header | 0) || 851) + '" w:footer="' + ((m.footer | 0) || 992) +
      '" w:gutter="' + ((m.gutter | 0) || 0) + '"/></w:sectPr>' +
      "</w:body></w:document>";
  }

  function buildDocx(segs, style) {
    var enc = new TextEncoder();
    var docXml = buildDocumentXml(segs, style);
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

  /* ---------- ZIP 读取：支持 STORE(0) 与 DEFLATE(8，浏览器原生 DecompressionStream) ---------- */
  function zipRead(blob, target) {
    return blob.arrayBuffer().then(function (ab) {
      var u8 = new Uint8Array(ab);
      var view = new DataView(ab);
      var eocdPos = -1;
      for (var i = u8.length - 22; i >= 0; i--) {
        if (view.getUint32(i, true) === 0x06054b50) { eocdPos = i; break; }
      }
      if (eocdPos < 0) throw new Error("非 zip/docx 文件");
      var count = view.getUint16(eocdPos + 10, true);
      var cdPos = view.getUint32(eocdPos + 16, true);
      var enc = new TextDecoder();
      for (var n = 0; n < count; n++) {
        var p = cdPos;
        if (view.getUint32(p, true) !== 0x02014b50) break;
        var method = view.getUint16(p + 10, true);
        var csize = view.getUint32(p + 20, true);
        var nlen = view.getUint16(p + 28, true);
        var elen = view.getUint16(p + 30, true);
        var clen = view.getUint16(p + 32, true);
        var name = enc.decode(u8.subarray(p + 46, p + 46 + nlen));
        var lho = view.getUint32(p + 42, true);
        if (name === target) {
          var dataStart = lho + 30 + view.getUint16(lho + 26, true) + view.getUint16(lho + 28, true);
          var raw = u8.subarray(dataStart, dataStart + csize);
          if (method === 0) return raw;
          if (method === 8) {
            if (typeof DecompressionStream === "undefined") {
              throw new Error("当前浏览器不支持解压该 docx，请使用较新的电脑端浏览器");
            }
            return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw")))
              .arrayBuffer().then(function (ab2) { return new Uint8Array(ab2); });
          }
          throw new Error("不支持的压缩方式：" + method);
        }
        cdPos = p + 46 + nlen + elen + clen;
      }
      throw new Error("docx 内找不到 " + target);
    });
  }

  function readZipEntry(blob, target) {
    return zipRead(blob, target).then(function (u8) {
      return new TextDecoder().decode(u8);
    });
  }

  /* ---------- 校验：解回 document.xml 逐项比对版式（按传入版式核对） ---------- */
  function verifyDocx(blob, expectSign, style) {
    var st = pickStyle(style);
    return readZipEntry(blob, "word/document.xml").then(function (xml) {
      var items = [], ok = true;
      function chk(name, pass, detail) {
        items.push({ name: name, pass: !!pass, detail: detail });
        if (!pass) ok = false;
      }
      var m = st.pgMar, sz = st.pgSz, ind = st.indent || STYLE.indent;
      chk("页面 " + sz.w + "×" + sz.h + "（twip）", xml.indexOf('<w:pgSz w:w="' + sz.w + '" w:h="' + sz.h + '"/>') >= 0);
      chk("页边距 上" + m.top + "/下" + m.bottom + "/左" + m.left + "/右" + m.right,
        xml.indexOf('<w:pgMar w:top="' + m.top + '" w:right="' + m.right + '" w:bottom="' + m.bottom +
          '" w:left="' + m.left + '" w:header="' + ((m.header | 0) || 851) + '" w:footer="' + ((m.footer | 0) || 992) +
          '" w:gutter="' + ((m.gutter | 0) || 0) + '"/>') >= 0);
      chk("首行缩进 " + ind.firstLineChars + " 字符/" + ind.firstLine + "tw & 左缩进 leftChars=" + ind.leftChars,
        xml.indexOf('w:leftChars="' + ind.leftChars + '" w:left="' + ind.left + '" w:firstLineChars="' + ind.firstLineChars + '" w:firstLine="' + ind.firstLine + '"') >= 0);
      chk("标题字体：" + st.title.eastAsia + " " + (st.title.sz / 2) + "pt（sz=" + st.title.sz + "）",
        xml.indexOf('w:eastAsia="' + st.title.eastAsia) >= 0 && xml.indexOf('<w:sz w:val="' + st.title.sz + '"/>') >= 0);
      chk("正文字体：" + st.body.eastAsia + " " + (st.body.sz / 2) + "pt（sz=" + st.body.sz + "）",
        xml.indexOf('w:eastAsia="' + st.body.eastAsia) >= 0 && xml.indexOf('<w:sz w:val="' + st.body.sz + '"/>') >= 0);
      chk("供稿署名：" + st.sign.eastAsia,
        xml.indexOf('w:ascii="' + st.sign.ascii + '" w:eastAsia="' + st.sign.eastAsia + '"') >= 0);
      if (expectSign) chk("署名内容存在", xml.indexOf(xmlEsc(expectSign)) >= 0);
      return { ok: ok, items: items };
    });
  }

  /* ---------- 模板解构：上传范文 .docx → 提取版式参数 ---------- */
  function _qa(root, localName) {
    // 命名空间无关的元素查找（w: 前缀在不同解析器下表现不一）；比较统一转小写，
    // 否则 rFonts/sectPr/pgSz 等驼峰标签会全部匹配失败
    var target = String(localName).toLowerCase();
    var out = [];
    var all = root.getElementsByTagName("*");
    for (var i = 0; i < all.length; i++) {
      var nm = (all[i].localName || all[i].nodeName.replace(/^.*:/, "")).toLowerCase();
      if (nm === target) out.push(all[i]);
    }
    return out;
  }
  function _attr(el, name) {
    var v = el.getAttribute("w:" + name);
    if (v == null) v = el.getAttribute(name);
    return v;
  }
  function _int(v, fallback, min, max) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return fallback;
    if (min != null && n < min) return fallback;
    if (max != null && n > max) return fallback;
    return n;
  }

  function extractTemplate(file) {
    return zipRead(file, "word/document.xml").then(function (u8) {
      var xml = new TextDecoder().decode(u8);
      var doc = new DOMParser().parseFromString(xml, "application/xml");
      if (doc.getElementsByTagName("parsererror").length) throw new Error("docx 内容解析失败");

      /* 页面：取 body 级 sectPr（最后一个） */
      var sects = _qa(doc, "sectPr");
      var st = JSON.parse(JSON.stringify(STYLE)); // 从内置版式出发，逐项覆盖
      if (sects.length) {
        var sect = sects[sects.length - 1];
        var pgSz = _qa(sect, "pgSz")[0];
        if (pgSz) {
          st.pgSz.w = _int(_attr(pgSz, "w"), st.pgSz.w, 3000, 30000);
          st.pgSz.h = _int(_attr(pgSz, "h"), st.pgSz.h, 3000, 40000);
        }
        var pgMar = _qa(sect, "pgMar")[0];
        if (pgMar) {
          ["top", "bottom", "left", "right", "header", "footer", "gutter"].forEach(function (k) {
            st.pgMar[k] = _int(_attr(pgMar, k), st.pgMar[k], 0, 8000);
          });
        }
      }

      /* 字体：统计所有带文字的 run 的（eastAsia 字体, 字号），按文字总量取主 */
      var combos = {}; // key -> {eastAsia, ascii, hAnsi, cs, sz, chars}
      _qa(doc, "r").forEach(function (r) {
        var text = "";
        _qa(r, "t").forEach(function (t) { text += t.textContent || ""; });
        text = String(text).trim();
        if (!text) return;
        var fonts = _qa(r, "rFonts")[0];
        var szEl = _qa(r, "sz")[0];
        if (!fonts && !szEl) return;
        var eastAsia = fonts ? (fonts.getAttribute("w:eastAsia") || fonts.getAttribute("w:ascii") || "") : "";
        if (!eastAsia) return;
        var sz = szEl ? _int(szEl.getAttribute("w:val"), 0, 10, 200) : 0;
        if (!sz) return;
        var key = eastAsia + "|" + sz;
        if (!combos[key]) combos[key] = {
          eastAsia: eastAsia,
          ascii: fonts.getAttribute("w:ascii") || eastAsia,
          hAnsi: fonts.getAttribute("w:hAnsi") || eastAsia,
          cs: fonts.getAttribute("w:cs") || eastAsia,
          sz: sz, chars: 0
        };
        combos[key].chars += text.length;
      });
      var list = Object.keys(combos).map(function (k) { return combos[k]; });
      if (list.length) {
        /* 标题：字号最大的组合；正文：文字量最多（且非标题组合） */
        list.sort(function (a, b) { return b.sz - a.sz; });
        st.title = list[0];
        var byChars = list.slice().sort(function (a, b) { return b.chars - a.chars; });
        st.body = (byChars[0] && byChars[0] !== st.title) ? byChars[0] : (byChars[1] || st.body);
        /* 供稿：优先楷体系；没有则沿用正文 */
        var kai = list.filter(function (c) { return /楷体|kaiti/i.test(c.eastAsia); })
          .sort(function (a, b) { return Math.abs(a.sz - st.body.sz) - Math.abs(b.sz - st.body.sz); })[0];
        if (kai) st.sign = kai;
      }

      /* 缩进：取首个带 firstLineChars/leftChars 的 ind */
      var inds = _qa(doc, "ind");
      for (var i = 0; i < inds.length; i++) {
        var flc = _int(_attr(inds[i], "firstLineChars"), 0, 0, 10000);
        var lc = _int(_attr(inds[i], "leftChars"), 0, 0, 10000);
        if (flc || lc) {
          st.indent = {
            leftChars: lc || st.indent.leftChars,
            left: _int(_attr(inds[i], "left"), st.indent.left, 0, 10000),
            firstLineChars: flc || st.indent.firstLineChars,
            firstLine: _int(_attr(inds[i], "firstLine"), st.indent.firstLine, 0, 10000)
          };
          break;
        }
      }
      return st;
    });
  }

  /* ---------- 最小 XLSX（术语表 Excel 导出/导入）：inlineStr 写、兼容真实 Excel 的 sharedStrings 读 ---------- */
  function colLetter(i) {
    var s = "";
    i++;
    while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - 1 - m) / 26; }
    return s;
  }

  function buildXlsx(sheetName, rows) {
    var enc = new TextEncoder();
    var body = "";
    rows.forEach(function (row, r) {
      body += '<row r="' + (r + 1) + '">';
      (row || []).forEach(function (cell, c) {
        var ref = colLetter(c) + (r + 1);
        var v = String(cell == null ? "" : cell);
        if (v === "") { body += '<c r="' + ref + '"/>'; return; }
        body += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v) + "</t></is></c>";
      });
      body += "</row>";
    });
    // 三列常见布局给个舒适列宽
    var widths = rows.length && rows[0].length ? rows[0].length : 3;
    var cols = "<cols>";
    for (var ci = 0; ci < widths; ci++) cols += '<col min="' + (ci + 1) + '" max="' + (ci + 1) + '" width="32" customWidth="1"/>';
    cols += "</cols>";
    var sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + body + "</sheetData>" + cols + "</worksheet>";
    var wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="' + xmlEsc(sheetName) + '" sheetId="1" r:id="rId1"/></sheets></workbook>';
    var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      "</Types>";
    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      "</Relationships>";
    var wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      "</Relationships>";
    return buildZip([
      { name: "[Content_Types].xml", data: enc.encode(ct) },
      { name: "_rels/.rels", data: enc.encode(rels) },
      { name: "xl/workbook.xml", data: enc.encode(wb) },
      { name: "xl/_rels/workbook.xml.rels", data: enc.encode(wbRels) },
      { name: "xl/worksheets/sheet1.xml", data: enc.encode(sheet) }
    ]);
  }

  /* 读取 xlsx 第一个工作表为二维数组（处理 inlineStr / 共享字符串 / 数字三种单元格） */
  function readXlsxRows(file) {
    function cellVal(attrs, inner, shared) {
      var t = (attrs.match(/t="([^"]*)"/) || [])[1] || "";
      if (t === "inlineStr") {
        var m = inner && inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        return m ? m[1] : "";
      }
      var vm = inner && inner.match(/<v[^>]*>([\s\S]*?)<\/v>/);
      if (!vm) return "";
      if (t === "s") { var idx = parseInt(vm[1], 10); return (shared && shared[idx] != null) ? shared[idx] : ""; }
      return vm[1];
    }
    function parseSheet(xml, shared) {
      var rows = [];
      var rowRe = /<row[^>]*?>([\s\S]*?)<\/row>/g, rm;
      while ((rm = rowRe.exec(xml))) {
        var grid = [];
        var cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm;
        while ((cm = cellRe.exec(rm[1]))) {
          var ref = (cm[1].match(/r="([A-Z]+)\d+"/) || [])[1] || "";
          var col = 0;
          for (var i = 0; i < ref.length; i++) col = col * 26 + (ref.charCodeAt(i) - 64);
          grid[col - 1] = cellVal(cm[1], cm[2], shared);
        }
        for (var k = 0; k < grid.length; k++) if (grid[k] == null) grid[k] = "";
        rows.push(grid);
      }
      return rows;
    }
    function parseShared(u8) {
      if (!u8) return [];
      var xml = new TextDecoder().decode(u8);
      var out = [], m, re = /<si[^>]*>([\s\S]*?)<\/si>/g;
      while ((m = re.exec(xml))) {
        var ts = "", tm, tre = /<t[^>]*>([\s\S]*?)<\/t>/g;
        while ((tm = tre.exec(m[1]))) ts += tm[1];
        out.push(ts);
      }
      return out;
    }
    return zipRead(file, "xl/worksheets/sheet1.xml").then(function (sheetU8) {
      var sheet = new TextDecoder().decode(sheetU8);
      return zipRead(file, "xl/sharedStrings.xml").then(function (ssU8) {
        return parseSheet(sheet, parseShared(ssU8));
      }).catch(function () { return parseSheet(sheet, []); });
    });
  }

  window.DOCX = {
    STYLE: STYLE,
    buildDocx: buildDocx,
    verifyDocx: verifyDocx,
    extractTemplate: extractTemplate,
    buildXlsx: buildXlsx,
    readXlsxRows: readXlsxRows,
    fileName: function (pubDate, zhTitle, enTitle) {
      return H.ymd(new Date(pubDate || Date.now())) + "-" + H.safeFile(zhTitle || enTitle || "学报条目") + ".docx";
    }
  };
})();
