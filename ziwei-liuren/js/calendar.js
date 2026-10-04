/* ================= 历法内核：农历 / 干支 / 节气 / 真太阳时 =================
   数据来源：build/calendar.json（1900-2100，由 lunar_python 校验生成）
   ==================== 紫微斗数 · 大六壬 共用 ==================== */
(function (root) {
  'use strict';

  var GAN = '甲乙丙丁戊己庚辛壬癸';
  var ZHI = '子丑寅卯辰巳午未申酉戌亥';
  var SHENGXIAO = '鼠牛虎兔龙蛇马羊猴鸡狗猪';
  var TERMS = ['小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至',
               '小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'];
  // 节（月令分界）：立春 惊蛰 清明 立夏 芒种 小暑 立秋 白露 寒露 立冬 大雪 小寒
  var JIE_IDX = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 0];   // 对应 寅..丑 月
  var MONTH_ZHI = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
  var ZHONGQI = [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 1];    // 雨水 春分 ... 大寒
  // 月将：中气 → 月将（太阳过宫）
  var YUEJIANG = { 3:'亥', 5:'戌', 7:'酉', 9:'申', 11:'未', 13:'午', 15:'巳', 17:'辰', 19:'卯', 21:'寅', 23:'丑', 1:'子' };
  var YUEJIANG_NAME = { 亥:'登明', 戌:'河魁', 酉:'从魁', 申:'传送', 未:'小吉', 午:'胜光',
                        巳:'太乙', 辰:'天罡', 卯:'太冲', 寅:'功曹', 丑:'大吉', 子:'神后' };

  var DATA = null;
  function load(data) { DATA = data; }
  function ensure() { if (!DATA) throw new Error('calendar data not loaded'); }

  function isLeapYear(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function daysInMonth(y, m) { return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }

  /* 儒略日：返回当日 0 时的整数 JDN */
  function toJDN(y, m, d) {
    var a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) -
           Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }
  function fromJDN(jdn) {
    var a = jdn + 32044, b = Math.floor((4 * a + 3) / 146097), c = a - Math.floor(146097 * b / 4),
        d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * d / 4), m = Math.floor((5 * e + 2) / 153);
    return { y: 100 * b + d - 4800 + Math.floor(m / 10), m: m + 3 - 12 * Math.floor(m / 10),
             d: e - Math.floor((153 * m + 2) / 5) + 1 };
  }

  /* 年干支序号 0-59（以立春为界，专业排盘惯例） */
  function yearGZ(y) { return ((y - 4) % 60 + 60) % 60; }
  /* 日干支序号 0-59，基准 1900-01-01 为甲戌(10) */
  function dayGZ(y, m, d) { return ((toJDN(y, m, d) - toJDN(1900, 1, 1)) % 60 + 60 + 10) % 60; }
  /* 时干支序号 0-59：日干起时（五鼠遁） */
  function hourGZ(dayGzIdx, hourZhiIdx) {
    var dg = dayGzIdx % 10;
    var start = [0, 2, 4, 6, 8][dg % 5];      // 子时天干
    return ((start + hourZhiIdx) % 10) + 0;   // 返回时干序号 0-9
  }
  function hourZhiOf(hour) { return Math.floor(((hour + 1) % 24) / 2); }  // 23,0 -> 子(0)

  /* ---------- 节气时刻：返回该公历年内 24 节气的时间戳 ---------- */
  function termTime(y, idx) {
    ensure();
    if (y < DATA.Y0 || y > DATA.Y1) return null;
    var r = DATA.solarTerms[y - DATA.Y0];
    var t = r[idx];
    if (!t) return null;
    var hours = t[2], mins = t[3];
    return { y: y, m: t[0], d: t[1], h: hours, min: mins,
             ms: Date.UTC(y, t[0] - 1, t[1], t[2], t[3]), text: t[0] + '月' + t[1] + '日 ' + pad(t[2]) + ':' + pad(t[3]) };
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* 取某节气的“专业”时间戳，用 UTC 存以免时区干扰 */
  function termMs(y, idx) {
    var t = termTime(y, idx);
    return t ? t.ms : null;
  }

  /* 月令（节气月）：返回 { zhi, idx(0=寅), yearGZ 所在年, term } */
  function monthLing(y, m, d, hour, minute) {
    var ms = Date.UTC(y, m - 1, d, hour || 0, minute || 0);
    // 从立春开始扫描 12 个节
    var ganZhiYear = y;
    if (ms < termMs(y, 2)) ganZhiYear = y - 1;   // 立春前算上一年
    var startYear = ganZhiYear;
    var found = -1;
    for (var i = 0; i < 12; i++) {
      // 节 i 对应的公历时间：小寒(0)、立春(2) 等在 ganZhiYear 年内
      var idx = JIE_IDX[i];
      var ty = (i === 11) ? startYear + 1 : startYear;   // 丑月的小寒在次年 1 月
      var a = termMs(startYear, idx);
      var nextIdx = JIE_IDX[(i + 1) % 12];
      var nextY = (i + 1 === 11) ? startYear + 1 : startYear;
      // 直接比较：找最后一个 <= ms 的节
      var b = termMs(nextY, nextIdx);
      if (a !== null && ms >= a && (b === null || ms < b)) { found = i; break; }
    }
    if (found < 0) {
      // 落在小寒之前（1月初）
      found = 11; ganZhiYear = ganZhiYear; // 丑月，仍属上一个干支年
    }
    return { idx: found, zhi: MONTH_ZHI[found], ganZhiYear: ganZhiYear };
  }

  /* 月将（大六壬）：找最后一个 <= 给定时刻的中气 */
  function yueJiang(y, m, d, hour, minute) {
    ensure();
    var ms = Date.UTC(y, m - 1, d, hour || 0, minute || 0);
    var best = null, bestMs = -Infinity, bestIdx = -1, bestY = 0;
    for (var yy = y - 1; yy <= y + 1; yy++) {
      if (yy < DATA.Y0 || yy > DATA.Y1) continue;
      for (var k = 0; k < 12; k++) {
        var idx = ZHONGQI[k];
        var t = termTime(yy, idx);
        if (!t) continue;
        if (t.ms <= ms && t.ms > bestMs) { bestMs = t.ms; best = t; bestIdx = idx; bestY = yy; }
      }
    }
    if (!best) return null;
    return { zhi: YUEJIANG[bestIdx], name: YUEJIANG_NAME[YUEJIANG[bestIdx]],
             term: TERMS[bestIdx], termTime: best };
  }

  /* ---------- 公历 → 农历 ----------
     位布局：bit15..4 = 正月..十二月(1=30天)  bit16 = 闰月是否30天  bit3..0 = 闰月月份 */
  function monthDaysOf(info, m) { return (info & (1 << (16 - m))) ? 30 : 29; }
  function leapMonthOf(info) { return info & 0xF; }
  function leapDaysOf(info) { return (info & (1 << 16)) ? 30 : 29; }
  function lunarYearDays(info) {
    var s = 0;
    for (var m = 1; m <= 12; m++) s += monthDaysOf(info, m);
    if (leapMonthOf(info)) s += leapDaysOf(info);
    return s;
  }

  function solarToLunar(y, m, d) {
    ensure();
    if (y < DATA.Y0 || y > DATA.Y1) return null;
    var offset = toJDN(y, m, d) - toJDN(DATA.Y0, 1, 31);   // 1900-01-31 = 农历1900正月初一
    if (offset < 0) return null;
    var year = DATA.Y0, info;
    while (year <= DATA.Y1) {
      info = DATA.lunarInfo[year - DATA.Y0];
      var yd = lunarYearDays(info);
      if (offset < yd) break;
      offset -= yd; year++;
    }
    if (year > DATA.Y1) return null;
    var leap = leapMonthOf(info), isLeap = false, month = 0, day = offset + 1;
    for (var mm = 1; mm <= 12; mm++) {
      var dm = monthDaysOf(info, mm);
      if (day > dm) { day -= dm; } else { month = mm; break; }
      if (leap === mm) {
        var dl = leapDaysOf(info);
        if (day > dl) { day -= dl; } else { month = mm; isLeap = true; break; }
      }
    }
    if (month === 0) { month = 12; }
    return { y: year, m: month, d: day, isLeap: isLeap,
             text: lunarText(year, month, day, isLeap) };
  }

  function lunarText(y, m, d, isLeap) {
    var M = ['正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','冬月','腊月'];
    var D1 = ['初','十','廿','三'], D2 = ['一','二','三','四','五','六','七','八','九','十'];
    var dstr;
    if (d === 10) dstr = '初十'; else if (d === 20) dstr = '二十'; else if (d === 30) dstr = '三十';
    else dstr = D1[Math.floor(d / 10)] + D2[(d - 1) % 10];
    return (isLeap ? '闰' : '') + M[m - 1] + dstr;
  }

  /* 农历 → 公历 */
  /* 按农历年查闰月：返回 0 表示无闰月，否则返回闰几月（1-12） */
  function leapMonthOfYear(ly) {
    ensure();
    if (ly < DATA.Y0 || ly > DATA.Y1) return 0;
    return leapMonthOf(DATA.lunarInfo[ly - DATA.Y0]);
  }
  /* 按农历年 + 月号查该月天数；isLeap=true 时查闰月天数 */
  function monthDaysOfYear(ly, lm, isLeap) {
    ensure();
    if (ly < DATA.Y0 || ly > DATA.Y1) return 29;
    var info = DATA.lunarInfo[ly - DATA.Y0];
    if (isLeap) return (leapMonthOf(info) === lm) ? leapDaysOf(info) : 29;
    return monthDaysOf(info, lm);
  }
  /* 农历年可用月份列表（含闰月）：[{m, isLeap, days, label}] */
  function lunarMonthsOfYear(ly) {
    var leap = leapMonthOfYear(ly), out = [];
    var CN = ["正","二","三","四","五","六","七","八","九","十","冬","腊"];
    for (var m = 1; m <= 12; m++) {
      out.push({ m: m, isLeap: false, days: monthDaysOfYear(ly, m, false), label: CN[m-1] + "月" });
      if (leap === m) out.push({ m: m, isLeap: true, days: monthDaysOfYear(ly, m, true), label: "闰" + CN[m-1] + "月" });
    }
    return out;
  }

  function lunarToSolar(ly, lm, ld, isLeap) {
    ensure();
    if (ly < DATA.Y0 || ly > DATA.Y1) return null;
    var offset = 0, info, leap;
    for (var i = DATA.Y0; i < ly; i++) offset += lunarYearDays(DATA.lunarInfo[i - DATA.Y0]);
    info = DATA.lunarInfo[ly - DATA.Y0];
    leap = leapMonthOf(info);
    for (var mm = 1; mm < lm; mm++) {
      offset += monthDaysOf(info, mm);
      if (leap === mm) offset += leapDaysOf(info);
    }
    if (isLeap && leap === lm) offset += monthDaysOf(info, lm);
    offset += ld - 1;
    return fromJDN(toJDN(DATA.Y0, 1, 31) + offset);
  }

  /* ---------- 真太阳时 ---------- */
  var CITY_LNG = {
    '北京':116.41,'上海':121.47,'广州':113.26,'深圳':114.06,'天津':117.20,'重庆':106.55,
    '成都':104.07,'杭州':120.15,'南京':118.78,'武汉':114.30,'西安':108.94,'沈阳':123.43,
    '哈尔滨':126.63,'长春':125.32,'济南':117.00,'青岛':120.38,'郑州':113.62,'长沙':112.94,
    '合肥':117.28,'福州':119.30,'厦门':118.09,'南昌':115.89,'太原':112.55,'石家庄':114.51,
    '呼和浩特':111.75,'兰州':103.82,'西宁':101.78,'银川':106.23,'乌鲁木齐':87.62,'拉萨':91.14,
    '昆明':102.83,'贵阳':106.63,'南宁':108.37,'海口':110.20,'三亚':109.51,'大连':121.61,
    '苏州':120.62,'无锡':120.30,'宁波':121.55,'温州':120.70,'佛山':113.12,'东莞':113.75,
    '泉州':118.68,'烟台':121.39,'唐山':118.18,'洛阳':112.45,'徐州':117.28,'常州':119.97,
    '南通':120.86,'嘉兴':120.76,'绍兴':120.58,'金华':119.65,'台州':121.42,'珠海':113.55,
    '中山':113.39,'汕头':116.68,'惠州':114.41,'湛江':110.36,'桂林':110.30,'柳州':109.42,
    '鞍山':122.99,'抚顺':123.96,'吉林':126.55,'齐齐哈尔':123.92,'包头':109.84,'大同':113.30,
    '邯郸':114.49,'保定':115.46,'廊坊':116.68,'沧州':116.86,'衡水':115.67,'德州':116.36,
    '临沂':118.35,'济宁':116.59,'泰安':117.09,'潍坊':119.16,'淄博':118.05,'威海':122.12,
    '扬州':119.41,'镇江':119.45,'盐城':120.16,'淮安':119.02,'连云港':119.16,'宿迁':118.28,
    '芜湖':118.38,'蚌埠':117.36,'安庆':117.05,'九江':116.00,'赣州':114.94,'宜昌':111.29,
    '襄阳':112.14,'荆州':112.24,'十堰':110.79,'株洲':113.15,'湘潭':112.94,'衡阳':112.61,
    '岳阳':113.13,'常德':111.70,'绵阳':104.68,'德阳':104.40,'宜宾':104.63,'泸州':105.44,
    '遵义':106.93,'曲靖':103.80,'大理':100.23,'丽江':100.23,'咸阳':108.71,'宝鸡':107.14,
    '渭南':109.51,'延安':109.49,'榆林':109.74,'天水':105.72,'酒泉':98.51,'克拉玛依':84.89,
    '香港':114.17,'澳门':113.55,'台北':121.52,'高雄':120.31,'台中':120.68
  };

  /* 均时差（分钟），近似公式，误差 <30 秒 */
  function equationOfTime(y, m, d, hour) {
    var n = toJDN(y, m, d) - toJDN(y, 1, 1) + 1;
    var b = 2 * Math.PI * (n - 81) / 364;
    return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  }

  /* 真太阳时校正：返回 { y,m,d,hour,minute, deltaMin, lng } */
  function trueSolarTime(y, m, d, hour, minute, lng, useEoT) {
    var delta = (lng - 120) * 4 + (useEoT === false ? 0 : equationOfTime(y, m, d, hour));
    var total = hour * 60 + (minute || 0) + Math.round(delta);
    var jdn = toJDN(y, m, d);
    while (total < 0) { total += 1440; jdn -= 1; }
    while (total >= 1440) { total -= 1440; jdn += 1; }
    var dt = fromJDN(jdn);
    return { y: dt.y, m: dt.m, d: dt.d, hour: Math.floor(total / 60), minute: total % 60,
             deltaMin: Math.round(delta), lng: lng };
  }

  /* 时区偏移（分钟）：用户所在时区相对 UTC */
  function localOffsetMin(y, m, d) {
    var dt = new Date(y, m - 1, d, 12, 0, 0);
    return -dt.getTimezoneOffset();
  }

  /* ---------- 五虎遁：年干 → 正月(寅月)天干 ---------- */
  function monthGanStart(yearGanIdx) {
    return [2, 4, 6, 8, 0][yearGanIdx % 5];
  }
  /* 月柱：由（干支年干 + 月支序号0=寅）得月干 */
  function monthGZ(yearGanIdx, monthZhiIdx) {
    var g = (monthGanStart(yearGanIdx) + monthZhiIdx) % 10;
    return { gan: g, zhi: (2 + monthZhiIdx) % 12, text: GAN[g] + ZHI[(2 + monthZhiIdx) % 12] };
  }

  /* ---------- 旬空（空亡）：日干支 → 两个空亡地支 ---------- */
  function xunKong(dayGzIdx) {
    var xun = Math.floor(dayGzIdx / 10);           // 0=甲子旬
    var startZhi = (dayGzIdx % 10 - xun) ;         // 旬首地支偏移
    // 旬首地支 = (dayGzIdx - dayGzIdx%10) 对应地支 = (0 + ...)：旬首天干甲，地支 = (旬首序 % 12)
    var head = dayGzIdx - (dayGzIdx % 10);
    var headZhi = head % 12;
    var a = (headZhi + 10) % 12, b = (headZhi + 11) % 12;
    return [ZHI[a], ZHI[b]];
  }

  /* ---------- 紫微斗数用：定命宫的那个「月」（处理闰月惯例） ----------
     base      : 已定好的月号（1-12），来自「农历月」或「节气月」
     isLeap    : 该月是否为闰月
     d         : 农历日（split 模式要用）
     mode: 'prev'  闰月归本月
           'next'  闰月归下月（倪海厦《天纪》：闰月生人作下月论）
           'split' 十五前归本月、十六起归下月（默认，主流在线排盘）
     修复：非闰月时此前一律返回 lunar.m，导致节气月（monthMode:'term'）被丢弃。 */
  function zwMonth(base, isLeap, d, mode) {
    var m = base;
    if (!isLeap) return m;
    if (mode === 'next') return m === 12 ? 12 : m + 1;
    if (mode === 'prev') return m;
    return d <= 15 ? m : (m === 12 ? 12 : m + 1);   // 'split'（默认）
  }

  var API = {
    GAN: GAN, ZHI: ZHI, SHENGXIAO: SHENGXIAO, TERMS: TERMS, CITY_LNG: CITY_LNG,
    MONTH_ZHI: MONTH_ZHI, YUEJIANG_NAME: YUEJIANG_NAME, YUEJIANG: YUEJIANG,
    load: load, toJDN: toJDN, fromJDN: fromJDN,
    yearGZ: yearGZ, dayGZ: dayGZ, hourGZ: hourGZ, hourZhiOf: hourZhiOf,
    termTime: termTime, termMs: termMs, monthLing: monthLing, yueJiang: yueJiang,
    solarToLunar: solarToLunar, lunarToSolar: lunarToSolar, lunarText: lunarText,
    trueSolarTime: trueSolarTime, equationOfTime: equationOfTime, localOffsetMin: localOffsetMin,
    monthGanStart: monthGanStart, monthGZ: monthGZ, xunKong: xunKong, zwMonth: zwMonth,
    gzName: function (i) { return GAN[i % 10] + ZHI[i % 12]; },
    isLeapYear: isLeapYear, daysInMonth: daysInMonth, pad: pad,
    leapMonthOfYear: leapMonthOfYear, monthDaysOfYear: monthDaysOfYear, lunarMonthsOfYear: lunarMonthsOfYear
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.LunarCore = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
