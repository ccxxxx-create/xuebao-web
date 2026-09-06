/* modules/journal.js —— 学报工作台 v2（v1.25）：出草稿 → 人工修改 / 给建议让模型返工（可反复叠加）→
   满意后「正式存入」（生成 docx + 存出刊记录）。保存之前都是草稿。
   另含：出刊模板管理（上传范文解构版式）、「风格与记忆」（文风印象提炼 + 手动规则，注入翻译/编译提示词）。电脑端专用。 */
(function () {
  "use strict";
  var genBusy = false;
  var state = { openDraftId: null };   // 当前打开审阅的草稿 id

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

  /* ---------- 编译文本 → 草稿段（第一行=标题，标题优先用已译中文标题） ---------- */
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

  function buildPayload(art) {
    return {
      titleEn: art.title,
      body: art.body,
      sourceZh: LLM.CHANNEL_ZH[art.channel] || art.channelName || art.channel,
      sourceInfo: art.channelName || art.channel,
      monthDay: H.fmtDateCN(art.pubDate),
      pubDate: H.fmtDay(art.pubDate)
    };
  }

  /* ---------- 出草稿（资料库/收藏夹入口）：只编译进草稿箱，不出文件不入档 ---------- */
  function compileToDraft(art, tpl) {
    App.openModal('<div class="modal-head"><h3>正在生成学报草稿</h3></div>' +
      '<div class="modal-body"><p id="genMsg">调用模型编译中…<span class="spin dark"></span></p>' +
      '<div class="muted" style="word-break:break-all">' + H.esc(art.titleZh || art.title) + "</div>" +
      '<p class="muted" style="margin-top:6px">生成后到「学报」页人工修改或给建议返工，满意再正式存入。</p></div>', { noClose: true });

    Store.getAllTerms().then(function (terms) {
      return LLM.compileJournal(buildPayload(art), LLM.glossaryLines(terms));
    }).then(function (compiled) {
      var seg = segsFromCompile(compiled, art);
      var d = {
        id: "d" + Date.now(),
        artUrl: art.url, artTitleEn: art.title,
        channelName: art.channelName || art.channel,
        pubDate: art.pubDate,
        tplId: tpl.id, tplName: tpl.name,
        style: JSON.parse(JSON.stringify(tpl.style)),
        title: seg.title, body: seg.body,
        sign: (Store.settings.signatureText || "").trim(),
        suggestions: [],
        createdAt: H.nowIso(), updatedAt: Date.now()
      };
      return Store.putDraft(d).then(function () {
        genBusy = false;
        App.closeModal();
        state.openDraftId = d.id;
        App.toast("草稿已生成，正在打开审阅", "ok");
        if (location.hash !== "#/journal") location.hash = "#/journal"; else App.refresh();
      });
    }).catch(function (err) {
      genBusy = false;
      App.closeModal();
      App.toast(err && err.message ? err.message : "生成草稿失败", "err");
    });
  }

  /* 出草稿入口：先选模板，确认后编译成草稿 */
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
      '<div class="modal-head"><h3>出学报草稿 · 选择版式模板</h3><button class="btn sm" data-close>×</button></div>' +
      '<div class="modal-body">' +
      '<p class="muted">先由模型编译出草稿（不会直接出文件）；之后在「学报」页人工修改或给建议返工，满意再正式存入。</p>' +
      '<select id="genTpl" class="input" style="width:100%;margin:10px 0">' + opts + "</select>" +
      '<div class="muted" id="genTplInfo" style="margin-bottom:12px">' + H.esc(styleSummary(tplById(cur).style)) + "</div>" +
      '<button class="btn block primary" id="genGo">生成草稿</button>' +
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
      compileToDraft(art, tplById(sel.value));
    });
  }

  /* ---------- 草稿编辑器动作 ---------- */
  function readEditor(root, d) {
    var t = root.querySelector("#dfTitle"), b = root.querySelector("#dfBody"), g = root.querySelector("#dfSign");
    if (t) d.title = t.value.trim();
    if (b) d.body = b.value;
    if (g) d.sign = g.value.trim();
    return d;
  }
  function saveDraft(root, quiet) {
    var d = readEditor(root, state.cur);
    d.updatedAt = Date.now();
    return Store.putDraft(d).then(function () {
      if (!quiet) App.toast("草稿已保存", "ok");
    });
  }
  /* 建议返工：模型按建议修改当前草稿（自动保存；建议进历史） */
  function reworkDraft(root) {
    if (genBusy) { App.toast("模型正在返工，请稍候"); return; }
    if (!LLM.configured()) { App.toast("请先在「设置 → 模型」配置模型", "err"); return; }
    var sugEl = root.querySelector("#dfSug");
    var suggestion = (sugEl.value || "").trim();
    if (!suggestion) { App.toast("先写下修改建议，再点返工", "err"); return; }
    var d = readEditor(root, state.cur);
    if (!d.title || !d.body) { App.toast("草稿内容为空，无法返工", "err"); return; }
    genBusy = true;
    var msg = root.querySelector("#dfAiMsg");
    if (msg) msg.innerHTML = '模型按建议返工中…<span class="spin dark"></span>（通常 10~60 秒，完成后自动保存）';
    saveDraft(root, true).then(function () {
      return Store.getArticle(d.artUrl);
    }).then(function (art) {
      return Store.getAllTerms().then(function (terms) {
        return LLM.reworkJournalDraft({
          titleEn: d.artTitleEn, bodyEn: art ? art.body : "",
          title: d.title, body: d.body, suggestion: suggestion
        }, LLM.glossaryLines(terms));
      });
    }).then(function (compiled) {
      var seg = segsFromCompile(compiled, null);
      d.title = seg.title || d.title;
      d.body = seg.body || d.body;
      d.suggestions.push({ at: H.nowIso(), text: suggestion });
      d.updatedAt = Date.now();
      return Store.putDraft(d).then(function () {
        genBusy = false;
        App.toast("已按建议返工并保存草稿", "ok");
        App.refresh();
      });
    }).catch(function (err) {
      genBusy = false;
      if (msg) msg.innerHTML = '<span style="color:var(--bad)">' + H.esc((err && err.message) || "返工失败") + "</span>";
    });
  }
  /* 重新编译：丢弃当前标题/正文（署名保留），按最新风格记忆与词表重编 */
  function recompileDraft(root) {
    if (genBusy) { App.toast("模型正在返工，请稍候"); return; }
    if (!LLM.configured()) { App.toast("请先在「设置 → 模型」配置模型", "err"); return; }
    var d = readEditor(root, state.cur);
    App.confirm("重新编译会丢弃当前标题/正文的修改（署名保留），用最新词表与风格记忆重出一版。继续？").then(function (ok) {
      if (!ok) return;
      genBusy = true;
      var msg = root.querySelector("#dfAiMsg");
      if (msg) msg.innerHTML = '重新编译中…<span class="spin dark"></span>';
      Store.getArticle(d.artUrl).then(function (art) {
        if (!art) throw new Error("原文已被清理，无法重新编译");
        return Store.getAllTerms().then(function (terms) {
          return LLM.compileJournal(buildPayload(art), LLM.glossaryLines(terms));
        });
      }).then(function (compiled) {
        var seg = segsFromCompile(compiled, null);
        d.title = seg.title || d.title;
        d.body = seg.body || d.body;
        d.updatedAt = Date.now();
        return Store.putDraft(d).then(function () {
          genBusy = false;
          App.toast("已重新编译", "ok");
          App.refresh();
        });
      }).catch(function (err) {
        genBusy = false;
        if (msg) msg.innerHTML = '<span style="color:var(--bad)">' + H.esc((err && err.message) || "重新编译失败") + "</span>";
      });
    });
  }
  /* 正式存入：生成 docx + 校验 + 下载 + 存出刊记录，草稿关闭 */
  function finalizeDraft(root) {
    var d = readEditor(root, state.cur);
    if (!d.title || !d.body) { App.toast("标题与正文不能为空", "err"); return; }
    var box = root.querySelector("#dfAiMsg");
    var finish = function (verify) {
      var name = DOCX.fileName(d.pubDate, d.title, d.artTitleEn);
      var blob = DOCX.buildDocx({ title: d.title, body: d.body, sign: d.sign }, d.style);
      H.download(name, blob);
      return Store.addJournal({
        artUrl: d.artUrl, artTitleZh: d.title, artTitleEn: d.artTitleEn,
        channelName: d.channelName,
        seg: { title: d.title, body: d.body, sign: d.sign },
        style: JSON.parse(JSON.stringify(d.style)),
        tplId: d.tplId, tplName: d.tplName,
        docxName: name, verify: verify, createdAt: H.nowIso()
      }).then(function () {
        return Store.getArticle(d.artUrl).then(function (a) {
          if (a) { a.journalMade = 1; return Store.putArticle(a); }
        });
      }).then(function () {
        Store.logPreference("journal", d.artUrl, d.title);
        return Store.deleteDraft(d.id);
      }).then(function () {
        state.openDraftId = null;
        App.toast("已正式存入出刊记录，docx 已下载", "ok");
        App.refresh();
      });
    };
    try {
      var blob = DOCX.buildDocx({ title: d.title, body: d.body, sign: d.sign }, d.style);
      DOCX.verifyDocx(blob, d.sign, d.style).then(finish).catch(function (err) {
        App.toast(err && err.message ? err.message : "正式存入失败", "err");
      });
    } catch (e) {
      App.toast(e && e.message ? e.message : "正式存入失败", "err");
    }
  }

  /* ---------- 风格与记忆 ---------- */
  function mem() {
    var m = Store.settings.styleMemory;
    if (!m || typeof m !== "object") m = {};
    if (!Array.isArray(m.rules)) m.rules = [];
    return m;
  }
  function styleCardHtml() {
    var m = mem();
    var rules = (m.rules || []).map(function (r, i) {
      return '<span class="kw-tag">' + H.esc(r) + '<button data-sm-del="' + i + '" title="删除这条规则">×</button></span>';
    }).join("");
    return '<div class="card"><h3>风格与记忆</h3>' +
      '<p class="muted">这里的内容会注入标题、摘要、全文翻译与学报编译的提示词——教模型越写越像你。全部可人工修改。</p>' +
      '<div class="field"><label>文风印象（从正式稿件提炼，可手改）</label>' +
      '<textarea id="smTraits" class="sm-ta" rows="3" placeholder="尚未提炼。点下方「从正式稿件提炼」，或直接手写，例：多用短句；数据放在分点首句；语气克制。">' + H.esc(m.traits || "") + "</textarea></div>" +
      '<div class="field"><label>写作规则（逐条添加，模型必须遵守）</label>' +
      '<div class="kw-tags" id="smRules">' + (rules || '<span class="muted">暂无规则</span>') + "</div>" +
      '<div style="display:flex;gap:8px;margin-top:6px"><input id="smRuleIn" placeholder="例：称谓统一用「美方」；每条不超过 60 字" style="flex:1"><button class="btn" id="smRuleAdd">添加</button></div></div>' +
      '<div class="art-actions" style="margin-top:10px">' +
      '<button class="btn" id="smExtract">从正式稿件提炼文风</button>' +
      '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="smAuto"' + (m.autoExtract ? " checked" : "") + "> 每月自动提炼一次</label>" +
      '<button class="btn primary" id="smSave">保存风格记忆</button></div>' +
      '<div id="smMsg" class="muted" style="margin-top:6px">' + (m.lastExtractAt ? "上次提炼：" + H.fmtDateTime(m.lastExtractAt) : "尚未提炼过（提炼只读取正式存入的稿件，原文不出本机之外的部分仅发给您配置的模型）") + "</div></div>";
  }
  function saveStyleMemory(root, quiet) {
    var m = mem();
    var t = root.querySelector("#smTraits");
    if (t) m.traits = t.value.trim();
    var auto = root.querySelector("#smAuto");
    if (auto) m.autoExtract = auto.checked;
    Store.settings.styleMemory = m;
    Store.saveSettings();
    if (!quiet) App.toast("风格记忆已保存，之后翻译/编译即生效", "ok");
  }
  function extractStyleNow(root, quiet) {
    if (genBusy) return;
    if (!LLM.configured()) { if (!quiet) App.toast("请先在「设置 → 模型」配置模型", "err"); return; }
    return Store.getAllJournals().then(function (js) {
      if (!js.length) { if (!quiet) App.toast("还没有正式存入的稿件，先完成一篇出刊再提炼", "err"); return; }
      genBusy = true;
      var msg = root.querySelector("#smMsg");
      if (msg && !quiet) msg.innerHTML = '正在阅读最近 ' + Math.min(10, js.length) + ' 篇正式稿件并归纳文风…<span class="spin dark"></span>';
      var samples = js.slice(0, 10).map(function (j) {
        return "【样例】" + (j.seg ? (j.seg.title + "\n" + j.seg.body) : (j.artTitleZh || ""));
      }).join("\n\n").slice(0, 12000);
      return LLM.extractStyle(samples).then(function (traits) {
        var m = mem();
        m.traits = String(traits || "").trim();
        m.lastExtractAt = Date.now();
        Store.settings.styleMemory = m;
        Store.saveSettings();
        genBusy = false;
        if (!quiet) App.toast("文风印象已提炼并保存（可人工修改）", "ok");
        App.refresh();
      });
    }).catch(function (err) {
      genBusy = false;
      if (!quiet) App.toast(err && err.message ? err.message : "提炼失败", "err");
    });
  }
  function maybeAutoExtract() {
    var m = mem();
    if (!m.autoExtract) return;
    if (state.openDraftId) return;   // 用户正在审阅草稿时不出手，避免打断编辑
    if (Date.now() - (m.lastExtractAt || 0) < 30 * 864e5) return;
    Store.getAllJournals().then(function (js) {
      if (!js.length) return;
      extractStyleNow(document.getElementById("content"), true).then(function () {
        if (window.App && m.traits !== (Store.settings.styleMemory || {}).traits) {
          App.toast("已按月自动提炼文风印象（可在学报页修改）", "ok");
        }
      });
    });
  }

  /* ---------- 模板上传（电脑端：学报页内，保持原样） ---------- */
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

  /* ---------- 页面 ---------- */
  var M = {
    key: "journal",
    label: "学报",
    generateOne: doGenerate,       // 兼容旧调用名
    generateDraft: doGenerate,
    async render(el) {
      var s = Store.settings;
      var journals = await Store.getAllJournals();
      var drafts = await Store.getAllDrafts();
      if (state.openDraftId) {
        var cur = drafts.filter(function (d) { return d.id === state.openDraftId; })[0];
        if (!cur) state.openDraftId = null; else state.cur = cur;   // 编辑器读写都走 state.cur
      }

      var headHtml =
        '<div class="view-head"><div><h1 class="view-title">学报出刊</h1>' +
        '<p class="view-sub">草稿 ' + drafts.length + " 份 · 出刊记录 " + journals.length + " 份</p></div>" +
        '<div class="head-actions"><a class="btn primary" href="#/library">去资料库选文 →</a></div></div>';

      var draftCard;
      if (state.openDraftId) {
        var d = drafts.filter(function (x) { return x.id === state.openDraftId; })[0];
        var sugHtml = (d.suggestions || []).length
          ? '<div style="margin-top:8px"><span class="muted">建议历史：</span>' +
            d.suggestions.map(function (sg) {
              return '<div class="muted" style="margin:2px 0">· ' + H.fmtDateTime(new Date(sg.at).getTime()) + " " + H.esc(sg.text) + "</div>";
            }).join("") + "</div>"
          : "";
        draftCard =
          '<div class="card"><h3>草稿审阅 · 修改与定稿</h3>' +
          '<div class="muted" style="word-break:break-all">原文：' + H.esc(d.artTitleEn) + " · " + H.esc(d.channelName || "") + " · 版式：" + H.esc(d.tplName) + "</div>" +
          '<div class="field" style="margin-top:10px"><label>中文标题（可直接改）</label><input id="dfTitle" value="' + H.esc(d.title) + '"></div>' +
          '<div class="field"><label>正文（可直接改；保存前都是草稿）</label><textarea id="dfBody" class="sm-ta" rows="12" style="min-height:260px">' + H.esc(d.body) + "</textarea></div>" +
          '<div class="field"><label>供稿署名</label><input id="dfSign" value="' + H.esc(d.sign || "") + '"></div>' +
          '<div class="card-title" style="margin-top:4px">不满意？两条路，可反复叠加</div>' +
          '<div class="field"><label>给模型的修改建议（未提到的部分会保持你改过的样子）</label>' +
          '<textarea id="dfSug" class="sm-ta" rows="2" placeholder="例：第②点补上航速数据；语气再克制些；「盟友」统一改成「伙伴国」"></textarea></div>' +
          '<div class="art-actions"><button class="btn" id="dfRework">按建议返工</button>' +
          '<button class="btn" id="dfRecompile" title="丢弃当前标题/正文，按最新风格记忆与词表重出一版">重新编译</button></div>' +
          '<div id="dfAiMsg" class="muted" style="margin-top:6px"></div>' +
          sugHtml +
          '<div class="modal-actions" style="justify-content:space-between;margin-top:16px">' +
          '<button class="btn" id="dfBack">返回草稿箱</button>' +
          '<span><button class="btn" id="dfSaveDraft">保存草稿</button> ' +
          '<button class="btn primary" id="dfFinal">正式存入并下载 docx</button></span></div></div>';
      } else {
        draftCard =
          '<div class="card"><h3>草稿箱</h3>' +
          (drafts.length
            ? drafts.map(function (d) {
              return '<div class="art" style="margin-bottom:8px"><div class="art-head">' +
                '<div style="flex:1;min-width:0"><div class="art-title" style="font-size:15px">' + H.esc(d.title) + "</div>" +
                '<div class="art-meta">' + H.esc(d.channelName || "") + " · 更新 " + H.fmtDateTime(d.updatedAt) +
                (d.suggestions && d.suggestions.length ? " · 建议 " + d.suggestions.length + " 条" : "") + "</div></div>" +
                '<span style="display:flex;gap:6px;flex:none"><button class="btn sm primary" data-dopen="' + H.esc(d.id) + '">打开审阅</button>' +
                '<button class="btn sm danger" data-ddel="' + H.esc(d.id) + '">删除</button></span></div></div>';
            }).join("")
            : '<div class="empty"><b>草稿箱是空的</b>在「资料库」给文章点「出草稿」：模型先编译，你人工修改或给建议返工，满意再正式存入。</div>') +
          "</div>";
      }

      el.innerHTML = headHtml + draftCard + styleCardHtml() +
        '<div class="card"><h3>出刊模板</h3>' +
        '<p class="muted" style="margin-bottom:10px">正式存入时按所选模板生成 Word；上传自己的范文 .docx 即可自动解构出同名字体、字号与页边距。</p>' +
        '<div class="tbl-wrap"><table class="data"><thead><tr><th>模板</th><th>版式摘要</th><th>操作</th></tr></thead><tbody>' +
        allTpls().map(function (t) {
          return "<tr><td>" + H.esc(t.name) + (t.builtIn ? ' <span class="badge">内置</span>' : "") + "</td>" +
            '<td class="muted" style="max-width:420px">' + H.esc(styleSummary(t.style)) + "</td>" +
            '<td>' + (t.builtIn ? "" : '<button class="btn sm danger" data-tpl-del="' + H.esc(t.id) + '">删除</button>') + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<div style="margin-top:10px">' +
        '<input type="file" id="tplFile" accept=".docx" hidden>' +
        '<button class="btn" id="tplUpload">上传范文 .docx 解构模板</button>' +
        '<span class="muted" style="margin-left:10px">当前默认：' + H.esc(tplById(s.journalTemplateId || "builtin").name) + "（出草稿时还可临时切换）</span></div>" +
        "</div>" +
        '<div class="card"><h3>出刊记录（正式存入）</h3>' +
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
          : '<div class="empty"><b>暂无出刊记录</b>草稿正式存入后会记录在这里，可回看、重新下载。</div>') +
        "</div>";

      bindUpload(el);
      bindDrafts(el);
      bindStyle(el);
      bindRecords(el, journals);

      function bindDrafts(root) {
        if (root.__jf) return;
        root.__jf = true;
        root.addEventListener("click", function (e) {
          var open = e.target.closest("[data-dopen]");
          if (open) { state.openDraftId = open.dataset.dopen; App.refresh(); return; }
          var del = e.target.closest("[data-ddel]");
          if (del) {
            App.confirm("删除这份草稿？未正式存入的内容将丢失。").then(function (ok) {
              if (!ok) return;
              Store.deleteDraft(del.dataset.ddel).then(function () {
                if (state.openDraftId === del.dataset.ddel) state.openDraftId = null;
                App.toast("草稿已删除");
                App.refresh();
              });
            });
            return;
          }
          if (e.target.closest("#dfBack")) { state.openDraftId = null; App.refresh(); return; }
          if (e.target.closest("#dfRework")) { reworkDraft(root); return; }
          if (e.target.closest("#dfRecompile")) { recompileDraft(root); return; }
          if (e.target.closest("#dfSaveDraft")) { saveDraft(root); return; }
          if (e.target.closest("#dfFinal")) { finalizeDraft(root); return; }
          var tplDel = e.target.closest("[data-tpl-del]");
          if (tplDel) {
            var id = tplDel.dataset.tplDel;
            var t = (Store.settings.journalTemplates || []).filter(function (x) { return x.id === id; })[0];
            App.confirm("删除模板「" + (t ? t.name : id) + "」？").then(function (ok) {
              if (!ok) return;
              saveTpls((Store.settings.journalTemplates || []).filter(function (x) { return x.id !== id; }));
              App.toast("模板已删除");
              App.refresh();
            });
            return;
          }
          var rel = e.target.closest("[data-reload]");
          if (rel) {
            Store.getAllJournals().then(function (js) {
              var j = js.filter(function (x) { return String(x.id) === rel.dataset.reload; })[0];
              if (!j) { App.toast("记录不存在", "err"); return; }
              var blob = DOCX.buildDocx(j.seg, j.style);
              H.download(j.docxName || DOCX.fileName(j.artTitleZh, j.artTitleEn), blob);
              App.toast("已按当期版式重新生成并下载", "ok");
            });
            return;
          }
          var vrf = e.target.closest("[data-vrf]");
          if (vrf) {
            Store.getAllJournals().then(function (js) {
              var j = js.filter(function (x) { return String(x.id) === vrf.dataset.vrf; })[0];
              if (!j) { App.toast("记录不存在", "err"); return; }
              DOCX.verifyDocx(DOCX.buildDocx(j.seg, j.style), j.seg.sign, j.style).then(function (v) {
                var rows = (v.items || []).map(function (it) {
                  return "<tr><td>" + H.esc(it.name) + "</td><td>" + (it.pass ? "✓" : "×") + "</td><td class='muted'>" + H.esc(it.detail || "") + "</td></tr>";
                }).join("");
                App.openModal('<div class="modal-head"><h3>版式校验报告</h3><button class="btn sm" data-close>×</button></div>' +
                  '<div class="modal-body"><div class="tbl-wrap"><table class="data"><thead><tr><th>项目</th><th>结果</th><th>明细</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>");
              });
            });
            return;
          }
          var jdel = e.target.closest("[data-del]");
          if (jdel) {
            App.confirm("删除这条出刊记录？（本机 docx 文件不受影响）").then(function (ok) {
              if (!ok) return;
              Store.deleteJournal(Number(jdel.dataset.del)).then(function () { App.toast("记录已删除"); App.refresh(); });
            });
          }
        });
        // 建议框 Ctrl+Enter 直接触发返工
        root.addEventListener("keydown", function (e) {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && e.target && e.target.id === "dfSug") {
            reworkDraft(root);
          }
        });
      }

      function bindStyle(root) {
        if (root.__jfStyle) return;
        root.__jfStyle = true;
        root.addEventListener("click", function (e) {
          var del = e.target.closest("[data-sm-del]");
          if (del) {
            var m = mem();
            m.rules.splice(Number(del.dataset.smDel), 1);
            Store.settings.styleMemory = m;
            Store.saveSettings();
            App.refresh();
            return;
          }
          if (e.target.closest("#smRuleAdd")) {
            var input = root.querySelector("#smRuleIn");
            var txt = (input.value || "").trim();
            if (!txt) { App.toast("先输入规则内容", "err"); return; }
            var mm = mem();
            mm.rules.push(txt);
            Store.settings.styleMemory = mm;
            Store.saveSettings();
            App.refresh();
            return;
          }
          if (e.target.closest("#smSave")) { saveStyleMemory(root); return; }
          if (e.target.closest("#smExtract")) { extractStyleNow(root, false); return; }
          var auto = e.target.closest("#smAuto");
          if (auto) {
            var m2 = mem();
            m2.autoExtract = auto.checked;
            Store.settings.styleMemory = m2;
            Store.saveSettings();
            App.toast(m2.autoExtract ? "已开启：每月自动提炼一次文风印象" : "已关闭自动提炼", "ok");
          }
        });
        var ruleIn = root.querySelector("#smRuleIn");
        if (ruleIn) ruleIn.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") {
            ev.preventDefault();
            var txt = (ruleIn.value || "").trim();
            if (!txt) return;
            var m = mem();
            m.rules.push(txt);
            Store.settings.styleMemory = m;
            Store.saveSettings();
            App.refresh();
          }
        });
      }

      function bindRecords(root, journals) { /* 记录相关操作已并入 bindDrafts 的委托 */ }

      // 自动提炼（默认关；开启后距上次 >30 天且有正式稿件时静默跑一次）
      setTimeout(function () { maybeAutoExtract(); }, 4000);
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  window.WB.modules.journal = M;
})();
