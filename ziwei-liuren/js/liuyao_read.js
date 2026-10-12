/* ================================================================
   六爻断卦层 —— 依《增删卜易》（野鹤老人）原文规则实现
   ----------------------------------------------------------------
   核心框架：判断用神旺衰只看「四处生克冲合」
     ① 月建  ② 日辰  ③ 卦中动爻  ④ 用神自化出之爻（变爻回头生克）
   原文：「三处相生一处相克也以吉断；两处克两处生者须看旺衰
          （生用神之神旺相则吉，克用神之神旺相则凶）」
   关键约束（原文第 615 行）：
     「夫变出之爻能生克冲合本位之动爻，不能生克他爻，
       而他爻与本位之动爻，亦不能生克变爻」→ 变爻只作用于本位动爻
   ================================================================ */
(function (root) {
  'use strict';
  var LC = root.LunarCore || (typeof require !== 'undefined' ? require('./calendar.js') : null);

  var GAN = '甲乙丙丁戊己庚辛壬癸';
  var ZHI = '子丑寅卯辰巳午未申酉戌亥';
  var ZHI_WX = { 子:'水', 丑:'土', 寅:'木', 卯:'木', 辰:'土', 巳:'火', 午:'火',
                 未:'土', 申:'金', 酉:'金', 戌:'土', 亥:'水' };
  var GAN_WX = { 甲:'木', 乙:'木', 丙:'火', 丁:'火', 戊:'土', 己:'土', 庚:'金', 辛:'金', 壬:'水', 癸:'水' };
  var SHENG = { 木:'火', 火:'土', 土:'金', 金:'水', 水:'木' };   /* 我生 */
  var KE = { 木:'土', 土:'水', 水:'火', 火:'金', 金:'木' };       /* 我克 */
  var YANG_GAN = { 甲:1, 丙:1, 戊:1, 庚:1, 壬:1 };

  /* ---------- ① 四时旺相（原文四時旺相章） ----------
     春：木旺 火相 水休 金囚 土死
     夏：火旺 土相 木休 水囚 金死
     秋：金旺 水相 土休 火囚 木死
     冬：水旺 木相 金休 土囚 火死
     四季月（辰未戌丑）：土旺 金相 火休 木囚 水死 */
  var SEASON = {
    春: { 旺:'木', 相:'火', 休:'水', 囚:'金', 死:'土' },
    夏: { 旺:'火', 相:'土', 休:'木', 囚:'水', 死:'金' },
    秋: { 旺:'金', 相:'水', 休:'土', 囚:'火', 死:'木' },
    冬: { 旺:'水', 相:'木', 休:'金', 囚:'土', 死:'火' },
    四季: { 旺:'土', 相:'金', 休:'火', 囚:'木', 死:'水' }
  };
  /* 月支 → 季节 */
  var MONTH_SEASON = { 寅:'春', 卯:'春', 辰:'四季', 巳:'夏', 午:'夏', 未:'四季',
                       申:'秋', 酉:'秋', 戌:'四季', 亥:'冬', 子:'冬', 丑:'四季' };
  var WANG_SCORE = { 旺: 3, 相: 2, 休: 0, 囚: -2, 死: -3 };

  /* 某五行在某月支下的旺相状态 */
  function wangState(wx, monthZhi) {
    var se = SEASON[MONTH_SEASON[monthZhi]] || SEASON.四季;
    for (var k in se) if (se[k] === wx) return k;
    return '休';
  }

  /* ---------- ② 六亲 / 十神关系 ---------- */
  function qinOf(gongWx, wx) {
    if (wx === gongWx) return '兄弟';
    if (SHENG[gongWx] === wx) return '子孙';
    if (KE[gongWx] === wx) return '妻财';
    if (KE[wx] === gongWx) return '官鬼';
    return '父母';
  }
  /* 用神取法（依问题类型；原文：兄弟爻占兄弟是吉神、占财物是劫神） */
  var YONG_BY_TOPIC = {
    money:  { qin: '妻财', why: '问钱财、回款、买卖，以妻财为用神' },
    career: { qin: '官鬼', why: '问事业、功名、职位，以官鬼为用神' },
    legal:  { qin: '官鬼', why: '问官非、诉讼，以官鬼为用神' },
    health: { qin: '官鬼', why: '问病，以官鬼为病、为用神' },
    love:   { qin: '妻财', why: '问妻财（男占妻、女占夫看官鬼，此处按通用取妻财）' },
    lost:   { qin: '妻财', why: '问失物，以妻财为用神' },
    travel: { qin: '父母', why: '问出行、车船、房屋，以父母为用神' },
    weather:{ qin: '父母', why: '问天气，以父母为雨、为用神' },
    people: { qin: '父母', why: '问求人、文书，以父母为用神' },
    person: { qin: '应爻', why: '问他人消息，以应爻为用神' },
    general:{ qin: '世爻', why: '泛问自身，以世爻为用神' }
  };

  /* ---------- ③ 六冲卦 / 六合卦 ---------- */
  /* 八纯卦 + 天雷无妄 + 雷天大壮 为六冲卦（原文第 395 行） */
  var LIUCHONG_GUA = ['乾为天','兑为泽','离为火','震为雷','巽为风','坎为水','艮为山','坤为地',
                      '天雷无妄','雷天大壮'];
  /* 六合卦：天地否、地天泰、地雷复、雷地豫、水泽节、泽水节（节）、火山旅、山火贲（贲） */
  var LIUHE_GUA = ['天地否','地天泰','地雷复','雷地豫','水泽节','泽水困','火山旅','山火贲',
                   '雷地豫','泽水节'];
  function isLiuChong(name){ return LIUCHONG_GUA.indexOf(name) >= 0; }
  function isLiuHe(name){ return LIUHE_GUA.indexOf(name) >= 0; }

  /* ---------- ④ 进神 / 退神（原文第 1379 行逐字表） ---------- */
  var JIN = { 亥:'子', 寅:'卯', 巳:'午', 申:'酉', 丑:'辰', 辰:'未', 未:'戌' };
  var TUI = { 子:'亥', 卯:'寅', 午:'巳', 酉:'申', 辰:'丑', 未:'辰', 戌:'未' };
  function jinTui(from, to) {
    if (JIN[from] === to) return '进神';
    if (TUI[from] === to) return '退神';
    return '';
  }

  /* ---------- ⑤ 生旺墓绝（原文只用这四位） ----------
     金：巳酉丑寅　木：亥卯未申　土水：申子辰巳   （顺序：长生 帝旺 墓 绝） */
  var MU_JUE = {
    金: { sheng:'巳', wang:'酉', mu:'丑', jue:'寅' },
    木: { sheng:'亥', wang:'卯', mu:'未', jue:'申' },
    水: { sheng:'申', wang:'子', mu:'辰', jue:'巳' },
    土: { sheng:'申', wang:'子', mu:'辰', jue:'巳' },
    火: { sheng:'寅', wang:'午', mu:'戌', jue:'亥' }
  };
  function muJueState(wx, zhi) {
    var m = MU_JUE[wx]; if (!m) return '';
    if (m.sheng === zhi) return '长生';
    if (m.wang === zhi) return '帝旺';
    if (m.mu === zhi) return '入墓';
    if (m.jue === zhi) return '逢绝';
    return '';
  }

  /* ---------- ⑥ 旬空 ---------- */
  function xunKongOf(dayGZIdx) {
    var head = dayGZIdx - (dayGZIdx % 10);
    var hz = head % 12;
    return [ZHI[(hz + 10) % 12], ZHI[(hz + 11) % 12]];
  }

  /* ---------- ⑦ 地支六冲 / 六合 ---------- */
  function chongZhi(z) { return ZHI[(ZHI.indexOf(z) + 6) % 12]; }
  var LIUHE_PAIR = { 子:'丑', 丑:'子', 寅:'亥', 亥:'寅', 卯:'戌', 戌:'卯',
                     辰:'酉', 酉:'辰', 巳:'申', 申:'巳', 午:'未', 未:'午' };
  function heZhi(z) { return LIUHE_PAIR[z] || ''; }

  /* ================================================================
     单爻评分：四处生克冲合
     line  = 本卦某一爻（含 zhi/wx/qin/kong/old/shi/ying）
     ctx   = { monthZhi, dayZhi, monthGZ, dayGZ, dongLines:[{pos,zhi,wx}], }
     返回 { score, notes[] } —— score 正为吉、负为凶
     ================================================================ */
  function scoreLine(line, ctx) {
    var notes = [];
    var sc = 0;
    var wx = line.wx, zhi = line.zhi;

    /* ① 月建：旺相则扶，休囚死则损；月破则重伤 */
    var st = wangState(wx, ctx.monthZhi);
    sc += WANG_SCORE[st];
    notes.push('月建' + ctx.monthZhi + '（' + (MONTH_SEASON[ctx.monthZhi] || '') + '）对' + wx +
      '为「' + st + '」' + (WANG_SCORE[st] > 0 ? '，得令有力' : WANG_SCORE[st] < 0 ? '，失令力弱' : '，平'));

    if (zhi === ctx.monthZhi) { sc += 3; notes.push('此爻临月建（与月建同支），当令极旺'); }
    if (chongZhi(zhi) === ctx.monthZhi) { sc -= 4; notes.push('此爻被月建所冲 → <b>月破</b>，最忌（原文：「月破之爻，逢生不起」）'); }
    else if (heZhi(zhi) === ctx.monthZhi) { sc += 1; notes.push('此爻与月建相合，得月建之力'); }

    /* ② 日辰：原文「日辰四时俱旺」，最灵 */
    if (zhi === ctx.dayZhi) { sc += 3; notes.push('此爻临日辰（与日辰同支）→ <b>日建</b>，力量最实'); }
    else if (chongZhi(zhi) === ctx.dayZhi) {
      /* 原文第 702、899 行：日辰冲静爻 —— 旺相为暗动（＋），休囚为日破（−） */
      if (WANG_SCORE[st] >= 1) { sc += 2; notes.push('日辰冲此爻，而此爻旺相 → <b>暗动</b>：不动而动，事有暗中变化，反得力'); }
      else { sc -= 3; notes.push('日辰冲此爻，而此爻休囚 → <b>日破</b>：愈加无用（原文：「休囚者沖之則破」）'); }
    }
    else if (heZhi(zhi) === ctx.dayZhi) { sc += 2; notes.push('此爻与日辰相合 → <b>合住</b>，事情被牵住、不易散，也主拖延'); }

    var wxFavor = relativeQin(wx, line.baseWx);
    if (wxFavor === '生') { sc += 2; notes.push('日辰' + ctx.dayZhi + '（' + ZHI_WX[ctx.dayZhi] + '）生此爻'); }
    else if (wxFavor === '克') { sc -= 2; notes.push('日辰' + ctx.dayZhi + '（' + ZHI_WX[ctx.dayZhi] + '）克此爻'); }

    /* ③ 卦中动爻：只有动爻能作用于他爻 */
    (ctx.dongLines || []).forEach(function (d) {
      if (d.pos === line.pos) return;
      var dw = d.wx;
      if (SHENG[dw] === wx) { sc += 2; notes.push('第' + d.pos + '爻发动来<b>生</b>此爻（' + dw + '生' + wx + '）'); }
      else if (KE[dw] === wx) { sc -= 2.5; notes.push('第' + d.pos + '爻发动来<b>克</b>此爻（' + dw + '克' + wx + '）'); }
      else if (dw === wx) { sc += 0.5; notes.push('第' + d.pos + '爻发动，与此爻同气相助'); }
      if (d.zhi && chongZhi(d.zhi) === zhi) { sc -= 1.5; notes.push('第' + d.pos + '爻发动<b>冲</b>此爻'); }
      if (d.zhi && heZhi(d.zhi) === zhi) { sc += 1; notes.push('第' + d.pos + '爻发动与此爻相<b>合</b>（合则被牵住）'); }
    });

    /* ④ 用神自化出之爻（只作用于本位动爻）*/
    if (line.old && line.bianZhi) {
      var bw = ZHI_WX[line.bianZhi];
      if (line.bianQin === '回头生' || SHENG[bw] === wx) { sc += 2.5; notes.push('此爻发动化出' + line.bianZhi + '（' + bw + '）→ <b>回头生</b>本位，化吉'); }
      else if (KE[bw] === wx) { sc -= 3; notes.push('此爻发动化出' + line.bianZhi + '（' + bw + '）→ <b>回头克</b>本位，最忌（原文：「化克者凶」）'); }
      var jt = jinTui(zhi, line.bianZhi);
      if (jt === '进神') { sc += 2; notes.push('化<b>进神</b>（' + zhi + '→' + line.bianZhi + '），力量递进，事往前推进'); }
      else if (jt === '退神') { sc -= 2; notes.push('化<b>退神</b>（' + zhi + '→' + line.bianZhi + '），力量后退，事在缩'); }
      var mj = muJueState(wx, line.bianZhi);
      if (mj === '入墓') { sc -= 2; notes.push('化出之爻为此爻之<b>墓</b> → <b>化墓</b>，昏昧受困'); }
      /* 化空：原文「動而化空只主目下不見」（第 2 例）*/
      if (ctx.kong.indexOf(line.bianZhi) >= 0) { sc -= 1; notes.push('化出之爻落<b>旬空</b> → 目下不见，待出空方应'); }
    }

    /* ⑤ 旬空真假（原文第 978 行）*/
    if (ctx.kong.indexOf(zhi) >= 0) {
      var kongKind;
      if (WANG_SCORE[st] >= 2 || line.old) kongKind = '假空';
      else if (WANG_SCORE[st] <= -2) kongKind = '真空';
      else kongKind = '空';
      if (kongKind === '假空') { sc -= 0.5; notes.push('此爻旬空，但<b>旺相/发动</b> → <b>假空</b>：出空即用，暂缓而已'); }
      else if (kongKind === '真空') { sc -= 3; notes.push('此爻旬空，又<b>休囚无气</b> → <b>真空</b>：到底落空，指望不上'); }
      else { sc -= 1.5; notes.push('此爻旬空 → 目下虚而不实，须待<b>出空</b>（填实或冲空之日）'); }
    }
    /* 生旺墓绝（本位）*/
    var mj2 = muJueState(wx, zhi);
    if (mj2 === '入墓') { sc -= 1.5; notes.push('此爻自身临<b>墓</b>地，昏昧受困'); }
    if (mj2 === '长生' || mj2 === '帝旺') { sc += 1; notes.push('此爻临<b>' + mj2 + '</b>，气足'); }
    if (mj2 === '逢绝') { sc -= 1; notes.push('此爻临<b>绝</b>地，气尽'); }

    return { score: Math.round(sc * 10) / 10, notes: notes, wang: st };
  }
  /* 相对关系：a 对 b 是生还是克 */
  function relativeQin(a, b) {
    if (SHENG[a] === b) return '生';
    if (KE[a] === b) return '克';
    return '';
  }

  /* ================================================================
     卦体层级：原文给的硬覆写（直接短路）
     ================================================================ */
  function guaLevel(ben, bian, notes) {
    var flags = { huaKe: false, chongBianHe: false, heBianChong: false, fuYin: false, fanYin: false };
    if (!bian) return { flags: flags, short: null };
    var bn = ben.name, xn = bian.name;
    /* 卦化克：宫五行相克 → 不论用神衰旺，直接凶推（原文第 926 行）*/
    if (KE[ben.gongWx] === bian.gongWx) {
      flags.huaKe = true;
      notes.push('卦体：' + bn + '（' + ben.gongWx + '）变出' + xn + '（' + bian.gongWx + '），' +
        ben.gongWx + '克' + bian.gongWx + ' → <b>卦化克</b>。原文：「卦變克，不論用神之衰旺皆以凶推。」');
      return { flags: flags, short: { verdict: '凶', reason: '卦化克，不看用神衰旺，直接凶断' } };
    }
    /* 六冲卦变六合卦 → 不看用神，竟以吉断（原文第 819 行，与通行规则相反）*/
    if (isLiuChong(bn) && isLiuHe(xn)) {
      flags.chongBianHe = true;
      notes.push('卦体：' + bn + '是六冲卦，变出' + xn + '是六合卦 → <b>冲变合</b>。' +
        '原文：「六沖卦變六合卦，不看用神，竟以吉斷。」（先散后成）');
      return { flags: flags, short: { verdict: '吉', reason: '六冲变六合，先散后成，直接吉断' } };
    }
    /* 六合变六冲：原文第 877 行 —— 惟占官非、盗贼宜之 */
    if (isLiuHe(bn) && isLiuChong(xn)) {
      flags.heBianChong = true;
      notes.push('卦体：' + bn + '是六合卦，变出' + xn + '是六冲卦 → <b>合变冲</b>。' +
        '原文：「六合變六沖」惟占官非、盗贼宜之，余事主先合后散。');
    }
    if (bn === xn) flags.fuYin = true;
    return { flags: flags, short: null };
  }

  /* ================================================================
     主入口：断一卦
     r   = LiuYao.qi(...) 的结果
     ctx = { monthGZ, dayGZ, monthZhi, dayZhi, topic }
     ================================================================ */
  function analyze(r, ctx) {
    ctx = ctx || {};
    var kong = (r.gang && r.gang.kong) || [];
    var monthZhi = ctx.monthZhi, dayZhi = ctx.dayZhi;
    var notes = [];
    var lines = r.lines.map(function (L) {
      return { pos: L.pos, name: L.name, qin: L.qin, zhi: L.zhi, wx: L.wuxing,
               old: !!L.old, shi: !!L.shi, ying: !!L.ying, shen: L.shen,
               bianZhi: L.bianZhi, bianQin: L.bianQin,
               /* 用于比较生克时作为「我方」的基准五行：一律用本卦宫五行 */
               baseWx: r.ben.gongWx };
    });
    var dongLines = lines.filter(function (L) { return L.old; });

    /* ① 取用神 */
    var topic = ctx.topic || 'general';
    var pick = YONG_BY_TOPIC[topic] || YONG_BY_TOPIC.general;
    var yongLines = [];
    if (pick.qin === '世爻') yongLines = lines.filter(function (L) { return L.shi; });
    else if (pick.qin === '应爻') yongLines = lines.filter(function (L) { return L.ying; });
    else yongLines = lines.filter(function (L) { return L.qin === pick.qin; });
    notes.push('取用神：' + pick.why + ' → 本卦中「' + pick.qin + '」共 ' + yongLines.length + ' 爻' +
      (yongLines.length ? '（' + yongLines.map(function (L) { return L.name + L.zhi; }).join('、') + '）' : ''));
    /* 原文第 641 行：卦无用神，即以月建为用神，不必寻伏神 */
    var noYong = yongLines.length === 0;

    /* ② 逐爻评分（候选用神）*/
    var scored = yongLines.map(function (L) {
      var s = scoreLine(L, { monthZhi: monthZhi, dayZhi: dayZhi, dongLines: dongLines, kong: kong });
      return { line: L, score: s.score, notes: s.notes, wang: s.wang };
    });
    /* 原文第 1488 行：用神两现，古法「舍休囚用旺相、舍静用动、舍月破用不破、舍旬空用不空」
       但同章实测有反取者 → 这里并列输出，不硬选 */
    scored.sort(function (a, b) { return b.score - a.score; });
    var yongMain = scored[0] || null;

    /* ③ 卦体层级硬覆写 */
    var gv = guaLevel(r.ben, r.bian, notes);

    /* ④ 汇总吉凶 */
    var verdict, verdictReason;
    if (gv.short) {
      verdict = gv.short.verdict;
      verdictReason = gv.short.reason;
    } else if (noYong) {
      /* 卦无用神 → 以月建为用神，看月建对世爻的生克 */
      var shiL = lines.filter(function (L) { return L.shi; })[0];
      var mwx = ZHI_WX[monthZhi];
      if (shiL && SHENG[mwx] === shiL.wx) { verdict = '吉'; verdictReason = '卦中无用神，以月建为用神 —— 月建生世，可成'; }
      else if (shiL && KE[mwx] === shiL.wx) { verdict = '凶'; verdictReason = '卦中无用神，以月建为用神 —— 月建克世，难成'; }
      else { verdict = '平'; verdictReason = '卦中无用神，以月建为用神 —— 月建与世爻无生克，事在人为'; }
    } else {
      var sc = yongMain.score;
      var shiS = (function () {
        var sl = lines.filter(function (L) { return L.shi; })[0];
        if (!sl) return null;
        return scoreLine(sl, { monthZhi: monthZhi, dayZhi: dayZhi, dongLines: dongLines, kong: kong }).score;
      })();
      var total = sc + (shiS === null ? 0 : shiS * 0.4);
      if (total >= 5) verdict = '吉';
      else if (total >= 1.5) verdict = '偏吉';
      else if (total >= -1.5) verdict = '平';
      else if (total >= -5) verdict = '偏凶';
      else verdict = '凶';
      verdictReason = '用神「' + yongMain.line.qin + yongMain.line.zhi + '」四处生克合计 ' +
        (sc >= 0 ? '+' : '') + sc + ' 分' +
        (shiS === null ? '' : '，世爻 ' + (shiS >= 0 ? '+' : '') + shiS + ' 分（按 0.4 权重并入）');
    }

    /* ⑤ 应期候选（原文各门类应期总注）*/
    var yingQi = [];
    if (yongMain) {
      var L = yongMain.line;
      if (kong.indexOf(L.zhi) >= 0) {
        yingQi.push('用神旬空 → 应<b>出空</b>之日（填实：' + L.zhi + '日；冲空：' + chongZhi(L.zhi) + '日）');
      }
      if (L.old) {
        yingQi.push('用神发动 → 应<b>合</b>（' + heZhi(L.zhi) + '）或<b>值</b>（' + L.zhi + '）之日');
        if (L.bianZhi) yingQi.push('用神化出 ' + L.bianZhi + ' → 应 ' + L.bianZhi + ' 之日（变爻填实）');
      } else {
        yingQi.push('用神安静 → 应<b>值</b>（' + L.zhi + '）或<b>冲</b>（' + chongZhi(L.zhi) + '）之日');
      }
      if (chongZhi(L.zhi) === monthZhi) yingQi.push('用神月破 → 应<b>填实</b>（' + L.zhi + '）或<b>合</b>（' + heZhi(L.zhi) + '）之期');
      var mj = muJueState(L.wx, L.zhi);
      if (mj === '入墓') yingQi.push('用神入墓 → 应<b>冲开墓</b>之日（' + chongZhi(L.zhi) + '）');
    }

    return {
      topic: topic, yong: pick, yongLines: scored, yongMain: yongMain,
      noYong: noYong, guaLevel: gv, verdict: verdict, verdictReason: verdictReason,
      notes: notes, yingQi: yingQi,
      flags: {
        liuChong: isLiuChong(r.ben.name), liuHe: isLiuHe(r.ben.name),
        hasDong: dongLines.length > 0, dongCount: dongLines.length
      }
    };
  }

  var API = {
    analyze: analyze, scoreLine: scoreLine, qinOf: qinOf, wangState: wangState,
    muJueState: muJueState, jinTui: jinTui, xunKongOf: xunKongOf, chongZhi: chongZhi,
    heZhi: heZhi, isLiuChong: isLiuChong, isLiuHe: isLiuHe,
    SEASON: SEASON, MONTH_SEASON: MONTH_SEASON, YONG_BY_TOPIC: YONG_BY_TOPIC,
    ZHI_WX: ZHI_WX, GAN_WX: GAN_WX, SHENG: SHENG, KE: KE
  };
  root.LiuYaoRead = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
