/* modules/journal.js —— 学报：选文出刊（编译 → docx → 校验）与出刊历史 */
(function () {
  "use strict";
  var genBusy = false;

  function segsFromCompile(compiledText, art) {
    var lines = String(compiledText || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    var cTitle = lines[0] || "";
    var cBody = lines.slice(1).join("\n");
    var title = (art && art.titleZh) || cTitle;
    var body = cBody;
    if (art && art.titleZh && cTitle && cBody.indexOf(cTitle) === 0) {
      body = cBody.slice(cTitle.length).replace(/^\s*[：:，,\s]*/, "");
    }
    return { title: title, body: body };
  }

  function doGenerate(art) {
    if (genBusy) { App.toast("已有生成任务进行中，请稍候"); return; }
    if (!LLM.configured()) { App.toast("请先在「设置 → 模型」配置模型（编译需要在线模型）", "err"); return; }
    genBusy = true;
    var modalHtml =
      '<div class="modal-head"><h3>正在生成学报条目</h3></div>' +
      '<div class="modal-body"><p id="genMsg">调用模型编译中…<span class="spin dark"></span></p>' +
      '<div class="muted" style="word-break:break-all">' + H.esc(art.titleZh || art.title) + "</div></div>";
    App.openModal(modalHtml, { noClose: true });

    Store.getAllTerms().then(function (terms) {
      var payload = {
        titleEn: art.title,
        body: art.body,
        sourceZh: LLM.CHANNEL_ZH[art.channel] || art.channelName || art.channel,
        sourceInfo: art.channelName || art.channel,
        monthDay: H.fmtDateCN(art.pubDate),
        pubDate: H.fmtDay(art.pubDate)
      };
      return LLM.compileJournal(payload, LLM.glossaryLines(terms));
    }).then(function (compiled) {
      var seg = segsFromCompile(compiled, art);
      var sign = (Store.settings.signatureText || "").trim();
      var blob = DOCX.buildDocx({ title: seg.title, body: seg.body, sign: sign });
      return DOCX.verifyDocx(blob, sign).then(function (verify) {
        var name = DOCX.fileName(art.pubDate, seg.title, art.title);
        H.download(name, blob);
        return Store.addJournal({
          artUrl: art.url, artTitleZh: seg.title, artTitleEn: art.title,
          channelName: art.channelName || art.channel,
          seg: { title: seg.title, body: seg.body, sign: sign },
          docxName: name, verify: verify, createdAt: H.nowIso()
        }).then(function () {
          art.journalMade = 1;
          return Store.putArticle(art);
        }).then(function () {
          Store.logPreference("journal", art.url, seg.title);
          genBusy = false;
          App.closeModal();
          App.toast("学报 docx 已生成并下载", "ok");
          App.refresh();
        });
      });
    }).catch(function (err) {
      genBusy = false;
      App.closeModal();
      App.toast(err && err.message ? err.message : "生成失败", "err");
    });
  }

  var M = {
    key: "journal",
    label: "学报",
    generateOne: doGenerate,
    async render(el) {
      var arts = await Store.getAllArticles();
      var journals = await Store.getAllJournals();
      var sel = arts.filter(function (a) { return a.selected; });
      var cn = {};
      arts.forEach(function (a) { cn[a.url] = a; });
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">学报出刊</h1>' +
        '<p class="view-sub">从资料库勾选文章 → 这里逐个生成学报 Word 文档 · 已选 ' + sel.length + " 篇 · 出刊记录 " + journals.length + " 份</p></div>" +
        '<div class="head-actions"><a class="btn" href="#/library">去资料库选文 →</a></div></div>' +

        '<div class="card"><h3>① 已选文章（逐个生成）</h3>' +
        (sel.length ? sel.map(function (a) {
          return '<div class="art" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
            '<div style="flex:1;min-width:200px"><div style="font-weight:600">' + H.esc(a.titleZh || a.title) + "</div>" +
            '<div class="muted">' + H.esc(a.title) + " · " + H.esc(a.channelName || a.channel) + " · " + H.fmtDay(a.pubDate) + "</div></div>" +
            '<div class="art-actions" style="margin:0">' +
            '<button class="btn sm" data-unsel="' + H.esc(a.url) + '">移除</button>' +
            '<button class="btn sm accent" data-gen="' + H.esc(a.url) + '"' + (genBusy || !a.titleZh ? " disabled" : "") + ">" +
            (genBusy ? "生成中…" : "生成学报 docx") + "</button></div></div>";
        }).join("") : '<div class="empty"><b>还没有选文</b>在「资料库」点「选入学报」，勾选的文章会出现在这里。</div>') +
        "</div>" +

        '<div class="card"><h3>② 出刊记录</h3>' +
        (journals.length
          ? '<div class="tbl-wrap"><table class="data"><thead><tr><th>生成时间</th><th>中文标题</th><th>原文标题</th><th>文件</th><th>版式校验</th><th>操作</th></tr></thead><tbody>' +
          journals.map(function (j) {
            var v = j.verify || {};
            var verBadge = v.ok ? '<span class="badge state-ok">通过</span>' : '<span class="badge state-error">有差异</span>';
            return "<tr>" +
              "<td>" + H.fmtDateTime(j.createdAt) + "</td>" +
              "<td>" + H.esc(j.artTitleZh) + "</td>" +
              "<td class='muted' style='max-width:220px'>" + H.esc(j.artTitleEn) + "</td>" +
              "<td class='mono' style='max-width:240px'>" + H.esc(j.docxName) + "</td>" +
              "<td>" + verBadge + "</td>" +
              '<td><button class="btn sm primary" data-reload="' + j.id + '">重新下载</button> ' +
              '<button class="btn sm" data-vrf="' + j.id + '">校验报告</button> ' +
              '<button class="btn sm danger" data-del="' + j.id + '">删除</button></td></tr>';
          }).join("") + "</tbody></table></div>"
          : '<div class="empty"><b>暂无出刊记录</b>生成后在此回看、重新下载。</div>') +
        "</div>" +
        '<div class="note">生成的 Word 采用规范学报版式（A4 · 标题加粗 · 正文仿宋），“供稿”默认是占位文字，可在 Word 中直接改为真实署名。</div>';

      el.querySelectorAll("[data-gen]").forEach(function (b) {
        b.addEventListener("click", function () {
          var a = cn[b.dataset.gen];
          if (a) doGenerate(a);
        });
      });
      el.querySelectorAll("[data-unsel]").forEach(function (b) {
        b.addEventListener("click", function () {
          Store.getArticle(b.dataset.unsel).then(function (a) {
            if (!a) return;
            a.selected = 0;
            return Store.putArticle(a).then(function () {
              App.toast("已移出学报选文", "ok");
              App.refresh();
            });
          });
        });
      });
      el.querySelectorAll("[data-reload]").forEach(function (b) {
        b.addEventListener("click", function () {
          var j = journals.find(function (x) { return x.id === Number(b.dataset.reload); });
          if (!j) return;
          var blob = DOCX.buildDocx(j.seg || {});
          H.download(j.docxName, blob);
        });
      });
      el.querySelectorAll("[data-vrf]").forEach(function (b) {
        b.addEventListener("click", function () {
          var j = journals.find(function (x) { return x.id === Number(b.dataset.vrf); });
          if (!j || !j.verify) return;
          var rows = (j.verify.items || []).map(function (it) {
            return "<tr><td>" + H.esc(it.name) + "</td><td>" + (it.pass ? '<span class="badge state-ok">通过</span>' : '<span class="badge state-error">未通过</span>') + "</td></tr>";
          }).join("");
          App.openModal('<div class="modal-head"><h3>版式校验报告</h3><button class="btn sm" data-close>×</button></div>' +
            '<div class="modal-body"><div class="tbl-wrap"><table class="data"><thead><tr><th>项目</th><th>结果</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>");
        });
      });
      el.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = Number(b.dataset.del);
          App.confirm("删除这条出刊记录？").then(function (ok) {
            if (!ok) return;
            Store.deleteJournal(id).then(function () { App.toast("已删除"); App.refresh(); });
          });
        });
      });
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  window.WB.modules.journal = M;
})();
