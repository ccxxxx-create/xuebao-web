/* modules/journal.js —— 学报：选文出刊（编译 → docx → 校验）与出刊历史；出刊模板管理（上传范文解构版式，电脑端） */
(function () {
  "use strict";
  var genBusy = false;

  /* ---------- 模板存取 ---------- */
  function builtinTpl() {
    return { id: "builtin", name: "内置规范版式", style: DOCX.STYLE, builtIn: true };
  }
  function allTpls() {
    return [builtinTpl()].concat((Store.settings.journalTemplates || []));
  }
  function tplById(id) {
    var t = allTpls().filter(function (x) { return x.id === id; })[0];
    return t || builtinTpl();
  }
  function saveTpls(arr) {
    Store.settings.journalTemplates = arr;
    Store.saveSettings();
  }
  function styleSummary(st) {
    return "标题 " + st.title.eastAsia + " " + (st.title.sz / 2) + "pt · 正文 " + st.body.eastAsia + " " +
      (st.body.sz / 2) + "pt · 页边距 上" + st.pgMar.top + "/左" + st.pgMar.left;
  }

  /* ---------- 编译文本 → docx 段 ---------- */
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

  /* ---------- 出刊主流程（tpl = 选定模板） ---------- */
  function runGenerate(art, tpl) {
    var modalHtml =
      '<div class="modal-head"><h3>正在生成学报条目</h3></div>' +
      '<div class="modal-body"><p id="genMsg">调用模型编译中…<span class="spin dark"></span></p>' +
      '<div class="muted" style="word-break:break-all">' + H.esc(art.titleZh || art.title) + "</div>" +
      '<p class="muted" style="margin-top:6px">版式：' + H.esc(tpl.name) + "</p></div>";
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
      var blob = DOCX.buildDocx({ title: seg.title, body: seg.body, sign: sign }, tpl.style);
      return DOCX.verifyDocx(blob, sign, tpl.style).then(function (verify) {
        var name = DOCX.fileName(art.pubDate, seg.title, art.title);
        H.download(name, blob);
        return Store.addJournal({
          artUrl: art.url, artTitleZh: seg.title, artTitleEn: art.title,
          channelName: art.channelName || art.channel,
          seg: { title: seg.title, body: seg.body, sign: sign },
          style: JSON.parse(JSON.stringify(tpl.style)),
          tplId: tpl.id, tplName: tpl.name,
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

  /* 出刊入口：先选模板（按需选择），确认后再编译生成 */
  function doGenerate(art) {
    if (genBusy) { App.toast("已有生成任务进行中，请稍候"); return; }
    if (!LLM.configured()) { App.toast("请先在「设置 → 模型」配置模型（编译需要在线模型）", "err"); return; }
    var tpls = allTpls();
    var cur = Store.settings.journalTemplateId || "builtin";
    var opts = tpls.map(function (t) {
      return '<option value="' + H.esc(t.id) + '"' + (t.id === cur ? " selected" : "") + ">" +
        H.esc(t.name) + (t.builtIn ? "（内置）" : "") + "</option>";
    }).join("");
    App.openModal(
      '<div class="modal-head"><h3>出刊 · 选择版式模板</h3><button class="btn sm" data-close>×</button></div>' +
      '<div class="modal-body">' +
      '<p class="muted">为这篇生成学报 docx，先选一个版式模板（可在「学报」页上传自己的范文模板）：</p>' +
      '<select id="genTpl" class="input" style="width:100%;margin:10px 0">' + opts + "</select>" +
      '<div class="muted" id="genTplInfo" style="margin-bottom:12px">' + H.esc(styleSummary(tplById(cur).style)) + "</div>" +
      '<button class="btn block primary" id="genGo">开始生成</button>' +
      "</div>"
    );
    var box = document.getElementById("modalBox");
    var sel = box.querySelector("#genTpl");
    sel.addEventListener("change", function () {
      Store.settings.journalTemplateId = sel.value; // 记住最近选择，下次默认
      Store.saveSettings();
      box.querySelector("#genTplInfo").textContent = styleSummary(tplById(sel.value).style);
    });
    box.querySelector("#genGo").addEventListener("click", function () {
      genBusy = true;
      App.closeModal();
      runGenerate(art, tplById(sel.value));
    });
  }

  /* ---------- 模板上传（电脑端：学报页内） ---------- */
  function bindUpload(root) {
    var fi = root.querySelector("#tplFile");
    if (!fi) return;
    fi.addEventListener("change", function () {
      var file = fi.files && fi.files[0];
      fi.value = "";
      if (!file) return;
      if (!/\.docx$/i.test(file.name)) { App.toast("请选择 .docx 文件（Word 2007+ 格式）", "err"); return; }
      App.openModal('<div class="modal-head"><h3>正在解构范文版式</h3></div>' +
        '<div class="modal-body"><p>' + H.esc(file.name) + '<span class="spin dark" style="margin-left:8px"></span></p></div>', { noClose: true });
      DOCX.extractTemplate(file).then(function (st) {
        App.closeModal();
        App.openModal(
          '<div class="modal-head"><h3>模板解构结果</h3><button class="btn sm" data-close>×</button></div>' +
          '<div class="modal-body">' +
          '<div class="tbl-wrap"><table class="data"><tbody>' +
          "<tr><td>页面</td><td>" + (st.pgSz.w / 567).toFixed(1) + "cm × " + (st.pgSz.h / 567).toFixed(1) + "cm</td></tr>" +
          "<tr><td>页边距</td><td>上" + st.pgMar.top + " 下" + st.pgMar.bottom + " 左" + st.pgMar.left + " 右" + st.pgMar.right + "（twip）</td></tr>" +
          "<tr><td>标题字体</td><td>" + H.esc(st.title.eastAsia) + " / " + (st.title.sz / 2) + "pt</td></tr>" +
          "<tr><td>正文字体</td><td>" + H.esc(st.body.eastAsia) + " / " + (st.body.sz / 2) + "pt</td></tr>" +
          "<tr><td>供稿字体</td><td>" + H.esc(st.sign.eastAsia) + " / " + (st.sign.sz / 2) + "pt</td></tr>" +
          "</tbody></table></div>" +
          '<p class="muted" style="margin-top:8px">按范文实际文字自动识别主字体；如个别项与预期不符，可在 Word 里简化范文后再传。</p>' +
          '<input class="input" id="tplName" style="width:100%;margin-top:8px" placeholder="模板名称（默认取文件名）" value="' + H.esc(file.name.replace(/\.docx$/i, "")) + '"/>' +
          '<button class="btn block primary" id="tplSave" style="margin-top:10px">保存模板</button>' +
          "</div>"
        );
        var box = document.getElementById("modalBox");
        box.querySelector("#tplSave").addEventListener("click", function () {
          var name = (box.querySelector("#tplName").value || "").trim() || file.name.replace(/\.docx$/i, "");
          var arr = (Store.settings.journalTemplates || []).slice();
          var id = "t" + Date.now();
          arr.push({ id: id, name: name, style: st, createdAt: H.nowIso() });
          saveTpls(arr);
          Store.settings.journalTemplateId = id; // 新模板设为当前默认，方便立刻用
          Store.saveSettings();
          App.closeModal();
          App.toast("模板已保存：" + name, "ok");
          App.refresh();
        });
      }).catch(function (e) {
        App.closeModal();
        App.toast(e && e.message ? e.message : "模板解构失败", "err");
      });
    });
  }

  var M = {
    key: "journal",
    label: "学报",
    generateOne: doGenerate,
    async render(el) {
      var journals = await Store.getAllJournals();
      var tpls = allTpls();
      var curId = Store.settings.journalTemplateId || "builtin";
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">学报出刊</h1>' +
        '<p class="view-sub">从资料库挑文章 → 点「直接出刊」逐个生成学报 Word 文档 · 出刊记录 ' + journals.length + " 份</p></div>" +
        '<div class="head-actions"><a class="btn primary" href="#/library">去资料库选文 →</a></div></div>' +

        '<div class="card"><h3>出刊模板</h3>' +
        '<p class="muted" style="margin-bottom:10px">生成时按需选择版式；上传自己的范文 .docx 即可自动解构出同名字体、字号与页边距。</p>' +
        '<div class="tbl-wrap"><table class="data"><thead><tr><th>模板</th><th>版式摘要</th><th>操作</th></tr></thead><tbody>' +
        tpls.map(function (t) {
          return "<tr><td>" + H.esc(t.name) + (t.builtIn ? ' <span class="badge">内置</span>' : "") + "</td>" +
            '<td class="muted" style="max-width:420px">' + H.esc(styleSummary(t.style)) + "</td>" +
            '<td>' + (t.builtIn ? "" : '<button class="btn sm danger" data-tpl-del="' + H.esc(t.id) + '">删除</button>') + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<div style="margin-top:10px">' +
        '<input type="file" id="tplFile" accept=".docx" hidden>' +
        '<button class="btn" id="tplUpload">上传范文 .docx 解构模板</button>' +
        '<span class="muted" style="margin-left:10px">当前默认：' + H.esc(tplById(curId).name) + "（出刊时还可临时切换）</span></div>" +
        "</div>" +

        '<div class="card"><h3>出刊记录</h3>' +
        (journals.length
          ? '<div class="tbl-wrap"><table class="data"><thead><tr><th>生成时间</th><th>中文标题</th><th>原文标题</th><th>模板</th><th>文件</th><th>版式校验</th><th>操作</th></tr></thead><tbody>' +
          journals.map(function (j) {
            var v = j.verify || {};
            var verBadge = v.ok ? '<span class="badge state-ok">通过</span>' : '<span class="badge state-error">有差异</span>';
            return "<tr>" +
              "<td>" + H.fmtDateTime(j.createdAt) + "</td>" +
              "<td>" + H.esc(j.artTitleZh) + "</td>" +
              "<td class='muted' style='max-width:200px'>" + H.esc(j.artTitleEn) + "</td>" +
              "<td class='muted'>" + H.esc(j.tplName || "内置规范版式") + "</td>" +
              "<td class='mono' style='max-width:220px'>" + H.esc(j.docxName) + "</td>" +
              "<td>" + verBadge + "</td>" +
              '<td><button class="btn sm primary" data-reload="' + j.id + '">重新下载</button> ' +
              '<button class="btn sm" data-vrf="' + j.id + '">校验报告</button> ' +
              '<button class="btn sm danger" data-del="' + j.id + '">删除</button></td></tr>';
          }).join("") + "</tbody></table></div>"
          : '<div class="empty"><b>暂无出刊记录</b>在「资料库」给文章点「直接出刊」，生成后的文件会记录在这里可回看、重新下载。</div>') +
        "</div>" +
        '<div class="note">生成的 Word 严格按所选模板版式（页面尺寸/边距/字体字号）输出，“供稿”默认是占位文字，可在 Word 中直接改为真实署名。</div>';

      bindUpload(el);

      el.querySelectorAll("[data-tpl-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.dataset.tplDel;
          var t = (Store.settings.journalTemplates || []).filter(function (x) { return x.id === id; })[0];
          App.confirm("删除模板「" + (t ? t.name : id) + "」？").then(function (ok) {
            if (!ok) return;
            saveTpls((Store.settings.journalTemplates || []).filter(function (x) { return x.id !== id; }));
            if ((Store.settings.journalTemplateId) === id) {
              Store.settings.journalTemplateId = "builtin";
              Store.saveSettings();
            }
            App.toast("模板已删除");
            App.refresh();
          });
        });
      });

      el.querySelectorAll("[data-reload]").forEach(function (b) {
        b.addEventListener("click", function () {
          var j = journals.find(function (x) { return x.id === Number(b.dataset.reload); });
          if (!j) return;
          var blob = DOCX.buildDocx(j.seg || {}, j.style); // 按出刊当时的版式重建，模板被删/改也不走样
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
