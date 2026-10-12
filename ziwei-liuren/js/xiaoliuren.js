/* ================================================================
   小六壬（掌诀占）起课 + 断课引擎
   ----------------------------------------------------------------
   起课：寅上起月（正月恒从大安起）→ 月上起日（月落点＝初一）
         → 日上起时（日落点＝子时），一律顺时针、含头计数
   断法：主流为「三宫合断」，不是只看落宫 ——
         天宫＝月宫＝起因／外部机遇；地宫＝日宫＝经过／环境；人宫＝时宫＝结果／自身
   六宫五行依主流（＝六神五行）：
         大安青龙木／留连玄武水／速喜朱雀火／赤口白虎金／小吉六合木／空亡勾陈土
   （注：另有两派异说 —— 留连作土或火、小吉作水；本程序采主流并在此注明）
   ================================================================ */
(function (root) {
  'use strict';
  var LC = root.LunarCore || (typeof require !== 'undefined' ? require('./calendar.js') : null);

  var GONG = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'];
  var ZHI = '子丑寅卯辰巳午未申酉戌亥';
  var GAN = '甲乙丙丁戊己庚辛壬癸';

  /* 六宫属性与断语（主流） */
  var INFO = {
    '大安': {
      wuxing: '木', color: '青', fangwei: '东方', shuzi: '1、5、7',
      tigan: '青龙', luck: '吉', yinyang: '阳',
      zhi: ['子', '午'], zhiNote: '子午',
      gua: '震巽',
      xiang: '身不动时，五行属木，颜色青色，方位东方，临青龙。凡谋事主一、五、七。',
      shi: '事事昌盛，求财在东方，失物不远，宅舍保安康，行人身未动，病者主无妨。',
      yi: ['静守本位、按部就班推进', '在熟悉的地盘、熟悉的人里做文章', '把合同、流程、手续先理清楚'],
      ji: ['急着换赛道、换城市、换人', '贪快求变，反而把稳的局面打乱']
    },
    '留连': {
      wuxing: '水', color: '黑', fangwei: '北方', shuzi: '2、8、10',
      tigan: '玄武', luck: '凶', yinyang: '阴',
      zhi: ['丑', '未'], zhiNote: '丑未',
      gua: '坎',
      xiang: '卒未归时，五行属水，颜色黑色，方位北方，临玄武。凡谋事主二、八、十。',
      shi: '事难成就，求谋日未明，官事只宜缓，去者未回程，失物南方见，急讨方称心。',
      yi: ['先拖着、先观察、先收集信息', '把话说清楚，别让误会继续发酵', '把注意力放回自己手上的事'],
      ji: ['今天就要结果，越急越乱', '反复追问、反复确认，把关系磨掉']
    },
    '速喜': {
      wuxing: '火', color: '赤', fangwei: '南方', shuzi: '3、6、9',
      tigan: '朱雀', luck: '吉', yinyang: '阳',
      zhi: ['寅', '申'], zhiNote: '寅申',
      gua: '离',
      xiang: '人便至时，五行属火，颜色赤色，方位南方，临朱雀。凡谋事主三、六、九。',
      shi: '喜事来临，求财向南行，失物申未午，逢人路上寻，官事有福德，病者无祸侵。',
      yi: ['今天就把消息发出去、电话打出去', '抓住眼前这个稍纵即逝的机会', '把好消息第一时间告诉关键的人'],
      ji: ['再想想、再等等，热度一过就凉了', '话说太满，后面接不住']
    },
    '赤口': {
      wuxing: '金', color: '白', fangwei: '西方', shuzi: '4、7、10',
      tigan: '白虎', luck: '凶', yinyang: '阴',
      zhi: ['卯', '酉'], zhiNote: '卯酉',
      gua: '兑',
      xiang: '官事凶时，五行属金，颜色白色，方位西方，临白虎。凡谋事主四、七、十。',
      shi: '主口舌是非，官讼宜防，失物急去寻，行人有惊慌，病者出西方，更须防咒咀。',
      yi: ['少说多听，重要的话留到明天再说', '涉及钱和责任的事，落到纸面上', '该道歉就先道歉，别争那口气'],
      ji: ['争对错、抢话头，一句话把事闹大', '在气头上做决定、发消息']
    },
    '小吉': {
      wuxing: '木', color: '青', fangwei: '东方', shuzi: '1、5、7',
      tigan: '六合', luck: '吉', yinyang: '阳',
      zhi: ['辰', '戌'], zhiNote: '辰戌',
      gua: '乾',
      xiang: '人来喜时，五行属木，颜色青色，方位东方，临六合。凡谋事主一、五、七。',
      shi: '凡事皆和合，求财向南行，失物在坤方，行人即便至，交关甚是强，凡事皆和合。',
      yi: ['找人合作、找人帮忙，这段时间别人愿意给面子', '谈钱、谈条件、谈分工', '把关系往前推一步'],
      ji: ['一个人硬扛，把能借的力放着不用', '只谈感情不谈条件，后面容易算不清']
    },
    '空亡': {
      wuxing: '土', color: '黄', fangwei: '中央', shuzi: '3、6、9',
      tigan: '勾陈', luck: '大凶', yinyang: '阴',
      zhi: ['巳', '亥'], zhiNote: '巳亥',
      gua: '艮坤',
      xiang: '音信稀时，五行属土，颜色黄色，方位中央，临勾陈。凡谋事主三、六、九。',
      shi: '事不长久，行人有灾殃，失物寻不见，官事有刑伤，病人逢暗鬼，祈解可安康。',
      yi: ['把预期降下来，先保住本金和底线', '该止损就止损，别再加码', '把重要的事往后挪，等风头过去'],
      ji: ['追加投入去救一个已经不对的事', '押上全部身家赌一把']
    }
  };

  /* 三宫的角色 */
  var GONG_ROLE = {
    tian: { key: 'tian', name: '天宫', src: '月宫', mean: '起因', detail: '外部机遇、领导、对方、事情的类型' },
    di:   { key: 'di',   name: '地宫', src: '日宫', mean: '经过', detail: '环境、待遇、事情的性质与过程' },
    ren:  { key: 'ren',  name: '人宫', src: '时宫', mean: '结果', detail: '结果、自身条件与自身状态' }
  };

  var SHENG = { 木:'火', 火:'土', 土:'金', 金:'水', 水:'木' };
  var KE = { 木:'土', 土:'水', 水:'火', 火:'金', 金:'木' };

  /* 三宫具象法：时宫＝初爻、日宫＝二爻、月宫＝三爻（低位在下）
     六宫阴阳（依通行）：大安阳／留连阴／速喜阳／赤口阴／小吉阳／空亡阴
     经典示例验证："留连，留连，小吉，就是阴阴阳，变成震卦"
       → 初爻小吉阳、二爻留连阴、三爻留连阴 = 011 → 巽 ✗
       → 初爻留连阴、二爻留连阴、三爻小吉阳 = 001 → 艮 ✗
     两读皆非震；而"大安，大安，小吉，就是阳阳阳，变成乾卦"两读皆合。
     故知经典示例中「小吉为阳」可确证，爻位方向（时宫在初还是在上）原文未明写。
     本节按「时宫＝初爻」输出，并同时给出倒序读法，两种都给你看。 */
  var YAO_OF = { '大安': 1, '留连': 0, '速喜': 1, '赤口': 0, '小吉': 1, '空亡': 0 };
  var TRIGRAM_NAME = { '111': '乾', '110': '兑', '101': '离', '100': '震',
                       '011': '巽', '010': '坎', '001': '艮', '000': '坤' };
  var TRIGRAM_XIANG = {
    乾: '乾为天 —— 刚健、主动、强势，事情由你主导',
    兑: '兑为泽 —— 喜悦、口舌、沟通、谈判，靠说话推进',
    离: '离为火 —— 明亮、快速、显化，事情容易被看见、传开',
    震: '震为雷 —— 震动、突发、有惊动，来得快也去得快',
    巽: '巽为风 —— 顺入、渐进、随风而动，靠关系和渗透',
    坎: '坎为水 —— 险陷、流动、不确定，要防意外与反复',
    艮: '艮为山 —— 阻隔、止住、停顿，事情卡住不动',
    坤: '坤为地 —— 柔顺、承载、缓慢，靠积累和等待'
  };

  function mod(a, b) { return ((a % b) + b) % b; }

  /* ---------- 起课 ---------- */
  function pan(yue, ri, shi) {
    var m1 = mod(yue - 1, 6);                 /* 月上起日：从大安数到月 */
    var d1 = mod(m1 + (ri - 1), 6);           /* 日上起时：从月宫数到日 */
    var s1 = mod(d1 + (shi - 1), 6);          /* 时上查掌：从日宫数到时辰 */
    return {
      yue: yue, ri: ri, shi: shi,
      monthGong: GONG[m1], dayGong: GONG[d1], gong: GONG[s1],
      idx: m1, dayIdx: d1, finalIdx: s1,
      info: INFO[GONG[s1]]
    };
  }

  /* ---------- 五行关系 ---------- */
  function relation(a, b) {
    if (a === b) return { key: 'same', text: '比和' };
    if (SHENG[a] === b) return { key: 'sheng', text: '生' };
    if (KE[a] === b) return { key: 'ke', text: '克' };
    if (SHENG[b] === a) return { key: 'xie', text: '泄' };
    return { key: 'hao', text: '耗' };
  }
  var REL_MEAN = {
    same:  '同气比和 —— 这一环顺、不费力，但也没有额外助力',
    sheng: '我去生它 —— 这一环要你付出、要投入，是我在贴力气',
    ke:    '我去克它 —— 这一环我能压得住、能主导',
    xie:   '它在泄我 —— 这一环在消耗我，让我变虚',
    hao:   '我在耗于它 —— 我克它但也费力，两处都花本钱'
  };

  /* ---------- 三宫合断 ---------- */
  function analyze(k) {
    var tian = k.monthGong, di = k.dayGong, ren = k.gong;
    var out = {
      tian: { gong: tian, info: INFO[tian], role: GONG_ROLE.tian },
      di:   { gong: di,   info: INFO[di],   role: GONG_ROLE.di },
      ren:  { gong: ren,  info: INFO[ren],  role: GONG_ROLE.ren },
      flows: [], dups: [], trigram: null, notes: []
    };
    var wt = INFO[tian].wuxing, wd = INFO[di].wuxing, wr = INFO[ren].wuxing;
    out.wuXing = { tian: wt, di: wd, ren: wr };

    /* ① 三宫五行流转：天→地→人 */
    var r1 = relation(wt, wd), r2 = relation(wd, wr);
    out.flows.push({ from: '天宫', to: '地宫', a: wt, b: wd, rel: r1,
      text: '天宫（' + wt + '）对地宫（' + wd + '）：' + r1.text + ' —— ' + REL_MEAN[r1.key] });
    out.flows.push({ from: '地宫', to: '人宫', a: wd, b: wr, rel: r2,
      text: '地宫（' + wd + '）对人宫（' + wr + '）：' + r2.text + ' —— ' + REL_MEAN[r2.key] });

    /* ② 以人宫为体：天、地两宫对人宫的生克（断吉凶主干） */
    var gain = 0, loss = 0, why = [];
    [['天宫', wt, relation(wt, wr)], ['地宫', wd, relation(wd, wr)]].forEach(function (x) {
      var kk = x[2].key;
      if (kk === 'sheng') { gain++; why.push(x[0] + '（' + x[1] + '）<b>生</b>人宫 → 有外力来帮，是加分项'); }
      else if (kk === 'same') { gain += 0.5; why.push(x[0] + '（' + x[1] + '）与人宫<b>比和</b> → 同气相助，顺但不加力'); }
      else if (kk === 'ke') { loss++; why.push(x[0] + '（' + x[1] + '）<b>克</b>人宫 → 有压力、有阻力，是减分项'); }
      else if (kk === 'xie') { loss++; why.push(x[0] + '（' + x[1] + '）<b>泄</b>人宫 → 被抽力气、耗神'); }
      else { loss += 0.5; why.push(x[0] + '（' + x[1] + '）<b>耗</b>人宫 → 白费本钱'); }
    });
    out.support = gain - loss;
    out.supportWhy = why;

    /* ③ 同宫重复（原文：与我相同代表朋友、小人、小三；问工作代表同级竞争者） */
    var dup = [];
    if (di === ren) dup.push({ pair: '日宫・时宫', gong: ren,
      text: '日宫与时宫同为「' + ren + '」—— 原文：「只要和我相同代表的意思就是<b>朋友、小人、小三</b>」；' +
            '问工作则是<b>同级别的竞争者</b>。也就是说，这件事的结果里会掺进一个跟你条件差不多的人。' });
    if (tian === ren) dup.push({ pair: '月宫・时宫', gong: ren,
      text: '月宫与时宫同为「' + ren + '」—— 起因与结果同宫，主<b>回到原点</b>：绕一圈还是原来的局面，或者同一件事会再来一次。' });
    if (tian === di && di !== ren) dup.push({ pair: '月宫・日宫', gong: di,
      text: '月宫与日宫同为「' + di + '」—— 起因与经过同宫，主<b>过程跟开头一个样子</b>：走向从一开始就定了型。' });
    if (tian === di && di === ren) dup.push({ pair: '三宫全同', gong: ren,
      text: '三宫全同「' + ren + '」—— 起因、经过、结果一模一样，主<b>事情会原样重复</b>，' +
            '或者你问的这件事不是新事，是旧事重演。' });
    out.dups = dup;

    /* ④ 三宫具象法：时宫＝初爻、日宫＝二爻、月宫＝三爻 */
    var l1 = YAO_OF[ren], l2 = YAO_OF[di], l3 = YAO_OF[tian];
    var code = '' + l1 + l2 + l3;
    var tn = TRIGRAM_NAME[code];
    var codeRev = '' + l3 + l2 + l1;
    var tnRev = TRIGRAM_NAME[codeRev];
    out.trigram = {
      lines: [l1, l2, l3], code: code, name: tn, nameRev: tnRev, codeRev: codeRev,
      from: { 初爻: ren + '（时宫・人宫・结果）', 二爻: di + '（日宫・地宫・经过）', 三爻: tian + '（月宫・天宫・起因）' },
      text: tn + '（' + code + '）：' + (TRIGRAM_XIANG[tn] || ''),
      textRev: tnRev + '（' + codeRev + '）：' + (TRIGRAM_XIANG[tnRev] || '')
    };
    out.notes.push('三宫具象法（把三宫转成一个三画卦）：时宫＝初爻、日宫＝二爻、月宫＝三爻 —— ' +
      '「' + ren + '・' + di + '・' + tian + '」得 <b>' + tn + '卦</b>（' + code + '）。此卦是整件事的总象。');
    out.notes.push('（爻位方向原文未明写，倒过来读则为 <b>' + tnRev + '卦</b>（' + codeRev + '）—— ' +
      '「大安大安小吉＝乾」两读皆合，故两种都列出供参考。）');

    /* ⑤ 应期 */
    out.yingQi = {
      shuzi: INFO[ren].shuzi, zhi: INFO[ren].zhi, zhiNote: INFO[ren].zhiNote,
      text: '人宫「' + ren + '」主数 <b>' + INFO[ren].shuzi + '</b>（用主数断日／月／数）；' +
            '六宫配地支为 <b>' + INFO[ren].zhiNote + '</b>，看与当日／当月地支的冲合定应期' +
            '（例：空亡为巳亥 —— 巳月应、或酉月半合）。' +
            '注意：这里的「六宫配地支」与掌诀定位（大安在寅、留连在巳…）是两套，不可混用。'
    };
    return out;
  }

  function qi(opts) {
    opts = opts || {};
    var lunar = null, shiIdx = null, gzText = '';

    if (opts.lunar && opts.lunar.m) {
      lunar = { y: opts.lunar.y || '', m: opts.lunar.m, d: opts.lunar.d, isLeap: !!opts.lunar.isLeap };
      if (opts.shiZhi != null) shiIdx = opts.shiZhi;
    } else {
      var lng = opts.longitude;
      var useTS = opts.trueSolar && typeof lng === 'number';
      var ty = opts.year, tm = opts.month, td = opts.day, thh = opts.hour, tmm = opts.minute || 0, tst = null;
      if (useTS && LC) {
        tst = LC.trueSolarTime(opts.year, opts.month, opts.day, opts.hour, opts.minute || 0, lng, opts.useEoT !== false);
        ty = tst.y; tm = tst.m; td = tst.d; thh = tst.hour; tmm = tst.minute;
      }
      lunar = LC.solarToLunar(ty, tm, td);
      if (!lunar) throw new Error('日期超出农历数据范围（1900-01-31 ~ 2100-12-31）');
      shiIdx = LC.hourZhiOf(thh);
      /* 年干支按「立春」换年（与紫微／六壬／八字同一口径）；不能直接传公历年 */
      gzText = { yearGZ: LC.gzName(LC.yearGZ(LC.monthLing(ty, tm, td, thh, tmm).ganZhiYear)),
                 dayGZ: LC.gzName(LC.dayGZ(ty, tm, td)),
                 hourGZ: GAN.charAt(LC.hourGZ(LC.dayGZ(ty, tm, td), shiIdx)) + ZHI.charAt(shiIdx) };
      if (tst) gzText.trueSolar = tst;
      /* clock 记「钟表时刻」（未校正），真太阳时另存 trueSolar，界面好做「钟表→真太阳时」对照 */
      gzText.clock = { hh: opts.hour, mm: opts.minute || 0 };
      gzText.clockUsed = { hh: thh, mm: tmm };
    }
    if (shiIdx == null) throw new Error('缺少时辰');

    var k = pan(lunar.m, lunar.d, shiIdx + 1);
    k.lunar = lunar;
    k.shiZhi = ZHI.charAt(shiIdx);
    k.shiIdx = shiIdx;
    k.gz = gzText;
    if (gzText && gzText.trueSolar) k.trueSolar = gzText.trueSolar;
    k.gongList = GONG;
    k.infoAll = INFO;
    k.analysis = analyze(k);
    return k;
  }

  var API = {
    qi: qi, pan: pan, analyze: analyze,
    GONG: GONG, INFO: INFO, GONG_ROLE: GONG_ROLE,
    SHENG: SHENG, KE: KE, relation: relation,
    YAO_OF: YAO_OF, TRIGRAM_NAME: TRIGRAM_NAME, TRIGRAM_XIANG: TRIGRAM_XIANG,
    ZHI: ZHI, GAN: GAN
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.XiaoLiuRen = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
