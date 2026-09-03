/* llm.js —— 模型直连（OpenAI 兼容 /chat/completions），厂商预置 + 自定义 */
(function () {
  "use strict";

  /* 预置厂商（base_url 与建议模型；均可改） */
  var PRESETS = [
    { id: "deepseek", label: "DeepSeek 深度求索", baseUrl: "https://api.deepseek.com", model: "deepseek-chat", note: "v4 全系；质量/性价比平衡，1M 上下文" },
    { id: "glm", label: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4.7-flash", note: "免费档 GLM-4.7-Flash；付费 GLM-5.3/5.3-Flash" },
    { id: "doubao", label: "火山方舟 · 豆包", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-seed-1.6-lite", note: "含翻译专用 doubao-seed-translation" },
    { id: "kimi", label: "月之暗面 Kimi", baseUrl: "https://api.moonshot.cn/v1", model: "kimi-k2.5", note: "K2.6/K2.5" },
    { id: "minimax", label: "MiniMax", baseUrl: "https://api.minimaxi.com/v1", model: "MiniMax-M2.7", note: "M3/M2.7" },
    { id: "qwen", label: "阿里百炼 · 通义", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen3.7-flash", note: "qwen3.8-max/3.7-plus/3.7-flash" },
    { id: "hunyuan", label: "腾讯云 · 混元", baseUrl: "https://api.hunyuan.cloud.tencent.com/v1", model: "hunyuan-turbo", note: "OpenAI 兼容端点请以官方为准；含翻译专用模型" },
    { id: "ernie", label: "百度千帆 · 文心", baseUrl: "https://qianfan.baidubce.com/v2", model: "ernie-4.5-turbo-128k", note: "OpenAI 兼容端点请以官方为准" },
    { id: "stepfun", label: "阶跃星辰", baseUrl: "https://api.stepfun.com/v1", model: "step-3.5-flash", note: "step-3.7-flash 等多模态" }
  ];

  var CHANNEL_ZH = {
    defensenews: "美国Defense News",
    airandspaceforces: "美国《Air & Space Forces》杂志",
    govuk_mod: "英国国防部",
    afresearchlab: "美国空军研究实验室",
    westpoint: "美国西点军校",
    rand: "美国兰德公司",
    us_dod: "美国国防部",
    us_marines: "美国海军陆战队",
    us_airforce: "美国空军"
  };

  function presetById(id) { return PRESETS.find(function (p) { return p.id === id; }) || null; }

  /* 由设置决定实际端点 */
  function endpoint(s) {
    if (s.provider === "preset") {
      var p = presetById(s.preset);
      return {
        baseUrl: (s.presetBaseUrl && s.presetBaseUrl.trim()) || (p && p.baseUrl) || "",
        model: (s.presetModel && s.presetModel.trim()) || (p && p.model) || "",
        key: (s.apiKey || "").trim()
      };
    }
    return { baseUrl: (s.baseUrl || "").trim(), model: (s.model || "").trim(), key: (s.apiKey || "").trim() };
  }

  function configured() {
    var s = Store.settings, e = endpoint(s);
    return !!(e.baseUrl && e.model && e.key);
  }

  function chatText(messages, opts) {
    var s = Store.settings, e = endpoint(s);
    if (!e.baseUrl || !e.model || !e.key) {
      var err = new Error("模型未配置：请在「设置 → 模型」填写接口地址、模型与 API Key");
      err.code = "NO_MODEL";
      return Promise.reject(err);
    }
    var url = e.baseUrl.replace(/\/+$/, "") + "/chat/completions";
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, (opts && opts.timeoutMs) || 180000);
    var body = {
      model: e.model,
      messages: messages,
      temperature: 0.2,
      stream: false
    };
    if (opts && opts.maxTokens) body.max_tokens = opts.maxTokens;
    // DeepSeek V4 默认开启思考模式（先输出 reasoning_content 再输出 content）。
    // 翻译/摘要/编译等任务无需多步推理：显式关闭思考，避免 max_tokens 被推理吃光导致 content 为空，且省 token。
    if (!(opts && opts.thinking)) {
      body.thinking = { type: "disabled" };
    }
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + e.key },
      body: JSON.stringify(body),
      signal: ctrl.signal
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          var m = new Error("模型接口返回 " + r.status + "：" + String(t).slice(0, 200));
          m.code = "HTTP_" + r.status;
          throw m;
        });
      }
      return r.json();
    }).then(function (j) {
      clearTimeout(timer);
      var c = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (typeof c !== "string") { var e2 = new Error("模型接口响应异常"); e2.code = "BAD_RES"; throw e2; }
      c = c.trim();
      // 空 content 视为失败（v1.7.5）：模型返回空白时不能静默当成功，否则翻译/摘要“看似运行实则空白”
      if (!c) { var e3 = new Error("模型返回空内容（接口未正确响应，或该 Key 的额度/权限/模型状态异常）"); e3.code = "BAD_RES"; throw e3; }
      return c;
    }).catch(function (err) {
      clearTimeout(timer);
      if (err && err.code) throw err;
      var e3 = new Error("请求失败：" + (err && err.message ? err.message : "网络错误"));
      e3.code = "NET";
      throw e3;
    });
  }

  /* 术语表（enabled=1）注入文案 */
  function glossaryLines(terms) {
    var on = (terms || []).filter(function (t) { return t.enabled !== 0; });
    if (!on.length) return "";
    return on.map(function (t) { return t.term_en + " → " + t.term_zh; }).join("；");
  }

  /* 标题翻译 */
  function translateTitle(title, glossary) {
    var sys = "你是军事新闻标题翻译。把英文标题译为准确、地道的简体中文军事新闻标题。" +
      "术语必须使用词表译法；专有名词与机构缩写首次出现可保留原文或括注。" +
      "只输出一行中文标题，不要任何解释。" +
      (glossary ? "\n词表：" + glossary : "");
    return chatText([{ role: "system", content: sys }, { role: "user", content: title }], { maxTokens: 300, timeoutMs: 90000 });
  }

  /* 摘要生成（中+英可选）：严格三段输出，段首带【T】【Z】【E】前缀便于稳定解析与质量校验 */
  function translateTitleSummary(title, excerpt, glossary) {
    var sys = "你是军事/防务新闻编译助手。根据英文标题与正文节选，严格输出三段，每段必须以前缀开头、段间换行：\n" +
      "【T】中文标题：准确、地道的军事新闻标题（术语按词表译法；专有名词与机构缩写首次出现可保留原文或括注）。\n" +
      "【Z】中文摘要：2~3 句、60~120 字，新闻式陈述。必须写清：国家/机构/主体、核心事件、关键信息（装备型号、数量、时间地点等）；只陈述原文出现的事实，禁止评价、禁止推测、禁止编造任何数据与型号。\n" +
      "【E】English Summary: 2-3 sentences, within 90 words, factual only, restating the same facts as the Chinese summary.\n" +
      "除以上三段外不要输出任何其它内容（不要标题名、不要解释、不要客套）。若节选信息不足，就基于已有事实如实概括，绝不臆造。" +
      (glossary ? "\n术语词表：" + glossary : "");
    var userText = "英文标题：" + title + "\n\n正文节选：\n" + String(excerpt || "").slice(0, 2000);
    return chatText([{ role: "system", content: sys }, { role: "user", content: userText }], { maxTokens: 1200, timeoutMs: 120000 });
  }

  /* 全文翻译（分块调用方负责拆分，本函数翻一段） */
  function translateChunk(text, glossary) {
    var sys = "你是专业的军事/防务新闻英译中翻译。把用户给的英文段落译为准确、通顺、地道的简体中文。" +
      "术语使用词表译法；专有名词与机构缩写首次出现保留原文或括注；不添加原文没有的内容。" +
      "只输出译文。" + (glossary ? "\n词表：" + glossary : "");
    return chatText([{ role: "system", content: sys }, { role: "user", content: text }], { maxTokens: 4096, timeoutMs: 180000 });
  }

  /* 学报编译 */
  function compileJournal(payload, glossary) {
    var sys = "你是军事类学报编译员。依据用户提供的英文原文，编译一条中文「学报条目」，写作要求：\n" +
      "1. 输出两行结构：第一行=中文标题；第二行起=正文。\n" +
      "2. 正文以「据" + payload.sourceZh + "网站" + payload.monthDay + "报道」起句，先一句话交代国家/机构/主体与核心事件，再用①…②…③…分点提炼技术特点、性能数据、部署要点；每点先给结论再给论据。\n" +
      "3. 遵循原文信息组织与军事新闻编译语气，不加入评价、不评论政策；原文没有的内容不要补写，原文缺失处以「[原文缺失]」占位。\n" +
      "4. 术语必须使用词表译法；专有名词与缩写首次出现保留原文或括注。" +
      (payload.sourceInfo ? "\n背景：本条目信息来源：" + payload.sourceInfo + "，发布日期：" + payload.pubDate + "。" : "") +
      (glossary ? "\n词表：" + glossary : "");
    var max = 6000;
    var userText = "英文标题：" + payload.titleEn + "\n\n英文全文：\n" + (payload.body || "").slice(0, 14000);
    return chatText([{ role: "system", content: sys }, { role: "user", content: userText }], { maxTokens: max, timeoutMs: 300000 });
  }

  /* 简易连通性测试 */
  function testConnection() {
    return chatText([
      { role: "system", content: "只回复两个字：正常" },
      { role: "user", content: "连通性测试" }
    ], { maxTokens: 64, timeoutMs: 30000 });
  }

  /* 简报 AI 增强：输入精选条目（每行【N】），输出全期综述 + 逐条点评 */
  function briefCommentary(lines, glossary) {
    var sys = "你是军事/防务情报编辑，为一条周末简报写内容。输入是本轮精选文章，每行以【N】开头（编号|中文标题|英文标题|信源|日期|一句话摘要）。\n" +
      "请输出两部分：\n" +
      "第一段：全期综述，2~3 句话概括本周防务/军事重点与趋势，不编号、不评价好坏。\n" +
      "然后逐条点评：每条一行，格式严格为「【N】一句点评」，点评要具体、有信息量，结合该条内容，不说空话。\n" +
      "除上述内容外不要输出任何其它说明。" + (glossary ? "\n术语词表：" + glossary : "");
    return chatText([{ role: "system", content: sys }, { role: "user", content: lines.join("\n") }], { maxTokens: 2048, timeoutMs: 120000 });
  }

  window.LLM = {
    PRESETS: PRESETS,
    CHANNEL_ZH: CHANNEL_ZH,
    presetById: presetById,
    endpoint: endpoint,
    configured: configured,
    chatText: chatText,
    glossaryLines: glossaryLines,
    translateTitle: translateTitle,
    translateTitleSummary: translateTitleSummary,
    translateChunk: translateChunk,
    compileJournal: compileJournal,
    testConnection: testConnection,
    briefCommentary: briefCommentary
  };
})();
