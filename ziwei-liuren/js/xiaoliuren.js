/* ================= 小六壬（掌诀占）起课引擎 =================
   规则：以农历月、日、时三个数，从「大安」起顺数，三次数完落在哪一宫，即以该宫断事。
     ① 月上起日：从大安起，数到农历月数，落宫为「月宫」
     ② 日上起时：从月宫起，数到农历日数，落宫为「日宫」
     ③ 时上查掌：从日宫起，数到时辰序号（子=1 … 亥=12），落宫即「最终落宫」
   依据：通行掌诀口诀（大安起月、月上起日、日上起时），六宫顺序
        大安 → 留连 → 速喜 → 赤口 → 小吉 → 空亡
   ==================== 对外：XiaoLiuRen.qi(opts) ==================== */
(function (root) {
  'use strict';
  var LC = root.LunarCore || (typeof require !== 'undefined' ? require('./calendar.js') : null);

  var GONG = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'];
  var ZHI = '子丑寅卯辰巳午未申酉戌亥';
  var GAN = '甲乙丙丁戊己庚辛壬癸';

  /* 六宫属性与断语 */
  var INFO = {
    '大安': {
      wuxing: '木', color: '青', fangwei: '东方', shuzi: '1、5、7',
      tigan: '青龙', luck: '吉',
      xiang: '身不动时，五行属木，颜色青色，方位东方，临青龙。凡谋事主一、五、七。',
      shi: '事事昌盛，求财在东方，失物不远，宅舍保安康，行人身未动，病者主无妨。',
      yi: ['静守本位、按部就班推进', '在熟悉的地盘、熟悉的人里做文章', '把合同、流程、手续先理清楚'],
      ji: ['急着换赛道、换城市、换人', '贪快求变，反而把稳的局面打乱']
    },
    '留连': {
      wuxing: '木', color: '暗青', fangwei: '东方', shuzi: '2、8、10',
      tigan: '勾陈', luck: '凶',
      xiang: '卒未归时，五行属木，颜色暗青，方位东方，临勾陈。凡谋事主二、八、十。',
      shi: '事难成就，求谋日未明，官事只宜缓，去者未回程，失物南方见，急讨方称心。',
      yi: ['先拖着、先观察、先收集信息', '把话说清楚，别让误会继续发酵', '把注意力放回自己手上的事'],
      ji: ['今天就要结果，越急越乱', '反复追问、反复确认，把关系磨掉']
    },
    '速喜': {
      wuxing: '火', color: '赤', fangwei: '南方', shuzi: '3、6、9',
      tigan: '朱雀', luck: '吉',
      xiang: '人便至时，五行属火，颜色赤色，方位南方，临朱雀。凡谋事主三、六、九。',
      shi: '喜事来临，求财向南行，失物申未午，逢人路上寻，官事有福德，病者无祸侵。',
      yi: ['今天就把消息发出去、电话打出去', '抓住眼前这个稍纵即逝的机会', '把好消息第一时间告诉关键的人'],
      ji: ['再想想、再等等，热度一过就凉了', '话说太满，后面接不住']
    },
    '赤口': {
      wuxing: '金', color: '白', fangwei: '西方', shuzi: '4、7、10',
      tigan: '白虎', luck: '凶',
      xiang: '官事凶时，五行属金，颜色白色，方位西方，临白虎。凡谋事主四、七、十。',
      shi: '主口舌是非，官讼宜防，失物急去寻，行人有惊慌，病者出西方，更须防咒咀。',
      yi: ['少说多听，重要的话留到明天再说', '涉及钱和责任的事，落到纸面上', '该道歉就先道歉，别争那口气'],
      ji: ['争对错、抢话头，一句话把事闹大', '在气头上做决定、发消息']
    },
    '小吉': {
      wuxing: '水', color: '黑', fangwei: '北方', shuzi: '1、5、7',
      tigan: '六合', luck: '吉',
      xiang: '人来喜时，五行属水，颜色黑色，方位北方，临六合。凡谋事主一、五、七。',
      shi: '凡事皆和合，求财向南行，失物在坤方，行人即便至，交关甚是强，凡事皆和合。',
      yi: ['找人合作、找人帮忙，这段时间别人愿意给面子', '谈钱、谈条件、谈分工', '把关系往前推一步'],
      ji: ['一个人硬扛，把能借的力放着不用', '只谈感情不谈条件，后面容易算不清']
    },
    '空亡': {
      wuxing: '土', color: '黄', fangwei: '中央', shuzi: '3、6、9',
      tigan: '勾陈', luck: '大凶',
      xiang: '音信稀时，五行属土，颜色黄色，方位中央，临勾陈。凡谋事主三、六、九。',
      shi: '事不长久，行人有灾殃，失物寻不见，官事有刑伤，病人逢暗鬼，祈解可安康。',
      yi: ['把预期降下来，先保住本金和底线', '该止损就止损，别再加码', '把重要的事往后挪，等风头过去'],
      ji: ['追加投入去救一个已经不对的事', '押上全部身家赌一把']
    }
  };

  function mod(n, m) { return ((n % m) + m) % m; }

  /* 六宫占断：给定月、日、时序号（1-12），返回落宫信息 */
  function pan(yue, ri, shi) {
    var m1 = mod(yue - 1, 6);                 // 月上起日：从大安数到月
    var d1 = mod(m1 + (ri - 1), 6);           // 日上起时：从月宫数到日
    var s1 = mod(d1 + (shi - 1), 6);          // 时上查掌：从日宫数到时辰
    return {
      yue: yue, ri: ri, shi: shi,
      monthGong: GONG[m1], dayGong: GONG[d1], gong: GONG[s1],
      idx: m1, dayIdx: d1, finalIdx: s1,
      info: INFO[GONG[s1]]
    };
  }

  /* 主入口：opts = { year, month, day, hour, minute, trueSolar, longitude, lunar?{m,d}, shiZhi? } */
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
      gzText = { yearGZ: LC.gzName(LC.yearGZ(ty)), dayGZ: LC.gzName(LC.dayGZ(ty, tm, td)),
                 hourGZ: GAN.charAt(LC.hourGZ(LC.dayGZ(ty, tm, td), shiIdx)) + ZHI.charAt(shiIdx) };
      if (tst) gzText.trueSolar = tst;
      gzText.clock = { hh: thh, mm: tmm };
    }
    if (shiIdx == null) throw new Error('缺少时辰');

    var k = pan(lunar.m, lunar.d, shiIdx + 1);
    k.lunar = lunar;
    k.shiZhi = ZHI.charAt(shiIdx);
    k.shiIdx = shiIdx;
    k.gz = gzText;
    k.gongList = GONG;
    k.infoAll = INFO;
    return k;
  }

  var API = { qi: qi, pan: pan, GONG: GONG, INFO: INFO, ZHI: ZHI };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.XiaoLiuRen = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
