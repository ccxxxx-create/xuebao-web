/* modules/terms.js —— 术语库（概念化：规范译名 + 多英文变体；候选采集 + 同译法自动归并）
   数据模型：term_en 为主键(主形式) + term_zh 规范译名 + en_variants[] 同义英文变体 + scope/note/source/enabled */
(function () {
  "use strict";

  var EX_KEY = "xuebao-term-extracted";   // 已批量提炼过的文章 url（防重复烧模型）

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

  function mapSeries(items, fn) {
    var i = 0;
    function next() {
      if (i >= items.length) return Promise.resolve();
      var cur = items[i++];
      return Promise.resolve().then(function () { return fn(cur); }).then(next);
    }
    return next();
  }

  function batchExtract() {
    if (!LLM.configured()) { App.toast("请先在「设置 → 模型」配置模型", "err"); return Promise.resolve(false); }
    return App.confirm("对已入库的旧文章批量提炼术语？\n（只提取还没提炼过的、有正文的文章，每篇 8~15 个，结果进「待确认」，不会自动覆盖现有术语库）").then(function (ok) {
      if (!ok) return false;
      App.closeModal();
      return Store.getAllArticles().then(function (all) {
        var done = []; try { done = JSON.parse(localStorage.getItem(EX_KEY)) || []; } catch (e) {}
        var todo = all.filter(function (a) { return a.body && a.body.length > 200 && done.indexOf(a.url) < 0; });
        var LIMIT = 6;
        var batch = todo.slice(0, LIMIT);
        if (!batch.length) { App.toast("没有可提炼的新文章（都已提炼过）"); return false; }
        App.toast("正在提炼 " + batch.length + " 篇术语…");
        return mapSeries(batch, function (a) {
          return LLM.extractTerms(a.title || "", a.body || "").then(function (text) {
            var list = parseExtract(text);
            (list || []).forEach(function (x) { x.source = (a.title || "").slice(0, 40); });
            return Store.candAdd(list);
          }).catch(function () { return 0; }).then(function () {
            done.push(a.url);
            try { localStorage.setItem(EX_KEY, JSON.stringify(done)); } catch (e) {}
          });
        }).then(function () {
          App.toast("提炼完成，新增候选见「待确认」区（可采纳并入词库）", "ok");
          App.refresh();
          return true;
        });
      });
    });
  }

  var M = {
    key: "terms",
    label: "术语",
    async render(el) {
      // 自动归并同译法（幂等）：进入术语库即合并，避免“多写法多条”的混乱
      await Store.mergeTermsByZh().catch(function () { return 0; });
      var cands = Store.loadCands().filter(function (c) { return c.state === "pending"; });
      var terms = await Store.getAllTerms();
      terms = terms.slice().sort(function (a, b) { return (b.enabled || 0) - (a.enabled || 0); });
      var on = terms.filter(function (t) { return t.enabled !== 0; }).length;

      var candHtml = cands.length
        ? '<div class="card"><div class="card-title">待确认术语 <span class="badge accent">' + cands.length + "</span>" +
          '<span style="margin-left:8px;font-size:12px;color:var(--muted)">采纳后并入词库（同译法自动并进变体）</span></div>' +
          '<div class="cand-list">' + cands.map(function (c) {
            return '<div class="cand-row"><div class="cand-text"><b>' + H.esc(c.en) + "</b><span class='arrow'>→</span>" + H.esc(c.zh) +
              (c.source ? '<span class="cand-src">· ' + H.esc(c.source) + "</span>" : "") + "</div>" +
              '<div class="cand-act"><button class="btn sm primary" data-adopt="' + H.esc(c.id) + '">采纳</button> ' +
              '<button class="btn sm ghost" data-ign="' + H.esc(c.id) + '">忽略</button></div></div>';
          }).join("") + "</div></div>"
        : "";

      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">术语库</h1>' +
        '<p class="view-sub">启用 ' + on + " / 共 " + terms.length + " 条概念 · 每条含规范译名与多个英文变体，译到任一变体都按规范译名；命中词条注入翻译/学报编译提示词</p></div>" +
        '<div class="head-actions">' +
        '<button class="btn" id="tBatch" title="对存量已译文章批量提取术语候选">批量提炼旧文</button>' +
        '<button class="btn ghost" id="tMerge" title="自动把同译法多条并成一条概念">归并去重</button>' +
        '<button class="btn primary" id="tAdd">+ 新增概念</button></div></div>' +
        candHtml +
        '<div class="card">' +
        '<div class="card-title">概念词表</div>' +
        (terms.length
          ? '<div class="tbl-wrap"><table class="data"><thead><tr><th>规范译名</th><th>英文（主 + 同义变体）</th><th>作用范围</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
          terms.map(function (t) {
            var vs = Store.termVariants(t);
            var chips = vs.map(function (v) { return '<span class="term-chip">' + H.esc(v) + "</span>"; }).join("");
            return "<tr><td><b>" + H.esc(t.term_zh) + "</b></td><td>" + chips + "</td><td>" + H.esc(t.scope || "all") + "</td>" +
              "<td>" + (t.enabled !== 0 ? '<span class="badge state-ok">启用</span>' : '<span class="badge ghost">停用</span>') + "</td>" +
              '<td><button class="btn sm" data-edit="' + H.esc(t.term_en) + '">编辑</button> ' +
              '<button class="btn sm" data-tog="' + H.esc(t.term_en) + '">' + (t.enabled !== 0 ? "停用" : "启用") + "</button> " +
              '<button class="btn sm danger" data-del="' + H.esc(t.term_en) + '">删除</button></td></tr>';
          }).join("") + "</tbody></table></div>"
          : '<div class="empty"><b>术语库为空</b>可先加入无人机/反无人机/巡飞弹等常用军语，或在阅读时一键「提取本篇术语」。</div>') +
        "</div>" +
        '<div class="note">用法：阅读文章时点「提取本篇术语」→ 术语进「待确认」→ 采纳并入词库。一个概念可录多个英文变体（如 drone / UAV），译到任一都按同一条规范译名。预置可自行增删：drone/UAV→无人机；counter-UAS/counter-drone→反无人机；loitering munition→巡飞弹；ground-based radar→地面雷达；defense budget→防务预算；think tank→智库。（老词表中译法重复的多条会在进入本页时自动归并）</div>';

      el.querySelector("#tAdd").addEventListener("click", function () { editModal(null); });
      el.querySelector("#tMerge").addEventListener("click", function () {
        Store.mergeTermsByZh().then(function (n) { App.toast(n > 0 ? "已归并 " + n + " 条重复译法" : "无重复需要归并", "ok"); App.refresh(); });
      });
      el.querySelector("#tBatch").addEventListener("click", batchExtract);
      el.querySelectorAll("[data-adopt]").forEach(function (b) {
        b.addEventListener("click", function () {
          Store.adoptCand(b.dataset.adopt).then(function (ok) {
            if (ok) { App.toast("已并入术语库", "ok"); App.refresh(); }
          });
        });
      });
      el.querySelectorAll("[data-ign]").forEach(function (b) {
        b.addEventListener("click", function () { Store.candRemove(b.dataset.ign); App.toast("已忽略"); App.refresh(); });
      });
      el.querySelectorAll("[data-edit]").forEach(function (b) {
        b.addEventListener("click", function () {
          var t = terms.find(function (x) { return x.term_en === b.dataset.edit; });
          editModal(t);
        });
      });
      el.querySelectorAll("[data-tog]").forEach(function (b) {
        b.addEventListener("click", function () {
          var t = terms.find(function (x) { return x.term_en === b.dataset.tog; });
          t.enabled = t.enabled !== 0 ? 0 : 1;
          Store.putTerm(t).then(function () { App.refresh(); });
        });
      });
      el.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          App.confirm("删除术语「" + b.dataset.del + "」？").then(function (ok) {
            if (ok) Store.deleteTerm(b.dataset.del).then(function () { App.toast("已删除"); App.refresh(); });
          });
        });
      });

      function editModal(t) {
        var isNew = !t;
        t = t || { term_en: "", term_zh: "", scope: "all", en_variants: [], enabled: 1, source: "" };
        var variants = isNew ? "" : (t.en_variants || []).join("\n");
        App.openModal(
          '<div class="modal-head"><h3>' + (isNew ? "新增概念" : "编辑概念") + '</h3><button class="btn sm" data-close>×</button></div>' +
          '<div class="modal-body">' +
          '<div class="field"><label>规范译名（中文）</label><input id="tZh" value="' + H.esc(t.term_zh) + '"></div>' +
          '<div class="field"><label>英文主形式</label><input id="tEn" value="' + H.esc(t.term_en) + '"' + (isNew ? "" : " disabled") + '></div>' +
          '<div class="field"><label>同义英文变体（每行一个，如 drone / unmanned aerial vehicle）</label><textarea id="tVs" rows="3">' + H.esc(variants) + "</textarea></div>" +
          '<div class="field"><label>作用范围</label><select id="tSc"><option value="all"' + (t.scope === "all" ? " selected" : "") + ">all（全部翻译）</option>" +
          Object.keys(LLM.CHANNEL_ZH).map(function (k) {
            return '<option value="channel:' + k + '"' + (t.scope === "channel:" + k ? " selected" : "") + ">" + H.esc(k) + "</option>";
          }).join("") + "</select></div>" +
          '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="tOn"' + (t.enabled !== 0 ? " checked" : "") + "> 启用</label>" +
          '<div class="modal-actions"><button class="btn" data-close>取消</button><button class="btn primary" id="tSave">保存</button></div></div>'
        );
        var box = document.getElementById("modalBox");
        box.querySelector("#tSave").addEventListener("click", function () {
          var zh = box.querySelector("#tZh").value.trim();
          var en = box.querySelector("#tEn").value.trim().replace(/\s+/g, " ");
          var vs = box.querySelector("#tVs").value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
          if (!en || !zh) { App.toast("英文主形式与规范译名必填", "err"); return; }
          if (vs.indexOf(en) >= 0) vs = vs.filter(function (v) { return v !== en; });
          var row = { term_en: en, term_zh: zh, en_variants: vs, scope: box.querySelector("#tSc").value, enabled: box.querySelector("#tOn").checked ? 1 : 0 };
          if (!isNew) row.term_en = t.term_en;
          Store.putTerm(row).then(function () { App.closeModal(); App.toast("已保存"); App.refresh(); });
        });
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  window.WB.modules.terms = M;
})();