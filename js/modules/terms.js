/* modules/terms.js —— 术语库（概念化：规范译名 + 多英文变体；候选采集 + 同译法自动归并）
   数据模型：term_en 为主键(主形式) + term_zh 规范译名 + en_variants[] 同义英文变体 + scope/note/source/enabled */
(function () {
  "use strict";

  var EX_KEY = "xuebao-term-extracted";   // 已批量提炼过的文章 url（防重复烧模型）

  /* ── 预置军事术语种子词库（概念化：规范译名 + 多英文变体）──
     依据美军官方术语标准 JP 1-02《Department of Defense Dictionary of Military
     and Associated Terms》及军事新闻通行译法整理。冷启动种子：首次打开术语库且库为空
     时自动导入一次；可自行增删启用。字段：zh=规范译名, en=主英文形式, vs=同义变体 */
  var SEED_TERMS = [
    // —— 无人系统 / 无人机 ——
    { zh: "无人机", en: "UAV", vs: ["unmanned aerial vehicle", "drone", "unmanned aircraft", "UAS", "unmanned aerial system", "uncrewed aerial vehicle", "RPV", "remotely piloted vehicle"] },
    { zh: "反无人机", en: "counter-UAS", vs: ["counter-drone", "counter-UAV", "counter-unmanned aircraft system", "C-UAS", "anti-drone", "counter-UAS systems"] },
    { zh: "巡飞弹", en: "loitering munition", vs: ["loitering missile", "kamikaze drone", "suicide drone", "one-way attack drone", "loitering ammunition", "fire-and-forget loitering munition"] },
    { zh: "察打一体无人机", en: "unmanned combat aerial vehicle", vs: ["UCAV", "combat drone", "armed drone", "combat unmanned aerial vehicle"] },
    { zh: "侦察无人机", en: "reconnaissance drone", vs: ["reconnaissance UAV", "surveillance drone", "ISR drone"] },
    { zh: "无人舰艇", en: "unmanned surface vessel", vs: ["USV", "uncrewed surface vessel", "autonomous surface vessel"] },
    { zh: "无人潜航器", en: "unmanned underwater vehicle", vs: ["UUV", "autonomous underwater vehicle", "AUV", "uncrewed underwater vehicle"] },
    { zh: "垂直起降", en: "VTOL", vs: ["vertical take-off and landing", "vertical takeoff and landing", "eVTOL"] },
    // —— 作战 / 能力 ——
    { zh: "精确打击", en: "precision strike", vs: ["precision engagement", "precision-guided strike", "standoff precision strike"] },
    { zh: "反介入/区域拒止", en: "anti-access/area denial", vs: ["A2/AD", "anti-access area denial", "counter-intervention area denial"] },
    { zh: "兵力投送", en: "force projection", vs: ["power projection", "projection of force"] },
    { zh: "联合作战", en: "joint operation", vs: ["joint operations", "combined joint operation"] },
    { zh: "多域作战", en: "multi-domain operation", vs: ["multi-domain operations", "MDO", "multidomain operation"] },
    { zh: "海上拒止", en: "sea denial", vs: ["anti-ship", "sea denial operation"] },
    { zh: "岛屿作战", en: "island operation", vs: ["island campaign", "island-hopping operation"] },
    { zh: "分布式作战", en: "distributed operations", vs: ["distributed operation", "dispersed operations"] },
    { zh: "网捕", en: "net capture", vs: ["net-capture", "capture net", "interceptor net"] },
    { zh: "电子战", en: "electronic warfare", vs: ["EW", "electronic warfare operations"] },
    { zh: "电子对抗", en: "electronic countermeasure", vs: ["ECM", "electronic countermeasures"] },
    { zh: "电子侦察", en: "electronic reconnaissance", vs: ["electronic reconnaissance equipment", "electronic intelligence", "ELINT"] },
    { zh: "电磁频谱战", en: "electromagnetic spectrum warfare", vs: ["EMS warfare", "electromagnetic spectrum operations"] },
    { zh: "信息化作战", en: "information warfare", vs: ["IW", "information operation"] },
    // —— 军种 / 机构 ——
    { zh: "美国国防部", en: "Department of Defense", vs: ["DoD", "DOD", "the Pentagon", "Pentagon", "Department of Defense (DoD)"] },
    { zh: "五角大楼", en: "the Pentagon", vs: ["Pentagon"] },
    { zh: "美国海军陆战队", en: "United States Marine Corps", vs: ["USMC", "Marine Corps", "U.S. Marine Corps"] },
    { zh: "美国海军", en: "United States Navy", vs: ["US Navy", "U.S. Navy", "USN"] },
    { zh: "美国空军", en: "United States Air Force", vs: ["USAF", "U.S. Air Force"] },
    { zh: "美国陆军", en: "United States Army", vs: ["US Army", "U.S. Army"] },
    { zh: "海军陆战队远征部队", en: "Marine Expeditionary Force", vs: ["MEF", "Marine Expeditionary Unit", "MEU", "Expeditionary Force"] },
    { zh: "战区司令部", en: "combatant command", vs: ["CCMD", "unified combatant command", "theater command"] },
    { zh: "印太司令部", en: "U.S. Indo-Pacific Command", vs: ["INDOPACOM", "USINDOPACOM", "Indo-Pacific Command", "United States Indo-Pacific Command"] },
    { zh: "中央司令部", en: "U.S. Central Command", vs: ["CENTCOM", "Central Command"] },
    { zh: "欧洲司令部", en: "U.S. European Command", vs: ["EUCOM", "European Command"] },
    { zh: "太平洋空军", en: "Pacific Air Forces", vs: ["PACAF"] },
    { zh: "太平洋舰队", en: "U.S. Pacific Fleet", vs: ["PACFLT", "United States Pacific Fleet"] },
    { zh: "陆军国民警卫队", en: "Army National Guard", vs: ["ARNG", "National Guard"] },
    { zh: "特种作战司令部", en: "Special Operations Command", vs: ["SOCOM", "USSOCOM", "special operations command"] },
    { zh: "特种作战部队", en: "special operations forces", vs: ["SOF", "special forces"] },
    // —— 装备 / 平台 ——
    { zh: "防空系统", en: "air defense system", vs: ["air defense", "anti-air defense", "air-defence system", "integrated air defense system", "IADS"] },
    { zh: "导弹防御系统", en: "missile defense system", vs: ["missile defense", "ballistic missile defense", "BMD"] },
    { zh: "弹道导弹", en: "ballistic missile", vs: ["BM", "ballistic missiles"] },
    { zh: "巡航导弹", en: "cruise missile", vs: ["CM", "cruise missiles"] },
    { zh: "高超音速导弹", en: "hypersonic missile", vs: ["hypersonic cruise missile", "hypersonic glide vehicle", "HGV", "hypersonic weapon"] },
    { zh: "反舰导弹", en: "anti-ship missile", vs: ["anti-ship cruise missile", "ASCM", "ship-killer missile"] },
    { zh: "反坦克导弹", en: "anti-tank missile", vs: ["ATGM", "anti-tank guided missile"] },
    { zh: "空对地导弹", en: "air-to-surface missile", vs: ["ASM", "air-to-ground missile", "air-launched cruise missile", "ALCM"] },
    { zh: "地对空导弹", en: "surface-to-air missile", vs: ["SAM", "surface-to-air missile system"] },
    { zh: "航母打击群", en: "carrier strike group", vs: ["CSG", "carrier battle group"] },
    { zh: "两栖戒备群", en: "amphibious ready group", vs: ["ARG", "amphibious ready group (ARG)"] },
    { zh: "濒海战斗舰", en: "littoral combat ship", vs: ["LCS"] },
    { zh: "阿利·伯克级驱逐舰", en: "Arleigh Burke-class destroyer", vs: ["Arleigh Burke destroyer", "Arleigh Burke-class guided-missile destroyer", "DDG-51 class"] },
    { zh: "隐形战斗机", en: "stealth fighter", vs: ["stealth fighter jet", "stealth aircraft", "stealth jet"] },
    { zh: "第五代战斗机", en: "fifth-generation fighter", vs: ["5th-generation fighter", "fifth generation fighter aircraft", "5th-gen fighter"] },
    { zh: "预警机", en: "airborne early warning", vs: ["AEW", "airborne early warning and control", "AWACS"] },
    { zh: "电子战飞机", en: "electronic warfare aircraft", vs: ["EW aircraft", "electronic attack aircraft", "electronic warfare plane"] },
    // —— 概念 / 术语 ——
    { zh: "防务预算", en: "defense budget", vs: ["defence budget", "military budget", "defense spending", "defence spending"] },
    { zh: "国防开支", en: "defense spending", vs: ["defence spending", "military expenditure", "defense expenditure"] },
    { zh: "智库", en: "think tank", vs: ["think tank institution", "research institute", "policy institute"] },
    { zh: "军事演习", en: "military exercise", vs: ["joint exercise", "military drill", "exercises"] },
    { zh: "联合军事演习", en: "joint military exercise", vs: ["combined exercise", "joint exercise"] },
    { zh: "军售", en: "arms sale", vs: ["weapons sale", "foreign military sale", "FMS", "arms sales"] },
    { zh: "对外军售", en: "Foreign Military Sale", vs: ["FMS", "foreign military sales"] },
    { zh: "军事援助", en: "military aid", vs: ["military assistance", "security assistance"] },
    { zh: "兵力态势", en: "force posture", vs: ["military posture", "force posturing", "posture"] },
    { zh: "前沿部署", en: "forward deployment", vs: ["forward-deployed", "forward presence"] },
    { zh: "战略竞争", en: "strategic competition", vs: ["great power competition", "major power competition"] },
    { zh: "战略威慑", en: "strategic deterrence", vs: ["deterrence", "extended deterrence", "nuclear deterrence"] },
    { zh: "威慑力", en: "deterrence", vs: ["deterrent", "deterrence capability"] },
    { zh: "台湾海峡", en: "Taiwan Strait", vs: ["Taiwan Straits", "the Strait of Taiwan"] },
    { zh: "南海", en: "South China Sea", vs: ["South China Sea (SCS)", "SCS"] },
    { zh: "东海", en: "East China Sea", vs: ["ECS"] },
    { zh: "第一岛链", en: "first island chain", vs: ["first island chain (FIC)"] },
    { zh: "第二岛链", en: "second island chain", vs: [] },
    { zh: "灰色地带", en: "gray zone", vs: ["grey zone", "gray-zone warfare", "gray zone operation"] },
    { zh: "红线", en: "red line", vs: ["red line (diplomacy)"] },
    { zh: "态势感知", en: "situational awareness", vs: ["situation awareness", "SA"] },
    { zh: "指挥控制", en: "command and control", vs: ["C2", "command & control", "command-and-control"] },
    { zh: "情报监视侦察", en: "ISR", vs: ["intelligence, surveillance, and reconnaissance", "intelligence surveillance and reconnaissance", "intelligence surveillance reconnaissance"] },
    { zh: "目标识别", en: "target identification", vs: ["target identification (ID)", "friend-or-foe identification", "IFF"] },
    { zh: "空域管制", en: "airspace control", vs: ["airspace management", "ATC", "air traffic control"] },
    { zh: "作战半径", en: "combat radius", vs: ["operational range", "range"] },
    { zh: "后勤保障", en: "logistics support", vs: ["logistics", "sustainment"] },
    { zh: "补给线", en: "supply line", vs: ["supply route", "logistics line", "line of communication"] },
    { zh: "弹药库", en: "ammunition depot", vs: ["ammunition storage", "weapons depot", "ordinance depot"] },
    { zh: "基地", en: "military base", vs: ["base", "installation", "military installation"] }
  ];

  var SEED_KEY = "xuebao-term-seeded";   // 已导入过种子词库（仅一次，防止清库后被重复导入）
  function seedIfEmpty() {
    var seeded = 0;
    try { seeded = parseInt(localStorage.getItem(SEED_KEY), 10) || 0; } catch (e) {}
    if (seeded) return Promise.resolve(0);
    return Store.getAllTerms().then(function (terms) {
      if (!terms.length) {
        var rows = SEED_TERMS.map(function (s) {
          var seen = {};
          var vs = (s.vs || []).filter(function (v) {
            var k = (v || "").trim().toLowerCase();
            if (!k || k === s.en.toLowerCase() || seen[k]) return false;
            seen[k] = true;
            return true;
          });
          return { term_en: s.en, term_zh: s.zh, en_variants: vs, scope: "all", source: "JP 1-02 军事术语种子", enabled: 1 };
        });
        return Store.bulkPutTerms(rows).then(function () { return rows.length; });
      }
      return 0;
    }).then(function (n) {
      try { localStorage.setItem(SEED_KEY, "1"); } catch (e) {}
      return n;
    });
  }

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
      // 冷启动种子：首次打开术语库且库为空时，自动导入预置军事术语词库（仅一次，用户自行增删）
      await seedIfEmpty();
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