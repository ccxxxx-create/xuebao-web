/* modules/prefs.js —— 兴趣中心（子页切换）：我的关键词 / 喜好学习 / 偏好档案 / 自动提炼草稿 */
(function () {
  "use strict";
  var state = { tab: "kw" };
  var EN_STOP = new Set(("the a an and or of to in for on with at by from as is are was were be been this that these those it its their our your we you i they he she not no but so what when where who how about into over under between through during after before against more most some any all each both few such than then them").split(" "));

  var TABS = [
    { id: "kw", label: "我的关键词" },
    { id: "learn", label: "喜好学习" },
    { id: "profile", label: "偏好档案" },
    { id: "draft", label: "关键词草稿" }
  ];

  var M = {
    key: "prefs",
    label: "兴趣",
    async render(el) {
      var s = Store.settings;
      var kwArr = H.splitKeywords(s.interestKeywords || "");
      var all = await Store.getAllArticles();
      var favs = all.filter(function (a) { return a.fav; });
      var KW_COLLAPSE = 12;   // 超过 N 个关键词先折叠，点“还有 M 个”展开
      var kwOpen = false;
      function kwTag(k) { return '<span class="kw-tag">' + H.esc(k) + '<button data-del="' + H.esc(k) + '">×</button></span>'; }
      function chipHtml() {
        if (kwArr.length <= KW_COLLAPSE) return kwArr.map(kwTag).join("");
        var shown = kwOpen ? kwArr : kwArr.slice(0, KW_COLLAPSE);
        return shown.map(kwTag).join("") +
          '<span class="kw-tag kw-more" data-more>' + (kwOpen ? "收起（共 " + kwArr.length + " 个）" : "＋ 还有 " + (kwArr.length - KW_COLLAPSE) + " 个") + "</span>";
      }
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">兴趣中心</h1>' +
        '<p class="view-sub">选择上方入口进入对应小界面</p></div></div>' +
        '<div class="maintabs" role="tablist" aria-label="兴趣中心功能切换">' + TABS.map(function (t) {
          return '<button role="tab" aria-selected="' + (state.tab === t.id ? "true" : "false") + '" class="' + (state.tab === t.id ? "active" : "") + '" data-tab="' + t.id + '">' + t.label + "</button>";
        }).join("") + "</div>" +
        '<div id="prefBody">' + bodyHtml() + "</div>";

      bindChips(el);
      bindSub(el, favs, kwArr);

      function bodyHtml() {
        if (state.tab === "kw") return kwCard();
        if (state.tab === "learn") return learnCard();
        if (state.tab === "profile") return '<div class="card"><h3>我的偏好档案（纯统计 · 不排序）</h3><div id="pfStats" class="muted">计算中…</div></div>';
        return draftCard(favs.length);
      }
      function kwCard() {
        return '<div class="card"><h3>我的关键词</h3>' +
          '<p class="muted">命中后资料库/收藏夹显示「相关 N」角标。模糊匹配：任意位置出现即算相关，多个为“或”。</p>' +
          '<div class="field"><label>点击标签删除；输入后回车加入，再点下方「保存关键词」生效</label>' +
          '<div class="kw-tags" id="kwChips">' + chipHtml() + "</div>" +
          '<input id="kwInput" placeholder="输入关键词，如：无人机 / aircraft carrier" style="width:100%"></div>' +
          '<div class="art-actions"><button class="btn primary" id="bfKwSave">保存关键词</button></div></div>';
      }
      function learnCard() {
        return '<div class="card"><h3>喜好学习（数据积累 · 可选）</h3>' +
          '<p class="muted">记录正向喜好（<b>收藏、生成学报</b>）；取消收藏为中性；“不感兴趣”与阅读时长弱正留大后期。</p>' +
          '<label style="display:flex;gap:6px;align-items:center;margin-bottom:8px"><input type="checkbox" id="bfLearn"' + (s.allowLearn ? " checked" : "") + "> 允许记录我的喜好（仅本机）</label>" +
          '<div class="art-actions"><button class="btn primary" id="bfLearnSave">保存</button>' +
          '<button class="btn" id="clrPref">清除行为记录</button></div>' +
          '<div id="bfPrefInfo" class="muted" style="margin-top:6px"></div></div>';
      }
      function draftCard(favN) {
        var ok = favN >= 3;
        return '<div class="card"><h3>自动提炼关键词草稿</h3>' +
          '<p class="muted">从收藏文章的标题/摘要提炼候选词（覆盖文章数优先）。结果<b>不自动加入</b>，勾选后点加入。当前收藏 ' + favN + " 篇（≥3 可提炼，越多越准）。</p>" +
          '<div class="art-actions">' +
          '<button class="btn primary" id="kwExtract"' + (ok ? "" : " disabled") + ">" + (ok ? "开始提炼" : "收藏不足 3 篇") + "</button>" +
          '<button class="btn" id="kwExtClear">清空候选</button></div>' +
          '<div id="kwExtList" class="muted" style="margin-top:8px"></div></div>';
      }
      function bindChips(root) {
        root.querySelectorAll("[data-tab]").forEach(function (b) {
          b.addEventListener("click", function () {
            state.tab = b.dataset.tab;
            App.refresh();
          });
        });
      }
      function bindSub(root, favs, kwArr) {
        var chips = root.querySelector("#kwChips"), input = root.querySelector("#kwInput");
        if (!chips) { bindLearn(); bindProfile(); bindDraft(); return; }
        function renderChips() {
          chips.innerHTML = chipHtml();
          var more = chips.querySelector("[data-more]");
          if (more) more.addEventListener("click", function () { kwOpen = !kwOpen; renderChips(); });
        }
        function addKw(t) {
          t = String(t || "").trim().toLowerCase();
          if (!t) return;
          if (kwArr.indexOf(t) < 0) kwArr.push(t);
          renderChips();
          input.value = "";
        }
        chips.addEventListener("click", function (e) {
          var b = e.target.closest("[data-del]");
          if (b) {
            kwArr = kwArr.filter(function (k) { return k !== b.dataset.del; });
            renderChips();
          }
        });
        input.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === ",") { ev.preventDefault(); addKw(input.value); }
        });
        root.querySelector("#bfKwSave").addEventListener("click", function () {
          // 移植"添加"功能：保存前先把输入框当前词加入
          addKw(input.value);
          s.interestKeywords = kwArr.join(",");
          Store.saveSettings();
          App.toast("关键词已保存", "ok");
          App.refresh();
        });
        bindLearn();
        bindProfile();
        bindDraft();
      }
      function bindLearn() {
        var learnBox = document.querySelector("#bfLearn");
        if (!learnBox) return;
        function refresh() {
          var st = Store.getPrefStats();
          var info = document.querySelector("#bfPrefInfo");
          if (info) info.innerHTML = "正向信号 " + (st.fav + st.journal) + " 条（收藏 " + st.fav + " · 生成学报 " + st.journal + "）· 学习开关：" + (s.allowLearn ? "开" : "关");
        }
        refresh();
        document.querySelector("#bfLearnSave").addEventListener("click", function () {
          s.allowLearn = learnBox.checked;
          Store.saveSettings();
          refresh();
          App.toast("已保存", "ok");
        });
        document.querySelector("#clrPref").addEventListener("click", function () {
          App.confirm("清除本机全部喜好行为记录？（不可恢复）").then(function (ok) {
            if (ok) { Store.clearPrefs(); refresh(); App.toast("已清除", "ok"); }
          });
        });
      }
      function bindProfile() {
        var pf = document.querySelector("#pfStats");
        if (!pf) return;
        var ch = {};
        var all2 = [];
        Store.getAllArticles().then(function (allA) {
          all2 = allA.filter(function (a) { return a.fav; });
          all2.forEach(function (a) {
            var k = a.channelName || a.channel || "未知";
            ch[k] = (ch[k] || 0) + 1;
          });
          var topCh = Object.keys(ch).sort(function (a, b) { return ch[b] - ch[a]; }).slice(0, 3)
            .map(function (k) { return H.esc(k) + " " + ch[k]; }).join("；");
          var hits = all2.filter(function (a) { return H.kwScore(H.splitKeywords(s.interestKeywords), a).score > 0; }).length;
          pf.innerHTML = "收藏 <b>" + all2.length + "</b> 篇 · 关键词命中收藏 <b>" + hits + "</b> 篇<br>最常收藏信源：" + (topCh || "暂无") +
            '<br><span class="muted">纯本机统计，不自动改变排序。</span>';
        });
      }
      function bindDraft() {
        var btn = document.querySelector("#kwExtract");
        if (!btn) return;
        var box = document.querySelector("#kwExtList");
        document.querySelector("#kwExtClear").addEventListener("click", function () { box.innerHTML = ""; });
        btn.addEventListener("click", function () {
          var have = {}; kwArr.forEach(function (k) { have[k] = 1; });
          var en = {}, zh2 = {};
          function bump(map, key, docId) {
            if (!key || key.length < 2) return;
            var e = map[key] || (map[key] = { n: 0, docs: {} });
            e.n++; e.docs[docId] = 1;
          }
          var favAll = [];
          Store.getAllArticles().then(function (allA) {
            favAll = allA.filter(function (a) { return a.fav; });
            favAll.forEach(function (a) {
              var id = a.url;
              var enTxt = ((a.title || "") + " " + (a.summary || "") + " " + (a.summaryEn || "")).toLowerCase();
              var zhTxt = (a.titleZh || "") + " " + (a.summaryZh || "");
              var toks = enTxt.match(/[a-z][a-z0-9\-]{2,}/g) || [];
              toks.forEach(function (t) {
                if (t.length < 4 || EN_STOP.has(t) || /^\d+$/.test(t)) return;
                bump(en, t, id);
              });
              var zhRun = zhTxt.replace(/[^\u4e00-\u9fff]/g, "");
              for (var i = 0; i + 2 <= zhRun.length; i++) bump(zh2, zhRun.slice(i, i + 2), id);
            });
            var items = [];
            Object.keys(en).forEach(function (k) {
              var e = en[k];
              if (Object.keys(e.docs).length >= 1) items.push({ label: k, docs: Object.keys(e.docs).length, n: e.n, zh: false });
            });
            Object.keys(zh2).forEach(function (k) {
              var e = zh2[k];
              var docs = Object.keys(e.docs).length;
              if (docs >= 2 && !/[的了是在与和及或一不]/.test(k[k.length - 1])) items.push({ label: k, docs: docs, n: e.n, zh: true });
            });
            items.sort(function (a, b) { return (b.docs - a.docs) || (b.n - a.n); });
            var pick = items.filter(function (i) { return !have[i.label]; }).slice(0, 30);
            if (!pick.length) { box.innerHTML = "暂无新候选（词都已在关键词里或收藏太少）。"; return; }
            box.innerHTML = '<div class="art-actions" style="margin-bottom:6px">' +
              '<button class="btn sm" id="extAddSel">加入选中的到“我的关键词”</button>' +
              '<button class="btn sm" id="extAll">全选</button><button class="btn sm" id="extNone">全不选</button></div><div>' +
              pick.map(function (i) {
                return '<label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:4px"><input type="checkbox" class="ext-chk" value="' + H.esc(i.label) + '"><span style="flex:1"><b>' + H.esc(i.label) + '</b> <span class="muted">' + (i.zh ? "中文词组" : "English") + " · 覆盖 " + i.docs + " 篇 · 出现 " + i.n + " 次</span></span></label>";
              }).join("") + "</div>";
            box.querySelector("#extAll").addEventListener("click", function () { box.querySelectorAll(".ext-chk").forEach(function (c) { c.checked = true; }); });
            box.querySelector("#extNone").addEventListener("click", function () { box.querySelectorAll(".ext-chk").forEach(function (c) { c.checked = false; }); });
            box.querySelector("#extAddSel").addEventListener("click", function () {
              var added = 0;
              box.querySelectorAll(".ext-chk:checked").forEach(function (c) {
                var v = c.value.trim().toLowerCase();
                if (v && kwArr.indexOf(v) < 0) { kwArr.push(v); added++; }
              });
              if (!added) { App.toast("未勾选任何新词"); return; }
              s.interestKeywords = kwArr.join(",");
              Store.saveSettings();
              App.toast("已加入 " + added + " 个关键词", "ok");
              App.refresh();
            });
          });
        });
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  M.state = state;
  window.WB.modules.prefs = M;
})();
