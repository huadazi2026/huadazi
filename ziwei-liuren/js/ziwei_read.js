/* ================= 紫微斗数命盘解读与建议引擎 =================
   输入：ZiWei.chart() 返回的命盘对象 c（三合派安星结果）
   输出：结构化中文解读（headline/tags/summary/palaces/strengths/risks/
        career/wealth/love/health/timing/actionPlan/disclaimer）
   原则：
    1. 纯函数、无随机、无副作用：同一张盘同一 opts 结果完全一致
    2. 只引用盘面上真实存在的星曜、宫位、四化、大限、长生十二神
    3. ES5 语法（var/function），不依赖任何第三方库
    4. 星曜评分表严格按任务书：主星基础分 + 吉辅加 + 煞忌减 + 四化加减
   ==================== 对外：ZiWeiRead.analyze(c, opts) ==================== */
(function (root) {
  'use strict';

  var ZW = root.ZiWei || (typeof require !== 'undefined' ? require('./ziwei.js') : null);

  var GAN = '甲乙丙丁戊己庚辛壬癸';
  var ZHI = '子丑寅卯辰巳午未申酉戌亥';

  /* ============================================================
     一、评分表（任务书指定数值，全部表驱动）
     ============================================================ */
  var MAIN_SCORE = {
    '紫微': 85, '天府': 80, '天相': 78, '天梁': 75, '太阳': 72, '太阴': 72,
    '武曲': 70, '天同': 68, '天机': 66, '巨门': 58, '廉贞': 60, '贪狼': 62,
    '七杀': 52, '破军': 48
  };
  var FU_SCORE = { '左辅': 6, '右弼': 6, '文昌': 5, '文曲': 5, '天魁': 5, '天钺': 5, '禄存': 8, '天马': 2 };
  var SHA_SCORE = { '擎羊': -8, '陀罗': -6, '火星': -5, '铃星': -5, '地空': -6, '地劫': -6 };
  var HUA_SCORE = { '化禄': 8, '化权': 6, '化科': 5, '化忌': -12 };
  var FU_NAMES = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存', '天马'];
  var SHA_NAMES = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];
  var EMPTY_BASE = 45;       /* 空宫（无主星）基础分 */
  var SCORE_MIN = 5, SCORE_MAX = 95;

  /* 煞星风险语义（用于 reading / risks / actionPlan 说明，不新增星名） */
  var SHA_DESC = {
    '擎羊': '正面冲突与刑伤',
    '陀罗': '拖延纠缠与暗耗',
    '火星': '急躁爆发与意外',
    '铃星': '闷气暗斗与突发',
    '地空': '空想落空与破局',
    '地劫': '破财劫夺与冒险'
  };

  /* ============================================================
     二、星曜语义表（组合解读、事业、财运、感情、健康全靠它驱动）
     ============================================================ */
  var STAR_TRAIT = {
    '紫微': { t: '尊贵自持、善统筹、爱面子', tg: ['领导欲', '重体面'], job: ['企业管理', '政务与事业单位', '品牌与对外关系'], bad: ['没有决策权的纯执行岗'] },
    '天机': { t: '机敏善谋、思路快、易多虑', tg: ['善谋', '多思'], job: ['企划与战略', '研发与产品', '咨询与顾问'], bad: ['重复性事务岗'] },
    '太阳': { t: '外向肯付出、重名声、爱扛事', tg: ['肯付出', '重名声'], job: ['公职与教育', '传媒与公关', '销售与客户经营'], bad: ['长期幕后、没有曝光的位置'] },
    '武曲': { t: '刚毅直接、重执行、认数字', tg: ['执行力强', '财务脑'], job: ['金融与财务', '实业与制造管理', '销售与结算'], bad: ['需要大量情绪安抚的服务岗'] },
    '天同': { t: '温和随性、重感受、易知足', tg: ['温和', '会享受'], job: ['服务与餐饮', '文创与内容', '行政与人资'], bad: ['高压强考核的纯销售岗'] },
    '廉贞': { t: '个性强、爱憎分明、讲规矩也懂人情', tg: ['硬骨头', '重纪律'], job: ['公职与纪律部门', '精密制造与半导体', '公关与商务谈判'], bad: ['灰色地带的业务'] },
    '天府': { t: '稳重守成、会攒会算、能包容', tg: ['稳健', '会理财'], job: ['财务与资产管理', '供应链与仓储', '行政总务'], bad: ['高风险投机'] },
    '太阴': { t: '细腻内敛、重细节、恋家', tg: ['细腻', '务实'], job: ['行政与财务', '房产与空间设计', '内容与文案'], bad: ['强攻陌生市场的开拓岗'] },
    '贪狼': { t: '欲望强、多才多艺、擅交际', tg: ['交际手', '多才艺'], job: ['业务与公关', '娱乐与内容', '餐饮与生活方式'], bad: ['清苦封闭的技术岗'] },
    '巨门': { t: '口才锋利、爱钻研、易招是非', tg: ['口才好', '易招是非'], job: ['法律与教师', '研究与分析', '销售与谈判'], bad: ['需要长期沉默的岗位'] },
    '天相': { t: '重公正、讲体面、擅长辅佐', tg: ['辅佐型', '重规则'], job: ['管理与协调', '法务与合规', '项目与秘书工作'], bad: ['独断型创业一把手'] },
    '天梁': { t: '老成持重、爱管事、有长辈缘', tg: ['老成', '爱管事'], job: ['医疗与教育', '法务与风控', '顾问与审计'], bad: ['快进快出的短线投机'] },
    '七杀': { t: '果断独立、能扛能拼、易受伤', tg: ['开创', '硬扛'], job: ['创业与自营', '工程施工与技术', '军警与竞技体育'], bad: ['层层审批的冗长体制'] },
    '破军': { t: '破旧立新、敢推翻、耗损偏大', tg: ['敢破立', '折腾'], job: ['创业与重组', '技术攻关', '市场开拓'], bad: ['需要长期守成的岗位'] }
  };

  /* 单星独坐气场（与组合说明互补，不重复；控制长度以留出三方四正位置） */
  var SOLO_NOTE = {
    '紫微': '主见强，容易听不进劝',
    '天机': '主意快，最怕反复改方案',
    '太阳': '热心外放，付出多于回报',
    '武曲': '认钱认理，沟通要多练',
    '天同': '日子舒服，动力靠外推',
    '廉贞': '个性硬，冲突时先降温',
    '天府': '稳当会攒，出手偏慢',
    '太阴': '心思细，靠专业慢慢积累',
    '贪狼': '才艺人缘好，最怕贪多',
    '巨门': '口才强，忌逞一时口舌',
    '天相': '重体面讲规矩，宜守',
    '天梁': '老成爱管事，易替人担责',
    '七杀': '独立能扛，缓冲要留足',
    '破军': '变动耗损大，宜专注一件'
  };

  /* 双星同宫组合说明（键用 a+b，两向都查） */
  var PAIR_NOTE = {
    '紫微+天府': '帝星配库星，守得住',
    '紫微+破军': '帝星带耗星，破后重建',
    '紫微+贪狼': '帝星配桃花，交际强',
    '紫微+天相': '帝星配印星，重规矩',
    '紫微+七杀': '帝星配将星，杀气重',
    '天机+太阴': '机敏配细腻，脑力活',
    '天机+巨门': '机变配口舌，易招怨',
    '天机+天梁': '机智配老成，顾问型',
    '太阳+太阴': '日月同宫，内外拉扯',
    '太阳+巨门': '阳光照亮暗星，靠嘴',
    '太阳+天梁': '热心配荫星，长辈缘',
    '武曲+天府': '财星遇库星，会理财',
    '武曲+贪狼': '财星配欲望，敢赚敢花',
    '武曲+天相': '财星配印星，有章法',
    '武曲+七杀': '财星配将星，刚硬实干',
    '武曲+破军': '财星带耗星，进出都大',
    '天同+太阴': '福星配富星，重享受',
    '天同+巨门': '福星遇暗星，心里戏多',
    '天同+天梁': '福星配荫星，有福有靠',
    '廉贞+天府': '囚星配库星，懂规矩',
    '廉贞+贪狼': '囚星配桃花，才情旺',
    '廉贞+天相': '囚星配印星，重形象',
    '廉贞+七杀': '囚星配将星，硬碰硬',
    '廉贞+破军': '囚星带耗星，变动多',
    '天府+太阴': '库星配富星，守成强',
    '天府+天相': '库星配印星，稳重体面',
    '太阴+天同': '富星配福星，安稳变厚',
    '巨门+天同': '暗星配福星，嘴硬心软',
    '天相+天梁': '印星配荫星，爱管事'
  };

  /* 煞星短语（reading 状态句用，短） */
  var SHA_SHORT = {
    '擎羊': '冲突刑伤', '陀罗': '拖延暗耗', '火星': '急躁突发',
    '铃星': '闷气暗斗', '地空': '空想落空', '地劫': '破财劫夺'
  };

  /* 化权宫的主事动作（按宫位给出可执行动作，避免「在疾厄争位置」这类错配） */
  var QUAN_ACT = {
    '命宫': '把个人定位写成一句话：你是谁能解决什么问题，在简历与社交场合反复用',
    '兄弟': '在同辈与合伙关系里主导分工与分账规则，先立规矩再谈感情',
    '夫妻': '主导家庭分工与财务安排，把每月对账做成固定动作',
    '子女': '主导带人与育儿安排，定三条规矩并自己先做到',
    '财帛': '争取预算权与定价权，把自己创造的价值做成可查的数据',
    '疾厄': '自己排体检、睡眠与运动计划并写进日历，身体不交给别人安排',
    '迁移': '主动争取外派、出差或对外代表的机会，把外部资源握在自己手里',
    '交友': '主导团队与圈子的用人安排，重要合作由你定规则',
    '官禄': '主动争取负责人、组长或对外代表的位置，把成果留成可查记录',
    '田宅': '主导房产、储蓄与家庭资产的决定，大额支出自己拍板并留痕',
    '福德': '主导自己的休息与兴趣安排，把时间先留给自己再给工作',
    '父母': '与长辈或上司争取授权与资源，重要决定先听完再表态'
  };

  /* 化科宫的文书动作 */
  var KE_ACT = {
    '命宫': '把专业名分做实：考一张行业认可的证书，或做一个能公开拿出来的作品',
    '兄弟': '把与同辈的合作写成正式协议，并做一次公开复盘',
    '夫妻': '把感情里的重大约定写下来，必要时做一份书面约定',
    '子女': '把带人的方法整理成可复用的流程或课程',
    '财帛': '考一张与专业能力相关的证书，把收入与支出做成一张表',
    '疾厄': '建立自己的健康档案：体检报告、用药与作息，每年更新',
    '迁移': '把异地与出差的经历整理成可展示的成果',
    '交友': '把圈子与合作伙伴整理成名册，注明各自能提供的资源',
    '官禄': '考取与岗位相关的资格证书，把成果写成案例集',
    '田宅': '把房产与家庭资产的证件、合同、保单一处归档',
    '福德': '学一门能长期玩的技艺，让兴趣有可展示的成果',
    '父母': '与长辈或上司做一次正式汇报或请教，并留下书面记录'
  };

  /* 命宫三方四正成格短语（由主星组合 + 分数决定，不编造） */
  var GS_LEAD = {
    '紫微|破军': '开创建功型',
    '紫微|天府': '掌资源守成型',
    '紫微|七杀': '独当一面型',
    '紫微|贪狼': '交际经营型',
    '紫微|天相': '辅佐协调型',
    '武曲|七杀': '硬核实干型',
    '武曲|贪狼': '敢赚敢花型',
    '武曲|天府': '稳中求财型',
    '天机|太阴': '脑力细活型',
    '天机|巨门': '思辨表达型',
    '天机|天梁': '专业顾问型',
    '太阳|巨门': '开口吃饭型',
    '太阳|天梁': '热心荫庇型',
    '廉贞|贪狼': '才情交际型',
    '廉贞|破军': '破立冲撞型',
    '天同|天梁': '有福有靠型',
    '太阴': '心思细，靠专业慢慢积累',
    '天府': '稳当会攒，出手偏慢',
    '巨门': '口才强，忌逞一时口舌',
    '天相': '重体面讲规矩，宜守',
    '七杀': '独立能扛，缓冲要留足',
    '破军': '变动耗损大，宜专注一件',
    '太阳': '热心外放，付出多于回报',
    '天同': '日子舒服，动力靠外推',
    '天机': '主意快，最怕反复改方案',
    '武曲': '认钱认理，沟通要多练',
    '贪狼': '才艺人缘好，最怕贪多',
    '天梁': '老成爱管事，易替人担责',
    '紫微': '主见强，容易听不进劝',
    '廉贞': '个性纪律型'
  };

  /* 财帛宫赚钱模式（按主星取，取不到用平台型兜底） */
  var WEALTH_STYLE = {
    '武曲': '正财为主、认数字、靠本事定价',
    '天府': '会攒会算，适合长期持有慢慢变厚',
    '太阴': '靠专业与细节挣钱，进项细水长流',
    '禄存': '财来得稳，靠积累不靠爆发',
    '贪狼': '靠人脉、机会与应酬来钱，波动偏大',
    '廉贞': '靠规矩内的实权与项目分成挣钱',
    '天机': '靠脑力、企划与信息差换钱',
    '巨门': '靠口才、专业与内容变现',
    '七杀': '敢冲敢拼，进出都大，成败在一两次决断',
    '破军': '靠变动与重组挣钱，必须先破后立',
    '天同': '靠平台与稳定现金流，赚得不猛但耐久',
    '天梁': '靠资历、专业与口碑收费',
    '天相': '靠流程、服务与中间角色挣钱',
    '紫微': '靠管理位与资源调配挣钱',
    '太阳': '靠名声、外拓与公职体系挣钱'
  };

  /* 夫妻宫感情模式 */
  var LOVE_STYLE = {
    '紫微': '配偶气场强，你也不肯让位，要提前分好工',
    '天机': '想法多变化快，容易在犹豫里错过时机',
    '太阳': '你付出多也爱张罗，须防一头热',
    '武曲': '表达偏直、重实际，甜言少但肯负责',
    '天同': '重视相处舒服，容易被情绪带着走',
    '廉贞': '爱得浓烈也爱较劲，争的常是对错',
    '天府': '要稳定与安全感，择偶看条件与家底',
    '太阴': '感情细腻内敛，容易把话憋在心里',
    '贪狼': '桃花多应酬多，选择多却难定下来',
    '巨门': '沟通是双刃剑，好也靠嘴、闹也靠嘴',
    '天相': '重伴侣形象与体面，讲究相处规矩',
    '天梁': '容易照顾对方或吸引年长者，像家人相处',
    '七杀': '来得快决断快，激情强但磨合硬',
    '破军': '感情起伏大，旧关系容易推倒重来'
  };

  /* 宫位领域关键词（由 ZiWei.PALACE_DESC 缩写出，用于造句） */
  var FOCUS = {
    '命宫': '自身定位', '兄弟': '同辈与合伙', '夫妻': '感情与婚姻', '子女': '子女与带人',
    '财帛': '现金流', '疾厄': '身体与情绪', '迁移': '外出与环境', '交友': '朋友与部属',
    '官禄': '事业', '田宅': '房产与家底', '福德': '精神享受', '父母': '长辈与上司'
  };

  /* 长生十二神落宫的阶段含义（真实盘面字段 p.changsheng） */
  var CS_MEAN = {
    '长生': '气刚起来，适合起步布局',
    '沐浴': '动荡多试，宜守不宜赌',
    '冠带': '渐入正轨，适合立规矩',
    '临官': '正当位，宜主动用事',
    '帝旺': '气势最盛，宜进也防过刚',
    '衰': '势头转缓，宜收束战线',
    '病': '气弱多虑，宜调养与修补',
    '死': '旧路走不通，宜换赛道',
    '墓': '入库收藏，适合积累储备',
    '绝': '低谷转折，宜重新定位',
    '胎': '萌芽未定，宜低调孕育',
    '养': '待时而长，宜养精蓄锐'
  };

  /* 五行 → 需留意的部位与对应体检项（疾厄宫主星五行） */
  var WX_ORGAN = {
    '木': { organ: '肝胆、筋骨与眼睛', check: '肝功能与腹部超声' },
    '火': { organ: '心血管、血压与睡眠', check: '心电图、血脂与血压' },
    '土': { organ: '脾胃与消化系统', check: '胃部检查与幽门螺杆菌筛查' },
    '金': { organ: '肺与呼吸道、大肠、皮肤', check: '胸部影像与肠镜' },
    '水': { organ: '肾与泌尿生殖、内分泌', check: '肾功能、尿常规与甲状腺功能' }
  };

  /* ============================================================
     三、宫位建议模板（25-50 字，全部为可执行动作）
     每个模板为子句数组，pack() 会按长度窗口自动取用
     ============================================================ */
  var ADVICE = {
    '命宫': {
      base: ['每年生日前后做一次复盘，写下三件要停的事，比新增计划更有用', '把每天状态最好的两小时留给主线，其余时间再处理人情与杂事'],
      fu: ['{fu}坐命，把贵人当资源管理：每季度带着具体成果主动联系一次', '把成果整理成一页纸的作品集，遇到机会当场就能拿出来'],
      sha: ['{sha}入命，重大决定隔夜再定，发言前先把结论写成一句话说清', '冲突现场先离开十分钟再回应，避免把话说死没有退路'],
      ji: ['命宫{ji}化忌，先砍自我消耗：同时进行的项目减到两件，做完再开新的', '把必须完成的事写在纸上，完成一件划掉一件，别同时在脑子里排队'],
      empty: ['命宫空宫借对宫{dui}之星，先模仿你在意的那个人做事的方式，再长出自己的一套', '每半年做一次自我盘点：擅长什么、被谁需要、下一步补什么']
    },
    '兄弟': {
      base: ['与同辈或兄弟合伙先小后大，先用一单可结算的小生意试彼此默契', '把分成比例与退出条件写进一张纸，再开始谈感情和交情'],
      sha: ['{sha}在兄弟，同辈与合伙人最容易起争执，重要约定一律落到文字上'],
      fu: ['{fu}在兄弟，同辈是你的助力，主动把手上资源介绍给靠谱的人', '每年主动帮同辈撮合一次合作，人情账要存不要只取'],
      ji: ['兄弟{ji}化忌，与同辈合伙最容易翻脸，账目务必每月公开对一次', '合作前先定止损线与退出方式，写清谁说了算、谁签字'],
      empty: ['兄弟空宫借对宫{dui}之星，同辈助力偏弱，重要的事自己先扛住再谈合作']
    },
    '夫妻': {
      base: ['把需求说成三条可执行的约定：时间、金钱、家务，各写一条并每月核对'],
      fu: ['{fu}入夫妻，主动固定每周一次的二人时间，好意要说出口别憋在心里'],
      sha: ['{sha}在夫妻，婚前把钱、生育、与父母同住三件事谈清楚再谈婚期'],
      ji: ['夫妻{ji}化忌，吵架定规矩：不翻旧账、不查手机、不拉长辈进来评理', '每月安排一次只谈感受不谈对错的沟通，时间定死不要临时改'],
      empty: ['夫妻空宫借对宫{dui}之星，感情节奏放慢，先做三年朋友式相处再谈定下来']
    },
    '子女': {
      base: ['给孩子或晚辈定三条硬规矩并全家一致执行，其余放手，比天天说教有用'],
      fu: ['{fu}在子女，带人带团队是你的加分项，主动争取带一名新人或实习生'],
      sha: ['{sha}在子女，与晚辈合作先做三个月的小项目，再谈长期绑定和分成'],
      ji: ['子女{ji}化忌，生育与带人的计划多波折，先做体检与时间表再定节点'],
      empty: ['子女空宫借对宫{dui}之星，带人的事靠耐心与规矩，别指望一步到位']
    },
    '财帛': {
      base: ['工资到账先划出固定比例做长期储蓄，剩下的再花，顺序千万别反'],
      fu: ['{fu}在财帛，用定期定额接住这份财气，设置自动扣款，别手动操作'],
      sha: ['{sha}在财帛，不做担保、不碰杠杆，借出去的钱按收不回来的额度算'],
      ji: ['财帛{ji}化忌，收入容易断档，务必留足六个月生活费的现金垫', '副业与主业分开记账，每季度对一次总账，找出最大的漏点'],
      empty: ['财帛空宫借对宫{dui}之星，靠技能与他人平台挣钱，别把本金压在一个渠道']
    },
    '疾厄': {
      base: ['固定作息与体检节奏：每年一次全面体检，每周三次有氧各三十分钟'],
      sha: ['{sha}在疾厄，{organ}最需留意，先做针对性检查，别拖成慢性病'],
      ji: ['疾厄{ji}化忌，压力先落在{organ}上，把睡眠与复查时间写进日历提醒'],
      fu: ['{fu}在疾厄，体质底子不差，把运动和睡眠当成固定项目而不是补救'],
      empty: ['疾厄空宫借对宫{dui}之星，体质随情绪与作息波动，规律作息比进补有用']
    },
    '迁移': {
      base: ['每年主动接一两个异地或对外的项目，行程与备用联系人提前留给家人'],
      fu: ['{fu}在迁移，外出与外部平台是你的舞台，简历多投外地和跨区域机会'],
      sha: ['{sha}在迁移，出差与自驾都要留足缓冲时间，行程别排满、别抢末班车'],
      ji: ['迁移{ji}化忌，换城市或换环境的决定最易反复，先试行三个月再搬家'],
      empty: ['迁移空宫借对宫{dui}之星，外出际遇看别人脸色，先攒本事再走出去']
    },
    '交友': {
      base: ['合作先分清钱和责任再谈感情，借钱只借能当作送出去的额度'],
      sha: ['{sha}在交友，合作前查清对方底细，重要合作一定要有书面文件'],
      ji: ['交友{ji}化忌，最容易被朋友拖累，合伙生意要设退出条款与止损线'],
      fu: ['{fu}在交友，主动维护十个人的核心圈子，每季度带着近况联系一次'],
      empty: ['交友空宫借对宫{dui}之星，人脉靠一个个项目攒出来，别指望饭局交情']
    },
    '官禄': {
      base: ['把工作拆成两周一次的可见交付，主动向上级同步进度，别等年终总结'],
      fu: ['{fu}在官禄，主动申请带人或对外露脸的项目，把成果写进周报和简历'],
      sha: ['{sha}在官禄，跳槽与签约前把职责、考核、股权条款逐条问清再签字'],
      ji: ['官禄{ji}化忌，别在资历型岗位上硬耗，转做能出成品、可量化的活', '每年至少做出一件能拿出来讲的成果，别只堆工龄'],
      empty: ['官禄空宫借对宫{dui}之星，前三年跟对团队比选对岗位重要，跟人走']
    },
    '田宅': {
      base: ['先攒够十二个月生活费，再考虑房贷或第二套房，月供不超收入三成'],
      fu: ['{fu}在田宅，房产与长期资产是你的财库，优先把自住房与保险配齐'],
      sha: ['{sha}在田宅，买房前把产权、物业、邻里与维修记录查清再签约'],
      ji: ['田宅{ji}化忌，家宅与房产易生反复，装修与买卖都要留一笔备用金'],
      empty: ['田宅空宫借对宫{dui}之星，家底靠自己攒，先做强制储蓄再谈置业']
    },
    '福德': {
      base: ['每周留两小时做一件不带手机的兴趣事，精神账户也要定期充值'],
      sha: ['{sha}在福德，情绪起伏偏大，把睡眠与运动排在娱乐和加班前面'],
      ji: ['福德{ji}化忌，容易钻牛角尖，定一条规则：夜里十一点后不做决定'],
      fu: ['{fu}在福德，享受与兴趣是你的复原力，每月固定安排一次短途出行'],
      empty: ['福德空宫借对宫{dui}之星，快乐要自己主动安排，不能等环境给']
    },
    '父母': {
      base: ['与长辈上级保持固定沟通节奏，重大决定先听完再表态，别当场反驳'],
      sha: ['{sha}在父母，与长辈上司容易硬碰，重要分歧一律改用书面沟通一次'],
      ji: ['父母{ji}化忌，与长辈或上司易结疙瘩，主动定期汇报能化解大半'],
      fu: ['{fu}在父母，长辈与上司是你的资源，逢年过节别断联系和问候'],
      empty: ['父母空宫借对宫{dui}之星，长辈助力有限，早独立、早主动汇报']
    }
  };

  /* 宫位小结语（pack 的补足子句，具体到该宫该做什么） */
  var KICKER = {
    '命宫': '先改这里的习惯，比改运气有用',
    '兄弟': '同辈与合伙的事要主动设边界',
    '夫妻': '亲密关系靠约定不靠猜',
    '子女': '带人靠规矩不靠情绪',
    '财帛': '钱的进出要留痕、要分批',
    '疾厄': '身体的事要提前管、不能拖',
    '迁移': '往外走要提前布局',
    '交友': '人脉要筛选，不要全接',
    '官禄': '事业靠可交付的成果说话',
    '田宅': '家底要一笔一笔攒出来',
    '福德': '精神账户要定期充值',
    '父母': '与长辈的沟通要固定节奏'
  };

  /* 行动清单：化忌宫 / 化禄宫 / 大限宫 / 煞重宫 的具体动作 */
  var ACT_AVOID = {
    '命宫': '停掉一件长期消耗你的事，把每天状态最好的两小时留给主线',
    '兄弟': '与同辈兄弟的金钱往来先立字据，合作设三个月试用期',
    '夫妻': '和伴侣约法三章：不翻旧账、不当着长辈争执、每月对一次账',
    '子女': '带孩子或带人别用情绪推动，定三条硬规矩其余放手',
    '财帛': '留足六个月生活费的现金垫，停掉所有分期与高风险投资',
    '疾厄': '把体检、睡眠与压力当项目管理，症状两周不消就就医',
    '迁移': '换城市或换环境的决定先试行三个月，再谈搬迁',
    '交友': '朋友合伙要写清退出条款，借钱按收不回来的额度算',
    '官禄': '别在资历型岗位硬耗，转做能出成品、可量化的活',
    '田宅': '买房装修留出两成备用金，产权与合同逐条核对',
    '福德': '夜里十一点后不做决定，每周留两小时给自己',
    '父母': '与长辈上级改成定期汇报，分歧用书面沟通'
  };
  var ACT_GAIN = {
    '命宫': '把最大的精力押在你最擅长的那件事上，其他一律降级',
    '兄弟': '多与同辈交换资源，合作先从一单可结算的小事开始',
    '夫妻': '把感情当资产经营：固定每周一次的二人时间',
    '子女': '带人带团队是你的加分项，主动争取带一名新人',
    '财帛': '把每月固定比例的收入自动转入长期账户，别手动操作',
    '疾厄': '把身体当本钱投：每周三次有氧、每年一次完整体检',
    '迁移': '每年主动接一两个异地或对外项目，往外走机会更多',
    '交友': '主动维护十个人的核心圈子，每季度联系一次',
    '官禄': '主动申请对外露脸或带人的项目，把成果写进周报',
    '田宅': '先攒够十二个月生活费，再考虑房贷或第二套房',
    '福德': '给兴趣留固定预算和时间，精神账户也要充值',
    '父母': '多向上辈与贵人请教，重要决定先听他们的经验'
  };

  /* 流年命宫落宫的年度主题 */
  var YEAR_ACTION = {
    '命宫': '适合重塑个人定位与形象',
    '兄弟': '适合整合同辈与合伙资源',
    '夫妻': '感情事宜主动推进、早点定',
    '子女': '适合带人带团队或做育儿规划',
    '财帛': '适合开源、调整收入结构',
    '疾厄': '身体与情绪要放在第一位',
    '迁移': '适合外出、异地与换环境',
    '交友': '适合筛朋友、清圈子',
    '官禄': '适合争取职位与关键项目',
    '田宅': '适合处理房产、家事与储蓄',
    '福德': '适合休息、学习与调心',
    '父母': '适合向上沟通、借长辈资源'
  };

  /* ============================================================
     四、基础工具
     ============================================================ */
  /* 去标点后的字数（判断下限用；总长 ≤ max 判断用 length，两种口径都满足） */
  function cjk(s) { return String(s).replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '').length; }
  function trimTail(s) { return String(s).replace(/[，、；,;。.\s]+$/, ''); }
  function lastChar(s) { return s.charAt(s.length - 1); }

  /* 按子句数组拼装文本：
     依次追加子句直到超过 max（含标点总长），不足 min（去标点字数）时用 pads 补足 */
  function pack(clauses, min, max, pads) {
    var out = '', i, cand;
    for (i = 0; i < clauses.length; i++) {
      if (!clauses[i]) continue;
      cand = (out === '' ? '' : out + '，') + trimTail(clauses[i]);
      if (out !== '' && cand.length + 1 > max) break;
      out = cand;
    }
    if (out === '') return '';
    if (pads) {
      for (i = 0; i < pads.length; i++) {
        if (cjk(out) >= min) break;
        if (!pads[i]) continue;
        cand = out + '，' + trimTail(pads[i]);
        if (cand.length + 1 > max) continue;   /* 本条补语太长，试下一条更短的 */
        out = cand;
      }
    }
    if (out.length + 1 > max) out = trimTail(out.substring(0, max - 1));
    return out + '。';
  }

  /* 占位符替换：{key} */
  function fmt(tpl, map) {
    return String(tpl).replace(/\{(\w+)\}/g, function (m, k) {
      return (map && map[k] !== undefined && map[k] !== null) ? String(map[k]) : '';
    });
  }

  function uniq(arr) {
    var out = [], i, j, hit;
    for (i = 0; i < arr.length; i++) {
      hit = false;
      for (j = 0; j < out.length; j++) if (out[j] === arr[i]) { hit = true; break; }
      if (!hit && arr[i]) out.push(arr[i]);
    }
    return out;
  }

  function take(arr, n) { return arr.slice(0, n); }

  /* 宫名补「宫」字：只有「命宫」自带宫字，其余宫名要补 */
  function pn(name) { return name.charAt(name.length - 1) === '宫' ? name : name + '宫'; }

  /* 宫位快捷方式 */
  function byName(c, name) {
    for (var i = 0; i < c.palaces.length; i++) if (c.palaces[i].name === name) return c.palaces[i];
    return null;
  }
  function byZhi(c, z) { return c.palaces[((z % 12) + 12) % 12]; }
  function duiOf(c, p) { return byZhi(c, p.zhi + 6); }
  function sanFang(c, p) {
    return [p, byZhi(c, p.zhi + 4), byZhi(c, p.zhi + 8), byZhi(c, p.zhi + 6)];
  }
  function shaOf(p) {
    var out = [], i;
    for (i = 0; i < SHA_NAMES.length; i++) if (p.stars.indexOf(SHA_NAMES[i]) >= 0) out.push(SHA_NAMES[i]);
    return out;
  }
  function fuOf(p) {
    var out = [], i;
    for (i = 0; i < FU_NAMES.length; i++) if (p.stars.indexOf(FU_NAMES[i]) >= 0) out.push(FU_NAMES[i]);
    return out;
  }
  function huaOf(p, hua) {
    for (var i = 0; i < p.hua.length; i++) if (p.hua[i].hua === hua) return p.hua[i].star;
    return '';
  }
  function huaList(p) { return p.hua || []; }

  /* 宫位星曜显示串（含四化后缀，如「太阴化权、陀罗」） */
  function starDisplay(p, c) {
    var arr = [], i, s;
    for (i = 0; i < p.stars.length; i++) {
      s = p.stars[i];
      arr.push((c.huaMap && c.huaMap[s]) ? s + c.huaMap[s] : s);
    }
    return arr.join('、');
  }

  /* 主星简称（最多 n 颗，带四化后缀）；空宫返回「空宫」或「空宫借X」 */
  function shortStars(p, n, c) {
    var arr = [], i, s, lim = n || 2;
    for (i = 0; i < p.mainStars.length && arr.length < lim; i++) {
      s = p.mainStars[i];
      arr.push(huaOf(p, '化禄') === s ? s + '化禄'
        : huaOf(p, '化权') === s ? s + '化权'
          : huaOf(p, '化科') === s ? s + '化科'
            : huaOf(p, '化忌') === s ? s + '化忌' : s);
    }
    if (arr.length) return arr.join('、');
    return c ? '空宫借' + borrowStar(c, p) : '空宫';
  }

  /* 引用串：主星（最多 n 颗，带四化），空宫给借星，必要时补 1-2 颗重要辅煞 */
  function citeStars(p, c, n) {
    var s = shortStars(p, n || 2, c), extra = [], i;
    for (i = 0; i < p.stars.length && extra.length < 2; i++) {
      if (p.mainStars.indexOf(p.stars[i]) < 0 && FU_NAMES.indexOf(p.stars[i]) < 0 && SHA_NAMES.indexOf(p.stars[i]) < 0) continue;
      if (p.mainStars.indexOf(p.stars[i]) < 0) extra.push(p.stars[i]);
    }
    if (extra.length) s += '、' + extra.join('、');
    return s;
  }

  /* 借星：本宫无主星时取对宫主星 */
  function borrowStar(c, p) {
    var d = duiOf(c, p);
    if (d && d.mainStars.length) return d.mainStars.join('、');
    if (d) {
      var s3 = sanFang(c, d), i, j;
      for (i = 0; i < s3.length; i++) {
        for (j = 0; j < s3[i].mainStars.length; j++) return s3[i].mainStars[j];
      }
    }
    return '对宫之星';
  }

  /* 主星组合名 */
  function comboName(p, c) {
    if (p.mainStars.length === 0) return '空宫借对宫' + borrowStar(c, p);
    if (p.mainStars.length === 1) return p.mainStars[0] + '独坐';
    return p.mainStars[0] + p.mainStars[1] + '同宫';
  }

  function pairNote(a, b) {
    var k1 = a + '+' + b, k2 = b + '+' + a;
    if (PAIR_NOTE[k1]) return PAIR_NOTE[k1];
    if (PAIR_NOTE[k2]) return PAIR_NOTE[k2];
    var ta = STAR_TRAIT[a] ? STAR_TRAIT[a].t.split('、')[0] : a;
    var tb = STAR_TRAIT[b] ? STAR_TRAIT[b].t.split('、')[0] : b;
    return ta + '碰上' + tb + '，两种劲头要分场合用';
  }

  function gradeOf(s) {
    if (s >= 72) return '偏强，格局立得住';
    if (s >= 58) return '中上，走稳能成';
    if (s >= 45) return '平平，要靠后天补';
    return '偏弱，宜先守后攻';
  }
  /* 无逗号短评（用于时间线等紧凑句） */
  function gradeShortOf(s) {
    if (s >= 72) return '偏强';
    if (s >= 58) return '中上';
    if (s >= 45) return '平平';
    return '偏弱';
  }
  function bandOf(s) {
    if (s >= 78) return '此宫是盘上的强位';
    if (s >= 62) return '此宫中上，稳中带变';
    if (s >= 48) return '此宫平平，要靠后天来补';
    if (s >= 35) return '此宫偏弱，宜守不宜攻';
    return '此宫是盘上的弱位，须格外经营';
  }

  /* 干支年 → 干支名与索引（仅流年推算用，公式与 LunarCore.yearGZ 一致） */
  function yearGZName(y) {
    var gz = ((y - 4) % 60 + 60) % 60;
    return { gz: gz, gan: gz % 10, zhi: gz % 12, name: GAN.charAt(gz % 10) + ZHI.charAt(gz % 12) };
  }

  /* ============================================================
     五、宫位评分（严格按任务书评分表）
     ============================================================ */
  function scorePalace(p) {
    var i, base;
    if (p.mainStars.length === 0) {
      base = EMPTY_BASE;                                   /* 空宫 45 */
    } else {
      base = 0;
      for (i = 0; i < p.mainStars.length; i++) base += (MAIN_SCORE[p.mainStars[i]] || 60);
      base = base / p.mainStars.length;
    }
    for (i = 0; i < p.stars.length; i++) {                  /* 吉辅加 / 煞忌减 */
      if (FU_SCORE[p.stars[i]] !== undefined) base += FU_SCORE[p.stars[i]];
      if (SHA_SCORE[p.stars[i]] !== undefined) base += SHA_SCORE[p.stars[i]];
    }
    for (i = 0; i < p.hua.length; i++) base += (HUA_SCORE[p.hua[i].hua] || 0);   /* 四化 */
    base = Math.round(base);
    if (base < SCORE_MIN) base = SCORE_MIN;
    if (base > SCORE_MAX) base = SCORE_MAX;
    return base;
  }

  /* ============================================================
     六、上下文：分数、四化落宫、大限、流年
     ============================================================ */
  function buildCtx(c, opts) {
    var i, j, p, ctx = { c: c, scores: [], scoreOf: {} };

    for (i = 0; i < c.palaces.length; i++) {
      p = c.palaces[i];
      ctx.scores[i] = scorePalace(p);
      ctx.scoreOf[p.name] = ctx.scores[i];
    }

    ctx.hua = { '化禄': [], '化权': [], '化科': [], '化忌': [] };
    for (i = 0; i < c.palaces.length; i++) {
      p = c.palaces[i];
      for (j = 0; j < p.hua.length; j++) {
        ctx.hua[p.hua[j].hua].push({ star: p.hua[j].star, palace: p, idx: i, score: ctx.scores[i] });
      }
    }
    ctx.lu = ctx.hua['化禄'][0] || null;
    ctx.quan = ctx.hua['化权'][0] || null;
    ctx.ke = ctx.hua['化科'][0] || null;
    ctx.ji = ctx.hua['化忌'][0] || null;

    /* 命宫三方四正（命/官禄/财帛/迁移）平均分 → 格局高低 */
    var group = ['命宫', '官禄', '财帛', '迁移'], gs = 0, gn = 0, gp = [];
    for (i = 0; i < group.length; i++) {
      p = byName(c, group[i]);
      if (!p) continue;
      gp.push(p);
      gs += ctx.scoreOf[p.name];
      gn++;
    }
    ctx.groupPalaces = gp;
    ctx.groupScore = gn ? Math.round(gs / gn) : 50;

    /* 虚岁与大限：优先 opts.age，其次 opts.currentYear，都没有则用当前年份 */
    var info = c.info || {};
    var birthYear = info.ganZhiYear || (info.input ? info.input.y : 1900);
    ctx.birthYear = birthYear;
    if (opts.age) { ctx.age = opts.age; ctx.currentYear = birthYear + opts.age - 1; }
    else if (opts.currentYear) { ctx.currentYear = opts.currentYear; ctx.age = opts.currentYear - birthYear + 1; }
    else { ctx.currentYear = new Date().getFullYear(); ctx.age = ctx.currentYear - birthYear + 1; }
    if (ctx.age < 1) ctx.age = 1;

    var lim = null;
    for (i = 0; i < c.palaces.length; i++) {
      p = c.palaces[i];
      if (p.limit && ctx.age >= p.limit.from && ctx.age <= p.limit.to) { lim = p; break; }
    }
    ctx.limitStarted = !!lim;
    ctx.limitBeyond = false;
    if (!lim) {
      /* 未起运（岁数小于局数）→ 取第一大限所在命宫；已超出十二大限 → 取最后一个大限 */
      var wantIdx = (ctx.age < c.ju) ? 0 : 11;
      if (ctx.age >= c.ju) ctx.limitBeyond = true;
      for (i = 0; i < c.palaces.length; i++) {
        if (c.palaces[i].limit && c.palaces[i].limit.idx === wantIdx) { lim = c.palaces[i]; break; }
      }
    }
    ctx.limitPalace = lim;

    /* 流年：未来三年（干支年 + 流年命宫 = 该年地支所在宫 + 流年四化） */
    ctx.years = [];
    for (i = 1; i <= 3; i++) {
      var y = ctx.currentYear + i;
      var gz = yearGZName(y);
      var p2 = byZhi(c, gz.zhi);
      var sh = ZW.SIHUA[gz.gan] || [];
      ctx.years.push({
        year: y, gz: gz, palace: p2, stars: starDisplay(p2, c),
        score: p2 ? ctx.scores[p2.zhi] : 50,
        lu: sh[0] || '', quan: sh[1] || '', ke: sh[2] || '', ji: sh[3] || ''
      });
    }
    return ctx;
  }

  /* ============================================================
     七、宫位解读（reading）
     ============================================================ */
  function comboClause(p, c) {
    if (p.mainStars.length === 0) {
      var d = duiOf(c, p);
      return '空宫无主星，借对宫' + d.zhiName + '宫' + borrowStar(c, p) + '为用';
    }
    if (p.mainStars.length === 1) {
      var s1 = p.mainStars[0];
      return s1 + '独坐' + p.zhiName + '宫，' + (SOLO_NOTE[s1] || STAR_TRAIT[s1].t);
    }
    var a = p.mainStars[0], b = p.mainStars[1];
    return a + b + '同宫于' + p.zhiName + '宫，' + pairNote(a, b);
  }

  function zoneClause(p, c, ctx) {
    var key = ['命宫', '官禄', '财帛', '迁移'], i, q, parts = [];
    if (key.indexOf(p.name) >= 0) {
      for (i = 0; i < key.length; i++) {
        q = byName(c, key[i]);
        if (!q || q.zhi === p.zhi) continue;
        parts.push(q.name + '（' + shortStars(q, 2) + '）');
      }
      return '三方四正见' + parts.join('、') + '，此组' + gradeShortOf(ctx.groupScore);
    }
    var d = duiOf(c, p);
    return '对宫' + d.zhiName + '宫为' + d.name + '（' + shortStars(d, 2) + '），此处顺逆牵动这边';
  }

  /* 四化 + 吉辅煞忌合并为一条「状态」句，保证关键信息一定写得进 100 字以内 */
  function stateClause(p) {
    var parts = [], h = huaList(p), i, k, used = [];
    var pri = ['化忌', '化禄', '化权', '化科'];
    var fu = fuOf(p), sha = shaOf(p), desc = [];
    /* 吉煞同时出现时四化只提一条（化忌优先），把字数留给三方四正那句 */
    var maxHua = (fu.length && sha.length) ? 1 : 2;
    for (k = 0; k < pri.length && used.length < maxHua; k++) {
      for (i = 0; i < h.length; i++) {
        if (h[i].hua !== pri[k]) continue;
        if (pri[k] === '化忌') used.push(h[i].star + '化忌，' + FOCUS[p.name] + '最易卡壳');
        else if (pri[k] === '化禄') used.push(h[i].star + '化禄，进项从这里来');
        else if (pri[k] === '化权') used.push(h[i].star + '化权，这边你说了算');
        else used.push(h[i].star + '化科，名声文书加分');
      }
    }
    if (used.length) parts.push(used.join('；'));
    if (fu.length && sha.length) {
      parts.push(take(fu, 2).join('、') + '来助，' + take(sha, 2).join('、') + '同宫，助力阻力并存');
    } else if (fu.length) {
      parts.push(take(fu, 2).join('、') + '在此，遇事有人可依');
    } else if (sha.length) {
      for (i = 0; i < sha.length && i < 2; i++) desc.push(SHA_SHORT[sha[i]]);
      parts.push(take(sha, 2).join('、') + '同宫，主' + desc.join('、') + '，宜隔夜再定');
    } else if (!used.length) {
      parts.push('本宫未见吉辅与煞星，吉凶全看大限流年引动');
    }
    return parts.join('，');
  }

  function readingOf(p, c, ctx, score) {
    var clauses = [
      comboClause(p, c),
      stateClause(p),
      zoneClause(p, c, ctx)
    ];
    if (p.changsheng && CS_MEAN[p.changsheng]) {
      clauses.push('长生神为' + p.changsheng + '，' + CS_MEAN[p.changsheng]);
    }
    var pads = [bandOf(score) + '，' + KICKER[p.name]];
    return pack(clauses, 50, 100, pads);
  }

  function adviceOf(p, c, score) {
    var t = ADVICE[p.name] || ADVICE['命宫'];
    var fu = fuOf(p), sha = shaOf(p);
    var ji = huaOf(p, '化忌'), lu = huaOf(p, '化禄');
    var organ = organOfPalace(p);
    var map = {
      star: p.mainStars.length ? p.mainStars.join('、') : borrowStar(c, p),
      sha: sha.length ? sha[0] : '', shaAll: sha.join('、'),
      fu: fu.length ? fu[0] : '', fuAll: fu.join('、'),
      ji: ji, lu: lu, dui: borrowStar(c, p), organ: organ
    };
    var pick = null;
    if (ji && t.ji) pick = t.ji;
    else if (sha.length && t.sha) pick = t.sha;
    else if (fu.length && t.fu) pick = t.fu;
    else if (p.mainStars.length === 0 && t.empty) pick = t.empty;
    else pick = t.base;
    var clauses = [], i;
    for (i = 0; i < pick.length; i++) clauses.push(fmt(pick[i], map));
    return pack(clauses, 25, 50, []);
  }

  /* 疾厄宫 → 需留意的部位（按主星五行） */
  function organOfPalace(p) {
    var i, arr = [];
    for (i = 0; i < p.mainStars.length; i++) {
      var si = ZW.STAR_INFO[p.mainStars[i]];
      if (si && WX_ORGAN[si.wx] && arr.indexOf(WX_ORGAN[si.wx].organ) < 0) arr.push(WX_ORGAN[si.wx].organ);
    }
    if (!arr.length) arr.push(WX_ORGAN['土'].organ);
    return arr.join('、');
  }
  function checkOfPalace(p) {
    var i, arr = [];
    for (i = 0; i < p.mainStars.length; i++) {
      var si = ZW.STAR_INFO[p.mainStars[i]];
      if (si && WX_ORGAN[si.wx] && arr.indexOf(WX_ORGAN[si.wx].check) < 0) arr.push(WX_ORGAN[si.wx].check);
    }
    if (!arr.length) arr.push(WX_ORGAN['土'].check);
    return arr.join('与');
  }

  /* ============================================================
     八、总述类字段
     ============================================================ */
  /* 组合名 + 落宫位置（一句话讲清主星怎么坐的） */
  function comboWithPos(p, c) {
    if (p.mainStars.length === 0) return '空宫借对宫' + borrowStar(c, p) + '（' + p.zhiName + '宫）';
    if (p.mainStars.length === 1) return p.mainStars[0] + '独坐' + p.zhiName + '宫';
    return p.mainStars[0] + p.mainStars[1] + '同宫于' + p.zhiName + '宫';
  }

  function buildHeadline(c, ctx) {
    var ming = byName(c, '命宫');
    var lead = GS_LEAD[ming.mainStars.join('|')] || (ming.mainStars.length
      ? (STAR_TRAIT[ming.mainStars[0]].t.split('、')[0] + '型')
      : '借力起步型');
    var c1 = '命宫' + comboWithPos(ming, c) + '，' + lead;
    var gl = byName(c, '官禄'), cb = byName(c, '财帛');
    var c2 = '三方会' + shortStars(gl, 2) + '与' + shortStars(cb, 2) + '，格局' + gradeShortOf(ctx.groupScore);
    var c3 = ctx.ji ? ('最要防' + ctx.ji.star + '化忌在' + ctx.ji.palace.name) : '四化平和无重忌';
    var pads = [bandOf(ctx.scoreOf['命宫']) + '，' + KICKER['命宫'], '成败看命宫三方四正'];
    return pack([c1, c2, c3], 25, 45, pads);
  }

  function buildTags(c, ctx) {
    var ming = byName(c, '命宫'), tags = [], i, p, fu, sha;
    for (i = 0; i < ming.mainStars.length && i < 2; i++) {
      tags = tags.concat(STAR_TRAIT[ming.mainStars[i]].tg);
    }
    if (huaOf(ming, '化权')) tags.push('要主导');
    if (huaOf(ming, '化禄')) tags.push('自带资源');
    if (huaOf(ming, '化忌')) tags.push('易自耗');
    if (huaOf(ming, '化科')) tags.push('重名声');
    sha = shaOf(ming);
    if (sha.length) tags.push('硬碰硬');
    fu = fuOf(ming);
    if (fu.length) tags.push('贵人缘');
    if (ming.isShen) tags.push('自己扛');
    /* 三方四正主星补足 */
    if (tags.length < 3) {
      p = byName(c, '官禄');
      if (p && p.mainStars.length) tags = tags.concat(STAR_TRAIT[p.mainStars[0]].tg);
    }
    if (tags.length < 3) {
      p = byName(c, '财帛');
      if (p && p.mainStars.length) tags = tags.concat(STAR_TRAIT[p.mainStars[0]].tg);
    }
    tags = uniq(tags);
    if (tags.length < 3) tags = tags.concat(['务实', '看长线', '靠自己']);
    tags = uniq(tags);
    if (tags.length > 6) tags = take(tags, 6);
    return tags;
  }

  function buildSummary(c, ctx) {
    var ming = byName(c, '命宫'), shen = byZhi(c, c.shenPos);
    var info = c.info || {}, lunar = info.lunar || {};
    var out = [], gl = byName(c, '官禄'), cb = byName(c, '财帛'), qy = byName(c, '迁移');
    var i, arr;

    /* 1 先天底色 */
    arr = [];
    arr.push('命宫' + comboWithPos(ming, c) + '，生年' + (info.yearGZ || '') +
      '（' + (info.shengXiao || '') + '年）' + (c.juName || '') + '，命主' + c.mingZhu + '、身主' + c.shenZhu);
    arr.push(ming.mainStars.length
      ? '先天底色是' + STAR_TRAIT[ming.mainStars[0]].t + (ming.mainStars[1] ? '，又叠加' + STAR_TRAIT[ming.mainStars[1]].t : '') + '，这套气质贯穿一生'
      : '命宫无主星，性格随环境与他人塑形，早年多借力、后天才定型');
    out.push(pack(arr, 40, 80, ['农历' + (lunar.text || '') + '生人，' + (c.juName || '') + '起运，节奏偏' + (c.ju >= 5 ? '稳' : '快')]));

    /* 2 三方四正格局 */
    arr = ['命宫三方四正看事业与财路：官禄宫' + shortStars(gl, 2, c) + '、财帛宫' + shortStars(cb, 2, c) +
      '、迁移宫' + shortStars(qy, 2, c) + '，这一组' + gradeShortOf(ctx.groupScore)];
    if (ctx.lu) arr.push(ctx.lu.star + '化禄落' + ctx.lu.palace.name + '，资源与机会主要从' + FOCUS[ctx.lu.palace.name] + '进来');
    out.push(pack(arr, 40, 80, ['格局高低看这四宫，后天动作也要往这里使']));

    /* 3 身宫 */
    arr = ['身宫落' + pn(shen.name) + '（' + shen.zhiName + '宫：' + citeStars(shen, c, 3) + '），后天用力方向在' +
      FOCUS[shen.name]];
    if (shen.isMing) arr.push('命身同宫，一生靠自己扛，方向对了成就来得比同龄人快');
    else arr.push('三十岁以后这宫的功课会一再出现，主动做比被动挨打强');
    out.push(pack(arr, 40, 80, ['身宫是后天补救位，' + KICKER[shen.name]]));

    /* 4 四化 */
    arr = [];
    if (ctx.lu) arr.push(ctx.lu.star + '化禄在' + ctx.lu.palace.name + '（' + FOCUS[ctx.lu.palace.name] + '）');
    if (ctx.quan) arr.push(ctx.quan.star + '化权在' + ctx.quan.palace.name);
    if (ctx.ke) arr.push(ctx.ke.star + '化科在' + ctx.ke.palace.name);
    if (ctx.ji) arr.push(ctx.ji.star + '化忌在' + ctx.ji.palace.name + '，这是一生最需要提前修的功课');
    out.push(pack(['生年' + (info.yearGZ || '') + '的四化落点：' + arr.join('，')], 40, 80,
      ['资源从' + (ctx.lu ? ctx.lu.palace.name : '命宫') + '进，卡点在' + (ctx.ji ? ctx.ji.palace.name : '无')]));

    /* 5 当前节奏 */
    if (ctx.limitPalace) {
      var lp = ctx.limitPalace;
      out.push(pack(['虚岁' + ctx.age + '正走' + pn(lp.name) + '大限（' + lp.limit.from + '-' + lp.limit.to + '岁）：' +
        citeStars(lp, c, 3) + '，这一段' + gradeShortOf(ctx.scoreOf[lp.name])], 40, 80,
      ['大限是十年一段的舞台，这十年先把这个宫的事处理好']));
    }
    return out.slice(0, 5);
  }

  function buildStrengths(c, ctx) {
    var out = [], ming = byName(c, '命宫'), i, p, fu, best = null, bestS = -1;
    for (i = 0; i < c.palaces.length; i++) {
      if (ctx.scores[i] > bestS) { bestS = ctx.scores[i]; best = c.palaces[i]; }
    }
    if (ctx.lu) out.push(ctx.lu.star + '化禄在' + pn(ctx.lu.palace.name) + '（' + ctx.lu.palace.zhiName + '宫：' +
      citeStars(ctx.lu.palace, c, 2) + '），' + FOCUS[ctx.lu.palace.name] + '是你天然的进项口');
    if (ctx.quan) out.push(ctx.quan.star + '化权在' + pn(ctx.quan.palace.name) + '，' + FOCUS[ctx.quan.palace.name] +
      '上你有主动权与话语权，是你最该自己拍板的一块');
    if (ctx.ke) out.push(ctx.ke.star + '化科在' + pn(ctx.ke.palace.name) + '，' + FOCUS[ctx.ke.palace.name] +
      '上的名声、证书与文书是你的加分项');
    fu = fuOf(ming);
    if (fu.length) out.push('命宫有' + fu.join('、') + '，遇事容易遇到愿意搭手的人，关键节点要主动开口');
    if (best && best.zhi !== ming.zhi) {
      out.push('全盘状态最好的是' + pn(best.name) + '（' + best.zhiName + '宫：' + citeStars(best, c, 3) + '）' +
        '，状态分' + bestS + '，这是最该投入资源的一块');
    }
    if (out.length < 3) {
      out.push('命宫' + comboName(ming, c) + '，' + (STAR_TRAIT[ming.mainStars[0]] ? STAR_TRAIT[ming.mainStars[0]].t : '借力起步') +
        '，' + gradeOf(ctx.scoreOf['命宫']));
    }
    return take(uniq(out), 4);
  }

  function buildRisks(c, ctx) {
    var out = [], i, p, sha, worst = null, worstN = -1, emptyCount = 0;
    for (i = 0; i < c.palaces.length; i++) {
      p = c.palaces[i];
      sha = shaOf(p);
      if (sha.length > worstN) { worstN = sha.length; worst = p; }
      if (p.mainStars.length === 0) emptyCount++;
    }
    if (ctx.ji) {
      out.push(ctx.ji.star + '化忌在' + pn(ctx.ji.palace.name) + '（' + ctx.ji.palace.zhiName + '宫：' +
        citeStars(ctx.ji.palace, c, 2) + '）：' + FOCUS[ctx.ji.palace.name] +
        '是一生最容易卡住的领域，一旦在这里加杠杆或逞强就会反复');
    }
    if (worst && worstN > 0) {
      out.push(pn(worst.name) + '聚集' + shaOf(worst).join('、') + '（状态分' + ctx.scoreOf[worst.name] + '）：' +
        FOCUS[worst.name] + '容易出' + SHA_DESC[shaOf(worst)[0]] + '，务必设止损线');
    }
    if (emptyCount >= 3) {
      out.push('全盘有' + emptyCount + '个空宫（' + emptyList(c) + '），这些领域先天没主见，' +
        '遇大事要靠借对宫之星、靠制度与合同兜底');
    }
    if (huaOf(byName(c, '命宫'), '化忌')) {
      out.push('命宫坐' + huaOf(byName(c, '命宫'), '化忌') + '化忌，自我怀疑与内耗是最大成本，' +
        '一旦长期熬夜或硬撑，状态会连带垮掉');
    }
    if (out.length < 3) {
      var ming = byName(c, '命宫'), ms = ctx.scoreOf['命宫'];
      out.push('命宫' + comboName(ming, c) + '（状态分' + ms + '）：' +
        (ms >= 62 ? '底子不弱，风险在于把优势用在错赛道上，一条道走到黑'
          : '底子偏薄，遇事容易自我怀疑，需要外部反馈及时校准'));
    }
    if (out.length < 3) out.push('生年' + (c.info && c.info.yearGZ ? c.info.yearGZ : '') + '盘四化平和，主要风险来自执行节奏与身体透支');
    return take(uniq(out), 4);
  }

  function emptyList(c) {
    var out = [], i;
    for (i = 0; i < c.palaces.length; i++) if (c.palaces[i].mainStars.length === 0) out.push(c.palaces[i].name);
    return out.join('、');
  }

  /* ============================================================
     九、分项建议
     ============================================================ */
  function buildCareer(c, ctx) {
    var gl = byName(c, '官禄'), ming = byName(c, '命宫');
    var suit = [], avoid = [], i, stars = uniq(gl.mainStars.concat(ming.mainStars));
    for (i = 0; i < stars.length; i++) suit = suit.concat(STAR_TRAIT[stars[i]].job);
    suit = uniq(suit);
    if (suit.length < 3) suit = suit.concat(['项目管理', '专业技术', '销售与客户经营']);
    suit = take(uniq(suit), 5);

    for (i = 0; i < stars.length && avoid.length < 3; i++) avoid = avoid.concat(STAR_TRAIT[stars[i]].bad);
    if (ctx.ji) {
      avoid.push('把全部精力押在' + ctx.ji.palace.name + '所管的' + FOCUS[ctx.ji.palace.name] +
        '上（' + ctx.ji.star + '化忌在此），只宜当副线');
    }
    /* 官禄/命宫为空宫或主星偏少时，上面的条目会不够，用宫面事实兜底 */
    if (avoid.length < 2) {
      if (!stars.length) {
        avoid.push('单靠' + gl.name + '与' + ming.name + '两宫都无主星（借对宫之力），不要在没有明确授权与资源的岗位上硬扛，先借平台与团队');
      }
      avoid.push('长期停在纯执行、可替代性高的岗位（' + stars.map(function (s) { return STAR_TRAIT[s].t.split('、')[0]; }).join('、') +
        '这类特质需要能累积作品与决策权的位置）');
    }
    avoid = take(uniq(avoid), 3);

    var note = pack([
      '官禄宫' + shortStars(gl, 2, c) + '、命宫' + shortStars(ming, 2, c) + '，事业主轴是' +
      (stars.length ? stars[0] + '（' + STAR_TRAIT[stars[0]].t.split('、')[0] + '）' : '借力起步'),
      ctx.lu ? ctx.lu.star + '化禄在' + ctx.lu.palace.name + '，走' + FOCUS[ctx.lu.palace.name] +
        '相关的方向能接到资源' : '四化无禄，靠专业与时间换资源',
      ctx.ji ? '但要避开被' + ctx.ji.star + '化忌拖住的' + FOCUS[ctx.ji.palace.name] + '型岗位' : ''
    ], 60, 90, ['选赛道时优先看能否积累可迁移的作品与客户']);
    return { suitable: suit, avoid: avoid, note: note };
  }

  function buildWealth(c, ctx) {
    var cb = byName(c, '财帛'), tz = byName(c, '田宅');
    var style = cb.mainStars.length
      ? WEALTH_STYLE[cb.mainStars[0]] || '靠专业与平台挣钱'
      : '空宫借对宫之星，财路随环境变动，靠技能与他人平台';
    var ku;
    if (huaOf(tz, '化忌')) {
      ku = '田宅宫' + shortStars(tz, 2, c) + '，化忌在此，财库易反复，置产装修都要留备用金';
    } else if (tz.mainStars.length === 0) {
      ku = '田宅宫空宫借对宫' + borrowStar(c, tz) + '之星，家底要靠强制储蓄一点点攒';
    } else {
      ku = '田宅宫' + shortStars(tz, 2, c) + '，家底与不动产是长期财库';
    }
    var pattern = pack([
      '财帛宫' + shortStars(cb, 2, c) + '，赚钱模式是' + style,
      ku,
      huaOf(cb, '化禄') ? huaOf(cb, '化禄') + '化禄在财帛，进项本就不弱，关键在留不留得住' : '',
      huaOf(cb, '化忌') ? huaOf(cb, '化忌') + '化忌在财帛，现金流易断，必须先备现金垫' : ''
    ], 40, 70, ['赚得到不等于留得住，节奏比金额重要']);

    var advice = pack([
      '工资到账当天先把20%自动转入独立账户做长期定投，剩下的再花',
      '信用卡只留一张、额度压到月收入的一半，分期与担保一律不碰',
      huaOf(cb, '化忌') ? '每季度对一次总账，重点查' + huaOf(cb, '化忌') + '化忌带来的漏点' : '每季度对一次总账，副业收入单独记账'
    ], 40, 70, ['先攒够六个月生活费的现金垫，再谈投资']);
    return { pattern: pattern, advice: advice };
  }

  function buildLove(c, ctx) {
    var fq = byName(c, '夫妻'), ming = byName(c, '命宫'), gl = byName(c, '官禄');
    var style = fq.mainStars.length
      ? (LOVE_STYLE[fq.mainStars[0]] || '感情观务实，靠相处慢慢磨')
      : '夫妻空宫，借对宫' + borrowStar(c, fq) + '之星，感情形态随对方与阶段变化，晚定更稳';
    /* 桃花星落宫（真实星曜；宫名已自带「宫」字的只有命宫） */
    var peach = [], i, p, pn;
    for (i = 0; i < c.palaces.length; i++) {
      p = c.palaces[i];
      pn = p.name;
      if (pn.charAt(pn.length - 1) !== '宫') pn += '宫';
      if (p.stars.indexOf('红鸾') >= 0) peach.push(pn + '红鸾');
      if (p.stars.indexOf('天喜') >= 0) peach.push(pn + '天喜');
      if (p.stars.indexOf('天姚') >= 0) peach.push(pn + '天姚');
      if (p.stars.indexOf('咸池') >= 0) peach.push(pn + '咸池');
    }
    var patArr = ['夫妻宫' + shortStars(fq, 2, c) + '，' + style];
    if (peach.length) patArr.push('桃花星落点：' + take(peach, 3).join('、'));
    if (c.gender === '女') {
      patArr.push('女命兼看官禄宫' + shortStars(gl, 2, c) + '，' + (gl.mainStars.length ? STAR_TRAIT[gl.mainStars[0]].t.split('、')[0] : '事业心') + '会影响择偶标准');
    }
    var pattern = pack(patArr, 40, 70, ['感情的功课在于把话说具体，而不是等对方猜']);

    var advArr = [];
    if (huaOf(fq, '化忌')) advArr.push(huaOf(fq, '化忌') + '化忌在夫妻，吵架立规矩：不翻旧账、不查手机、不拉长辈评理');
    else if (shaOf(fq).length) advArr.push(shaOf(fq)[0] + '在夫妻，婚前把钱、生育、与父母同住三件事谈成白纸黑字');
    else advArr.push('把择偶与相处的条件写成三条硬的：金钱观、与父母的距离、生育计划，三个月内对齐');
    advArr.push('每月一次固定的深度沟通，只谈感受不谈对错');
    var advice = pack(advArr, 40, 70, ['婚前把边界谈清楚，比婚后靠忍让省事']);
    return { pattern: pattern, advice: advice };
  }

  function buildHealth(c, ctx) {
    var je = byName(c, '疾厄'), watch = [], i, organ = organOfPalace(je), check = checkOfPalace(je);
    var si, wxList = [];
    for (i = 0; i < je.mainStars.length; i++) {
      si = ZW.STAR_INFO[je.mainStars[i]];
      if (si && wxList.indexOf(si.wx) < 0) wxList.push(si.wx);
    }
    if (je.mainStars.length) {
      watch.push(je.mainStars.join('、') + '（' + wxList.join('、') + '）在疾厄宫：' + organ + '是最需要定期检查的系统');
    } else {
      watch.push('疾厄宫空宫，借对宫' + pn(duiOf(c, je).name) + borrowStar(c, je) + '之星：体质随情绪与作息波动，' + organ + '需留意');
    }
    var sha = shaOf(je);
    if (sha.length) watch.push(sha.join('、') + '入疾厄：' + SHA_DESC[sha[0]] + '，运动、行车与用刀都要留余量');
    if (huaOf(je, '化忌')) watch.push(huaOf(je, '化忌') + '化忌在疾厄：压力直接转成身体症状，' + organ + '最先报警');
    if (!je.mainStars.length || je.mainStars.length === 1) {
      var fude = byName(c, '福德');
      if (shaOf(fude).length) watch.push('福德宫见' + shaOf(fude).join('、') + '：情绪起伏会放大身体不适，睡眠要先管好');
    }
    watch = take(uniq(watch), 4);
    if (watch.length < 2) watch.push('全盘无煞入疾厄，但大限与流年引动时仍要按体检节奏走');

    var advice = pack([
      '每年安排一次' + check + '，把日期写进日历而不是想起来才做',
      organ + '的症状超过两周就去医院，别靠扛和自我诊断',
      '作息上先做到23点前睡、每周三次三十分钟有氧，' + (sha.length ? '有' + sha[0] + '在疾厄，运动强度循序渐进' : '强度循序渐进即可')
    ], 40, 70, ['把体检、睡眠、运动当成固定项目，而不是补救措施']);
    return { watch: watch, advice: advice };
  }

  function buildTiming(c, ctx) {
    var lp = ctx.limitPalace, cur, tips;
    if (!lp) {
      cur = pack(['出生信息不足，无法定位大限，请补充出生年月日时'], 60, 90, []);
    } else if (ctx.limitStarted === false && ctx.limitBeyond === false) {
      cur = pack([
        '虚岁' + ctx.age + '在' + ctx.currentYear + '年尚未起运，' + c.juName + '到' + c.ju + '岁才起运，' +
        '现在以命宫' + citeStars(byName(c, '命宫'), c, 3) + '为主，这段时间是把习惯与人脉立起来的打底期'
      ], 60, 90, ['未起运前，家庭与学校环境的影响大于大限']);
    } else {
      var arr = [
        (ctx.limitBeyond ? '虚岁' + ctx.age + '已超出十二大限范围，按最后一段' : '虚岁' + ctx.age + '在' + ctx.currentYear + '年走') +
        pn(lp.name) + '大限' + lp.limit.from + '-' + lp.limit.to + '岁',
        '宫内' + citeStars(lp, c, 3),
        '这一段' + gradeShortOf(ctx.scoreOf[lp.name]) + '，状态分' + ctx.scoreOf[lp.name]
      ];
      if (huaOf(lp, '化忌')) arr.push(huaOf(lp, '化忌') + '化忌正在此宫，' + FOCUS[lp.name] + '的事会反复来考你');
      else if (huaOf(lp, '化禄')) arr.push(huaOf(lp, '化禄') + '化禄在此，这十年资源会主动找上门');
      else arr.push('本限无四化引动，成绩全靠主动经营');
      cur = pack(arr, 60, 90, ['本限功课是' + KICKER[lp.name]]);
    }

    var y1 = ctx.years[0], y2 = ctx.years[1];
    var tipsArr = [];
    if (y1) {
      tipsArr.push(y1.year + '年' + y1.gz.name + '流年命宫落' + pn(y1.palace.name) + '（' + shortStars(y1.palace, 2) +
        '），' + YEAR_ACTION[y1.palace.name]);
    }
    if (y1 && y1.ji) tipsArr.push(y1.gz.name + '年' + y1.lu + '化禄、' + y1.ji + '化忌，' + y1.ji + '本命在' + pn(huiPalaceName(c, y1.ji)) + '，该领域先守不攻');
    if (y1 && y2) tipsArr.push(y2.year + '年' + y2.gz.name + '流年命宫落' + pn(y2.palace.name) + '，' + YEAR_ACTION[y2.palace.name]);
    tipsArr.push('总原则是化禄之年主动扩张，化忌之年收口修内功');
    tips = pack(tipsArr, 60, 90, ['每年立春后按新年干支重核一次流年落宫']);
    return { current: cur, tips: tips };
  }

  /* 星曜在本命盘所落宫位名（流年四化星回看本命） */
  function huiPalaceName(c, star) {
    for (var i = 0; i < c.palaces.length; i++) {
      if (c.palaces[i].stars.indexOf(star) >= 0) return c.palaces[i].name;
    }
    return '命宫';
  }

  function buildActionPlan(c, ctx) {
    var out = [], ming = byName(c, '命宫'), lp = ctx.limitPalace;
    var ji = ctx.ji, lu = ctx.lu, quan = ctx.quan, ke = ctx.ke;
    var worst = null, worstN = -1, i, p, sha;

    /* 1. 化忌宫：止损与修补（现在） */
    if (ji) {
      out.push({
        when: '现在',
        what: ACT_AVOID[ji.palace.name],
        why: ji.star + '化忌落在' + pn(ji.palace.name) + '（' + ji.palace.zhiName + '宫：' + citeStars(ji.palace, c, 2) +
          '），' + FOCUS[ji.palace.name] + '是一生最容易卡住的领域'
      });
    }
    /* 2. 煞星最重的宫：设止损线（现在） */
    for (i = 0; i < c.palaces.length; i++) {
      p = c.palaces[i];
      sha = shaOf(p);
      if (sha.length > worstN) { worstN = sha.length; worst = p; }
    }
    if (worst && worstN > 0 && (!ji || worst.name !== ji.palace.name)) {
      out.push({
        when: '现在',
        what: ACT_AVOID[worst.name],
        why: pn(worst.name) + '有' + shaOf(worst).join('、') + '（状态分' + ctx.scoreOf[worst.name] + '），' +
          FOCUS[worst.name] + '上容易出' + SHA_DESC[shaOf(worst)[0]]
      });
    }
    /* 3. 化禄宫：把资源投进去（今年） */
    if (lu) {
      out.push({
        when: '今年',
        what: ACT_GAIN[lu.palace.name],
        why: lu.star + '化禄在' + pn(lu.palace.name) + '（' + lu.palace.zhiName + '宫：' + citeStars(lu.palace, c, 2) +
          '），是盘上资源最集中的入口'
      });
    }
    /* 4. 当前大限宫：本限主功课（今年） */
    if (lp && (!lu || lp.name !== lu.palace.name) && (!ji || lp.name !== ji.palace.name)) {
      out.push({
        when: '今年',
        what: ACT_GAIN[lp.name],
        why: '当前大限' + lp.limit.from + '-' + lp.limit.to + '岁走' + pn(lp.name) + '（' + lp.zhiName + '宫：' +
          citeStars(lp, c, 3) + '），这十年的功课集中在这里'
      });
    }
    /* 5. 化权/化科宫：争位置与资格（未来3年） */
    if (quan) {
      out.push({
        when: '未来3年',
        what: QUAN_ACT[quan.palace.name],
        why: quan.star + '化权在' + pn(quan.palace.name) + '（' + quan.palace.zhiName + '宫），话语权在这里最容易拿到'
      });
    } else if (ke) {
      out.push({
        when: '未来3年',
        what: KE_ACT[ke.palace.name],
        why: ke.star + '化科在' + pn(ke.palace.name) + '（' + ke.palace.zhiName + '宫），名声与文书在此加分'
      });
    }
    /* 6. 事业主轴（未来3年） */
    out.push({
      when: '未来3年',
      what: '按官禄宫方向深耕：' + take(uniq(byName(c, '官禄').mainStars.concat(ming.mainStars))
        .map(function (s) { return STAR_TRAIT[s].job[0]; }), 2).join('或'),
      why: '官禄宫' + citeStars(byName(c, '官禄'), c, 2) + '、命宫' + citeStars(ming, c, 2) + '，事业主轴写在命官两宫'
    });
    /* 7. 财与身体（未来3年） */
    var tz = byName(c, '田宅');
    out.push({
      when: '未来3年',
      what: '把收入的固定比例转入长期账户，先攒够十二个月生活费再谈买房或换车',
      why: '财帛宫' + citeStars(byName(c, '财帛'), c, 2) + '、田宅宫' + citeStars(tz, c, 2) +
        (huaOf(tz, '化忌') ? '，' + huaOf(tz, '化忌') + '化忌在田宅，财库易反复' : '，家底靠积累')
    });
    /* 8. 健康节奏（今年） */
    var je = byName(c, '疾厄');
    out.push({
      when: '今年',
      what: '预约一次' + checkOfPalace(je) + '，并把作息固定到23点前入睡',
      why: '疾厄宫' + citeStars(je, c, 2) + '，' + organOfPalace(je) + '是这张盘最该提前管的系统'
    });

    /* 去重（同一宫位只留一条最重要的）并限制 5-7 条 */
    var seen = {}, res = [];
    for (i = 0; i < out.length; i++) {
      var k = out[i].what;
      if (seen[k]) continue;
      seen[k] = 1;
      res.push(out[i]);
    }
    if (res.length > 7) res = take(res, 7);
    return res;
  }

  /* ============================================================
     十、主函数
     ============================================================ */
  function analyze(c, opts) {
    if (!c || !c.palaces || !c.palaces.length) {
      throw new Error('ZiWeiRead.analyze(c, opts) 需要 ZiWei.chart() 的返回值');
    }
    opts = opts || {};
    var ctx = buildCtx(c, opts);
    var i, p, score, palaces = [];

    for (i = 0; i < c.palaces.length; i++) {
      p = c.palaces[i];
      score = ctx.scores[i];
      palaces.push({
        name: p.name,
        zhi: p.zhiName,
        ganZhi: p.ganName + p.zhiName,
        stars: starDisplay(p, c),
        reading: readingOf(p, c, ctx, score),
        score: score,
        advice: adviceOf(p, c, score)
      });
    }

    return {
      headline: buildHeadline(c, ctx),
      tags: buildTags(c, ctx),
      summary: buildSummary(c, ctx),
      palaces: palaces,
      strengths: buildStrengths(c, ctx),
      risks: buildRisks(c, ctx),
      career: buildCareer(c, ctx),
      wealth: buildWealth(c, ctx),
      love: buildLove(c, ctx),
      health: buildHealth(c, ctx),
      timing: buildTiming(c, ctx),
      actionPlan: buildActionPlan(c, ctx),
      disclaimer: '命盘是参考系不是判决书：重要决定请回到现实数据、合同条款和家人意见上核对，命理只帮你排优先级。'
    };
  }

  root.ZiWeiRead = { analyze: analyze };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ZiWeiRead;
})(typeof globalThis !== 'undefined' ? globalThis : this);
