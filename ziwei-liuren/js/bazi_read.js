/* ================================================================
   八字解盘层
   断法次序依子平主流三步：① 旺衰关 ② 格局关 ③ 用神关
   断语依《天纪》讲义「四柱六神用法问答」与子平通行原则
   ================================================================ */
(function (root) {
  'use strict';
  var BZ = root.BaZi || (typeof require !== 'undefined' ? require('./bazi.js') : null);

  var WX_CN = { 木:'木', 火:'火', 土:'土', 金:'金', 水:'水' };
  var WX_XIANG = {
    木: '生发、仁厚、开拓', 火: '热烈、明亮、礼仪',
    土: '厚重、信实、承载', 金: '刚断、义气、条理', 水: '灵动、智谋、流通'
  };
  var GAN_XIANG = {
    甲:'参天大树，正直向上、能扛事', 乙:'花草藤蔓，柔韧善变、会借力',
    丙:'太阳之火，热情外放、照人', 丁:'灯烛之火，细腻专注、耐守',
    戊:'城墙厚土，稳重可靠、能担', 己:'田园之土，包容务实、肯养人',
    庚:'刀剑之金，果决刚硬、能开路', 辛:'珠玉之金，精致要面子、重细节',
    壬:'江河之水，气魄大、能容能走', 癸:'雨露之水，心思细、善渗透'
  };
  /* 十神在四柱的宫位含义 */
  var GONG = { 年柱:'祖辈／少年', 月柱:'父母／青壮年', 日柱:'自己／配偶', 时柱:'子女／晚年' };
  /* 十神基本性情 */
  var SS_XING = {
    比肩: '自立、有主见、朋友多，也容易跟人争',
    劫财: '敢冲、重义气，但破财与合伙风险高',
    食神: '温和、会享受、有口福才艺，慢性子',
    伤官: '聪明外露、才气高、不服管，锋芒伤人',
    偏财: '会来钱、手面宽、善抓机会，但来去快',
    正财: '踏实挣、会攒、重实际，偏保守',
    七杀: '压力大、魄力足、能打硬仗，也易招是非',
    正官: '守规矩、有担当、宜体制内，讲名分',
    偏印: '想法偏、学东西快、喜冷门专精，易孤',
    正印: '有靠山、读书好、心慈，易依赖'
  };
  /* 十神落在某一柱时的偏向 */
  var SS_GONG = {
    正官: { 年柱:'祖上有名望，少年受规矩约束', 月柱:'最贵，青年得位、宜公职，父辈也有身份',
            日柱:'官职垂手可得，配偶端正方正', 时柱:'得官较晚但伴终生，子女亦有出息' },
    七杀: { 年柱:'祖辈刚强威武，若失月令则早年清寒', 月柱:'有制则权重，杀印相生功名显达',
            日柱:'将门之材，办事敢下狠手', 时柱:'时上一位贵，晚年显，子女中有能人' },
    正财: { 年柱:'祖业有底，少年不缺钱', 月柱:'家底厚，青壮年靠正业积财',
            日柱:'配偶会持家，靠自己挣', 时柱:'晚年财稳，子女能守' },
    偏财: { 年柱:'祖上发达过，少年见世面', 月柱:'青壮年善抓机会，来钱门路多',
            日柱:'配偶能干，或因人得财', 时柱:'老来财路不断，子女有财' },
    正印: { 年柱:'祖辈积德，少年得庇荫', 月柱:'父母有靠，读书运好',
            日柱:'配偶照顾你，自己心慈', 时柱:'晚年安稳，子女孝顺' },
    偏印: { 年柱:'祖上偏门技艺或宗教缘', 月柱:'学冷门专精，母亲缘薄',
            日柱:'配偶想法特别，自己偏孤', 时柱:'晚年清静，子女独立' },
    食神: { 年柱:'少年有口福，家里和气', 月柱:'青壮年靠才艺吃饭，人缘好',
            日柱:'配偶温和，生活有情趣', 时柱:'晚年安逸，子女有福' },
    伤官: { 年柱:'少年聪明外露，易伤长辈', 月柱:'才气大但克官，不宜硬闯体制',
            日柱:'配偶能干但个性强', 时柱:'晚年仍锋芒，子女有才' },
    比肩: { 年柱:'兄弟多或同辈助力，祖业须分', 月柱:'青年自立，兄弟朋友多',
            日柱:'配偶与你像同路人', 时柱:'晚年有伴，子女自立' },
    劫财: { 年柱:'少年易破财，同辈借钱', 月柱:'青壮年忌合伙',
            日柱:'配偶个性强，防因财生隙', 时柱:'晚年防因子女或朋友破财' }
  };

  function analyze(r, opts) {
    opts = opts || {};
    var out = { r: r, head: {}, sections: [], verdict: {}, data: {} };
    var de = r.dayGan, deWx = BZ.WX_GAN[de];
    var name = de + '日主';

    /* ---------- 头部一句话 ---------- */
    out.head.dayMaster = de;
    out.head.dayMasterWx = deWx;
    out.head.oneLine = de + '日主（' + deWx + '）——' + (GAN_XIANG[de] || '') +
      '　' + r.strength + '，' + r.geJu;
    out.head.pillars = r.pillars.map(function (p) { return p.text; }).join(' ');

    /* ---------- ① 日主与旺衰 ---------- */
    var sec1 = { title: '① 日主与旺衰', items: [] };
    sec1.items.push({
      k: '你是' + de + '日主',
      v: (WX_CN[deWx]) + '命。日柱天干（' + de + '）就是你自己 —— ' + GAN_XIANG[de] +
         '。这张盘上所有关系都围着它转。'
    });
    var wxCn = Object.keys(r.wuXing).sort(function (a, b) { return r.wuXing[b] - r.wuXing[a]; })
      .map(function (k) { return k + ' ' + r.wuXing[k]; }).join('　');
    sec1.items.push({ k: '五行分量', v: wxCn + '（含藏干加权）' });
    var strongest = Object.keys(r.wuXing).sort(function (a, b) { return r.wuXing[b] - r.wuXing[a]; })[0];
    var weakest = Object.keys(r.wuXing).sort(function (a, b) { return r.wuXing[a] - r.wuXing[b]; })[0];
    sec1.items.push({
      k: '多与缺',
      v: '最多的是<b>' + strongest + '</b>，最缺的是<b>' + weakest + '</b>。' +
         (r.wuXing[weakest] < 1 ? '缺得明显 —— 这一面的事你天生不熟，要靠后天补。' : '都还有根，不算偏枯。')
    });
    var strDesc = {
      身强: '日主得令得地，力量足。好处是<b>扛得住事、有主见、能扛压</b>；坏处是<b>容易固执、听不进人劝、爱硬碰</b>。要走「泄」和「克」的路 —— 靠才干输出、靠财与责任把力气用出去。',
      中和: '日主不旺不弱，是<b>最好调度的结构</b>。顺境能承接、逆境也不至于垮，人生起伏相对平缓。重点看大运来什么 —— 来了什么就顺着走。',
      身弱: '日主偏弱。好处是<b>敏感、体察入微、懂得借力</b>；坏处是<b>扛压差、易被环境和人牵着走、事情一多就乱</b>。要「扶」—— 靠贵人、靠学习、靠同辈帮衬。'
    };
    sec1.items.push({ k: r.strength + '（扶抑比 ' + r.strengthRatio + '%）', v: strDesc[r.strength] });
    out.sections.push(sec1);

    /* ---------- ② 格局 ---------- */
    var sec2 = { title: '② 格局（月令定）', items: [] };
    sec2.items.push({
      k: '月令 ' + r.monthZhi + ' 藏干',
      v: r.monthShiShen.map(function (x) {
        return '<b>' + x.gan + '</b>（' + x.shiShen + (x.tou ? '・透干' : '') + '）';
      }).join('　') + '　→ 据此定 <b>' + r.geJu + '</b>'
    });
    var geDesc = {
      '正官格': '正官是「名分与规矩」之星。此格宜走体制、大公司、有明确职级的路线，靠<b>稳、正、可信</b>吃饭。最忌伤官见官（爱顶撞上级、文书出问题）。',
      '七杀格（偏官格）': '七杀是「压力与魄力」之星。身能任杀则<b>是块将材</b>，敢接硬活、能带队攻坚；身弱受克则是「鬼」，压力变病痛与是非。关键看有没有印来化、有没有食伤来制。',
      '正财格': '正财是「踏实挣来的钱」。靠<b>本业、专业、勤耕</b>积累，重实际、不冒进。身旺走财运则富；身弱财多反而为财所困（忙、累、钱过手不落袋）。',
      '偏财格': '偏财是「机会财、外人财」。门路多、手面宽、善抓时机，也容易来得快去得快。<b>身旺走偏财最发</b>；身弱则要防因财招祸。',
      '正印格': '正印是「庇荫与学识」。靠<b>学历、资历、师长贵人、平台</b>起家，心慈、名声好。忌财星破印（为钱放弃学问与靠山）。',
      '偏印格（枭神格）': '偏印是「偏门专精」。学东西快、想法特别，适合<b>技术、术数、医疗、冷门手艺</b>。忌枭神夺食（想太多、把饭碗想没了）。',
      '食神格': '食神是「才艺与福气」。靠<b>手艺、口才、享受生活的本事</b>吃饭，性子温和、人缘好。忌枭神夺食。',
      '伤官格': '伤官是「锋芒与才气」。聪明外露、表达强、创意足，但<b>不服管、易顶撞、文书上易出岔</b>。走技术／创作／自媒体比走体制顺。',
      '建禄格（比肩格）': '月令为日主临官（禄）之地，主<b>自立自强、靠自己打天下</b>，兄弟朋友多、也易分财。喜财官透出把力气用出去。',
      '月刃格（劫财格）': '月令为羊刃，主<b>性烈、敢冲、爆发力强</b>。用得好是将帅之才，用不好破财伤身。喜官杀制刃。'
    };
    sec2.items.push({ k: r.geJu, v: geDesc[r.geJu] || '月令十神不属典型八格，按「月令什么旺就以什么为纲」来看，重点仍是用神。' });
    out.sections.push(sec2);

    /* ---------- ③ 用神喜忌 ---------- */
    var sec3 = { title: '③ 用神与喜忌', items: [] };
    sec3.items.push({ k: '用神', v: '<b>' + r.yongShen.join('、') + '</b>　—— 这是你命里最需要的那一路力量。' });
    sec3.items.push({ k: '喜神', v: r.xiShen.join('、') });
    sec3.items.push({ k: '忌神', v: '<b>' + r.jiShen.join('、') + '</b>　—— 这一路来了要多留神。' });
    var useWx = [];
    r.yongShen.forEach(function (s) {
      var m = { 印星:'印（生你的）', 比劫:'比劫（同你的）', 食伤:'食伤（你生的）', 财星:'财（你克的）', 官杀:'官杀（克你的）' }[s];
      if (m) useWx.push(m);
    });
    sec3.items.push({
      k: '怎么用',
      v: '取用方向：' + useWx.join('、') + '。' +
         (r.strength === '身弱'
           ? '身弱要「扶」—— 多靠近生你、同你的力量：师长、学历、平台、同辈合作、稳定环境。别一个人硬扛。'
           : r.strength === '身强'
             ? '身强要「泄」与「克」—— 把力气用出去：靠专业输出、靠业绩、靠担责任、靠理财把劲头落地。别憋着。'
             : '中和之局，来什么用什么，顺着大运走即可。')
    });
    out.sections.push(sec3);

    /* ---------- ④ 四柱逐柱 ---------- */
    var sec4 = { title: '④ 四柱逐位看', items: [] };
    r.pillars.forEach(function (p) {
      var rows = [];
      var gong = GONG[p.name];
      var ss = p.ganShiShen;
      if (ss !== '日主') {
        rows.push('<b>' + p.gan + '（' + ss + '）</b>' + (SS_XING[ss] ? '：' + SS_XING[ss] : ''));
        var gm = SS_GONG[ss] && SS_GONG[ss][p.name];
        if (gm) rows.push('在' + p.name + '（' + gong + '）：' + gm);
      } else {
        rows.push('<b>' + p.gan + '（日主本身）</b>' + GAN_XIANG[p.gan]);
      }
      rows.push('地支 ' + p.zhi + '　藏干 ' + (p.cangShiShen.length
        ? p.cangShiShen.map(function (c) { return c.gan + '（' + c.shiShen + '）'; }).join('、') : '—') +
        '　长生 ' + p.changSheng + '　纳音 ' + p.naYin);
      if (p.shenSha.length) rows.push('神煞：' + p.shenSha.join('、'));
      sec4.items.push({ k: p.name + ' ' + p.text + '（' + gong + '）', v: rows.join('<br>') });
    });
    /* 藏干里的十神统计 */
    var ssCount = {};
    r.pillars.forEach(function (p) {
      if (p.ganShiShen !== '日主') ssCount[p.ganShiShen] = (ssCount[p.ganShiShen] || 0) + 1;
      p.cangShiShen.forEach(function (c) { ssCount[c.shiShen] = (ssCount[c.shiShen] || 0) + 1; });
    });
    var most = Object.keys(ssCount).sort(function (a, b) { return ssCount[b] - ssCount[a]; })[0];
    sec4.items.push({
      k: '哪种十神最重',
      v: '<b>' + most + '</b>出现 ' + ssCount[most] + ' 次（含藏干）。' +
         (SS_XING[most] ? SS_XING[most] : '') + ' —— 这是你性格与生活的<b>主色调</b>。'
    });
    out.sections.push(sec4);

    /* ---------- ⑤ 大运与流年 ---------- */
    var sec5 = { title: '⑤ 大运与流年', items: [] };
    if (r.daYun) {
      sec5.items.push({
        k: '排法',
        v: '<b>' + (r.daYun.forward ? '顺行' : '逆行') + '</b>（' +
           (BZ.YANG_GAN[r.yearGan] ? '阳' : '阴') + '年生' + r.input.gender + '）；' +
           '距节 ' + r.daYun.days.toFixed(1) + ' 天 → <b>' + r.daYun.startAge.toFixed(1) + ' 岁起运</b>，每十年一换。'
      });
      var nowAge = new Date().getFullYear() - r.input.y + 1;
      var curIdx = Math.floor((nowAge - r.daYun.startAge) / 10);
      var cur = (curIdx >= 0 && curIdx < r.daYun.list.length) ? r.daYun.list[curIdx] : null;
      if (cur) {
        var curSS = BZ.shiShen(r.dayGan, cur.gan);
        var curG = gradeOf(curSS);
        var good = curG === '喜', bad = curG === '忌';
        sec5.items.push({
          k: '现在这步大运（约 ' + nowAge + ' 岁）',
          v: '<b>' + cur.text + '（' + curSS + '）</b>　' +
             (good ? '这一步是<b>喜用</b>，是你可以放手做事的十年。' :
              bad ? '这一步偏<b>忌神</b>，宜守、宜学习进修、别硬扩张。' :
                    '这一步中性，看流年配合。')
        });
      }
      sec5.items.push({
        k: '十步大运',
        v: r.daYun.list.map(function (d, i) {
          var a1 = (r.daYun.startAge + i * 10).toFixed(1);
          var ss = BZ.shiShen(r.dayGan, d.gan);
          var g = gradeOf(ss);
          return d.text + '(' + ss + '·' + g + '·' + a1 + '岁)';
        }).join('　')
      });
    }
    if (r.liuNian && r.liuNian.length) {
      sec5.items.push({
        k: '近几年流年',
        v: r.liuNian.slice(0, 6).map(function (l) {
          var g = gradeOf(l.shiShen);
          return l.year + ' ' + l.text + '(' + l.shiShen + '·' + g + ')';
        }).join('　')
      });
    }
    out.sections.push(sec5);

    /* ---------- 结果与原因 ---------- */
    var verdicts = [];
    verdicts.push('你是「' + de + '日主・' + r.strength + '・' + r.geJu + '」');
    if (r.strength === '身弱') verdicts.push('走「靠人、靠学、靠平台」的路子最稳');
    else if (r.strength === '身强') verdicts.push('走「靠本事输出、靠担责、靠业绩」的路子最发');
    else verdicts.push('中和之局，顺着大运走，别硬拗');
    var best = r.yongShen.join('、');
    verdicts.push('要补的是' + best + '，要躲的是' + r.jiShen.join('、'));
    out.verdict = {
      answer: verdicts[0],
      points: verdicts.slice(1),
      strength: r.strength,
      conf: r.strength === '中和' ? 65 : 72
    };
    return out;

    function groupOf(ss) {
      if (ss === '比肩' || ss === '劫财') return '比劫';
      if (ss === '食神' || ss === '伤官') return '食伤';
      if (ss === '正财' || ss === '偏财') return '财星';
      if (ss === '正官' || ss === '七杀') return '官杀';
      return '印星';
    }
    /* 大运／流年三档：喜 / 忌 / 平 —— 直接按命局用神喜忌判定 */
    function gradeOf(shiShen) {
      var g = groupOf(shiShen);
      if (r.yongShen.indexOf(g) >= 0) return '喜';
      if (r.jiShen.indexOf(g) >= 0) return '忌';
      return '平';
    }
  }

  var API = { analyze: analyze, GAN_XIANG: GAN_XIANG, SS_XING: SS_XING };
  root.BaZiRead = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
