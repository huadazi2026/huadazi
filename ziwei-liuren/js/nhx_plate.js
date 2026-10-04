/* 天纪格式排盘渲染（简洁明了版）
   字段全部取自倪海厦《天纪》排盘程序，并经 OCR 读软件真实输出核对：
     主星（左列，附庙旺 + 四化） ｜ 杂曜（右列，附庙旺）
     宫干支 · 宫煞（空亡/天伤/天使/旬中/截路）
     大限岁数段 · 长生十二神 · 宫名
   未收录：博士十二神（软件表内无此表，其起法未能从样本确证，故不显示）
   ================================================================ */
(function (root) {
  'use strict';

  var ZHI = '子丑寅卯辰巳午未申酉戌亥';
  var LAYOUT = [
    ['巳', '午', '未', '申'],
    ['辰', null, null, '酉'],
    ['卯', null, null, '戌'],
    ['寅', '丑', '子', '亥']
  ];
  var ORDER = {};
  ['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼','巨门','天相','天梁','七杀','破军']
    .forEach(function (s, i) { ORDER[s] = i; });
  var GONG_SHA = ['空亡', '天伤', '天使', '旬中', '截路'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function bright(zhi, star) {
    var T = root.NHX_MIAO;
    if (!T) return '';
    var row = T[zhi];
    var v = (row && row[star]) || '';
    return v === '地' ? '得' : v;   /* 「地」即「得」，统一写法 */
  }
  function huaOf(p, star) {
    var hs = p.hua || [];
    for (var i = 0; i < hs.length; i++) if (hs[i] && hs[i].star === star) return hs[i].hua || '';
    return '';
  }

  function cell(c, zhi) {
    var p = null;
    for (var i = 0; i < c.palaces.length; i++) if (c.palaces[i].zhiName === zhi) p = c.palaces[i];
    if (!p) return '<div class="tp-cell tp-void"></div>';

    var mains = (p.mainStars || []).slice().sort(function (a, b) {
      return (ORDER[a] || 99) - (ORDER[b] || 99);
    });
    var others = [], sha = [];
    var all = p.stars || [];
    for (var q = 0; q < all.length; q++) {
      var s = all[q];
      if (s.length > 1 && s.charAt(0) === '化') continue;
      if (mains.indexOf(s) >= 0) continue;
      if (GONG_SHA.indexOf(s) >= 0) { sha.push(s); continue; }
      others.push(s);
    }
    var rows = Math.max(mains.length, others.length, 1);
    var h = '<div class="tp-cell' + (p.isMing ? ' tp-ming' : '') + '">';
    h += '<div class="tp-stars">';
    for (var k = 0; k < rows; k++) {
      h += '<div class="tp-sr">';
      h += '<span class="tp-a">';
      if (mains[k]) {
        var hu = huaOf(p, mains[k]);
        h += '<b>' + esc(mains[k]) + '</b>';
        if (bright(zhi, mains[k])) h += '<i>' + esc(bright(zhi, mains[k])) + '</i>';
        if (hu) h += '<em class="tp-h tp-h' + esc(hu.charAt(1)) + '">' + esc(hu) + '</em>';
      }
      h += '</span><span class="tp-b">';
      if (others[k]) {
        h += '<span>' + esc(others[k]) + '</span>';
        if (bright(zhi, others[k])) h += '<i>' + esc(bright(zhi, others[k])) + '</i>';
      }
      h += '</span></div>';
    }
    h += '</div>';
    h += '<div class="tp-mid"><span class="tp-gz">' + esc(p.ganName + p.zhiName) + '</span>';
    if (sha.length) h += '<span class="tp-sha">' + sha.map(esc).join('·') + '</span>';
    h += '</div>';
    h += '<div class="tp-foot"><span>' + (p.limit ? (p.limit.from + '-' + p.limit.to) : '') + '</span>' +
         '<span>' + esc(p.changsheng || '') + '</span>' +
         '<span class="tp-pn">' + esc(p.name) + '</span></div>';
    h += '</div>';
    return h;
  }

  function center(c, o) {
    var i = c.info;
    var h = '<div class="tp-center">';
    h += '<div class="tp-cl">民国 ' + esc(o.roc) + ' 年生</div>';
    h += '<div class="tp-cl">' + esc(i.yearGZ) + '年　' + esc(i.lunar.m) + ' 月 ' + esc(i.lunar.d) + ' 日 ' + esc(c.hourZhiName) + '时</div>';
    h += '<div class="tp-cl">' + esc(o.genderLabel || '') + '　' + esc(c.juName) + '</div>';
    h += '<div class="tp-cl2">命宫 <b>' + esc(c.mingGanZhi) + '</b>　身宫 <b>' + esc(c.shenGanZhi) + '</b></div>';
    h += '<div class="tp-cl2">命主 ' + esc(c.mingZhu) + '　身主 ' + esc(c.shenZhu) + '　大限' + (c.forward ? '顺行' : '逆行') + '</div>';
    if (o.question) h += '<div class="tp-cl2">所问：' + esc(o.question) + '</div>';
    h += '</div>';
    return h;
  }

  function plate(c, o) {
    o = o || {};
    var h = '<div class="tp-wrap"><div class="tp-grid">';
    for (var r = 0; r < 4; r++) {
      for (var col = 0; col < 4; col++) {
        if (r === 1 && col === 1) { h += center(c, o); continue; }   /* 占 2×2 */
        if ((r === 1 && col === 2) || (r === 2 && col === 1) || (r === 2 && col === 2)) {
          h += '<div class="tp-hole"></div>';                        /* 补齐占位，避免错行 */
          continue;
        }
        var z = LAYOUT[r][col];
        h += z ? cell(c, z) : '<div class="tp-cell tp-void"></div>';
      }
    }
    h += '</div></div>';
    return h;
  }

  root.TianJiPlate = { plate: plate, cell: cell };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TianJiPlate;
})(typeof globalThis !== 'undefined' ? globalThis : this);
