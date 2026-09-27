/* Shared page-boundary model for the projector and entry helper. */
(function (root) {
  'use strict';
  const books = '創 出エジ レビ 民 申 ヨシュ 士 ルツ サム上 サム下 列王上 列王下 歴代上 歴代下 エズ ネヘ エス ヨブ 詩 箴 伝 雅 イザ エレ 哀 エゼ ダニ ホセ ヨエ アモ オバ ヨナ ミカ ナホ ハバ ゼパ ハガ ゼカ マラ マタ マル ルカ ヨハ 使徒 ロマ Ⅰコリ Ⅱコリ ガラ エペ ピリ コロ Ⅰテサ Ⅱテサ Ⅰテモ Ⅱテモ テト ピレ ヘブ ヤコ Ⅰペテ Ⅱペテ Ⅰヨハ Ⅱヨハ Ⅲヨハ ユダ 黙'.split(' ');
  function verses(rows) {
    return rows.flatMap(row => {
      const match = /^(.*?)(\d+):(\d+)$/.exec(row[3] || '');
      const book = match ? books.indexOf(match[1]) : -1;
      return book < 0 ? [] : [{ ref: row[3], book, chapter: Number(match[2]), verse: Number(match[3]), section: book < 39 ? 'OT' : 'NT', text: row[4] || '' }];
    });
  }
  function validate(data, items) {
    if (!data || ![1, 2].includes(data.version) || !Array.isArray(data.boundaries)) throw new Error('ページデータの形式が正しくありません。');
    if (data.version === 2) {
      if (!data.starts || !['OT', 'NT'].every(section => Number.isSafeInteger(data.starts[section]) && data.starts[section] > 0 && data.starts[section] <= 1000000)) throw new Error('開始ページ番号を確認してください。');
      const completed = { OT: false, NT: false, ...data.completed };
      if (!['OT', 'NT'].every(section => typeof completed[section] === 'boolean')) throw new Error('最終ページの補完設定を確認してください。');
      const positions = new Map(items.map((v, i) => [v.ref, i]));
      const seen = new Set();
      const boundaries = data.boundaries.map(b => {
        if (!b || !positions.has(b.ref) || seen.has(b.ref)) throw new Error('開始位置の聖句・重複を確認してください。');
        seen.add(b.ref); return { ref: b.ref };
      }).sort((a, b) => positions.get(a.ref) - positions.get(b.ref));
      return { version: 2, starts: { OT: data.starts.OT, NT: data.starts.NT }, completed, boundaries };
    }
    const positions = new Map(items.map((v, i) => [v.ref, i]));
    const seen = new Set();
    const boundaries = data.boundaries.map(b => {
      if (!b || !positions.has(b.ref) || !Number.isSafeInteger(b.page) || b.page < 1 || seen.has(b.ref)) throw new Error('聖句・ページ番号・重複を確認してください。');
      seen.add(b.ref);
      return { ref: b.ref, page: b.page };
    }).sort((a, b) => positions.get(a.ref) - positions.get(b.ref));
    const previous = {};
    for (const b of boundaries) {
      const section = items[positions.get(b.ref)].section;
      if (previous[section] !== undefined && b.page <= previous[section]) throw new Error('同じ旧約・新約の中では、後の聖句により大きいページ番号を指定してください。');
      previous[section] = b.page;
    }
    return { version: 1, boundaries };
  }
  function expand(data, items) {
    const clean = validate(data, items);
    if (clean.version === 2) {
      const sections = new Map(items.map(v => [v.ref, v.section]));
      const numbers = { ...clean.starts };
      clean.boundaries = clean.boundaries.map(b => ({ ref: b.ref, page: numbers[sections.get(b.ref)]++ }));
    }
    const positions = new Map(items.map((v, i) => [v.ref, i]));
    const result = new Map();
    const sectionEnds = {};
    items.forEach((item, i) => { sectionEnds[item.section] = i + 1; });
    clean.boundaries.forEach((b, n) => {
      const start = positions.get(b.ref);
      const next = clean.boundaries[n + 1];
      const end = next && items[positions.get(next.ref)].section === items[start].section ? positions.get(next.ref) : clean.completed?.[items[start].section] ? sectionEnds[items[start].section] : start + 1;
      for (let i = start; i < end; i++) result.set(items[i].ref, { page: b.page, section: items[i].section, manual: i === start });
    });
    return result;
  }
  function label(entry) { return entry ? `${entry.section === 'OT' ? '旧約' : '新約'} p.${entry.page}` : ''; }
  function toMarkers(data, items) {
    const clean = validate(data, items);
    if (clean.version === 2) return clean;
    const sections = new Map(items.map(v => [v.ref, v.section]));
    const starts = { OT: 1, NT: 1 }, counts = { OT: 0, NT: 0 };
    for (const b of clean.boundaries) {
      const section = sections.get(b.ref);
      if (!counts[section]) starts[section] = b.page;
      if (b.page !== starts[section] + counts[section]++) throw new Error('既存データのページ番号に飛びがあるため自動変換できません。保存済みデータは変更していません。');
    }
    return { version: 2, starts, boundaries: clean.boundaries.map(b => ({ ref: b.ref })) };
  }
  async function load(items) {
    const response = await fetch('./bible-pages.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('ページデータを読み込めませんでした。');
    return validate(await response.json(), items);
  }
  const api = { books, verses, validate, expand, label, load, toMarkers };
  root.BiblePages = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
