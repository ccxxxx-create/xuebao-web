/* modules/reader.js —— 阅读页 + UI 公共助手（摘要弹窗 / 标题自动翻译触发） */
(function () {
  "use strict";
  var state = { url: "", from: "library", tab: "pair", busyFull: false };

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
    state.url = url; state.from = from || "library"; state.tab = "pair";
    location.hash = "#/reader";
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
        '<button class="btn sm" id="rdFav">' + (a.fav ? "取消收藏" : "收藏") + "</button>" +
        '<button class="btn sm primary" id="rdSum">摘要（中/英）</button>' +
        '<button class="btn sm accent" id="rdFull"' + (a.body ? "" : " disabled") + ">" + fullLabel + "</button>" +
        "</div></div>" +

        '<div class="detail-tabs" style="margin-bottom:12px">' +
        '<button class="' + (state.tab === "pair" ? "active" : "") + '" data-tab="pair">中英对照</button>' +
        '<button class="' + (state.tab === "en" ? "active" : "") + '" data-tab="en">English 原文</button>' +
        '<button class="' + (state.tab === "zh" ? "active" : "") + '" data-tab="zh">中文全文</button>' +
        "</div>" +
        '<div id="rdBody">' + bodyHtml(a) +
        '<div class="art-src">来源：' + esc(a.channelName || a.channel || "") + ' · <a class="muted" href="' + esc(a.url) + '" target="_blank" rel="noopener" title="在浏览器打开原网页">打开原网页 ↗</a></div>' +
        "</div>";

      bind(el, a);

      function bodyHtml(a) {
        var enP = paras(a.body);
        var zhP = paras(a.zhFull);
        if (state.tab === "en") {
          return '<div class="prose" style="max-height:none">' + esc(a.body || "(正文缺失)") + "</div>";
        }
        if (state.tab === "zh") {
          if (a.zhState === "ok") return '<div class="prose" style="max-height:none">' + esc(a.zhFull || "") + "</div>";
          return '<div class="note">尚未翻译全文，点上方「' + fullLabel + '」生成中文全文。</div>';
        }
        // 中英对照
        if (a.zhState === "ok") {
          var n = Math.max(enP.length, zhP.length);
          var rows = "";
          for (var i = 0; i < n; i++) {
            rows += '<tr><td class="pair-en">' + esc(enP[i] || "") + "</td><td class=\"pair-zh\">" + esc(zhP[i] || "") + "</td></tr>";
          }
          return '<div class="note" style="font-size:.9rem">提示：译文按段落大致对齐；个别分段可能存在错位，以原文为准。</div>' +
            '<table class="pair-tbl"><thead><tr><th>English</th><th>中文（AI 翻译）</th></tr></thead><tbody>' + rows + "</tbody></table>";
        }
        var auto = Store.settings.compareAutoFull && LLM.configured();
        return '<div class="note">对照需要中文译文（尚未翻译）。' + (auto ? "" : " 点上方「" + fullLabel + "」翻译全文。") + "</div>" +
          '<table class="pair-tbl"><thead><tr><th>English</th><th>中文</th></tr></thead><tbody>' +
          enP.map(function (p) { return "<tr><td>" + esc(p) + "</td><td></td></tr>"; }).join("") + "</tbody></table>";
      }
      function bind(root, a) {
        root.querySelector("#rdBack").addEventListener("click", function () { location.hash = "#/" + state.from; });
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
        App.refresh();
        Store.getArticle(a.url).then(function (cur) {
          if (cur.zhState === "ok") { cur.zhFull = ""; cur.zhDone = 0; cur.zhState = "none"; }
          return MIRROR.translateFull(cur, {
            onChunk: function () {},
            onState: function (st) {
              state.busyFull = false;
              App.toast(st === "ok" ? (silent ? "全文翻译完成" : "全文翻译完成") : "翻译中断，可续译", st === "ok" ? "ok" : "err");
              App.refresh();
            }
          });
        }).catch(function (err) {
          state.busyFull = false;
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
