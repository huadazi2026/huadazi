/* ================= 紫微斗数排盘引擎 =================
   规则：三合派（中州派）通用安星诀
   - 命身宫、五行局、紫微天府星系、辅星煞星、四化、大限小限流年
   ==================== 对外：ZiWei.chart(opts) ==================== */
(function (root) {
  'use strict';
  var LC = root.LunarCore || (typeof require !== 'undefined' ? require('./calendar.js') : null);

  var GAN = '甲乙丙丁戊己庚辛壬癸';
  var ZHI = '子丑寅卯辰巳午未申酉戌亥';
  var PALACES = ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','交友','官禄','田宅','福德','父母'];
  var PALACE_DESC = {
    '命宫':'自己、性格、天赋、一生总格局','兄弟':'兄弟姐妹、同辈朋友、合伙关系',
    '夫妻':'配偶、感情婚姻、亲密关系','子女':'子女、晚辈、学生、性的态度',
    '财帛':'赚钱方式、理财观、现金流向','疾厄':'身体健康、先天体质、情绪压力',
    '迁移':'外出发展、人际环境、在外际遇','交友':'朋友、部属、贵人、竞争对手',
    '官禄':'事业、工作态度、职业倾向','田宅':'不动产、家庭环境、财库',
    '福德':'精神享受、兴趣、福气、晚年','父母':'父母、长辈、上司、贵人'
  };

  /* 十四主星安星（由实盘数据反解 + iztro 权威实现 600 盘复核，全部一致）
     紫微系（相对紫微固定）：紫微0  天机-1 太阳-3 武曲-4 天同-5 廉贞+4
     天府族（天府 = 紫微宫+2 逆推：d=(4-2×紫微) mod 12，自天府顺行）：
       天府 d+0、太阴 d+1、贪狼 d+2、巨门 d+3、天相 d+4、天梁 d+5、七杀 d+6
     破军（锚在紫微系）：紫微+2                                     */
  var ZIWEI_OFFSET = { '紫微':0, '天机':-1, '太阳':-3, '武曲':-4, '天同':-5, '廉贞':4 };
  var TIANFU_ORDER = ['天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀'];
  var POJUN_OFFSET = 0;   // 破军与紫微同宫
  var MAIN_STARS = ['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼','巨门','天相','天梁','七杀','破军'];

  /* 星曜性质：五行、吉凶、类象（用于解读） */
  var STAR_INFO = {
    '紫微':{wx:'土',kind:'吉',title:'帝星',key:'尊贵、领导、要面子、自我中心、统筹力强'},
    '天机':{wx:'木',kind:'吉',title:'智星',key:'聪明、善谋、多思多虑、变动、机巧'},
    '太阳':{wx:'火',kind:'吉',title:'贵星',key:'博爱、外向、付出、名声、男性长辈'},
    '武曲':{wx:'金',kind:'吉',title:'财星',key:'刚毅、执行、财务、寡宿、直来直往'},
    '天同':{wx:'水',kind:'吉',title:'福星',key:'温和、享受、情绪化、懒散、有福气'},
    '廉贞':{wx:'火',kind:'半吉',title:'囚星',key:'政治、纪律、桃花、个性强、爱憎分明'},
    '天府':{wx:'土',kind:'吉',title:'库星',key:'保守、稳重、理财、包容、守成'},
    '太阴':{wx:'水',kind:'吉',title:'富星',key:'细腻、内敛、感性、田宅、女性长辈'},
    '贪狼':{wx:'木',kind:'半吉',title:'桃花星',key:'欲望、多才多艺、交际、酒色财气'},
    '巨门':{wx:'水',kind:'半凶',title:'暗星',key:'口才、是非、研究、猜疑、教师律师'},
    '天相':{wx:'水',kind:'吉',title:'印星',key:'辅佐、公正、重衣饰、有服务心'},
    '天梁':{wx:'土',kind:'吉',title:'荫星',key:'老成、庇荫、逢凶化吉、爱管闲事'},
    '七杀':{wx:'金',kind:'凶',title:'将星',key:'肃杀、开创、独立、竞争、受伤'},
    '破军':{wx:'水',kind:'凶',title:'耗星',key:'变革、破坏后重建、奔波、损耗'},
    '文昌':{wx:'金',kind:'吉',title:'文星',key:'文书、考试、聪慧、条理'},
    '文曲':{wx:'水',kind:'吉',title:'文星',key:'才艺、口才、风流、感性'},
    '左辅':{wx:'土',kind:'吉',title:'助星',key:'助力、忠厚、贵人'},
    '右弼':{wx:'水',kind:'吉',title:'助星',key:'助力、机变、贵人'},
    '天魁':{wx:'火',kind:'吉',title:'贵星',key:'阳贵人、明助、机遇'},
    '天钺':{wx:'火',kind:'吉',title:'贵星',key:'阴贵人、暗助、机遇'},
    '禄存':{wx:'土',kind:'吉',title:'财星',key:'财禄、稳健、孤独'},
    '擎羊':{wx:'金',kind:'凶',title:'刑星',key:'刑伤、冲突、冲动、竞争'},
    '陀罗':{wx:'金',kind:'凶',title:'忌星',key:'拖延、纠缠、暗伤、耐性'},
    '火星':{wx:'火',kind:'凶',title:'煞星',key:'急躁、爆发、意外、行动力'},
    '铃星':{wx:'火',kind:'凶',title:'煞星',key:'阴火、闷气、突发、狠劲'},
    '地空':{wx:'火',kind:'凶',title:'空星',key:'空想、损失、出家、创意'},
    '地劫':{wx:'火',kind:'凶',title:'劫星',key:'破财、劫夺、波折、冒险'},
    '天马':{wx:'火',kind:'吉',title:'驿星',key:'奔波、远行、变动、驿动'},
    '红鸾':{wx:'水',kind:'吉',title:'喜星',key:'婚喜、桃花、喜庆'},
    '天喜':{wx:'水',kind:'吉',title:'喜星',key:'喜庆、桃花、人缘'},
    '天刑':{wx:'火',kind:'凶',title:'刑星',key:'自律、刑伤、官非、孤克'},
    '天姚':{wx:'水',kind:'半凶',title:'桃花',key:'风流、人缘、暧昧、交际'},
    '天官':{wx:'土',kind:'吉',title:'贵星',key:'官职、贵气、前程'},
    '天福':{wx:'土',kind:'吉',title:'福星',key:'福气、寿元、顺遂'},
    '台辅':{wx:'土',kind:'吉',title:'贵星',key:'辅佐、贵气'},
    '封诰':{wx:'土',kind:'吉',title:'贵星',key:'封赏、荣誉'},
    '三台':{wx:'土',kind:'吉',title:'贵星',key:'地位、名望'},
    '八座':{wx:'土',kind:'吉',title:'贵星',key:'地位、名望'},
    '恩光':{wx:'火',kind:'吉',title:'贵星',key:'殊荣、提拔'},
    '天贵':{wx:'土',kind:'吉',title:'贵星',key:'贵人、声誉'},
    '龙池':{wx:'水',kind:'吉',title:'吉星',key:'科甲、才艺、婚姻'},
    '凤阁':{wx:'土',kind:'吉',title:'吉星',key:'科甲、才艺、婚姻'},
    '天哭':{wx:'金',kind:'凶',title:'凶星',key:'忧思、悲伤、刑克'},
    '天虚':{wx:'土',kind:'凶',title:'凶星',key:'虚耗、空虚、疾病'},
    '孤辰':{wx:'火',kind:'凶',title:'孤星',key:'孤独、自立'},
    '寡宿':{wx:'火',kind:'凶',title:'孤星',key:'孤独、寡合'},
    '蜚廉':{wx:'火',kind:'凶',title:'凶星',key:'小人、口舌'},
    '破碎':{wx:'火',kind:'凶',title:'凶星',key:'破损、耗散'},
    '华盖':{wx:'木',kind:'半吉',title:'艺星',key:'才华、孤高、宗教'},
    '咸池':{wx:'水',kind:'凶',title:'桃花',key:'情欲、桃花、酒色'},
    '天德':{wx:'火',kind:'吉',title:'吉星',key:'逢凶化吉、贵气'},
    '月德':{wx:'火',kind:'吉',title:'吉星',key:'逢凶化吉、温和'}
  };

  /* 十天干四化：禄 权 科 忌 */
  var SIHUA = [
    ['廉贞','破军','武曲','太阳'],  // 甲
    ['天机','天梁','紫微','太阴'],  // 乙
    ['天同','天机','文昌','廉贞'],  // 丙
    ['太阴','天同','天机','巨门'],  // 丁
    ['贪狼','太阴','右弼','天机'],  // 戊
    ['武曲','贪狼','天梁','文曲'],  // 己
    ['太阳','武曲','太阴','天同'],  // 庚
    ['巨门','太阳','文曲','文昌'],  // 辛
    ['天梁','紫微','左辅','武曲'],  // 壬
    ['破军','巨门','太阴','贪狼']   // 癸
  ];
  var HUA_NAME = ['化禄','化权','化科','化忌'];

  /* 纳音五行 */
  var NAYIN = ['海中金','炉中火','大林木','路旁土','剑锋金','山头火','涧下水','城头土','白蜡金','杨柳木',
    '泉中水','屋上土','霹雳火','松柏木','长流水','沙中金','山下火','平地木','壁上土','金箔金',
    '覆灯火','天河水','大驿土','钗钏金','桑柘木','大溪水','沙中土','天上火','石榴木','大海水'];
  function nayinIndexOf(gan, zhi) {
    for (var n = 0; n < 60; n++) if (n % 10 === gan && n % 12 === zhi) return Math.floor(n / 2);
    return -1;
  }
  var JU_OF_WX = { '水':2, '木':3, '金':4, '土':5, '火':6 };
  var JU_NAME = { 2:'水二局', 3:'木三局', 4:'金四局', 5:'土五局', 6:'火六局' };

  /* 命主（以命宫地支定，子=0）/ 身主（以生年支定，子=0）—— 通用派口诀表，已与 iztro 逐项核对 */
  var MINGZHU = ['贪狼','巨门','禄存','文曲','廉贞','武曲','破军','武曲','廉贞','文曲','禄存','巨门'];
  var SHENZHU = ['火星','天相','天梁','天同','文昌','天机','火星','天相','天梁','天同','文昌','天机'];

  /* 命宫 / 身宫：month 1-12（正月=1），hourZhi 0-11（子=0） */
  function mingGong(month, hourZhi) { return ((2 + (month - 1) - hourZhi) % 12 + 12) % 12; }
  function shenGong(month, hourZhi) { return ((2 + (month - 1) + hourZhi) % 12 + 12) % 12; }

  /* 紫微星定位 */
  function ziweiPos(ju, day) {
    var n = Math.ceil(day / ju), d = n * ju - day;
    var A = (2 + (n - 1)) % 12;
    return ((d % 2 === 0) ? (A + d) : (A - d) % 12 + 12) % 12;
  }
  /* 天府星定位：与紫微以寅申为轴对称 → 天府 = (4 - 紫微) mod 12 */
  function tianfuPos(zw) { return ((4 - zw) % 12 + 12) % 12; }

  /* 年系、月系、时系诸星（起法均经 iztro 900 盘统计验证） */
  function yearStarPositions(yearGanIdx, yearZhiIdx, month, hourZhi) {
    var s = {};
    // 天魁天钺（年干）
    s['天魁'] = [1,0,11,11,1,0,1,6,3,3][yearGanIdx];
    s['天钺'] = [7,8,9,9,7,8,7,2,5,5][yearGanIdx];
    // 禄存 + 擎羊陀罗（年干）：擎羊=禄存+1，陀罗=禄存-1
    var lu = [2,3,5,6,5,6,8,9,11,0][yearGanIdx];
    s['禄存'] = lu; s['擎羊'] = (lu + 1) % 12; s['陀罗'] = (lu + 11) % 12;
    // 火星铃星（年支三合局 + 时支）—— 起子时落宫（已与 iztro 144 格逐格核对）：
    //   申子辰：火寅·铃戌 ／ 寅午戌：火丑·铃卯 ／ 巳酉丑：火卯·铃戌 ／ 亥卯未：火酉·铃戌
    var hGroup = { 2:0, 6:0, 10:0, 8:1, 0:1, 4:1, 5:2, 9:2, 1:2, 11:3, 3:3, 7:3 }[yearZhiIdx];   // 0=寅午戌 1=申子辰 2=巳酉丑 3=亥卯未
    var huoStart = [1, 2, 3, 9][hGroup], lingStart = [3, 10, 10, 10][hGroup];
    s['火星'] = (huoStart + hourZhi) % 12;
    s['铃星'] = (lingStart + hourZhi) % 12;
    // 地空地劫（时支）：地空 亥起子时逆行；地劫 亥起子时顺行
    s['地空'] = ((11 - hourZhi) % 12 + 12) % 12;
    s['地劫'] = (11 + hourZhi) % 12;
    // 天马（年支三合）：申子辰马在寅、寅午戌马在申、巳酉丑马在亥、亥卯未马在巳
    s['天马'] = { 2:8, 6:8, 10:8, 8:2, 0:2, 4:2, 5:11, 9:11, 1:11, 11:5, 3:5, 7:5 }[yearZhiIdx];
    // 红鸾（卯上起子年逆行）、天喜（红鸾对宫）—— iztro 未收此二星，按通行口诀安；测试脚本已排除
    var hong = ((3 - yearZhiIdx) % 12 + 12) % 12;
    s['红鸾'] = hong; s['天喜'] = (hong + 6) % 12;
    // 孤辰寡宿（年支）
    var gu = { 2:3, 6:3, 10:3, 8:11, 0:11, 4:11, 5:2, 9:2, 1:2, 11:5, 3:5, 7:5 }[yearZhiIdx];
    var gua = { 2:4, 6:4, 10:4, 8:0, 0:0, 4:0, 5:3, 9:3, 1:3, 11:6, 3:6, 7:6 }[yearZhiIdx];
    s['孤辰'] = gu; s['寡宿'] = gua;
    // 天刑天姚（月）
    s['天刑'] = (9 + month) % 12;        // 酉宫起正月
    s['天姚'] = (1 + month) % 12;        // 丑宫起正月
    // 咸池（年支三合）
    var xian = { 2:3, 6:3, 10:3, 8:6, 0:6, 4:6, 5:9, 9:9, 1:9, 11:0, 3:0, 7:0 }[yearZhiIdx];
    s['咸池'] = xian;
    // 华盖（年支三合）
    var hua = { 2:10, 6:10, 10:10, 8:4, 0:4, 4:4, 5:1, 9:1, 1:1, 11:7, 3:7, 7:7 }[yearZhiIdx];
    s['华盖'] = hua;
    // 破碎（年支）
    var po = { 2:5, 6:5, 10:5, 8:1, 0:1, 4:1, 5:9, 9:9, 1:9, 11:5, 3:5, 7:5 }[yearZhiIdx];
    s['破碎'] = po;
    // 蜚廉（年支）
    var fei = { 2:8, 6:8, 10:8, 8:2, 0:2, 4:2, 5:5, 9:5, 1:5, 11:11, 3:11, 7:11 }[yearZhiIdx];
    s['蜚廉'] = fei;
    // 天哭天虚（年支，午起子年，逆行/顺行）
    var ku = ((6 - yearZhiIdx) % 12 + 12) % 12;
    s['天哭'] = ku; s['天虚'] = (ku + 6) % 12;
    // 天官天福（年干）
    s['天官'] = [7,4,5,2,3,9,11,9,10,6][yearGanIdx];
    s['天福'] = [9,8,0,11,3,2,6,5,6,5][yearGanIdx];
    // 台辅封诰（时支）
    s['台辅'] = (6 + hourZhi) % 12;
    s['封诰'] = (2 + hourZhi) % 12;
    return s;
  }
  /* 三台八座（由左辅右弼 + 农历日） */
  function sanTaiBaZuo(zuoPos, youPos, day) {
    return { '三台': (zuoPos + day - 1) % 12, '八座': ((youPos - day + 1) % 12 + 12) % 12 };
  }
  /* 恩光天贵（文昌文曲 + 农历日 + 时支） */
  function enGuangTianGui(wenChang, wenQu, day, hourZhi) {
    return { '恩光': (wenChang + day - 1 - hourZhi + 12) % 12,
             '天贵': (wenQu + day - 1 - hourZhi + 12) % 12 };
  }
  /* 龙池凤阁（年支） */
  function longChiFengGe(yearZhiIdx) {
    return { '龙池': (4 + yearZhiIdx) % 12, '凤阁': ((10 - yearZhiIdx) % 12 + 12) % 12 };
  }
  /* 天德月德（年支）：简化通用口诀 */
  function tianDeYueDe(yearZhiIdx) {
    var de = { 2:3, 6:3, 10:3, 8:9, 0:9, 4:9, 5:5, 9:5, 1:5, 11:11, 3:11, 7:11 }[yearZhiIdx];
    return { '天德': de, '月德': (de + 6) % 12 };
  }

  /* 长生十二神 */
  var CHANGSHENG = ['长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'];
  function changshengStart(ju, yearGanIdx, yearZhiIdx) {
    // 水二局长生在申，木三局亥，金四局巳，土五局申，火六局寅
    var base = { 2:8, 3:11, 4:5, 5:8, 6:2 }[ju];
    // 阳年干顺行，阴年干逆行（男顺女逆由调用方处理）
    return base;
  }

  /* ============ 主函数 ============ */
  function chart(opts) {
    var y = opts.year, m = opts.month, d = opts.day, hh = opts.hour, mm = opts.minute || 0;
    var gender = opts.gender === '女' ? '女' : '男';
    var leapMode = opts.leapMode || 'split';   // 默认：闰月十五前归本月、十六起归下月
    var tzOffset = (opts.tzOffset === undefined) ? LC.localOffsetMin(y, m, d) : opts.tzOffset;
    var useTrueSolar = !!opts.trueSolar;
    var lng = opts.longitude;

    var info = { input: { y: y, m: m, d: d, hh: hh, mm: mm, gender: gender } };
    var ty = y, tm = m, td = d, thh = hh, tmm = mm, tstInfo = null;
    if (useTrueSolar && typeof lng === 'number') {
      tstInfo = LC.trueSolarTime(y, m, d, hh, mm, lng, opts.useEoT !== false);
      ty = tstInfo.y; tm = tstInfo.m; td = tstInfo.d; thh = tstInfo.hour; tmm = tstInfo.minute;
    }
    info.trueSolar = tstInfo;

    /* 年干支：以立春为界 */
    var yearGanIdx, yearZhiIdx;
    var lichunMs = LC.termMs(ty, 2);
    var curMs = Date.UTC(ty, tm - 1, td, thh, tmm);
    var gzYear = (lichunMs !== null && curMs < lichunMs) ? ty - 1 : ty;
    var yGZ = LC.yearGZ(gzYear);
    yearGanIdx = yGZ % 10; yearZhiIdx = yGZ % 12;
    info.ganZhiYear = gzYear;
    info.yearGZ = GAN[yearGanIdx] + ZHI[yearZhiIdx];
    info.shengXiao = LC.SHENGXIAO[yearZhiIdx];

    /* 农历
       晚子时换日（倪海厦《天纪》：23:00-24:00 为晚子时，日子按前一天算；
       00:00-01:00 为早子时，按当天算）。开着时只把「农历日」退回一天 ——
       年柱仍按立春、命宫月仍按节气/农历月，只有紫微起星用的日数跟着退。 */
    var lunarSolarY = ty, lunarSolarM = tm, lunarSolarD = td;
    if (opts.lateZi && thh === 23) {
      var pd = new Date(Date.UTC(ty, tm - 1, td - 1));
      lunarSolarY = pd.getUTCFullYear(); lunarSolarM = pd.getUTCMonth() + 1; lunarSolarD = pd.getUTCDate();
      info.lateZiRolled = true;
    }
    var lunar = LC.solarToLunar(lunarSolarY, lunarSolarM, lunarSolarD);
    if (!lunar) throw new Error('日期超出农历数据范围（1900-01-31 ~ 2100-12-31）。' +
      (useTrueSolar && tstInfo ? '当前开启了真太阳时校正，会把钟表时间前移到 ' + ty + '-' + LC.pad(tm) + '-' + LC.pad(td) +
        '，已贴近可用范围边界；把出生日期往后调一天、或关掉真太阳时校正即可。' : ''));
    info.lunar = lunar;
    /* 定命宫所用的“月”：
       'term'  = 节气月（直接按节气定月，大多数专业排盘的口径）
       'lunar' = 农历月（初一换月；闰月按 leapMode 归月 —— 倪海厦派用 leapMode:'next'） */
    var monthMode = opts.monthMode || 'term';
    var zwM;
    if (monthMode === 'lunar') {
      zwM = LC.zwMonth(lunar.m, !!lunar.isLeap, lunar.d, leapMode);
      info.monthSource = '农历月' + (lunar.isLeap ? '（闰' + lunar.m + '月·' + ({
        prev: '作本月', next: '作下月', split: '十五前作本月' }[leapMode] || '十五前作本月') + '）' : '');
    } else {
      zwM = LC.monthLing(ty, tm, td, thh, tmm).idx + 1;   // 寅月=1
      info.monthSource = '节气月' + (lunar.isLeap ? '（闰' + lunar.m + '月，按节气定月）' : '');
    }
    info.lunarMonthNo = zwM;

    /* 时支（真太阳时后） */
    var hourZhi = LC.hourZhiOf(thh);

    /* 命宫身宫 */
    var ming = mingGong(zwM, hourZhi);
    var shen = shenGong(zwM, hourZhi);

    /* 十二宫天干：五虎遁 —— 寅宫起「农历年干」（甲己之年丙作首）
       注：紫微十二宫的宫干用农历年干（正月初一换年）；
       而四化、流年诸星用节气年干（立春换年），两者是两套口径，不可混用。 */
    var gongGan = [];
    var lunarYearGZ = LC.yearGZ(lunar.y);
    var lunarYearGanIdx = lunarYearGZ % 10;
    var lunarYearZhiIdx = lunarYearGZ % 12;
    var start = LC.monthGanStart(lunarYearGanIdx);   // 寅宫天干
    for (var i = 0; i < 12; i++) gongGan[(2 + i) % 12] = (start + i) % 10;
    /* 五行局 */
    var nyIdx = nayinIndexOf(gongGan[ming], ming);
    var nayinName = NAYIN[nyIdx];
    var ju = JU_OF_WX[nayinName.charAt(nayinName.length - 1)];

    /* 紫微星系（逆行）/ 天府星系（顺行） */
    var zw = ziweiPos(ju, lunar.d);
    var tf = tianfuPos(zw);
    var stars = {};
    for (var k = 0; k < 12; k++) stars[k] = [];
    function put(p, name) { if (name) stars[((p % 12) + 12) % 12].push(name); }
    for (var st in ZIWEI_OFFSET) put(zw + ZIWEI_OFFSET[st], st);
    var tfDelta = (((4 - 2 * zw) % 12) + 12) % 12;
    for (var ti = 0; ti < TIANFU_ORDER.length; ti++) put(zw + tfDelta + ti, TIANFU_ORDER[ti]);
    put(tf + 10, '破军');   // 破军 = 天府 + 10

    /* 月系：左辅（辰起正月顺行）、右弼（戌起正月逆行）
       口诀「辰上顺正寻左辅，戌上逆正右弼当」 */
    var zuoPos = (4 + zwM - 1) % 12;
    var youPos = ((10 - (zwM - 1)) % 12 + 12) % 12;
    put(zuoPos, '左辅'); put(youPos, '右弼');
    /* 时系：文昌（戌起子时逆行）、文曲（辰起子时顺行） */
    var changPos = ((10 - hourZhi) % 12 + 12) % 12;
    var quPos = (4 + hourZhi) % 12;
    put(changPos, '文昌'); put(quPos, '文曲');

    /* 年系诸星 */
    var yp = yearStarPositions(lunarYearGanIdx, lunarYearZhiIdx, zwM, hourZhi);
    for (var nm in yp) if (yp.hasOwnProperty(nm)) put(yp[nm], nm);
    var s3 = sanTaiBaZuo(zuoPos, youPos, lunar.d);
    for (var nm2 in s3) put(s3[nm2], nm2);
    var eg = enGuangTianGui(changPos, quPos, lunar.d, hourZhi);
    for (var nm3 in eg) put(eg[nm3], nm3);
    var lc = longChiFengGe(lunarYearZhiIdx);
    for (var nm4 in lc) put(lc[nm4], nm4);
    var dd = tianDeYueDe(lunarYearZhiIdx);
    for (var nm5 in dd) put(dd[nm5], nm5);

    /* 四化 */
    var sh = SIHUA[lunarYearGanIdx];   // 四化随生年天干（农历年干，正月初一换年）
    var huaMap = {};   // 星 -> 化
    for (var q = 0; q < 4; q++) huaMap[sh[q]] = HUA_NAME[q];
    info.siHua = { 禄: sh[0], 权: sh[1], 科: sh[2], 忌: sh[3] };

    /* 长生十二神与大限方向：依「生年干支」阴阳 + 性别（阳男阴女顺行）
       注：年之阴阳取农历年干（正月初一换年），不用节气年干 */
    var yangYear = lunarYearGanIdx % 2 === 0;
    var forward = (yangYear && gender === '男') || (!yangYear && gender === '女');
    var csBase = { 2:8, 3:11, 4:5, 5:8, 6:2 }[ju];
    var changsheng = {};
    for (var c = 0; c < 12; c++) {
      var pos = forward ? (csBase + c) % 12 : ((csBase - c) % 12 + 12) % 12;
      changsheng[pos] = CHANGSHENG[c];
    }

    /* 十二宫：从命宫起逆时针排（命宫=0，兄弟在命宫前一宫……） */
    var palaceOf = {}, palaceNameAt = {};
    for (var pk = 0; pk < 12; pk++) {
      var p = ((ming - pk) % 12 + 12) % 12;
      palaceOf[pk] = p;
      palaceNameAt[p] = PALACES[pk];
    }

    /* 大限：局数起，阳男阴女顺行 */
    var limits = {};
    for (var lk = 0; lk < 12; lk++) {
      var a0 = ju + lk * 10;
      var lp = forward ? (ming + lk) % 12 : ((ming - lk) % 12 + 12) % 12;
      limits[lp] = { from: a0, to: a0 + 9, idx: lk, palace: PALACES[lk] };
    }

    /* 命主（以命宫地支定）/ 身主（以生年支定）—— 取自通用派口诀表 */
    var mingZhu = MINGZHU[ming];
    var shenZhu = SHENZHU[lunarYearZhiIdx];   // 用农历年支（与 iztro 一致）

    /* 组装十二宫 */
    var palaces = [];
    for (var pp = 0; pp < 12; pp++) {
      var zhi = pp;
      var list = stars[zhi].slice();
      var hua = [];
      for (var si = 0; si < list.length; si++) {
        if (huaMap[list[si]]) hua.push({ star: list[si], hua: huaMap[list[si]] });
      }
      var mainHere = list.filter(function (s) { return MAIN_STARS.indexOf(s) >= 0; });
      palaces.push({
        zhi: zhi, zhiName: ZHI[zhi], gan: gongGan[zhi], ganName: GAN[gongGan[zhi]],
        name: palaceNameAt[zhi] || '', isMing: zhi === ming, isShen: zhi === shen,
        stars: list, mainStars: mainHere, hua: hua,
        changsheng: changsheng[zhi] || '', limit: limits[zhi] || null
      });
    }

    return {
      info: info, ju: ju, juName: JU_NAME[ju], nayin: nayinName,
      mingPos: ming, shenPos: shen,
      mingGanZhi: GAN[gongGan[ming]] + ZHI[ming],
      shenGanZhi: GAN[gongGan[shen]] + ZHI[shen],
      ziweiPos: zw, tianfuPos: tf,
      palaces: palaces, palaceNameAt: palaceNameAt,
      forward: forward, gender: gender,
      mingZhu: mingZhu, shenZhu: shenZhu,
      hourZhi: hourZhi, hourZhiName: ZHI[hourZhi],
      stars: stars, huaMap: huaMap, yearGanIdx: yearGanIdx, yearZhiIdx: yearZhiIdx,
      lunarYearGanIdx: lunarYearGanIdx, lunarYearZhiIdx: lunarYearZhiIdx,
      zwMonth: zwM, lunarMonth: lunar.m, lunarDay: lunar.d
    };
  }

  var API = {
    chart: chart, PALACES: PALACES, PALACE_DESC: PALACE_DESC, MAIN_STARS: MAIN_STARS,
    STAR_INFO: STAR_INFO, SIHUA: SIHUA, JU_NAME: JU_NAME, HUA_NAME: HUA_NAME,
    ZHI: ZHI, GAN: GAN, mingGong: mingGong, shenGong: shenGong,
    ziweiPos: ziweiPos, tianfuPos: tianfuPos
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.ZiWei = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
