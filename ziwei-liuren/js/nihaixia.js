/* 倪海厦《天纪》断法层
   来源：M:\倪海厦合辑\天纪\紫薇\ 的讲义（天纪笔记/天机道听课笔记）+ 排盘程序的 .ini 表
   说明：本文件只搬入「数据表」与「判据」，断语文案按《天纪》原则自行组织，不照抄讲义原文。
   依赖：js/nihaixia_miao.js（庙旺利陷表） */
(function (root) {
  'use strict';

  /* ───────────────────────── 一、星性总表（《天纪》对各星的定性） ───────────────────────── */
  /* kind: 官带(文/武) | 财 | 桃花 | 煞 | 吉 | 助
     wu:   是否武官星（武官星喜入庙，主刚强、生杀之权）
     jie:  是否带「解厄制化」之力（《天纪》：只有太阳、紫微、武曲这类大贵星才有） */
  var STAR = {
    '紫微': { kind:'官带', wu:0, jie:1, sex:'阳', dou:'北斗', theme:'帝星',
      ying:'脸宽方、耳长、正面不见耳，厚重不苟言笑；性本孤，喜欢一个人做事',
      job:'官运，文武皆可；官带星越大官越大', key:'最需左辅右弼配合，无左右便为孤君' },
    '天机': { kind:'官带', wu:0, jie:0, sex:'阴', dou:'南斗', theme:'文官带',
      ying:'个子矮、体格精壮、肤色偏深', job:'公务人员、幕僚、动脑的活',
      key:'反应快、聪明、心眼多；无解厄之力' },
    '太阳': { kind:'官带', wu:1, jie:1, sex:'阳', dou:'中天', theme:'武官带',
      ying:'圆脸、双目圆大、红光满面、中等身材结实', job:'军人警察法官外交官；主财禄，属横财',
      key:'代表父亲、丈夫、儿子；最怕落陷' },
    '武曲': { kind:'财', wu:1, jie:1, sex:'阴', dou:'北斗', theme:'财星王',
      ying:'五短身材、矮壮，性火爆一发就过', job:'武职大利；财星中的大财星',
      key:'武曲七杀＝武杀会，掌生杀之权但不掌禄' },
    '天同': { kind:'吉', wu:0, jie:0, sex:'阳', dou:'南斗', theme:'人和星',
      ying:'温厚温驯', job:'合伙、合作、和气生财',
      key:'流年逢天同，合伙吉' },
    '廉贞': { kind:'官带', wu:1, jie:0, sex:'阴', dou:'北斗', theme:'次桃花·武官带',
      ying:'长相清秀', job:'带兵、纪律性的工作',
      key:'廉贞七杀双陷为凶；廉贞贪狼双陷最凶' },
    '天府': { kind:'官带', wu:0, jie:0, sex:'阳', dou:'南斗', theme:'南斗星君·文官星',
      ying:'温和厚道，心眼较多', job:'教星、佐才；府相会命天生佐才',
      key:'无解厄制化之力；是财库不是财星' },
    '太阴': { kind:'官带', wu:0, jie:0, sex:'阴', dou:'中天', theme:'文官带',
      ying:'清秀', job:'公务人员、固定薪水；在财帛为正财',
      key:'代表母亲、妻子；男命最怕太阴化忌' },
    '贪狼': { kind:'桃花', wu:1, jie:0, sex:'阳', dou:'北斗', theme:'主桃花星',
      ying:'形貌魁梧、毛发较多', job:'事业上主财；贪狼在午为武官星',
      key:'火贪格主出武官；贪狼多败于桃花' },
    '巨门': { kind:'煞', wu:0, jie:0, sex:'阴', dou:'北斗', theme:'口舌星',
      ying:'个子小声音大，或身长肥胖多毛', job:'靠嘴吃饭：老师、律师、业务、主持',
      key:'庙旺为能言善道，落陷为官司牢狱' },
    '天相': { kind:'助', wu:0, jie:0, sex:'阳', dou:'南斗', theme:'宰相·佐才星',
      ying:'瘦瘦高高、没有肉，厚道谦和', job:'助理、秘书、师爷；女命最宜',
      key:'不想权位，位高而无权' },
    '天梁': { kind:'官带', wu:0, jie:0, sex:'阳', dou:'南斗', theme:'食神',
      ying:'剑眉斜飞、个子不高但精壮，正派厚道', job:'文武双全；官禄宫主应酬交际多',
      key:'天梁在午：武官一品，手有生杀之权' },
    '七杀': { kind:'煞', wu:1, jie:0, sex:'阳', dou:'南斗', theme:'武官星',
      ying:'目大、性急、多疑', job:'武职；事业上主耗',
      key:'七杀临身终不美；紫微七杀＝化权' },
    '破军': { kind:'煞', wu:1, jie:0, sex:'阴', dou:'北斗', theme:'武官星',
      ying:'瘦、养不胖，孤僻自守、不重利重感觉', job:'事业上主耗；英星入庙发于武职',
      key:'单星入夫妻或福德，婚姻不好' }
  };

  /* ───────────────────────── 二、四化 ───────────────────────── */
  var HUA = {
    '化禄': { n:'财禄', xing:'性守', yong:'钱财、祖业、理财',
      ying:'小气、会理财、守财', use:'禄在财帛＝自己做生意；禄在父母＝父母从商有祖业',
      warn:'禄逢冲破，吉处藏凶' },
    '化权': { n:'官印', xing:'性刚', yong:'权力、领导、主见',
      ying:'天生的领导者，个性强', use:'权在命＝个性很强；权在财帛＝做事业领导力强',
      warn:'无禄之权只能当主管，成不了老板' },
    '化科': { n:'科名', xing:'文', yong:'考试、名气、才艺、专业技术',
      ying:'读书好、名气大', use:'科在命利考试；科在官禄利公职；科在财帛靠专长赚钱',
      warn:'有科无权只是佐才，适合军师顾问' },
    '化忌': { n:'劫杀', xing:'滞', yong:'意外、横祸、官司、纠纷、破财',
      ying:'想不开、停滞', use:'化忌在对宫来冲，比在本宫更凶',
      warn:'化忌＝这一环最容易出状况，且主「想不开」' }
  };

  /* ───────────────────────── 三、煞星 ───────────────────────── */
  var SHA = {
    '擎羊': { x:'刑', xiang:'刀、血光、开刀、外伤', xiao:'看不到的小人就在身边',
      rule:'入庙＝这一刀下去平安（多为小手术）；落陷＝来阴的最可怕' },
    '陀罗': { x:'忌', xiang:'拖、慢性、旧伤旧病反复、开刀', xiao:'也是看不到的小人',
      rule:'陀罗与擎羊是两颗「开刀星」，流年逢之多见血光' },
    '火星': { x:'火', xiang:'急症、火厄、个性冲突', xiao:'脾气冲、合伙易吵架分手',
      rule:'火铃喜与杀破狼同宫；入庙反成助力' },
    '铃星': { x:'火', xiang:'急症、暗火、情绪紧绷', xiao:'同上',
      rule:'煞星入庙旺反吉，落陷为凶中之凶' },
    '地空': { x:'耗', xiang:'虚耗、成而复失', xiao:'做生意的流年逢空劫，主赔钱',
      rule:'单星独守最凶' },
    '地劫': { x:'耗', xiang:'元气被夺、投入落空', xiao:'同上',
      rule:'地劫独守＋对宫化忌来冲，早年就完了' }
  };

  /* ───────────────────────── 四、亮度判读（继承《天纪》原则） ───────────────────────── */
  var JI_SET = { '左辅':1,'右弼':1,'文昌':1,'文曲':1,'天魁':1,'天钺':1,'禄存':1,'天马':1 };
  var SHA_SET = { '擎羊':1,'陀罗':1,'火星':1,'铃星':1,'地空':1,'地劫':1 };

  function miaoOf(palaceZhi, star){
    var M = root.ZW_MIAO;
    if (!M) return '';
    var m = M[palaceZhi];
    return (m && m[star]) || '';
  }
  function miaoW(palaceZhi, star){
    var v = miaoOf(palaceZhi, star);
    var W = { '庙':3, '旺':2, '利':1, '地':0, '平':0, '陷':-3 };
    return W[v] === undefined ? 0 : W[v];
  }

  /* ───────────────────────── 五、命宫 == 兼看财帛官禄迁移（《天纪》主原则） ───────────────────────── */
  /* 《天纪》：看命宫一定要同时兼看财帛、官禄、迁移；三方四正会不到科权禄，一辈子领薪水。 */
  function mingRule(c){
    var P = {}; for (var i = 0; i < c.palaces.length; i++) P[c.palaces[i].name] = c.palaces[i];
    var ming = P['命宫']; if (!ming) return '';
    var tri = root.zwTriad ? root.zwTriad(c, ming.zhi) : null;
    if (!tri) return '';
    /* 三方四正有没有会到科权禄 */
    var lu = 0, quan = 0, ke = 0, ji = 0, luNames = [], quanNames = [], keNames = [], jiNames = [];
    for (var q = 0; q < tri.huaList.length; q++){
      var s = tri.huaList[q];
      if (s.indexOf('化禄') >= 0){ lu++; luNames.push(s.split('@')[0]); }
      if (s.indexOf('化权') >= 0){ quan++; quanNames.push(s.split('@')[0]); }
      if (s.indexOf('化科') >= 0){ ke++; keNames.push(s.split('@')[0]); }
      if (s.indexOf('化忌') >= 0){ ji++; jiNames.push(s.split('@')[0]); }
    }
    var out = [];
    /* 命宫主星及其亮度 */
    var ms = ming.mainStars || [];
    if (!ms.length){
      out.push('命宫无主星（借对宫 ' + (P['迁移'] && P['迁移'].mainStars.join('、') || '—') + ' 看）：一生随外力摇摆，格局看对宫与三方。');
    } else {
      for (var m = 0; m < ms.length; m++){
        var st = ms[m], info = STAR[st], lv = miaoOf(ming.zhiName, st);
        var t = st + (lv ? '（' + lv + '）' : '');
        if (info) t += '：' + info.theme + '　' + info.job;
        out.push(t);
      }
    }
    /* 科权禄判断（《天纪》核心） */
    var all = lu + quan + ke;
    if (all === 0){
      out.push('命宫三方四正<b>会不到科权禄</b>：正才正官，一辈子替人做事、领薪水最稳（《天纪》原话：命中没有科权禄，领薪水就好）。');
    } else {
      var seg = [];
      if (lu) seg.push('禄（' + luNames.join('、') + '）');
      if (quan) seg.push('权（' + quanNames.join('、') + '）');
      if (ke) seg.push('科（' + keNames.join('、') + '）');
      out.push('命宫三方四正会到 <b>' + seg.join('、') + '</b>：' +
        (all >= 2 ? '不甘屈居人下，自己做事业的命' : '有一技之长可依，能出头但要看行运配合') +
        '（《天纪》：科权禄会到，一方之主）。');
    }
    if (ji) out.push('三方四正带 <b>化忌</b>（' + jiNames.join('、') + '）：这一环是本人的伤，也是「想不开」的地方 —— 遇事先松念头，念头松了做法才会变。');
    return out.join('');
  }

  /* ───────────────────────── 六、煞星判读（《天纪》吉处藏凶 / 凶处藏吉） ───────────────────────── */
  function shaRule(c, palaceName){
    var P = {}; for (var i = 0; i < c.palaces.length; i++) P[c.palaces[i].name] = c.palaces[i];
    var p = P[palaceName]; if (!p) return [];
    var out = [];
    var ji = 0, shaList = [];
    for (var s = 0; s < (p.stars || []).length; s++){
      var st = p.stars[s];
      if (SHA_SET[st]) shaList.push(st);
      if (JI_SET[st]) ji++;
    }
    var xian = [], miao = [];
    for (var k = 0; k < shaList.length; k++){
      var lv = miaoOf(p.zhiName, shaList[k]);
      if (lv === '陷') xian.push(shaList[k]);
      else if (lv === '庙' || lv === '旺') miao.push(shaList[k]);
    }
    if (!shaList.length) return out;
    if (xian.length && !ji){
      out.push('煞星 <b>' + xian.join('、') + '</b> 落陷、又无吉星同宫 —— 《天纪》所谓<b>吉处藏凶</b>，这一环必凶，是整张盘要盯的地方。');
    } else if (xian.length && ji){
      out.push('煞星 <b>' + xian.join('、') + '</b> 落陷，但宫中有吉星（' + ji + ' 颗）来化 —— 凶中带救，损伤减轻，仍要警戒。');
    }
    if (miao.length){
      out.push('煞星 <b>' + miao.join('、') + '</b> 入庙旺：按《天纪》「凶处藏吉」的理，这几颗煞反成助力 —— 武官星入庙最吉，主刚强能做事。');
    }
    /* 孤星独守 */
    var starCnt = (p.stars || []).length;
    if (shaList.length === 1 && starCnt <= 2 && miaoOf(p.zhiName, shaList[0]) === '陷'){
      out.push('该煞星近乎<b>孤星独守</b>：《天纪》讲煞星孤星独守时最凶，不但本宫凶，对宫也受牵动。');
    }
    return out;
  }

  /* ───────────────────────── 七、逐宫要点（按《天纪》各宫重点） ───────────────────────── */
  var PALACE_FOCUS = {
    '命宫': '看长相、天性、行为模式 —— 《天纪》：一看命宫就知道成败',
    '财帛': '私人企业、自己做老板的路；财星入财帛为正位',
    '官禄': '公家、当官的路；官禄最喜权星与科甲星',
    '夫妻': '婚姻；必兼看福德宫 —— 夫妻宫好而福德烂，一样散',
    '福德': '一世的福禄；女命福德即代表先生',
    '疾厄': '算致命伤，何时发病看流年',
    '迁移': '外地发展；命宫弱而迁移强，出外反而好',
    '交友': '合伙吉凶；太凶、都是耗星，合伙必败',
    '田宅': '祖业与自产；火星入田宅主火厄',
    '子女': '子息；子女宫空看对宫',
    '兄弟': '兄弟与合伙；化忌主不和、夭折、合伙破财',
    '父母': '父母与祖业；太阳看父、太阴看母'
  };

  var API = {
    STAR: STAR, HUA: HUA, SHA: SHA, PALACE_FOCUS: PALACE_FOCUS,
    miaoOf: miaoOf, miaoW: miaoW, mingRule: mingRule, shaRule: shaRule,
    hasTable: function(){ return !!root.ZW_MIAO; }
  };
  root.NiHaiXia = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
