/* modules/prefs.js —— 兴趣中心：关键词（相关度排序）+ 喜好学习（价值排序数据） */
(function () {
  "use strict";

  var M = {
    key: "prefs",
    label: "兴趣",
    async render(el) {
      var s = Store.settings;
      var kwArr = H.splitKeywords(s.interestKeywords || "");
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">兴趣中心</h1>' +
        '<p class="view-sub">关键词决定“相关度角标/排序”；喜好学习为将来的价值排序积累数据（仅本机，可随时关闭/清除）</p></div></div>' +
        keywordCard(s, kwArr) +
        learnCard(s);

      bind(el, s, kwArr);

      function keywordCard(s, arr) {
        return '<div class="card"><h3>我的关键词（相关度排序）</h3>' +
          '<p class="muted">关键词是价值排序最重要的显式先验。命中后资料库/收藏夹显示「相关 N」角标，可在资料库切换「按相关度」排序。模糊匹配：标题/摘要/正文任意位置出现即算相关，多个关键词为“或”，宁宽勿严。</p>' +
          '<div class="field"><label>点击标签可删除；输入后回车或点“添加”</label>' +
          '<div class="kw-tags" id="kwChips">' + arr.map(function (k) {
            return '<span class="kw-tag">' + H.esc(k) + '<button data-del="' + H.esc(k) + '" title="删除">×</button></span>';
          }).join("") + "</div>" +
          '<div style="display:flex;gap:8px"><input id="kwInput" placeholder="输入关键词，如：无人机 / aircraft carrier" style="flex:1">' +
          '<button class="btn" id="kwAdd">添加</button></div>' +
          '<div class="muted" style="margin-top:6px">自动提炼草稿：需积累足够收藏后启用（价值排序 P1 阶段）。</div></div>' +
          '<div class="art-actions"><button class="btn primary" id="bfKwSave">保存关键词</button></div></div>';
      }
      function learnCard(s) {
        return '<div class="card"><h3>喜好学习（价值排序数据 · 可选）</h3>' +
          '<p class="muted">允许记录正向喜好（<b>收藏、生成学报</b>）作为学习信号。<b>取消收藏为中性操作、不视为负反馈</b>；价值排序引擎上线前仅做本机数据积累。另附独立「榜单/周末简报」入口（规划中）。</p>' +
          '<label style="display:flex;gap:6px;align-items:center;margin-bottom:8px"><input type="checkbox" id="bfLearn"' + (s.allowLearn ? " checked" : "") + "> 允许记录我的喜好（仅本机）</label>" +
          '<div class="art-actions"><button class="btn primary" id="bfLearnSave">保存</button>' +
          '<button class="btn" id="clrPref">清除行为记录</button></div>' +
          '<div id="bfPrefInfo" class="muted" style="margin-top:6px"></div></div>';
      }
      function bind(root, s, kwArr) {
        var chips = root.querySelector("#kwChips"), input = root.querySelector("#kwInput");
        function renderChips() {
          chips.innerHTML = kwArr.map(function (k) {
            return '<span class="kw-tag">' + H.esc(k) + '<button data-del="' + H.esc(k) + '" title="删除">×</button></span>';
          }).join("");
        }
        function addKw(t) {
          t = String(t || "").trim().toLowerCase();
          if (!t) return;
          if (kwArr.indexOf(t) < 0) kwArr.push(t);
          renderChips();
          input.value = "";
        }
        root.querySelector("#kwAdd").addEventListener("click", function () { addKw(input.value); });
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addKw(input.value); }
        });
        chips.addEventListener("click", function (e) {
          var b = e.target.closest("[data-del]");
          if (b) {
            kwArr = kwArr.filter(function (k) { return k !== b.dataset.del; });
            renderChips();
          }
        });
        root.querySelector("#bfKwSave").addEventListener("click", function () {
          s.interestKeywords = kwArr.join(",");
          Store.saveSettings();
          App.toast("关键词已保存，相关角标与排序已生效", "ok");
          App.refresh();
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
