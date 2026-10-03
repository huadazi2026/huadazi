/* ================= 大六壬起课引擎 =================
   规则依据：《六壬大全》卷一/卷二/卷七、《大六壬指南》卷一/卷二
   流程：月将加时 → 天地盘 → 四课 → 三传（九宗门）→ 十二天将 → 课体
   ==================== 对外：LiuRen.ke(opts) ==================== */
(function (root) {
  'use strict';
  var LC = root.LunarCore || (typeof require !== 'undefined' ? require('./calendar.js') : null);

  var GAN = '甲乙丙丁戊己庚辛壬癸';
  var ZHI = '子丑寅卯辰巳午未申酉戌亥';
  /* 十二地支五行：子水 丑土 寅木 卯木 辰土 巳火 午火 未土 申金 酉金 戌土 亥水 */
  var ZHI_WX = ['水','土','木','木','土','火','火','土','金','金','土','水'];
  /* 十天干五行：甲乙木 丙丁火 戊己土 庚辛金 壬癸水 */
  var GAN_WX = ['木','木','火','火','土','土','金','金','水','水'];

  var SHENG = { 木:'火', 火:'土', 土:'金', 金:'水', 水:'木' };   // 我生
  var KE = { 木:'土', 土:'水', 水:'火', 火:'金', 金:'木' };      // 我克
  function shengMe(w) { for (var k in SHENG) if (SHENG[k] === w) return k; return null; }
  function keMe(w) { for (var k in KE) if (KE[k] === w) return k; return null; }
  function isKe(a, b) { return KE[a] === b; }                    // a 克 b

  /* 十干寄宫：甲寅 乙辰 丙戊巳 丁己未 庚申 辛戌 壬亥 癸丑 */
  var JI_GONG = { 甲:2, 乙:4, 丙:5, 戊:5, 丁:7, 己:7, 庚:8, 辛:10, 壬:11, 癸:1 };
  /* 地支寄宫天干（涉害加计用；寄宫：寅甲 辰乙 巳丙戊 未丁己 申庚 戌辛 亥壬 丑癸） */
  var ZHI_JI_GAN = { 2:'甲', 4:'乙', 5:'丙', 7:'丁', 8:'庚', 10:'辛', 11:'壬', 1:'癸', 6:'己', 9:'戊' };

  /* 天乙贵人：昼（卯~申）/ 夜（酉~寅） */
  var GUI_REN = {
    甲:{day:1,  night:7},  乙:{day:0,  night:8},  丙:{day:11, night:9},  丁:{day:11, night:9},
    戊:{day:1,  night:7},  己:{day:0,  night:8},  庚:{day:1,  night:7},  辛:{day:6,  night:2},
    壬:{day:3,  night:5},  癸:{day:3,  night:5}
  };

  var JIANG = ['贵人','螣蛇','朱雀','六合','勾陈','青龙','天空','白虎','太常','玄武','太阴','天后'];
  var JIANG_INFO = {
    '贵人':{kind:'大吉',key:'尊长、上级、贵人、扶持、解厄',act:'找对人帮忙、走正规渠道、请教长辈；此路有人扶'},
    '螣蛇':{kind:'凶',key:'虚惊、怪异、缠绕、多疑、梦、火',act:'别自己吓自己，先把信息核实清楚再动'},
    '朱雀':{kind:'半凶',key:'文书、口舌、消息、争吵、考试、信息',act:'注意措辞，重要的事落到纸面；消息真伪要辨'},
    '六合':{kind:'吉',key:'合作、中介、婚姻、和合、暗中撮合',act:'找中间人牵线，谈合作成算高；感情上宜和不宜分'},
    '勾陈':{kind:'凶',key:'牵绊、迟滞、官司、田土、旧事、争斗',act:'别拖，先把纠缠的旧账理清；莫与人争一时长短'},
    '青龙':{kind:'大吉',key:'财喜、升迁、酒色、喜庆、正财',act:'主动出击求财求名，时机可用，宜正不宜偏'},
    '天空':{kind:'凶',key:'落空、虚耗、欺骗、空想、不成、小人',act:'先验证对方是否可靠，别先投入；防口惠而实不至'},
    '白虎':{kind:'大凶',key:'疾病、凶伤、道路、官非、强力、丧',act:'办事可强硬但别硬碰硬；注意身体与出行安全'},
    '太常':{kind:'吉',key:'酒食、衣禄、婚礼、宴会、平稳、文书',act:'请客吃饭走人情，稳中求进，宜守成不宜激进'},
    '玄武':{kind:'凶',key:'盗窃、暗昧、欺瞒、走失、暧昧、水',act:'防人之心不可无，别信口头承诺；财物看紧'},
    '太阴':{kind:'吉',key:'暗中相助、女性贵人、隐私、谋划、财',act:'低调运作，找女性长辈或同事帮忙，宜暗不宜明'},
    '天后':{kind:'吉',key:'女性、婚姻、恩泽、水事、情爱、恩惠',act:'从感情和人情入手，多听女性意见；宜柔不宜刚'}
  };

  /* 六亲（以日干为我） */
  function liuQin(dayGan, targetWx) {
    var my = GAN_WX[GAN.indexOf(dayGan)];
    if (my === targetWx) return '兄弟';
    if (SHENG[my] === targetWx) return '子孙';
    if (shengMe(my) === targetWx) return '父母';
    if (KE[my] === targetWx) return '妻财';
    if (keMe(my) === targetWx) return '官鬼';
    return '?';
  }

  /* 三刑 */
  var XING = { 0:3, 3:0, 2:5, 5:8, 8:2, 1:10, 10:7, 7:1, 4:4, 6:6, 9:9, 11:11 };
  function isZiXing(z) { return z === 4 || z === 6 || z === 9 || z === 11; }
  function chong(z) { return (z + 6) % 12; }
  function sanHeFront(z) { return (z + 4) % 12; }   // 三合前一位

  /* ---------- 天地盘：月将加占时 ---------- */
  function tianDiPan(yueJiangIdx, shiIdx) {
    var d = ((yueJiangIdx - shiIdx) % 12 + 12) % 12;
    var tp = [], dp = [];
    for (var i = 0; i < 12; i++) tp[i] = (i + d) % 12;   // tp[地盘宫] = 所乘天盘神
    for (var j = 0; j < 12; j++) dp[tp[j]] = j;          // dp[天盘神] = 所临地盘宫
    return { tp: tp, dp: dp, d: d, tian: tp, di: dp };
  }

  /* ---------- 四课 ---------- */
  function siKe(dayGan, dayZhiIdx, pan) {
    var ji = JI_GONG[dayGan];
    var u1 = pan.tp[ji], u2 = pan.tp[u1], u3 = pan.tp[dayZhiIdx], u4 = pan.tp[u3];
    return [
      { idx:1, name:'第一课', lowerName:dayGan, lowerZhi:ji, upperIdx:u1, upper:ZHI[u1],
        lowerWx:GAN_WX[GAN.indexOf(dayGan)], isGan:true },
      { idx:2, name:'第二课', lowerName:ZHI[u1], lowerZhi:u1, upperIdx:u2, upper:ZHI[u2],
        lowerWx:ZHI_WX[u1], isGan:true },
      { idx:3, name:'第三课', lowerName:ZHI[dayZhiIdx], lowerZhi:dayZhiIdx, upperIdx:u3, upper:ZHI[u3],
        lowerWx:ZHI_WX[dayZhiIdx], isZhi:true },
      { idx:4, name:'第四课', lowerName:ZHI[u3], lowerZhi:u3, upperIdx:u4, upper:ZHI[u4],
        lowerWx:ZHI_WX[u3], isZhi:true }
    ];
  }

  /* 逐课判定贼/克 */
  function keZei(ke) {
    var zei = [], kes = [];
    ke.forEach(function (k, i) {
      var upWx = ZHI_WX[k.upperIdx];
      if (isKe(k.lowerWx, upWx)) { zei.push(i); k.rel = 'zei'; }
      else if (isKe(upWx, k.lowerWx)) { kes.push(i); k.rel = 'ke'; }
      else k.rel = null;
    });
    return { zei: zei, kes: kes };
  }

  /* ---------- 比用 ---------- */
  function biYong(cands, ke, dayGanIdx) {
    var yang = dayGanIdx % 2 === 0;
    var same = cands.filter(function (i) { return ke[i].upperIdx % 2 === (yang ? 0 : 1); });
    if (same.length === 1) return { pick: same[0], type: 'zhiyi' };
    return { pick: null, cands: cands, same: same };
  }

  /* ---------- 涉害深浅 ---------- */
  function sheHai(cands, ke, pan, dayGanIdx, useJiGan) {
    function depth(i) {
      var S = ke[i].upperIdx;              // 上神
      var o = pan.dp[S];                   // 所临地盘宫
      var count = 0;
      var cur = (o + 1) % 12;
      while (cur !== S) {                  // 走到本家为止，本家不计
        var xw = ZHI_WX[cur];
        if (isKe(ZHI_WX[S], xw)) count++;  // 上神克地盘
        if (isKe(xw, ZHI_WX[S])) count++;  // 地盘克上神
        if (useJiGan !== false) {
          var g = ZHI_JI_GAN[cur];
          if (g) {
            var gw = GAN_WX[GAN.indexOf(g)];
            if (gw && gw !== xw) {
              if (isKe(ZHI_WX[S], gw)) count++;
              if (isKe(gw, ZHI_WX[S])) count++;
            }
          }
        }
        cur = (cur + 1) % 12;
        if (count > 100) break;
      }
      return count;
    }
    var scored = cands.map(function (i) { return { i: i, c: depth(i), land: pan.dp[ke[i].upperIdx] }; });
    var max = Math.max.apply(null, scored.map(function (x) { return x.c; }));
    var top = scored.filter(function (x) { return x.c === max; });
    if (top.length === 1) return { pick: top[0].i, type: 'shehai', depth: max };
    // 孟仲季：四孟(寅申巳亥) > 四仲(子午卯酉) > 四季(辰戌丑未)
    var MENG = [2, 8, 5, 11], ZHONG = [0, 6, 3, 9];
    var m = top.filter(function (x) { return MENG.indexOf(x.land) >= 0; });
    if (m.length === 1) return { pick: m[0].i, type: 'jianji', depth: max };
    var pool = m.length > 1 ? m : top.filter(function (x) { return ZHONG.indexOf(x.land) >= 0; });
    if (pool.length === 1) return { pick: pool[0].i, type: 'chawei', depth: max };
    // 复等（缀瑕）：阳日取干上神，阴日取支上神
    var pick = (dayGanIdx % 2 === 0) ? 0 : 2;
    return { pick: pick, type: 'zhuixia', depth: max };
  }

  /* ---------- 三传主逻辑 ---------- */
  function sanChuan(ke, dayGanIdx, dayZhiIdx, pan, opts) {
    opts = opts || {};
    var dayGan = GAN[dayGanIdx];
    var yang = dayGanIdx % 2 === 0;
    var d = pan.d;
    var kz = keZei(ke);
    var r = { method: '', body: '', note: '', chuan: null, detail: {} };

    function chuanByXiangYin(t1) {
      var t2 = pan.tp[t1], t3 = pan.tp[t2];
      return [t1, t2, t3];
    }
    function chuanByXing(t1) {
      var t2, t3;
      if (isZiXing(t1)) t2 = yang ? ke[2].upperIdx : ke[0].upperIdx;   // 阳日用支上，阴日用干上
      else t2 = XING[t1];
      if (isZiXing(t2)) t3 = chong(t2);
      else t3 = XING[t2];
      return [t1, t2, t3];
    }
    function pack(arr, method, body, note) {
      r.method = method; r.body = body; r.note = note || '';
      r.chuan = arr;
      return r;
    }

    /* 第1步：伏吟 */
    if (d === 0) {
      var hasK = kz.zei.length || kz.kes.length;
      var t1;
      if (hasK) {
        t1 = kz.zei.length ? ke[kz.zei[0]].upperIdx : ke[kz.kes[0]].upperIdx;
        return pack(chuanByXing(t1), '伏吟法', '伏吟课', '有克取克，中末以三刑递取');
      }
      t1 = yang ? ke[0].upperIdx : ke[2].upperIdx;
      return pack(chuanByXing(t1), '伏吟法', '伏吟课', yang ? '自任格（刚日取干上）' : '自信格（柔日取支上）');
    }
    /* 第2步：返吟 */
    if (d === 6) {
      var hasK2 = kz.zei.length || kz.kes.length;
      if (hasK2) {
        var pick2;
        if (kz.zei.length === 1) pick2 = kz.zei[0];
        else if (kz.zei.length === 0 && kz.kes.length === 1) pick2 = kz.kes[0];
        else {
          var cands2 = kz.zei.length ? kz.zei : kz.kes;
          var by2 = biYong(cands2, ke, dayGanIdx);
          pick2 = by2.pick !== null ? by2.pick : sheHai(cands2, ke, pan, dayGanIdx, opts.sheHaiJiGan).pick;
        }
        var t12 = ke[pick2].upperIdx;
        var arr2 = yang ? [t12, chong(t12), t12] : chuanByXiangYin(t12);
        return pack(arr2, '返吟法', '返吟课', yang ? '无亲（初末相同、冲乎中传）' : '无亲（相因法）');
      }
      var t13 = pan.tp[chong(dayZhiIdx)];
      return pack([t13, ke[2].upperIdx, ke[0].upperIdx], '返吟法', '井栏射课', '无克，支之冲宫上神发用');
    }
    /* 第3步：八专 */
    if (JI_GONG[dayGan] === dayZhiIdx) {
      var hasK3 = kz.zei.length || kz.kes.length;
      if (hasK3) {
        var pick3;
        if (kz.zei.length === 1) pick3 = kz.zei[0];
        else if (!kz.zei.length && kz.kes.length === 1) pick3 = kz.kes[0];
        else {
          var cands3 = kz.zei.length ? kz.zei : kz.kes;
          var by3 = biYong(cands3, ke, dayGanIdx);
          pick3 = by3.pick !== null ? by3.pick : sheHai(cands3, ke, pan, dayGanIdx, opts.sheHaiJiGan).pick;
        }
        var t14 = ke[pick3].upperIdx;
        return pack([t14, ke[0].upperIdx, ke[0].upperIdx], '八专法', '八专课', '有克取克，中末皆取干上神');
      }
      var t15 = yang ? (ke[0].upperIdx + 2) % 12 : ((ke[2].upperIdx - 2) % 12 + 12) % 12;
      return pack([t15, ke[0].upperIdx, ke[0].upperIdx], '八专法', '八专课',
        yang ? '阳日干上顺数三位，中末皆干上神' : '阴日支上逆数三位，中末皆干上神');
    }
    /* 第4步：贼克 */
    if (kz.zei.length === 1) {
      return pack(chuanByXiangYin(ke[kz.zei[0]].upperIdx), '贼克法', '重审课', '一下贼上');
    }
    if (!kz.zei.length && kz.kes.length === 1) {
      return pack(chuanByXiangYin(ke[kz.kes[0]].upperIdx), '贼克法', '元首课', '一上克下');
    }
    /* 第5–6步：比用 / 涉害 */
    if (kz.zei.length || kz.kes.length) {
      var cands = kz.zei.length ? kz.zei : kz.kes;
      var rel = kz.zei.length ? 'zei' : 'ke';
      var by = biYong(cands, ke, dayGanIdx);
      if (by.pick !== null) {
        return pack(chuanByXiangYin(ke[by.pick].upperIdx), '比用法', '知一课',
          rel === 'zei' ? '多贼取与日干比者' : '多克取与日干比者');
      }
      var sh = sheHai(cands, ke, pan, dayGanIdx, opts.sheHaiJiGan);
      var body = sh.type === 'jianji' ? '见机课' : (sh.type === 'chawei' ? '察微课' : (sh.type === 'zhuixia' ? '缀瑕课' : '涉害课'));
      return pack(chuanByXiangYin(ke[sh.pick].upperIdx), '涉害法', body,
        '涉害深浅相等，以孟仲季取舍（涉害深度 ' + sh.depth + '）');
    }
    /* 第7步：遥克 */
    var myWx = GAN_WX[dayGanIdx];
    var candIdx = [1, 2, 3];
    var shenKeRi = candIdx.filter(function (i) { return isKe(ZHI_WX[ke[i].upperIdx], myWx); });
    var riKeShen = candIdx.filter(function (i) { return isKe(myWx, ZHI_WX[ke[i].upperIdx]); });
    if (shenKeRi.length) {
      var pickY;
      if (shenKeRi.length === 1) pickY = shenKeRi[0];
      else {
        var byY = biYong(shenKeRi, ke, dayGanIdx);
        pickY = byY.pick !== null ? byY.pick : sheHai(shenKeRi, ke, pan, dayGanIdx, opts.sheHaiJiGan).pick;
      }
      return pack(chuanByXiangYin(ke[pickY].upperIdx), '遥克法', '蒿矢课', '神遥克日');
    }
    if (riKeShen.length) {
      var pickY2;
      if (riKeShen.length === 1) pickY2 = riKeShen[0];
      else {
        var byY2 = biYong(riKeShen, ke, dayGanIdx);
        pickY2 = byY2.pick !== null ? byY2.pick : sheHai(riKeShen, ke, pan, dayGanIdx, opts.sheHaiJiGan).pick;
      }
      return pack(chuanByXiangYin(ke[pickY2].upperIdx), '遥克法', '弹射课', '日遥克神');
    }
    /* 第8步：昴星 / 别责 */
    var uppers = [ke[0].upperIdx, ke[1].upperIdx, ke[2].upperIdx, ke[3].upperIdx];
    var distinct = uppers.filter(function (v, i, a) { return a.indexOf(v) === i; }).length;
    if (distinct === 4) {
      var t1m = yang ? pan.tp[9] : pan.tp[pan.dp[9]];
      var mid = yang ? ke[2].upperIdx : ke[0].upperIdx;
      var last = yang ? ke[0].upperIdx : ke[2].upperIdx;
      return pack([t1m, mid, last], '昴星法', '昴星课', yang ? '虎视格（阳日取天盘酉上神）' : '冬蛇掩目格（阴日取地盘酉上神）');
    }
    var t1b;
    if (yang) {
      var heGan = (dayGanIdx + 5) % 10;
      t1b = pan.tp[JI_GONG[GAN[heGan]]];
    } else {
      t1b = pan.tp[sanHeFront(dayZhiIdx)];
    }
    return pack([t1b, ke[0].upperIdx, ke[0].upperIdx], '别责法', '别责课',
      yang ? '刚日取干合寄宫上神，中末干上' : '柔日取支三合前一位上神，中末干上');
  }

  /* ---------- 十二天将 ---------- */
  function tianJiang(dayGan, hourZhiIdx, pan, opts) {
    opts = opts || {};
    var g = GUI_REN[dayGan];
    var isDay = hourZhiIdx >= 3 && hourZhiIdx <= 8;      // 卯~申为昼
    var guiZhi = isDay ? g.day : g.night;
    var o = pan.dp[guiZhi];                              // 天盘贵人所压地盘宫
    var moved = false;
    if (opts.moveChenXu !== false) {
      if (o === 4) { o = 8; moved = true; }              // 临辰用申（冲）
      if (o === 10) { o = 2; moved = true; }             // 临戌用寅（冲）
    }
    var forward = [11, 0, 1, 2, 3, 4].indexOf(o) >= 0;   // 亥子丑寅卯辰顺治
    var arr = [];
    for (var i = 0; i < 12; i++) {
      var pos = forward ? (o + i) % 12 : ((o - i) % 12 + 12) % 12;
      arr[pos] = { name: JIANG[i], seq: i };
    }
    return { byPos: arr, guiZhi: ZHI[guiZhi], guiZhiIdx: guiZhi, guiPos: o, guiPosName: ZHI[o],
             forward: forward, isDay: isDay, moved: moved };
  }

  /* ---------- 课体说明 ---------- */
  var KE_BODY_INFO = {
    '元首课':{key:'一上克下，事由上临下、尊长或外因主导',advice:'顺规矩走、按对方节奏办，别硬顶；此事有人推着走，成事在“顺势”。'},
    '重审课':{key:'一下贼上，事由内部/下位发起',advice:'根子在下边，先查内部与细节；谋事宜静守待时，别急着表态。'},
    '知一课':{key:'同阴阳相争，两事并起',advice:'眼下有两件差不多的事在拉扯，先挑一件做，别脚踏两条船。'},
    '涉害课':{key:'牵连深、麻烦多，动则有阻',advice:'这事牵扯的人事太深，先做减法，把不必要的牵扯切断再动。'},
    '见机课':{key:'同类相争而取孟上，机在先手',advice:'机会在前面，谁先动谁占先；当机立断，不要等。'},
    '察微课':{key:'取仲上发用，宜察细微',advice:'答案在细节里，先把小处看清再决定，别被大方向迷惑。'},
    '缀瑕课':{key:'复等取用，事有两难',advice:'两边差不多，别再权衡；按“对自己更有利”的那条走。'},
    '蒿矢课':{key:'神遥克日，外来之克但力弱',advice:'压力来自远处、未必真落到头上；不必过虑，防着点即可。'},
    '弹射课':{key:'日遥克神，我攻彼而力有不及',advice:'你想动对方但力道不足；先把资源备足再出手。'},
    '昴星课':{key:'无克无遥，静中生动、悬而未决',advice:'没人主动推，得你自己定调；宜守不宜攻，等一个明确信号。'},
    '别责课':{key:'四课不全，事有缺、信息不完整',advice:'别只看表面，缺的那块信息才是关键；找第三方意见再定。'},
    '八专课':{key:'干支同位，事由己出、自顾自',advice:'主动权在你手上，别指望别人；专心做一件事，别铺太开。'},
    '伏吟课':{key:'天地盘重叠，事停滞、原地打转',advice:'不要硬推，越推越堵；宜守旧、宜等待、宜修内功。'},
    '返吟课':{key:'天地盘对冲，翻覆反复、来回跑',advice:'事情会反复，别一次定死；留退路，做好两手准备。'},
    '井栏射课':{key:'返吟无克，动荡中取冲宫发用',advice:'局面反复但已有定数；把退路留好，反着补一手反而成。'}
  };

  /* ============ 主函数 ============ */
  function ke(opts) {
    var y = opts.year, m = opts.month, d = opts.day, hh = opts.hour, mm = opts.minute || 0;
    var useTrueSolar = !!opts.trueSolar, lng = opts.longitude;
    var ty = y, tm = m, td = d, thh = hh, tmm = mm, tst = null;
    if (useTrueSolar && typeof lng === 'number') {
      tst = LC.trueSolarTime(y, m, d, hh, mm, lng, opts.useEoT !== false);
      ty = tst.y; tm = tst.m; td = tst.d; thh = tst.hour; tmm = tst.minute;
    }
    var curMs = Date.UTC(ty, tm - 1, td, thh, tmm);
    var lichunMs = LC.termMs(ty, 2);
    var gzYear = (lichunMs !== null && curMs < lichunMs) ? ty - 1 : ty;
    var yGZ = LC.yearGZ(gzYear);

    var yj = LC.yueJiang(ty, tm, td, thh, tmm);
    var ml = LC.monthLing(ty, tm, td, thh, tmm);
    var hourZhiIdx = LC.hourZhiOf(thh);
    var dayGzIdx = LC.dayGZ(ty, tm, td);
    var dayGanIdx = dayGzIdx % 10, dayZhiIdx = dayGzIdx % 12;
    var dayGan = GAN[dayGanIdx];
    var hourGanIdx = LC.hourGZ(dayGzIdx, hourZhiIdx);

    var pan = tianDiPan(ZHI.indexOf(yj.zhi), hourZhiIdx);
    var ke4 = siKe(dayGan, dayZhiIdx, pan);
    var sc = sanChuan(ke4, dayGanIdx, dayZhiIdx, pan, opts);
    var jiang = tianJiang(dayGan, hourZhiIdx, pan, opts);
    var kong = LC.xunKong(dayGzIdx);

    var chuan = sc.chuan.map(function (z, i) {
      var j = jiang.byPos[pan.dp[z]];
      return {
        idx: i + 1, name: ['初传','中传','末传'][i], zhiIdx: z, zhi: ZHI[z], wx: ZHI_WX[z],
        tianJiang: j ? j.name : '', tianJiangInfo: j ? JIANG_INFO[j.name] : null,
        liuQin: liuQin(dayGan, ZHI_WX[z]), isKong: kong.indexOf(ZHI[z]) >= 0,
        diPanPos: ZHI[pan.dp[z]], diPanIdx: pan.dp[z],
        dunGan: null
      };
    });

    var keTable = ke4.map(function (k) {
      var j = jiang.byPos[pan.dp[k.upperIdx]];
      var wx = ZHI_WX[k.upperIdx];
      return {
        idx: k.idx, name: k.name, lower: k.lowerName, upper: k.upper,
        upperIdx: k.upperIdx, lowerWx: k.lowerWx, upperWx: wx,
        rel: k.rel === 'zei' ? '下贼上' : (k.rel === 'ke' ? '上克下' : ''),
        tianJiang: j ? j.name : '', liuQin: liuQin(dayGan, wx),
        isKong: kong.indexOf(k.upper) >= 0
      };
    });

    var bodyInfo = KE_BODY_INFO[sc.body] || { key: '', advice: '' };
    var dayYang = dayGanIdx % 2 === 0;

    return {
      input: { y: y, m: m, d: d, hh: hh, mm: mm },
      time: { y: ty, m: tm, d: td, hh: thh, mm: tmm },
      trueSolar: tst,
      ganZhiYear: gzYear, yearGZ: GAN[yGZ % 10] + ZHI[yGZ % 12],
      monthLing: { zhi: ml.zhi, ganZhi: LC.monthGZ(yGZ % 10, ml.idx).text },
      yueJiang: yj,
      dayGZ: dayGan + ZHI[dayZhiIdx], dayGan: dayGan, dayZhi: ZHI[dayZhiIdx],
      dayGanIdx: dayGanIdx, dayZhiIdx: dayZhiIdx, dayYang: dayYang,
      hourGZ: GAN[hourGanIdx] + ZHI[hourZhiIdx], hourZhiIdx: hourZhiIdx, hourZhi: ZHI[hourZhiIdx],
      xunKong: kong,
      pan: pan, siKe: keTable, sanChuan: chuan,
      method: sc.method, body: sc.body, bodyNote: sc.note, bodyInfo: bodyInfo,
      jiang: jiang,
      liuQin: { dayGan: dayGan, myWx: GAN_WX[dayGanIdx] },
      jiGong: ZHI[JI_GONG[dayGan]]
    };
  }

  var API = {
    ke: ke, tianDiPan: tianDiPan, siKe: siKe, sanChuan: sanChuan, tianJiang: tianJiang,
    JIANG: JIANG, JIANG_INFO: JIANG_INFO, KE_BODY_INFO: KE_BODY_INFO,
    GUI_REN: GUI_REN, JI_GONG: JI_GONG, ZHI_WX: ZHI_WX, GAN_WX: GAN_WX,
    SHENG: SHENG, KE: KE, isKe: isKe, shengMe: shengMe, keMe: keMe,
    ZHI: ZHI, GAN: GAN, liuQin: liuQin, XING: XING, isZiXing: isZiXing, chong: chong
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.LiuRen = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
