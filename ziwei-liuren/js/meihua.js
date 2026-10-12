/* ================= 梅花易数起卦与断卦引擎 =================
   起卦法（都用先天八卦数：乾1 兑2 离3 震4 巽5 坎6 艮7 坤8）
     ① 时间卦：上卦 =(年支+月+日) mod 8；下卦 =(年支+月+日+时支) mod 8；动爻 =(年支+月+日+时支) mod 6
     ② 数字卦：三个数 a b c → 上卦 a mod 8、下卦 b mod 8、动爻 c mod 6（两个数时动爻取两数之和）
     ③ 随机卦：摇三个数，同上
   断卦：以动爻所在之卦为「用」，另一卦为「体」；看体用五行生克定吉凶；
        再参互卦（事情中间过程）、变卦（结果）、以及卦名卦象。
   ==================== 对外：MeiHua.qi(opts) ==================== */
(function (root) {
  'use strict';
  var LC = root.LunarCore || (typeof require !== 'undefined' ? require('./calendar.js') : null);

  var ZHI = '子丑寅卯辰巳午未申酉戌亥';

  /* 先天八卦：数 → 卦 */
  var TRIGRAM = {
    1: { name:'乾', symbol:'☰', nature:'天', wuxing:'金', dir:'西北', duan:'刚健、领导、决断、长辈、权势' },
    2: { name:'兑', symbol:'☱', nature:'泽', wuxing:'金', dir:'西',   duan:'喜悦、口才、少女、谈判、娱乐' },
    3: { name:'离', symbol:'☲', nature:'火', wuxing:'火', dir:'南',   duan:'光明、文书、聪明、中女、显名' },
    4: { name:'震', symbol:'☳', nature:'雷', wuxing:'木', dir:'东',   duan:'震动、行动、突发、长子、变动' },
    5: { name:'巽', symbol:'☴', nature:'风', wuxing:'木', dir:'东南', duan:'顺入、传播、长女、反复、犹豫' },
    6: { name:'坎', symbol:'☵', nature:'水', wuxing:'水', dir:'北',   duan:'险陷、智慧、流动、中男、暗中' },
    7: { name:'艮', symbol:'☶', nature:'山', wuxing:'土', dir:'东北', duan:'止住、阻隔、少男、沉淀、等待' },
    8: { name:'坤', symbol:'☷', nature:'地', wuxing:'土', dir:'西南', duan:'柔顺、承载、众多、母亲、耐心' }
  };
  var SHENG = { '木':'火', '火':'土', '土':'金', '金':'水', '水':'木' };   // 我生
  var KE    = { '木':'土', '土':'水', '水':'火', '火':'金', '金':'木' };   // 我克

  /* 六十四卦名：[上卦][下卦] */
  var HEX = {
    '乾': { '乾':'乾为天', '兑':'天泽履', '离':'天火同人', '震':'天雷无妄', '巽':'天风姤', '坎':'天水讼', '艮':'天山遁', '坤':'天地否' },
    '兑': { '乾':'泽天夬', '兑':'兑为泽', '离':'泽火革', '震':'泽雷随', '巽':'泽风大过', '坎':'泽水困', '艮':'泽山咸', '坤':'泽地萃' },
    '离': { '乾':'火天大有', '兑':'火泽睽', '离':'离为火', '震':'火雷噬嗑', '巽':'火风鼎', '坎':'火水未济', '艮':'火山旅', '坤':'火地晋' },
    '震': { '乾':'雷天大壮', '兑':'雷泽归妹', '离':'雷火丰', '震':'震为雷', '巽':'雷风恒', '坎':'雷水解', '艮':'雷山小过', '坤':'雷地豫' },
    '巽': { '乾':'风天小畜', '兑':'风泽中孚', '离':'风火家人', '震':'风雷益', '巽':'巽为风', '坎':'风水涣', '艮':'风山渐', '坤':'风地观' },
    '坎': { '乾':'水天需', '兑':'水泽节', '离':'水火既济', '震':'水雷屯', '巽':'水风井', '坎':'坎为水', '艮':'水山蹇', '坤':'水地比' },
    '艮': { '乾':'山天大畜', '兑':'山泽损', '离':'山火贲', '震':'山雷颐', '巽':'山风蛊', '坎':'山水蒙', '艮':'艮为山', '坤':'山地剥' },
    '坤': { '乾':'地天泰', '兑':'地泽临', '离':'地火明夷', '震':'地雷复', '巽':'地风升', '坎':'地水师', '艮':'地山谦', '坤':'坤为地' }
  };

  /* 六十四卦简断（只说核心意思，够用） */
  var HEX_MEAN = {
    '乾为天':'刚健有为，宜主动出击，但过刚易折', '坤为地':'厚德载物，宜守成配合，不宜争先',
    '水雷屯':'起步艰难，先积蓄力量', '山水蒙':'信息不足，先请教明白人',
    '水天需':'时机未到，等待是必要的', '天水讼':'有争执，退一步更好',
    '地水师':'要用人、要组织，单打独斗不成', '水地比':'亲近合作，找对人就顺',
    '风天小畜':'小有积蓄，力量还不足', '天泽履':'谨慎前行，按规矩来',
    '地天泰':'上下通畅，正是好时候', '天地否':'上下不通，暂时闭塞',
    '天火同人':'同心协力，合作有利', '火天大有':'收获颇丰，守住成果',
    '地山谦':'谦逊低调最有利', '雷地豫':'顺势而动，也要防松懈',
    '泽雷随':'随机应变，跟随形势', '山风蛊':'积弊要治，先清理旧账',
    '地泽临':'亲自到场，近处着手', '风地观':'先看清楚再动',
    '火雷噬嗑':'有硬骨头要啃，需强硬手段', '山火贲':'重包装形式，实质需看清',
    '山地剥':'剥落衰退，宜止损保守', '地雷复':'一阳来复，转机刚起',
    '天雷无妄':'守正自然，别乱来', '山天大畜':'蓄势待发，先积累再动',
    '山雷颐':'养精蓄锐，注意身体与口舌', '泽风大过':'负担过重，需要非常手段',
    '坎为水':'险中求存，须谨慎', '离为火':'光明显达，但谨防过旺',
    '泽山咸':'感应相通，感情事有利', '雷风恒':'持之以恒，不宜变动',
    '天山遁':'该退就退，保存实力', '雷天大壮':'气势正盛，但不可妄动',
    '火地晋':'晋升前进，向上发展', '地火明夷':'光明受伤，宜韬光养晦',
    '风火家人':'家和万事兴，内部先理顺', '火泽睽':'意见分歧，求同存异',
    '水山蹇':'前有险阻，绕行或等待', '雷水解':'困难化解，事有转机',
    '山泽损':'有失才有得，先减后加', '风雷益':'受益增益，宜进取',
    '泽天夬':'果断决断，清除障碍', '天风姤':'意外相遇，需防小人',
    '泽地萃':'聚集人才资源，宜开会商谈', '地风升':'稳步上升，循序渐进',
    '泽水困':'受困受限，宜守不宜攻', '水风井':'资源在深处，需耐心汲取',
    '泽火革':'必须改革变动', '火风鼎':'革新成功，格局更新',
    '震为雷':'震动突变，先惊后定', '艮为山':'止而静，暂停为上',
    '风山渐':'循序渐进，慢慢来', '雷泽归妹':'关系错位，慎谈婚嫁',
    '雷火丰':'盛大丰满，盛极需防衰', '火山旅':'漂泊在外，不宜久留',
    '巽为风':'顺势渗透，反复无定', '兑为泽':'喜悦和睦，口舌得利',
    '风水涣':'涣散离散，宜聚拢人心', '水泽节':'节制有度，别过度',
    '风泽中孚':'诚信为本，诚则灵', '雷山小过':'小有过越，宜小事不宜大事',
    '水火既济':'已成之局，守成为主', '火水未济':'未完成，仍在途中'
  };

  function mod(n, m) { return ((n % m) + m) % m; }
  function tri(n) { return TRIGRAM[mod(n - 1, 8) + 1]; }
  function wuxingOf(name) {
    for (var k in TRIGRAM) if (TRIGRAM[k].name === name) return TRIGRAM[k].wuxing;
    return '';
  }
  /* 两个卦的五行关系：以「体」为我的立场 */
  function relation(ti, yong) {
    var a = wuxingOf(ti), b = wuxingOf(yong);
    if (a === b) return { key:'比和', text:'体用比和（' + a + '与' + b + '同）', luck:'吉', score:78,
      note:'同气相求，事情顺，同伴、同业、同门能帮上忙，进展平稳。' };
    if (SHENG[a] === b) return { key:'体生用', text:'体生用（' + a + '生' + b + '）', luck:'小凶', score:45,
      note:'你在往外付出——费力、费钱、费心，容易为人作嫁。要么收回投入，要么把付出换成明确的回报条件。' };
    if (SHENG[b] === a) return { key:'用生体', text:'用生体（' + b + '生' + a + '）', luck:'大吉', score:88,
      note:'外力来助你，机会、贵人、资源主动找上门，这段时间宜进取、宜开口要资源。' };
    if (KE[a] === b) return { key:'体克用', text:'体克用（' + a + '克' + b + '）', luck:'吉', score:72,
      note:'你能压得住局面，事情在你掌控中，但要付出力气去"拿下"，宜主动但需持续投入。' };
    return { key:'用克体', text:'用克体（' + b + '克' + a + '）', luck:'凶', score:30,
      note:'外部压力压着你，对方占上风。宜守、宜退、宜先避其锋，硬碰硬要吃亏。' };
  }
  function hexName(up, low) { return (HEX[up] && HEX[up][low]) || (up + '上' + low + '下'); }
  function hexMean(name) { return HEX_MEAN[name] || ''; }
  /* 互卦：本卦 2-3-4 爻为下卦（下互），3-4-5 爻为上卦（上互）
     《梅花易數》卷三《體用互變之訣》：「如體在上，則上互為體之互，下互為用之互；
     體卦在下，則下互為體之互，上互為用之互。體互最緊，用互次之。」
     又《互卦起例》：「乾坤無互，互其變卦。」——乾坤两卦的互卦仍是自身，
     无「中间之应」，故改取其变卦充当互卦之用。 */
  function huGua(upperTrigram, lowerTrigram, opts) {
    opts = opts || {};
    var lines = lowerLines(lowerTrigram).concat(upperLines(upperTrigram));   // 1..6 爻，从下往上
    var low = linesToTrigram([lines[1], lines[2], lines[3]]);   /* 2-3-4 → 下互 */
    var up  = linesToTrigram([lines[2], lines[3], lines[4]]);   /* 3-4-5 → 上互 */
    var noHu = (up.name === upperTrigram && low.name === lowerTrigram);   /* 乾坤：互卦即自身 */
    var r = { up: up.name, low: low.name, noHu: noHu };
    /* 乾坤无互 → 互其变卦（用变卦的上下卦充当上下互） */
    if (noHu && opts.bianUp) {
      r.up = opts.bianUp; r.low = opts.bianLow;
      r.note = '乾坤無互，互其變卦 —— 本卦为纯卦，互卦仍是自身，故改取其变卦充当互卦（' +
               opts.bianUp + '上' + opts.bianLow + '下）';
    }
    /* 体互／用互：体在上则上互为体互；体在下则下互为体互 */
    if (opts.tiInUpper != null) {
      r.tiHu = opts.tiInUpper ? up.name : low.name;      /* 体之互（最紧） */
      r.yongHu = opts.tiInUpper ? low.name : up.name;    /* 用之互（次之） */
    }
    return r;
  }
  /* 八卦三爻（从下往上）：阳=1 阴=0 */
  var LINES = { '乾':[1,1,1], '兑':[1,1,0], '离':[1,0,1], '震':[1,0,0],
                '巽':[0,1,1], '坎':[0,1,0], '艮':[0,0,1], '坤':[0,0,0] };
  function lowerLines(n){ return LINES[n].slice(); }
  function upperLines(n){ return LINES[n].slice(); }
  function linesToTrigram(l) {
    for (var k in LINES) {
      if (LINES[k][0] === l[0] && LINES[k][1] === l[1] && LINES[k][2] === l[2]) return TRIGRAM[Object.keys(TRIGRAM).filter(function(i){ return TRIGRAM[i].name === k; })[0]];
    }
    return TRIGRAM[1];
  }
  /* 变卦：动爻变爻（1-6，从下往上） */
  function bianGua(upperTrigram, lowerTrigram, dong) {
    var lines = lowerLines(lowerTrigram).concat(upperLines(upperTrigram));
    lines[dong - 1] = lines[dong - 1] ? 0 : 1;
    var low = linesToTrigram([lines[0], lines[1], lines[2]]);
    var up  = linesToTrigram([lines[3], lines[4], lines[5]]);
    return { up: up.name, low: low.name };
  }

  /* 主入口：
     opts = { method:'time'|'num'|'random', nums:[a,b,c], question,
              year, month, day, hour, minute, trueSolar, longitude }  */
  function qi(opts) {
    opts = opts || {};
    var method = opts.method || 'time';
    var used = {}, desc = '';

    if (method === 'num' || method === 'random') {
      var nums = opts.nums || [];
      var a = Math.abs(parseInt(nums[0], 10) || 0);
      var b = Math.abs(parseInt(nums[1], 10) || 0);
      var c = (nums[2] == null || nums[2] === '') ? (a + b) : Math.abs(parseInt(nums[2], 10) || 0);
      if (!a || !b) throw new Error('请填两个以上的数字');
      used = { method: method, nums:[a, b, c] };
      desc = (method === 'random' ? '摇卦得数 ' : '报数 ') + a + '、' + b + (nums[2] == null || nums[2] === '' ? '（动爻取两数之和 ' + c + '）' : '、' + c);
      return build(tri(a), tri(b), mod(c - 1, 6) + 1, opts, used, desc);
    }

    /* 时间卦：年支数 + 农历月 + 农历日 + 时支数 */
    var lng = opts.longitude, useTS = opts.trueSolar && typeof lng === 'number';
    var ty = opts.year, tm = opts.month, td = opts.day, thh = opts.hour, tmm = opts.minute || 0, tst = null;
    if (useTS && LC) {
      tst = LC.trueSolarTime(opts.year, opts.month, opts.day, opts.hour, opts.minute || 0, lng, opts.useEoT !== false);
      ty = tst.y; tm = tst.m; td = tst.d; thh = tst.hour; tmm = tst.minute;
    }
    var lunar = LC.solarToLunar(ty, tm, td);
    if (!lunar) throw new Error('日期超出农历数据范围（1900-01-31 ~ 2100-12-31）');
    var yearZhiIdx = ((LC.yearGZ(ty) - 4) % 12 + 12) % 12;      // 年支序号 子=0
    var shiIdx = LC.hourZhiOf(thh);
    var nian = yearZhiIdx + 1, yue = lunar.m, ri = lunar.d, shi = shiIdx + 1;
    var s1 = nian + yue + ri;                 // 上卦用
    var s2 = s1 + shi;                        // 下卦与动爻用
    used = { method:'time', nian:nian, yue:yue, ri:ri, shi:shi, s1:s1, s2:s2,
             lunar: lunar, yearZhi: ZHI.charAt(yearZhiIdx), shiZhi: ZHI.charAt(shiIdx),
             trueSolar: tst, clock:{ hh: thh, mm: tmm } };
    desc = '时间卦：年支' + ZHI.charAt(yearZhiIdx) + '(' + nian + ') + 农历' + yue + '月 + ' + ri + '日 = ' +
           s1 + ' → 上卦；再加' + ZHI.charAt(shiIdx) + '时(' + shi + ') = ' + s2 + ' → 下卦、动爻';
    return build(tri(s1), tri(s2), mod(s2 - 1, 6) + 1, opts, used, desc);
  }

  /* ================= 外应 / 十应 ===================
     《梅花易數》卷二《內外論》：「凡占卜，體用為內，諸應卦為外卦…必合內外卦而斷之也。
       苟不知合內外卦為斷，謂體用自體用，三要十應自三要十應，如此則鮮見其有驗者。」
     《十應目論》：「十應並以體卦為主…內卦不吉而外卦又吉，可以解其不吉；
       內卦吉而外卦不吉，反破其吉。」
     故：外应卦对体卦「生／比和」→ 助；「克」→ 破；「体生外应」→ 泄（也非吉）。
     注意《十應奧論》的反转：同一样东西对不同体卦吉凶相反 ——
       见金（乾兑）遇震巽体则克木为凶，遇坎体则生水为吉；见少男（艮）遇坎体则土克水为凶。 */
  var WAI_YING = {
    老父:   { gua:'乾', cat:'人事应', note:'老人、长者、领导、公门中人' },
    老母:   { gua:'坤', cat:'人事应', note:'老妇、母亲、众人、农夫' },
    少女:   { gua:'兑', cat:'人事应', note:'少女、歌女、口才好的人' },
    少男:   { gua:'艮', cat:'人事应', note:'少男、闲人、山中人' },
    中女:   { gua:'离', cat:'人事应', note:'中女、文人、目疾之人' },
    中男:   { gua:'坎', cat:'人事应', note:'中男、江湖人、舟人' },
    长男:   { gua:'震', cat:'人事应', note:'长男、司机、行动的人' },
    长女:   { gua:'巽', cat:'人事应', note:'长女、秀士、山林修道之人' },
    西北方: { gua:'乾', cat:'方应', note:'西北方（乾位）' },
    西方:   { gua:'兑', cat:'方应', note:'西方（兑位）' },
    南方:   { gua:'离', cat:'方应', note:'南方（离位）' },
    东方:   { gua:'震', cat:'方应', note:'东方（震位）' },
    东南方: { gua:'巽', cat:'方应', note:'东南方（巽位）' },
    北方:   { gua:'坎', cat:'方应', note:'北方（坎位）' },
    东北方: { gua:'艮', cat:'方应', note:'东北方（艮位）' },
    西南方: { gua:'坤', cat:'方应', note:'西南方（坤位）' },
    金玉圆物: { gua:'乾', cat:'外应', note:'金玉、宝珠、圆物、冠镜、刚物' },
    刀剑锐器: { gua:'兑', cat:'外应', note:'金刃、刀剑、乐器、缺器、废器' },
    火与文书: { gua:'离', cat:'外应', note:'火、书文、干戈、甲胄、赤色之物' },
    竹木花草: { gua:'震', cat:'外应', note:'竹木、花草、乐器（竹木者）、鲜嫩之物' },
    长物绳索: { gua:'巽', cat:'外应', note:'长物、绳、直木、工巧之器、香气' },
    水与酒器: { gua:'坎', cat:'外应', note:'水、酒器、带核之物、弓轮、鱼豕' },
    土石瓜果: { gua:'艮', cat:'外应', note:'土石、瓜果、黄土、虎狗鼠' },
    布帛五谷: { gua:'坤', cat:'外应', note:'方物、布帛、丝绵、五谷、瓦器、牛' },
    晴:     { gua:'离', cat:'天时应', note:'晴天（离为日）' },
    雨雪:   { gua:'坎', cat:'天时应', note:'雨、雪、霜、露（坎为水）' },
    风:     { gua:'巽', cat:'天时应', note:'风（巽为风）' },
    雷:     { gua:'震', cat:'天时应', note:'雷（震为雷）' },
    云阴:   { gua:'坤', cat:'天时应', note:'云阴、雾气（坤为地）' },
    云雾山岚:{ gua:'艮', cat:'天时应', note:'云雾、山岚（艮为山）' },
    江河溪涧:{ gua:'坎', cat:'地理应', note:'江河、溪涧、泉井、卑湿之地' },
    竹林草木:{ gua:'震', cat:'地理应', note:'竹林、树木茂盛之所' },
    花果菜园:{ gua:'巽', cat:'地理应', note:'花果菜园、草木茂秀之所' },
    窑灶炉火:{ gua:'离', cat:'地理应', note:'窑灶、炉冶之所、向阳之地' },
    五金之处:{ gua:'乾', cat:'地理应', note:'形胜之地、大郡、高亢之所' },
    田野平地:{ gua:'坤', cat:'地理应', note:'田野、乡里、平地' },
    山径丘陵:{ gua:'艮', cat:'地理应', note:'山径、丘陵、坟墓' },
    泽水废井:{ gua:'兑', cat:'地理应', note:'泽、水际、缺池、废井' }
  };

  /* 真生真克之分（《梅花易數》卷三《體用生克之訣》）
     「乾、兌之金為體，見火則克，然有真火之體，有火之形色。真火能克金，形色則不能克。
       爐中火、窯灶之火、烈焰巨炷，真火也，遇之不吉；若色之紅紫、形之中虛…非真火也，不為深忌。
       又震、巽之木體遇金則克，然釵釧之金、金鉑、成錠之銀、杯盤之銀、器之錫、瑣屑之鋼鐵皆金也，
       此等之金豈能克木？木之所忌者，快刀銳刃、巨斧大鋸。」 */
  var ZHEN_KE = {
    真火:   { gua:'离', zhen:true,  cat:'真生真克', note:'爐中火、窯灶之火、烈焰巨炷 —— 真火，能克金' },
    火之形色:{ gua:'离', zhen:false, cat:'真生真克', note:'紅紫色、中虛之形、日火 —— 非真火，不為深忌' },
    快刀锐刃:{ gua:'兑', zhen:true,  cat:'真生真克', note:'快刀、銳刃、巨斧、大鋸 —— 真金，能克木' },
    琐屑之金:{ gua:'兑', zhen:false, cat:'真生真克', note:'釵釧、金鉑、成錠之銀、錫器、瑣屑鋼鐵 —— 不能克木' }
  };

  function trigramWx(name) {
    for (var k in TRIGRAM) if (TRIGRAM[k].name === name) return TRIGRAM[k].wuxing;
    return '';
  }

  /* 计算外应对体卦的作用（以体卦为主）*/
  function waiYing(keys, tiTriName) {
    var out = { items: [], score: 0, helps: [], breaks: [], notes: [] };
    if (!keys || !keys.length) return out;
    var tiWx = trigramWx(tiTriName);
    keys.forEach(function(k){
      var it = WAI_YING[k] || ZHEN_KE[k];
      if (!it) return;
      var g = it.gua;
      var gw = trigramWx(g);
      var eff, effKey;
      if (SHENG[gw] === tiWx) { eff = '外应生体 —— 助'; effKey = 'help'; }
      else if (gw === tiWx)   { eff = '外应与体比和 —— 助'; effKey = 'help'; }
      else if (KE[gw] === tiWx){ eff = '外应克体 —— 破'; effKey = 'break'; }
      else if (SHENG[tiWx] === gw){ eff = '体生外应 —— 泄气（非吉）'; effKey = 'drain'; }
      else { eff = '体克外应 —— 费力但有掌控'; effKey = 'control'; }
      var discount = '';
      if (it.zhen === false && effKey === 'break') { eff += '（属「形色」而非真物，克力很轻，不必深忌）'; discount = '（非真物，克力打折）'; }
      else if (it.zhen === true && effKey === 'break') { eff += '（真物，克力实，须认真对待）'; }
      var sc = effKey === 'help' ? 8 : (effKey === 'break' ? (it.zhen === false ? -3 : -10) : (effKey === 'drain' ? -6 : 2));
      out.score += sc;
      out.items.push({ key: k, gua: g, guaWx: gw, cat: it.cat || '真生真克', note: it.note, eff: eff, effKey: effKey, score: sc });
      if (effKey === 'help') out.helps.push(k + '（' + g + '）');
      else if (effKey === 'break') out.breaks.push(k + '（' + g + '）' + discount);
    });
    if (out.score > 0) out.notes.push('外应整体<b>助体</b> —— 原文：「內卦不吉而外卦又吉，可以解其不吉」，本卦就算不理想，外应也给了缓冲。');
    else if (out.score < 0) out.notes.push('外应整体<b>破体</b> —— 原文：「內卦吉而外卦不吉，反破其吉」，本卦再好也要防外部因素把局面打散。');
    else out.notes.push('外应有助有破，两下相抵 —— 看具体哪一项落在关键环节。');
    return out;
  }

  function build(upper, lower, dong, opts, used, desc) {
    /* 动爻在上卦（4-6 爻）则上卦为用、下卦为体；动爻在下卦（1-3 爻）则下卦为用、上卦为体 */
    var dongInUpper = dong >= 4;
    var tiTri = dongInUpper ? lower : upper;
    var yongTri = dongInUpper ? upper : lower;
    var rel = relation(tiTri.name, yongTri.name);

    /* 外应／十应（《梅花易數》卷二）*/
    var wy = waiYing(opts.waiYing, tiTri.name);

    var ben = { up: upper.name, low: lower.name };
    ben.name = hexName(ben.up, ben.low);
    var bian = bianGua(upper.name, lower.name, dong);
    bian.name = hexName(bian.up, bian.low);
    /* 体在上卦（动爻在下卦）→ 上互为体互；体在下卦 → 下互为体互 */
    var tiInUpper = !dongInUpper;
    var hu = huGua(upper.name, lower.name, { tiInUpper: tiInUpper, bianUp: bian.up, bianLow: bian.low });
    hu.name = hexName(hu.up, hu.low);
    hu.tiInUpper = tiInUpper;

    var bianRel = relation(tiTri.name, (dong >= 4 ? bian.up : bian.low));

    /* 断语 */
    var verdict = buildVerdict(ben, hu, bian, rel, bianRel, tiTri, yongTri, dong, opts.question);
    return {
      method: opts.method || 'time',
      upper: upper, lower: lower, tiTri: tiTri, yongTri: yongTri,
      dong: dong, dongInUpper: dongInUpper,
      ben: ben, hu: hu, bian: bian,
      rel: rel, bianRel: bianRel, waiYing: wy,
      question: opts.question || '',
      used: used, desc: desc,
      verdict: verdict
    };
  }

  function buildVerdict(ben, hu, bian, rel, bianRel, tiTri, yongTri, dong, question) {
    var out = {};

    /* 一句话总断 */
    out.headline = '本卦「' + ben.name + '」，' + rel.text + '，' + rel.luck + '。';
    if (rel.key === '用生体') out.headline += '外力来助，可放手去做。';
    else if (rel.key === '体克用') out.headline += '局面在你手里，但要花力气拿下。';
    else if (rel.key === '体生用') out.headline += '你在往外贴，先算清回报再投入。';
    else if (rel.key === '用克体') out.headline += '对方压着你，先守住别硬碰。';
    else out.headline += '平顺可成，按既定节奏走。';

    /* 判断依据 */
    out.evidence = [];
    out.evidence.push({ title:'体用生克（主判）', text: rel.text + '。' + rel.note +
      '　（动爻为第' + dong + '爻，属' + (dong >= 4 ? '上卦' : '下卦') + '，故以' +
      (dong >= 4 ? yongTri.name : tiTri.name) + '卦为用、' + (dong >= 4 ? tiTri.name : yongTri.name) + '卦为体）' });
    out.evidence.push({ title:'本卦卦象', text: ben.name + '（上' + ben.up + '下' + ben.low + '）：' +
      (hexMean(ben.name) || '—') + '。' + '上卦' + ben.up + '为' + triNature(ben.up) + '，下卦' + ben.low + '为' + triNature(ben.low) + '。' });
    /* 互卦分体互／用互（《梅花易數》卷三《體用互變之訣》：「體互最緊，用互次之」）*/
    var huA = hu.tiHu ? relation(tiTri.name, hu.tiHu) : null;
    var huB = hu.yongHu ? relation(tiTri.name, hu.yongHu) : null;
    out.evidence.push({ title:'互卦（中间过程／暗藏）', text: hu.name + '：' +
      (hexMean(hu.name) || '—') + (hu.noHu ? '（本卦为纯卦，乾坤無互、互其變卦）' : '') +
      '。互卦要拆成两个看：体互「' + (hu.tiHu || '') + '」对我本身最要紧（' +
      (huA ? huA.text + '・' + huA.luck : '') + '），用互「' + (hu.yongHu || '') + '」次之（' +
      (huB ? huB.text + '・' + huB.luck : '') + '）。中间过程会走到这个局面，注意这一层。' });
    out.evidence.push({ title:'变卦（最终结果）', text: bian.name + '（' + bianRel.text + '）：' +
      (hexMean(bian.name) || '—') + '。' + '末后走向' + bianRel.luck + '，' + bianRel.note });
    out.evidence.push({ title:'动爻', text: '第' + dong + '爻动 —— ' + dongText(dong) });

    /* 该做与不该做 */
    var dos = [], donts = [];
    if (rel.key === '用生体') {
      dos.push('现在就去推进：开口要资源、找人合作、把方案递上去');
      dos.push('趁势把之前卡住的事一次性推过线');
      donts.push('犹豫观望，等外力散了再动');
      donts.push('把送上门的助力当成理所当然，该谢的人要谢到位');
    } else if (rel.key === '体克用') {
      dos.push('主动出手，把关键人、关键环节握在自己手里');
      dos.push('准备好持续投入（时间与钱），这不是一击即成的局面');
      donts.push('半途松手，前面投入就白费了');
      donts.push('用力过猛把对方逼到墙角——压得住不等于要压到底');
    } else if (rel.key === '比和') {
      dos.push('找同类、同业、同门的人一起做，配合比单干快');
      dos.push('按原计划稳步推进，不用大改方向');
      donts.push('临时换方向、换合作方');
      donts.push('因为顺就放松盯细节，同类相轻最容易出岔子');
    } else if (rel.key === '体生用') {
      dos.push('把付出换成条件：先谈回报、先立字据，再投入');
      dos.push('给自己设一条止损线，到点就停');
      donts.push('无底线地贴钱贴时间，指望对方良心发现');
      donts.push('一个人扛下所有成本，不让对方承担任何风险');
    } else {
      dos.push('先守：保住本金、保住现有位置，别扩张');
      dos.push('把对方的诉求摸清楚，绕开正面冲突');
      donts.push('硬碰硬、正面顶撞、现在摊牌');
      donts.push('在压力下签长约、下大注');
    }
    /* 变卦方向补充 */
    if (bianRel.key === '用生体' || bianRel.key === '比和') dos.push('结果偏吉：可以按上面的方向走，把节奏拉长一点更稳');
    if (bianRel.key === '用克体') donts.push('结果偏凶：别把全部希望压在这一件事上，留后手');
    out.dos = dos; out.donts = donts;

    /* 时机与应期：梅花常用卦数定应期 */
    var numSum = (dong >= 4 ? (LINES[ben.up].length + dong) : dong);
    out.timing = '应期参考：动爻第' + dong + '爻，可应于 ' +
      (dong <= 3 ? (dong * 3) + ' 天内外' : '一到' + dong + ' 个月') +
      '；短则应日、长则应月，' + '以' + rel.key + '的走势看，' +
      (rel.luck === '凶' ? '先拖过这段时间再谈' : '这段时间内就会有消息');

    /* 解决方法（分步） */
    out.method = [
      '第一步：把问题写清楚 —— 「' + (question || '你要问的这件事') + '」到底要什么结果、什么时候要。',
      '第二步：按体用定姿态 —— ' + rel.text + '，' + (rel.luck === '凶' ? '先退半' + '步守住，不要正面顶。' :
        (rel.luck === '大吉' ? '可以主动开口，机会在别人手里，你去接。' : '按自己的节奏推进，别被别人带跑。')),
      '第三步：看互卦防中间变数 —— ' + hu.name + '：' + (hexMean(hu.name) || '') + '。把这一层提前想好应对。',
      '第四步：盯变卦定收尾 —— ' + bian.name + '：' + (hexMean(bian.name) || '') + '。' + bianRel.note,
      '第五步：设一个明确的检查点（上面应期那条），到点没进展就按预案调整，不要拖成烂账。'
    ];
    return out;
  }
  function triNature(n) { return TRIGRAM[Object.keys(TRIGRAM).filter(function(i){ return TRIGRAM[i].name === n; })[0]].nature; }
  function dongText(d) {
    var t = ['初爻：事情刚起头，根子在这里，先把这个位置的关系理顺。',
             '二爻：内部位置，多指家里或团队内部，先安内。',
             '三爻：内外交界，容易进退两难，别在这个位置上硬撑。',
             '四爻：接近外层，多指对上、对外，注意分寸。',
             '五爻：主位、关键位，成事的关键在这里，争取这一层支持。',
             '上爻：事情末尾，过了就转，见好就收。'];
    return t[d - 1];
  }

  var API = { qi: qi, waiYing: waiYing, WAI_YING: WAI_YING, ZHEN_KE: ZHEN_KE, trigramWx: trigramWx, TRIGRAM: TRIGRAM, HEX: HEX, HEX_MEAN: HEX_MEAN, relation: relation,
              hexName: hexName, huGua: huGua, bianGua: bianGua, ZHI: ZHI };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.MeiHua = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
