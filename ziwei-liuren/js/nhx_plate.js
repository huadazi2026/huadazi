/* ================================================================
   天纪格式排盘渲染
   版式（依倪海厦《天纪》排盘程序输出）：
     4×4 网格，外圈十二宫，中间 2×2 为信息栏
     每格：左列＝大星（十四主星 + 六吉六煞，带庙旺与四化）
           右列＝小星（杂曜）
           居中宫干支 · 宫煞 · 大限 · 长生十二神 · 宫名
     三方四正：本宫↔对宫、三合两宫↔各自对宫，画金线
   配色沿用 App 主题变量，保证与页面一致
   ================================================================ */
(function (root) {
  'use strict';

  var ZHI = '子丑寅卯辰巳午未申酉戌亥';

  /* 网格：上排 巳午未申 ／ 左列 辰卯 ／ 右列 酉戌 ／ 下排 寅丑子亥 */
  var LAYOUT = [
    ['巳', '午', '未', '申'],
    ['辰', null, null, '酉'],
    ['卯', null, null, '戌'],
    ['寅', '丑', '子', '亥']
  ];

  /* 十四主星次序 */
  var ORDER = {};
  ['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼','巨门','天相','天梁','七杀','破军']
    .forEach(function (s, i) { ORDER[s] = i; });
  /* 六吉、六煞 */
  var JI = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺'];
  var SHA6 = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];
  var JI_ORDER = {}, SHA_ORDER = {};
  JI.forEach(function (s, i) { JI_ORDER[s] = i; });
  SHA6.forEach(function (s, i) { SHA_ORDER[s] = i; });
  /* 宫煞（单独显示在干支下方） */
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
    return v === '地' ? '得' : v;     /* 「地」即「得」 */
  }
  function huaOf(p, star) {
    var hs = p.hua || [];
    for (var i = 0; i < hs.length; i++) if (hs[i] && hs[i].star === star) return hs[i].hua || '';
    return '';
  }
  function palaceOf(c, zhi) {
    for (var i = 0; i < c.palaces.length; i++) if (c.palaces[i].zhiName === zhi) return c.palaces[i];
    return null;
  }
  function posOf(zhi) {
    for (var r = 0; r < 4; r++) for (var c2 = 0; c2 < 4; c2++) if (LAYOUT[r][c2] === zhi) return { r: r, c: c2 };
    return null;
  }
  function cellCenter(zhi) {
    var p = posOf(zhi);
    if (!p) return null;
    return { x: (p.c + 0.5) * 25, y: (p.r + 0.5) * 25 };
  }

  /* 单格 */
  /* role: 'ming' 本宫 ／ 'san' 三合 ／ 'dui' 对宫 ／ '' 无关 */
  function cell(c, zhi, role) {
    var p = palaceOf(c, zhi);
    if (!p) return '<div class="tp-cell tp-void"></div>';

    var mains = [], ji = [], sha = [], misc = [];
    var all = (p.stars || []).slice();
    for (var q = 0; q < all.length; q++) {
      var s = all[q];
      if (s.length > 1 && s.charAt(0) === '化') continue;      /* 化禄等由 hua 带出 */
      if ((p.mainStars || []).indexOf(s) >= 0) { mains.push(s); continue; }
      if (JI.indexOf(s) >= 0) { ji.push(s); continue; }
      if (SHA6.indexOf(s) >= 0) { sha.push(s); continue; }
      if (GONG_SHA.indexOf(s) >= 0) continue;
      misc.push(s);
    }
    mains.sort(function (a, b) { return (ORDER[a] || 99) - (ORDER[b] || 99); });
    ji.sort(function (a, b) { return (JI_ORDER[a] || 99) - (JI_ORDER[b] || 99); });
    sha.sort(function (a, b) { return (SHA_ORDER[a] || 99) - (SHA_ORDER[b] || 99); });

    var big = mains.concat(ji, sha);   /* 左列：大星 */
    var small = misc;                  /* 右列：小星 */

    function bigHtml(st) {
      var hu = huaOf(p, st);
      var h = '<b>' + esc(st) + '</b>';
      if (bright(zhi, st)) h += '<i>' + esc(bright(zhi, st)) + '</i>';
      if (hu) h += '<em class="tp-h tp-h' + esc(hu.charAt(1)) + '">' + esc(hu) + '</em>';
      return h;
    }
    var rows = Math.max(big.length, small.length, 1);
    var gp = posOf(zhi) || { r: 0, c: 0 };
    var roleCls = role === 'ming' ? ' tp-r-ming' : (role === 'san' ? ' tp-r-san' : (role === 'dui' ? ' tp-r-dui' : ''));
    var roleTag = role === 'ming' ? '本宫' : (role === 'san' ? '三合' : (role === 'dui' ? '对宫' : ''));
    var h = '<div class="tp-cell' + (p.isMing ? ' tp-ming' : '') + roleCls + '" data-zhi="' + zhi +
            '" style="grid-area:' + (gp.r + 1) + '/' + (gp.c + 1) + '">';
    if (roleTag) h += '<span class="tp-role">' + roleTag + '</span>';
    h += '<div class="tp-stars">';
    for (var k = 0; k < rows; k++) {
      h += '<div class="tp-sr">';
      h += '<span class="tp-a">' + (big[k] ? bigHtml(big[k]) : '') + '</span>';
      h += '<span class="tp-b">' + (small[k] ? '<span>' + esc(small[k]) + '</span>' +
           (bright(zhi, small[k]) ? '<i>' + esc(bright(zhi, small[k])) + '</i>' : '') : '') + '</span>';
      h += '</div>';
    }
    h += '</div>';

    var gsha = [];
    for (var z2 = 0; z2 < all.length; z2++) if (GONG_SHA.indexOf(all[z2]) >= 0) gsha.push(all[z2]);
    h += '<div class="tp-mid"><span class="tp-gz">' + esc(p.ganName + p.zhiName) + '</span>';
    if (gsha.length) h += '<span class="tp-sha">' + gsha.map(esc).join('·') + '</span>';
    h += '</div>';
    h += '<div class="tp-foot"><span>' + (p.limit ? (p.limit.from + '-' + p.limit.to) : '') + '</span>' +
         '<span>' + esc(p.changsheng || '') + '</span>' +
         '<span class="tp-pn">' + esc(p.name) + '</span></div>';
    h += '</div>';
    return h;
  }

  /* 中间信息栏 */
  function center(c, o) {
    var i = c.info;
    var h = '<div class="tp-center" style="grid-area:2/2/4/4">';
    h += '<div class="tp-cl">民国 ' + esc(o.roc) + ' 年生</div>';
    h += '<div class="tp-cl">' + esc(i.yearGZ) + '年　' + esc(i.lunar.m) + ' 月 ' + esc(i.lunar.d) + ' 日 ' + esc(c.hourZhiName) + '时</div>';
    h += '<div class="tp-cl">' + esc(o.genderLabel || '') + '　' + esc(c.juName) + '</div>';
    h += '<div class="tp-cl2">命宫 <b>' + esc(c.mingGanZhi) + '</b>　身宫 <b>' + esc(c.shenGanZhi) + '</b></div>';
    if (c.mingZhu) h += '<div class="tp-cl2">命主 ' + esc(c.mingZhu) + '　身主 ' + esc(c.shenZhu) + '　大限' + (c.forward ? '顺行' : '逆行') + '</div>';
    if (o.question) h += '<div class="tp-cl2">所问：' + esc(o.question) + '</div>';
    h += '</div>';
    return h;
  }

  /* 三方四正：本宫（命宫）+ 三合两宫(±4) + 对宫(+6)
     矩形宫格上画直线必然斜穿无关宫位（会误导），所以改为给这四个宫位打标记 */
  function sanfangSet(c) {
    var ming = null;
    for (var i = 0; i < c.palaces.length; i++) if (c.palaces[i].isMing) ming = c.palaces[i].zhiName;
    if (ming == null) return null;
    var mi = ZHI.indexOf(ming);
    return { ming: ming, san: [ZHI[(mi + 4) % 12], ZHI[(mi + 8) % 12]], dui: ZHI[(mi + 6) % 12] };
  }
  function roleOf(c, zhi) {
    var sf = sanfangSet(c);
    if (!sf) return "";
    if (sf.ming === zhi) return "ming";
    if (sf.san.indexOf(zhi) >= 0) return "san";
    if (sf.dui === zhi) return "dui";
    return "";
  }
  /* 整盘 */
  function plate(c, o) {
    o = o || {};
    var h = '<div class="tp-wrap"><div class="tp-grid">';
    for (var r = 0; r < 4; r++) {
      for (var col = 0; col < 4; col++) {
        if (r === 1 && col === 1) { h += center(c, o); continue; }
        if ((r === 1 && col === 2) || (r === 2 && col === 1) || (r === 2 && col === 2)) {
          h += '<div class="tp-hole" style="grid-area:' + (r + 1) + '/' + (col + 1) + '"></div>'; continue;
        }
        var z = LAYOUT[r][col];
        h += z ? cell(c, z, roleOf(c, z)) : '<div class="tp-cell tp-void" style="grid-area:' + (r + 1) + '/' + (col + 1) + '"></div>';
      }
    }
    h += '</div>';
    h += '</div>';
    return h;
  }

  root.TianJiPlate = { plate: plate, cell: cell, LAYOUT: LAYOUT };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TianJiPlate;
})(typeof globalThis !== 'undefined' ? globalThis : this);
