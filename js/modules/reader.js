/* modules/reader.js —— 阅读页 + UI 公共助手（摘要弹窗 / 标题自动翻译触发） */
(function () {
  "use strict";
  var state = { url: "", from: "library", tab: "pair" };
  /* 防重复渲染用的翻译进度索引（若在其它页面后台翻译，切回时不清 0） */

  function esc(s) { return H.esc(s); }
  function paras(s) { return String(s || "").split(/\n{2,}/).map(function (x) { return x.trim(); }).filter(Boolean); }
  /* 「提取本篇术语」：以文章为单位，让模型抽出整篇核心军语/科技术语，写入候选（待确认） */
  function parseExtract(text) {
    var out = [];
    String(text || "").split(/\r?\n/).forEach(function (line) {
      var m = line.match(/^\s*(.+?)\s*(?:→|->|:[:：]?|：)\s*(.+?)\s*$/);
      if (!m) return;
      var en = m[1].trim(), zh = m[2].trim();
      if (en && zh && /[a-zA-Z]/.test(en) && !/^\d/.test(zh)) out.push({ en: en, zh: zh });
    });
    return out;
  }
  function collectTerms(a) {
    if (!LLM.configured()) { App.toast("请先在「设置 → 模型」配置模型", "err"); return; }
    if (!a || !a.body) { App.toast("本篇无正文，无法提取术语", "err"); return; }
    App.toast("正在提取本篇术语…");
    LLM.extractTerms(a.title || "", a.body || "").then(function (text) {
      var list = parseExtract(text);
      (list || []).forEach(function (x) { x.source = (a.title || "").slice(0, 40); });
      var n = Store.candAdd(list);
      if (n > 0) { App.toast("已提取 " + n + " 条术语候选，可到「术语库」待确认区采纳", "ok"); }
      else { App.toast("未提取到新术语（与已收录或候选重复）"); }
    }).catch(function (err) { App.toast((err && err.message) || "提取失败", "err"); });
  }
  function cmpMeta(a) {
    return '<span class="badge A">A 官网直采</span>' +
      '<span>' + esc(a.channelName || a.channel) + "</span>" +
      "<span>" + H.fmtDay(a.pubDate) + "</span>" +
      (a.author ? "<span>" + esc(a.author) + "</span>" : "");
  }

  /* 摘要弹窗：打开即自动生成（无需再点「生成摘要」按钮）；可手动微调后保存，
     生成无有效产出时给出明确失败提示并可重试，不再“看似运行实则空白”。 */
  function summaryModal(url) {
    Store.getArticle(url).then(function (a) {
      if (!a) return;
      var empty = !(a.summaryZh || a.summaryEn);
      App.openModal(
        '<div class="modal-head"><h3>摘要（中文 · English）<span class="badge ghost" style="margin-left:10px;font-size:12px">自动生成 · 可微调</span></h3><button class="btn sm" data-close>×</button></div>' +
        '<div class="modal-body sm-body">' +
        '<div class="field"><label class="sm-title">中文标题（自动翻译，可微调）</label><input id="smTitle" value="' + esc(a.titleZh || "") + '"></div>' +
        '<div class="field sm-field"><label><span>中文摘要' + (empty ? '（生成中…）' : '') + '</span><button type="button" class="sm-exp" id="expZh" hidden>▽ 展开全文</button></label><div class="sm-clip" id="clipZh"><textarea id="smZh" class="sm-ta" placeholder="' + (empty ? "正在自动生成…" : "") + '">' + esc(a.summaryZh || "") + "</textarea><div class=\"sm-fade\" id=\"fadeZh\"></div></div></div>" +
        '<div class="field sm-field"><label><span>English Summary' + (empty ? '（生成中…）' : '') + '</span><button type="button" class="sm-exp" id="expEn" hidden>▽ 展开全文</button></label><div class="sm-clip" id="clipEn"><textarea id="smEn" class="sm-ta" placeholder="' + (empty ? "Generating…" : "") + '">' + esc(a.summaryEn || "") + "</textarea><div class=\"sm-fade\" id=\"fadeEn\"></div></div></div>" +
        '<div class="sm-foot"><div class="art-actions">' +
        '<button class="btn primary" id="smSave">保存</button>' +
        '<button class="btn" id="smRegen"' + (LLM.configured() ? "" : " disabled") + ' title="调用模型重新生成中/英摘要">重新生成</button></div>' +
        '<div id="smMsg" class="muted sm-msg">' + (LLM.configured() ? "" : "未配置模型：请先在 设置 → 模型 配置，或直接手动填写后保存。") + "</div></div>" +
        "</div>"
      );
      var box = document.getElementById("modalBox");
      var msg = box.querySelector("#smMsg");
      var saveBtn = box.querySelector("#smSave");
      var regenBtn = box.querySelector("#smRegen");
      /* 文本框：普通长度完整展示；超长折叠预览 + 渐隐遮罩 + 药丸「展开全文」（精致版） */
      var FOLD_H = 300;    // 内容自然高度超过 300px 才折叠
      var PREVIEW_H = 190; // 折叠后预览高度
      function measure(ta) { ta.style.height = "auto"; var h = ta.scrollHeight; ta.style.height = h + "px"; return h; }
      function applyFold(ta, clip, fade, btn) {
        var full = measure(ta);
        if (full > FOLD_H) {
          clip.classList.add("folded"); clip.style.height = PREVIEW_H + "px";
          fade.style.opacity = "1"; if (btn) { btn.hidden = false; btn.innerHTML = "▽ 展开全文"; }
          ta.dataset.fold = "1";
        } else {
          clip.classList.remove("folded"); clip.style.height = full + "px";
          fade.style.opacity = "0"; if (btn) btn.hidden = true;
          ta.dataset.fold = "";
        }
      }
      function toggleFold(ta, clip, fade, btn) {
        var folded = ta.dataset.fold === "1";
        if (folded) {
          clip.classList.remove("folded"); clip.style.height = (ta.scrollHeight) + "px";
          fade.style.opacity = "0"; if (btn) btn.innerHTML = "▲ 收起";
          ta.dataset.fold = "";
        } else {
          clip.classList.add("folded"); clip.style.height = PREVIEW_H + "px";
          fade.style.opacity = "1"; if (btn) btn.innerHTML = "▽ 展开全文";
          ta.dataset.fold = "1";
        }
      }
      var zh = box.querySelector("#smZh"), en = box.querySelector("#smEn");
      var zhClip = box.querySelector("#clipZh"), enClip = box.querySelector("#clipEn");
      var zhFade = box.querySelector("#fadeZh"), enFade = box.querySelector("#fadeEn");
      var expZh = box.querySelector("#expZh"), expEn = box.querySelector("#expEn");
      function applyFolds() { applyFold(zh, zhClip, zhFade, expZh); applyFold(en, enClip, enFade, expEn); }
      if (expZh) expZh.addEventListener("click", function () { toggleFold(zh, zhClip, zhFade, expZh); });
      if (expEn) expEn.addEventListener("click", function () { toggleFold(en, enClip, enFade, expEn); });
      // 输入时：若处展开态则跟随打字增高（不重新折叠，避免跳动）
      [zh, en].forEach(function (ta) {
        if (ta) ta.addEventListener("input", function () {
          if (ta.dataset.fold !== "1") { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }
        });
      });
      function fill(cur) {
        box.querySelector("#smZh").value = cur.summaryZh || "";
        box.querySelector("#smEn").value = cur.summaryEn || "";
        if (!box.querySelector("#smTitle").value) box.querySelector("#smTitle").value = cur.titleZh || "";
        applyFolds();
      }
      function runGen() {
        regenBtn.disabled = true; saveBtn.disabled = true;
        msg.innerHTML = "正在生成摘要…<span class='spin dark'></span>";
        MIRROR.summarizeList([a]).then(function () {
          return Store.getArticle(a.url);
        }).then(function (cur) {
          regenBtn.disabled = false; saveBtn.disabled = false;
          if (cur) {
            a = cur;
            fill(cur);
            if (cur.summaryZh || cur.summaryEn) {
              msg.innerHTML = '<span style="color:var(--ok,#0b5f55)">摘要已生成。可微调后点「保存」；想再生成可点「重新生成」。</span>';
            } else {
              msg.innerHTML = '<span style="color:var(--bad,#c0392b)">本次生成没有有效产出（模型可能未按要求返回内容）。可点「重新生成」再试，或直接手动填写后保存。</span>';
            }
          } else {
            msg.innerHTML = '<span style="color:var(--bad,#c0392b)">未取到文章，生成失败。</span>';
          }
        }).catch(function (err) {
          regenBtn.disabled = false; saveBtn.disabled = false;
          msg.innerHTML = '<span style="color:var(--bad,#c0392b)">生成失败：' + esc((err && err.message) || "请重试") + "。可点「重新生成」再试，或手动填写后保存。</span>";
        });
      }
      // 摘要缺失 → 打开弹窗即自动生成；已有内容则立即应用折叠/展开
      if (LLM.configured() && empty) runGen(); else applyFolds();
      regenBtn.addEventListener("click", runGen);
      saveBtn.addEventListener("click", function () {
        a.titleZh = box.querySelector("#smTitle").value.trim();
        a.summaryZh = box.querySelector("#smZh").value.trim();
        a.summaryEn = box.querySelector("#smEn").value.trim();
        if (a.titleZh) a.titleTrans = "ok";
        a.summaryFail = 0;
        Store.putArticle(a).then(function () {
          App.closeModal();
          App.toast("摘要已保存", "ok");
          App.refresh();
        });
      });
    });
  }

  function openArticle(url, from) {
    state.url = url; state.from = from || "library";
    // 从资料库进入优先看英文原文；其它入口（收藏夹/榜单）默认中英对照
    state.tab = from === "library" ? "en" : "pair";
    location.hash = "#/reader";
  }

  /* 分享文章：优先系统分享（平板/手机），否则复制 链接+标题 到剪贴板 */
  function copyText(txt, okMsg) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () {
        App.toast(okMsg || "已复制到剪贴板", "ok");
      }).catch(function () { fallback(); App.toast(okMsg || "已复制到剪贴板", "ok"); });
    } else { fallback(); App.toast(okMsg || "已复制到剪贴板", "ok"); }
  }
  function shareArticle(a) {
    if (!a) return;
    var t = (a.titleZh && a.titleZh !== a.title) ? a.titleZh + " / " + a.title : (a.titleZh || a.title);
    var text = t + "（" + (a.channelName || a.channel || "") + " · " + H.fmtDay(a.pubDate) + "）";
    if (navigator.share) {
      navigator.share({ title: t, text: text, url: a.url }).catch(function () {});
      return;
    }
    copyText(a.url + "\n" + text, "已复制原文链接与标题");
  }

  /* —— 导出：把当前视图存成 图片PNG / PDF ——（非网页链接形式分享详情页界面） */
  var EXP_W = 1080, EXP_ML = 46, EXP_MR = 46;

  /* 导出排版：按当前 tab 计算标题栏 + 元信息 + 正文，产出逐行 plan（每行独立 y 坐标）。
     PNG 长图与 PDF 分页共用同一布局，保证两个导出内容一致。 */
  function buildExportPlan(a) {
    var c = document.createElement("canvas");
    var ctx = c.getContext("2d");
    var bodyW = EXP_W - EXP_ML - EXP_MR;
    var tab = state.tab;
    var enP = paras(a.body);
    var zhP = Array.isArray(a.zhParas) ? a.zhParas : paras(a.zhFull);
    var title = (a.titleZh && a.titleZh !== a.title) ? a.titleZh + " / " + a.title : (a.titleZh || a.title);
    var meta = [(a.channelName || a.channel), H.fmtDay(a.pubDate), a.author].filter(Boolean).join(" · ");
    var titleFont = '700 34px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif';
    var metaFont = '20px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif';
    var bodyFont = '22px "Georgia","Palatino",-apple-system,"Microsoft YaHei",serif';
    var pairFont = '20px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif';
    var titleH = 46, metaH = 28, bodyH = 34, pairH = 30;

    function wrap(s, maxW, font) {
      ctx.font = font;
      var out = [], buf = "";
      // 含中文按“字符级”折行；纯拉丁按“单词级”折行，避免单词被腰斩
      var cjk = /[\u3040-\u30ff\u3400-\u9fff]/.test(s);
      if (!cjk) {
        var words = String(s).split(/\s+/).filter(String);
        var line = "";
        words.forEach(function (w) {
          var t = line ? line + " " + w : w;
          if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; }
          else line = t;
        });
        if (line) out.push(line);
        return out;
      }
      for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i), t2 = buf + ch;
        if (ctx.measureText(t2).width > maxW && buf) { out.push(buf); buf = ch; }
        else buf = t2;
      }
      if (buf) out.push(buf);
      return out;
    }

    var lines = [], y = 72; // 顶部留出品牌带
    function text(font, lh, str, maxW, color, dy) {
      dy = dy || 0;
      var ls = wrap(str, maxW, font);
      ls.forEach(function (ln, k) { lines.push({ y: y + dy + (k + 1) * lh, font: font, color: color, x: EXP_ML, w: maxW, text: ln }); });
      y += ls.length * lh + dy;
    }
    text(titleFont, titleH, title || "(无标题)", bodyW, "#0b3a6e", 8);
    text(metaFont, metaH, meta || a.url || "", bodyW, "#5d6a78", 2);
    y += 6; lines.push({ rule: true, y: y }); y += 10;

    if (tab === "pair") {
      var colW = (bodyW - 26) / 2, n = Math.max(enP.length, zhP.length);
      for (var i = 0; i < n; i++) {
        var el = wrap(enP[i] || "", colW, pairFont), zl = wrap(zhP[i] || "", colW, pairFont);
        el.forEach(function (ln, k) { lines.push({ y: y + (k + 1) * pairH, font: pairFont, color: "#1c4d8a", x: EXP_ML, w: colW, text: ln }); });
        zl.forEach(function (ln, k) { lines.push({ y: y + (k + 1) * pairH, font: pairFont, color: "#222b35", x: EXP_ML + colW + 26, w: colW, text: ln }); });
        y += Math.max(el.length, zl.length) * pairH + 3;
      }
    } else {
      var list = tab === "zh" ? zhP : enP;
      (list.length ? list : ["(正文缺失)"]).forEach(function (p) { text(bodyFont, bodyH, p, bodyW, "#222b35"); });
    }
    y += 8;
    return { lines: lines, total: Math.max(140, Math.ceil(y)), tab: tab };
  }

  /* 在画布上绘制（长图整幅或 PDF 某一页），ctx 已按页顶平移，clip 负责裁掉出界内容 */
  function paintExport(ctx, plan, modeLabel) {
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, EXP_W, plan.total);
    // 品牌带（长图/PDF 首页可见）
    var g = ctx.createLinearGradient(0, 0, EXP_W, 0);
    g.addColorStop(0, "#0b3a6e"); g.addColorStop(1, "#2f7fd1");
    ctx.fillStyle = g; ctx.fillRect(0, 0, EXP_W, 72);
    ctx.fillStyle = "#fff"; ctx.font = '700 24px -apple-system,"Microsoft YaHei",sans-serif';
    ctx.fillText("SENTRA 述势 · English Insights", EXP_ML, 32);
    ctx.font = '16px -apple-system,"Microsoft YaHei",sans-serif';
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.fillText("导出 · " + modeLabel, EXP_ML, 56);
    ctx.textAlign = "right";
    ctx.fillText(H.ymd && H.ymd() ? H.ymd() : "", EXP_W - EXP_MR, 40);
    ctx.textAlign = "left";
    plan.lines.forEach(function (p) {
      if (p.rule) { ctx.fillStyle = "#e2e6ea"; ctx.fillRect(EXP_ML, p.y, EXP_W - EXP_ML - EXP_MR, 2); return; }
      ctx.fillStyle = p.color; ctx.font = p.font;
      ctx.fillText(p.text, p.x, p.y);
    });
  }

  function modeLabelOf(tab) {
    return { en: "English 原文", zh: "中文全文", pair: "中英对照" }[tab] || "";
  }
  function expFileName(a, ext) {
    return (a.titleZh ? a.titleZh : a.title).replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40) + "_" + modeLabelOf(state.tab) + "." + ext;
  }
  function dataUrlToBlob(u) {
    var parts = u.split(",");
    var mime = (parts[0].match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
    var bin = atob(parts[1]);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  /* 统一投递：移动端优先系统分享（可存相册/文件），取消不打扰，失败或不可用回退下载。
     File 构造在部分安卓 WebView 缺失，整体包 try 兜底。 */
  function deliverFile(blob, name, okMsg, mime) {
    function tryDownload() {
      var link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = name;
      document.body.appendChild(link); link.click();
      setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 800);
      App.toast(okMsg, "ok");
    }
    try {
      if (navigator.canShare && navigator.share && window.File) {
        var file = new File([blob], name, { type: mime || blob.type || "application/octet-stream" });
        if (navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: name }).then(function () {
            App.toast("已通过系统分享保存", "ok");
          }).catch(function (e) {
            if (e && e.name === "AbortError") return; // 用户主动取消，不打扰
            tryDownload();
          });
          return;
        }
      }
      tryDownload();
    } catch (e) {
      tryDownload();
    }
  }

  function expPNG(a) {
    var plan = buildExportPlan(a);
    var c = document.createElement("canvas");
    c.width = EXP_W; c.height = plan.total;
    paintExport(c.getContext("2d"), plan, modeLabelOf(state.tab));
    var name = expFileName(a, "png");
    var blob = dataUrlToBlob(c.toDataURL("image/png"));
    deliverFile(blob, name, "图片已保存（PNG）", "image/png");
  }

  /* PDF（移动端）：window.print 在多数手机浏览器无效果，这里真实生成 .pdf 文件——
     正文按 A4 比例分页绘制成图页，再打包为最小 PDF（JPEG/DCTDecode），无第三方依赖、可离线。 */
  function buildPdf(pagesJpeg, imgW, imgH) {
    var wPt = 595.28, hPt = 841.89; // A4
    var enc = new TextEncoder();
    function s8(s) { return enc.encode(s); }
    function b64u8(b64) {
      var bin = atob(b64);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return arr;
    }
    var chunks = [], offsets = [], pos = 0;
    function push(u8) { chunks.push(u8); pos += u8.length; }
    /* 流对象：编号取自当前 offsets 长度（1 起算），紧随 push 顺序分配 */
    function streamObj(bodyArr, dict) {
      offsets.push(pos);
      push(s8((offsets.length) + " 0 obj\n" + dict + "\nstream\n"));
      push(bodyArr);
      push(s8("\nendstream\nendobj\n"));
    }
    push(s8("%PDF-1.4\n"));
    var n = pagesJpeg.length;
    var kids = [];
    for (var i = 0; i < n; i++) kids.push((3 + i * 3) + " 0 R");
    // 1 Catalog, 2 Pages，其后每页 3 个对象：Page / Image / Contents
    offsets.push(pos); push(s8("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"));
    offsets.push(pos); push(s8("2 0 obj\n<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + n + " >>\nendobj\n"));
    for (var p = 0; p < n; p++) {
      var pageNo = 3 + p * 3, imgNo = pageNo + 1, cntNo = pageNo + 2;
      var imgName = "Im" + p;
      var imgBytes = b64u8(pagesJpeg[p]);
      offsets.push(pos);
      push(s8(pageNo + " 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + wPt + " " + hPt +
        "] /Resources << /XObject << /" + imgName + " " + imgNo + " 0 R >> /ProcSet [/PDF /ImageC] >> /Contents " + cntNo + " 0 R >>\nendobj\n"));
      streamObj(imgBytes, "<< /Type /XObject /Subtype /Image /Width " + imgW + " /Height " + imgH +
        " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + imgBytes.length + " >>");
      var stream = s8("q " + wPt + " 0 0 " + hPt + " 0 0 cm /" + imgName + " Do Q");
      offsets.push(pos);
      push(s8(cntNo + " 0 obj\n<< /Length " + stream.length + " >>\nstream\n"));
      push(stream);
      push(s8("\nendstream\nendobj\n"));
    }
    var xrefPos = pos;
    var cnt = offsets.length + 1;
    var xref = "xref\n0 " + cnt + "\n0000000000 65535 f \n";
    offsets.forEach(function (o) { xref += ("0000000000" + o).slice(-10) + " 00000 n \n"; });
    xref += "trailer\n<< /Size " + cnt + " /Root 1 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF";
    push(s8(xref));
    var total = chunks.reduce(function (s2, c2) { return s2 + c2.length; }, 0);
    var out = new Uint8Array(total);
    var off = 0;
    chunks.forEach(function (c2) { out.set(c2, off); off += c2.length; });
    return out;
  }

  function expPDFFile(a) {
    var plan = buildExportPlan(a);
    var pageH = Math.round(EXP_W * 297 / 210); // A4 纵向比例
    var pageCount = Math.max(1, Math.ceil(plan.total / pageH));
    var jpegs = [];
    for (var i = 0; i < pageCount; i++) {
      var c = document.createElement("canvas");
      c.width = EXP_W; c.height = pageH;
      var ctx = c.getContext("2d");
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, EXP_W, pageH); ctx.clip();
      ctx.translate(0, -i * pageH);
      paintExport(ctx, plan, modeLabelOf(state.tab));
      ctx.restore();
      jpegs.push(c.toDataURL("image/jpeg", 0.92).split(",")[1]);
    }
    var u8 = buildPdf(jpegs, EXP_W, pageH);
    var name = expFileName(a, "pdf");
    deliverFile(new Blob([u8], { type: "application/pdf" }), name, "PDF 已保存", "application/pdf");
  }

  /* PDF：桌面/平板用浏览器原生打印（文本可选、无第三方依赖）；手机端生成真实 PDF 文件 */
  function expPrint() {
    window.print();
  }
  function expPDF(a) {
    if (H.isMobile() || !window.print) expPDFFile(a);
    else expPrint();
  }

  /* 分享/导出菜单：复制链接 / PNG 图片 / PDF */
  function exportModal(a) {
    App.openModal(
      '<div class="modal-head"><h3>分享 / 导出</h3><button class="btn sm" data-close>×</button></div>' +
      '<div class="modal-body">' +
      '<p class="muted" style="margin-bottom:12px">当前视图：<b>' +
      ({ en: "English 原文", zh: "中文全文", pair: "中英对照" }[state.tab] || state.tab) + "</b>，可下载为图片或 PDF，也可复制网页链接。</p>" +
      '<button class="btn block" id="exLink">复制原文链接</button>' +
      '<button class="btn block" id="exPng" style="margin-top:8px">导出为图片（PNG）</button>' +
      '<button class="btn block primary" id="exPdf" style="margin-top:8px">导出为 PDF</button>' +
      "</div>"
    );
    var box = document.getElementById("modalBox");
    function safe(fn) {
      return function () {
        try { fn(); } catch (e) {
          App.toast("导出失败：" + (e && e.message ? e.message : "当前浏览器不支持，请换系统浏览器尝试"), "err");
        }
      };
    }
    box.querySelector("#exLink").addEventListener("click", function () { shareArticle(a); });
    box.querySelector("#exPng").addEventListener("click", safe(function () { App.closeModal(); setTimeout(function () { expPNG(a); }, 50); }));
    box.querySelector("#exPdf").addEventListener("click", safe(function () { App.closeModal(); setTimeout(function () { expPDF(a); }, 50); }));
  }

  var M = {
    key: "reader",
    label: "阅读",
    async render(el) {
      if (!state.url) { App.route("#/library"); return; }
      el.classList.add("reader-mode"); // 供 CSS 区分阅读页（移动端隐藏顶部按钮、显示底部操作栏）
      var a = await Store.getArticle(state.url);
      if (!a) {
        el.innerHTML = '<div class="empty"><b>文章不存在或已清理</b><br><a class="btn sm" href="#/' + state.from + '">返回' + (state.from === "favorites" ? "收藏夹" : "资料库") + "</a></div>";
        return;
      }
      var kws = H.splitKeywords(Store.settings.interestKeywords || "");
      var kwr = kws.length ? H.kwScore(kws, a) : null;
      var fullLabel = a.zhState === "ok" ? "重译全文" : ((a.zhFull && a.zhState === "failed") ? "续译全文" : "翻译全文");
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">' + esc(a.titleZh || a.title) + "</h1>" +
        (a.titleZh && a.titleZh !== a.title ? '<p class="view-sub" style="margin-top:6px">' + esc(a.title) + "</p>" : "") +
        '<div class="art-meta" style="margin-top:8px">' + cmpMeta(a) +
        (a.fav ? '<span class="badge" style="background:var(--warn-weak);color:var(--warn)">收藏</span>' : "") +
        (kwr && kwr.score ? H.kwBadge(kwr) : "") +
        "</div></div>" +
        '<div class="head-actions">' +
        '<button class="btn sm" id="rdBack">← 返回</button>' +
        '<button class="btn sm" id="rdShare" title="分享这篇文章">分享</button>' +
        '<button class="btn sm" id="rdLike" title="喜欢这篇文章（正向反馈）">' + (a.like ? "♥ 已喜欢" : "♡ 喜欢") + "</button>" +
        '<button class="btn sm" id="rdFav">' + (a.fav ? "取消收藏" : "收藏") + "</button>" +
        '<button class="btn sm primary" id="rdSum">摘要（中/英）</button>' +
        '<button class="btn sm" id="rdTerms" title="提取本篇核心军语/科技术语进候选（以整篇文章为单位）">提取术语</button>' +
        '<button class="btn sm accent" id="rdFull"' + (a.body ? "" : " disabled") + ">" + fullLabel + "</button>" +
        "</div></div>" +

        '<div class="detail-tabs" style="margin-bottom:12px">' +
        '<button class="' + (state.tab === "en" ? "active" : "") + '" data-tab="en">English 原文</button>' +
        '<button class="' + (state.tab === "pair" ? "active" : "") + '" data-tab="pair">中英对照</button>' +
        '<button class="' + (state.tab === "zh" ? "active" : "") + '" data-tab="zh">中文全文</button>' +
        "</div>" +
        '<div id="rdBody">' + bodyHtml(a) +
        '<div class="art-src">原文链接：<a class="src-link" href="' + esc(a.url) + '" target="_blank" rel="noopener" title="点击在浏览器打开原文">' + esc(a.url) + "</a></div>" +
        "</div>" +
        '<div class="rd-mobilebar">' +
        '<button class="btn sm" id="rdBack" title="返回">' + backIcon() + "</button>" +
        '<button class="btn sm" id="rdShare" title="分享这篇文章">' + icon("share") + "</button>" +
        '<button class="btn sm" id="rdLike" title="喜欢这篇文章（正向反馈）">' + icon("like", a.like) + "</button>" +
        '<button class="btn sm" id="rdFav" title="' + (a.fav ? "取消收藏" : "收藏") + '">' + icon("fav", a.fav) + "</button>" +
        '<button class="btn sm primary" id="rdSum" title="摘要（中/英）">' + icon("sum") + "</button>" +
        // 手机端不做「提取术语」（反复提取再确认太重）：手机定位为看新闻的阅读端，术语库内置即用
        (H.isMobile() ? "" : '<button class="btn sm" id="rdTerms" title="提取本篇核心军语/科技术语进候选（以整篇文章为单位）">' + icon("terms") + "</button>") +
        '<button class="btn sm accent" id="rdFull"' + (a.body ? "" : " disabled") + " title=\"" + H.esc(fullLabel || "翻译全文") + '">' + icon("full") + "</button>" +
        "</div>";

      function backIcon() { return '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>'; }
      function icon(k, on) {
        var s = {
          share: '<svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
          like: on ? '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
                   : '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
          fav: on ? '<svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>'
                 : '<svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
          sum: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
          terms: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
          full: '<svg viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>'
        };
        return s[k] || "";
      }

      bind(el, a);

      function bodyHtml(a) {
        // 仅保留文字正文（用户明确不抓图片）；不再渲染配图
        var img = "";
        if (state.tab === "en") {
          return '<div class="prose" style="max-height:none">' + img + esc(a.body || "(正文缺失)") + "</div>";
        }
        if (state.tab === "zh") {
          if (a.zhState === "ok") return '<div class="prose" style="max-height:none">' + img + esc(a.zhFull || "") + "</div>";
          return '<div class="note">尚未翻译全文，点上方「' + fullLabel + '」生成中文全文。</div>';
        }
        // 中英对照：按原文段落逐段精确对齐（zhParas[i] 与枚举出的英文段一一对应，杜绝错位）
        if (a.zhState === "ok") {
          var enP = paras(a.body);
          // 旧译文（v1.6.3 之前翻译）没有逐段 zhParas 数据，检测到则提示重新翻译以逐段对齐
          var hasPairs = Array.isArray(a.zhParas) && a.zhParas.length === enP.length &&
            a.zhParas.every(function (s) { return !!String(s || "").trim(); });
          var zhP = hasPairs ? a.zhParas : paras(a.zhFull); // 旧译文按空行尽力配对，仍展示但标注提示
          var legacyWarn = hasPairs ? "" :
            '<div class="legacy-warn"><b>此篇为旧版译文</b>，段落可能未逐段对齐。' +
            '点下方「重新翻译全文」即可按原文段落一一对应（翻译时会显示进度条）。' +
            '<button class="btn sm primary" id="rgReTr" type="button">重新翻译全文（逐段对齐）</button></div>';
          var rows = enP.map(function (p, i) {
            return '<tr><td class="pair-en">' + esc(p) + '</td><td class="pair-zh">' + esc(zhP[i] || "") + "</td></tr>";
          }).join("");
          return legacyWarn + '<table class="pair-tbl"><thead><tr><th>English 原文</th><th>中文（AI 翻译 · 逐段对齐）</th></tr></thead><tbody>' + rows + "</tbody></table>";
        }
        var auto = Store.settings.compareAutoFull && LLM.configured();
        return '<div class="note">对照需要中文译文（尚未翻译）。' + (auto ? "" : " 点上方「" + fullLabel + "」翻译全文。") + "</div>" +
          '<table class="pair-tbl"><thead><tr><th>English</th><th>中文</th></tr></thead><tbody>' +
          paras(a.body).map(function (p) { return "<tr><td>" + esc(p) + "</td><td></td></tr>"; }).join("") + "</tbody></table>";
      }
      function bind(root, a) {
        function on(sel, fn) { root.querySelectorAll(sel).forEach(fn); }
        on("#rdBack", function (b) { b.addEventListener("click", function () { location.hash = "#/" + state.from; }); });
        on("#rdShare", function (b) { b.addEventListener("click", function () { exportModal(a); }); });
        on("#rdLike", function (b) {
          b.addEventListener("click", function () {
            Store.getArticle(a.url).then(function (x) {
              x.like = x.like ? 0 : 1;
              var nowOn = !!x.like;
              return Store.putArticle(x).then(function () {
                if (nowOn) {
                  a.like = 1;
                  Store.logPreference("like", x.url, x.titleZh || x.title); // 正向学习信号（静默记录，不打扰）
                  App.petReact("happy");   // 宠物开心一下
                } else {
                  a.like = 0;
                }
                App.refresh();
              });
            });
          });
        });
        on("#rdFav", function (b) {
          b.addEventListener("click", function () {
            Store.getArticle(a.url).then(function (x) {
              x.fav = x.fav ? 0 : 1;
              var nowOn = !!x.fav;
              return Store.putArticle(x).then(function () {
                if (nowOn) {
                  Store.logPreference("fav", x.url, x.titleZh || x.title);
                  App.toast("已收藏", "ok");
                  App.petReact("happy");
                  window.UI.afterFav(x);
                } else {
                  App.toast("已取消收藏");
                  App.refresh();
                }
              });
            });
          });
        });
        on("#rdSum", function (b) { b.addEventListener("click", function () { summaryModal(a.url); }); });
        on("#rdTerms", function (b) { b.addEventListener("click", function () { collectTerms(a); }); });
        on("#rdFull", function (b) { b.addEventListener("click", function () { doFull(a); }); });
        // 旧译文提示条中的「重新翻译全文」按钮（文内元素在 bodyHtml 里渲染）
        on("#rgReTr", function (b) { b.addEventListener("click", function () { doFull(a); }); });
        root.querySelectorAll("[data-tab]").forEach(function (b) {
          b.addEventListener("click", function () {
            state.tab = b.dataset.tab;
            App.refresh();
          });
        });
        // 「中英对照」缺译文且开启自动翻译时后台触发全文翻译；容错不打断渲染
        try {
          if (state.tab === "pair" && a.zhState !== "ok" && Store.settings.compareAutoFull && LLM.configured() && !MIRROR.hasFull(a.url)) {
            doFull(a, true);
          }
        } catch (e) {}
      }
      /* 全文翻译：提交后台调度器即返回，进度与取消由右下角任务栏接管（多篇可并行、可后台、文内保序） */
      function doFull(a, silent) {
        if (!LLM.configured()) { App.toast("请先在 设置 → 模型 配置模型"); return; }
        if (MIRROR.hasFull(a.url)) { if (!silent) App.toast("该文章已在后台翻译中", "ok"); return; }
        Store.getArticle(a.url).then(function (cur) {
          if (cur.zhState === "ok") { cur.zhFull = ""; cur.zhParas = []; cur.zhDone = 0; cur.zhState = "none"; }
          return MIRROR.submitFull(cur);
        }).catch(function (err) {
          var m = (err && err.message) || "提交全文翻译失败，请重试";
          if (m.indexOf("已在翻译中") >= 0) { if (!silent) App.toast(m, "ok"); return; }
          App.toast(m, "err");
        });
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  M.state = state;
  window.WB.modules.reader = M;
  window.UI = window.UI || {};
  window.UI.summaryModal = summaryModal;
  window.UI.openArticle = openArticle;
  window.UI.ensureAutoTitles = function (articles) {
    var s = Store.settings;
    if (!LLM.configured() || !s.autoTitleTr) return Promise.resolve(0);
    var todo = MIRROR.pendingTitles(articles || []);
    if (!todo.length) return Promise.resolve(0);
    return MIRROR.translateTitlesOnly(todo);
  };
  /* 收藏后的自动处理：标题(如缺) → 中/英摘要(按设置) → 全文(按设置) */
  window.UI.afterFav = function (art) {
    var s = Store.settings;
    if (!LLM.configured()) { App.refresh(); return; }
    var chain = Promise.resolve();
    if (!art.titleZh && s.favAutoTr) chain = chain.then(function () { return MIRROR.translateTitlesOnly([art]); });
    if (s.favAutoTr) chain = chain.then(function () {
      return Store.getArticle(art.url).then(function (cur) {
        if (cur && (!cur.summaryZh || !cur.summaryEn)) return MIRROR.summarizeList([cur]);
      });
    });
    if (s.favAutoFull) chain = chain.then(function () {
      return Store.getArticle(art.url).then(function (cur) {
        if (cur && cur.body && cur.zhState !== "ok") {
          return MIRROR.translateFull(cur, { onState: function () {} });
        }
      });
    });
    chain.then(function () {
      App.toast("收藏已更新，自动处理完成", "ok");
      App.refresh();
    }).catch(function (err) {
      App.toast("收藏已更新（自动处理中断：" + ((err && err.message) || err) + "）", "err");
      App.refresh();
    });
  };
})();
