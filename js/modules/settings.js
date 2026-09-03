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
    var m = s.lastMirrorMeta || {};
    var ch = m.channels || m.meta || {};
    var keys = Object.keys(ch);
    var rows = keys.length
      ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">' + keys.map(function (k) {
          return '<span class="badge ghost">' + H.esc(LLM.CHANNEL_ZH[k] || k) + " " + ch[k] + "</span>";
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
    return '<div class="card"><h3>模型（翻译 / 编译在线直连）</h3>' +
      '<p style="margin:0 0 6px">状态：' + statusBadge(s) + "</p>" +
      '<p class="muted">翻译与出刊调用在线大模型接口。密钥仅保存在本机、不会上传；未配置时翻译与出刊会先提示去配置。</p>' +
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
      '<div class="art-actions"><button class="btn" id="pvTest">测试连接</button><button class="btn primary" id="pvSave">保存模型设置</button></div>' +
      '<div id="pvResult"></div>' +
      "</div>";
  }

  function effPx(s) {
    var p = parseInt(s.fontSizePx, 10);
    if (p > 0) return Math.min(24, Math.max(12, p));
    var m = { M: 16, L: 18, XL: 21 }[s.fontZoom || "M"] || 16;
    return m;
  }

  /* 设置项折叠：卡片只留标题，点击展开/收起 */
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
      h.addEventListener("click", function () {
        body.hidden = !body.hidden;
        h.classList.toggle("collapsed", body.hidden);
      });
    });
  }

  function displaySectionHtml(s) {
    var px = effPx(s);
    return '<div class="card"><h3>显示与字号</h3>' +
      '<p class="muted">拖动滑条实时预览，松手自动保存（12–24px，建议 14–20）。rem 相对字号，兼容 Chrome / Edge / Firefox / Safari。</p>' +
      '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
      '<label class="muted" for="dsRange">界面字号</label>' +
      '<input type="range" id="dsRange" min="12" max="24" step="1" value="' + px + '" style="flex:1;min-width:160px;max-width:320px">' +
      '<span class="badge" id="dsVal" style="background:#e4f1fd;color:#0b4f8f;font-size:.9rem;min-width:52px;text-align:center">' + px + " px</span>" +
      "</div>" +
      '<div class="fz-preview" id="fzSample">预览：英语情报 · 今日新增 29 篇 · “相关角标与摘要随字号实时缩放”</div>' +
      "</div>";
  }

  /* 主题外观（多主题系统：蓝天/深空夜航/纸面学报/极简灰） */
  var THEMES = [["", "蓝天 · 深邃", "linear-gradient(135deg,#2f7fd1,#0b4f8f)"],
                ["night", "深空夜航", "linear-gradient(135deg,#2a3d54,#0e1622)"],
                ["paper", "纸面学报", "linear-gradient(135deg,#a98a52,#6d5230)"],
                ["gray", "极简灰", "linear-gradient(135deg,#7d8a97,#4a5868)"]];
  function themeSectionHtml(s) {
    return '<div class="card"><h3>主题外观</h3>' +
      '<p class="muted" style="margin:2px 0 10px">一键切换整套配色，选择后即时生效并保存到本机。</p>' +
      '<div class="theme-grid" id="thGrid">' +
      THEMES.map(function (t) {
        return '<button type="button" class="theme-pick' + ((s.theme || "") === t[0] ? " on" : "") + '" data-th="' + t[0] + '" title="' + H.esc(t[1]) + '">' +
          '<span class="th-swatch" style="background:' + t[2] + '"></span>' +
          '<span class="th-name">' + H.esc(t[1]) + "</span>" +
          ((s.theme || "") === t[0] ? '<span class="th-check">✓ 使用中</span>' : "") +
          "</button>";
      }).join("") + "</div></div>";
  }

  function cleanSectionHtml(s) {
    var opts = [[7, "1 周"], [30, "1 个月"], [90, "3 个月"], [180, "6 个月"], [365, "1 年"]];
    var sel = opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (parseInt(s.retentionDays, 10) === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
    }).join("");
    return sel;
  }

  /* 排序与喜好学习：权重滑条 + 探索率 + 离线回测（榜单/简报共用，纯本地零成本） */
  function rankSectionHtml(s) {
    var w = s.rankWeights || {};
    var rw = function (k) { var v = parseInt(w[k], 10); return isNaN(v) || v < 0 ? 0 : v; };
    var ex = Math.round(((s.exploreRate == null ? 0.1 : s.exploreRate)) * 100);
    var btLast = s.btLastAt ? H.fmtDateTime(s.btLastAt) + "（" + H.ago(s.btLastAt) + "）" : "从未";
    function slider(id, label, v, max) {
      max = max || 100;
      return '<div class="field rw-field"><label class="wlab"><span>' + label + '</span><b id="' + id + 'V">' + v + "%</b></label>" +
        '<input type="range" id="' + id + '" min="0" max="' + max + '" step="5" value="' + Math.min(max, v) + '"></div>';
    }
    return '<div class="card"><h3>排序与喜好学习</h3>' +
      '<p class="muted">四项权重作用于「兴趣榜」与「周末简报」的排序（自动按总和归一）；松手即保存，纯本地生效。</p>' +
      slider("rwRel", "兴趣相关（关键词命中）", rw("rel")) +
      slider("rwFresh", "新鲜度（越新分越高）", rw("fresh")) +
      slider("rwSource", "来源权威（官方直连加权）", rw("source")) +
      slider("rwHeat", "热度（收藏 / 出刊 / 同主题）", rw("heat")) +
      slider("rwEx", "探索率（给非关键词内容留的比例）", ex, 30) +
      '<div class="art-actions" style="margin-top:4px">' +
      '<button class="btn sm" id="rwReset">恢复默认</button>' +
      '<button class="btn sm primary" id="btRun">运行一次离线回测</button></div>' +
      '<div id="rwMsg" class="muted" style="margin-top:8px">离线回测：把您的收藏当标准答案，按当前权重统计收藏进入排序前 20% 的比例，验证配比是否懂您。</div>' +
      '<div class="field" style="margin-top:6px"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="btAuto"' + (s.btAuto ? " checked" : "") + "> 打开页面时自动回测（每日最多一次，结果投递收件箱）</label></div>" +
      '<div class="field" style="margin-top:0"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="bfAutoTune"' + (s.autoTune ? " checked" : "") + "> 自动微调排序权重（每日最多一次；您 24 小时内手动调过则跳过，尊重手动）</label></div>" +
      '<p class="muted" style="margin:4px 0 0">上次回测：' + btLast + '</p></div>';
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
    return '<div class="card"><h3>资料刷新（自动抓取）</h3>' +
      '<label style="display:flex;gap:6px;align-items:center;margin-bottom:8px"><input type="checkbox" id="rfOn"' + (s.autoRefresh ? " checked" : "") + "> 每日定时自动刷新官方信源</label>" +
      '<div class="field"><label>刷新时段（多选，至少一个；到点各静默拉取一次）</label>' +
      '<div class="time-chips" id="rfChips">' +
      TIME_OPTS.map(function (t) {
        return '<button type="button" class="time-chip' + (rt.indexOf(t) >= 0 ? " on" : "") + '" data-t="' + t + '">' + t + "</button>";
      }).join("") + "</div></div>" +
      '<p class="muted">到设定时间各静默拉取一次；失败不打扰，留待下一时段自动重试。这是资料更新的主要途径。</p>' +
      '<div class="art-actions"><button class="btn primary" id="rfSave">保存刷新设置</button></div></div>';
  }

  /* 自动化与行为：全部默认关闭，按分类手风琴展开；保存按钮统一在此 */
  function behaviorSectionHtml(s) {
    var sel = cleanSectionHtml(s);
    return '<div class="card"><h3>自动化与行为</h3>' +
      '<p class="muted" style="margin:2px 0 10px">除「资料刷新」外，其余自动化默认全部关闭（点组标题展开）。涉及 AI 的功能会消耗模型额度，请按需开启。</p>' +
      grp("翻译与摘要自动化", true,
        '<label style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" id="bfAutoTr"' + (s.autoTranslate ? " checked" : "") + "> 进资料库时自动翻译新标题</label>" +
        '<label style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" id="bfFavTr"' + (s.favAutoTr ? " checked" : "") + "> 收藏时自动：生成中文标题 + 中/英摘要</label>" +
        '<label style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" id="bfFavFull"' + (s.favAutoFull ? " checked" : "") + "> 收藏时自动：全文翻译（可与上项组合）</label>" +
        '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="bfCmpAuto"' + (s.compareAutoFull ? " checked" : "") + "> 阅读页「中英对照」缺译文时自动翻译全文</label>") +
      grp("周末简报", false,
        '<label style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" id="bfBrief"' + (s.weeklyBrief ? " checked" : "") + "> 周末简报自动投递（周六/周日首次打开）</label>" +
        '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="bfBriefAi"' + (s.briefAi ? " checked" : "") + "> 简报 AI 增强：全期综述 + 逐条点评（需配置模型）</label>" +
        '<div class="art-actions" style="margin-top:8px"><button class="btn" id="bfBriefNow">立即生成本周简报</button></div>') +
      grp("资料清理", false,
        '<label style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" id="bfAutoClean"' + (s.autoClean ? " checked" : "") + "> 自动清理过期资料（收藏/已选/已出刊永不自动删）</label>" +
        '<div class="filters" style="margin-top:8px;margin-bottom:0"><span class="muted">保留期</span><select id="clDays">' + sel + "</select></div>" +
        '<div class="art-actions" style="margin-top:8px"><button class="btn primary" id="clSave">保存保留期</button><button class="btn" id="clRun">立即清理过期文章</button></div>' +
        '<div id="clMsg" class="muted" style="margin-top:6px">自动清理在打开页面与每次拉取后执行。</div>') +
      grp("系统与更新", false,
        '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="bfAutoChk"' + (s.autoCheck !== false ? " checked" : "") + "> 自动接收新版本与公告（打开页面即检查，约 10 分钟一次；仅读通知不耗模型）</label>") +
      grp("供稿署名", false,
        '<div class="field"><label>供稿署名默认文案（生成进 docx 后可在 Word 修改）</label><input id="bfSign" value="' + H.esc(s.signatureText || "") + '"></div>') +
      '<div class="modal-actions" style="margin-top:12px"><button class="btn primary" id="bfSave">保存自动化与行为设置</button></div></div>';
  }

  function mirrorSectionHtml(s) {
    return '<div class="card"><h3>镜像与抓取</h3>' + mirrorStatusHtml(s) +
      '<div class="field"><label>信源镜像仓库（只读，由部署维护，请勿修改以防异常）</label>' +
      '<div class="mono">' + H.esc(s.mirrorRepo || "未配置") + "</div></div>" +
      '<div class="field"><label>更新通知仓库（只读）</label>' +
      '<div class="mono">' + H.esc(s.updateRepo || "未配置") + "</div></div>" +
      '<p class="muted">说明：抓取在 GitHub Actions（每天 09:00）完成；本页仅展示状态与仓库信息，不可编辑。</p>' +
      '<div class="art-actions"><button class="btn" id="bfChkUpdate">检查更新</button></div>' +
      '<div id="bfRepoMsg" class="muted" style="margin-top:6px"></div></div>';
  }

  function dataSectionHtml() {
    return '<div class="card"><h3>数据与本机占用（本设备独立）</h3>' +
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
      '<p class="muted">导出包含文章、译文、摘要、术语、学报记录与设置；导入按 url 合并（本设备已有的译文/锁定不会被覆盖）。备份用于换设备/迁移，数据不上云。</p>' +
      "</div>";
  }

  var M = {
    key: "settings",
    label: "设置",
    async render(el) {
      var s = Store.settings;
      var usage = await Store.usage();
      var arts = await Store.getAllArticles();
      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">设置</h1>' +
        '<p class="view-sub">设置按分类收纳：点击标题展开或收起。除每日定时刷新外，所有自动化默认关闭，请按需开启。</p></div></div>' +
        modelSectionHtml(s) +
        refreshSectionHtml(s) +
        behaviorSectionHtml(s) +
        rankSectionHtml(s) +
        displaySectionHtml(s) +
        themeSectionHtml(s) +
        mirrorSectionHtml(s) +
        dataSectionHtml() +
        '<div class="card"><h3>关于</h3>' +
        '<div class="muted">英语情报 v' + H.esc(s.appVersion || "1.0.0") +
        "（build " + (s.versionCode || 2) + "）<br>面向军迷与研究工作者的外军防务资讯情报台：每日定时汇集多个官方信源，支持双语阅读、术语标注、兴趣排序与一键出刊（学报 docx）。<br>" +
        "数据与设置只保存在本机浏览器中，导出备份即可迁移到其它设备。</div></div>";

      collapseCards(el, ["模型（", "资料刷新", "自动化与行为", "排序与喜好学习", "显示与字号", "主题外观", "数据与本机占用", "关于"]);
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
        root.querySelector("#pvSave").addEventListener("click", function () {
          var isP = root.querySelector('input[name="pvMode"]:checked').value === "preset";
          s.provider = isP ? "preset" : "custom";
          s.preset = root.querySelector("#pvSel").value;
          s.apiKey = root.querySelector("#pvKey").value.trim();
          if (isP) {
            s.presetBaseUrl = root.querySelector("#pvBase").value.trim();
            s.presetModel = root.querySelector("#pvModel").value.trim();
          } else {
            s.baseUrl = root.querySelector("#pvBase").value.trim();
            s.model = root.querySelector("#pvModel").value.trim();
          }
          Store.saveSettings();
          App.toast("模型设置已保存", "ok");
          App.refresh();
        });
        root.querySelector("#pvTest").addEventListener("click", function () {
          var box = root.querySelector("#pvResult");
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
          LLM.testConnection().then(function (res) {
            box.innerHTML = '<div class="ok-line">连接正常，模型回复：' + H.esc(res) + "</div>";
            Store.saveSettings();
          }).catch(function (err) {
            box.innerHTML = '<div class="note">' + H.esc(err.message || "测试失败") + "</div>";
          });
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
        // 排序与喜好学习：滑条实时显示 + 松手保存（权重/探索率）；回测与自动回测
        function bindRw(root, s) {
          var map = [["rwRel", "rel"], ["rwFresh", "fresh"], ["rwSource", "source"], ["rwHeat", "heat"]];
          map.forEach(function (pair) {
            var r = root.querySelector("#" + pair[0]);
            if (!r) return;
            r.addEventListener("input", function () {
              var v = root.querySelector("#" + pair[0] + "V");
              if (v) v.textContent = r.value + "%";
            });
            r.addEventListener("change", function () {
              s.rankWeights = s.rankWeights || {};
              s.rankWeights[pair[1]] = parseInt(r.value, 10);
              Store.saveSettings();
            });
          });
          var ex = root.querySelector("#rwEx");
          if (ex) {
            ex.addEventListener("input", function () {
              var v = root.querySelector("#rwExV");
              if (v) v.textContent = ex.value + "%";
            });
            ex.addEventListener("change", function () {
              s.exploreRate = parseFloat(ex.value) / 100;
              Store.saveSettings();
            });
          }
          var rs = root.querySelector("#rwReset");
          if (rs) rs.addEventListener("click", function () {
            s.rankWeights = { rel: 40, fresh: 25, source: 20, heat: 15 };
            s.exploreRate = 0.1;
            [[ "rwRel", 40], ["rwFresh", 25], ["rwSource", 20], ["rwHeat", 15], ["rwEx", 10]].forEach(function (p) {
              var r = root.querySelector("#" + p[0]);
              if (r) { r.value = p[1]; root.querySelector("#" + p[0] + "V").textContent = p[1] + "%"; }
            });
            Store.saveSettings();
            App.toast("已恢复默认配比", "ok");
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
        // 自动化与行为
        root.querySelector("#bfSave").addEventListener("click", function () {
          s.signatureText = root.querySelector("#bfSign").value.trim();
          s.autoTranslate = root.querySelector("#bfAutoTr").checked;
          s.favAutoTr = root.querySelector("#bfFavTr").checked;
          s.favAutoFull = root.querySelector("#bfFavFull").checked;
          s.compareAutoFull = root.querySelector("#bfCmpAuto").checked;
          s.autoClean = root.querySelector("#bfAutoClean").checked;
          s.autoCheck = root.querySelector("#bfAutoChk").checked;
          s.weeklyBrief = root.querySelector("#bfBrief").checked;
          s.briefAi = root.querySelector("#bfBriefAi").checked;
          Store.saveSettings();
          App.toast("已保存", "ok");
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
        // 镜像与更新（仓库只读，仅支持检查更新）
        root.querySelector("#bfChkUpdate").addEventListener("click", function () {
          var repo = s.updateRepo;
          if (!repo) { App.toast("未配置更新仓库（后期发布后填入即可启用更新通知）"); return; }
          var urls = [
            "https://cdn.jsdelivr.net/gh/" + repo + "@main/update.json",
            "https://raw.githubusercontent.com/" + repo + "/main/update.json"
          ];
          var lastErr = null;
          var chain = Promise.reject();
          urls.forEach(function (u) { chain = chain.catch(function () { return fetch(u, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); }); }); });
          chain.then(function (j) {
            var remote = parseInt(j.versionCode, 10);
            var local = parseInt(s.versionCode, 10) || 0;
            var msg = "远端版本 " + j.versionName + "（build " + remote + "）" + (remote > local ? "，可更新：" + (j.notes || "") : "，本机已是最新。");
            root.querySelector("#bfRepoMsg").innerHTML = '<div class="ok-line">' + H.esc(msg) + "</div>";
          }).catch(function () { root.querySelector("#bfRepoMsg").innerHTML = '<div class="note">检查失败（网络或仓库未配置 update.json）</div>'; });
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
