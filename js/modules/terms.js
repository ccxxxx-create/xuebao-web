/* modules/terms.js —— 术语库（本设备维护，翻译/编译时注入提示词） */
(function () {
  "use strict";

  var M = {
    key: "terms",
    label: "术语",
    async render(el) {
      var terms = await Store.getAllTerms();
      terms = terms.slice().sort(function (a, b) { return (b.enabled || 0) - (a.enabled || 0); });
      var on = terms.filter(function (t) { return t.enabled !== 0; }).length;
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">术语库</h1>' +
        '<p class="view-sub">启用 ' + on + " / 共 " + terms.length + " 条 · 翻译与学报编译时，命中的词条会注入提示词并按词表译法执行</p></div>" +
        '<div class="head-actions"><button class="btn primary" id="tAdd">+ 新增词条</button></div></div>' +
        '<div class="card">' +
        (terms.length
          ? '<div class="tbl-wrap"><table class="data"><thead><tr><th>原文术语</th><th>固定译法</th><th>作用范围</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
          terms.map(function (t) {
            return "<tr><td><b>" + H.esc(t.term_en) + "</b></td><td>" + H.esc(t.term_zh) + "</td><td>" + H.esc(t.scope || "all") + "</td>" +
              "<td>" + (t.enabled !== 0 ? '<span class="badge state-ok">启用</span>' : '<span class="badge ghost">停用</span>') + "</td>" +
              '<td><button class="btn sm" data-edit="' + H.esc(t.term_en) + '">编辑</button> ' +
              '<button class="btn sm" data-tog="' + H.esc(t.term_en) + '">' + (t.enabled !== 0 ? "停用" : "启用") + "</button> " +
              '<button class="btn sm danger" data-del="' + H.esc(t.term_en) + '">删除</button></td></tr>';
          }).join("") + "</tbody></table></div>"
          : '<div class="empty"><b>术语库为空</b>可先加入无人机/反无人机/巡飞弹等常用军语。</div>') +
        "</div>" +
        '<div class="note">示例预置建议（可自行增删）：drone/UAV→无人机；counter-UAS/counter-drone→反无人机；loitering munition→巡飞弹；net capture→网捕；ground-based radar→地面雷达；defense budget→防务预算；think tank→智库。</div>';

      el.querySelector("#tAdd").addEventListener("click", function () { editModal(null); });
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
          App.confirm("删除词条「" + b.dataset.del + "」？").then(function (ok) {
            if (ok) Store.deleteTerm(b.dataset.del).then(function () { App.toast("已删除"); App.refresh(); });
          });
        });
      });

      function editModal(t) {
        var isNew = !t;
        t = t || { term_en: "", term_zh: "", scope: "all", enabled: 1 };
        App.openModal(
          '<div class="modal-head"><h3>' + (isNew ? "新增词条" : "编辑词条") + '</h3><button class="btn sm" data-close>×</button></div>' +
          '<div class="modal-body">' +
          '<div class="field"><label>原文术语（英文）</label><input id="tEn" value="' + H.esc(t.term_en) + '"' + (isNew ? "" : " disabled") + "></div>" +
          '<div class="field"><label>固定译法（中文）</label><input id="tZh" value="' + H.esc(t.term_zh) + '"></div>' +
          '<div class="field"><label>作用范围</label><select id="tSc"><option value="all"' + (t.scope === "all" ? " selected" : "") + ">all（全部翻译）</option>" +
          Object.keys(LLM.CHANNEL_ZH).map(function (k) {
            return '<option value="channel:' + k + '"' + (t.scope === "channel:" + k ? " selected" : "") + ">" + H.esc(k) + "</option>";
          }).join("") + "</select></div>" +
          '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="tOn"' + (t.enabled !== 0 ? " checked" : "") + "> 启用</label>" +
          '<div class="modal-actions"><button class="btn" data-close>取消</button><button class="btn primary" id="tSave">保存</button></div></div>'
        );
        var box = document.getElementById("modalBox");
        box.querySelector("#tSave").addEventListener("click", function () {
          var en = box.querySelector("#tEn").value.trim();
          var zh = box.querySelector("#tZh").value.trim();
          if (!en || !zh) { App.toast("原文术语与译法必填", "err"); return; }
          var row = { term_en: en, term_zh: zh, scope: box.querySelector("#tSc").value, enabled: box.querySelector("#tOn").checked ? 1 : 0 };
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
