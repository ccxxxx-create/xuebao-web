/* modules/settings.js —— 设置：模型（在线 API）/ 显示字号 / 清理 / 行为 / 镜像 / 数据 / 关于 */
(function () {
  "use strict";

  function statusBadge(s) {
    var e = LLM.endpoint(s);
    var ok = !!(e.baseUrl && e.model && e.key);
    var p = s.provider === "preset" ? LLM.presetById(s.preset) : null;
    var label = p ? p.label : "自定义端点";
    return (ok
      ? '<span class="badge state-ok">模型已配置</span><span class="muted"> ' + H.esc(label) + " · " + H.esc(e.model) + "</span>"
      : '<span class="badge state-error">模型未配置</span><span class="muted"> 翻译标题/摘要、全文翻译、出刊需要在线模型</span>');
  }

  function mirrorStatusHtml(s) {
    // lastMirrorMeta 结构为扁平的 { channelId: {status, count, error, fetchedAt} }（与镜像 latest.json 的 meta 一致）
    var m = s.lastMirrorMeta || {};
    var keys = Object.keys(m);
    var rows = keys.length
      ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">' + keys.map(function (k) {
          var c = m[k] || {};
          var cnt = (c && c.count != null) ? c.count : "—";
          var cls = c && c.status === "ok" ? "" : " state-error";
          return '<span class="badge ghost' + cls + '">' + H.esc(LLM.CHANNEL_ZH[k] || k) + " " + H.esc(String(cnt)) + "</span>";
        }).join("") + "</div>"
      : '<div class="muted" style="margin-top:4px">（尚无明细，拉取一次镜像后显示各源条数）</div>';
    return '<p class="muted">上次拉取：' + (s.lastPullAt ? H.fmtDateTime(s.lastPullAt) + "（" + H.ago(s.lastPullAt) + "）" : "从未") +
      "<br>镜像数据时间：" + (s.lastMirrorUpdatedAt ? H.fmtDateTime(s.lastMirrorUpdatedAt) : "—") + "</p>" + rows;
  }

  function modelSectionHtml(s) {
    var isPreset = s.provider === "preset";
    var p = LLM.presetById(s.preset);
    var base = isPreset ? (s.presetBaseUrl || (p && p.baseUrl) || "") : s.baseUrl;
    var model = isPreset ? (s.presetModel || (p && p.model) || "") : s.model;
    var presetOpts = LLM.PRESETS.map(function (x) {
      return '<option value="' + x.id + '"' + (s.preset === x.id ? " selected" : "") + ">" + H.esc(x.label) + "</option>";
    }).join("");
    return subHead("翻译模型") +
      '<p style="margin:0 0 6px">状态：' + statusBadge(s) + "</p>" +
      '<p class="muted">密钥仅保存在本机、不会上传；未配置时翻译与出刊会先提示去配置。</p>' +
      '<div class="filters" style="margin-top:6px">' +
      '<label class="chip"><input type="radio" name="pvMode" value="preset"' + (isPreset ? " checked" : "") + "> 厂商预置</label>" +
      '<label class="chip"><input type="radio" name="pvMode" value="custom"' + (!isPreset ? " checked" : "") + "> 自定义端点</label>" +
      "</div>" +
      '<div id="pvPreset"' + (isPreset ? "" : ' style="display:none"') + ' class="field"><label>厂商</label>' +
      '<select id="pvSel">' + presetOpts + "</select>" +
      '<div class="muted" id="pvNote">' + (p ? H.esc(p.note) : "") + "</div></div>" +
      '<div class="field"><label>接口地址 Base URL</label><input id="pvBase" value="' + H.esc(base) + '" placeholder="https://…"></div>' +
      '<div class="field"><label>模型名</label><input id="pvModel" value="' + H.esc(model) + '" placeholder="模型 id"></div>' +
      '<div class="field"><label>API Key（本地明文存储，不上传）</label><input id="pvKey" type="password" value="' + H.esc(s.apiKey || "") + '" placeholder="sk-…"></div>' +
      '<div class="art-actions"><button class="btn" id="pvTest">测试连接</button><button class="btn primary" id="pvSave" title="保存并自动测试连接；必填项空缺会醒目提示">保存并测试连接</button></div>' +
      '<div id="pvResult"></div>';
  }

  function effPx(s) {
    var p = parseInt(s.fontSizePx, 10);
    if (p > 0) return Math.min(24, Math.max(12, p));
    var m = { M: 16, L: 18, XL: 21 }[s.fontZoom || "M"] || 16;
    return m;
  }

  /* 设置项折叠：卡片只留标题，点击展开/收起 */
  /* 设置页分组内小节标题 */
  function subHead(t) { return '<h4 class="set-sub-t">' + H.esc(t) + "</h4>"; }
  /* 组卡外壳：h3 标题 + 当前值摘要；正文交给 collapseCards 折叠 */
  function setCard(title, sum, inner) {
    return '<div class="card"><h3>' + H.esc(title) + (sum ? '<span class="set-sum">' + H.esc(sum) + "</span>" : "") + "</h3>" + inner + "</div>";
  }

  function collapseCards(root, openTitles) {
    root.querySelectorAll(".card").forEach(function (c) {
      var h = c.querySelector("h3");
      if (!h || c.querySelector(".set-body")) return;
      var body = document.createElement("div");
      body.className = "set-body";
      while (h.nextElementSibling) body.appendChild(h.nextElementSibling);
      c.appendChild(body);
      h.classList.add("set-head");
      var open = (openTitles || []).some(function (t) { return h.textContent.indexOf(t) >= 0; });
      body.hidden = !open;
      h.classList.toggle("collapsed", !open);   // 初始折叠态箭头朝下（v1.24 修复方向反了）
      h.addEventListener("click", function () {
        body.hidden = !body.hidden;
        h.classList.toggle("collapsed", body.hidden);
      });
    });
  }

  function displaySectionHtml(s) {
    var px = effPx(s);
    return subHead("显示与字号") +
      '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
      '<label class="muted" for="dsRange">界面字号</label>' +
      '<input type="range" id="dsRange" min="12" max="24" step="1" value="' + px + '" style="flex:1;min-width:160px;max-width:320px">' +
      '<span class="badge" id="dsVal" style="background:var(--accent-weak);color:var(--primary);font-size:.9rem;min-width:52px;text-align:center">' + px + " px</span>" +
      "</div>" +
      '<div class="field" style="margin:4px 0 0"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="dsDualTitle"' + (s.libDualTitle !== false ? " checked" : "") + "> 资料库标题：中英双语显示（关闭后仅显示英文标题）</label></div>" +
      '<div class="fz-preview" id="fzSample">预览：述势 · 今日新增 29 篇 · “相关角标与摘要随字号实时缩放”</div>';
  }

  /* 主题外观（多主题系统：蓝天/深空夜航/纸面学报/极简灰/艺术装饰/解密档案/终端/玻璃晨光） */
  var THEMES = [["", "蓝天 · 深邃", "linear-gradient(135deg,#2f7fd1,#0b4f8f)"],
                ["night", "深空夜航", "linear-gradient(135deg,#2a3d54,#0e1622)"],
                ["paper", "纸面学报", "linear-gradient(135deg,#a98a52,#6d5230)"],
                ["gray", "极简灰", "linear-gradient(135deg,#7d8a97,#4a5868)"],
                ["artdeco", "艺术装饰", "linear-gradient(135deg,#f3e9cf,#1f3a33)"],
                ["archive", "解密档案", "linear-gradient(135deg,#e9dcc0,#2f4a3c)"],
                ["hud", "终端", "linear-gradient(135deg,#12251a,#7df9a4)"],
                ["glass", "玻璃晨光", "linear-gradient(135deg,#fdf6ef,#7da8d9)"],
                ["broadsheet", "大报晨刊", "linear-gradient(135deg,#f6f1e2,#b8322f)"],
                ["nightcamo", "夜视迷彩", "linear-gradient(135deg,#1f2b20,#a9f37a)"],
                ["artpop", "艺术号外", "linear-gradient(135deg,#ffd23f,#ff4d6d)"],
                ["candle", "烛光夜读", "linear-gradient(135deg,#1c1712,#e8a94e)"],
                ["ink", "墨韵东方", "linear-gradient(135deg,#f5efe2,#b03a2e)"],
                ["astro", "星图罗盘", "linear-gradient(135deg,#0f1a2e,#d8b45a)"],
                ["letter", "铅字编辑部", "linear-gradient(135deg,#f2ead8,#b02a26)"]];
  /* 每主题迷你预览调色板（与 app.css 各主题 token 保持一致；新增主题时同步补一条） */
  var THEME_MOCK = {
    "":         { bg: "#f2f4f7", card: "#ffffff", pri: "#1f5c99", acc: "#2f7fd1", txt: "#1b2532", line: "#e2e6ec" },
    night:      { bg: "#0e1622", card: "#182534", pri: "#5ca6e6", acc: "#4791d2", txt: "#e9eff7", line: "#2b3d52" },
    paper:      { bg: "#f3edde", card: "#fffdf6", pri: "#7a5a2e", acc: "#9a7b3f", txt: "#3a2e1c", line: "#e0d4bb" },
    gray:       { bg: "#eceff2", card: "#ffffff", pri: "#4a5868", acc: "#5d6d7e", txt: "#1d2733", line: "#d8dde3" },
    artdeco:    { bg: "#f3ecd9", card: "#fbf6e8", pri: "#8a6b2a", acc: "#c9a227", txt: "#3a2f1e", line: "#e0d3ae" },
    archive:    { bg: "#ece0c2", card: "#f8f0dc", pri: "#2f4a3c", acc: "#a0312a", txt: "#2e2a20", line: "#dccca6" },
    hud:        { bg: "#0b120e", card: "#13231b", pri: "#7df9a4", acc: "#a4f5c0", txt: "#d7f5e0", line: "#24382c" },
    glass:      { bg: "#e9f1f8", card: "#ffffff", pri: "#4a86c8", acc: "#6ba3d9", txt: "#2c3a4a", line: "#d5e2ef" },
    broadsheet: { bg: "#f6f1e2", card: "#fffdf7", pri: "#1a1a1a", acc: "#b8322f", txt: "#1a1a1a", line: "#d8cdb4" },
    nightcamo:  { bg: "#1f2b20", card: "#26352a", pri: "#4b6e3a", acc: "#a9f37a", txt: "#dfe9dc", line: "#3c4f3c" },
    artpop:     { bg: "#f8f4ec", card: "#ffffff", pri: "#003049", acc: "#ff4d6d", txt: "#141414", line: "#1c1c1c" },
    candle:     { bg: "#1c1712", card: "#2a221a", pri: "#e8a94e", acc: "#f4c37a", txt: "#f2e3c8", line: "#4a3c2c" },
    ink:        { bg: "#f5efe2", card: "#faf5e9", pri: "#2f2a24", acc: "#b03a2e", txt: "#3a352d", line: "#ddd2b8" },
    astro:      { bg: "#0f1a2e", card: "#16233c", pri: "#d8b45a", acc: "#e6c986", txt: "#e6ecf7", line: "#2c3d5c" },
    letter:     { bg: "#f2ead8", card: "#faf5e8", pri: "#1a1a1a", acc: "#b02a26", txt: "#2a2620", line: "#d9cdb2" }
  };
  function themeMockHtml(mo) {
    return '<span class="th-mock" style="background:' + mo.bg + '">' +
      '<i class="tm-bar" style="background:' + mo.pri + '"></i>' +
      '<span class="tm-card" style="background:' + mo.card + ';border-color:' + mo.line + '">' +
      '<i class="tm-line" style="background:' + mo.txt + ';width:74%"></i>' +
      '<i class="tm-line" style="background:' + mo.txt + ';opacity:.35;width:52%"></i>' +
      '<i class="tm-row"><i class="tm-chip" style="background:' + mo.acc + '"></i><i class="tm-dot" style="background:' + mo.pri + '"></i></i>' +
      "</span></span>";
  }
  function themeSectionHtml(s) {
    return subHead("主题外观") +
      '<div class="theme-grid" id="thGrid">' +
      THEMES.map(function (t) {
        return '<button type="button" class="theme-pick' + ((s.theme || "") === t[0] ? " on" : "") + '" data-th="' + t[0] + '" title="' + H.esc(t[1]) + '">' +
          themeMockHtml(THEME_MOCK[t[0]] || THEME_MOCK[""]) +
          '<span class="th-name">' + H.esc(t[1]) + "</span>" +
          ((s.theme || "") === t[0] ? '<span class="th-check">✓ 使用中</span>' : "") +
          "</button>";
      }).join("") + "</div>";
  }

  /* 阅读宠物：空白=关闭；xiaoyi=小翼 / xinshi=信使 / jiaoguan=教官 / dida=滴答 */
  var PETS = [["", "关闭"], ["xiaoyi", "小翼 · 卡通战机"], ["xinshi", "信使 · 机械信鸽"], ["jiaoguan", "教官 · 情报猫头鹰"], ["dida", "滴答 · 电报机"], ["haowang", "好望 · 老飞艇"], ["moling", "墨翎 · 胖钢笔"], ["xiazi", "匣子 · 老收音机"], ["chuchu", "戳戳 · 朱泥图章"], ["sinan", "斗勺 · 司南"]];
  function petSectionHtml(s) {
    return subHead("阅读宠物") +
      '<div class="pet-set" id="petSet">' +
      PETS.map(function (p) {
        var on = (s.pet || "") === p[0];
        var nm = p[1].split(" · ");
        var prev = p[0]
          ? '<span class="pet-stage"><img class="pet-prev" src="assets/pet/' + p[0] + '/pet_' + p[0] + '_front_idle@96@2x.png" alt="" loading="lazy"></span>'
          : '<span class="pet-stage off"><span class="pet-offline">关</span></span>';
        return '<button type="button" class="pet-pick' + (on ? " on" : "") + '" data-pet="' + p[0] + '" title="' + H.esc(p[1]) + '">' +
          prev + '<span class="pet-pn"><b>' + H.esc(nm[0]) + "</b>" + (nm[1] ? "<small>" + H.esc(nm[1]) + "</small>" : "") + "</span>" +
          (on ? '<span class="th-check">✓ 使用中</span>' : "") +
          "</button>";
      }).join("") + "</div>";
  }

  function cleanSectionHtml(s) {
    var opts = [[7, "1 周"], [30, "1 个月"], [90, "3 个月"], [180, "6 个月"], [365, "1 年"]];
    var sel = opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (parseInt(s.retentionDays, 10) === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
    }).join("");
    return sel;
  }

  /* 排序与喜好学习：低/中/高 模糊档位（v1.7.2；存储仍为数值，排序/自动微调逻辑零改动）
     档位数值：低20 / 中50 / 高90；探索率档位：低5% / 中10% / 高20% */
  var RW_LABEL = {
    rel: ["兴趣相关", "关键词命中"],
    fresh: ["新鲜度", "越新分越高"],
    source: ["来源权威", "官方直连加权"],
    heat: ["热度", "收藏 / 出刊 / 同主题"],
    ex: ["探索率", "给非关键词内容留的比例"]
  };
  function rwLevel(v) { v = parseInt(v, 10); return isNaN(v) ? "mid" : (v >= 70 ? "high" : (v >= 35 ? "mid" : "low")); }
  function rwValue(lv) { return lv === "high" ? 90 : (lv === "low" ? 20 : 50); }
  function exLevel(x) { x = (x == null ? 0.1 : parseFloat(x)); if (isNaN(x)) return "mid"; return x >= 0.16 ? "high" : (x > 0.07 ? "mid" : "low"); }
  function exValue(lv) { return lv === "high" ? 0.2 : (lv === "low" ? 0.05 : 0.1); }
  function segRow(key, lv) {
    var lab = RW_LABEL[key] || [key, ""];
    var html = '<div class="rw-row"><div class="rw-info"><b>' + lab[0] + "</b>" +
      (lab[1] ? '<span class="muted">' + lab[1] + "</span>" : "") + "</div>" +
      '<div class="rw-seg" data-k="' + key + '">' +
      '<button type="button" class="seg' + (lv === "low" ? " on" : "") + '" data-l="low">低</button>' +
      '<button type="button" class="seg' + (lv === "mid" ? " on" : "") + '" data-l="mid">中</button>' +
      '<button type="button" class="seg' + (lv === "high" ? " on" : "") + '" data-l="high">高</button>' +
      "</div></div>";
    return html;
  }
  function rankSectionHtml(s) {
    var w = s.rankWeights || {};
    var btLast = s.btLastAt ? H.fmtDateTime(s.btLastAt) + "（" + H.ago(s.btLastAt) + "）" : "从未";
    return subHead("排序与喜好学习") +
      '<p class="muted">以「低 / 中 / 高」粗调即可，点选即保存；作用于「兴趣榜」与「周末简报」的排序。</p>' +
      '<div class="rw-segs" id="rwSegs" style="margin-top:6px">' +
      segRow("rel", rwLevel(w.rel)) +
      segRow("fresh", rwLevel(w.fresh)) +
      segRow("source", rwLevel(w.source)) +
      segRow("heat", rwLevel(w.heat)) +
      segRow("ex", exLevel(s.exploreRate)) +
      "</div>" +
      '<div class="art-actions" style="margin-top:14px;border-top:1px dashed var(--line);padding-top:12px;justify-content:flex-end">' +
      '<button class="btn sm primary" id="btRun">运行一次离线回测</button>' +
      '<button class="btn sm" id="rwReset">恢复默认</button></div>' +
      '<div id="rwMsg" class="muted" style="margin-top:12px;font-size:.86rem;line-height:1.6">回测结果将显示在这里。</div>' +
      '<div class="field" style="margin-top:14px;margin-bottom:6px;padding-top:12px;border-top:1px dashed var(--line)"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="btAuto"' + (s.btAuto ? " checked" : "") + "> 打开页面时自动回测（每日最多一次，结果投递收件箱）</label></div>" +
      '<div class="field" style="margin:0"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="bfAutoTune"' + (s.autoTune ? " checked" : "") + "> 自动微调排序权重（每日最多一次；您 24 小时内手动调过则跳过，尊重手动）</label></div>" +
      '<p class="muted" style="margin:10px 0 0">上次回测：' + btLast + "</p>";
  }

  /* 二级手风琴分组头 */
  function grp(title, open, inner) {
    return '<div class="b-grp"><h4 class="bg-head' + (open ? "" : " collapsed") + '">' + H.esc(title) + "</h4>" +
      '<div class="bg-body"' + (open ? "" : " hidden") + ">" + inner + "</div></div>";
  }

  /* 资料刷新（唯一自动取数通道，默认开）；时间点用时段多选，免手填 */
  var TIME_OPTS = ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
  function refreshSectionHtml(s) {
    var rt = (s.refreshTimes && s.refreshTimes.length) ? s.refreshTimes : ["09:00", "12:00", "18:00"];
    return subHead("资料刷新") +
      '<label style="display:flex;gap:6px;align-items:center;margin-bottom:8px"><input type="checkbox" id="rfOn"' + (s.autoRefresh ? " checked" : "") + "> 每日定时自动刷新官方信源</label>" +
      '<div class="field"><label>刷新时段（多选，至少一个；到点各静默拉取一次）</label>' +
      '<div class="time-chips" id="rfChips">' +
      TIME_OPTS.map(function (t) {
        return '<button type="button" class="time-chip' + (rt.indexOf(t) >= 0 ? " on" : "") + '" data-t="' + t + '">' + t + "</button>";
      }).join("") + "</div></div>" +
      '<p class="muted">到设定时间各静默拉取一次；失败不打扰，留待下一时段自动重试。</p>' +
      '<div class="art-actions"><button class="btn primary" id="rfSave">保存刷新设置</button></div>';
  }

  /* 自动化（除资料刷新外默认全部关闭）；开关即点即存，不再设总保存按钮 */
  function autoSectionInner(s) {
    return subHead("自动化") +
      '<p class="muted" style="margin:0 0 8px">除「资料刷新」外，其余自动化默认关闭，涉及 AI 的功能会消耗模型额度。</p>' +
      grp("翻译与摘要自动化", false,
        '<label style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" id="bfAutoTr"' + (s.autoTitleTr ? " checked" : "") + "> 进资料库时自动翻译新标题（默认开，可按需关闭）</label>" +
        '<label style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" id="bfFavTr"' + (s.favAutoTr ? " checked" : "") + "> 收藏时自动：生成中文标题 + 中/英摘要</label>" +
        '<label style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" id="bfFavFull"' + (s.favAutoFull ? " checked" : "") + "> 收藏时自动：全文翻译（可与上项组合）</label>" +
        '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="bfCmpAuto"' + (s.compareAutoFull ? " checked" : "") + "> 阅读页「中英对照」缺译文时自动翻译全文</label>") +
      grp("周末简报", false,
        '<label style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" id="bfBrief"' + (s.weeklyBrief ? " checked" : "") + "> 周末简报自动投递（周六/周日首次打开）</label>" +
        '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="bfBriefAi"' + (s.briefAi ? " checked" : "") + "> 简报 AI 增强：全期综述 + 逐条点评（需配置模型）</label>" +
        '<div class="art-actions" style="margin-top:8px"><button class="btn" id="bfBriefNow">立即生成本周简报</button></div>');
  }

  /* 资料清理（归入「数据」组） */
  function cleanSectionInner(s) {
    var sel = cleanSectionHtml(s);
    return subHead("资料清理") +
      '<label style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" id="bfAutoClean"' + (s.autoClean ? " checked" : "") + "> 自动清理过期资料（收藏/已选/已出刊永不自动删）</label>" +
      '<div class="filters" style="margin-top:8px;margin-bottom:0"><span class="muted">保留期</span><select id="clDays">' + sel + "</select></div>" +
      '<div class="art-actions" style="margin-top:8px"><button class="btn primary" id="clSave">保存保留期</button><button class="btn" id="clRun">立即清理过期文章</button></div>' +
      '<div id="clMsg" class="muted" style="margin-top:6px">自动清理在打开页面与每次拉取后执行。</div>';
  }

  /* 系统与更新 + 供稿署名（归入「系统」组）；开关即点即存 */
  function sysSectionInner(s) {
    return subHead("系统与更新") +
      '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="bfAutoChk"' + (s.autoCheck !== false ? " checked" : "") + "> 自动接收新版本与公告（打开页面即检查，约 10 分钟一次；仅读通知不耗模型）</label>" +
      subHead("供稿署名") +
      '<div class="field"><label>供稿署名默认文案（生成进 docx 后可在 Word 修改）</label><input id="bfSign" value="' + H.esc(s.signatureText || "") + '"></div>';
  }

  function mirrorSectionHtml(s) {
    return subHead("信源状态") + mirrorStatusHtml(s) +
      '<div class="field"><label>信源汇集仓库（系统统一维护，请勿修改）</label>' +
      '<div class="mono">' + H.esc(s.mirrorRepo || "未配置") + "</div></div>" +
      '<div class="field"><label>更新通知仓库（只读）</label>' +
      '<div class="mono">' + H.esc(s.updateRepo || "未配置") + "</div></div>" +
      '<p class="muted">官方信源每日定时汇集；本页仅展示状态，不可编辑。</p>' +
      '<div class="art-actions"><button class="btn" id="bfChkUpdate">检查更新</button></div>' +
      '<div id="bfRepoMsg" class="muted" style="margin-top:6px"></div>';
  }

  function dataSectionHtml() {
    return subHead("本机占用") +
      '<div class="grid g3" style="margin-bottom:8px">' +
      '<div class="stat"><div class="num" id="stUsage">—</div><div class="lab">已用（浏览器存储）</div></div>' +
      '<div class="stat"><div class="num" id="stArt">…</div><div class="lab">本设备文章数</div></div>' +
      '<div class="stat"><div class="num" id="stQuota">—</div><div class="lab">可用配额</div></div></div>' +
      '<div class="art-actions">' +
      '<button class="btn" id="dbExport">导出备份 JSON</button>' +
      '<button class="btn" id="dbImport">导入备份 JSON</button>' +
      '<button class="btn" id="dbDedup" title="同标题重复文章只保留信息最全的一篇">清理重复文章</button>' +
      '<button class="btn danger" id="dbClear">清空资料库</button>' +
      '<input type="file" id="dbFile" accept=".json" style="display:none">' +
      "</div>" +
      '<p class="muted">导出包含文章、译文、摘要、术语、学报记录与设置；导入按 url 合并（本设备已有的译文/锁定不会被覆盖）。数据不上云，备份用于换设备迁移。</p>';
  }

  /* 帮助（v1.24 新增）：各页面的使用说明统一收口到这里，页面内不再堆提示文字 */
  function helpSectionHtml() {
    function qa(t, body) { return grp(t, false, '<p class="muted" style="margin:0;line-height:1.8">' + body + "</p>"); }
    return subHead("常见问题") +
      qa("收件箱是什么", "底部导航的「收件箱」接收新版本公告、周末简报与系统消息，全部只存本机。未读时底栏图标会有红点数字。") +
      qa("术语库怎么用", "术语库内置上百条军语：一个概念可录多个英文写法（如 drone / UAV），翻译时命中任一写法都按同一条规范译名处理。电脑端阅读文章时还可一键「提取术语」，确认后并入词库；手机端为纯浏览与搜索。") +
      qa("排行榜怎么排序", "「今日榜」看时效；「兴趣榜」按 兴趣相关 / 新鲜度 / 来源权威 / 热度 加权，并保留一小部分探索位给新内容。权重在「模型与智能服务 → 排序与喜好学习」用高/中/低调节。") +
      qa("翻译与摘要怎么开", "标题翻译、摘要、全文翻译、出刊都需要先在「模型与智能服务」里配置在线模型；密钥只保存在本机。收藏时自动翻译/摘要等开关默认关闭，按需打开。") +
      qa("学报怎么出", "在「资料库」给文章点「直接出刊」，按所选模板生成 Word 文档；「供稿」默认是占位文字，出刊后在 Word 里改成真实署名即可。也可以上传自己的范文 .docx 解构成模板。") +
      qa("资料怎么更新", "每天在设定时段（默认 09:00 / 12:00 / 18:00）自动刷新官方信源；总览页的「立即更新」按钮有 10 分钟冷却，防止请求过密。") +
      qa("数据存在哪、怎么迁移", "所有数据与设置只保存在本机浏览器，不会上传。换设备前先「导出备份 JSON」，在新设备的「数据与刷新 → 本机占用」里导入即可。") +
      qa("宠物有什么玩法", "宠物是后台任务的「看得见的陪伴」：干活时带上配件、出错会皱眉、全部完成会欢呼；平时会眨眼、东张西望。没任务时点一点它，偶尔投喂个小零食；手机端可以按住拖动，靠边会自动收起。") +
      qa("版本更新与公告", "打开页面会自动检查新版本（约 10 分钟一次，也可在「信源状态」里手动检查）。有新版会弹窗提示；每次更新的说明都会作为公告投递到收件箱。");
  }

  var M = {
    key: "settings",
    label: "设置",
    async render(el) {
      var s = Store.settings;
      var usage = await Store.usage();
      var arts = await Store.getAllArticles();
      // 四大组摘要（标题行右侧显示当前值，折叠时也能一眼看清）
      var themeSum = (THEMES.filter(function (t) { return (t[0] || "") === (s.theme || ""); })[0] || ["", "蓝天"])[1].split(" · ")[0];
      var petName = s.pet ? (PETS.filter(function (p) { return p[0] === s.pet; })[0] || ["", ""])[1].split(" · ")[0] : "关";
      var modelOk = !!(LLM.endpoint(s).baseUrl && LLM.endpoint(s).model && s.apiKey);
      var rt = (s.refreshTimes && s.refreshTimes.length) ? s.refreshTimes : ["09:00", "12:00", "18:00"];
      var dataSum = s.autoRefresh ? "每天 " + rt.join(" / ") : "手动更新";
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">设置</h1>' +
        '<p class="view-sub">按分组收纳，点标题展开；用不上「帮助」里的说明，随时可以来查。</p></div></div>' +
        setCard("外观与阅读", themeSum + " · 字号 " + effPx(s) + "px · 宠物" + petName,
          displaySectionHtml(s) + themeSectionHtml(s) + petSectionHtml(s)) +
        setCard("模型与智能服务", modelOk ? "模型已配置" : "模型未配置",
          modelSectionHtml(s) + autoSectionInner(s) + rankSectionHtml(s)) +
        setCard("数据与刷新", dataSum,
          refreshSectionHtml(s) + cleanSectionInner(s) + mirrorSectionHtml(s) + dataSectionHtml()) +
        setCard("系统与帮助", "v" + H.esc(s.appVersion || "1.0.0"),
          sysSectionInner(s) + helpSectionHtml() +
          subHead("关于") +
          '<div class="muted">SENTRA 述势 v' + H.esc(s.appVersion || "1.0.0") +
          "（build " + (s.versionCode || 2) + "）<br>面向军迷与研究工作的外军防务资讯台：每日定时汇集多个官方信源，支持双语阅读、术语标注、兴趣排序与一键出刊（学报 docx）。<br>" +
          "数据与设置只保存在本机浏览器中，导出备份即可迁移到其它设备。</div>");

      collapseCards(el, []);
      bindModel(el, s);
      bindOther(el, s, usage, arts);

      function bindModel(root, s) {
        var presetWrap = root.querySelector("#pvPreset");
        function setMode(mode) {
          var isP = mode === "preset";
          s.provider = mode;
          presetWrap.style.display = isP ? "" : "none";
          var p = LLM.presetById(s.preset);
          if (isP && p) {
            root.querySelector("#pvBase").value = s.presetBaseUrl || p.baseUrl;
            root.querySelector("#pvModel").value = s.presetModel || p.model;
          }
          root.querySelector("#pvNote").textContent = p ? p.note : "";
        }
        root.querySelectorAll('input[name="pvMode"]').forEach(function (r) {
          r.addEventListener("change", function () { if (r.checked) setMode(r.value); });
        });
        root.querySelector("#pvSel").addEventListener("change", function (e) {
          s.preset = e.target.value;
          var p = LLM.presetById(s.preset);
          if (p) {
            root.querySelector("#pvBase").value = p.baseUrl;
            root.querySelector("#pvModel").value = p.model;
            root.querySelector("#pvNote").textContent = p.note;
          }
        });
        // 测试连接（共用）：读当前输入 → 写回设置 → 调模型，把结果显示到 box
        function testNow(box) {
          var isP = root.querySelector('input[name="pvMode"]:checked').value === "preset";
          if (isP) {
            s.preset = root.querySelector("#pvSel").value;
            s.presetBaseUrl = root.querySelector("#pvBase").value.trim();
            s.presetModel = root.querySelector("#pvModel").value.trim();
          } else {
            s.baseUrl = root.querySelector("#pvBase").value.trim();
            s.model = root.querySelector("#pvModel").value.trim();
          }
          s.apiKey = root.querySelector("#pvKey").value.trim();
          box.innerHTML = '<p class="muted">测试中…<span class="spin dark"></span></p>';
          return LLM.testConnection().then(function (res) {
            box.innerHTML = '<div class="ok-line">连接正常，模型回复：' + H.esc(res) + "</div>";
            Store.saveSettings();
            return true;
          }).catch(function (err) {
            box.innerHTML = '<div class="note">' + H.esc(err.message || "测试失败") + "</div>";
            return false;
          });
        }
        // 保存即测：必填校验（缺项高亮+提示）→ 保存 → 自动测试连接
        root.querySelector("#pvSave").addEventListener("click", function () {
          var box = root.querySelector("#pvResult");
          var isP = root.querySelector('input[name="pvMode"]:checked').value === "preset";
          s.provider = isP ? "preset" : "custom";
          s.preset = root.querySelector("#pvSel").value;
          s.apiKey = root.querySelector("#pvKey").value.trim();
          var base = root.querySelector("#pvBase").value.trim();
          var model = root.querySelector("#pvModel").value.trim();
          if (isP) { s.presetBaseUrl = base; s.presetModel = model; }
          else { s.baseUrl = base; s.model = model; }
          var fields = [["#pvBase", base, "接口地址"], ["#pvModel", model, "模型名"], ["#pvKey", s.apiKey, "API Key"]];
          var missing = [];
          fields.forEach(function (f) {
            var el = root.querySelector(f[0]);
            if (el) el.classList.toggle("err", !f[1]);
            if (!f[1]) missing.push(f[2]);
          });
          if (missing.length) {
            box.innerHTML = '<div class="note" style="color:var(--bad)">还缺：' + H.esc(missing.join("、")) + "。请补全后再保存。</div>";
            App.toast("未保存：还有必填项空缺", "err");
            return;
          }
          Store.saveSettings();
          box.innerHTML = '<p class="muted">已保存，正在测试连接…<span class="spin dark"></span></p>';
          App.toast("模型设置已保存，正在测试连接…", "ok");
          testNow(box);
        });
        root.querySelector("#pvTest").addEventListener("click", function () { testNow(root.querySelector("#pvResult")); });
        // 重新输入时清除缺项高亮
        ["#pvBase", "#pvModel", "#pvKey"].forEach(function (sel) {
          var el = root.querySelector(sel);
          if (el) el.addEventListener("input", function () { el.classList.remove("err"); });
        });
      }
      function bindOther(root, s, usage, arts) {
        root.querySelector("#stUsage").textContent = usage ? H.sizeFmt(usage.usage) : "—";
        root.querySelector("#stQuota").textContent = usage ? H.sizeFmt(usage.quota) : "—";
        root.querySelector("#stArt").textContent = String(arts.length);
        // 字号（滑条，实时预览，松手保存）
        var range = root.querySelector("#dsRange"), valEl = root.querySelector("#dsVal");
        range.addEventListener("input", function () {
          valEl.textContent = range.value + " px";
          document.documentElement.style.fontSize = range.value + "px";
        });
        range.addEventListener("change", function () {
          s.fontSizePx = parseInt(range.value, 10);
          Store.saveSettings();
          valEl.textContent = s.fontSizePx + " px";
          App.applyFont();
          App.toast("字号已调整为 " + s.fontSizePx + " px", "ok");
        });
        // 资料库标题显示（双语 / 仅英文）
        var dual = root.querySelector("#dsDualTitle");
        if (dual) dual.addEventListener("change", function () {
          s.libDualTitle = dual.checked;
          Store.saveSettings();
          App.toast(s.libDualTitle ? "资料库标题：中英双语显示" : "资料库标题：仅英文显示", "ok");
        });
        // 主题切换：即时生效并回写设置
        var thGrid = root.querySelector("#thGrid");
        if (thGrid) {
          function refreshTh() {
            thGrid.querySelectorAll(".theme-pick").forEach(function (x) {
              var on = (x.dataset.th || "") === (s.theme || "");
              x.classList.toggle("on", on);
              var c = x.querySelector(".th-check");
              if (on && !c) { var sp = document.createElement("span"); sp.className = "th-check"; sp.textContent = "✓ 使用中"; x.appendChild(sp); }
              if (!on && c) c.remove();
            });
          }
          thGrid.addEventListener("click", function (e) {
            var b = e.target.closest(".theme-pick");
            if (!b) return;
            s.theme = b.dataset.th || "";
            Store.saveSettings();
            App.applyTheme();
            refreshTh();
            App.toast("已切换主题", "ok");
          });
        }
        // 阅读宠物切换：即时生效并回写设置
        var petSet = root.querySelector("#petSet");
        if (petSet) {
          function refreshPet() {
            petSet.querySelectorAll(".pet-pick").forEach(function (x) {
              var on = (x.dataset.pet || "") === (s.pet || "");
              x.classList.toggle("on", on);
              var c = x.querySelector(".th-check");
              if (on && !c) { var sp = document.createElement("span"); sp.className = "th-check"; sp.textContent = "✓ 使用中"; x.appendChild(sp); }
              if (!on && c) c.remove();
            });
          }
          petSet.addEventListener("click", function (e) {
            var b = e.target.closest(".pet-pick");
            if (!b) return;
            s.pet = b.dataset.pet || "";
            Store.saveSettings();
            refreshPet();
            var pname = s.pet ? (PETS.filter(function (p) { return p[0] === s.pet; })[0] || [s.pet])[1] : "";
            App.toast(s.pet ? "已启用宠物：" + pname : "已关闭阅读宠物", "ok");
            if (App.updatePet) App.updatePet();
          });
        }
        // 排序与喜好学习：低/中/高 档位点选即保存（回测与自动开关沿用）
        function bindRw(root, s) {
          function paint(k, lv) {
            var row = root.querySelector('.rw-seg[data-k="' + k + '"]');
            if (!row) return;
            row.querySelectorAll(".seg").forEach(function (b) { b.classList.toggle("on", b.dataset.l === lv); });
          }
          function paintAll() {
            var w = s.rankWeights || {};
            paint("rel", rwLevel(w.rel)); paint("fresh", rwLevel(w.fresh));
            paint("source", rwLevel(w.source)); paint("heat", rwLevel(w.heat));
            paint("ex", exLevel(s.exploreRate));
          }
          var segs = root.querySelector("#rwSegs");
          if (segs) segs.addEventListener("click", function (e) {
            var b = e.target.closest(".seg");
            if (!b) return;
            var row = b.closest(".rw-seg");
            if (!row) return;
            var k = row.dataset.k;
            var lv = b.dataset.l;
            s.rankWeights = s.rankWeights || {};
            s.lastManualRankAt = Date.now();           // 24h 内手动调过则自动微调跳过，尊重手动
            if (k === "ex") s.exploreRate = exValue(lv);
            else s.rankWeights[k] = rwValue(lv);
            Store.saveSettings();
            paintAll();
          });
          var rs = root.querySelector("#rwReset");
          if (rs) rs.addEventListener("click", function () {
            s.rankWeights = { rel: rwValue("high"), fresh: rwValue("mid"), source: rwValue("mid"), heat: rwValue("low") };
            s.exploreRate = exValue("mid");
            s.lastManualRankAt = Date.now();
            Store.saveSettings();
            paintAll();
            App.toast("已恢复默认配比：兴趣高 / 新鲜中 / 来源中 / 热度低 / 探索中", "ok");
          });
          var bt = root.querySelector("#btRun");
          if (bt) bt.addEventListener("click", function () {
            var box = root.querySelector("#rwMsg");
            box.innerHTML = "回测中…<span class='spin dark'></span>";
            H.backtestResult().then(function (r) {
              s.btLastAt = Date.now();
              Store.saveSettings();
              box.innerHTML = r.html || '<div class="note">' + H.esc(r.text) + "</div>";
            }).catch(function (e) {
              box.innerHTML = '<div class="note">回测失败：' + H.esc((e && e.message) || e) + "</div>";
            });
          });
          var ba = root.querySelector("#btAuto");
          if (ba) ba.addEventListener("change", function () {
            s.btAuto = ba.checked;
            Store.saveSettings();
            App.toast(s.btAuto ? "已开启：打开页面时自动回测（每日最多一次）" : "已关闭自动回测", "ok");
          });
          var at = root.querySelector("#bfAutoTune");
          if (at) at.addEventListener("change", function () {
            s.autoTune = at.checked;
            Store.saveSettings();
            App.toast(s.autoTune ? "已开启：每日自动微调排序权重（尊重手动）" : "已关闭自动微调", "ok");
          });
        }
        bindRw(root, s);
        // 清理
        root.querySelector("#clSave").addEventListener("click", function () {
          s.retentionDays = parseInt(root.querySelector("#clDays").value, 10) || 90;
          Store.saveSettings();
          App.toast("保留期已保存", "ok");
        });
        root.querySelector("#clRun").addEventListener("click", function () {
          MIRROR.cleanupOld().then(function (n) {
            var msg = n > 0 ? "已清理 " + n + " 篇过期文章" : "没有可清理的过期文章（收藏/已选/已出刊均受保护）";
            root.querySelector("#clMsg").innerHTML = '<div class="ok-line">' + H.esc(msg) + "</div>";
            App.refresh();
          });
        });
        // 二级手风琴分组
        root.querySelectorAll(".bg-head").forEach(function (h) {
          h.addEventListener("click", function () {
            var body = h.nextElementSibling;
            var show = body.hidden;
            body.hidden = !show;
            h.classList.toggle("collapsed", !show);
          });
        });
        // 资料刷新（定时自动取数；时段 chips 多选）
        var rfOn = root.querySelector("#rfOn");
        root.querySelector("#rfChips").addEventListener("click", function (e) {
          var chip = e.target.closest(".time-chip");
          if (!chip) return;
          chip.classList.toggle("on");
        });
        root.querySelector("#rfSave").addEventListener("click", function () {
          var times = Array.prototype.map.call(root.querySelectorAll("#rfChips .time-chip.on"), function (c) {
            return c.dataset.t;
          }).sort();
          if (!times.length) { App.toast("请至少选择一个刷新时段", "err"); return; }
          s.autoRefresh = rfOn.checked;
          s.refreshTimes = times;
          Store.saveSettings();
          App.toast("刷新设置已保存：每天 " + times.join("、") + " 自动更新", "ok");
          App.refresh();
        });
        // —— 兴趣相关（关键词/喜好学习）已移至左侧「兴趣中心」页 ——
        // 自动化开关：全部即点即存（v1.24 取消统一保存按钮）
        function bindToggle(id, key, onMsg, offMsg) {
          var box = root.querySelector(id);
          if (!box) return;
          box.addEventListener("change", function () {
            s[key] = box.checked;
            Store.saveSettings();
            App.toast(box.checked ? onMsg : (offMsg || "已关闭"), "ok");
          });
        }
        bindToggle("#bfAutoTr", "autoTitleTr", "进库自动翻译标题：开", "进库自动翻译标题：关");
        bindToggle("#bfFavTr", "favAutoTr", "收藏时自动标题+摘要：开", "收藏时自动标题+摘要：关");
        bindToggle("#bfFavFull", "favAutoFull", "收藏时自动全文翻译：开", "收藏时自动全文翻译：关");
        bindToggle("#bfCmpAuto", "compareAutoFull", "对照页自动补译文：开", "对照页自动补译文：关");
        bindToggle("#bfAutoClean", "autoClean", "自动清理过期资料：开", "自动清理过期资料：关");
        bindToggle("#bfAutoChk", "autoCheck", "自动接收新版本与公告：开", "自动接收新版本与公告：关");
        bindToggle("#bfBrief", "weeklyBrief", "周末简报自动投递：开", "周末简报自动投递：关");
        bindToggle("#bfBriefAi", "briefAi", "简报 AI 增强：开", "简报 AI 增强：关");
        // 供稿署名：失焦或回车即存
        var sign = root.querySelector("#bfSign");
        if (sign) sign.addEventListener("change", function () {
          s.signatureText = sign.value.trim();
          Store.saveSettings();
          App.toast("供稿署名已保存", "ok");
        });
        // 周末简报：立即生成（手动，不占用每周自动名额）
        var briefBtn = root.querySelector("#bfBriefNow");
        if (briefBtn) briefBtn.addEventListener("click", function () {
          if (!window.BRIEF) { App.toast("简报模块未加载，请刷新", "err"); return; }
          briefBtn.disabled = true;
          BRIEF.generateNow().then(function (r) {
            briefBtn.disabled = false;
            if (!r.made) { App.toast(r.reason || "暂无数据", "err"); return; }
            App.toast("已投递 ✉ 到收件箱", "ok");
            App.refresh();
          }).catch(function () { briefBtn.disabled = false; });
        });
        // 镜像与更新（仓库只读，仅支持检查更新；结果统一走 App.checkUpdate 的弹窗反馈）
        root.querySelector("#bfChkUpdate").addEventListener("click", function () {
          var msgBox = root.querySelector("#bfRepoMsg");
          msgBox.innerHTML = '<div class="muted">正在检查更新…</div>';
          App.checkUpdate(true).then(function (r) {
            if (!r) return;
            if (r.state === "err") { msgBox.innerHTML = '<div class="note">检查失败（网络或仓库不可达）</div>'; return; }
            if (r.state === "update") {
              msgBox.innerHTML = '<div class="ok-line">发现新版本 v' + H.esc(r.name || "?") + "（build " + r.code + "），详见弹窗。</div>";
            } else {
              msgBox.innerHTML = '<div class="ok-line">已是最新：v' + H.esc(s.appVersion || "?") + "（build " + (s.versionCode || 0) + "）。</div>";
            }
          });
        });
        // 数据
        root.querySelector("#dbExport").addEventListener("click", exportData);
        root.querySelector("#dbImport").addEventListener("click", function () { root.querySelector("#dbFile").click(); });
        root.querySelector("#dbFile").addEventListener("change", function (e) {
          var f = e.target.files[0];
          if (!f) return;
          var rd = new FileReader();
          rd.onload = function () { importData(rd.result); e.target.value = ""; };
          rd.readAsText(f);
        });
        root.querySelector("#dbClear").addEventListener("click", function () {
          App.confirm("清空本设备资料库全部文章？（学报记录与术语保留）").then(function (ok) {
            if (ok) Store.clearArticles().then(function () { App.toast("已清空"); App.refresh(); });
          });
        });
        root.querySelector("#dbDedup").addEventListener("click", function () {
          App.confirm("将按规范化标题合并重复文章（跨源同题转载），保留翻译进度/收藏/选文最全的一篇，其余删除。继续？").then(function (ok) {
            if (!ok) return;
            MIRROR.cleanupDups().then(function (n) {
              App.toast(n > 0 ? "已清理 " + n + " 篇重复文章" : "没有发现重复文章", n > 0 ? "ok" : "");
              App.refresh();
            });
          });
        });
      }
      function exportData() {
        return Promise.all([Store.getAllArticles(), Store.getAllJournals(), Store.getAllTerms()]).then(function (res) {
          var data = {
            type: "xuebao-backup", version: 1, exportedAt: H.nowIso(),
            settings: Object.assign({}, s, { apiKey: s.apiKey || "" }),
            articles: res[0], journals: res[1], terms: res[2]
          };
          H.download("xuebao-backup-" + H.ymd() + ".json", new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
          App.toast("备份已导出", "ok");
        });
      }
      function importData(text) {
        var data;
        try { data = JSON.parse(text); } catch (e) { App.toast("文件格式错误", "err"); return; }
        if (!data || data.type !== "xuebao-backup" || !Array.isArray(data.articles)) { App.toast("不是有效的备份文件", "err"); return; }
        return Store.getAllArticles().then(function (exist) {
          var map = {};
          exist.forEach(function (a) { map[a.url] = a; });
          var updates = [];
          data.articles.forEach(function (a) {
            if (!a || !a.url) return;
            var old = map[a.url];
            if (old) {
              a.titleZh = old.titleZh || a.titleZh || "";
              a.titleZhLocked = old.titleZhLocked || 0;
              a.zhFull = old.zhFull || a.zhFull || "";
              a.zhState = old.zhFull ? old.zhState : (a.zhState || "none");
              a.selected = old.selected || 0;
              a.fav = old.fav || a.fav || 0;
              a.summaryZh = old.summaryZh || a.summaryZh || "";
            }
            updates.push(a);
          });
          var putTerms = (data.terms || []).map(function (t) { return Store.putTerm(t); });
          return Promise.all(putTerms).then(function () { return Store.bulkPutArticles(updates); });
        }).then(function () {
          App.toast("导入完成（合并，共 " + data.articles.length + " 条）", "ok");
          App.refresh();
        });
      }
    }
  };
  window.WB = window.WB || {};
  window.WB.modules = window.WB.modules || {};
  window.WB.modules.settings = M;
})();
