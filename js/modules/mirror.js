/* modules/mirror.js —— 拉取 GitHub 镜像 JSON、入库合并、标题/摘要/全文翻译（后台任务调度器） */
(function () {
  "use strict";

  /* —— 后台任务调度器：多任务并发（并发池），全文翻译文内保序、多任务互不阻塞 —— */
  var RUNNERS = {
    _active: [],        // 进行中（排队/运行/刚完成 3 秒内）任务
    _running: 0,
    _concurrency: 3,    // 同时最多并行的翻译请求路数（含标题/摘要/全文，按需可调）
    _nextId: 1,
    _listen: [],
    _emitTimer: 0,
    onChange: function (fn) { this._listen.push(fn); return fn; },
    _emit: function () {
      var self = this;
      if (this._emitTimer) return;
      this._emitTimer = setTimeout(function () {
        self._emitTimer = 0;
        self._listen.forEach(function (f) { try { f(); } catch (e) {} });
      }, 160);
    },
    /* 提交一个任务。job: {kind,label,total,done,fn:(task,cancel)=>Promise} */
    submit: function (job) {
      var t = {
        id: "t" + (this._nextId++),
        kind: job.kind || "task",
        label: job.label || "翻译",
        url: job.url || "",          // 关联文章（用于同文勿重复提交）
        total: job.total || 0,
        done: job.done || 0,
        state: "queued",       // queued/running/ok/cancelled/failed
        cancel: false,
        err: "",
        _doneAt: 0,
        _dirty: false
      };
      var self = this;
      t._runJob = function (task) { return job.fn(task, function () { return task.cancel; }); };
      this._active.push(t);
      this._sync();
      this._emit();
      this._pump();
      return t;
    },
    _pump: function () {
      while (this._running < this._concurrency) {
        var idx = -1;
        this._active.forEach(function (t, i) { if (idx < 0 && t.state === "queued") idx = i; });
        if (idx < 0) break;
        var t = this._active[idx];
        t.state = "running";
        this._running++;
        var self = this;
        Promise.resolve().then(function () { return t._runJob(t); })
          .then(function () { t.state = "ok"; })
          .catch(function (e) { t.state = t.cancel ? "cancelled" : "failed"; t.err = (e && e.message) || "失败"; })
          .then(function () {
            t._doneAt = Date.now();
            self._running--;
            self._settle(t);
            self._pump();
          });
      }
      this._sync();
      this._emit();
    },
    /* 任务结束：成功保留片刻便于任务栏显示“完成”；失败保留较久，便于看到原因 */
    _settle: function (t) {
      var keep = t.state === "ok" ? 4000 : 12000;
      t._doneAt = Date.now();
      var self = this;
      setTimeout(function () {
        self._active = self._active.filter(function (x) { return x !== t; });
        self._emit();
      }, keep);
    },
    /* 主动进度上报（每段调用，节流 emit 刷新任务栏） */
    touch: function (t, done) {
      t.done = done; t.total = t.total || done;
      if (t.state === "queued") t.state = "running";
      this._emit();
    },
    cancel: function (id) {
      var t = this._active.find ? this._active.find(function (x) { return x.id === id; }) : null;
      if (!t) return;
      if (t.state === "queued") {
        t.cancel = true;
        t.state = "cancelled";
        this._active = this._active.filter(function (x) { return x !== t; });
        this._settle(t);
      } else if (t.state === "running") {
        t.cancel = true; // 由段落循环内 cancel() 检测后停止
      }
      this._emit();
    },
    list: function () {
      // 任务栏：只暴露正在动/刚结束的任务快照，避免携带动 run Job 闭包
      return this._active.map(function (t) {
        return { id: t.id, kind: t.kind, label: t.label, url: t.url, total: t.total, done: t.done, state: t.state, err: t.err };
      });
    },
    /* 是否有该文章的全文翻译任务正活跃（排队/运行/刚结束片刻） */
    hasFull: function (url) {
      if (!url) return false;
      return this._active.some(function (t) { return t.kind === "full" && t.url === url; });
    },
    /* 合并 _active 变更后的同步辅助（当前由各调用点维护 _active 即可） */
    _sync: function () {},
    count: function () {
      return this._active.filter(function (t) { return t.state === "queued" || t.state === "running"; }).length;
    }
  };

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
    // 多通道并行：同时请求所有镜像通道，从成功结果里选 updatedAt 最新的一份。
    // 规避单一 CDN（如 jsdelivr）缓存滞后一整天导致的“永远拉不到最新”；返回结构始终携带 items 供 merge 入库。
    return Promise.all(urls.map(function (u) {
      return fetchJson(u).then(function (json) {
        return { src: u, json: json };
      }).catch(function () { return null; });
    })).then(function (results) {
      var best = null;
      results.forEach(function (r) {
        if (!r || !r.json || !Array.isArray(r.json.items)) return;
        var t = r.json.updatedAt ? new Date(r.json.updatedAt).getTime() : 0;
        if (!best || t > best._t) { best = r.json; best._t = t; best._src = r.src; }
      });
      if (!best) throw new Error("镜像拉取失败（各通道均不可用）");
      best.__fresh__ = !(lastKnown && best._t && best._t <= lastKnown);
      return best; // { updatedAt, meta, items, __fresh__ } → merge 读 items 入库
    });
  }

  /* 合并镜像条目进本设备资料库（按 url + 规范化标题双重去重，防跨源同题重复）。
     新增：本机无此文章时入库；回填：本机已有但正文为空、镜像有正文时补全（修复“有链接可见原文但系统内暂无正文”）。 */
  function merge(json) {
    return Store.getAllArticles().then(function (existing) {
      var byUrl = {};
      existing.forEach(function (a) { byUrl[a.url] = a; });
      var have = {}, haveT = {};
      existing.forEach(function (a) {
        have[a.url] = 1;
        var k = normTitle(a.title);
        if (k) haveT[k] = 1;
      });
      var added = [], backfill = [];
      (json.items || []).forEach(function (it) {
        if (!it || !it.url) return;
        var loc = byUrl[it.url];
        if (loc) {
          // 已存在：本机缺正文而镜像有 → 回填正文/摘要
          if (!loc.body && it.body) {
            loc.body = it.body;
            if (!loc.summary && it.summary) loc.summary = it.summary;
            backfill.push(loc);
          }
          return;
        }
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
          like: 0,
          image: it.image || it.ogImage || it.thumbnail || "",
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
      var toPut = added.concat(backfill);
      if (toPut.length) return Store.bulkPutArticles(toPut).then(function () { return added.length; });
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

  /* 通用并发池：独立条目（标题/摘要等互不依赖）并行执行，并发数 limit；
     fn(item,i)=>Promise，返回 truthy 视为成功；失败不中断、不抛错。返回成功条数。 */
  function mapLimit(items, limit, fn) {
    if (!items || !items.length) return Promise.resolve(0);
    var idx = 0, ok = 0;
    function worker() {
      if (idx >= items.length) return Promise.resolve(ok);
      var i = idx++;
      return Promise.resolve().then(function () { return fn(items[i], i); }).then(function (r) {
        if (r) ok++;
        return worker();
      }).catch(function () { return worker(); });
    }
    var n = Math.max(1, Math.min(limit || 4, items.length));
    var runs = [];
    for (var k = 0; k < n; k++) runs.push(worker());
    return Promise.all(runs).then(function () { return ok; });
  }

  /* 标题翻译（并发；跳过已锁定）。新版同时生成中文摘要 */
  function translateTitles(list, onProgress) {
    if (!list || !list.length) return Promise.resolve(0);
    return Store.getAllTerms().then(function (terms) {
      var glossary = LLM.glossaryLines(terms);
      var done = 0, ok = 0;
      function one(art) {
        if (art.titleZhLocked) return Promise.resolve(false);
        return LLM.translateTitleSummary(art.title, art.summary || art.body, glossary).then(function (out) {
          var p = parseTriple(out);
          if (p.zh) { art.titleZh = p.zh; art.titleTrans = "ok"; }
          if (p.sumZh) art.summaryZh = p.sumZh;
          if (p.sumEn) art.summaryEn = p.sumEn;
          if (!(p.zh || p.sumZh || p.sumEn)) art.titleTrans = "failed";
          return Store.putArticle(art).then(function () { return !!(p.zh || p.sumZh || p.sumEn); });
        }).catch(function () {
          art.titleTrans = "failed";
          return Store.putArticle(art).then(function () { return false; });
        }).then(function (r) {
          if (r) ok++;
          done++;
          if (onProgress) onProgress(done, list.length, art);
          return r;
        });
      }
      return mapLimit(list, 4, one).then(function () {
        return ok;
      });
    });
  }

  /* 标题已译但缺摘要（老数据补摘要用） */
  function pendingSummaries(articles) {
    return (articles || []).filter(function (a) {
      return a.titleZh && !a.titleZhLocked && (!a.summaryZh || !a.summaryEn);
    });
  }

  /* 清洗一段 LLM 输出：去 markdown 加粗/斜体星号、去序号前缀（1. / 第X行）、去“中文标题：”类划分前缀 */
  function cleanSeg(s) {
    s = String(s || "").trim();
    if (!s) return "";
    // markdown 加粗/斜体配对（**x** / *x*）还原为原文，避免残留星号
    s = s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/(^|[^*])\*([^*]+)\*/g, "$1$2");
    s = s.replace(/^\*+|\s*\*+$/g, "").trim();
    s = s.replace(/^(?:(?:第[一二三0-9]+行)|[1-3]\s*[.、)）]|（[1-3]）)\s?[:：、)\s]*/, "").trim();
    s = s.replace(/^(?:中文标题|中文摘要|中文|摘要|标题|英文摘要|英文|English Summary|English[:：]?|Title[:：]?)[:：]?\s*/, "").trim();
    return s;
  }

  /* 标题+中英摘要 结果解析：优先按【T】【Z】【E】前缀取段（v1.7.2 起模型按此前缀输出），
     旧格式退化为按行序（第1行标题 / 第2行中文摘要 / 第3行英文摘要）。
     质量门：纯数字/日期碎片标题、过短摘要一律判为无效，避免“看似生成实则空白 / 只出 2026”。 */
  function parseTriple(out) {
    var s = String(out || "").trim();
    function okTitle(t) {
      t = cleanSeg(t);
      if (!t) return "";
      if (/^\d{1,8}([.,、]\d+)*$/.test(t)) return "";          // 纯数字碎片（如 2026）
      if (/^\d{2,4}\s*[-/年]\s*\d{1,2}/.test(t)) return "";    // 日期碎片（如 2026-09-04）
      return t;
    }
    function okSum(t, min) {
      t = cleanSeg(t);
      if (!t || t.length < min) return "";
      return t;
    }
    var seg = {};
    s.split(/\n/).forEach(function (line) {
      var m = /^\s*【\s*([TZEtze])\s*[】:：]?\s*/.exec(line);
      if (m) seg[m[1].toLowerCase()] = line.slice(m[0].length).trim();
    });
    if (seg.t != null || seg.z != null || seg.e != null) {
      return { zh: okTitle(seg.t || ""), sumZh: okSum(seg.z || "", 10), sumEn: okSum(seg.e || "", 10) };
    }
    var ls = s.split(/\n/).map(cleanSeg).filter(Boolean);
    return { zh: okTitle(ls[0] || ""), sumZh: okSum(ls[1] || "", 10), sumEn: okSum(ls[2] || "", 10) };
  }

  /* 清洗单个中文标题（供标题专用翻译/手动译标题使用） */
  function cleanTitle(s) {
    return cleanSeg(s);
  }

  /* 仅自动翻译标题（不动摘要），用于“打开即自动翻译标题 / 批量译标题”：并发执行，返回真实成功条数 */
  function translateTitlesOnly(list, onProgress) {
    if (!list || !list.length) return Promise.resolve(0);
    return Store.getAllTerms().then(function (terms) {
      var glossary = LLM.glossaryLines(terms);
      var done = 0, ok = 0;
      function one(art) {
        if (art.titleZhLocked) return Promise.resolve(false);
        return LLM.translateTitle(art.title, glossary).then(function (zh) {
          var t = cleanTitle(zh);
          art.titleZh = t || "";
          art.titleTrans = t ? "ok" : "failed";
          return Store.putArticle(art).then(function () { return !!t; });
        }).catch(function () {
          art.titleTrans = "failed";
          return Store.putArticle(art).then(function () { return false; });
        }).then(function (r) {
          if (r) ok++;
          done++;
          if (onProgress) onProgress(done, list.length, art);
          return r;
        });
      }
      return mapLimit(list, 4, one).then(function () {
        return ok;
      });
    });
  }

  /* 摘要生成（中文+英文）：保留已有中文标题不动；成功计 ok；失败/无产出记 summaryFail 且不覆盖已有摘要。并发执行 */
  function summarizeList(list, onProgress) {
    if (!list || !list.length) return Promise.resolve(0);
    return Store.getAllTerms().then(function (terms) {
      var glossary = LLM.glossaryLines(terms);
      var done = 0, ok = 0;
      function one(art) {
        return LLM.translateTitleSummary(art.title, art.summary || art.body, glossary).then(function (out) {
          var p = parseTriple(out);
          if (!art.titleZh && p.zh) { art.titleZh = p.zh; art.titleTrans = "ok"; }
          if (p.sumZh) art.summaryZh = p.sumZh;
          if (p.sumEn) art.summaryEn = p.sumEn;
          var got = !!(p.zh || p.sumZh || p.sumEn);
          art.summaryFail = got ? 0 : 1;
          return Store.putArticle(art).then(function () { return got; });
        }).catch(function () {
          art.summaryFail = 1;
          return Store.putArticle(art).then(function () { return false; });
        }).then(function (r) {
          if (r) ok++;
          done++;
          if (onProgress) onProgress(done, list.length, art);
          return r;
        });
      }
      return mapLimit(list, 4, one).then(function () {
        return ok;
      });
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

  /* 原文段落切分：与阅读页 paras() 规则一致（连续空行分段），确保段落索引一一对应 */
  function splitParas(body) {
    return String(body || "").split(/\n{2,}/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /* 后台全文翻译：提交到调度器即返回任务对象（不阻塞、多任务并行、文内保序）。
     每段译文独立存取 zhParas[i] 段段对应、断点续传；同步产出 zhFull 供纯中文视图。
     进度写回 article.zhDone，取消由任务栏触发(cancelFlag)。 */
  function submitFull(art) {
    if (!LLM.configured()) return Promise.reject(new Error("请先在 设置 → 模型 配置模型"));
    return Store.getAllTerms().then(function (terms) {
      var glossary = LLM.glossaryLines(terms);
      var paras = splitParas(art.body);
      if (!paras.length) return Promise.reject(new Error("该文章正文为空，无需翻译"));
      // 同文章已有全文任务进行中时不再重复提交，避免反复触发
      if (RUNNERS.hasFull(art.url)) return Promise.reject(new Error("该文章已在翻译中"));
      return RUNNERS.submit({
        kind: "full",
        url: art.url,
        label: art.titleZh || art.title || "(未命名文章)",
        total: paras.length,
        done: 0,
        fn: function (task, cancel) {
          return Store.getArticle(art.url).then(function (cur) {
            cur = cur || art;
            // 断点续传：仅当已有逐段数据且段数一致才从上次进度继续；否则从头重译
            var resume = cur.zhState === "running" && cur.zhDone > 0 &&
              Array.isArray(cur.zhParas) && cur.zhParas.length === paras.length;
            var from = resume ? (cur.zhDone || 0) : 0;
            var acc = [];
            for (var k = 0; k < paras.length; k++) acc[k] = (resume && cur.zhParas[k]) || "";
            cur.zhChunks = paras.length;
            var i = from;
            function step() {
              if (i >= paras.length) {
                cur.zhState = "ok"; cur.zhParas = acc;
                cur.zhFull = acc.filter(Boolean).join("\n\n");
                cur.zhDone = paras.length; cur.zhTransFail = undefined;
                RUNNERS.touch(task, paras.length);
                return Store.putArticle(cur);
              }
              if (cancel()) {
                cur.zhState = "failed";
                return Store.putArticle(cur);
              }
              RUNNERS.touch(task, i);
              return LLM.translateChunk(paras[i], glossary).then(function (zh) {
                acc[i] = String(zh || "").trim();
                cur.zhState = "running"; cur.zhParas = acc.slice();
                cur.zhFull = acc.filter(Boolean).join("\n\n");
                cur.zhDone = i + 1;
                return Store.putArticle(cur).then(function () { i++; return step(); });
              }).catch(function (e) {
                cur.zhState = "failed"; cur.zhTransFail = (e && e.message) || "failed";
                return Store.putArticle(cur).then(function () { throw e; });
              });
            }
            return step();
          });
        }
      });
    });
  }

  /* 兼容旧有的“交给我等结果”语义：提交后在 onState 回调里通知（供循环/测试用）。
     业务侧应优先用 submitFull + 任务栏，不要阻塞等结果。 */
  function translateFull(art, opts) {
    opts = opts || {};
    var task = null;
    return submitFull(art).then(function (t) {
      task = t;
      return new Promise(function (resolve) {
        var fn = RUNNERS.onChange(function () {
          var st = task.state;
          if (st === "queued" || st === "running") return;
          RUNNERS._listen = RUNNERS._listen.filter(function (x) { return x !== fn; });
          if (opts.onState) opts.onState(st === "ok" ? "ok" : "failed");
          resolve(st);
        });
      });
    });
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
    submitFull: submitFull,
    cleanTitle: cleanTitle,
    hits: hits,
    /* 后台任务调度器对外接口（任务栏用） */
    tasks: function () { return RUNNERS.list(); },
    taskCount: function () { return RUNNERS.count(); },
    taskCancel: function (id) { RUNNERS.cancel(id); },
    onTasks: function (fn) { return RUNNERS.onChange(fn); },
    hasFull: function (url) { return RUNNERS.hasFull(url); },
    isBusy: function () { return RUNNERS.count() > 0; }
  };
})();
