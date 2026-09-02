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
      '<p class="muted">仅使用在线 API（OpenAI 兼容）。Key 只存在本设备，谁打开页面用谁的 Key；未配置时翻译与出刊会提示。</p>' +
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

  function cleanSectionHtml(s) {
    var opts = [[7, "1 周"], [30, "1 个月"], [90, "3 个月"], [180, "6 个月"], [365, "1 年"]];
    var sel = opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (parseInt(s.retentionDays, 10) === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
    }).join("");
    return '<div class="card"><h3>资料清理（防过度堆积）</h3>' +
      '<p class="muted">自动按保留期删除过期文章。<b>收藏、已选入学报、已出刊</b>的文章永不自动删除。已出刊内容已独立存档于「学报记录」，删除资料不影响已生成的文件。</p>' +
      '<div class="filters">' +
      '<label class="chip" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="clAuto"' + (s.autoClean ? " checked" : "") + "> 启用自动清理</label>" +
      "<span class=\"muted\">保留期</span><select id=\"clDays\">" + sel + "</select>" +
      "</div>" +
      '<div class="art-actions" style="margin-top:8px"><button class="btn primary" id="clSave">保存清理设置</button>' +
      '<button class="btn" id="clRun">立即清理过期文章</button></div>' +
      '<div id="clMsg" class="muted" style="margin-top:6px">自动清理在每次打开页面与拉取更新后执行。</div></div>';
  }

  function behaviorSectionHtml(s) {
    return '<div class="card"><h3>行为默认值</h3>' +
      '<div class="field"><label>供稿署名默认文案（生成进 docx 后可在 Word 修改）</label>' +
      '<input id="bfSign" value="' + H.esc(s.signatureText || "") + '"></div>' +
      '<label style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" id="bfAutoTr"' + (s.autoTranslate ? " checked" : "") + "> 拉取后自动翻译新标题与摘要（需已配置模型）</label>" +
      '<label style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" id="bfFavTr"' + (s.favAutoTr ? " checked" : "") + "> 收藏文章时自动：生成中文标题 + 摘要（需已配置模型）</label>" +
      '<label style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" id="bfFavFull"' + (s.favAutoFull ? " checked" : "") + "> 收藏文章时自动：全文翻译（与上一项自由组合，可只开其一或全关）</label>" +
      '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="bfAutoPull"' + (s.autoPull ? " checked" : "") + "> 打开页面时自动拉取镜像（30 分钟内有数据则不重复拉）</label>" +
      '<div class="modal-actions" style="margin-top:8px"><button class="btn primary" id="bfSave">保存</button></div></div>';
  }

  function mirrorSectionHtml(s) {
    return '<div class="card"><h3>镜像与抓取</h3>' + mirrorStatusHtml(s) +
      '<div class="field" style="margin-top:8px"><label>信源镜像仓库（GitHub 仓库，格式 owner/repo）</label><input id="bfRepo" value="' + H.esc(s.mirrorRepo || "") + '"></div>' +
      '<div class="field"><label>更新通知仓库（后期功能：发布仓库含 update.json；留空不检查）</label><input id="bfUrepo" value="' + H.esc(s.updateRepo || "") + '" placeholder="owner/repo"></div>' +
      '<div class="modal-actions" style="margin-top:8px"><button class="btn primary" id="bfRepoSave">保存</button>' +
      '<button class="btn" id="bfChkUpdate">检查更新</button></div>' +
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
        '<p class="view-sub">模型切换、字号、清理、行为默认值、镜像仓库、数据备份</p></div></div>' +
        modelSectionHtml(s) +
        '<div class="set-grid">' + displaySectionHtml(s) + cleanSectionHtml(s) + "</div>" +
        '<div class="set-grid">' + behaviorSectionHtml(s) + dataSectionHtml() + "</div>" +
        mirrorSectionHtml(s) +
        '<div class="card"><h3>关于</h3>' +
        '<div class="muted">英语情报 · 信息搜集与情报工作台 v' + H.esc(s.appVersion || "1.2.0") +
        "（build " + (s.versionCode || 2) + "）<br>形态：纯静态网页应用（参照个人工作台模式），双击 index.html 即可用；" +
        "部署成网址后电脑/平板/手机打开即用，各设备数据独立。<br>采集：9 个官方直连源（含国防部/陆战队/空军等）由 GitHub Actions 每天 09:00 抓取镜像，每源每轮 ≤20 条；" +
        "docx 版式严格遵循范文《以色列研发智能反无人机系统Iron Drone Raider.docx》。</div></div>";

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
        // 清理
        root.querySelector("#clSave").addEventListener("click", function () {
          s.autoClean = root.querySelector("#clAuto").checked;
          s.retentionDays = parseInt(root.querySelector("#clDays").value, 10) || 90;
          Store.saveSettings();
          App.toast("清理设置已保存", "ok");
        });
        root.querySelector("#clRun").addEventListener("click", function () {
          MIRROR.cleanupOld().then(function (n) {
            var msg = n > 0 ? "已清理 " + n + " 篇过期文章" : "没有可清理的过期文章（收藏/已选/已出刊均受保护）";
            root.querySelector("#clMsg").innerHTML = '<div class="ok-line">' + H.esc(msg) + "</div>";
            App.refresh();
          });
        });
        // —— 兴趣相关（关键词/喜好学习）已移至左侧「兴趣中心」页 ——
        // 行为
        root.querySelector("#bfSave").addEventListener("click", function () {
          s.signatureText = root.querySelector("#bfSign").value.trim();
          s.autoTranslate = root.querySelector("#bfAutoTr").checked;
          s.favAutoTr = root.querySelector("#bfFavTr").checked;
          s.favAutoFull = root.querySelector("#bfFavFull").checked;
          s.autoPull = root.querySelector("#bfAutoPull").checked;
          Store.saveSettings();
          App.toast("已保存", "ok");
        });
        // 镜像仓库 / 更新
        root.querySelector("#bfRepoSave").addEventListener("click", function () {
          s.mirrorRepo = root.querySelector("#bfRepo").value.trim();
          s.updateRepo = root.querySelector("#bfUrepo").value.trim();
          Store.saveSettings();
          App.toast("已保存", "ok");
          App.refresh();
        });
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
