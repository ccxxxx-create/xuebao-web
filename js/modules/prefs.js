/* modules/prefs.js —— 兴趣中心：关键词 / 喜好学习 / 偏好档案 / 自动提炼草稿（价值排序 P1） */
(function () {
  "use strict";
  var EN_STOP = new Set(("the a an and or of to in for on with at by from as is are was were be been this that these those it its their our your we you i they he she not no but so what when where who how about into over under between through during after before against more most some any all each both few such than then them").split(" "));

  var M = {
    key: "prefs",
    label: "兴趣",
    async render(el) {
      var s = Store.settings;
      var kwArr = H.splitKeywords(s.interestKeywords || "");
      var all = await Store.getAllArticles();
      var favs = all.filter(function (a) { return a.fav; });
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">兴趣中心</h1>' +
        '<p class="view-sub">价值排序 P1：偏好档案（纯统计）＋ 关键词自动提炼（供挑选，不自动生效）</p></div></div>' +
        keywordCard(s, kwArr) +
        learnCard(s) +
        profileCard(s) +
        draftCard(favs.length, kwArr);

      bind(el, s, kwArr, favs);

      function keywordCard(s, arr) {
        return '<div class="card"><h3>我的关键词</h3>' +
          '<p class="muted">命中后资料库/收藏夹显示「相关 N」角标。模糊匹配：任意位置出现即算相关，多个为“或”，宁宽勿严。</p>' +
          '<div class="field"><label>点击标签删除；输入后回车或点“添加”</label>' +
          '<div class="kw-tags" id="kwChips">' + arr.map(function (k) {
            return '<span class="kw-tag">' + H.esc(k) + '<button data-del="' + H.esc(k) + '" title="删除">×</button></span>';
          }).join("") + "</div>" +
          '<div style="display:flex;gap:8px"><input id="kwInput" placeholder="输入关键词，如：无人机 / aircraft carrier" style="flex:1">' +
          '<button class="btn" id="kwAdd">添加</button></div></div>' +
          '<div class="art-actions"><button class="btn primary" id="bfKwSave">保存关键词</button></div></div>';
      }
      function learnCard(s) {
        return '<div class="card"><h3>喜好学习（数据积累 · 可选）</h3>' +
          '<p class="muted">记录正向喜好（<b>收藏、生成学报</b>）；取消收藏为中性、不记负反馈。“不感兴趣”负反馈与阅读时长弱正留大后期。</p>' +
          '<label style="display:flex;gap:6px;align-items:center;margin-bottom:8px"><input type="checkbox" id="bfLearn"' + (s.allowLearn ? " checked" : "") + "> 允许记录我的喜好（仅本机）</label>" +
          '<div class="art-actions"><button class="btn primary" id="bfLearnSave">保存</button>' +
          '<button class="btn" id="clrPref">清除行为记录</button></div>' +
          '<div id="bfPrefInfo" class="muted" style="margin-top:6px"></div></div>';
      }
      function profileCard(s) {
        return '<div class="card"><h3>我的偏好档案（纯统计 · 不排序）</h3><div id="pfStats" class="muted">计算中…</div></div>';
      }
      function draftCard(favN, arr) {
        var ready = favN >= 3;
        return '<div class="card"><h3>自动提炼关键词草稿（从收藏提炼，您来挑选）</h3>' +
          '<p class="muted">从收藏文章的标题/摘要中提炼候选词，按“覆盖文章数 → 出现次数”排序。提炼结果<b>不会自动加入</b>，勾选后再点加入。现有收藏 ' + favN +
          (arr.length ? " 篇" : "") + "；至少 3 篇即可提炼（越多越准）。</p>" +
          '<div class="art-actions">' +
          '<button class="btn primary" id="kwExtract"' + (favN >= 3 ? "" : " disabled") + ">" + (favN >= 3 ? "开始提炼" : "收藏不足 3 篇，暂不可用") + "</button>" +
          '<button class="btn" id="kwExtClear">清空候选</button></div>' +
          '<div id="kwExtList" class="muted" style="margin-top:8px"></div></div>';
      }
      function bind(root, s, kwArr, favs) {
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
          App.toast("关键词已保存，相关角标已生效", "ok");
          App.refresh();
        });
        // 喜好学习
        function refreshPrefInfo() {
          var st = Store.getPrefStats();
          root.querySelector("#bfPrefInfo").innerHTML =
            '正向信号 ' + (st.fav + st.journal) + " 条（收藏 " + st.fav + " · 生成学报 " + st.journal +
            (st.total > st.fav + st.journal ? " · 中性记录 " + (st.total - st.fav - st.journal) + " 条" : "") +
            (s.allowLearn ? "）· 学习开关：开" : "）· 学习开关：关");
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
        // 偏好档案
        renderProfile();
        function renderProfile() {
          var pf = root.querySelector("#pfStats");
          if (!pf) return;
          var ch = {};
          favs.forEach(function (a) {
            var k = a.channelName || a.channel || "未知";
            ch[k] = (ch[k] || 0) + 1;
          });
          var topCh = Object.keys(ch).sort(function (a, b) { return ch[b] - ch[a]; }).slice(0, 3)
            .map(function (k) { return H.esc(k) + " " + ch[k]; }).join("；");
          var hits = favs.filter(function (a) { return H.kwScore(kwArr, a).score > 0; }).length;
          pf.innerHTML =
            '收藏 <b>' + favs.length + "</b> 篇 · 已出刊（信号）由上方记录显示 · 关键词命中收藏 <b>" + hits +
            "</b> 篇<br>最常收藏信源：" + (topCh || "暂无") +
            "<br><span class=\"muted\">提示：此页仅做本机统计，不自动改变任何排序；P2 双榜页上线后可在此核对口径。</span>";
        }
        // 自动提炼草稿
        root.querySelector("#kwExtract").addEventListener("click", function () { runExtract(); });
        root.querySelector("#kwExtClear").addEventListener("click", function () {
          root.querySelector("#kwExtList").innerHTML = "";
        });
        function runExtract() {
          var box = root.querySelector("#kwExtList");
          if (!favs.length) { box.innerHTML = "还没有收藏，先去收藏几篇吧。"; return; }
          var have = {}; kwArr.forEach(function (k) { have[k] = 1; });
          var en = {}, zh2 = {};
          function bump(map, key, docId) {
            if (!key || key.length < 2) return;
            var e = map[key] || (map[key] = { n: 0, docs: {} });
            e.n++;
            e.docs[docId] = 1;
          }
          favs.forEach(function (a) {
            var id = a.url;
            var enTxt = ((a.title || "") + " " + (a.summary || "") + " " + (a.summaryEn || "")).toLowerCase();
            var zhTxt = (a.titleZh || "") + " " + (a.summaryZh || "");
            var toks = enTxt.match(/[a-z][a-z0-9\-]{2,}/g) || [];
            toks.forEach(function (t) {
              if (t.length < 4 || EN_STOP.has(t) || /^\d+$/.test(t)) return;
              bump(en, t, id);
            });
            var zhRun = zhTxt.replace(/[^\u4e00-\u9fff]/g, "");
            if (zhRun) {
              for (var i = 0; i + 2 <= zhRun.length; i++) bump(zh2, zhRun.slice(i, i + 2), id);
            }
          });
          var items = [];
          Object.keys(en).forEach(function (k) {
            var e = en[k];
            if (Object.keys(e.docs).length >= 1) items.push({ label: k, docs: Object.keys(e.docs).length, n: e.n, zh: false });
          });
          Object.keys(zh2).forEach(function (k) {
            var e = zh2[k];
            var docs = Object.keys(e.docs).length;
            if (docs >= 2 && /[的了是在与和及或一不]/.test(k[k.length - 1]) === false) items.push({ label: k, docs: docs, n: e.n, zh: true });
          });
          items.sort(function (a, b) { return (b.docs - a.docs) || (b.n - a.n); });
          var pick = items.filter(function (i) { return !have[i.label]; }).slice(0, 30);
          if (!pick.length) { box.innerHTML = "暂无新候选词（都已在你的关键词里或收藏太少）。"; return; }
          var rows = pick.map(function (i, idx) {
            return '<label style="display:flex;gap:8px;align-items:flex-start;margin-bottom:4px"><input type="checkbox" class="ext-chk" value="' + H.esc(i.label) + '">' +
              '<span style="flex:1"><b>' + H.esc(i.label) + '</b> <span class="muted">' + (i.zh ? "中文词组" : "English") + " · 覆盖 " + i.docs + " 篇 · 出现 " + i.n + " 次</span></span></label>";
          }).join("");
          box.innerHTML =
            '<div class="art-actions" style="margin-bottom:6px"><button class="btn sm" id="extAddSel">加入选中的到“我的关键词”</button>' +
            '<button class="btn sm" id="extAll">全选</button>' +
            '<button class="btn sm" id="extNone">全不选</button></div><div>' + rows + "</div>";
          box.querySelector("#extAll").addEventListener("click", function () {
            box.querySelectorAll(".ext-chk").forEach(function (c) { c.checked = true; });
          });
          box.querySelector("#extNone").addEventListener("click", function () {
            box.querySelectorAll(".ext-chk").forEach(function (c) { c.checked = false; });
          });
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
        }
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  window.WB.modules.prefs = M;
})();
