/* ================= 六爻（纳甲筮法）起卦与装卦引擎 =================
   起卦：三枚铜钱掷六次，自初爻至上爻
        三个背（3背）＝老阳（○，动，阳变阴）
        两背一字    ＝少阴（– –）
        一背两字    ＝少阳（——）
        三个字      ＝老阴（×，动，阴变阳）
   装卦：定卦宫 → 安世应 → 纳甲（干支） → 配六亲（以卦宫五行为"我"） → 按日干起六神
   经文：取《易经》卦辞、动爻爻辞、大象传
   ==================== 对外：LiuYao.qi(opts) ==================== */
(function (root) {
  'use strict';
  var LC = root.LunarCore || (typeof require !== 'undefined' ? require('./calendar.js') : null);
  var YJ = root.YI_JING || (typeof require !== 'undefined' ? require('./yijing_data.js') : null);

  var GAN = '甲乙丙丁戊己庚辛壬癸';
  var ZHI = '子丑寅卯辰巳午未申酉戌亥';
  var ZHI_WX = { '子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水' };
  var GONG_WX = { '乾':'金','兑':'金','离':'火','震':'木','巽':'木','坎':'水','艮':'土','坤':'土' };
  var LIUSHEN = ['青龙','朱雀','勾陈','螣蛇','白虎','玄武'];
  /* 日干起六神：甲乙起青龙、丙丁起朱雀、戊起勾陈、己起螣蛇、庚辛起白虎、壬癸起玄武 */
  var SHEN_START = { '甲':0,'乙':0,'丙':1,'丁':1,'戊':2,'己':3,'庚':4,'辛':4,'壬':5,'癸':5 };

  /* 八宫卦序（京房易：本宫卦、一世…五世、游魂、归魂）与世应位置
     世爻位（1=初爻…6=上爻）；应爻 = 世爻 ±3
     序：乾宫 乾姤遁否观剥晋大有／坎宫 坎节屯既济革丰明夷师／艮宫 艮贲大畜损睽履中孚渐
         震宫 震豫解恒升井大过随／巽宫 巽小畜家人益无妄噬嗑颐蛊／离宫 离旅鼎未济蒙涣讼同人
         坤宫 坤复临泰大壮夬需比／兑宫 兑困萃咸蹇谦小过归妹
     [上卦, 下卦] */
  var GONG_TABLE = {
    '乾': [['乾','乾'],['乾','巽'],['乾','艮'],['乾','坤'],['巽','坤'],['艮','坤'],['离','坤'],['离','乾']],
    '坎': [['坎','坎'],['坎','兑'],['坎','震'],['坎','离'],['兑','离'],['震','离'],['坤','离'],['坤','坎']],
    '艮': [['艮','艮'],['艮','离'],['艮','乾'],['艮','兑'],['离','兑'],['乾','兑'],['巽','兑'],['巽','艮']],
    '震': [['震','震'],['震','坤'],['震','坎'],['震','巽'],['坤','巽'],['坎','巽'],['兑','巽'],['兑','震']],
    '巽': [['巽','巽'],['巽','乾'],['巽','离'],['巽','震'],['乾','震'],['离','震'],['艮','震'],['艮','巽']],
    '离': [['离','离'],['离','艮'],['离','巽'],['离','坎'],['艮','坎'],['巽','坎'],['乾','坎'],['乾','离']],
    '坤': [['坤','坤'],['坤','震'],['坤','兑'],['坤','乾'],['震','乾'],['兑','乾'],['坎','乾'],['坎','坤']],
    '兑': [['兑','兑'],['兑','坎'],['兑','坤'],['兑','艮'],['坎','艮'],['坤','艮'],['震','艮'],['震','兑']]
  };
  var SHI_POS = [6, 1, 2, 3, 4, 5, 4, 3];      /* 纯卦／一世…五世／游魂／归魂 的世爻位置 */

  /* 八卦纳甲：三爻（自内到外）地支；天干仅用于显示 */
  var NAJIA = {
    '乾': { gan:'甲', zhi:['子','寅','辰'], ganU:'壬', zhiU:['午','申','戌'] },
    '坤': { gan:'乙', zhi:['未','巳','卯'], ganU:'癸', zhiU:['丑','亥','酉'] },
    '震': { gan:'庚', zhi:['子','寅','辰'], ganU:'庚', zhiU:['午','申','戌'] },
    '巽': { gan:'辛', zhi:['丑','亥','酉'], ganU:'辛', zhiU:['未','巳','卯'] },
    '坎': { gan:'戊', zhi:['寅','辰','午'], ganU:'戊', zhiU:['申','戌','子'] },
    '离': { gan:'己', zhi:['卯','丑','亥'], ganU:'己', zhiU:['酉','未','巳'] },
    '艮': { gan:'丙', zhi:['辰','午','申'], ganU:'丙', zhiU:['戌','子','寅'] },
    '兑': { gan:'丁', zhi:['巳','卯','丑'], ganU:'丁', zhiU:['亥','酉','未'] }
  };

  var LINES = { '乾':[1,1,1],'兑':[1,1,0],'离':[1,0,1],'震':[1,0,0],'巽':[0,1,1],'坎':[0,1,0],'艮':[0,0,1],'坤':[0,0,0] };
  var TRIGRAM_WX = { '乾':'金','兑':'金','离':'火','震':'木','巽':'木','坎':'水','艮':'土','坤':'土' };
  function lines(g) { return LINES[g].slice(); }

  /* 由六爻（自初到上，1=阳 0=阴）求上下卦 */
  function trigramsOf(yao) {
    var low = yao.slice(0,3), up = yao.slice(3,6);
    function match(a) {
      for (var g in LINES) if (LINES[g][0]===a[0] && LINES[g][1]===a[1] && LINES[g][2]===a[2]) return g;
      return '乾';
    }
    return { up: match(up), low: match(low) };
  }

  /* 由上下卦求卦名与卦宫、世应 */
  function guaInfo(up, low) {
    var name = (YJ[up] && YJ[up][low]) ? YJ[up][low].name : (up + low);
    for (var gong in GONG_TABLE) {
      var arr = GONG_TABLE[gong];
      for (var i=0;i<arr.length;i++) {
        if (arr[i][0] === up && arr[i][1] === low) {
          var shi = SHI_POS[i];
          var ying = shi > 3 ? shi - 3 : shi + 3;
          return { name:name, up:up, low:low, gong:gong, gongWx:GONG_WX[gong],
                   shi:shi, ying:ying, kind:['本宫卦','一世卦','二世卦','三世卦','四世卦','五世卦','游魂卦','归魂卦'][i] };
        }
      }
    }
    return { name:name, up:up, low:low, gong:'乾', gongWx:'金', shi:6, ying:3, kind:'—' };
  }

  /* 纳甲：六爻干支（自初到上） */
  function naJia(up, low) {
    var l = NAJIA[low], u = NAJIA[up];
    var out = [];
    for (var i=0;i<3;i++) out.push({ gan:l.gan, zhi:l.zhi[i] });
    for (var j=0;j<3;j++) out.push({ gan:u.ganU, zhi:u.zhiU[j] });
    return out;
  }

  /* 六亲：以卦宫五行为「我」 */
  function liuQin(me, other) {
    if (me === other) return '兄弟';
    var SHENG = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
    var KE = { '木':'土','土':'水','水':'火','火':'金','金':'木' };
    if (SHENG[me] === other) return '子孙';      /* 我生者 */
    if (SHENG[other] === me) return '父母';      /* 生我者 */
    if (KE[me] === other) return '妻财';         /* 我克者 */
    if (KE[other] === me) return '官鬼';         /* 克我者 */
    return '—';
  }

  /* 旬空：由日干支求 */
  function xunKong(dayGZIdx) {
    var head = dayGZIdx - (dayGZIdx % 10);
    var hz = head % 12;
    return [ZHI[(hz + 10) % 12], ZHI[(hz + 11) % 12]];
  }

  /* 摇卦：三枚铜钱掷一次 → 本爻 */
  function toss() {
    var backs = 0;
    for (var i=0;i<3;i++) backs += (Math.random() < 0.5 ? 1 : 0);   /* 1=背 */
    /* 三个背＝老阳(动阳)；两背一字＝少阴；一背两字＝少阳；三个字＝老阴(动阴) */
    if (backs === 3) return { backs:backs, yao:1, old:true,  text:'三个背', name:'老阳' };
    if (backs === 2) return { backs:backs, yao:0, old:false, text:'两背一字', name:'少阴' };
    if (backs === 1) return { backs:backs, yao:1, old:false, text:'一背两字', name:'少阳' };
    return { backs:0, yao:0, old:true, text:'三个字', name:'老阴' };
  }

  /* 主入口：
     opts = { method:'shake'|'coin'|'manual'|'time',
              tosses:[{yao,old}×6] 手动/已摇好的六爻,
              yao:[1,0,…六位] 手动指定,
              year,month,day,hour,minute 用于日干支与六神 }
     返回：本卦装卦 + 变卦 + 经文 */
  function qi(opts) {
    opts = opts || {};
    var tosses = [];
    var i;

    if (opts.tosses && opts.tosses.length === 6) {
      for (i=0;i<6;i++) tosses.push({ yao: opts.tosses[i].yao ? 1 : 0, old: !!opts.tosses[i].old });
    } else if (opts.yao && opts.yao.length === 6) {
      for (i=0;i<6;i++) tosses.push({ yao: opts.yao[i] ? 1 : 0, old: !!(opts.old && opts.old[i]) });
    } else {
      for (i=0;i<6;i++) tosses.push(toss());
    }

    /* 本卦六爻（老阳/老阴先按本卦取象：老阳为阳、老阴为阴） */
    var benYao = tosses.map(function(t){ return t.yao; });
    var bianYao = tosses.map(function(t){ return t.old ? (t.yao ? 0 : 1) : t.yao; });
    var dong = [];
    for (i=0;i<6;i++) if (tosses[i].old) dong.push(i + 1);      /* 动爻位置（1=初） */

    var bt = trigramsOf(benYao), xt = trigramsOf(bianYao);
    var ben = guaInfo(bt.up, bt.low);
    var hasBian = dong.length > 0;
    var bian = hasBian ? guaInfo(xt.up, xt.low) : null;

    /* 日干支：用于六神与旬空 */
    var dayGZIdx = null, dayGan = '甲', kong = [];
    if (opts.year && LC) {
      var lng = opts.longitude, useTS = opts.trueSolar && typeof lng === 'number';
      var ty = opts.year, tm = opts.month, td = opts.day, thh = opts.hour || 0, tmm = opts.minute || 0;
      if (useTS) {
        var tst = LC.trueSolarTime(opts.year, opts.month, opts.day, opts.hour || 0, opts.minute || 0, lng, true);
        ty = tst.y; tm = tst.m; td = tst.d; thh = tst.hour; tmm = tst.minute;
      }
      dayGZIdx = LC.dayGZ(ty, tm, td);
      dayGan = GAN.charAt(dayGZIdx % 10);
      kong = xunKong(dayGZIdx);
    } else {
      dayGZIdx = 0; dayGan = '甲'; kong = xunKong(0);
    }

    /* 装卦：纳甲 + 六亲 + 六神 + 世应 + 空亡 */
    var nj = naJia(ben.up, ben.low);
    var njB = hasBian ? naJia(bian.up, bian.low) : null;
    var shenStart = SHEN_START[dayGan] || 0;
    var yaoList = [];
    for (i=0;i<6;i++) {
      var zhi = nj[i].zhi, wx = ZHI_WX[zhi];
      var item = {
        pos: i + 1,                    /* 1=初爻 */
        name: ['初爻','二爻','三爻','四爻','五爻','上爻'][i],
        yao: benYao[i], old: !!tosses[i].old,
        gan: nj[i].gan, zhi: zhi, wuxing: wx,
        qin: liuQin(ben.gongWx, wx),
        shen: LIUSHEN[(shenStart + i) % 6],
        shi: (ben.shi === i + 1), ying: (ben.ying === i + 1),
        kong: kong.indexOf(zhi) >= 0
      };
      if (hasBian) {
        var zb = njB[i].zhi;
        item.bianZhi = zb;
        item.bianQin = liuQin(bian.gongWx, ZHI_WX[zb]);
      }
      yaoList.push(item);
    }

    /* 经文 */
    var text = (YJ[ben.up] && YJ[ben.up][ben.low]) ? YJ[ben.up][ben.low] : null;
    var textBian = (hasBian && YJ[bian.up] && YJ[bian.up][bian.low]) ? YJ[bian.up][bian.low] : null;

    return {
      method: opts.method || 'shake',
      tosses: tosses, yao: benYao, bianYao: bianYao, dong: dong,
      ben: ben, bian: hasBian ? bian : null, hasBian: hasBian,
      gang: { dayGZ: dayGZIdx === null ? '' : LC.gzName(dayGZIdx), dayGan: dayGan, kong: kong },
      lines: yaoList,
      text: text, textBian: textBian,
      question: opts.question || ''
    };
  }

  var API = { qi: qi, toss: toss, guaInfo: guaInfo, trigramsOf: trigramsOf, naJia: naJia,
              liuQin: liuQin, xunKong: xunKong, GONG_TABLE: GONG_TABLE, NAJIA: NAJIA, LIUSHEN: LIUSHEN,
              ZHI_WX: ZHI_WX, GONG_WX: GONG_WX };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.LiuYao = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
