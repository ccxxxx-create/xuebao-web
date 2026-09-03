/* modules/reader.js —— 阅读页 + UI 公共助手（摘要弹窗 / 标题自动翻译触发） */
(function () {
  "use strict";
  var state = { url: "", from: "library", tab: "pair", busyFull: false };
  /* 防重复渲染用的翻译进度索引（若在其它页面后台翻译，切回时不清 0） */

  function esc(s) { return H.esc(s); }
  function paras(s) { return String(s || "").split(/\n{2,}/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function cmpMeta(a) {
    return '<span class="badge A">A 官网直采</span>' +
      '<span>' + esc(a.channelName || a.channel) + "</span>" +
      "<span>" + H.fmtDay(a.pubDate) + "</span>" +
      (a.author ? "<span>" + esc(a.author) + "</span>" : "");
  }

  /* 摘要弹窗：查看/生成 中文+英文 摘要（保留已有中文标题，可顺手修正标题） */
  function summaryModal(url) {
    Store.getArticle(url).then(function (a) {
      if (!a) return;
      App.openModal(
        '<div class="modal-head"><h3>摘要（中文 · English）</h3><button class="btn sm" data-close>×</button></div>' +
        '<div class="modal-body">' +
        '<div class="field"><label>中文标题（自动翻译，可微调）</label><input id="smTitle" value="' + esc(a.titleZh || "") + '"></div>' +
        '<div class="field"><label>中文摘要 【AI 生成】</label><textarea id="smZh">' + esc(a.summaryZh || "") + "</textarea></div>" +
        '<div class="field"><label>English Summary 【AI 生成】</label><textarea id="smEn">' + esc(a.summaryEn || "") + "</textarea></div>" +
        '<div class="art-actions">' +
        '<button class="btn primary" id="smGen"' + (LLM.configured() ? "" : " disabled") + ">" + (a.summaryZh || a.summaryEn ? "重新生成摘要（中/英）" : "生成摘要（中/英）") + "</button>" +
        '<button class="btn" id="smSave">保存</button></div>' +
        '<div id="smMsg" class="muted" style="margin-top:6px">' + (LLM.configured() ? "" : "未配置模型：请先在 设置 → 模型 配置。") + "</div>" +
        "</div>"
      );
      var box = document.getElementById("modalBox");
      var msg = box.querySelector("#smMsg");
      box.querySelector("#smGen").addEventListener("click", function () {
        msg.innerHTML = "生成中…<span class='spin dark'></span>";
        MIRROR.summarizeList([a]).then(function () {
          return Store.getArticle(a.url);
        }).then(function (cur) {
          if (cur) {
            box.querySelector("#smZh").value = cur.summaryZh || "";
            box.querySelector("#smEn").value = cur.summaryEn || "";
            if (!box.querySelector("#smTitle").value) box.querySelector("#smTitle").value = cur.titleZh || "";
            a = cur;
          }
          msg.innerHTML = '<span style="color:var(--ok)">摘要已生成，请检查后点「保存」。</span>';
        }).catch(function (err) {
          msg.textContent = (err && err.message) || "生成失败，请重试";
        });
      });
      box.querySelector("#smSave").addEventListener("click", function () {
        a.titleZh = box.querySelector("#smTitle").value.trim();
        a.summaryZh = box.querySelector("#smZh").value.trim();
        a.summaryEn = box.querySelector("#smEn").value.trim();
        if (a.titleZh) a.titleTrans = "ok";
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
  /* PNG 采用 canvas 自绘，按当前 tab 渲染标题栏 + 元信息 + 正文（对照/原文/中文），
     中文/英文混排按字符与占位折行，输出一张纵向长图 */
  function expPNG(a) {
    var c = document.createElement("canvas");
    var ctx = c.getContext("2d");
    var W = 1080, ML = 46, MR = 46;
    var bodyW = W - ML - MR;
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

    var plan = [], y = 72; // 顶部留出品牌带
    function text(font, lh, str, maxW, color, dy) { dy = dy || 0; var ls = wrap(str, maxW, font); plan.push({ t: "text", ls: ls, lh: lh, font: font, color: color, y: y + dy }); y += ls.length * lh + dy; return ls.length; }
    text(titleFont, titleH, title || "(无标题)", bodyW, "#0b3a6e", 8);
    text(metaFont, metaH, meta || a.url || "", bodyW, "#5d6a78", 2);
    y += 6; plan.push({ t: "rule", y: y }); y += 10;

    if (tab === "pair") {
      var colW = (bodyW - 26) / 2, n = Math.max(enP.length, zhP.length);
      for (var i = 0; i < n; i++) {
        var el = wrap(enP[i] || "", colW, pairFont), zl = wrap(zhP[i] || "", colW, pairFont);
        var rc = Math.max(el.length, zl.length);
        plan.push({ t: "pair", en: el, zh: zl, lh: pairH, font: pairFont, y: y });
        y += rc * pairH + 3;
      }
    } else {
      var list = tab === "zh" ? zhP : enP;
      (list.length ? list : ["(正文缺失)"]).forEach(function (p) { text(bodyFont, bodyH, p, bodyW, "#222b35"); });
    }
    y += 8;

    var H = Math.max(140, Math.ceil(y));
    c.width = W; c.height = H;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    // 品牌带
    var g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "#0b3a6e"); g.addColorStop(1, "#2f7fd1");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 72);
    ctx.fillStyle = "#fff"; ctx.font = '700 24px -apple-system,"Microsoft YaHei",sans-serif';
    ctx.fillText("英语情报 · English Insights", ML, 32);
    ctx.font = '16px -apple-system,"Microsoft YaHei",sans-serif';
    ctx.fillStyle = "rgba(255,255,255,.85)";
    var modeLabel = { en: "English 原文", zh: "中文全文", pair: "中英对照" }[tab] || "";
    ctx.fillText("导出 · " + modeLabel, ML, 56);
    ctx.textAlign = "right";
    ctx.fillText(H.ymd && H.ymd() ? H.ymd() : "", W - MR, 40);
    ctx.textAlign = "left";

    plan.forEach(function (p) {
      if (p.t === "rule") { ctx.fillStyle = "#e2e6ea"; ctx.fillRect(ML, p.y, bodyW, 2); return; }
      function line(yy, str, x, maxW, color) {
        ctx.fillStyle = color; ctx.font = p.font;
        ctx.fillText(str, x, yy);
      }
      if (p.t === "pair") {
        p.en.forEach(function (ln, k) { line(p.y + (k + 1) * p.lh, ln, ML, colW, "#1c4d8a"); });
        p.zh.forEach(function (ln, k) { line(p.y + (k + 1) * p.lh, ln, ML + colW + 26, colW, "#222b35"); });
      } else if (p.t === "text") {
        p.ls.forEach(function (ln, k) { line(p.y + (k + 1) * p.lh, ln, ML, bodyW, p.color); });
      }
    });
    // 下载
    var blobUrl = c.toDataURL("image/png");
    var link = document.createElement("a");
    link.href = blobUrl;
    link.download = (a.titleZh ? a.titleZh : a.title).replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40) + "_" + modeLabel + ".png";
    document.body.appendChild(link); link.click(); link.remove();
    App.toast("图片已导出（PNG）", "ok");
  }

  /* PDF：交给浏览器原生打印（当前视图内容保留，只打印正文区），无第三方依赖、可离线 */
  function expPrint() {
    window.print();
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
    box.querySelector("#exLink").addEventListener("click", function () { shareArticle(a); });
    box.querySelector("#exPng").addEventListener("click", function () { App.closeModal(); setTimeout(function () { expPNG(a); }, 50); });
    box.querySelector("#exPdf").addEventListener("click", function () { App.closeModal(); setTimeout(function () { expPrint(); }, 50); });
  }

  var M = {
    key: "reader",
    label: "阅读",
    async render(el) {
      if (!state.url) { App.route("#/library"); return; }
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
        (a.fav ? '<span class="badge" style="background:#fdeee0;color:#b06a1b">收藏</span>' : "") +
        (kwr && kwr.score ? H.kwBadge(kwr) : "") +
        "</div></div>" +
        '<div class="head-actions">' +
        '<button class="btn sm" id="rdBack">← 返回</button>' +
        '<button class="btn sm" id="rdShare" title="分享这篇文章">分享</button>' +
        '<button class="btn sm" id="rdLike" title="喜欢这篇文章（正向反馈）">' + (a.like ? "♥ 已喜欢" : "♡ 喜欢") + "</button>" +
        '<button class="btn sm" id="rdFav">' + (a.fav ? "取消收藏" : "收藏") + "</button>" +
        '<button class="btn sm primary" id="rdSum">摘要（中/英）</button>' +
        '<button class="btn sm accent" id="rdFull"' + (a.body ? "" : " disabled") + ">" + fullLabel + "</button>" +
        "</div></div>" +

        '<div class="detail-tabs" style="margin-bottom:12px">' +
        '<button class="' + (state.tab === "en" ? "active" : "") + '" data-tab="en">English 原文</button>' +
        '<button class="' + (state.tab === "pair" ? "active" : "") + '" data-tab="pair">中英对照</button>' +
        '<button class="' + (state.tab === "zh" ? "active" : "") + '" data-tab="zh">中文全文</button>' +
        "</div>" +
        '<div id="rdBody">' + bodyHtml(a) +
        '<div class="art-src">原文链接：<a class="src-link" href="' + esc(a.url) + '" target="_blank" rel="noopener" title="点击在浏览器打开原文">' + esc(a.url) + "</a></div>" +
        "</div>";

      bind(el, a);

      function bodyHtml(a) {
        // 配图：仅在 英文原文 / 中文全文 界面对应位置显示，中英对照不放图
        var imgUrl = a.image || "";
        var img = imgUrl
          ? '<figure class="art-fig"><img class="art-img" src="' + esc(imgUrl) + '" alt="" loading="lazy" onerror="this.closest(\'.art-fig\').remove()"></figure>'
          : "";
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
          var zhP = Array.isArray(a.zhParas) ? a.zhParas : paras(a.zhFull);
          var rows = enP.map(function (p, i) {
            return '<tr><td class="pair-en">' + esc(p) + '</td><td class="pair-zh">' + esc(zhP[i] || "") + "</td></tr>";
          }).join("");
          return '<table class="pair-tbl"><thead><tr><th>English 原文</th><th>中文（AI 翻译 · 逐段对齐）</th></tr></thead><tbody>' + rows + "</tbody></table>";
        }
        var auto = Store.settings.compareAutoFull && LLM.configured();
        return '<div class="note">对照需要中文译文（尚未翻译）。' + (auto ? "" : " 点上方「" + fullLabel + "」翻译全文。") + "</div>" +
          '<table class="pair-tbl"><thead><tr><th>English</th><th>中文</th></tr></thead><tbody>' +
          paras(a.body).map(function (p) { return "<tr><td>" + esc(p) + "</td><td></td></tr>"; }).join("") + "</tbody></table>";
      }
      function bind(root, a) {
        root.querySelector("#rdBack").addEventListener("click", function () { location.hash = "#/" + state.from; });
        root.querySelector("#rdShare").addEventListener("click", function () { exportModal(a); });
        root.querySelector("#rdLike").addEventListener("click", function () {
          Store.getArticle(a.url).then(function (x) {
            x.like = x.like ? 0 : 1;
            var nowOn = !!x.like;
            return Store.putArticle(x).then(function () {
              if (nowOn) {
                a.like = 1;
                Store.logPreference("like", x.url, x.titleZh || x.title); // 正向学习信号
                App.toast("已喜欢，将提升本类内容权重", "ok");
              } else {
                a.like = 0;
                App.toast("已取消喜欢");
              }
              App.refresh();
            });
          });
        });
        root.querySelector("#rdFav").addEventListener("click", function () {
          Store.getArticle(a.url).then(function (x) {
            x.fav = x.fav ? 0 : 1;
            var nowOn = !!x.fav;
            return Store.putArticle(x).then(function () {
              if (nowOn) { Store.logPreference("fav", x.url, x.titleZh || x.title); window.UI.afterFav(x); }
              else { App.toast("已取消收藏"); App.refresh(); }
            });
          });
        });
        root.querySelector("#rdSum").addEventListener("click", function () { summaryModal(a.url); });
        root.querySelector("#rdFull").addEventListener("click", function () { doFull(a); });
        root.querySelectorAll("[data-tab]").forEach(function (b) {
          b.addEventListener("click", function () {
            state.tab = b.dataset.tab;
            App.refresh();
          });
        });
        // 「中英对照」缺译文且开启自动翻译时后台触发全文翻译；容错不打断渲染
        try {
          if (state.tab === "pair" && a.zhState !== "ok" && Store.settings.compareAutoFull && LLM.configured() && !state.busyFull) {
            state.busyFull = true;
            doFull(a, true);
          }
        } catch (e) { state.busyFull = false; }
      }
      function doFull(a, silent) {
        if (!LLM.configured()) { App.toast("请先在 设置 → 模型 配置模型"); return; }
        if (state.busyFull) { App.toast("正在翻译全文，请稍候"); return; }
        state.busyFull = true;
        var cancelled = false;
        // 进度条弹层：避免用户因看不到进度而反复点击 / 误以为卡死
        App.openModal(
          '<div class="modal-head"><h3>全文翻译</h3>' +
          '<button class="btn sm" id="tfCancel">取消</button>' +
          '<button class="btn sm" data-close disabled style="opacity:.6">×</button></div>' +
          '<div class="modal-body">' +
          '<div class="tf-msg">已译 <b id="tfCur">0</b> / <span id="tfTotal">…</span> 段</div>' +
          '<div class="tf-bar"><div class="tf-fill" id="tfFill" style="width:0%"></div></div>' +
          '<div class="muted" id="tfTip" style="margin-top:8px">正在翻译… 通常每段 1–3 秒，请耐心等待。</div>' +
          "</div>",
          { noClose: true }
        );
        var box = document.getElementById("modalBox");
        var curEl = box.querySelector("#tfCur");
        var totalEl = box.querySelector("#tfTotal");
        var fill = box.querySelector("#tfFill");
        var tip = box.querySelector("#tfTip");
        var cancelBtn = box.querySelector("#tfCancel");
        if (cancelBtn) cancelBtn.addEventListener("click", function () {
          cancelled = true;
          cancelBtn.disabled = true;
          if (tip) tip.textContent = "正在停下，已译内容已保存，可稍后续译…";
        });
        var started = false;
        Store.getArticle(a.url).then(function (cur) {
          if (cur.zhState === "ok") { cur.zhFull = ""; cur.zhParas = []; cur.zhDone = 0; cur.zhState = "none"; }
          return MIRROR.translateFull(cur, {
            onChunk: function (i, total) {
              started = true;
              if (totalEl && total) totalEl.textContent = total;
              if (curEl) curEl.textContent = i;
              if (fill && total) fill.style.width = Math.round(i / total * 100) + "%";
            },
            onState: function (st) {
              state.busyFull = false;
              App.closeModal();
              App.toast(st === "ok" ? "全文翻译完成，已按段落对齐" : "翻译已停下（已译内容已保存）", st === "ok" ? "ok" : "err");
              App.refresh();
            },
            isCancelled: function () { return cancelled; }
          });
        }).catch(function (err) {
          state.busyFull = false;
          App.closeModal();
          App.toast(err && err.message ? err.message : "翻译失败", "err");
          App.refresh();
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
    if (!LLM.configured() || !s.autoTranslate) return Promise.resolve(0);
    var todo = MIRROR.pendingTitles(articles || []);
    if (!todo.length) return Promise.resolve(0);
    return MIRROR.translateTitlesOnly(todo);
  };
  /* 收藏后的自动处理：标题(如缺) → 中/英摘要(按设置) → 全文(按设置) */
  window.UI.afterFav = function (art) {
    var s = Store.settings;
    if (!LLM.configured()) { App.refresh(); return; }
    var chain = Promise.resolve();
    if (!art.titleZh && s.autoTranslate) chain = chain.then(function () { return MIRROR.translateTitlesOnly([art]); });
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
