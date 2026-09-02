/* modules/prefs.js —— 兴趣中心：关键词（相关度排序）+ 喜好学习（价值排序数据） */
(function () {
  "use strict";

  var M = {
    key: "prefs",
    label: "兴趣",
    async render(el) {
      var s = Store.settings;
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">兴趣中心</h1>' +
        '<p class="view-sub">关键词决定“相关度角标/排序”；喜好学习为将来的价值排序积累数据（仅本机，可随时关闭/清除）</p></div></div>' +
        keywordCard(s) +
        learnCard(s);

      bind(el, s);

      function keywordCard(s) {
        return '<div class="card"><h3>我的关键词（相关度排序）</h3>' +
          '<p class="muted">关键词是价值排序最重要的显式先验。命中后资料库/收藏夹卡片显示「相关 N」角标，并可在资料库切换「按相关度」排序。规则为<b>模糊匹配</b>：标题/摘要/正文任意位置出现即算相关，多个关键词为“或”，宁宽勿严。</p>' +
          '<div class="field"><label>兴趣关键词（中英文均可，逗号或空格分隔）</label>' +
          '<textarea id="bfKw" placeholder="例如：无人机, 导弹防御, aircraft carrier, 印太…">' + H.esc(s.interestKeywords || "") + "</textarea></div>" +
          '<div class="art-actions"><button class="btn primary" id="bfKwSave">保存关键词</button>' +
          '<button class="btn" id="kwDraft" title="需积累足够收藏后可用">从收藏自动提炼草稿（待数据累积）</button></div>' +
          '<div id="kwMsg" class="muted" style="margin-top:6px"></div></div>';
      }
      function learnCard(s) {
        return '<div class="card"><h3>喜好学习（价值排序数据 · 可选）</h3>' +
          '<p class="muted">允许记录正向喜好（<b>收藏、生成学报</b>）作为学习信号。<b>取消收藏为中性操作、不视为负反馈</b>；价值排序引擎上线前仅做本机数据积累。另附独立「榜单/周末简报」入口（规划中）。</p>' +
          '<label style="display:flex;gap:6px;align-items:center;margin-bottom:8px"><input type="checkbox" id="bfLearn"' + (s.allowLearn ? " checked" : "") + "> 允许记录我的喜好（仅本机）</label>" +
          '<div class="art-actions"><button class="btn primary" id="bfLearnSave">保存</button>' +
          '<button class="btn" id="clrPref">清除行为记录</button></div>' +
          '<div id="bfPrefInfo" class="muted" style="margin-top:6px"></div></div>';
      }
      function bind(root, s) {
        root.querySelector("#bfKwSave").addEventListener("click", function () {
          s.interestKeywords = root.querySelector("#bfKw").value.trim();
          Store.saveSettings();
          App.toast("关键词已保存，相关角标与排序已生效", "ok");
          App.refresh();
        });
        root.querySelector("#kwDraft").addEventListener("click", function () {
          root.querySelector("#kwMsg").textContent = "说明：需要积累更多收藏后，系统将从收藏文章自动提炼主题词草稿供您一键采纳（价值排序 P1 阶段提供）。";
        });
        function refreshPrefInfo() {
          var st = Store.getPrefStats();
          root.querySelector("#bfPrefInfo").innerHTML =
            '正向信号 ' + (st.fav + st.journal) + ' 条（收藏 ' + st.fav + ' · 生成学报 ' + st.journal +
            (st.total > st.fav + st.journal ? " · 另有中性记录 " + (st.total - st.fav - st.journal) + " 条" : "") +
            (s.allowLearn ? "）· 学习开关：开" : "）· 学习开关：关（暂不记录）");
        }
        refreshPrefInfo();
        root.querySelector("#bfLearnSave").addEventListener("click", function () {
          s.allowLearn = root.querySelector("#bfLearn").checked;
          Store.saveSettings();
          refreshPrefInfo();
          App.toast("喜好学习设置已保存", "ok");
        });
        root.querySelector("#clrPref").addEventListener("click", function () {
          App.confirm("清除本机全部喜好行为记录？（不可恢复）").then(function (ok) {
            if (ok) { Store.clearPrefs(); refreshPrefInfo(); App.toast("已清除行为记录", "ok"); }
          });
        });
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  window.WB.modules.prefs = M;
})();
