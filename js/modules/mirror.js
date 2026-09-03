/* modules/mirror.js —— 拉取 GitHub 镜像 JSON、入库合并、标题/全文翻译任务 */
(function () {
  "use strict";

  var busy = false;

  function normTitle(t) {
    return String(t || "").toLowerCase().replace(/[\W_]+/g, "");
  }

  function mirrorUrls(repo) {
    repo = (repo || Store.settings.mirrorRepo || "").trim().replace(/\.git$/, "");
    var base = "feeds/latest.json";
    return [
      "https://cdn.jsdelivr.net/gh/" + repo + "@main/" + base,
      "https://fastly.jsdelivr.net/gh/" + repo + "@main/" + base,
      "https://gcore.jsdelivr.net/gh/" + repo + "@main/" + base,
      "https://raw.githubusercontent.com/" + repo + "/main/" + base
    ];
  }

  function fetchJson(url, ms) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms || 45000);
    return fetch(url, { cache: "no-store", signal: ctrl.signal }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).finally(function () { clearTimeout(timer); });
  }

  function pull() {
    var urls = mirrorUrls(Store.settings.mirrorRepo);
    var lastKnown = Store.settings.lastMirrorUpdatedAt ? new Date(Store.settings.lastMirrorUpdatedAt).getTime() : 0;
    var lastErr = null;
    var seq = Promise.reject();
    urls.forEach(function (u) {
      seq = seq.catch(function () { return fetchJson(u); }).then(function (json) {
        var t = json && json.updatedAt ? new Date(json.updatedAt).getTime() : 0;
        if (lastKnown && t && t <= lastKnown) {
          throw new Error("CDN 缓存延迟（内容未比上次新），尝试下一通道");
        }
        return json;
      });
    });
    return seq.catch(function (e) {
      lastErr = e;
      throw new Error("镜像拉取失败（各通道均不可用或均为旧缓存）：" + (e && e.message));
    });
  }

  /* 合并镜像条目进本设备资料库（按 url + 规范化标题双重去重，防跨源同题重复） */
  function merge(json) {
    return Store.getAllArticles().then(function (existing) {
      var have = {}, haveT = {};
      existing.forEach(function (a) {
        have[a.url] = 1;
        var k = normTitle(a.title);
        if (k) haveT[k] = 1;
      });
      var added = [];
      (json.items || []).forEach(function (it) {
        if (!it || !it.url || have[it.url]) return;
        var k = normTitle(it.title);
        if (k && haveT[k]) return; // 同题（跨源转载）已存在，跳过
        if (k) haveT[k] = 1;
        var art = {
          url: it.url,
          channel: it.channel || "",
          channelName: it.channelName || "",
          level: "A",
          title: (it.title || "").trim(),
          author: it.author || "",
          pubDate: it.pubDate || "",
          summary: it.summary || "",
          body: it.body || "",
          fetchedAt: H.nowIso(),
          titleZh: "",
          titleZhLocked: 0,
          titleTrans: "pending",
          summaryZh: "",
          summaryEn: "",
          fav: 0,
          zhFull: "",
          zhState: "none",
          zhDone: 0,
          zhChunks: 0,
          selected: 0,
          journalMade: 0
        };
        added.push(art);
        have[it.url] = 1;
      });
      if (added.length) return Store.bulkPutArticles(added).then(function () { return added.length; });
      return 0;
    });
  }

  /* 一键清理历史重复：同规范化标题多篇时保留信息最全/最有价值的一篇，其余删除；返回删除条数 */
  function cleanupDups() {
    return Store.getAllArticles().then(function (all) {
      var groups = {};
      all.forEach(function (a) {
        var k = normTitle(a.title);
        if (!k) return;
        (groups[k] = groups[k] || []).push(a);
      });
      var del = [];
      Object.keys(groups).forEach(function (k) {
        var arr = groups[k];
        if (arr.length < 2) return;
        function score(x) {
          return (x.fav ? 100 : 0) + (x.selected ? 80 : 0) + (x.journalMade ? 60 : 0) +
            (x.titleZh ? 40 : 0) + (x.zhState === "ok" ? 30 : 0) +
            ((x.zhFull || "").length ? 20 : 0) + ((x.body || "").length ? 15 : 0);
        }
        arr.sort(function (a, b) {
          return (score(b) - score(a)) || String(a.fetchedAt || "").localeCompare(String(b.fetchedAt || ""));
        });
        arr.slice(1).forEach(function (x) { del.push(x.url); });
      });
      if (!del.length) return 0;
      return del.reduce(function (p, u) { return p.then(function () { return Store.deleteArticle(u); }); }, Promise.resolve())
        .then(function () { return del.length; });
    });
  }

  /* 标题翻译（顺次；跳过已锁定）。新版同时生成中文摘要 */
  function translateTitles(list, onProgress) {
    if (!list || !list.length) return Promise.resolve(0);
    return Store.getAllTerms().then(function (terms) {
      var glossary = LLM.glossaryLines(terms);
      var done = 0;
      function one(i) {
        if (i >= list.length) return Promise.resolve(done);
        var art = list[i];
        if (art.titleZhLocked) return one(i + 1);
        return LLM.translateTitleSummary(art.title, art.summary || art.body, glossary).then(function (out) {
          var p = parseTriple(out);
          art.titleZh = p.zh || "";
          art.summaryZh = p.sumZh || "";
          art.summaryEn = p.sumEn || "";
          art.titleTrans = art.titleZh ? "ok" : "failed";
          return Store.putArticle(art);
        }).catch(function () {
          art.titleTrans = "failed";
          return Store.putArticle(art);
        }).then(function () {
          done++;
          if (onProgress) onProgress(i + 1, list.length, art);
          return one(i + 1);
        });
      }
      return one(0);
    });
  }

  /* 标题已译但缺摘要（老数据补摘要用） */
  function pendingSummaries(articles) {
    return (articles || []).filter(function (a) {
      return a.titleZh && !a.titleZhLocked && (!a.summaryZh || !a.summaryEn);
    });
  }

  function parseTriple(out) {
    var ls = String(out || "").split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    return { zh: ls[0] || "", sumZh: ls[1] || "", sumEn: ls[2] || "" };
  }

  /* 仅自动翻译标题（不动摘要），用于“打开即自动翻译标题” */
  function translateTitlesOnly(list, onProgress) {
    if (!list || !list.length) return Promise.resolve(0);
    return Store.getAllTerms().then(function (terms) {
      var glossary = LLM.glossaryLines(terms);
      var done = 0;
      function one(i) {
        if (i >= list.length) return Promise.resolve(done);
        var art = list[i];
        if (art.titleZhLocked) return one(i + 1);
        return LLM.translateTitle(art.title, glossary).then(function (zh) {
          art.titleZh = zh;
          art.titleTrans = "ok";
          return Store.putArticle(art);
        }).catch(function () {
          art.titleTrans = "failed";
          return Store.putArticle(art);
        }).then(function () {
          done++;
          if (onProgress) onProgress(i + 1, list.length, art);
          return one(i + 1);
        });
      }
      return one(0);
    });
  }

  /* 摘要生成（中文+英文），保留已有中文标题不动 */
  function summarizeList(list, onProgress) {
    if (!list || !list.length) return Promise.resolve(0);
    return Store.getAllTerms().then(function (terms) {
      var glossary = LLM.glossaryLines(terms);
      var done = 0;
      function one(i) {
        if (i >= list.length) return Promise.resolve(done);
        var art = list[i];
        return LLM.translateTitleSummary(art.title, art.summary || art.body, glossary).then(function (out) {
          var p = parseTriple(out);
          if (!art.titleZh && p.zh) { art.titleZh = p.zh; art.titleTrans = "ok"; }
          art.summaryZh = p.sumZh;
          art.summaryEn = p.sumEn;
          return Store.putArticle(art);
        }).catch(function () { return Store.putArticle(art); }).then(function () {
          done++;
          if (onProgress) onProgress(i + 1, list.length, art);
          return one(i + 1);
        });
      }
      return one(0);
    });
  }

  /* 兼容旧命名：摘要（中英） */
  function translateSummaries(list, onProgress) {
    return summarizeList(list, onProgress);
  }

  /* 自动清理过期文章：保留期外且非收藏/非已选/非已出刊者删除；返回删除条数 */
  function cleanupOld(daysOverride) {
    var days = parseInt(daysOverride || Store.settings.retentionDays, 10) || 90;
    var cutoff = Date.now() - days * 24 * 3600 * 1000;
    return Store.getAllArticles().then(function (all) {
      var urls = all.filter(function (a) {
        if (a.fav || a.selected || a.journalMade) return false;
        var t = new Date(a.pubDate || a.fetchedAt || 0).getTime();
        return t && t < cutoff;
      }).map(function (a) { return a.url; });
      if (!urls.length) return 0;
      return urls.reduce(function (p, u) { return p.then(function () { return Store.deleteArticle(u); }); }, Promise.resolve())
        .then(function () { return urls.length; });
    });
  }

  function pendingTitles(articles) {
    return (articles || []).filter(function (a) {
      return a.titleTrans === "pending" && !a.titleZh;
    });
  }

  /* 全文翻译：按段落分块（每块约 1500 字符），断点续传 */
  function chunkBody(body) {
    var paras = String(body || "").split(/\n{2,}/).map(function (s) { return s.trim(); }).filter(Boolean);
    var chunks = [], cur = "";
    paras.forEach(function (p) {
      if ((cur + "\n\n" + p).length > 1500 && cur) { chunks.push(cur); cur = p; }
      else cur = cur ? cur + "\n\n" + p : p;
    });
    if (cur) chunks.push(cur);
    return chunks;
  }

  /* art: 文章对象（含 url）；opts: {onChunk, onState, isCancelled} */
  function translateFull(art, opts) {
    if (busy) return Promise.reject(new Error("已有翻译任务在运行，请稍候"));
    busy = true;
    opts = opts || {};
    return Store.getAllTerms().then(function (terms) {
      var glossary = LLM.glossaryLines(terms);
      var chunks = chunkBody(art.body);
      art.zhChunks = chunks.length;
      return Store.putArticle(art).then(function () { return { chunks: chunks, glossary: glossary }; });
    }).then(function (p) {
      return Store.getArticle(art.url).then(function (cur) {
        var chunks = p.chunks, glossary = p.glossary;
        var resume = cur && (cur.zhState === "running" || cur.zhState === "failed") && cur.zhDone > 0;
        var from = resume ? (cur.zhDone || 0) : 0;
        var acc = resume ? (cur.zhFull || "") : "";
        var i = from;
        function step() {
          if (i >= chunks.length) {
            cur.zhState = "ok";
            cur.zhFull = acc;
            cur.zhDone = chunks.length;
            cur.zhTransFail = undefined;
            return Store.putArticle(cur).then(function () {
              if (opts.onState) opts.onState("ok");
            });
          }
          if (opts.isCancelled && opts.isCancelled()) {
            cur.zhState = "failed";
            return Store.putArticle(cur).then(function () {
              if (opts.onState) opts.onState("failed");
            });
          }
          if (opts.onChunk) opts.onChunk(i + 1, chunks.length);
          return LLM.translateChunk(chunks[i], glossary).then(function (zh) {
            acc = acc ? acc + "\n\n" + zh : zh;
            cur.zhState = "running";
            cur.zhFull = acc;
            cur.zhDone = i + 1;
            return Store.putArticle(cur).then(function () { i++; return step(); });
          }).catch(function () {
            cur.zhState = "failed";
            return Store.putArticle(cur).then(function () {
              if (opts.onState) opts.onState("failed");
            });
          });
        }
        return step();
      });
    }).finally(function () { busy = false; });
  }

  /* 术语命中（英文字段里出现启用的词条） */
  function hits(terms, text) {
    if (!terms || !terms.length || !text) return [];
    var low = String(text).toLowerCase();
    return terms.filter(function (t) {
      return t.enabled !== 0 && t.term_en && low.indexOf(String(t.term_en).toLowerCase()) >= 0;
    }).map(function (t) { return { en: t.term_en, zh: t.term_zh }; });
  }

  window.MIRROR = {
    mirrorUrls: mirrorUrls,
    pull: pull,
    merge: merge,
    cleanupDups: cleanupDups,
    translateTitles: translateTitles,
    translateTitlesOnly: translateTitlesOnly,
    translateSummaries: translateSummaries,
    summarizeList: summarizeList,
    pendingTitles: pendingTitles,
    pendingSummaries: pendingSummaries,
    cleanupOld: cleanupOld,
    translateFull: translateFull,
    hits: hits,
    isBusy: function () { return busy; }
  };
})();
