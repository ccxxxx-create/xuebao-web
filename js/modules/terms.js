/* modules/terms.js —— 术语库（概念化：规范译名 + 多英文变体；候选采集 + 同译法自动归并）
   数据模型：term_en 为主键(主形式) + term_zh 规范译名 + en_variants[] 同义英文变体 + scope/note/source/enabled */
(function () {
  "use strict";

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

  /* ── 内置词库第二包（v1.24）：面向手机端「看新闻」场景扩充 ——
     覆盖 太空/海军/空军/导弹核/陆军重装备/网络情报/地缘组织 等高频报道词汇。
     与第一包不同：不分冷启动，老用户升级后自动补装（按英文名幂等合入，不覆盖已有条目）。 */
  var SEED_TERMS_V2 = [
    // —— 太空 / 卫星 ——
    { zh: "军用卫星", en: "military satellite", vs: ["defense satellite", "military satellites"] },
    { zh: "侦察卫星", en: "reconnaissance satellite", vs: ["spy satellite", "imaging satellite", "earth observation satellite", "remote sensing satellite"] },
    { zh: "通信卫星", en: "communications satellite", vs: ["communication satellite", "COMSAT"] },
    { zh: "全球定位系统", en: "GPS", vs: ["Global Positioning System", "GPS satellites", "GNSS", "global navigation satellite system"] },
    { zh: "反卫星武器", en: "anti-satellite weapon", vs: ["ASAT", "anti-satellite missile", "anti-satellite test", "counterspace weapon"] },
    { zh: "轨道", en: "orbit", vs: ["orbital", "low Earth orbit", "LEO", "geostationary orbit", "GEO"] },
    { zh: "太空军", en: "Space Force", vs: ["U.S. Space Force", "USSF", "Space Command", "SPACECOM"] },
    { zh: "发射载具", en: "launch vehicle", vs: ["rocket", "booster", "launch rocket"] },
    // —— 海军 / 舰艇 ——
    { zh: "航空母舰", en: "aircraft carrier", vs: ["carrier", "flattop"] },
    { zh: "核动力航母", en: "nuclear-powered aircraft carrier", vs: ["nuclear carrier", "supercarrier"] },
    { zh: "潜艇", en: "submarine", vs: ["sub", "boats"] },
    { zh: "核潜艇", en: "nuclear submarine", vs: ["nuclear-powered submarine"] },
    { zh: "弹道导弹潜艇", en: "ballistic missile submarine", vs: ["SSBN", "boomer", "strategic missile submarine"] },
    { zh: "攻击潜艇", en: "attack submarine", vs: ["SSN", "attack sub", "nuclear attack submarine"] },
    { zh: "驱逐舰", en: "destroyer", vs: ["guided-missile destroyer", "DDG"] },
    { zh: "护卫舰", en: "frigate", vs: ["guided-missile frigate", "FFG"] },
    { zh: "两栖攻击舰", en: "amphibious assault ship", vs: ["LHA", "LHD", "helicopter carrier", "amphib"] },
    { zh: "船坞登陆舰", en: "amphibious transport dock", vs: ["LPD", "landing platform dock", "dock landing ship", "LSD"] },
    { zh: "宙斯盾", en: "Aegis", vs: ["Aegis combat system", "Aegis-equipped", "Aegis destroyer"] },
    { zh: "声呐", en: "sonar", vs: ["sonar array", "towed array"] },
    { zh: "鱼雷", en: "torpedo", vs: ["heavyweight torpedo", "torpedo attack"] },
    { zh: "水雷战", en: "mine warfare", vs: ["naval mine", "sea mine", "minesweeping", "mine countermeasures"] },
    { zh: "自由航行", en: "freedom of navigation", vs: ["FONOP", "freedom of navigation operation", "innocent passage"] },
    { zh: "海试", en: "sea trial", vs: ["sea trials", "shakedown cruise"] },
    { zh: "服役", en: "commissioning", vs: ["commissioned into service", "enter service"] },
    // —— 空军 / 军机 ——
    { zh: "轰炸机", en: "bomber", vs: ["bombing aircraft"] },
    { zh: "战略轰炸机", en: "strategic bomber", vs: ["heavy bomber", "long-range bomber"] },
    { zh: "战斗机", en: "fighter jet", vs: ["fighter aircraft", "fighter plane", "jet fighter", "fighters"] },
    { zh: "截击机", en: "interceptor", vs: ["interceptor aircraft", "interception aircraft"] },
    { zh: "空中加油", en: "aerial refueling", vs: ["air refueling", "tanker aircraft", "refueling tanker", "mid-air refueling"] },
    { zh: "空运", en: "airlift", vs: ["air transport", "cargo aircraft", "strategic airlift"] },
    { zh: "架次", en: "sortie", vs: ["sorties", "flight sortie"] },
    { zh: "禁飞区", en: "no-fly zone", vs: ["no fly zone", "airspace restriction", "flight restriction zone"] },
    { zh: "制空权", en: "air superiority", vs: ["air dominance", "control of the air"] },
    { zh: "拦截", en: "intercept", vs: ["interception", "shadowed", "escorted away", "buzzed"] },
    { zh: "紧急起飞", en: "scramble", vs: ["scrambled jets", "emergency launch"] },
    { zh: "飞行训练", en: "flight training", vs: ["training flight", "training sortie", "flight operations"] },
    // —— 导弹 / 核力量 ——
    { zh: "洲际弹道导弹", en: "intercontinental ballistic missile", vs: ["ICBM", "intercontinental ballistic missiles"] },
    { zh: "潜射弹道导弹", en: "submarine-launched ballistic missile", vs: ["SLBM", "submarine-launched missile"] },
    { zh: "中程导弹", en: "intermediate-range missile", vs: ["intermediate range missile", "medium-range missile", "MRBM", "short-range ballistic missile", "SRBM"] },
    { zh: "核弹头", en: "nuclear warhead", vs: ["warhead", "nuclear payload"] },
    { zh: "三位一体核力量", en: "nuclear triad", vs: ["triad", "strategic triad"] },
    { zh: "核试验", en: "nuclear test", vs: ["nuclear test site", "underground nuclear test"] },
    { zh: "试射", en: "test launch", vs: ["test firing", "missile test", "test-fire", "live-fire test"] },
    { zh: "反导拦截", en: "missile interception", vs: ["missile intercept", "missile defense interception", "exoatmospheric intercept"] },
    { zh: "萨德", en: "THAAD", vs: ["Terminal High Altitude Area Defense", "Terminal High Altitude Area Defence"] },
    { zh: "爱国者导弹", en: "Patriot missile", vs: ["Patriot", "Patriot battery", "PAC-3", "MIM-104 Patriot"] },
    // —— 陆军 / 重装备 ——
    { zh: "榴弹炮", en: "howitzer", vs: ["self-propelled howitzer", "towed howitzer", "artillery piece"] },
    { zh: "火箭炮", en: "rocket launcher", vs: ["multiple rocket launcher", "MRL", "MLRS", "Multiple Launch Rocket System"] },
    { zh: "高机动火箭炮兵系统", en: "HIMARS", vs: ["High Mobility Artillery Rocket System"] },
    { zh: "主战坦克", en: "main battle tank", vs: ["MBT", "battle tank", "tank"] },
    { zh: "步兵战车", en: "infantry fighting vehicle", vs: ["IFV", "armored fighting vehicle", "AFV"] },
    { zh: "装甲车", en: "armored vehicle", vs: ["armoured vehicle", "armored personnel carrier", "APC"] },
    { zh: "精确制导弹药", en: "precision-guided munition", vs: ["PGM", "smart munition", "guided bomb", "JDAM", "precision munition"] },
    { zh: "火炮", en: "artillery", vs: ["artillery fire", "tube artillery", "field artillery"] },
    { zh: "迫击炮", en: "mortar", vs: ["mortars", "mortar fire"] },
    { zh: "轻武器", en: "small arms", vs: ["firearms", "rifles", "light weapons"] },
    { zh: "定向能武器", en: "directed energy weapon", vs: ["DEW", "laser weapon", "high-power microwave weapon"] },
    // —— 网络 / 情报 / 电子战 ——
    { zh: "网络攻击", en: "cyberattack", vs: ["cyber attack", "cyberattack campaign", "hack", "intrusion"] },
    { zh: "网络安全", en: "cybersecurity", vs: ["cyber security", "cyber defense"] },
    { zh: "网络司令部", en: "Cyber Command", vs: ["U.S. Cyber Command", "USCYBERCOM"] },
    { zh: "信号情报", en: "signals intelligence", vs: ["SIGINT", "signal intelligence", "communications intelligence", "COMINT"] },
    { zh: "人力情报", en: "human intelligence", vs: ["HUMINT"] },
    { zh: "公开来源情报", en: "open-source intelligence", vs: ["OSINT", "open source intelligence"] },
    { zh: "国防情报局", en: "Defense Intelligence Agency", vs: ["DIA"] },
    { zh: "中央情报局", en: "CIA", vs: ["Central Intelligence Agency"] },
    { zh: "电子干扰", en: "jamming", vs: ["electronic jamming", "GPS jamming", "signal jamming", "spoofing", "GPS spoofing"] },
    { zh: "情报界", en: "intelligence community", vs: ["IC", "intel community"] },
    // —— 地缘 / 组织 / 制度 ——
    { zh: "北约", en: "NATO", vs: ["North Atlantic Treaty Organization", "North Atlantic Treaty Organisation", "the alliance"] },
    { zh: "集体防御条款", en: "Article 5", vs: ["Article Five", "collective defense clause", "collective defence"] },
    { zh: "军备控制", en: "arms control", vs: ["weapon control", "arms control treaty"] },
    { zh: "军备竞赛", en: "arms race", vs: ["weapon race"] },
    { zh: "防扩散", en: "non-proliferation", vs: ["nonproliferation", "NPT", "Non-Proliferation Treaty", "counterproliferation"] },
    { zh: "制裁", en: "sanctions", vs: ["economic sanctions", "sanctions regime", "export controls"] },
    { zh: "禁运", en: "embargo", vs: ["arms embargo", "trade embargo"] },
    { zh: "代理人战争", en: "proxy war", vs: ["proxy conflict", "proxy warfare"] },
    { zh: "混合战争", en: "hybrid warfare", vs: ["hybrid war", "hybrid threats"] },
    { zh: "局势升级", en: "escalation", vs: ["escalate", "escalating tensions", "de-escalation", "deescalation"] },
    { zh: "停火", en: "ceasefire", vs: ["cease-fire", "truce", "halt to fighting"] },
    { zh: "维和", en: "peacekeeping", vs: ["peacekeeping operation", "peacekeepers"] },
    { zh: "兵棋推演", en: "wargame", vs: ["war game", "wargaming", "tabletop exercise", "simulation exercise"] },
    { zh: "战备状态", en: "readiness", vs: ["combat readiness", "force readiness", "operational readiness"] },
    { zh: "警戒状态", en: "alert", vs: ["high alert", "alert status", "on alert"] },
    { zh: "动员", en: "mobilization", vs: ["mobilise", "mobilize", "partial mobilization"] },
    { zh: "预备役", en: "reserve", vs: ["reserves", "reserve forces", "Reserve Component"] },
    { zh: "征兵", en: "conscription", vs: ["draft", "military draft", "enlistment"] },
    { zh: "退伍军人", en: "veteran", vs: ["veterans", "former service members"] },
    { zh: "国防部长", en: "defense secretary", vs: ["Secretary of Defense", "SecDef", "defense minister", "Defence Secretary"] },
    { zh: "参谋长联席会议", en: "Joint Chiefs of Staff", vs: ["JCS", "chairman of the Joint Chiefs", "CJCS"] },
    { zh: "军事委员会", en: "Armed Services Committee", vs: ["Senate Armed Services Committee", "SASC", "House Armed Services Committee", "HASC"] },
    { zh: "国防授权法案", en: "National Defense Authorization Act", vs: ["NDAA", "defense authorization bill"] },
    { zh: "国防拨款", en: "defense appropriations", vs: ["defense funding", "military appropriations"] },
    { zh: "国防战略", en: "National Defense Strategy", vs: ["NDS", "defense strategy"] },
    { zh: "核态势评估", en: "Nuclear Posture Review", vs: ["NPR"] },
    { zh: "四防协议", en: "acquisition and cross-servicing agreement", vs: ["ACSA", "logistics support agreement"] },
    // —— 行动 / 事件 ——
    { zh: "实弹演习", en: "live-fire exercise", vs: ["live-fire drill", "live fire drill", "live ammunition exercise"] },
    { zh: "战斗巡逻", en: "combat patrol", vs: ["patrol mission", "routine patrol", "patrol"] },
    { zh: "自由飞越", en: "overflight", vs: ["flyover", "airspace violation", "incursion into airspace", "air incursion"] },
    { zh: "海上对峙", en: "maritime confrontation", vs: ["standoff at sea", "close encounter at sea", "unsafe interaction"] },
    { zh: "伤亡", en: "casualty", vs: ["casualties", "fatalities", "deaths"] },
    { zh: "撤军", en: "withdrawal", vs: ["troop withdrawal", "pullout", "drawdown"] },
    { zh: "增兵", en: "troop surge", vs: ["surge", "reinforcement", "additional troops"] },
    { zh: "轮换部署", en: "rotational deployment", vs: ["rotation", "rotational forces", "deploy rotation"] },
    { zh: "停战协议", en: "armistice", vs: ["peace agreement", "truce agreement"] }
  ];
  var SEED_KEY = "xuebao-term-seeded";          // 第一包：仅库空时冷启动导入
  var SEED_KEY_V2 = "xuebao-term-seeded-v2";    // 第二包：老用户升级后也自动补装（幂等）

  function seedRow(s) {
    var seen = {};
    var vs = (s.vs || []).filter(function (v) {
      var k = (v || "").trim().toLowerCase();
      if (!k || k === s.en.toLowerCase() || seen[k]) return false;
      seen[k] = true;
      return true;
    });
    return { term_en: s.en, term_zh: s.zh, en_variants: vs, scope: "all", source: "内置军语库", enabled: 1 };
  }

  function seedIfEmpty() {
    var seeded = 0;
    try { seeded = parseInt(localStorage.getItem(SEED_KEY), 10) || 0; } catch (e) {}
    var first = Store.getAllTerms().then(function (terms) {
      if (seeded || terms.length) return 0;
      var rows = SEED_TERMS.map(seedRow);
      return Store.bulkPutTerms(rows).then(function () { return rows.length; });
    }).then(function (n) {
      try { localStorage.setItem(SEED_KEY, "1"); } catch (e) {}
      return n;
    });
    // 第二包：无论新旧用户，只要没装过就合入；已存在的同名英文条目不覆盖（尊重用户修改）
    var seededV2 = 0;
    try { seededV2 = parseInt(localStorage.getItem(SEED_KEY_V2), 10) || 0; } catch (e) {}
    var second = seededV2 ? Promise.resolve(0) : Store.getAllTerms().then(function (terms) {
      var have = {};
      (terms || []).forEach(function (t) { if (t && t.term_en) have[String(t.term_en).toLowerCase()] = 1; });
      var rows = SEED_TERMS_V2.filter(function (s) { return s.en && !have[String(s.en).toLowerCase()]; }).map(seedRow);
      if (!rows.length) return 0;
      return Store.bulkPutTerms(rows).then(function () { return rows.length; });
    }).then(function (n) {
      try { localStorage.setItem(SEED_KEY_V2, "1"); } catch (e) {}
      return n;
    });
    return Promise.all([first, second]).then(function (r) { return (r[0] || 0) + (r[1] || 0); });
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

  /* —— Excel 导入/导出（电脑端）：三列 = 英文主形式 / 英文变体 / 中文规范译名 —— */
  function xlsxExport(terms) {
    var rows = [["英文", "英文变体", "中文"]];
    var sorted = terms.slice().sort(function (a, b) { return String(a.term_en || "").localeCompare(String(b.term_en || "")); });
    sorted.forEach(function (t) {
      var vs = (t.en_variants || []).filter(function (v) { return v && v !== t.term_en; });
      rows.push([t.term_en || "", vs.join("\n"), t.term_zh || ""]);
    });
    var blob = DOCX.buildXlsx("术语表", rows);
    H.download("术语表_" + H.ymd() + ".xlsx", blob);
    return sorted.length;
  }
  function xlsxImport(file) {
    return DOCX.readXlsxRows(file).then(function (rows) {
      if (!rows || rows.length < 2) throw new Error("表格为空（需至少 1 行表头 + 1 行数据）");
      // 容错表头：首行若不是表头（不含"英文"），按数据行处理
      var body = rows.slice();
      var head = (rows[0] || []).join("|");
      if (/英文|english|term/i.test(head)) body = rows.slice(1);
      var added = 0, updated = 0, skipped = 0;
      return body.reduce(function (p, row) {
        return p.then(function () {
          var en = String(row[0] || "").trim();
          var variantsRaw = String(row[1] || "").trim();
          var zh = String(row[2] || "").trim();
          if (!en || !zh) { skipped++; return null; }
          var variants = variantsRaw.split(/[\r\n;；,，、]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s && s !== en; });
          return Store.getAllTerms().then(function (terms) {
            var t = terms.find(function (x) { return x.term_en.toLowerCase() === en.toLowerCase(); });
            if (t) {
              t.term_zh = zh;
              var vs = (t.en_variants || []).slice();
              variants.forEach(function (v) { if (vs.indexOf(v) < 0) vs.push(v); });
              t.en_variants = vs;
              updated++;
              return Store.putTerm(t);
            }
            added++;
            return Store.putTerm({ term_en: en, term_zh: zh, en_variants: variants, scope: "all", source: "Excel 导入", enabled: 1 });
          });
        });
      }, Promise.resolve()).then(function () {
        return { added: added, updated: updated, skipped: skipped };
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
      var cands = H.isMobile() ? [] : Store.loadCands().filter(function (c) { return c.state === "pending"; });
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

      // Excel 导入/导出仅电脑端（手机端定位为纯浏览，不做文件管理，v1.24 起也不再做提取确认）
      var xlsxCard = H.isMobile() ? "" :
        '<div class="card"><div class="card-title">导入 / 导出（Excel）</div>' +
        '<p class="muted" style="margin-bottom:10px">三列格式：英文 · 英文变体 · 中文。导出全词库做备份汇总；导入按"英文主形式"合并——已有概念更新译名并并进变体，新概念自动入库。</p>' +
        '<button class="btn" id="tXlsxOut">导出术语表（.xlsx）</button>' +
        '<input type="file" id="tXlsxIn" accept=".xlsx" hidden>' +
        '<button class="btn" id="tXlsxImp" style="margin-left:8px">从 Excel 导入</button>' +
        "</div>";

      var isMob = H.isMobile();
      var subHtml = isMob
        ? "内置军语库 · 共 " + terms.length + " 条 · 译到任一英文写法都按规范译名翻译"
        : "启用 " + on + " / 共 " + terms.length + " 条概念 · 译到任一英文变体都按规范译名；命中词条自动注入翻译提示词";

      el.innerHTML =
        '<div class="view-head"><div><h1 class="view-title">术语库</h1>' +
        '<p class="view-sub">' + subHtml + "</p></div>" +
        '<div class="head-actions">' +
        (isMob ? "" : '<button class="btn ghost" id="tMerge" title="自动把同译法多条并成一条概念">归并去重</button>') +
        '<button class="btn primary" id="tAdd">+ 新增概念</button></div></div>' +
        candHtml +
        xlsxCard +
        '<div class="card">' +
        '<div class="card-title">概念词表</div>' +
        '<div class="filters"><input id="tSearch" class="search" type="search" placeholder="搜索：中文 / 英文 / 变体，如 无人机、drone"></div>' +
        (terms.length
          ? '<div class="tbl-wrap"><table class="data" id="tTbl"><thead><tr><th>规范译名</th><th>英文（主 + 同义变体）</th><th>作用范围</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
          terms.map(function (t) {
            var vs = Store.termVariants(t);
            var chips = vs.map(function (v) { return '<span class="term-chip">' + H.esc(v) + "</span>"; }).join("");
            var hay = H.esc((t.term_zh + " " + t.term_en + " " + (t.en_variants || []).join(" ")).toLowerCase());
            return '<tr data-tsearch="' + hay + '"><td><b>' + H.esc(t.term_zh) + "</b></td><td data-label=\"英文\">" + chips + "</td><td data-label=\"作用范围\">" + H.esc(t.scope || "all") + "</td>" +
              "<td>" + (t.enabled !== 0 ? '<span class="badge state-ok">启用</span>' : '<span class="badge ghost">停用</span>') + "</td>" +
              '<td><button class="btn sm" data-edit="' + H.esc(t.term_en) + '">编辑</button> ' +
              '<button class="btn sm" data-tog="' + H.esc(t.term_en) + '">' + (t.enabled !== 0 ? "停用" : "启用") + "</button> " +
              '<button class="btn sm danger" data-del="' + H.esc(t.term_en) + '">删除</button></td></tr>';
          }).join("") + "</tbody></table></div>"
          : '<div class="empty"><b>术语库为空</b>' + (isMob ? "点右上「+ 新增概念」手动加入；更完整的内置军语库将在电脑端维护。" : "可点右上「+ 新增概念」手动加入，或在阅读文章时一键提取。") + "</div>") +
        "</div>";

      // 搜索：中/英/变体实时过滤（纯前端，不落库）
      var searchEl = el.querySelector("#tSearch");
      if (searchEl) searchEl.addEventListener("input", function () {
        var q = this.value.trim().toLowerCase();
        el.querySelectorAll("#tTbl tbody tr").forEach(function (tr) {
          tr.style.display = !q || (tr.getAttribute("data-tsearch") || "").indexOf(q) >= 0 ? "" : "none";
        });
      });

      el.querySelector("#tAdd").addEventListener("click", function () { editModal(null); });
      var mergeBtn = el.querySelector("#tMerge");
      if (mergeBtn) mergeBtn.addEventListener("click", function () {
        Store.mergeTermsByZh().then(function (n) { App.toast(n > 0 ? "已归并 " + n + " 条重复译法" : "无重复需要归并", "ok"); App.refresh(); });
      });
      var xOut = el.querySelector("#tXlsxOut");
      if (xOut) xOut.addEventListener("click", function () {
        try {
          var n = xlsxExport(terms);
          App.toast("已导出 " + n + " 条术语（.xlsx）", "ok");
        } catch (e) { App.toast("导出失败：" + (e && e.message || e), "err"); }
      });
      var xInBtn = el.querySelector("#tXlsxImp"), xIn = el.querySelector("#tXlsxIn");
      if (xInBtn) xInBtn.addEventListener("click", function () { xIn.click(); });
      if (xIn) xIn.addEventListener("change", function () {
        var file = xIn.files && xIn.files[0];
        xIn.value = "";
        if (!file) return;
        if (!/\.xlsx$/i.test(file.name)) { App.toast("请选择 .xlsx 文件", "err"); return; }
        xlsxImport(file).then(function (r) {
          App.toast("导入完成：新增 " + r.added + " 条 · 更新 " + r.updated + " 条" + (r.skipped ? " · 跳过空行 " + r.skipped : ""), "ok");
          App.refresh();
        }).catch(function (e) {
          App.toast("导入失败：" + (e && e.message || e), "err");
        });
      });
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