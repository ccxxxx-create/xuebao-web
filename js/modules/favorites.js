/* modules/favorites.js —— 收藏夹 v3：点标题进阅读页；卡片展示 AI 摘要（中文+英文） */
(function () {
  "use strict";
  var running = {};

  var M = {
    key: "favorites",
    label: "收藏夹",
    async render(el) {
      var all = await Store.getAllArticles();
      var list = all.filter(function (a) { return a.fav; }).sort(function (x, y) { return String(y.pubDate).localeCompare(String(x.pubDate)); });
      var kws = H.splitKeywords(Store.settings.interestKeywords || "");
      var m = H.isMobile(); // 手机端已移除出刊：隐藏「生成学报 docx」按钮
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">收藏夹</h1>' +
        '<p class="view-sub">收藏 ' + list.length + " 篇 · 点标题阅读；在 设置 → 行为默认值 可开启“收藏后自动生成标题/摘要/全文”</p></div>" +
        '<div class="head-actions"><a class="btn primary" href="#/prefs">我的关键词与喜好设置 ⚙</a></div></div>' +
        '<div id="favList">' + (list.length ? list.map(function (a) { return cardHtml(a, kws); }).join("") : '<div class="empty"><b>还没有收藏</b>在资料库点「收藏」即可加入。</div>') + "</div>";
      bind(el);
      function cardHtml(a, kws) {
        var run = running[a.url];
        var kwr = kws.length ? H.kwScore(kws, a) : null;
        return '<div class="art">' +
          '<div class="art-title" data-url="' + H.esc(a.url) + '" title="点击阅读">' + H.esc(a.titleZh || a.title) + "</div>" +
          (a.titleZh ? '<div class="art-title-en">' + H.esc(a.title) + "</div>" : "") +
          '<div class="art-meta"><span class="badge A">A 官网直采</span>' +
          "<span>" + H.esc(a.channelName || a.channel) + "</span>" +
          "<span>" + H.fmtDay(a.pubDate) + "</span>" +
          (a.zhState === "ok" ? '<span class="badge state-ok">全文已译</span>' : "") +
          (kwr && kwr.score ? H.kwBadge(kwr) : "") +
          "</div>" +
          (a.summaryZh ? '<div class="art-sum" style="border-left-color:#b06a1b"><b>【AI 摘要 · 中文】</b> ' + H.esc(a.summaryZh) + "</div>" : "") +
          (a.summaryEn ? '<div class="art-sum"><b>【AI 摘要 · English】</b> ' + H.esc(a.summaryEn) + "</div>" : "") +
          '<div class="art-actions">' +
          '<button class="btn sm" data-act="unfav" data-url="' + H.esc(a.url) + '">取消收藏</button>' +
          '<button class="btn sm" data-act="sum" data-url="' + H.esc(a.url) + '" title="查看/自动生成摘要">摘要（中/英）</button>' +
          '<button class="btn sm" data-act="full" data-url="' + H.esc(a.url) + '"' + (run ? " disabled" : "") + ">" +
          (a.zhState === "ok" ? "重译全文" : (a.zhFull && a.zhState === "failed") ? "续译全文" : "全文翻译") + "</button>" +
          (!m && a.titleZh ? '<button class="btn sm accent" data-act="journal" data-url="' + H.esc(a.url) + '">生成学报 docx</button>' : "") +
          "</div>" +
          "</div>";
      }
      function bind(el) {
        if (!el.__fav) {
          el.__fav = true;
          el.addEventListener("click", function (e) {
            var title = e.target.closest(".art-title[data-url]");
            if (title) { UI.openArticle(title.dataset.url, "favorites"); return; }
            var btn = e.target.closest("[data-act]");
            if (!btn) return;
            var act = btn.dataset.act, url = btn.dataset.url;
            if (act === "unfav") {
              Store.getArticle(url).then(function (a) {
                a.fav = 0;
                return Store.putArticle(a);
              }).then(function () {
                App.toast("已取消收藏");
                App.refresh();
              });
            }
            else if (act === "sum") window.UI.summaryModal(url);
            else if (act === "full") doFull(url);
            else if (act === "journal") {
              Store.getArticle(url).then(function (a) {
                if (!a.titleZh) { App.toast("标题尚未翻译"); return; }
                window.WB.modules.journal.generateOne(a);
              });
            }
          });
        }
      }
      function doFull(url) {
        if (!LLM.configured()) { App.toast("请先在 设置 → 模型 配置模型"); return; }
        running[url] = true; App.refresh();
        Store.getArticle(url).then(function (a) {
          if (a.zhState === "ok") { a.zhFull = ""; a.zhDone = 0; a.zhState = "none"; }
          return MIRROR.translateFull(a, {
            onChunk: function () {},
            onState: function (st) {
              delete running[url];
              App.toast(st === "ok" ? "全文翻译完成" : "翻译中断，可续译", st === "ok" ? "ok" : "err");
              App.refresh();
            }
          });
        }).catch(function (err) {
          delete running[url];
          App.toast(err && err.message ? err.message : "失败", "err");
          App.refresh();
        });
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  window.WB.modules.favorites = M;
})();
