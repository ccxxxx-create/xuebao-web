/* modules/library.js —— 资料库：检索（来源/日期/关键词/状态/收藏）、双语卡片、详情全文、翻译/选文/收藏 */
(function () {
  "use strict";

  var state = { q: "", channel: "", trans: "", favOnly: false, selectedOnly: false, from: "", to: "", sort: "time", openUrl: null, zhTab: "zh" };
  var running = {};

  function artStateBadge(a) {
    var out = [];
    if (a.selected) out.push('<span class="badge blue">已选</span>');
    if (a.fav) out.push('<span class="badge" style="background:#fdeee0;color:#b06a1b">收藏</span>');
    if (a.titleZh) out.push('<span class="badge state-ok">标题已译</span>');
    else if (a.titleTrans === "failed") out.push('<span class="badge state-error">翻译失败</span>');
    else if (a.titleTrans === "pending") out.push('<span class="badge ghost">标题待译</span>');
    if (a.zhState === "ok") out.push('<span class="badge state-ok">全文已译</span>');
    else if (a.zhState === "running") out.push('<span class="badge state-degraded">全文翻译中</span>');
    else if (a.zhState === "failed") out.push('<span class="badge state-error">全文翻译中断</span>');
    return out.join(" ");
  }

  var M = {
    key: "library",
    label: "资料库",
    async render(el) {
      var all = await Store.getAllArticles();
      var terms = await Store.getAllTerms();
      var kws = H.splitKeywords(Store.settings.interestKeywords || "");
      var arts = filter(all);
      var favN = all.filter(function (a) { return a.fav; }).length;
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">资料库</h1>' +
        '<p class="view-sub">共 ' + all.length + " 篇 · 显示 " + arts.length + " 篇 · 收藏 " + favN + " 篇 · 双语存档（全文 + 中文标题/摘要）</p></div>" +
        '<div class="head-actions"><button class="btn" id="lbAutoTrans" disabled="disabled">' +
        (LLM.configured() ? "翻译全部标题与摘要" : "配置模型后可自动翻译") + "</button></div></div>" +
        '<div class="filters">' +
        '<input class="search" id="fQ" placeholder="关键词（标题/正文/摘要/作者）" value="' + H.esc(state.q) + '">' +
        '<select id="fCh"><option value="">全部信源</option>' + chOptions(all) + "</select>" +
        '<select id="fTr"><option value="">翻译状态</option><option value="pending">标题待译</option><option value="ok">已翻译</option><option value="failed">失败</option></select>' +
        '<select id="fSort" title="排序方式"><option value="time"' + (state.sort === "time" ? " selected" : "") + ">按时间</option><option value=\"rel\"" + (state.sort === "rel" ? " selected" : "") + ">按相关度</option></select>" +
        '<input type="date" id="fFrom" title="发布日期 起" value="' + H.esc(state.from) + '"><span class="muted">至</span>' +
        '<input type="date" id="fTo" title="发布日期 止" value="' + H.esc(state.to) + '">' +
        '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="fSel"' + (state.selectedOnly ? " checked" : "") + ">已选</label>" +
        '<label style="display:flex;align-items:center;gap:4px"><input type="checkbox" id="fFav"' + (state.favOnly ? " checked" : "") + ">仅看收藏</label>" +
        "</div>" +
        '<div id="lbList">' + listHtml(arts, terms) + "</div>";

      bind(el, all, terms);

      function chOptions(all) {
        var seen = {}, out = "";
        all.forEach(function (a) { if (a.channel && !seen[a.channel]) { seen[a.channel] = 1; out += '<option value="' + H.esc(a.channel) + '"' + (state.channel === a.channel ? " selected" : "") + ">" + H.esc(a.channelName || a.channel) + "</option>"; } });
        return out;
      }
      function filter(list) {
        var q = state.q.trim().toLowerCase();
        return list.filter(function (a) {
          if (state.channel && a.channel !== state.channel) return false;
          if (state.trans === "pending" && (a.titleZh || a.titleTrans !== "pending")) return false;
          if (state.trans === "ok" && !a.titleZh) return false;
          if (state.trans === "failed" && a.titleTrans !== "failed") return false;
          if (state.selectedOnly && !a.selected) return false;
          if (state.favOnly && !a.fav) return false;
          var d = (a.pubDate || "").slice(0, 10);
          if (state.from && d < state.from) return false;
          if (state.to && d > state.to) return false;
          if (q) {
            var blob = ((a.title || "") + " " + (a.titleZh || "") + " " + (a.author || "") + " " +
              (a.summary || "") + " " + (a.summaryZh || "") + " " + (a.body || "")).toLowerCase();
            if (blob.indexOf(q) < 0) return false;
          }
          return true;
        }).sort(function (x, y) {
          if (state.sort === "rel" && kws.length) {
            var d = H.kwScore(kws, y).score - H.kwScore(kws, x).score;
            if (d) return d;
          }
          return String(y.pubDate).localeCompare(String(x.pubDate));
        });
      }
      function listHtml(list, terms) {
        if (!list.length) return '<div class="empty"><b>没有匹配的文章</b>试试放宽筛选，或先在总览「立即更新资料」。</div>';
        return list.map(function (a) { return cardHtml(a, terms); }).join("");
      }
      function cardHtml(a, terms) {
        var open = state.openUrl === a.url;
        var run = running[a.url];
        var kwr = kws.length ? H.kwScore(kws, a) : null;
        return '<div class="art" id="art-' + encodeURIComponent(a.url) + '">' +
          '<div class="art-head">' +
          '<input type="checkbox" class="art-check" data-act="pick" data-url="' + H.esc(a.url) + '"' + (a.selected ? " checked" : "") + ' title="选中/取消（学报选文）">' +
          '<div style="flex:1;min-width:0">' +
          '<div class="art-title" data-act="open" data-url="' + H.esc(a.url) + '">' + H.esc(a.titleZh || a.title) + "</div>" +
          (a.titleZh ? '<div class="art-title-en">' + H.esc(a.title) + "</div>" : "") +
          (a.summaryZh ? '<div class="art-sum">' + H.esc(a.summaryZh) + "</div>" : "") +
          '<div class="art-meta">' +
          '<span class="badge A">A 官网直采</span>' +
          '<span>' + H.esc(a.channelName || a.channel) + "</span>" +
          '<span>' + H.fmtDay(a.pubDate) + "</span>" +
          (a.author ? "<span>" + H.esc(a.author) + "</span>" : "") +
          artStateBadge(a) +
          (kwr && kwr.score ? H.kwBadge(kwr) : "") +
          "</div></div>" +
          "</div>" +
          '<div class="art-actions">' +
          '<button class="btn sm" data-act="fav" data-url="' + H.esc(a.url) + '">' + (a.fav ? "取消收藏" : "收藏") + "</button>" +
          '<button class="btn sm" data-act="open" data-url="' + H.esc(a.url) + '">' + (open ? "收起" : "查看详情") + "</button>" +
          (a.titleZh ? "" : '<button class="btn sm primary" data-act="trTitle" data-url="' + H.esc(a.url) + '"' + (run || !LLM.configured() ? " disabled" : "") + ">翻译</button>") +
          '<button class="btn sm" data-act="trFull" data-url="' + H.esc(a.url) + '"' + (run ? " disabled" : "") + ">" +
          (a.zhState === "ok" ? "重译全文" : (a.zhState === "running" || (a.zhFull && a.zhState === "failed")) ? "续译全文" : "全文翻译") + "</button>" +
          (a.titleZh ? '<button class="btn sm accent" data-act="journal" data-url="' + H.esc(a.url) + '"' + (run ? " disabled" : "") + ">生成学报 docx</button>" : "") +
          '<button class="btn sm" data-act="editTitle" data-url="' + H.esc(a.url) + '">标题/摘要</button>' +
          "</div>" +
          (open ? detailHtml(a, terms, run) : "") +
          "</div>";
      }
      function detailHtml(a, terms, run) {
        var t = state.zhTab;
        var hits = MIRROR.hits(terms, a.body);
        return '<div class="detail-body">' +
          '<div class="art-meta" style="margin-top:0"><a href="' + H.esc(a.url) + '" target="_blank" rel="noopener">查看原文链接 →</a>' +
          (hits.length ? '<span>术语命中：' + hits.map(function (h) { return '<span class="terms-hit">' + H.esc(h.en) + "→" + H.esc(h.zh) + "</span>"; }).join("") + "</span>" : "") +
          "</div>" +
          '<div class="detail-tabs">' +
          '<button class="' + (t === "zh" ? "active" : "") + '" data-tab="zh" data-url="' + H.esc(a.url) + '">中文（标题/摘要/全文）</button>' +
          '<button class="' + (t === "en" ? "active" : "") + '" data-tab="en" data-url="' + H.esc(a.url) + '">英文原文（全文）</button>' +
          "</div>" +
          (t === "zh"
            ? '<div class="field"><label>中文摘要' + (a.summaryZh ? "" : "（未生成，点卡片「翻译」生成标题+摘要）") + "</label>" +
              '<div class="prose" style="max-height:none;background:#fbfcf7">' + H.esc(a.summaryZh || "—") + "</div></div>" +
              '<div class="field"><label>中文全文' + (a.zhState === "ok" ? "" : a.zhState === "failed" ? "（中断于第 " + a.zhDone + " 块，可「续译全文」）" : "（尚未翻译，点「全文翻译」）") + "</label>" +
              '<div class="prose" style="max-height:none">' + H.esc(a.zhFull || (a.zhState === "failed" ? "翻译中断，可点「续译全文」继续。" : "")) + "</div></div>"
            : '<div class="prose" style="max-height:none">' + H.esc(a.body || "(正文缺失)") + "</div>") +
          (run && run.full ? '<div class="note">正在翻译全文…<span class="spin dark"></span></div>' : "") +
          "</div>";
      }
      function bind(el, all, terms) {
        var qI = el.querySelector("#fQ");
        qI.addEventListener("input", H.debounce(function () { state.q = qI.value; App.refresh(); }, 350));
        el.querySelector("#fCh").addEventListener("change", function (e) { state.channel = e.target.value; App.refresh(); });
        el.querySelector("#fTr").addEventListener("change", function (e) { state.trans = e.target.value; App.refresh(); });
        el.querySelector("#fSort").addEventListener("change", function (e) { state.sort = e.target.value; App.refresh(); });
        el.querySelector("#fFrom").addEventListener("change", function (e) { state.from = e.target.value; App.refresh(); });
        el.querySelector("#fTo").addEventListener("change", function (e) { state.to = e.target.value; App.refresh(); });
        el.querySelector("#fSel").addEventListener("change", function (e) { state.selectedOnly = e.target.checked; App.refresh(); });
        el.querySelector("#fFav").addEventListener("change", function (e) { state.favOnly = e.target.checked; App.refresh(); });
        var at = el.querySelector("#lbAutoTrans");
        at.disabled = !LLM.configured();
        at.addEventListener("click", function () {
          var todo = MIRROR.pendingTitles(all).concat(MIRROR.pendingSummaries(all));
          if (!todo.length) { App.toast("没有待翻译的标题/摘要"); return; }
          if (!LLM.configured()) { App.toast("请先在「设置 → 模型」配置模型"); return; }
          App.toast("开始翻译 " + todo.length + " 篇标题与摘要…");
          MIRROR.translateTitles(todo, function () { App.refresh(); }).then(function () {
            App.toast("标题与摘要翻译完成");
            App.refresh();
          });
        });
        el.addEventListener("click", function (e) {
          var btn = e.target.closest("[data-act]");
          if (!btn) return;
          var act = btn.dataset.act, url = btn.dataset.url;
          if (act === "open") { state.openUrl = state.openUrl === url ? null : url; App.refresh(); }
          else if (act === "pick") {
            Store.getArticle(url).then(function (a) { a.selected = btn.checked ? 1 : 0; return Store.putArticle(a); }).then(function () { App.refresh(); });
          }
          else if (act === "fav") doFav(url);
          else if (act === "trTitle") doTrTitle(url);
          else if (act === "trFull") doTrFull(url);
          else if (act === "journal") {
            Store.getArticle(url).then(function (a) {
              if (!a.titleZh) { App.toast("请先翻译标题"); return; }
              window.WB.modules.journal.generateOne(a);
            });
          }
          else if (act === "editTitle") doEditTitle(url);
        });
        el.querySelectorAll(".detail-tabs button").forEach(function (b) {
          b.addEventListener("click", function () {
            state.zhTab = b.dataset.tab;
            App.refresh();
          });
        });
      }
      function doFav(url) {
        Store.getArticle(url).then(function (a) {
          a.fav = a.fav ? 0 : 1;
          return Store.putArticle(a).then(function () {
            if (a.fav) Store.logPreference("fav", a.url, a.titleZh || a.title); // 取消收藏为中性，不记负反馈
            return a;
          });
        }).then(function (a) {
          App.refresh();
          if (!a.fav) { App.toast("已取消收藏"); return; }
          var s = Store.settings;
          if (!LLM.configured()) { App.toast("已收藏（未配置模型，未自动翻译）"); return; }
          var done = [];
          var p = Promise.resolve();
          if (s.favAutoTr) {
            if (!a.titleZh) {
              p = p.then(function () { return MIRROR.translateTitles([a]).then(function () { done.push("标题+摘要"); }); });
            } else if (!a.summaryZh) {
              p = p.then(function () { return MIRROR.translateSummaries([a]).then(function () { done.push("摘要"); }); });
            }
          }
          if (s.favAutoFull) {
            p = p.then(function () {
              return Store.getArticle(a.url).then(function (cur) {
                if (!cur || !cur.body || cur.zhState === "ok") return null;
                return MIRROR.translateFull(cur, { onState: function (st) { done.push(st === "ok" ? "全文" : "全文翻译中断"); } });
              });
            });
          }
          p.then(function () {
            App.toast(done.length ? "已收藏，自动完成：" + done.join("、") : "已收藏", done.length ? "ok" : "");
            App.refresh();
          }).catch(function (err) {
            App.toast("已收藏，但自动翻译出错：" + (err && err.message ? err.message : err), "err");
            App.refresh();
          });
        });
      }
      function doTrTitle(url) {
        if (!LLM.configured()) { App.toast("请先在「设置 → 模型」配置模型"); return; }
        running[url] = true; App.refresh();
        Store.getArticle(url).then(function (a) {
          return MIRROR.translateTitles([a], function () {
            delete running[url]; App.toast("标题与摘要已翻译"); App.refresh();
          });
        }).catch(function (err) { delete running[url]; App.toast(err.message || "翻译失败", "err"); App.refresh(); });
      }
      function doTrFull(url) {
        if (!LLM.configured()) { App.toast("请先在「设置 → 模型」配置模型"); return; }
        running[url] = { full: true }; App.refresh();
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
          App.toast(err.message || "翻译失败", "err");
          App.refresh();
        });
      }
      function doEditTitle(url) {
        Store.getArticle(url).then(function (a) {
          App.openModal(
            '<div class="modal-head"><h3>中文标题 / 摘要（人工修正）</h3><button class="btn sm" data-close>×</button></div>' +
            '<div class="modal-body">' +
            '<div class="field"><label>英文原标题</label><div class="muted">' + H.esc(a.title) + "</div></div>" +
            '<div class="field"><label>中文标题</label><input id="mtTitle" value="' + H.esc(a.titleZh || "") + '" placeholder="留空则保留原文"></div>' +
            '<div class="field"><label>中文摘要（自动生成，可修改）</label><textarea id="mtSum">' + H.esc(a.summaryZh || "") + "</textarea></div>" +
            '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="mtLock"' + (a.titleZhLocked ? " checked" : "") + "> 锁定（自动翻译不再覆盖）</label>" +
            '<div class="modal-actions"><button class="btn" data-close>取消</button><button class="btn primary" id="mtSave">保存</button></div>' +
            "</div>"
          );
          var box = document.getElementById("modalBox");
          box.querySelector("#mtSave").addEventListener("click", function () {
            var zh = box.querySelector("#mtTitle").value.trim();
            var sum = box.querySelector("#mtSum").value.trim();
            var lock = box.querySelector("#mtLock").checked ? 1 : 0;
            a.titleZh = zh;
            a.summaryZh = sum;
            a.titleZhLocked = lock;
            a.titleTrans = zh ? "ok" : a.titleTrans;
            Store.putArticle(a).then(function () { App.closeModal(); App.toast("已保存"); App.refresh(); });
          });
        });
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  M.state = state;
  window.WB.modules.library = M;
})();
