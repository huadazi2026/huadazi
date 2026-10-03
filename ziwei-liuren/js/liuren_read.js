/* ================= 大六壬断课与建议引擎 =================
   规则依据：《六壬大全》九宗门取传与课体断法、《大六壬指南》三传/天将断法，
             盘面数据全部取自 js/liuren.js 的 LiuRen.ke() 返回值（不重复起课、不臆造）
   输入：K = LiuRen.ke(opts) 返回对象；opts.question = 提问（可选）
   输出：judgment / trend / score / confidence / summary / evidence / advice / questionFit
   评分：基准 50 分，按①课体吉凶 ②三传天将 ③末传六亲 ④三传空亡
         ⑤贵人顺逆 ⑥昼夜占 ⑦三传递生递克 加权；全部为确定性加权，
         无随机数、无时间依赖，同一盘面多次调用必得同一分数
   ==================== 对外：LiuRenRead.analyze(K, opts) ==================== */
(function (root) {
  'use strict';

  /* ================= 0. 基础工具 ================= */
  function has(map, key) { return !!map && Object.prototype.hasOwnProperty.call(map, key); }
  function pick(map, key, dflt) { return has(map, key) ? map[key] : dflt; }
  function isArr(a) { return !!a && typeof a.length === 'number' && typeof a !== 'string'; }
  function uniq(list) {
    var out = [], i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && out.indexOf(list[i]) < 0) out.push(list[i]);
    }
    return out;
  }
  function noDot(s) { return String(s === null || s === undefined ? '' : s).replace(/。+$/, ''); }
  var CN_NUM = { 0: '零', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' };
  function cnNum(n) { return has(CN_NUM, n) ? CN_NUM[n] : String(n); }

  /* 五行生克（优先取 LiuRen 的表，缺失时用本地同值表兜底） */
  var SHENG_FALLBACK = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };  /* 我生 */
  var KE_FALLBACK = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };     /* 我克 */
  function shengOf(wx) {
    var t = (root.LiuRen && root.LiuRen.SHENG) || SHENG_FALLBACK;
    return has(t, wx) ? t[wx] : null;
  }
  function keOf(wx) {
    var t = (root.LiuRen && root.LiuRen.KE) || KE_FALLBACK;
    return has(t, wx) ? t[wx] : null;
  }
  function keBy(a, b) { return !!a && !!b && keOf(a) === b; }   /* 五行 a 克 b */

  /* ================= 0.1 文案长度控制 =================
     契约要求 judgment 20-40 字、summary 每条 30-60 字、questionFit 60-120 字。
     下面两个函数按「整句拼接 + 标点处截断」处理，保证字数达标且不断成半句。 */
  function cutAtPunct(text, max, min) {
    if (text.length <= max) return text;
    var i, best = -1, ch;
    for (i = 0; i < text.length && i < max; i++) {
      ch = text.charAt(i);
      if (ch === '。' || ch === '；' || ch === '！' || ch === '？') best = i;
    }
    if (best >= 0 && best + 1 >= (min || 0)) return text.slice(0, best + 1);
    best = -1;
    for (i = 0; i < text.length && i < max; i++) {
      ch = text.charAt(i);
      if (ch === '，' || ch === '、') best = i;
    }
    if (best >= 0) return text.slice(0, best) + '。';
    return text.slice(0, max - 1) + '。';
  }
  function compose(parts, min, max) {
    var out = '', i, p;
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      if (!p) continue;
      if (out === '') { out = cutAtPunct(p, max, min); continue; }
      if (out.length + p.length <= max) { out += p; continue; }
      if (out.length < min) out = cutAtPunct(out + p, max, min);   /* 未达标则拼后截断 */
    }
    return out;
  }

  /* ================= 1. 静态判词表 ================= */

  /* 课体吉凶加权（评分模型第 1 条，原样实现） */
  var BODY_SCORE = {
    '元首课': 8, '重审课': 2, '知一课': -2, '涉害课': -8, '见机课': 4, '察微课': 2,
    '缀瑕课': -4, '蒿矢课': -3, '弹射课': -2, '昴星课': -2, '别责课': -6, '八专课': -5,
    '伏吟课': -12, '返吟课': -10, '井栏射课': -3
  };

  /* 课体短标签：用于 20-40 字的断语开头 */
  var BODY_TAG = {
    '元首课': '元首课一上克下', '重审课': '重审课下贼上', '知一课': '知一课两事相争',
    '涉害课': '涉害课牵连深', '见机课': '见机课宜抢先手', '察微课': '察微课重在细节',
    '缀瑕课': '缀瑕课两难取用', '蒿矢课': '蒿矢课外来力弱', '弹射课': '弹射课力道不足',
    '昴星课': '昴星课悬而未决', '别责课': '别责课四课不全', '八专课': '八专课事由己出',
    '伏吟课': '伏吟课原地打转', '返吟课': '返吟课翻覆反复', '井栏射课': '井栏射课反中求成'
  };

  /* 特殊课体：取用曲折、动象反常 → 影响 confidence、timing 与建议 */
  var SPECIAL_BODY = {
    '伏吟课': 1, '返吟课': 1, '井栏射课': 1, '昴星课': 1, '别责课': 1, '八专课': 1, '缀瑕课': 1
  };

  /* 三传快慢基准（初传主近、末传主远；特殊课体主拖） */
  var SLOW_BODY = {
    '伏吟课': 2, '返吟课': 1, '井栏射课': 1, '昴星课': 1, '别责课': 1, '八专课': 1, '缀瑕课': 1
  };

  /* 天将吉凶（评分模型第 2 条） */
  var JIANG_GOOD = { '贵人': 1, '六合': 1, '青龙': 1, '太常': 1, '太阴': 1, '天后': 1 };
  var JIANG_BAD = { '螣蛇': 1, '勾陈': 1, '天空': 1, '白虎': 1, '玄武': 1 };

  /* 取传法 → 课体清晰度基准（confidence 用） */
  var METHOD_CLARITY = {
    '贼克法': 2, '比用法': 1, '涉害法': 1, '遥克法': 1, '八专法': 1,
    '伏吟法': 0, '返吟法': 0, '昴星法': 0, '别责法': 0
  };

  /* 天将落点动作（兜底用；优先取盘面自带的 tianJiangInfo） */
  var JIANG_ACT_FALLBACK = {
    '贵人': '先找对能拍板的人，走正规渠道，别绕远关系',
    '螣蛇': '先把信息核实清楚再动，别被传言牵着走',
    '朱雀': '重要的事落到纸面，措辞留余地',
    '六合': '找中间人牵线，合作与人情线优先',
    '勾陈': '先把旧账与牵扯理清，别与人争一时长短',
    '青龙': '主动出击求财求名，走正路不走偏门',
    '天空': '先验证对方靠不靠得住，别先投入',
    '白虎': '办事可强硬但别硬碰硬，同时注意身体与出行安全',
    '太常': '请客吃饭走人情，稳中求进，宜守成',
    '玄武': '别信口头承诺，财物与凭据看紧',
    '太阴': '低调运作，找内部或女性长辈帮忙，宜暗不宜明',
    '天后': '从人情与感情入手，多听女性意见，宜柔不宜刚'
  };

  /* 课体说明兜底（优先取 K.bodyInfo，其次 LiuRen.KE_BODY_INFO） */
  var BODY_INFO_FALLBACK = {
    '元首课': { key: '一上克下，事由上临下、尊长或外因主导', advice: '顺规矩走，按对方节奏办，成事在顺势' },
    '重审课': { key: '一下贼上，事由内部或下位发起', advice: '先查内部与细节，谋事宜静守待时' },
    '知一课': { key: '同阴阳相争，两事并起', advice: '先挑一件做，别脚踏两条船' },
    '涉害课': { key: '牵连深、麻烦多，动则有阻', advice: '先做减法，切断无关牵扯再动' },
    '见机课': { key: '同类相争而取孟上，机在先手', advice: '当机立断，不要等' },
    '察微课': { key: '取仲上发用，宜察细微', advice: '先把小处看清再决定' },
    '缀瑕课': { key: '复等取用，事有两难', advice: '别再权衡，按对自己更有利的一条走' },
    '蒿矢课': { key: '神遥克日，外来之克但力弱', advice: '压力来自远处，不必过虑，防着点即可' },
    '弹射课': { key: '日遥克神，我攻彼而力有不及', advice: '先把资源备足再出手' },
    '昴星课': { key: '无克无遥，静中生动、悬而未决', advice: '宜守不宜攻，等一个明确信号' },
    '别责课': { key: '四课不全，事有缺、信息不完整', advice: '缺的那块信息才是关键，找第三方意见再定' },
    '八专课': { key: '干支同位，事由己出、自顾自', advice: '主动在你手上，专心做一件事' },
    '伏吟课': { key: '天地盘重叠，事停滞、原地打转', advice: '不要硬推，宜守旧、宜等待' },
    '返吟课': { key: '天地盘对冲，翻覆反复、来回跑', advice: '别一次定死，留退路，做两手准备' },
    '井栏射课': { key: '返吟无克，动荡中取冲宫发用', advice: '把退路留好，反着补一手反而成' }
  };

  /* 课体对应的禁忌（与 bodyInfo.advice 互补，均为可执行动作） */
  var BODY_DONT = {
    '涉害课': '别同时铺开多条线：涉害主牵连深，线越多越难收',
    '缀瑕课': '别在两件差不多的事上反复权衡：缀瑕主两难，越拖越耗',
    '知一课': '别脚踏两条船：知一主两事相争，同时做两件都会打折',
    '伏吟课': '别硬推：伏吟主原地打转，越推越堵',
    '返吟课': '别一次把条件定死：返吟主反复，要留可撤可改的余地',
    '井栏射课': '别只按直线思路办：井栏射主反覆，正面走不通就反着补一手',
    '昴星课': '别在没有明确信号时抢先出手：昴星主悬而未决，宜等不宜攻',
    '别责课': '别凭一面之词拍板：别责主四课不全，缺的那块信息才是关键',
    '八专课': '别指望别人替你兜底：八专主事由己出，主动权全在你自己手上',
    '蒿矢课': '别把远处传来的压力当成实祸：蒿矢主外来之克但力弱，先辨真伪',
    '弹射课': '别高估自己的力道：弹射主我攻彼而力有不及，先把资源备足',
    '元首课': '别硬顶上位者或流程的节奏：元首主事由上临下，逆着走会白费力气',
    '重审课': '别急着表态：重审主根子在下，先查内部与细节再动',
    '见机课': '别错过先手：见机主机在先手，犹豫就把机会让给别人',
    '察微课': '别只看大方向：察微主答案在细节，小处漏了就前功尽弃'
  };

  /* 末传六亲含义（事的落点） */
  var QIN_MEAN = {
    '妻财': { good: '落点在财与实惠，先把利益分配谈清楚再推进', risk: '注意钱款与账期，别先垫付、别口头定价' },
    '子孙': { good: '落点在成事与解厄，走轻快路线最有效', risk: '别把摊子铺大，集中做一件最容易成的' },
    '官鬼': { good: '有外部规则或上级参与，按流程走反而快', risk: '防被规则、权限或上级卡住，先把资质与手续补齐' },
    '父母': { good: '靠文书、资质、长辈或平台背书成事', risk: '手续与材料最容易卡壳，先备齐再递交' },
    '兄弟': { good: '同辈同业能帮上忙，可以拉人合伙分担', risk: '防同辈分利与同行竞争，先把界限与分成写清' }
  };

  /* 趋势结论短句（20-40 字断语用） */
  var TREND_CONCLUSION = {
    '吉': '事可办成，宜趁势推进',
    '偏吉': '事有七八分可成，需人牵线',
    '平': '成败各半，先定主次再动手',
    '偏凶': '阻力偏大，宜避锋另寻路',
    '凶': '此事多半难成，宜暂缓'
  };

  /* 时间量级（按三传快慢档位）：FULL 用于独立成句，SHORT 用于句中 */
  var SPEED_TEXT = {
    0: '一旬之内（约 10 天）就能见分晓',
    1: '一个月上下（约 20-30 天）会有回音',
    2: '一到三个月才有实质进展',
    3: '三个月以上，可能要跨季',
    4: '半年以上，甚至跨年，别给自己设硬期限'
  };
  var SPEED_SHORT = {
    0: '一旬之内（约 10 天）',
    1: '一个月上下（20-30 天）',
    2: '一到三个月',
    3: '三个月以上（可能跨季）',
    4: '半年以上（可能跨年）'
  };

  /* ================= 2. 盘面取值辅助 ================= */
  function jiangField(K, name, field) {
    var i, list = (K && K.sanChuan) || [];
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].tianJiang === name && list[i].tianJiangInfo) {
        return list[i].tianJiangInfo[field] || '';
      }
    }
    var LR = root.LiuRen;
    if (LR && LR.JIANG_INFO && has(LR.JIANG_INFO, name)) return LR.JIANG_INFO[name][field] || '';
    return (field === 'act' ? pick(JIANG_ACT_FALLBACK, name, '') : '');
  }
  function jiangAct(K, name) {
    var t = jiangField(K, name, 'act');
    return t || pick(JIANG_ACT_FALLBACK, name, '');
  }
  function bodyInfoOf(K, body) {
    if (K && K.bodyInfo && (K.bodyInfo.key || K.bodyInfo.advice)) return K.bodyInfo;
    var LR = root.LiuRen;
    if (LR && LR.KE_BODY_INFO && has(LR.KE_BODY_INFO, body)) return LR.KE_BODY_INFO[body];
    return pick(BODY_INFO_FALLBACK, body, { key: '', advice: '' });
  }
  function nameOf(list, i) { return (isArr(list) && list[i] && list[i].zhi) ? list[i].zhi : '—'; }
  function fmtTerm(t) {
    var v = t.val;
    if (v === 0) return t.label + '不加不减';
    return t.label + (v > 0 ? '加' : '减') + Math.abs(v) + '分';
  }

  /* ================= 3. 主函数 ================= */
  function analyze(K, opts) {
    opts = opts || {};
    var question = (typeof opts.question === 'string') ? opts.question : '';

    var chuan = (K && isArr(K.sanChuan)) ? K.sanChuan : [];
    var siKe = (K && isArr(K.siKe)) ? K.siKe : [];
    var c1 = chuan[0] || null, c2 = chuan[1] || null, c3 = chuan[2] || null;
    var body = (K && K.body) ? K.body : '';
    var method = (K && K.method) ? K.method : '';
    var jiang = (K && K.jiang) ? K.jiang : {};
    var yj = (K && K.yueJiang) ? K.yueJiang : {};
    var dayGZ = (K && K.dayGZ) ? K.dayGZ : '';
    var dayGan = (K && K.dayGan) ? K.dayGan : '';
    var hourZhi = (K && K.hourZhi) ? K.hourZhi : '';
    var xunKong = (K && isArr(K.xunKong)) ? K.xunKong : [];
    var myWx = (K && K.liuQin && K.liuQin.myWx) ? K.liuQin.myWx : '';
    var info = bodyInfoOf(K, body);
    var isDay = jiang.isDay !== false;                /* 卯~申为昼 */
    var forward = jiang.forward === true;             /* 贵人顺治 */
    var guiZhi = jiang.guiZhi || '';
    var guiPosName = jiang.guiPosName || '';
    var moved = jiang.moved === true;

    /* --- 盘面退化保护：三传缺失时仍返回完全符合契约的对象（不抛错、不臆造盘面） --- */
    if (!c1) {
      var hasSiKe = siKe.length > 0;
      var hasCal = !!dayGZ;
      return {
        judgment: '盘面三传缺失，无法按九宗门取用，请先确认起课的年月日时是否填错。',
        trend: '平',
        score: 50,
        confidence: '低',
        summary: [
          '未取得三传，四课不显，本课无法判定吉凶，评分只能维持基准五十分。',
          '缺少三传即无从取发用与落点，趋势、建议与提问回应都只能给方向，不可作决策依据。',
          '请用 LiuRen.ke() 的返回值重新调用 analyze，四课三传齐全后再断，结论才有依托。'
        ],
        evidence: [
          { title: '数据校验', text: '传入对象的 sanChuan 字段为空或不是数组，未能读到初传，故无法取发用。' },
          { title: '四课校验', text: hasSiKe
            ? ('读到四课 ' + siKe.length + ' 条（' + siKe[0].name + '：' + siKe[0].lower + '上见' + siKe[0].upper + '），但仍缺三传。')
            : '传入对象的 siKe 字段同样为空，四课亦未读到。' },
          { title: '历法校验', text: hasCal
            ? ('读到日干支 ' + dayGZ + '、占时 ' + hourZhi + ' 时、月将 ' + (yj.name || '') + '（' + (yj.zhi || '') + '）、本旬空亡 ' + xunKong.join('、') + '，历法部分可用，缺的是取传结果。')
            : '日干支、月将等历法字段也未读到，请检查是否遗漏起课参数。' }
        ],
        advice: {
          dos: [
            '重新起课：确认年、月、日、时的公历值与占时无误后再断',
            '若启用真太阳时，核对经度与均时差设置是否与所在地一致',
            '把 LiuRen.ke(opts) 的完整返回值原样传给 analyze，不要只取部分字段'
          ],
          donts: [
            '不要在盘面不全时凭印象下结论，缺三传就没有发用与落点',
            '不要把本结果当作决策依据，它只是数据校验提示'
          ],
          timing: '时机无法判断：三传缺失，快慢与远近都无从衡量，待盘面齐全后再议。',
          method: '第一步：核对起课参数（年、月、日、时、占时）；第二步：重新调用 LiuRen.ke() 并检查 sanChuan 是否有三项；第三步：把完整的 K 传给 LiuRenRead.analyze(K, opts)。'
        },
        questionFit: '盘面数据不全（缺三传），暂时无法针对该问题给出有依据的判断。请先确认起课的年月日时与占时，重新起课后把完整返回值传入，再来看趋势、时间量级与做法步骤。'
      };
    }

    /* ================= 3.1 评分（基准 50，全部确定性加权） ================= */
    var terms = [{ label: '基准', val: 50 }];
    var score = 50;

    /* ① 课体吉凶 */
    var bodyVal = pick(BODY_SCORE, body, 0);
    score += bodyVal;
    terms.push({ label: '课体' + (body || '未知'), val: bodyVal });

    /* ② 三传天将：吉将 +6 / 凶将 -6 / 朱雀 -3，逐传累计 */
    var i, nm, goodN = 0, badN = 0, zhuQueN = 0, jiangVal = 0;
    var goodNames = [], badNames = [];
    for (i = 0; i < chuan.length; i++) {
      nm = chuan[i] ? (chuan[i].tianJiang || '') : '';
      if (has(JIANG_GOOD, nm)) { goodN++; jiangVal += 6; goodNames.push(nm); }
      else if (has(JIANG_BAD, nm)) { badN++; jiangVal -= 6; badNames.push(nm); }
      else if (nm === '朱雀') { zhuQueN++; jiangVal -= 3; }
    }
    score += jiangVal;
    terms.push({ label: '三传天将', val: jiangVal });
    var goodNamesU = uniq(goodNames), badNamesU = uniq(badNames);   /* 名称去重，计数仍按逐传累计 */

    /* ③ 末传六亲（事的落点） */
    var qin = c3 ? (c3.liuQin || '') : '';
    var qinVal = 0;
    if (qin === '子孙' || qin === '妻财') qinVal = 5;
    else if (qin === '官鬼') qinVal = -6;
    else if (qin === '兄弟') qinVal = -2;
    else if (qin === '父母') qinVal = 2;
    score += qinVal;
    terms.push({ label: '末传六亲为' + (qin || '未知'), val: qinVal });

    /* ④ 三传空亡：初传 -6、中传 -4、末传 -8（末传空主事终无成） */
    var kongNames = [], kongVal = 0;
    if (c1 && c1.isKong) { kongVal -= 6; kongNames.push('初传'); }
    if (c2 && c2.isKong) { kongVal -= 4; kongNames.push('中传'); }
    if (c3 && c3.isKong) { kongVal -= 8; kongNames.push('末传'); }
    score += kongVal;
    if (kongVal !== 0) terms.push({ label: kongNames.join('、') + '空亡', val: kongVal });

    /* ⑤ 贵人方向：顺治 +5 / 逆治 -5 */
    var dirVal = forward ? 5 : -5;
    score += dirVal;
    terms.push({ label: '贵人' + (forward ? '顺治' : '逆治'), val: dirVal });

    /* ⑥ 昼夜占：经验加权——夜占利暗中谋划（+2），不利公开求人办事（-2）。
          关键词命中才加权；昼夜本身无吉凶，两类都不命中则不加不减。 */
    var seeksHelp = /求人|帮忙|托人|办成|审批|批复|求职|应聘|申请|借|请托|协调|通融/.test(question);
    var secretPlan = /暗中|悄悄|私下|秘密|密谋|谋划|布局|试探|摸底|潜伏/.test(question);
    var nightVal = 0, nightNote = '昼夜占';
    if (!isDay && secretPlan) { nightVal = 2; nightNote = '夜占利暗中谋划'; }
    else if (!isDay && seeksHelp) { nightVal = -2; nightNote = '夜占不利公开求人办事'; }
    score += nightVal;
    terms.push({ label: nightNote, val: nightVal });

    /* ⑦ 三传递生 / 递克 */
    var w1 = c1.wx, w2 = c2 ? c2.wx : '', w3 = c3 ? c3.wx : '';
    var chuanSheng = !!(shengOf(w1) && shengOf(w1) === w2 && shengOf(w2) === w3);
    var chuanKeRi = !!(w3 && myWx && keBy(w3, myWx));
    if (chuanSheng) { score += 8; terms.push({ label: '三传递生', val: 8 }); }
    if (chuanKeRi) { score -= 8; terms.push({ label: '末传' + w3 + '克日干' + dayGan + myWx, val: -8 }); }

    /* ⑧ 限幅 5-95，并按档位定 trend */
    score = Math.round(score);
    if (score > 95) score = 95;
    if (score < 5) score = 5;
    var trend = score >= 75 ? '吉' : (score >= 65 ? '偏吉' : (score >= 45 ? '平' : (score >= 35 ? '偏凶' : '凶')));

    /* ================= 3.2 课体清晰度 → confidence ================= */
    var clarity = pick(METHOD_CLARITY, method, 1);
    var clarityWhy = [];
    if (c1.isKong) { clarity -= 1; clarityWhy.push('初传空亡'); }
    if (c3 && c3.isKong) { clarity -= 1; clarityWhy.push('末传空亡'); }
    if (has(SPECIAL_BODY, body)) { clarity -= 1; clarityWhy.push(body + '取用曲折'); }
    var hasKe = false, ki;
    for (ki = 0; ki < siKe.length; ki++) { if (siKe[ki] && siKe[ki].rel) { hasKe = true; break; } }
    if (!hasKe && !has(SPECIAL_BODY, body)) { clarity -= 1; clarityWhy.push(siKe.length ? '四课无贼克' : '四课缺失'); }
    var confidence = clarity >= 2 ? '高' : (clarity === 1 ? '中' : '低');

    /* ================= 3.3 三传快慢 → 时间量级 ================= */
    var slow = pick(SLOW_BODY, body, 0);
    if (c3 && c3.isKong) slow += 1;
    if (c1.isKong) slow += 1;
    if (kongNames.length >= 2) slow += 1;
    if (slow > 4) slow = 4;
    var speedText = pick(SPEED_TEXT, slow, SPEED_TEXT[4]);

    /* ================= 3.4 judgment（20-40 字） ================= */
    var focus;
    if (c3 && c3.isKong) focus = '末传' + c3.zhi + c3.wx + '落空亡';
    else if (has(JIANG_BAD, c1.tianJiang)) focus = '初传' + c1.zhi + c1.wx + '乘' + c1.tianJiang;
    else focus = '初传' + c1.zhi + c1.wx + '乘' + (c1.tianJiang || '—');
    var judgment = compose([
      (pick(BODY_TAG, body, body + '课') ) + '，',
      focus + '，',
      pick(TREND_CONCLUSION, trend, '宜按课体节奏稳着来') + '。'
    ], 20, 40);

    /* ================= 3.5 summary（2-4 条，每条 30-60 字） ================= */
    var kongSentence = kongNames.length
      ? (kongNames.join('、') + '落空亡（' + xunKong.join('、') + '）：空亡主落空与延迟，这一段不能当实底。')
      : ('三传未落空亡（本旬空亡为' + xunKong.join('、') + '），事情有实底可踩。');
    var chainSentence = '';
    if (chuanSheng) chainSentence = '三传' + w1 + '生' + w2 + '生' + w3 + '，传递相生，前一步的成果能推下一步。';
    else if (chuanKeRi) chainSentence = '末传' + w3 + '克日干' + dayGan + myWx + '，后段压力会回冲自身，须留缓冲。';
    else chainSentence = '三传五行依次为' + [w1, w2, w3].join('、') + '，无传递相生，各段要各自落实。';

    var s1 = compose([
      '课体为' + body + '：' + (info.key || pick(BODY_TAG, body, body)) + '。',
      dayGZ + '日' + hourZhi + '时' + (isDay ? '昼' : '夜') + '占，月将' + (yj.name || '') + '（' + (yj.zhi || '') + '），取传用' + method + '。',
      has(SPECIAL_BODY, body) ? '取用曲折，判断留余量。'
        : (method === '贼克法' ? '课体取用直接，主线清楚。'
          : ('发用经层层取舍而来。'))
    ], 30, 60);

    var jiangSummary = '吉将' + cnNum(goodN) + '、凶将' + cnNum(badN) + (zhuQueN ? '、朱雀' + cnNum(zhuQueN) : '');
    var s2 = compose([
      '三传' + nameOf(chuan, 0) + '→' + nameOf(chuan, 1) + '→' + nameOf(chuan, 2) + '：初传' + c1.zhi + c1.wx + '乘' + (c1.tianJiang || '—') + '为' + (c1.liuQin || '') + '。',
      '末传' + c3.zhi + c3.wx + '乘' + (c3.tianJiang || '—') + '为' + (c3.liuQin || '') + '，这是事情的落点。',
      kongSentence,
      chainSentence
    ], 30, 60);

    var s3 = compose([
      (isDay ? '昼占' : '夜占') + '贵人取' + guiZhi + '，落' + guiPosName + '宫' + (forward ? '顺治，人情顺遂、有人肯扶' : '逆治，事多阻隔、须层层找人') + (moved ? '（贵人临辰戌，寄宫移冲）' : '') + '。',
      '三传天将：' + jiangSummary + '。',
      (c1.tianJiang ? jiangAct(K, c1.tianJiang) + '。' : '')
    ], 30, 60);

    var posTerms = [], negTerms = [];
    for (i = 0; i < terms.length; i++) {
      if (terms[i].label === '基准') continue;          /* 基准 50 分不算「加分项」 */
      if (terms[i].val > 0) posTerms.push(terms[i]);
      if (terms[i].val < 0) negTerms.push(terms[i]);
    }
    posTerms.sort(function (a, b) { return b.val - a.val; });
    negTerms.sort(function (a, b) { return a.val - b.val; });
    var mainPlus = posTerms.length ? fmtTerm(posTerms[0]) : '无加分项（课体与天将都不占优）';
    var mainMinus = negTerms.length ? fmtTerm(negTerms[0]) : '无扣分项';
    var s4 = compose([
      '综合' + score + '分（' + trend + '）：' + mainPlus + '，' + mainMinus + '。',
      '关键看初传' + c1.zhi + c1.wx + '与末传' + c3.zhi + c3.wx + '。',
      confidence === '低' ? '课体清晰度低，结论只作方向参考。' : ('课体清晰度' + confidence + '，可作决策主依据。')
    ], 30, 60);

    var summary = uniq([s1, s2, s3, s4]);
    if (summary.length > 4) summary = summary.slice(0, 4);

    /* ================= 3.6 evidence（引用真实盘面字段，3-6 条） ================= */
    var evidence = [];

    evidence.push({
      title: '课体与取传',
      text: '课体为' + body + '（' + (info.key || '见课体说明') + '）；取传法为' + method + '。' +
            '占课为' + dayGZ + '日' + hourZhi + '时，月将' + (yj.name || '') + '（' + (yj.zhi || '') + '），' +
            (isDay ? '卯至申为昼占' : '酉至寅为夜占') + '；日干' + dayGan + '（' + myWx + '），' +
            '本旬空亡为' + xunKong.join('、') + '。' +
            '课体清晰度' + confidence + (clarityWhy.length ? '（' + clarityWhy.join('、') + '，逐项下调）' : '（取传直接、用神不空，未下调）') + '。'
    });

    var cText = [];
    for (i = 0; i < chuan.length; i++) {
      cText.push(chuan[i].name + chuan[i].zhi + chuan[i].wx + '乘' + (chuan[i].tianJiang || '—') +
        '，六亲' + (chuan[i].liuQin || '') + (chuan[i].isKong ? '，落空亡' : '，不空') +
        '，临地盘' + (chuan[i].diPanPos || '') + '宫');
    }
    evidence.push({ title: '三传详情', text: cText.join('；') + '。' });

    var kText = [], zeiN = 0, keN = 0;
    for (i = 0; i < siKe.length; i++) {
      if (siKe[i].rel === '下贼上') zeiN++;
      if (siKe[i].rel === '上克下') keN++;
      kText.push(siKe[i].name + '：' + siKe[i].lower + '上见' + siKe[i].upper + '（' +
        (siKe[i].rel || '无克') + '，乘' + (siKe[i].tianJiang || '—') + '，' + (siKe[i].liuQin || '') +
        (siKe[i].isKong ? '，空亡' : '') + '）');
    }
    evidence.push({
      title: '四课详情',
      text: (kText.length ? (kText.join('；') + '。') : '未读到四课数据，无法核对贼克。') +
            '全课下贼上' + cnNum(zeiN) + '处、上克下' + cnNum(keN) + '处，' +
            (zeiN + keN === 0 ? '四课无贼克，故取传走' + method + '。' : '取传按' + method + '先取贼克。')
    });

    evidence.push({
      title: '贵人与天将',
      text: (isDay ? '昼占' : '夜占') + '取' + (isDay ? '昼贵' : '夜贵') + '，贵人落' + guiZhi +
            '，压' + guiPosName + '宫' + (forward ? '顺治（本位起顺行十二宫）' : '逆治（本位起逆行十二宫）') +
            (moved ? '，且贵人临辰戌，寄宫移冲' : '') + '。三传天将依次为' +
            chuan.map(function (c) { return (c.tianJiang || '—'); }).join('、') +
            '：吉将' + cnNum(goodN) + (goodNamesU.length ? '（' + goodNamesU.join('、') + '）' : '') +
            '、凶将' + cnNum(badN) + (badNamesU.length ? '（' + badNamesU.join('、') + '）' : '') +
            (zhuQueN ? '、朱雀' + cnNum(zhuQueN) : '') + '。'
    });

    evidence.push({
      title: '空亡',
      text: '本旬空亡为' + xunKong.join('、') + '。' + (kongNames.length
        ? (kongNames.join('、') + '落空亡：按断法空亡主落空、延迟、事不落实，末传空则事终无成。')
        : '初、中、末传均未落空亡，事情有实底，可按课体节奏推进。')
    });

    evidence.push({
      title: '五行生克与评分',
      text: '三传五行依次为' + w1 + '、' + w2 + '、' + w3 + '；' +
            (chuanSheng ? '初生中、中生末，三传递生。' : '未见初→中→末依次相生。') +
            (chuanKeRi ? '末传' + w3 + '克日干' + dayGan + myWx + '，末传回冲自身。' : '末传' + w3 + '不克日干' + dayGan + myWx + '。') +
            '加权明细：' + terms.map(fmtTerm).join('，') + '；限幅后合计 ' + score + ' 分（' + trend + '）。'
    });

    /* ================= 3.7 advice ================= */
    var qinDo = pick(QIN_MEAN, qin, { good: '先把目标拆成能立刻验证的一步', risk: '别把资源一次性投进去' });
    var dos = [];
    if (c1.tianJiang) dos.push('初传' + c1.zhi + c1.wx + '乘' + c1.tianJiang + '：' + jiangAct(K, c1.tianJiang));
    if (info.advice) dos.push(body + '走法：' + noDot(info.advice));
    dos.push(forward
      ? ('贵人落' + guiPosName + '宫顺治：直接找能拍板的人，把诉求一次讲清，顺治主有人肯扶')
      : ('贵人落' + guiPosName + '宫逆治：分层递进找人，先从能说上话的中间人入手，别一次托到底'));
    dos.push('末传' + c3.zhi + '为' + (qin || '') + '：' + qinDo.good);
    if (chuanSheng) dos.push('三传递生：按' + w1 + '→' + w2 + '→' + w3 + '的顺序分段推进，拿上一步的结果当下一步的筹码，别跳步');
    dos.push('把目标压成一件本周能验证的小事，拿到确定结果再谈下一步');
    dos.push('关键承诺与金额落到文字（邮件或聊天记录），留痕');
    dos = uniq(dos).slice(0, 5);

    var donts = [];
    if (kongNames.length) {
      donts.push(kongNames.join('、') + '落空亡（' + xunKong.join('、') + '）：空亡主落空与延迟，别把关键节点押在这一环上，先补凭据或换人手');
    }
    if (badNamesU.length) {
      donts.push('三传见' + badNamesU.join('、') + '：别信口头承诺，也别先垫钱、先交货');
    }
    donts.push(pick(BODY_DONT, body, '别逆着课体节奏硬来'));
    donts.push('末传' + c3.zhi + '为' + (qin || '') + '：' + qinDo.risk);
    donts.push('别在回报没确定前做不可逆投入（押金、辞职、独家授权、大额囤货）');
    donts = uniq(donts).slice(0, 4);

    var timingAdvice;
    if (body === '伏吟课') timingAdvice = '但伏吟主停滞，硬推无效：这三段先按兵不动，等对方先动或等下一个节气再议。';
    else if (body === '返吟课' || body === '井栏射课') timingAdvice = '返吟主反复，第一轮谈不拢属正常，把决定留到第二轮，别在第一次就签字。';
    else if (has(JIANG_GOOD, c1.tianJiang)) timingAdvice = '初传' + c1.zhi + c1.wx + '乘' + c1.tianJiang + '为吉将发用，前段就值得先动一步，早做的成本更低。';
    else timingAdvice = '先按' + pick(SPEED_SHORT, slow, SPEED_SHORT[4]) + '安排里程碑，首个节点只做可撤回的小动作。';
    var timing = '时机：' + speedText + '（初传' + c1.zhi + '主近端、末传' + c3.zhi + '主远端）。' + timingAdvice +
      (kongNames.length ? '空亡在' + kongNames.join('、') + '，凡涉及这一环的日期都要留出延迟余量。' : '');

    /* advice.method：分 2-4 步，逐步结合课体、天将与空亡 */
    var steps = [];
    if (body === '涉害课') steps.push('第一步：做减法——把与目标无关的人与事列出来，先切断两三条牵扯，再谈推进');
    else if (body === '缀瑕课') steps.push('第一步：停止权衡——两件差不多的事里按「对自己更有利」直接选一条，另一条搁置');
    else if (body === '知一课') steps.push('第一步：排主次——两件事只留一件先做，另一件明确延后到什么时候');
    else if (body === '伏吟课') steps.push('第一步：按兵不动——把手上已有的资源与凭据盘清，不新增投入');
    else if (body === '返吟课' || body === '井栏射课') steps.push('第一步：备两套方案——按成与不成各写一套动作，把可撤回的选项标出来');
    else if (body === '八专课') steps.push('第一步：收回主导权——这件事自己定调，先只做一条主线，不做甩手掌柜');
    else if (body === '别责课') steps.push('第一步：补信息——找出四课里缺的那块（对方底细、预算、授权人），问到再动');
    else if (body === '昴星课') steps.push('第一步：设信号——给自己定一个明确可观察的触发条件，条件不到不出手');
    else if (body === '蒿矢课') steps.push('第一步：辨真伪——把外部压力逐条核对来源，删掉落不到实处的部分');
    else if (body === '弹射课') steps.push('第一步：备资源——把人力、预算、凭据备到八成以上再出手');
    else if (body === '见机课') steps.push('第一步：抢先手——把最想做的事排到本周内启动，先占位再优化');
    else if (body === '察微课') steps.push('第一步：抠细节——把合同条款、清单、交付标准逐条过一遍，小处不漏');
    else steps.push('第一步：顺势起手——' + body + '可正面推进，先把最小一步做实，拿到反馈再放大');

    if (c1.tianJiang) steps.push('第二步：借' + c1.tianJiang + '之力——' + jiangAct(K, c1.tianJiang) + '（初传' + c1.zhi + c1.wx + '发用）');
    else steps.push('第二步：借力——初传无天将可依，改从熟人与既有渠道入手');

    if (kongNames.length) steps.push('第三步：补空——' + kongNames.join('、') + '落空亡，把这一环换成有凭据、有交付时间的硬承诺，并预留一次延迟');
    else steps.push('第三步：落点——末传' + c3.zhi + '为' + (qin || '') + '，' + qinDo.good + '，以此作为验收标准');
    if (steps.length < 3) steps.push('第四步：复盘——每完成一步就核对一次盘面结论，偏离就立即收缩投入');
    steps = steps.slice(0, 4);
    var method = steps.join('；') + '。';

    /* ================= 3.8 questionFit（60-120 字） ================= */
    var q = question.replace(/^\s+|\s+$/g, '');
    var qKind = 'general';
    if (q) {
      if (/能不能|可否|是否|能否|可以吗|行不行|该不该|值不值得|有没有必要/.test(q)) qKind = 'yesno';
      else if (/何时|多久|什么时候|几天|几月|多长时间|多长|多久能/.test(q)) qKind = 'when';
      else if (/怎么办|如何|怎么|怎样|咋办|方法|步骤|怎样才/.test(q)) qKind = 'how';
    }
    var kongFix = kongNames.length
      ? ('先把' + kongNames.join('、') + '这一环从「口头承诺」换成有时间、有交付物的硬凭据')
      : '把承诺写进有时间节点的文字里，留一次复盘的余地';
    var badFix = badNames.length
      ? ('把' + badNames.join('、') + '所主的风险先堵上（' + jiangAct(K, badNames[0]) + '）')
      : '按课体节奏走，不要加杠杆、不要抢跑';
    var questionFit;
    if (qKind === 'yesno') {
      var tendency = (trend === '吉' || trend === '偏吉') ? '能办成'
        : (trend === '平' ? '五五之数，现在还不能定' : '眼下办不成，别硬办');
      questionFit = compose([
        '就「' + q + '」这一问：' + tendency + '（' + body + '，' + score + '分）。',
        '前提是' + (forward ? '直接找能拍板的人，把诉求一次讲清' : '分层递进找人，先从中间人入手') + '，并且' + kongFix + '。',
        '时间上' + speedText + '，' + (body === '伏吟课' || body === '返吟课' ? '此课主停滞反复，宁可等一轮也不要抢跑。' : '先动最小的一步试水，看对方反馈再加大。')
      ], 60, 120);
    } else if (qKind === 'when') {
      questionFit = compose([
        '就「' + q + '」这一问：时间量级为' + speedText + '。',
        '依据：初传' + c1.zhi + '（' + c1.wx + '）主近端，末传' + c3.zhi + '（' + c3.wx + '）主远端，' +
          (kongNames.length ? kongNames.join('、') + '落空亡，节点会往后漂。' : '三传未空，节点相对可控。'),
        '做法：先定一个' + (slow >= 2 ? '季度' : '月度') + '里程碑，' + (has(JIANG_GOOD, c1.tianJiang) ? '初传乘' + c1.tianJiang + '，前段就可以先动。' : '前段只做可撤回的动作。')
      ], 60, 120);
    } else if (qKind === 'how') {
      questionFit = compose([
        '就「' + q + '」这一问，做法如下：' + method,
        '落点看末传' + c3.zhi + '为' + (qin || '') + '，' + qinDo.good + '。',
        '提醒：' + badFix + '；' + (kongNames.length ? '空亡在' + kongNames.join('、') + '，凡是押在这一环上的计划都要留延迟余量。' : '每推进一步核对一次对方反馈，不对就立刻收缩。')
      ], 60, 120);
    } else {
      questionFit = compose([
        (q ? '就「' + q + '」这一问：' : '通用场景解读：') + '本课为' + body + '，综合' + score + '分，趋势' + trend + '。',
        '三传' + nameOf(chuan, 0) + '→' + nameOf(chuan, 1) + '→' + nameOf(chuan, 2) + '，初传' + c1.zhi + c1.wx + '乘' + (c1.tianJiang || '—') + '定起手，末传' + c3.zhi + c3.wx + '乘' + (c3.tianJiang || '—') + '定落点。',
        (info.advice ? noDot(info.advice) + '。' : '') + (kongNames.length ? '空亡主落空与延迟，节点要留余量。' : '')
      ], 60, 120);
    }

    return {
      judgment: judgment,
      trend: trend,
      score: score,
      confidence: confidence,
      summary: summary,
      evidence: evidence,
      advice: {
        dos: dos,
        donts: donts,
        timing: timing,
        method: method
      },
      questionFit: questionFit
    };
  }

  var API = { analyze: analyze };
  root.LiuRenRead = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = root.LiuRenRead;
})(typeof globalThis !== 'undefined' ? globalThis : this);
