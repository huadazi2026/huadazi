/* ================================================================
   八字（四柱）排盘引擎
   排法依倪海厦《天纪》讲义「肆、易经推命与铁版神数」：
     · 年柱：以立春换年（立春前用上一年干支）——与斗数用正月初一不同
     · 月柱：以十二「节」换月（立春→寅、惊蛰→卯 …… 小寒→丑），不取「中气」
     · 日柱：不随节气；以子时（子正=半夜12点）分日
     · 时柱：五鼠遁日（甲己还加甲、乙庚丙作初、丙辛从戊土、丁壬庚子居、戊癸壬子）
       早子时用本日日干求时干；晚子时用次日日干求时干，但日干支仍以本日为主
   另含：藏干、十神、十二长生、纳音、旬空、大运、流年、常用神煞
   ================================================================ */
(function (root) {
  'use strict';

  var LC = root.LunarCore || (typeof require !== 'undefined' ? require('./calendar.js') : null);
  var GAN = '甲乙丙丁戊己庚辛壬癸';
  var ZHI = '子丑寅卯辰巳午未申酉戌亥';
  var SX = '鼠牛虎兔龙蛇马羊猴鸡狗猪';
  var WX_GAN = { 甲:'木', 乙:'木', 丙:'火', 丁:'火', 戊:'土', 己:'土', 庚:'金', 辛:'金', 壬:'水', 癸:'水' };
  var WX_ZHI = { 子:'水', 丑:'土', 寅:'木', 卯:'木', 辰:'土', 巳:'火', 午:'火', 未:'土', 申:'金', 酉:'金', 戌:'土', 亥:'水' };
  /* 阴阳：甲丙戊庚壬为阳 */
  var YANG_GAN = { 甲:1, 丙:1, 戊:1, 庚:1, 壬:1 };
  /* 五行相生：木→火→土→金→水→木 */
  var SHENG = { 木:'火', 火:'土', 土:'金', 金:'水', 水:'木' };
  var KE = { 木:'土', 土:'水', 水:'火', 火:'金', 金:'木' };

  /* 地支藏干（本气、中气、余气） */
  var CANG = {
    子: ['癸'], 丑: ['己','癸','辛'], 寅: ['甲','丙','戊'], 卯: ['乙'],
    辰: ['戊','乙','癸'], 巳: ['丙','庚','戊'], 午: ['丁','己'],
    未: ['己','丁','乙'], 申: ['庚','壬','戊'], 酉: ['辛'],
    戌: ['戊','辛','丁'], 亥: ['壬','甲']
  };
  /* 十神 */
  var SHISHEN = ['比肩','劫财','食神','伤官','偏财','正财','七杀','正官','偏印','正印'];
  function shiShen(dayGan, otherGan) {
    var de = WX_GAN[dayGan], oe = WX_GAN[otherGan];
    var same = (YANG_GAN[dayGan] ? 1 : 0) === (YANG_GAN[otherGan] ? 1 : 0);
    if (oe === de) return same ? '比肩' : '劫财';
    if (SHENG[de] === oe) return same ? '食神' : '伤官';
    if (KE[de] === oe) return same ? '偏财' : '正财';
    if (KE[oe] === de) return same ? '七杀' : '正官';
    if (SHENG[oe] === de) return same ? '偏印' : '正印';
    return '?';
  }
  /* 十二长生 */
  var CS_NAME = ['长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'];
  /* 各天干长生所在地支 */
  var CS_START = { 甲:'亥', 丙:'寅', 戊:'寅', 庚:'巳', 壬:'申', 乙:'午', 丁:'酉', 己:'酉', 辛:'子', 癸:'卯' };
  function changSheng(gan, zhi) {
    var start = ZHI.indexOf(CS_START[gan]);
    var cur = ZHI.indexOf(zhi);
    var yang = !!YANG_GAN[gan];
    var step = yang ? (cur - start + 120) % 12 : (start - cur + 120) % 12;
    return CS_NAME[step];
  }
  /* 六十甲子纳音 */
  var NAYIN_PAIRS = [
    '海中金','炉中火','大林木','路旁土','剑锋金','山头火','涧下水','城头土','白蜡金','杨柳木',
    '泉中水','屋上土','霹雳火','松柏木','长流水','沙中金','山下火','平地木','壁上土','金箔金',
    '覆灯火','天河水','大驿土','钗钏金','桑柘木','大溪水','沙中土','天上火','石榴木','大海水'
  ];
  function naYin(gan, zhi) {
    var gi = GAN.indexOf(gan), zi = ZHI.indexOf(zhi);
    for (var k = 0; k < 60; k++) {
      if (k % 10 === gi && k % 12 === zi) return NAYIN_PAIRS[Math.floor(k / 2)];
    }
    return '';
  }
  /* 旬空（空亡）：日柱所在旬的两个空亡地支 */
  function xunKong(gan, zhi) {
    var gi = GAN.indexOf(gan), zi = ZHI.indexOf(zhi);
    var k = -1;
    for (var i = 0; i < 60; i++) if (i % 10 === gi && i % 12 === zi) { k = i; break; }
    if (k < 0) return [];
    var headZhi = (k - (k % 10)) % 12;
    return [ZHI[(headZhi + 10) % 12], ZHI[(headZhi + 11) % 12]];
  }
  /* 神煞（常用） */
  var TIANYI = { 甲:'丑未', 戊:'丑未', 庚:'丑未', 乙:'子申', 己:'子申', 丙:'亥酉', 丁:'亥酉', 壬:'巳卯', 癸:'巳卯', 辛:'午寅' };
  var WENCHANG = { 甲:'巳', 乙:'午', 丙:'申', 丁:'酉', 戊:'申', 己:'酉', 庚:'亥', 辛:'子', 壬:'寅', 癸:'卯' };
  var LUSHEN = { 甲:'寅', 乙:'卯', 丙:'巳', 丁:'午', 戊:'巳', 己:'午', 庚:'申', 辛:'酉', 壬:'亥', 癸:'子' };
  var YANGREN = { 甲:'卯', 乙:'寅', 丙:'午', 丁:'巳', 戊:'午', 己:'巳', 庚:'酉', 辛:'申', 壬:'子', 癸:'亥' };
  var YIMA = { 寅:'申', 午:'申', 戌:'申', 申:'寅', 子:'寅', 辰:'寅', 巳:'亥', 酉:'亥', 丑:'亥', 亥:'巳', 卯:'巳', 未:'巳' };
  var TAOHUA = { 寅:'卯', 午:'卯', 戌:'卯', 申:'酉', 子:'酉', 辰:'酉', 巳:'午', 酉:'午', 丑:'午', 亥:'子', 卯:'子', 未:'子' };
  var HUAGAI = { 寅:'戌', 午:'戌', 戌:'戌', 申:'辰', 子:'辰', 辰:'辰', 巳:'丑', 酉:'丑', 丑:'丑', 亥:'未', 卯:'未', 未:'未' };
  function shenSha(dayGan, yearZhi, zhi) {
    var out = [];
    if ((TIANYI[dayGan] || '').indexOf(zhi) >= 0) out.push('天乙贵人');
    if (WENCHANG[dayGan] === zhi) out.push('文昌');
    if (LUSHEN[dayGan] === zhi) out.push('禄神');
    if (YANGREN[dayGan] === zhi) out.push('羊刃');
    if (YIMA[yearZhi] === zhi) out.push('驿马');
    if (TAOHUA[yearZhi] === zhi) out.push('桃花');
    if (HUAGAI[yearZhi] === zhi) out.push('华盖');
    return out;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function gz(i) { return { gan: GAN[i % 10], zhi: ZHI[i % 12], text: GAN[i % 10] + ZHI[i % 12] }; }

  /* ---------- 大运 ---------- */
  /* 阳男阴女顺行（数到下一个节）；阴男阳女逆行（数到上一个节）
     起运岁数 = 距节的天数 / 3（3天折1年） */
  function daYun(y, m, d, hour, minute, yearGan, gender) {
    var ms = Date.UTC(y, m - 1, d, hour, minute);
    var yangYear = !!YANG_GAN[yearGan];
    var forward = (yangYear && gender === '男') || (!yangYear && gender === '女');
    var jieIdx = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 0];
    var best = null;
    for (var yy = y - 1; yy <= y + 1; yy++) {
      for (var i = 0; i < 12; i++) {
        var ty = (i === 11) ? yy + 1 : yy;
        var t = LC.termMs(ty, jieIdx[i]);
        if (t == null) continue;
        var diff = t - ms;
        if (forward && diff > 0 && (best === null || diff < best.diff)) best = { diff: diff, t: t, i: i, ty: ty };
        if (!forward && diff < 0 && (best === null || -diff < best.diff)) best = { diff: -diff, t: t, i: i, ty: ty };
      }
    }
    if (!best) return null;
    var days = best.diff / 86400000;
    var startAge = days / 3;
    /* 月柱干支序号 */
    var ml = LC.monthLing(y, m, d, hour, minute);
    var mgz = LC.monthGZ(LC.yearGZ(ml.ganZhiYear), ml.idx);
    var mIdx = -1;
    for (var k = 0; k < 60; k++) if (k % 10 === mgz.gan && k % 12 === mgz.zhi) { mIdx = k; break; }
    var list = [];
    for (var n = 1; n <= 10; n++) {
      var idx = forward ? (mIdx + n) % 60 : ((mIdx - n) % 60 + 60) % 60;
      var g2 = gz(idx);
      list.push({ n: n, gan: g2.gan, zhi: g2.zhi, text: g2.text });
    }
    return { forward: forward, startAge: startAge, days: days, list: list, jie: best };
  }

  /* ---------- 主函数 ---------- */
  function paipan(opts) {
    opts = opts || {};
    var y = opts.year, m = opts.month, d = opts.day;
    var hour = opts.hour == null ? 0 : opts.hour;
    var minute = opts.minute || 0;
    var gender = opts.gender === '女' ? '女' : '男';
    if (!y || !m || !d) throw new Error('请填出生年月日');

    /* 真太阳时（可选） */
    var useTS = opts.trueSolar && typeof opts.longitude === 'number';
    var tst = null;
    if (useTS) {
      tst = LC.trueSolarTime(y, m, d, hour, minute, opts.longitude, opts.useEoT !== false);
      hour = tst.hour; minute = tst.minute;
    }
    var hourZhiIdx = LC.hourZhiOf(hour);

    /* ① 年柱：立春换年 */
    var ml = LC.monthLing(y, m, d, hour, minute);
    var yearIdx = LC.yearGZ(ml.ganZhiYear);
    var yearGan = GAN[yearIdx % 10], yearZhi = ZHI[yearIdx % 12];

    /* ② 月柱：节气换月 */
    var monthGz = LC.monthGZ(yearIdx, ml.idx);
    var monthGan = GAN[monthGz.gan], monthZhi = ZHI[monthGz.zhi];

    /* ③ 日柱：子时分日；晚子时（23:00–24:00）日干支仍用本日 */
    var dayIdx = LC.dayGZ(y, m, d);
    var dayGan = GAN[dayIdx % 10], dayZhi = ZHI[dayIdx % 12];
    var lateZi = (hour >= 23);

    /* ④ 时柱：五鼠遁；晚子时时干按次日日干求，日干支仍本日 */
    var hourBaseIdx = dayIdx;
    if (lateZi) {
      var nx = LC.fromJDN(LC.toJDN(y, m, d) + 1);
      hourBaseIdx = LC.dayGZ(nx.y, nx.m, nx.d);
    }
    var hourGanIdx = LC.hourGZ(hourBaseIdx, hourZhiIdx);
    var hourGan = GAN[hourGanIdx], hourZhi = ZHI[hourZhiIdx];

    /* 四柱 */
    var pillars = [
      { name: '年柱', gan: yearGan, zhi: yearZhi },
      { name: '月柱', gan: monthGan, zhi: monthZhi },
      { name: '日柱', gan: dayGan, zhi: dayZhi },
      { name: '时柱', gan: hourGan, zhi: hourZhi }
    ];
    pillars.forEach(function (p) {
      p.text = p.gan + p.zhi;
      p.naYin = naYin(p.gan, p.zhi);
      p.ganShiShen = (p.name === '日柱') ? '日主' : shiShen(dayGan, p.gan);
      p.changSheng = changSheng(dayGan, p.zhi);
      p.cang = CANG[p.zhi] || [];
      p.cangShiShen = p.cang.map(function (g) { return { gan: g, shiShen: shiShen(dayGan, g) }; });
      p.shenSha = shenSha(dayGan, yearZhi, p.zhi);
    });

    /* 五行统计（含藏干加权：本气1.0、中气0.5、余气0.3；天干各1.0） */
    var W = [1, 0.5, 0.3];
    var wx = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    pillars.forEach(function (p) {
      wx[WX_GAN[p.gan]] += 1;
      p.cang.forEach(function (g, i) { wx[WX_GAN[g]] += (W[i] || 0.3); });
    });
    Object.keys(wx).forEach(function (k) { wx[k] = Math.round(wx[k] * 100) / 100; });

    /* 日主旺衰：把「生扶日主之力」与「耗泄日主之力」放在同一基础上比
       生扶 = 印（生日主）+ 比劫（同五行）
       耗泄 = 食伤（日主所生）+ 财（日主所克）+ 官杀（克日主）
       权重：天干 1.0；地支本气 1.0、中气 0.5、余气 0.3
       月令加成：月支为全局权柄，命中用神/忌神时再加权 */
    var de = WX_GAN[dayGan];
    var yin = { 木:'水', 火:'木', 土:'火', 金:'土', 水:'金' }[de];     /* 印 */
    var bi = de;                                                        /* 比劫 */
    var sheng = 0, drain = 0;
    function add(el, w, isMonth) {
      var mult = isMonth ? 1.6 : 1;
      if (el === de || el === yin) sheng += w * mult;
      else drain += w * mult;
    }
    pillars.forEach(function (p) {
      add(WX_GAN[p.gan], 1, p.name === '月柱');
      p.cang.forEach(function (g, i) { add(WX_GAN[g], (W[i] || 0.3), p.name === '月柱'); });
    });
    var total = sheng + drain || 1;
    var ratio = sheng / total;   /* 0–1：生扶日主所占比例 */
    var strength = ratio >= 0.56 ? '身强' : (ratio >= 0.44 ? '中和' : '身弱');
    /* 极端情况修正：日主完全无根且被克泄 → 从格倾向 */
    var hasRoot = false;
    pillars.forEach(function (p) {
      if (p.zhi === dayZhi) hasRoot = true;
      p.cang.forEach(function (g) { if (g === dayGan) hasRoot = true; });
    });
    var congGe = '';
    if (!hasRoot && ratio <= 0.22) congGe = (drain > 0 ? '（日主无根，有从格倾向）' : '');

    /* 格局：以月支本气（或透干的中余气）对日主的十神定 */
    var monthCang = CANG[monthZhi] || [];
    var geJu = '月支无藏干';
    var monthShiShen = [];
    var touGan = null;
    monthCang.forEach(function (g) {
      var ss = shiShen(dayGan, g);
      monthShiShen.push({ gan: g, shiShen: ss, tou: pillars.some(function (p) { return p.name !== '月柱' && p.gan === g; }) });
      if (!touGan && pillars.some(function (p) { return p.name !== '月柱' && p.gan === g; })) touGan = { gan: g, shiShen: ss };
    });
    var benQi = monthShiShen[0] ? monthShiShen[0].shiShen : '';
    var useSS = (touGan ? touGan.shiShen : benQi);
    var GE_MAP = {
      '正官': '正官格', '七杀': '七杀格（偏官格）', '正财': '正财格', '偏财': '偏财格',
      '正印': '正印格', '偏印': '偏印格（枭神格）', '食神': '食神格', '伤官': '伤官格',
      '比肩': '建禄格（比肩格）', '劫财': '月刃格（劫财格）'
    };
    geJu = GE_MAP[useSS] || '普通格局';

    /* 用神喜忌：身弱取印比为用；身强取财官食伤为用；中和取通关调候 */
    var yong, xi, ji;
    if (strength === '身弱') {
      yong = [yin, bi]; xi = [yin, bi]; ji = [SHENG[de], KE[de], KE[yin] || SHENG[de]];
      ji = [SHENG[de], KE[de]];
    } else if (strength === '身强') {
      yong = [SHENG[de], KE[de]]; xi = [SHENG[de], KE[de]]; ji = [yin, bi];
    } else {
      yong = [SHENG[de], yin]; xi = [SHENG[de], yin, KE[de]]; ji = [KE[yin] || de];
    }
    /* 简化输出：转成十神名 */
    function wxToShiShen(w) {
      if (w === de) return '比劫';
      if (w === yin) return '印星';
      if (w === SHENG[de]) return '食伤';
      if (w === KE[de]) return '财星';
      if (w === KE[yin] || KE[w] === de) return '官杀';
      return w;
    }
    var yongSS = yong.map(wxToShiShen), jiSS = ji.map(wxToShiShen), xiSS = xi.map(wxToShiShen);

    /* 大运 */
    var dy = daYun(y, m, d, opts.hour == null ? 0 : opts.hour, minute, yearGan, gender);

    /* 当前流年 */
    var nowY = new Date().getFullYear();
    var liuNian = [];
    for (var k2 = 0; k2 < 8; k2++) {
      var yy2 = nowY + k2;
      var yi2 = LC.yearGZ(yy2);
      liuNian.push({ year: yy2, gan: GAN[yi2 % 10], zhi: ZHI[yi2 % 12],
        text: GAN[yi2 % 10] + ZHI[yi2 % 12], shiShen: shiShen(dayGan, GAN[yi2 % 10]),
        age: yy2 - y + 1 });
    }

    return {
      input: { y: y, m: m, d: d, hour: opts.hour == null ? 0 : opts.hour, minute: minute, gender: gender },
      trueSolar: tst, hourUsed: hour, hourZhi: hourZhi, lateZi: lateZi,
      lunar: LC.solarToLunar(y, m, d),
      pillars: pillars,
      dayGan: dayGan, dayZhi: dayZhi,
      yearGan: yearGan, yearZhi: yearZhi, monthZhi: monthZhi,
      shengXiao: SX[ZHI.indexOf(yearZhi)],
      wuXing: wx,
      strength: strength, strengthRatio: Math.round(ratio * 100),
      monthShiShen: monthShiShen, geJu: geJu,
      yongShen: yongSS, xiShen: xiSS, jiShen: jiSS,
      xunKong: xunKong(dayGan, dayZhi),
      daYun: dy, liuNian: liuNian
    };
  }

  var API = {
    paipan: paipan,
    shiShen: shiShen, changSheng: changSheng, naYin: naYin, xunKong: xunKong,
    CANG: CANG, GAN: GAN, ZHI: ZHI, WX_GAN: WX_GAN, WX_ZHI: WX_ZHI,
    SHENG: SHENG, KE: KE, YANG_GAN: YANG_GAN, SHISHEN: SHISHEN, CS_NAME: CS_NAME
  };
  root.BaZi = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
