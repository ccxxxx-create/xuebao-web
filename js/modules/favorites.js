/* modules/favorites.js —— 收藏夹：只显示收藏文章，一键翻译/全文翻译/生成学报/取消收藏 */
(function () {
  "use strict";
  var state = { openUrl: null, zhTab: "zh" };
  var running = {};

  var M = {
    key: "favorites",
    label: "收藏夹",
    async render(el) {
      var all = await Store.getAllArticles();
      var list = all.filter(function (a) { return a.fav; }).sort(function (x, y) { return String(y.pubDate).localeCompare(String(x.pubDate)); });
      var kws = H.splitKeywords(Store.settings.interestKeywords || "");
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">收藏夹</h1>' +
        '<p class="view-sub">收藏 ' + list.length + " 篇 · 可在「设置 → 行为默认值」配置收藏后自动翻译</p></div>" +
        '<div class="head-actions"><a class="btn sm" href="#/settings">自动翻译设置 →</a></div></div>' +
        '<div id="favList">' + listHtml(list) + "</div>";
      bind(el);
      function listHtml(list) {
        if (!list.length) return '<div class="empty"><b>还没有收藏</b>在资料库卡片点「收藏」即可加入这里。</div>';
        return list.map(cardHtml).join("");
      }
      function cardHtml(a) {
        var open = state.openUrl === a.url;
        var run = running[a.url];
        var kwr = kws.length ? H.kwScore(kws, a) : null;
        return '<div class="art" id="fav-' + encodeURIComponent(a.url) + '">' +
          '<div class="art-title" data-act="open" data-url="' + H.esc(a.url) + '">' + H.esc(a.titleZh || a.title) + "</div>" +
          (a.titleZh ? '<div class="art-title-en">' + H.esc(a.title) + "</div>" : "") +
          (a.summaryZh ? '<div class="art-sum">' + H.esc(a.summaryZh) + "</div>" : "") +
          '<div class="art-meta">' +
          '<span class="badge A">A 官网直采</span>' +
          "<span>" + H.esc(a.channelName || a.channel) + "</span>" +
          "<span>" + H.fmtDay(a.pubDate) + "</span>" +
          (a.zhState === "ok" ? '<span class="badge state-ok">全文已译</span>' : "") +
          (a.titleZh ? '<span class="badge state-ok">标题已译</span>' : "") +
          (kwr && kwr.score ? H.kwBadge(kwr) : "") +
          "</div>" +
          '<div class="art-actions">' +
          '<button class="btn sm" data-act="unfav" data-url="' + H.esc(a.url) + '">取消收藏</button>' +
          '<button class="btn sm" data-act="open" data-url="' + H.esc(a.url) + '">' + (open ? "收起" : "阅读") + "</button>" +
          ((!a.titleZh || !a.summaryZh) ? '<button class="btn sm primary" data-act="tr" data-url="' + H.esc(a.url) + '"' + (run || !LLM.configured() ? " disabled" : "") + ">生成标题+摘要</button>" : "") +
          '<button class="btn sm" data-act="full" data-url="' + H.esc(a.url) + '"' + (run ? " disabled" : "") + ">" +
          (a.zhState === "ok" ? "重译全文" : (a.zhState === "running" || (a.zhFull && a.zhState === "failed")) ? "续译全文" : "全文翻译") + "</button>" +
          (a.titleZh ? '<button class="btn sm accent" data-act="journal" data-url="' + H.esc(a.url) + '">生成学报 docx</button>' : "") +
          "</div>" +
          (open ? detailHtml(a, run) : "") +
          "</div>";
      }
      function detailHtml(a, run) {
        var t = state.zhTab;
        return '<div class="detail-body">' +
          '<div class="detail-tabs">' +
          '<button class="' + (t === "zh" ? "active" : "") + '" data-tab="zh" data-url="' + H.esc(a.url) + '">中文（摘要/全文）</button>' +
          '<button class="' + (t === "en" ? "active" : "") + '" data-tab="en" data-url="' + H.esc(a.url) + '">英文原文</button>' +
          "</div>" +
          (t === "zh"
            ? '<div class="field"><label>中文摘要</label><div class="prose" style="max-height:none;background:#fbfcf7">' + H.esc(a.summaryZh || "（尚未生成，点卡片「生成标题+摘要」）") + "</div></div>" +
              '<div class="field"><label>中文全文' + (a.zhState === "ok" ? "" : "（未翻译）") + "</label>" +
              '<div class="prose" style="max-height:none">' + H.esc(a.zhFull || (a.zhState === "failed" ? "翻译中断，可点「续译全文」继续。" : "")) + "</div></div>"
            : '<div class="prose" style="max-height:none">' + H.esc(a.body || "(正文缺失)") + "</div>") +
          (run ? '<div class="note">正在处理…<span class="spin dark"></span></div>' : "") +
          "</div>";
      }
      function bind(el) {
        if (!el.__wbFav) {
          el.__wbFav = true; // 容器级监听只绑定一次，避免事件叠加
          el.addEventListener("click", function (e) {
            var btn = e.target.closest("[data-act]");
            if (!btn) return;
            var act = btn.dataset.act, url = btn.dataset.url;
            if (act === "open") { state.openUrl = state.openUrl === url ? null : url; App.refresh(); }
            else if (act === "unfav") {
              Store.getArticle(url).then(function (a) {
                a.fav = 0;
                return Store.putArticle(a); // 取消收藏：中性操作，不记负反馈
              }).then(function () {
                App.toast("已取消收藏");
                App.refresh();
              });
            }
            else if (act === "tr") doTr(url);
            else if (act === "full") doFull(url);
            else if (act === "journal") {
              Store.getArticle(url).then(function (a) {
                if (!a.titleZh) { App.toast("请先生成标题"); return; }
                window.WB.modules.journal.generateOne(a);
              });
            }
          });
        }
        el.querySelectorAll(".detail-tabs button").forEach(function (b) {
          b.addEventListener("click", function () {
            state.zhTab = b.dataset.tab;
            App.refresh();
          });
        });
      }
      function doTr(url) {
        if (!LLM.configured()) { App.toast("请先在「设置 → 模型」配置模型"); return; }
        running[url] = true; App.refresh();
        Store.getArticle(url).then(function (a) {
          var p = a.titleZh ? MIRROR.translateSummaries([a]) : MIRROR.translateTitles([a]);
          return p.then(function () { delete running[url]; App.toast("标题/摘要已生成"); App.refresh(); });
        }).catch(function (err) {
          delete running[url];
          App.toast(err && err.message ? err.message : "失败", "err");
          App.refresh();
        });
      }
      function doFull(url) {
        if (!LLM.configured()) { App.toast("请先在「设置 → 模型」配置模型"); return; }
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
  M.state = state;
  window.WB.modules.favorites = M;
})();
