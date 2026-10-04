/* ================= 奇门遁甲 时家转盘排盘引擎 =================
   规则依据：《烟波钓叟歌》与通行时家奇门排盘法（拆补定局）
   步骤：
     ① 定时辰四柱 → 取时辰干支、日干支、节气
     ② 定局：取当日之前的「符头」（甲、己日）定上中下元；按节气三元表得局数与阴阳遁
     ③ 排地盘：三奇六仪（戊己庚辛壬癸丁丙乙）依局数入九宫，阳遁顺飞、阴遁逆飞
     ④ 定时辰旬首 → 旬首所遁之仪落宫即「值符星」与「值使门」本宫
     ⑤ 天盘：值符随时干 —— 值符星转到时干地盘宫，其余八星沿八宫环同向转
     ⑥ 八门：值使门从本宫起飞到时辰支所落之宫（数宫次），其余七门沿八宫环同向转
     ⑦ 八神：阳遁顺布、阴遁逆布，值符随时干宫起
   ==================== 对外：QiMen.pan(opts) ==================== */
(function (root) {
  'use strict';
  var LC = root.LunarCore || (typeof require !== 'undefined' ? require('./calendar.js') : null);

  var GAN = '甲乙丙丁戊己庚辛壬癸';
  var ZHI = '子丑寅卯辰巳午未申酉戌亥';

  /* 九宫：1坎 2坤 3震 4巽 5中 6乾 7兑 8艮 9离（洛书数） */
  var GONG_NAME = { 1:'坎', 2:'坤', 3:'震', 4:'巽', 5:'中', 6:'乾', 7:'兑', 8:'艮', 9:'离' };
  var GONG_DIR  = { 1:'北', 2:'西南', 3:'东', 4:'东南', 5:'中', 6:'西北', 7:'西', 8:'东北', 9:'南' };
  var GONG_WX   = { 1:'水', 2:'土', 3:'木', 4:'木', 5:'土', 6:'金', 7:'金', 8:'土', 9:'火' };
  var GONG_BODY = { 1:'泌尿、肾、耳', 2:'脾胃、腹', 3:'肝胆、足', 4:'胆、股、风疾',
                    5:'脾胃、心腹', 6:'头、肺、骨', 7:'口舌、肺、胸', 8:'脾胃、背、手', 9:'心、目、血' };

  /* 八宫环（顺行：坎→艮→震→巽→离→坤→兑→乾）与逆行 */
  var RING = [1, 8, 3, 4, 9, 2, 7, 6];
  var RING_CCW = [1, 6, 7, 2, 9, 4, 3, 8];
  /* 洛书飞布轨迹：一坎 → 二坤 → 三震 → 四巽 → 五中 → 六乾 → 七兑 → 八艮 → 九离 → 复一坎 */
  var FLY = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  function flyFrom(start, n) {          /* 从 start 宫起，按飞布走 n 步（0 起） */
    var i = FLY.indexOf(start);
    return FLY[mod(i + n, 9)];
  }

  /* 九星本宫（天禽寄坤二） */
  var STAR_HOME = { '天蓬':1, '天芮':2, '天冲':3, '天辅':4, '天禽':5, '天心':6, '天柱':7, '天任':8, '天英':9 };
  var STAR_ORDER = ['天蓬','天芮','天冲','天辅','天禽','天心','天柱','天任','天英'];   // 与 RING 对应（禽随芮）
  var STAR_INFO = {
    '天蓬':{ wx:'水', ji:'凶', key:'盗贼、水险、好动、贪', yi:'带兵、开拓、水利；宜守不宜进' },
    '天芮':{ wx:'土', ji:'凶', key:'疾病、迟钝、老师、学生', yi:'求医问药、读书请教；忌谈大事' },
    '天冲':{ wx:'木', ji:'吉', key:'勇猛、冲动、急速、征战', yi:'快速行动、竞技、销售冲刺' },
    '天辅':{ wx:'木', ji:'大吉', key:'文教、辅佐、仁慈、学业', yi:'读书考试、谈判请教、找帮手' },
    '天禽':{ wx:'土', ji:'大吉', key:'中正、包容、居中调停', yi:'主持公道、居中协调；寄坤二宫与天芮同宫' },
    '天心':{ wx:'金', ji:'大吉', key:'谋略、医疗、领导、心计', yi:'策划谋略、求医、见领导' },
    '天柱':{ wx:'金', ji:'凶', key:'口舌、破坏、离异、善辩', yi:'辩论、推销；忌签长期合约' },
    '天任':{ wx:'土', ji:'吉', key:'厚重、任劳、田产、稳固', yi:'置产、长期项目、稳守' },
    '天英':{ wx:'火', ji:'中', key:'文明、血光、急躁、虚火', yi:'文书宣传；忌急躁冒进' }
  };

  /* 八门本宫 */
  var MEN_HOME = { '休门':1, '生门':8, '伤门':3, '杜门':4, '景门':9, '死门':2, '惊门':7, '开门':6 };
  var MEN_ORDER = ['休门','生门','伤门','杜门','景门','死门','惊门','开门'];   // 与 RING 对应
  var MEN_INFO = {
    '休门':{ wx:'水', ji:'吉', key:'休息、调养、婚姻、安逸', yi:'谈婚论嫁、休整调养、见贵人' },
    '生门':{ wx:'土', ji:'大吉', key:'生财、生机、求财、房产', yi:'求财、开业、置产、治病' },
    '伤门':{ wx:'木', ji:'凶', key:'伤害、竞争、讨债、运动', yi:'讨债、竞技、追捕；忌谈合作' },
    '杜门':{ wx:'木', ji:'中', key:'阻塞、隐藏、技术、闭关', yi:'钻研技术、躲避是非、暗中行事' },
    '景门':{ wx:'火', ji:'中', key:'文书、宣传、宴乐、虚华', yi:'宣传推广、考试文书；忌当真实承诺' },
    '死门':{ wx:'土', ji:'大凶', key:'死亡、终结、丧事、绝境', yi:'吊丧、终结旧事；诸事不宜' },
    '惊门':{ wx:'金', ji:'凶', key:'惊恐、口舌、官司、是非', yi:'诉讼、辩论；忌轻信人言' },
    '开门':{ wx:'金', ji:'大吉', key:'开张、通达、官贵、新局', yi:'开业、求职、见官、开创' }
  };

  var SHEN_YANG = ['值符','螣蛇','太阴','六合','白虎','玄武','九地','九天'];
  var SHEN_YIN  = ['值符','九天','九地','玄武','白虎','六合','太阴','螣蛇'];
  var SHEN_INFO = {
    '值符':{ ji:'吉', key:'贵人、领导、主事者' }, '螣蛇':{ ji:'凶', key:'虚惊、怪异、纠缠、心乱' },
    '太阴':{ ji:'吉', key:'暗助、隐私、阴柔、谋划' }, '六合':{ ji:'吉', key:'中介、合作、婚姻、和合' },
    '白虎':{ ji:'凶', key:'凶伤、疾病、道路、刚猛' }, '玄武':{ ji:'凶', key:'盗失、暧昧、欺骗、暗昧' },
    '九地':{ ji:'吉', key:'厚藏、稳固、田土、慢' }, '九天':{ ji:'吉', key:'高远、扬名、动、快' }
  };

  /* 六仪三奇入宫顺序 */
  var YIQI = ['戊','己','庚','辛','壬','癸','丁','丙','乙'];
  /* 旬首（六甲）→ 所遁之仪 */
  var XUN_YI = { '甲子':'戊', '甲戌':'己', '甲申':'庚', '甲午':'辛', '甲辰':'壬', '甲寅':'癸' };
  /* 仪/奇 → 值符星、值使门（同宫取星门） */
  var YI_STAR = { '戊':'天蓬', '己':'天芮', '庚':'天冲', '辛':'天辅', '壬':'天心', '癸':'天柱', '丁':'天英', '丙':'天任', '乙':'天禽' };
  var YI_MEN  = { '戊':'休门', '己':'死门', '庚':'伤门', '辛':'杜门', '壬':'惊门', '癸':'开门', '丁':'景门', '丙':'生门', '乙':'休门' };
  /* 中宫寄坤二：乙（天禽/中宫）寄坤二 */
  var YI_HOME = { '戊':1, '己':2, '庚':3, '辛':4, '壬':6, '癸':7, '丁':9, '丙':8, '乙':5 };
  /* 节气三元局数表：【上元, 中元, 下元】；阳遁=冬至→芒种，阴遁=夏至→大雪 */
  var JU_TABLE = {
    '冬至':[1,7,4],  '小寒':[2,8,5],  '大寒':[3,9,6],  '立春':[8,5,2],
    '雨水':[9,6,3],  '惊蛰':[1,7,4],  '春分':[3,9,6],  '清明':[4,1,7],
    '谷雨':[5,2,8],  '立夏':[4,1,7],  '小满':[5,2,8],  '芒种':[6,3,9],
    '夏至':[9,3,6],  '小暑':[8,2,5],  '大暑':[7,1,4],  '立秋':[2,5,8],
    '处暑':[1,4,7],  '白露':[9,3,6],  '秋分':[7,1,4],  '寒露':[6,9,3],
    '霜降':[5,8,2],  '立冬':[6,9,3],  '小雪':[5,8,2],  '大雪':[4,7,1]
  };
  var YANG_JIEQI = ['冬至','小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种'];

  function mod(n, m) { return ((n % m) + m) % m; }
  /* 由天干、地支求六十甲子序号（0-59） */
  function xunIndexOf(ganCh, zhiCh) {
    var g = GAN.indexOf(ganCh), z = ZHI.indexOf(zhiCh);
    for (var n = 0; n < 60; n++) if (n % 10 === g && n % 12 === z) return n;
    return 0;
  }
  function ringIdx(g) { return RING.indexOf(g); }
  function step(g, n) {                     /* 沿八宫环顺行（CW）走 n 步 */
    var i = ringIdx(g);
    if (i < 0) return g;
    return RING[mod(i + n, 8)];
  }
  function ringDist(from, to) {             /* from → to 顺行步数 */
    var a = ringIdx(from), b = ringIdx(to);
    if (a < 0 || b < 0) return 0;
    return mod(b - a, 8);
  }
  function ringDistCCW(from, to) {           /* from → to 逆行步数 */
    var a = RING_CCW.indexOf(from), b = RING_CCW.indexOf(to);
    if (a < 0 || b < 0) return 0;
    return mod(a - b, 8);
  }

  /* ---------- 定局（拆补法） ---------- */
  /* 节气名：按「当日的具体时刻」取所属节气（交节当天的不同时辰会分属两个节气）
     注：历法数据里的节气时刻本身就是北京时间，直接用当地钟表时刻比较即可 */
  function jieqiOf(y, m, d, hh, mm) {
    var cur = Date.UTC(y, m - 1, d, hh || 12, mm || 0);
    var best = null;
    for (var i = 0; i < 24; i++) {
      var cy = y - 1;
      for (var pass = 0; pass < 3; pass++) {
        var tm = LC.termMs(cy, i);
        if (tm !== null && tm <= cur && (!best || tm > best.tm)) best = { tm: tm, name: LC.TERMS[i] };
        cy++;
      }
    }
    if (!best) return LC.TERMS[0];
    return best.name;
  }
  /* 符头：距当日最近的「往前」甲日或己日（仅作展示） */
  function fuTouOf(dayGZIdx) {
    var g = dayGZIdx % 10;
    var d1 = mod(g, 10);
    if (d1 > 5) d1 = mod(g - 5, 10);
    var fu = mod(dayGZIdx - d1, 60);
    return { idx: fu, days: mod(dayGZIdx - fu, 60), name: LC.gzName(fu) };
  }
  /* 定局：节气定「阳遁/阴遁 + 三元局数表」，日在六十甲子中的位次定「上/中/下元」
     —— 每 5 日一元的连续排法（序 0-4 上元、5-9 中元、10-14 下元，循环） */
  function juOf(dayGZIdx, jieqiName) {
    var trio = JU_TABLE[jieqiName];
    if (!trio) return null;
    var ft = fuTouOf(dayGZIdx);
    var yuan = Math.floor(dayGZIdx / 5) % 3;
    var isYang = YANG_JIEQI.indexOf(jieqiName) >= 0;
    return { ju: trio[yuan], yuan: yuan, yuanName: ['上元','中元','下元'][yuan],
             isYang: isYang, dun: isYang ? '阳遁' : '阴遁',
             fuTou: ft.name, daysFromFuTou: ft.days, jieqi: jieqiName };
  }

  /* ---------- 地盘三奇六仪 ---------- */
  function diPan(ju, isYang) {
    /* 从「局数」所在宫起，按洛书飞布排 戊己庚辛壬癸丁丙乙；阳遁顺飞、阴遁逆飞 */
    var map = {};                       /* 宫 → 干 */
    for (var i = 0; i < 9; i++) {
      var g = isYang ? flyFrom(ju, i) : flyFrom(ju, -i);
      map[g] = YIQI[i];
    }
    var gan2gong = {};                  /* 干 → 宫 */
    for (var k in map) gan2gong[map[k]] = +k;
    return { gan: map, gong: gan2gong };
  }

  /* ---------- 值符值使 ---------- */
  function xunShou(hourGZIdx) {
    var head = hourGZIdx - (hourGZIdx % 10);
    return LC.gzName(head);            /* 甲子 / 甲戌 … */
  }

  /* ---------- 主函数 ---------- */
  function pan(opts) {
    opts = opts || {};
    var lng = opts.longitude, useTS = opts.trueSolar && typeof lng === 'number';
    var ty = opts.year, tm = opts.month, td = opts.day, thh = opts.hour, tmm = opts.minute || 0, tst = null;
    if (useTS) {
      tst = LC.trueSolarTime(opts.year, opts.month, opts.day, opts.hour, opts.minute || 0, lng, opts.useEoT !== false);
      ty = tst.y; tm = tst.m; td = tst.d; thh = tst.hour; tmm = tst.minute;
    }
    var dayGZIdx = LC.dayGZ(ty, tm, td);
    var shiIdx = LC.hourZhiOf(thh);
    /* 注意：LC.hourGZ 返回的是「时干序号 0-9」，时支由时辰决定 */
    var hourGanIdx = LC.hourGZ(dayGZIdx, shiIdx);
    var hourGZText = GAN.charAt(hourGanIdx) + ZHI.charAt(shiIdx);
    var hourGZIdx = xunIndexOf(GAN.charAt(hourGanIdx), ZHI.charAt(shiIdx));
    var yearGZIdx = LC.yearGZ(ty);

    /* 节气：取当日所属节气 */
    var ml = LC.monthLing(ty, tm, td, thh, tmm);       /* 月令（节）*/
    var jq = jieqiOf(ty, tm, td, thh, tmm);
    var ju = juOf(dayGZIdx, jq);
    if (!ju) throw new Error('无法定局（节气：' + jq + '）');

    var di = diPan(ju.ju, ju.isYang);
    var xs = xunShou(hourGZIdx);
    var xunYi = XUN_YI[xs];
    var hourGan = GAN.charAt(hourGZIdx % 10);
    var hourZhi = ZHI.charAt(shiIdx);

    /* 值符星：旬首之仪所在地盘宫的本宫星（中宫寄坤二，故为天禽、值使为死门） */
    var fuGong = di.gong[xunYi];
    var fuGongX = starHomeFor(fuGong);
    var zhiFuStar = (fuGong === 5) ? '天禽' : starAtHome(fuGongX);
    var zhiShiMen = menAtHome(fuGongX);

    /* 值符随时干：时干地盘宫（时干为甲则用旬首之仪宫） */
    var targetGong = (hourGan === '甲') ? fuGong : di.gong[hourGan];
    if (!targetGong) targetGong = fuGong;

    /* 天盘九星：值符随时干；天禽寄坤二（值符为中宫时，天禽代替天芮走在坤二的位置上） */
    var tianStars = {};
    var shift = ringDist(fuGong === 5 ? 2 : fuGong, targetGong === 5 ? 2 : targetGong);
    var startGong = starHomeFor(fuGong);        /* 用本宫在环上的位置 */
    var starSeq = ringStarSequence(startGong);  /* 从该宫起的星序（沿环） */
    if (fuGong === 5) starSeq[0] = '天禽';      /* 中宫值符 → 天禽落在坤二 */
    for (var i = 0; i < 8; i++) {
      var g = step(startGong, i + shift);
      tianStars[g] = starSeq[i];
    }
    /* 中宫：天禽寄坤二 */
    tianStars[5] = '天禽';

    /* 八门：值使门加时支 —— 值使门从本宫转到「时辰地支」所落之宫，其余七门沿八宫【逆行】顺布 */
    var zhiShiStart = menHomeFor(fuGong);
    var targetZhiGong = zhiGongOf(hourZhi);
    var startCCW = RING_CCW.indexOf(zhiShiStart);
    var menShift = ringDistCCW(zhiShiStart, targetZhiGong);
    var doors = {};
    for (var j = 0; j < 8; j++) {
      var seqGong = RING_CCW[mod(startCCW + j, 8)];            /* 本宫起的门序 */
      var putGong = RING_CCW[mod(startCCW + j - menShift, 8)]; /* 实际落宫（逆行移位） */
      doors[putGong] = menAtHome(seqGong);
    }
    doors[5] = '—';                                /* 中宫无门 */

    /* 八神：阳顺阴逆，值符起于时干宫 */
    var shenStart = targetGong === 5 ? 2 : targetGong;
    var shenList = ju.isYang ? SHEN_YANG : SHEN_YIN;
    var shen = {};
    for (var k = 0; k < 8; k++) {
      shen[step(shenStart, ju.isYang ? k : k)] = shenList[k];
    }
    shen[5] = '';

    /* 组装九宫 */
    var gongs = [];
    for (var gi = 1; gi <= 9; gi++) {
      gongs.push({
        gong: gi, name: GONG_NAME[gi], dir: GONG_DIR[gi], wx: GONG_WX[gi], body: GONG_BODY[gi],
        diGan: di.gan[gi] || '', tianGan: '',             /* 天盘干：由天盘星所在原宫的地盘干决定 */
        star: tianStars[gi] || '', men: doors[gi] || '', shen: shen[gi] || '',
        isZhiFu: tianStars[gi] === zhiFuStar, isZhiShi: doors[gi] === zhiShiMen
      });
    }
    /* 天盘干：天盘星随值符转动，其所携之干 = 该星本宫的地盘干 */
    for (var n = 0; n < gongs.length; n++) {
      var g2 = gongs[n];
      if (!g2.star) continue;
      var home = STAR_HOME[g2.star];
      g2.tianGan = di.gan[(g2.star === '天禽') ? 2 : home] || '';
      if (g2.star === '天禽') g2.tianGan = di.gan[2] || '';
    }

    return {
      input: { y:opts.year, m:opts.month, d:opts.day, hh:opts.hour, mm:opts.minute || 0 },
      trueSolar: tst,
      gz: { year: LC.gzName(yearGZIdx), day: LC.gzName(dayGZIdx), hour: hourGZText,
            hourGan: GAN.charAt(hourGanIdx), hourZhi: ZHI.charAt(shiIdx) },
      jieqi: jq, monthLing: ml,
      ju: ju, diPan: di,
      xunShou: xs, xunYi: xunYi,
      zhiFuStar: zhiFuStar, zhiShiMen: zhiShiMen,
      fuGong: fuGong, targetGong: targetGong,
      gongs: gongs,
      meta: { GONG_NAME:GONG_NAME, STAR_INFO:STAR_INFO, MEN_INFO:MEN_INFO, SHEN_INFO:SHEN_INFO }
    };
  }

  /* 八宫环上的星序（从指定宫起）：以本宫星为首，沿环依次取各宫本宫星 */
  function ringStarSequence(startGong) {
    var out = [];
    for (var i = 0; i < 8; i++) {
      var g = step(startGong, i);
      var s = starAtHome(g);
      out.push(s);
    }
    return out;
  }
  function ringMenSequence(startGong) {
    var out = [];
    for (var i = 0; i < 8; i++) {
      var g = step(startGong, i);
      out.push(menAtHome(g));
    }
    return out;
  }
  function starAtHome(g) {
    if (g === 5) return '天禽';
    for (var s in STAR_HOME) if (STAR_HOME[s] === g) return s;
    return '';
  }
  function menAtHome(g) {
    if (g === 5) g = 2;                 /* 中宫寄坤二：值使门取坤二之死门 */
    for (var m in MEN_HOME) if (MEN_HOME[m] === g) return m;
    return '';
  }
  function starHomeFor(g) { return g === 5 ? 2 : g; }
  function menHomeFor(g) { return g === 5 ? 2 : g; }
  /* 时支 → 九宫（子=坎一，丑寅=艮八，卯=震三，辰巳=巽四，午=离九，未申=坤二，酉=兑七，戌亥=乾六） */
  var ZHI_GONG = { '子':1, '丑':8, '寅':8, '卯':3, '辰':4, '巳':4, '午':9, '未':2, '申':2, '酉':7, '戌':6, '亥':6 };
  function zhiGongOf(z) { return ZHI_GONG[z] || 1; }

  var API = { pan: pan, juOf: juOf, diPan: diPan, RING: RING, STAR_HOME: STAR_HOME, MEN_HOME: MEN_HOME,
              JU_TABLE: JU_TABLE, GAN: GAN, ZHI: ZHI, GONG_NAME: GONG_NAME,
              STAR_INFO: STAR_INFO, MEN_INFO: MEN_INFO, SHEN_INFO: SHEN_INFO };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.QiMen = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
