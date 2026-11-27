/* Client-side, dependency-free PPTX (OpenXML) importer for Slide Studio. */
(function (root) {
  'use strict';
  const C = root.SlideCore || (typeof require === 'function' ? require('./core.js') : null);
  const MAX_ZIP_BYTES = 50 * 1024 * 1024;
  const MAX_ENTRIES = 2000;
  const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 120 * 1024 * 1024;

  // --- Lightweight XML Parser (works identically in Browser and Node.js) ---
  function decodeEntities(str) {
    return str.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_, ent) => {
      if (ent === 'amp') return '&';
      if (ent === 'lt') return '<';
      if (ent === 'gt') return '>';
      if (ent === 'quot') return '"';
      if (ent === 'apos') return "'";
      const code = ent.startsWith('#x') ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
  }
  function parseAttrs(raw) {
    const attrs = {};
    const re = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m;
    while ((m = re.exec(raw))) {
      const val = decodeEntities(m[2] !== undefined ? m[2] : m[3]);
      attrs[m[1]] = val;
      const idx = m[1].indexOf(':');
      if (idx >= 0) attrs[m[1].slice(idx + 1)] = val;
    }
    return attrs;
  }
  function parseXml(xmlText) {
    const rootNode = { name: '#root', local: '#root', attrs: {}, children: [], text: '' };
    const stack = [rootNode];
    let i = 0;
    const len = xmlText.length;
    while (i < len) {
      const lt = xmlText.indexOf('<', i);
      if (lt < 0) {
        if (i < len) stack[stack.length - 1].text += decodeEntities(xmlText.slice(i));
        break;
      }
      if (lt > i) {
        stack[stack.length - 1].text += decodeEntities(xmlText.slice(i, lt));
      }
      if (xmlText.startsWith('<!--', lt)) {
        const end = xmlText.indexOf('-->', lt + 4);
        i = end < 0 ? len : end + 3;
        continue;
      }
      if (xmlText.startsWith('<![CDATA[', lt)) {
        const end = xmlText.indexOf(']]>', lt + 9);
        const text = end < 0 ? xmlText.slice(lt + 9) : xmlText.slice(lt + 9, end);
        stack[stack.length - 1].text += text;
        i = end < 0 ? len : end + 3;
        continue;
      }
      if (xmlText.startsWith('<?', lt) || xmlText.startsWith('<!', lt)) {
        const end = xmlText.indexOf('>', lt + 2);
        i = end < 0 ? len : end + 1;
        continue;
      }
      const gt = xmlText.indexOf('>', lt + 1);
      if (gt < 0) break;
      const tag = xmlText.slice(lt + 1, gt).trim();
      i = gt + 1;
      if (!tag) continue;
      if (tag.startsWith('/')) {
        const closeName = tag.slice(1).trim();
        const closeLocal = closeName.includes(':') ? closeName.slice(closeName.indexOf(':') + 1) : closeName;
        for (let s = stack.length - 1; s > 0; s--) {
          if (stack[s].name === closeName || stack[s].local === closeLocal) {
            stack.length = s;
            break;
          }
        }
        continue;
      }
      const selfClosing = tag.endsWith('/');
      const body = selfClosing ? tag.slice(0, -1).trim() : tag;
      const spaceIdx = body.search(/[\s\r\n\t]/);
      const name = spaceIdx < 0 ? body : body.slice(0, spaceIdx);
      const attrStr = spaceIdx < 0 ? '' : body.slice(spaceIdx + 1);
      const colonIdx = name.indexOf(':');
      const node = {
        name,
        local: colonIdx >= 0 ? name.slice(colonIdx + 1) : name,
        attrs: attrStr ? parseAttrs(attrStr) : {},
        children: [],
        text: ''
      };
      stack[stack.length - 1].children.push(node);
      if (!selfClosing) stack.push(node);
    }
    return rootNode.children[0] || rootNode;
  }
  const child = (node, local) => node?.children?.find(c => c.local === local) || null;
  const children = (node, local) => (node?.children || []).filter(c => c.local === local);
  function descendants(node, local, out = []) {
    if (!node) return out;
    for (const c of node.children || []) {
      if (c.local === local) out.push(c);
      descendants(c, local, out);
    }
    return out;
  }
  function findPath(node, ...locals) {
    let cur = node;
    for (const loc of locals) {
      cur = child(cur, loc);
      if (!cur) return null;
    }
    return cur;
  }

  // --- Safe ZIP Reader ---
  async function inflateRaw(bytes) {
    if (typeof DecompressionStream !== 'function') {
      throw new Error('このブラウザでは圧縮データの展開に対応していません。');
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  function normalizeZipPath(name) {
    const cleaned = String(name || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!cleaned || cleaned.split('/').some(seg => seg === '..')) {
      throw new Error('不正なファイルパスを含む PPTX ファイルです。');
    }
    return cleaned;
  }
  async function readZip(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (bytes.byteLength > MAX_ZIP_BYTES) throw new Error('読み込める PPTX ファイルは 50MB までです。');
    if (bytes.byteLength < 22) throw new Error('有効な PPTX（ZIP）ファイルではありません。');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocdOffset = -1;
    const minOffset = Math.max(0, bytes.byteLength - 65557);
    for (let p = bytes.byteLength - 22; p >= minOffset; p--) {
      if (view.getUint32(p, true) === 0x06054b50) { eocdOffset = p; break; }
    }
    if (eocdOffset < 0) throw new Error('PPTX ファイルの終端情報が見つかりません。');
    const entryCount = view.getUint16(eocdOffset + 10, true);
    const cdSize = view.getUint32(eocdOffset + 12, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    if (entryCount > MAX_ENTRIES || cdOffset + cdSize > bytes.byteLength) {
      throw new Error('PPTX ファイルの構造が不正またはエントリ数が多すぎます。');
    }
    const decoder = new TextDecoder('utf-8');
    const files = new Map();
    let totalBytes = 0;
    let cursor = cdOffset;
    for (let i = 0; i < entryCount; i++) {
      if (cursor + 46 > bytes.byteLength || view.getUint32(cursor, true) !== 0x02014b50) {
        throw new Error('PPTX ファイルのディレクトリ情報が破損しています。');
      }
      const method = view.getUint16(cursor + 10, true);
      const compSize = view.getUint32(cursor + 20, true);
      const uncompSize = view.getUint32(cursor + 24, true);
      const nameLen = view.getUint16(cursor + 28, true);
      const extraLen = view.getUint16(cursor + 30, true);
      const commentLen = view.getUint16(cursor + 32, true);
      const localOffset = view.getUint32(cursor + 42, true);
      const rawName = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen));
      cursor += 46 + nameLen + extraLen + commentLen;
      if (rawName.endsWith('/')) continue;
      const path = normalizeZipPath(rawName);
      if (uncompSize > MAX_ENTRY_BYTES || totalBytes + uncompSize > MAX_TOTAL_BYTES) {
        throw new Error('PPTX ファイルの展開サイズが上限を超えています。');
      }
      if (localOffset + 30 > bytes.byteLength || view.getUint32(localOffset, true) !== 0x04034b50) {
        throw new Error('PPTX ファイル内のエントリが破損しています。');
      }
      const lNameLen = view.getUint16(localOffset + 26, true);
      const lExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      if (dataStart + compSize > bytes.byteLength) {
        throw new Error('PPTX ファイル内のデータが途中で切れています。');
      }
      const compressed = bytes.subarray(dataStart, dataStart + compSize);
      let output;
      if (method === 0) output = new Uint8Array(compressed);
      else if (method === 8) output = await inflateRaw(compressed);
      else throw new Error(`未対応の ZIP 圧縮形式（${method}）が含まれています。`);
      if (output.byteLength > MAX_ENTRY_BYTES || totalBytes + output.byteLength > MAX_TOTAL_BYTES) {
        throw new Error('PPTX ファイルの展開サイズが上限を超えています。');
      }
      totalBytes += output.byteLength;
      files.set(path, output);
    }
    return files;
  }

  function readTextFile(files, path) {
    const data = files.get(path);
    return data ? new TextDecoder('utf-8').decode(data) : null;
  }
  function resolvePath(basePath, target) {
    if (!target) return '';
    if (target.startsWith('/')) return normalizeZipPath(target);
    const parts = basePath.split('/');
    parts.pop();
    for (const seg of target.replace(/\\/g, '/').split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') { if (!parts.length) throw new Error('不正な参照パスです。'); parts.pop(); }
      else parts.push(seg);
    }
    return parts.join('/');
  }
  function parseRels(files, ownerPath) {
    const idx = ownerPath.lastIndexOf('/');
    const dir = idx >= 0 ? ownerPath.slice(0, idx + 1) : '';
    const file = idx >= 0 ? ownerPath.slice(idx + 1) : ownerPath;
    const relsPath = `${dir}_rels/${file}.rels`;
    const xml = readTextFile(files, relsPath);
    const map = new Map();
    if (!xml) return map;
    const rootNode = parseXml(xml);
    for (const rel of children(rootNode, 'Relationship')) {
      if (rel.attrs.TargetMode === 'External') continue;
      try {
        map.set(rel.attrs.Id, {
          type: rel.attrs.Type || '',
          target: resolvePath(ownerPath, rel.attrs.Target)
        });
      } catch { /* Ignore external or invalid targets */ }
    }
    return map;
  }

  // --- Color, Font & Geometry Helpers ---
  const PRESET_COLORS = {
    black: '000000', white: 'ffffff', red: 'ff0000', green: '008000', blue: '0000ff',
    yellow: 'ffff00', cyan: '00ffff', magenta: 'ff00ff', gray: '808080', grey: '808080',
    dkGray: '404040', ltGray: 'c0c0c0', silver: 'c0c0c0', orange: 'ffa500', navy: '000080'
  };
  const clampByte = v => Math.max(0, Math.min(255, Math.round(v)));
  const hexByte = v => clampByte(v).toString(16).padStart(2, '0');
  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    if (s === 0) { const v = l * 255; return [v, v, v]; }
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
  }
  function applyColorModifiers(hex, node) {
    let [r, g, b] = hexToRgb(hex);
    let alpha = 1;
    for (const mod of node.children || []) {
      const pct = Number(mod.attrs.val) / 100000;
      if (!Number.isFinite(pct)) continue;
      if (mod.local === 'tint') {
        r = r + (255 - r) * (1 - pct);
        g = g + (255 - g) * (1 - pct);
        b = b + (255 - b) * (1 - pct);
      } else if (mod.local === 'shade') {
        r *= pct; g *= pct; b *= pct;
      } else if (mod.local === 'lumMod' || mod.local === 'lumOff' || mod.local === 'satMod') {
        let [h, s, l] = rgbToHsl(r, g, b);
        if (mod.local === 'lumMod') l = Math.max(0, Math.min(1, l * pct));
        if (mod.local === 'lumOff') l = Math.max(0, Math.min(1, l + pct));
        if (mod.local === 'satMod') s = Math.max(0, Math.min(1, s * pct));
        [r, g, b] = hslToRgb(h, s, l);
      } else if (mod.local === 'alpha') {
        alpha = Math.max(0, Math.min(1, pct));
      }
    }
    return { hex: `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`, alpha };
  }
  function resolveColor(container, theme, clrMap, phColor = null) {
    if (!container) return null;
    for (const c of container.children || []) {
      let baseHex = null;
      if (c.local === 'srgbClr' && /^[0-9a-f]{6}$/i.test(c.attrs.val || '')) {
        baseHex = `#${c.attrs.val}`;
      } else if (c.local === 'schemeClr') {
        const key = c.attrs.val;
        if (key === 'phClr' && phColor) baseHex = phColor;
        else {
          const mapped = clrMap?.[key] || key;
          baseHex = theme.colors[mapped] || theme.colors[key] || null;
        }
      } else if (c.local === 'sysClr') {
        if (/^[0-9a-f]{6}$/i.test(c.attrs.lastClr || '')) baseHex = `#${c.attrs.lastClr}`;
        else if (c.attrs.val === 'windowText') baseHex = '#000000';
        else if (c.attrs.val === 'window') baseHex = '#ffffff';
      } else if (c.local === 'prstClr') {
        const p = PRESET_COLORS[c.attrs.val];
        if (p) baseHex = `#${p}`;
      } else if (c.local === 'scrgbClr') {
        const r = clampByte((Number(c.attrs.r) || 0) / 100000 * 255);
        const g = clampByte((Number(c.attrs.g) || 0) / 100000 * 255);
        const b = clampByte((Number(c.attrs.b) || 0) / 100000 * 255);
        baseHex = `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
      }
      if (baseHex) return applyColorModifiers(baseHex, c);
    }
    return null;
  }
  function mapFont(face, theme) {
    if (!face) return 'Yu Gothic';
    let resolved = face;
    if (face === '+mj-ea') resolved = theme.majorEa || theme.majorLatin;
    else if (face === '+mj-lt') resolved = theme.majorLatin;
    else if (face === '+mn-ea') resolved = theme.minorEa || theme.minorLatin;
    else if (face === '+mn-lt') resolved = theme.minorLatin;
    if (!resolved) return 'Yu Gothic';
    if (C.fonts.includes(resolved)) return resolved;
    const lower = resolved.toLowerCase();
    if (/mincho|明朝|serif|simsun|songti|pmingliu|mingliu/.test(lower)) {
      if (/noto serif/.test(lower)) return 'Noto Serif JP';
      return 'Yu Mincho';
    }
    if (/meiryo|メイリオ/.test(lower)) return 'Meiryo';
    if (/hiragino|ヒラギノ/.test(lower)) return 'Hiragino Kaku Gothic ProN';
    if (/yahei|微软雅黑|simhei|pingfang|noto sans sc/.test(lower)) {
      return /noto sans sc/.test(lower) ? 'Noto Sans SC' : 'Microsoft YaHei';
    }
    if (/jhenghei|微軟正黑|noto sans tc/.test(lower)) return 'Noto Sans TC';
    if (/noto sans/.test(lower)) return 'Noto Sans JP';
    if (/arial|calibri|segoe|helvetica|aptos/.test(lower)) return 'Arial';
    if (/gothic|ゴシック|sans/.test(lower)) return 'Yu Gothic';
    return 'Yu Gothic';
  }

  function extractTheme(files, themePath) {
    const theme = { colors: { dk1: '#000000', lt1: '#ffffff', dk2: '#1f497d', lt2: '#eeece1', accent1: '#4f81bd', accent2: '#c0504d', accent3: '#9bbb59', accent4: '#8064a2', accent5: '#4bacc6', accent6: '#f79646' }, majorLatin: 'Arial', majorEa: 'Yu Gothic', minorLatin: 'Arial', minorEa: 'Yu Gothic' };
    const xml = readTextFile(files, themePath);
    if (!xml) return theme;
    const rootNode = parseXml(xml);
    const clrScheme = findPath(rootNode, 'themeElements', 'clrScheme');
    if (clrScheme) {
      for (const c of clrScheme.children || []) {
        const srgb = child(c, 'srgbClr');
        const sys = child(c, 'sysClr');
        const hex = srgb?.attrs.val || sys?.attrs.lastClr;
        if (/^[0-9a-f]{6}$/i.test(hex || '')) theme.colors[c.local] = `#${hex}`;
      }
    }
    const fontScheme = findPath(rootNode, 'themeElements', 'fontScheme');
    const readFontGroup = (grp, prefix) => {
      if (!grp) return;
      const latin = child(grp, 'latin')?.attrs.typeface;
      const ea = child(grp, 'ea')?.attrs.typeface;
      if (latin) theme[`${prefix}Latin`] = latin;
      if (ea) theme[`${prefix}Ea`] = ea;
    };
    readFontGroup(child(fontScheme, 'majorFont'), 'major');
    readFontGroup(child(fontScheme, 'minorFont'), 'minor');
    return theme;
  }

  // --- Image Handling ---
  const MIME_BY_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
  function bytesToBase64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }
  async function loadImageDataUrl(files, mediaPath) {
    const bytes = files.get(mediaPath);
    if (!bytes) return null;
    const ext = mediaPath.split('.').pop()?.toLowerCase() || '';
    const mime = MIME_BY_EXT[ext];
    if (!mime) return null;
    if (mime !== 'image/bmp') {
      const dataUrl = `data:${mime};base64,${bytesToBase64(bytes)}`;
      if (dataUrl.length > 16 * 1024 * 1024) return null;
      return dataUrl;
    }
    if (typeof document !== 'undefined' && typeof Image !== 'undefined') {
      try {
        const url = URL.createObjectURL(new Blob([bytes], { type: 'image/bmp' }));
        const img = new Image();
        img.src = url;
        await img.decode();
        const cvs = document.createElement('canvas');
        cvs.width = img.naturalWidth; cvs.height = img.naturalHeight;
        cvs.getContext('2d').drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const pngUrl = cvs.toDataURL('image/png');
        return pngUrl.length <= 16 * 1024 * 1024 ? pngUrl : null;
      } catch { return null; }
    }
    return null;
  }

  // --- Style & Text Extraction ---
  function readXfrm(spPr, emuScale, offX = 0, offY = 0) {
    const xfrm = child(spPr, 'xfrm');
    if (!xfrm) return null;
    const off = child(xfrm, 'off'), ext = child(xfrm, 'ext');
    if (!off || !ext) return null;
    const x = (Number(off.attrs.x) || 0) * emuScale + offX;
    const y = (Number(off.attrs.y) || 0) * emuScale + offY;
    const width = Math.max(1, (Number(ext.attrs.cx) || 0) * emuScale);
    const height = Math.max(1, (Number(ext.attrs.cy) || 0) * emuScale);
    const rotation = xfrm.attrs.rot ? Math.round((((Number(xfrm.attrs.rot) / 60000) % 360 + 360) % 360) * 100) / 100 : 0;
    return { x, y, width, height, rotation, flipH: xfrm.attrs.flipH === '1', flipV: xfrm.attrs.flipV === '1' };
  }
  function resolveLineStyle(lnNode, theme, clrMap, emuScale) {
    if (!lnNode || child(lnNode, 'noFill')) return { strokeWidth: 0, stroke: '#15574b', strokeStyle: 'solid', alpha: 1 };
    const fill = child(lnNode, 'solidFill');
    const col = fill ? resolveColor(fill, theme, clrMap) : null;
    if (!col) return { strokeWidth: 0, stroke: '#15574b', strokeStyle: 'solid', alpha: 1 };
    const wPx = lnNode.attrs.w ? Math.max(1, Math.min(24, Math.round(Number(lnNode.attrs.w) * emuScale))) : 1;
    const prst = child(lnNode, 'prstDash')?.attrs.val || 'solid';
    let strokeStyle = 'solid';
    if (/dot/i.test(prst) && !/dash/i.test(prst)) strokeStyle = 'dotted';
    else if (/dash/i.test(prst)) strokeStyle = 'dashed';
    return { strokeWidth: wPx, stroke: col.hex, strokeStyle, alpha: col.alpha };
  }
  function resolveFill(spPr, theme, clrMap) {
    if (!spPr) return null;
    if (child(spPr, 'noFill')) return { noFill: true };
    const solid = child(spPr, 'solidFill');
    if (solid) {
      const col = resolveColor(solid, theme, clrMap);
      if (col) return { noFill: false, fill: col.hex, alpha: col.alpha };
    }
    const grad = child(spPr, 'gradFill');
    if (grad) {
      const stops = children(child(grad, 'gsLst'), 'gs');
      const first = stops[0] ? resolveColor(stops[0], theme, clrMap) : null;
      const last = stops.at(-1) ? resolveColor(stops.at(-1), theme, clrMap) : null;
      if (first) {
        const lin = child(grad, 'lin');
        const angle = lin?.attrs.ang ? Math.round((Number(lin.attrs.ang) / 60000 + 90) % 360) : 135;
        return { noFill: false, fill: first.hex, fillEnd: last?.hex || first.hex, angle, alpha: first.alpha };
      }
    }
    return null;
  }
  function readLevelStyle(listStyle, level) {
    if (!listStyle) return null;
    const tag = level === 0 ? 'defPPr' : `lvl${Math.min(9, level + 1)}pPr`;
    return child(listStyle, tag) || child(listStyle, `lvl${Math.min(9, level + 1)}pPr`) || child(listStyle, 'defPPr');
  }
  function parseRunStyle(rPr, fallbackRPr, theme, clrMap, emuScale) {
    const attrs = {};
    const marks = [];
    const pick = (fn) => fn(rPr) ?? fn(fallbackRPr);
    const b = pick(n => n?.attrs.b);
    if (b === '1' || b === 'true') marks.push({ type: 'bold' });
    const it = pick(n => n?.attrs.i);
    if (it === '1' || it === 'true') marks.push({ type: 'italic' });
    const u = pick(n => n?.attrs.u);
    if (u && u !== 'none') marks.push({ type: 'underline' });
    const st = pick(n => n?.attrs.strike);
    if (st && st !== 'noStrike') marks.push({ type: 'strike' });

    const sz = pick(n => n?.attrs.sz);
    const fontSize = sz ? Math.max(8, Math.min(240, Math.round((Number(sz) / 100) * 12700 * emuScale * 10) / 10)) : null;
    if (fontSize) attrs.fontSize = `${fontSize}px`;

    const col = resolveColor(child(rPr, 'solidFill'), theme, clrMap) || resolveColor(child(fallbackRPr, 'solidFill'), theme, clrMap);
    if (col) attrs.color = col.hex;

    const ea = pick(n => child(n, 'ea')?.attrs.typeface);
    const latin = pick(n => child(n, 'latin')?.attrs.typeface);
    const fontFamily = (ea || latin) ? mapFont(ea || latin, theme) : null;
    if (fontFamily) attrs.fontFamily = fontFamily;

    if (Object.keys(attrs).length) marks.push({ type: 'textStyle', attrs });
    return { marks, fontSize, color: col?.hex || null, fontFamily };
  }
  function parseTextBody(txBody, defaultStyleNode, theme, clrMap, emuScale, isTitlePh = false) {
    const bodyPr = child(txBody, 'bodyPr');
    const lstStyle = child(txBody, 'lstStyle');
    const anchorMap = { t: 'top', ctr: 'middle', b: 'bottom' };
    const verticalAlign = anchorMap[bodyPr?.attrs.anchor] || 'top';
    let textFit = 'grow';
    if (child(bodyPr, 'normAutofit')) textFit = 'shrink';
    else if (child(bodyPr, 'noAutofit')) textFit = 'none';
    else if (child(bodyPr, 'spAutoFit')) textFit = 'grow';

    const lIns = bodyPr?.attrs.lIns !== undefined ? Math.round(Number(bodyPr.attrs.lIns) * emuScale) : 8;
    const tIns = bodyPr?.attrs.tIns !== undefined ? Math.round(Number(bodyPr.attrs.tIns) * emuScale) : 4;
    const padding = Math.max(0, Math.min(64, Math.round((lIns + tIns) / 2)));

    const paragraphs = children(txBody, 'p');
    const docContent = [];
    let firstFontSize = isTitlePh ? 54 : 32;
    let firstColor = '#172b36';
    let firstFont = 'Yu Gothic';
    let firstCaptured = false;
    let maxLineHeight = 1.35;

    const flushList = (pendingList) => {
      if (pendingList) { docContent.push(pendingList); }
      return null;
    };
    let currentList = null;

    for (const p of paragraphs) {
      const pPr = child(p, 'pPr');
      const lvl = Number(pPr?.attrs.lvl || 0);
      const lvlStyle = readLevelStyle(lstStyle, lvl) || readLevelStyle(defaultStyleNode, lvl);
      const algn = pPr?.attrs.algn || lvlStyle?.attrs.algn || (isTitlePh ? 'l' : 'l');
      const alignMap = { l: 'left', ctr: 'center', r: 'right', just: 'justify' };
      const textAlign = alignMap[algn] || 'left';

      const lnSpc = child(pPr, 'lnSpc') || child(lvlStyle, 'lnSpc');
      const spcPct = child(lnSpc, 'spcPct')?.attrs.val;
      if (spcPct) maxLineHeight = Math.max(0.8, Math.min(3, Math.round((Number(spcPct) / 100000) * 1.2 * 100) / 100));

      const hasBulletNone = !!(child(pPr, 'buNone') || (!child(pPr, 'buChar') && !child(pPr, 'buAutoNum') && child(lvlStyle, 'buNone')));
      const isOrdered = !hasBulletNone && !!(child(pPr, 'buAutoNum') || child(lvlStyle, 'buAutoNum'));
      const isBullet = !hasBulletNone && !isOrdered && !!(child(pPr, 'buChar') || child(lvlStyle, 'buChar'));

      const defRPr = child(pPr, 'defRPr') || child(lvlStyle, 'defRPr');
      const pNodes = [];
      for (const item of p.children || []) {
        if (item.local === 'br') {
          pNodes.push({ type: 'hardBreak' });
          continue;
        }
        if (item.local !== 'r' && item.local !== 'fld') continue;
        const tNode = child(item, 't');
        const text = tNode?.text || '';
        if (!text) continue;
        const rPr = child(item, 'rPr');
        const style = parseRunStyle(rPr, defRPr, theme, clrMap, emuScale);
        if (!firstCaptured) {
          if (style.fontSize) firstFontSize = style.fontSize;
          if (style.color) firstColor = style.color;
          if (style.fontFamily) firstFont = style.fontFamily;
          firstCaptured = true;
        }
        pNodes.push({ type: 'text', text, ...(style.marks.length ? { marks: style.marks } : {}) });
      }
      if (!firstCaptured && defRPr) {
        const style = parseRunStyle(defRPr, null, theme, clrMap, emuScale);
        if (style.fontSize) firstFontSize = style.fontSize;
        if (style.color) firstColor = style.color;
        if (style.fontFamily) firstFont = style.fontFamily;
        firstCaptured = true;
      }

      const paraNode = { type: 'paragraph', attrs: { textAlign }, content: pNodes };
      if (isOrdered || isBullet) {
        const listType = isOrdered ? 'orderedList' : 'bulletList';
        if (!currentList || currentList.type !== listType) {
          currentList = flushList(currentList);
          currentList = { type: listType, content: [] };
        }
        currentList.content.push({ type: 'listItem', content: [paraNode] });
      } else {
        currentList = flushList(currentList);
        docContent.push(paraNode);
      }
    }
    currentList = flushList(currentList);
    if (!docContent.length) docContent.push({ type: 'paragraph', attrs: { textAlign: 'left' }, content: [] });
    const plainText = paragraphs.map(p => [...children(p, 'r'), ...children(p, 'fld')].map(r => child(r, 't')?.text || '').join('')).join('\n').trim();
    return {
      doc: { type: 'doc', content: docContent },
      plainText,
      verticalAlign,
      textFit,
      padding,
      fontSize: firstFontSize,
      color: firstColor,
      fontFamily: firstFont,
      lineHeight: maxLineHeight
    };
  }

  function findPlaceholder(containerXml, phType, phIdx) {
    if (!containerXml) return null;
    const spTree = findPath(containerXml, 'cSld', 'spTree');
    if (!spTree) return null;
    const sps = descendants(spTree, 'sp');
    if (phIdx !== undefined && phIdx !== '') {
      const byIdx = sps.find(sp => findPath(sp, 'nvSpPr', 'nvPr', 'ph')?.attrs.idx === phIdx);
      if (byIdx) return byIdx;
    }
    if (phType) {
      const byType = sps.find(sp => findPath(sp, 'nvSpPr', 'nvPr', 'ph')?.attrs.type === phType);
      if (byType) return byType;
    }
    return null;
  }

  async function resolveBackground(slideXml, layoutXml, masterXml, slideRels, layoutRels, masterRels, files, theme, clrMap) {
    const sources = [
      { xml: slideXml, rels: slideRels },
      { xml: layoutXml, rels: layoutRels },
      { xml: masterXml, rels: masterRels }
    ];
    for (const { xml, rels } of sources) {
      const bg = findPath(xml, 'cSld', 'bg');
      if (!bg) continue;
      const bgPr = child(bg, 'bgPr');
      if (bgPr) {
        const blip = findPath(bgPr, 'blipFill', 'blip');
        const embed = blip?.attrs['r:embed'] || blip?.attrs.embed;
        if (embed && rels.has(embed)) {
          const dataUrl = await loadImageDataUrl(files, rels.get(embed).target);
          if (dataUrl) return { background: '#ffffff', backgroundImage: dataUrl };
        }
        const grad = child(bgPr, 'gradFill');
        if (grad) {
          const stops = children(child(grad, 'gsLst'), 'gs');
          const first = stops[0] ? resolveColor(stops[0], theme, clrMap) : null;
          const last = stops.at(-1) ? resolveColor(stops.at(-1), theme, clrMap) : null;
          if (first) {
            const lin = child(grad, 'lin');
            const angle = lin?.attrs.ang ? Math.round((Number(lin.attrs.ang) / 60000 + 90) % 360) : 135;
            return { background: first.hex, ...(last && last.hex !== first.hex ? { backgroundEnd: last.hex, backgroundAngle: angle } : {}) };
          }
        }
        const solid = child(bgPr, 'solidFill');
        if (solid) {
          const col = resolveColor(solid, theme, clrMap);
          if (col) return { background: col.hex };
        }
      }
      const bgRef = child(bg, 'bgRef');
      if (bgRef) {
        const col = resolveColor(bgRef, theme, clrMap);
        if (col) return { background: col.hex };
      }
    }
    return { background: '#ffffff' };
  }

  async function importPptx(arrayBuffer, fileName = 'プレゼンテーション.pptx') {
    const files = await readZip(arrayBuffer);
    const presXmlText = readTextFile(files, 'ppt/presentation.xml');
    if (!presXmlText) throw new Error('ppt/presentation.xml が見つかりません。有効な PPTX ファイルを選択してください。');
    const presXml = parseXml(presXmlText);
    const presRels = parseRels(files, 'ppt/presentation.xml');

    const sldSz = child(presXml, 'sldSz');
    const slideW = Number(sldSz?.attrs.cx) || 12192000;
    const slideH = Number(sldSz?.attrs.cy) || 6858000;
    const emuScale = Math.min(C.WIDTH / slideW, C.HEIGHT / slideH);
    const stageOffX = (C.WIDTH - slideW * emuScale) / 2;
    const stageOffY = (C.HEIGHT - slideH * emuScale) / 2;

    const sldIdLst = child(presXml, 'sldIdLst');
    const slideEntries = children(sldIdLst, 'sldId').map(el => {
      const rid = el.attrs['r:id'] || el.attrs.id;
      const rel = presRels.get(rid);
      return rel?.target || null;
    }).filter(Boolean);
    if (!slideEntries.length) throw new Error('取り込めるスライドが含まれていません。');

    const warnings = { skippedImages: 0, truncatedElements: false };
    const slides = [];
    const mediaCache = new Map();
    const getCachedImage = async (targetPath) => {
      if (!mediaCache.has(targetPath)) mediaCache.set(targetPath, await loadImageDataUrl(files, targetPath));
      return mediaCache.get(targetPath);
    };

    for (let sIdx = 0; sIdx < Math.min(500, slideEntries.length); sIdx++) {
      const slidePath = slideEntries[sIdx];
      const slideText = readTextFile(files, slidePath);
      if (!slideText) continue;
      const slideXml = parseXml(slideText);
      const slideRels = parseRels(files, slidePath);

      let layoutPath = null, masterPath = null, notesPath = null, themePath = 'ppt/theme/theme1.xml';
      for (const rel of slideRels.values()) {
        if (rel.type.endsWith('/slideLayout')) layoutPath = rel.target;
        if (rel.type.endsWith('/notesSlide')) notesPath = rel.target;
      }
      const layoutRels = layoutPath ? parseRels(files, layoutPath) : new Map();
      const layoutXml = layoutPath && readTextFile(files, layoutPath) ? parseXml(readTextFile(files, layoutPath)) : null;
      for (const rel of layoutRels.values()) {
        if (rel.type.endsWith('/slideMaster')) masterPath = rel.target;
      }
      const masterRels = masterPath ? parseRels(files, masterPath) : new Map();
      const masterXml = masterPath && readTextFile(files, masterPath) ? parseXml(readTextFile(files, masterPath)) : null;
      for (const rel of masterRels.values()) {
        if (rel.type.endsWith('/theme')) themePath = rel.target;
      }

      const theme = extractTheme(files, themePath);
      const clrMapNode = child(masterXml, 'clrMap') || {};
      const clrMap = clrMapNode.attrs || { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2', accent1: 'accent1', accent2: 'accent2', accent3: 'accent3', accent4: 'accent4', accent5: 'accent5', accent6: 'accent6' };

      const bgProps = await resolveBackground(slideXml, layoutXml, masterXml, slideRels, layoutRels, masterRels, files, theme, clrMap);
      const slideObj = C.slide(`スライド ${sIdx + 1}`);
      Object.assign(slideObj, bgProps);
      if (slideXml.attrs.show === '0') slideObj.hidden = true;

      if (notesPath) {
        const notesText = readTextFile(files, notesPath);
        if (notesText) {
          const notesXml = parseXml(notesText);
          const noteParas = descendants(notesXml, 'sp')
            .filter(sp => findPath(sp, 'nvSpPr', 'nvPr', 'ph')?.attrs.type === 'body')
            .flatMap(sp => descendants(sp, 'p'))
            .map(p => [...children(p, 'r'), ...children(p, 'fld')].map(r => child(r, 't')?.text || '').join(''));
          slideObj.notes = noteParas.join('\n').trim();
        }
      }

      let slideTitle = '';
      const elements = [];
      const pushElement = el => {
        if (elements.length < 200) elements.push(el);
        else warnings.truncatedElements = true;
      };

      const processSpTree = async (tree, scaleX, scaleY, offX, offY, groupId = null) => {
        if (!tree) return;
        for (const node of tree.children || []) {
          if (node.local === 'grpSp') {
            const grpPr = child(node, 'grpSpPr');
            const xfrm = child(grpPr, 'xfrm');
            const off = child(xfrm, 'off'), ext = child(xfrm, 'ext');
            const chOff = child(xfrm, 'chOff'), chExt = child(xfrm, 'chExt');
            const gX = (Number(off?.attrs.x) || 0) * scaleX + offX;
            const gY = (Number(off?.attrs.y) || 0) * scaleY + offY;
            const gW = Number(ext?.attrs.cx) || 1;
            const gH = Number(ext?.attrs.cy) || 1;
            const cX = Number(chOff?.attrs.x) || 0;
            const cY = Number(chOff?.attrs.y) || 0;
            const cW = Number(chExt?.attrs.cx) || gW;
            const cH = Number(chExt?.attrs.cy) || gH;
            const nextScaleX = scaleX * (gW / cW);
            const nextScaleY = scaleY * (gH / cH);
            const nextOffX = gX - cX * nextScaleX;
            const nextOffY = gY - cY * nextScaleY;
            await processSpTree(node, nextScaleX, nextScaleY, nextOffX, nextOffY, groupId || C.id());
          } else if (node.local === 'sp') {
            const spPr = child(node, 'spPr');
            const nvPr = findPath(node, 'nvSpPr', 'nvPr');
            const cNvPr = findPath(node, 'nvSpPr', 'cNvPr');
            const cNvSpPr = findPath(node, 'nvSpPr', 'cNvSpPr');
            const ph = child(nvPr, 'ph');
            const phType = ph?.attrs.type;
            const phIdx = ph?.attrs.idx;
            const layoutPh = ph ? findPlaceholder(layoutXml, phType, phIdx) : null;
            const masterPh = ph ? findPlaceholder(masterXml, phType, phIdx) : null;

            const avgScale = (scaleX + scaleY) / 2;
            const box = readXfrm(spPr, avgScale, offX, offY)
              || readXfrm(child(layoutPh, 'spPr'), emuScale, stageOffX, stageOffY)
              || readXfrm(child(masterPh, 'spPr'), emuScale, stageOffX, stageOffY);
            if (!box) continue;

            const txStyles = child(masterXml, 'txStyles');
            const defaultStyleNode = (phType === 'title' || phType === 'ctrTitle') ? child(txStyles, 'titleStyle')
              : (phType === 'body' || phType === 'subTitle') ? child(txStyles, 'bodyStyle')
              : child(txStyles, 'otherStyle');

            const txBody = child(node, 'txBody');
            const parsedText = txBody ? parseTextBody(txBody, defaultStyleNode, theme, clrMap, avgScale, phType === 'title' || phType === 'ctrTitle') : null;
            if (!slideTitle && parsedText?.plainText && (phType === 'title' || phType === 'ctrTitle' || elements.length === 0)) {
              slideTitle = parsedText.plainText.split('\n')[0].slice(0, 60);
            }

            const fillInfo = resolveFill(spPr, theme, clrMap) || resolveFill(child(layoutPh, 'spPr'), theme, clrMap);
            const lineInfo = resolveLineStyle(child(spPr, 'ln'), theme, clrMap, avgScale);
            const hasShadow = !!findPath(spPr, 'effectLst', 'outerShdw');
            const prst = child(spPr, 'prstGeom')?.attrs.prst || 'rect';
            const isTxBox = cNvSpPr?.attrs.txBox === '1';

            const hasVisibleShape = (fillInfo && !fillInfo.noFill) || lineInfo.strokeWidth > 0;
            if (!parsedText?.plainText && !hasVisibleShape) continue;

            let elemType = 'rect';
            let rotation = box.rotation;
            let borderRadius = 0;
            if (prst === 'ellipse') elemType = 'ellipse';
            else if (prst === 'triangle' || prst === 'rtTriangle') elemType = 'triangle';
            else if (prst === 'rightArrow' || prst === 'leftArrow' || prst === 'upArrow' || prst === 'downArrow') {
              elemType = 'arrow';
              if (prst === 'leftArrow') rotation = (rotation + 180) % 360;
              if (prst === 'upArrow') rotation = (rotation + 270) % 360;
              if (prst === 'downArrow') rotation = (rotation + 90) % 360;
            } else if (prst === 'line' || prst === 'straightConnector1') {
              elemType = 'line';
            } else if (isTxBox || ((prst === 'rect' || !prst) && !hasVisibleShape)) {
              elemType = 'text';
            } else if (prst === 'roundRect') {
              const av = findPath(spPr, 'prstGeom', 'avLst', 'gd')?.attrs.fmla;
              const ratio = av && /val\s+(\d+)/.test(av) ? Number(RegExp.$1) / 100000 : 0.16;
              borderRadius = Math.min(200, Math.round(Math.min(box.width, box.height) * ratio));
            }

            const name = cNvPr?.attrs.name && !/^TextBox|^Rectangle|^Title|^Content/i.test(cNvPr.attrs.name) ? cNvPr.attrs.name : undefined;
            const elem = C.element(elemType, {
              ...(name ? { name } : {}),
              x: box.x, y: box.y, width: box.width, height: elemType === 'line' ? Math.max(2, lineInfo.strokeWidth || 4) : box.height,
              rotation,
              opacity: fillInfo?.alpha ?? 1,
              shadow: hasShadow,
              borderRadius,
              strokeStyle: lineInfo.strokeStyle,
              ...(groupId ? { group: groupId } : {})
            });
            if (elemType === 'line') {
              elem.fill = lineInfo.strokeWidth ? lineInfo.stroke : (fillInfo?.fill || '#15574b');
            } else if (elemType === 'arrow') {
              elem.fill = fillInfo?.fill || lineInfo.stroke || '#15574b';
              elem.strokeWidth = Math.max(2, lineInfo.strokeWidth || 6);
            } else if (elemType === 'triangle') {
              elem.noFill = fillInfo ? !!fillInfo.noFill : false;
              if (fillInfo?.fill) elem.fill = fillInfo.fill;
              elem.stroke = lineInfo.stroke;
              elem.strokeWidth = lineInfo.strokeWidth;
            } else {
              if (fillInfo) {
                elem.noFill = !!fillInfo.noFill;
                if (fillInfo.fill) elem.fill = fillInfo.fill;
              }
              elem.stroke = lineInfo.stroke;
              elem.strokeWidth = lineInfo.strokeWidth;
            }
            if (C.supportsText(elemType) && parsedText) {
              elem.content = parsedText.doc;
              elem.verticalAlign = parsedText.verticalAlign;
              elem.textFit = parsedText.textFit;
              elem.fontSize = parsedText.fontSize;
              elem.color = parsedText.color;
              elem.fontFamily = parsedText.fontFamily;
              elem.lineHeight = parsedText.lineHeight;
              if (elemType === 'text') elem.padding = parsedText.padding;
            }
            pushElement(elem);
          } else if (node.local === 'pic') {
            const spPr = child(node, 'spPr');
            const avgScale = (scaleX + scaleY) / 2;
            const box = readXfrm(spPr, avgScale, offX, offY);
            const blip = findPath(node, 'blipFill', 'blip');
            const embed = blip?.attrs['r:embed'] || blip?.attrs.embed;
            if (!box || !embed || !slideRels.has(embed)) continue;
            const src = await getCachedImage(slideRels.get(embed).target);
            if (!src) { warnings.skippedImages++; continue; }
            const cropped = !!findPath(node, 'blipFill', 'srcRect');
            pushElement(C.element('image', {
              x: box.x, y: box.y, width: box.width, height: box.height, rotation: box.rotation,
              src, fit: cropped ? 'cover' : 'contain',
              shadow: !!findPath(spPr, 'effectLst', 'outerShdw'),
              ...(groupId ? { group: groupId } : {})
            }));
          } else if (node.local === 'cxnSp') {
            const spPr = child(node, 'spPr');
            const avgScale = (scaleX + scaleY) / 2;
            const box = readXfrm(spPr, avgScale, offX, offY);
            if (!box) continue;
            const ln = child(spPr, 'ln');
            const lineInfo = resolveLineStyle(ln, theme, clrMap, avgScale);
            const sw = Math.max(2, lineInfo.strokeWidth || 3);
            const tailEnd = child(ln, 'tailEnd')?.attrs.type;
            const headEnd = child(ln, 'headEnd')?.attrs.type;
            const hasTail = tailEnd && tailEnd !== 'none';
            const hasHead = headEnd && headEnd !== 'none';
            const x1 = box.flipH ? box.x + box.width : box.x;
            const y1 = box.flipV ? box.y + box.height : box.y;
            const x2 = box.flipH ? box.x : box.x + box.width;
            const y2 = box.flipV ? box.y : box.y + box.height;
            const dx = x2 - x1, dy = y2 - y1;
            const length = Math.max(20, Math.hypot(dx, dy));
            const angle = Math.atan2(dy, dx) * 180 / Math.PI + (hasHead && !hasTail ? 180 : 0);
            const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
            const elemType = (hasTail || hasHead) ? 'arrow' : 'line';
            const elemH = elemType === 'arrow' ? Math.max(24, sw * 4) : sw;
            pushElement(C.element(elemType, {
              x: cx - length / 2, y: cy - elemH / 2, width: length, height: elemH,
              rotation: Math.round(angle * 100) / 100,
              fill: lineInfo.stroke, strokeWidth: sw, strokeStyle: lineInfo.strokeStyle,
              ...(groupId ? { group: groupId } : {})
            }));
          } else if (node.local === 'graphicFrame') {
            const avgScale = (scaleX + scaleY) / 2;
            const xfrm = child(node, 'xfrm');
            const box = xfrm ? readXfrm({ children: [xfrm] }, avgScale, offX, offY) : null;
            const tbl = findPath(node, 'graphic', 'graphicData', 'tbl');
            if (!box || !tbl) continue;
            const gridCols = children(child(tbl, 'tblGrid'), 'gridCol').map(c => Number(c.attrs.w) * avgScale);
            const totalGridW = gridCols.reduce((a, b) => a + b, 0) || box.width;
            const colWidths = gridCols.length ? gridCols.map(w => w * (box.width / totalGridW)) : [box.width];
            const rows = children(tbl, 'tr');
            const rawRowH = rows.map(r => Math.max(24, (Number(r.attrs.h) || 370840) * avgScale));
            const tableGroup = groupId || C.id();
            let curY = box.y;
            for (let rIdx = 0; rIdx < rows.length; rIdx++) {
              const cells = children(rows[rIdx], 'tc');
              const rowH = rawRowH[rIdx];
              let curX = box.x;
              for (let cIdx = 0; cIdx < Math.min(cells.length, colWidths.length); cIdx++) {
                const tc = cells[cIdx];
                const colW = colWidths[cIdx];
                if (tc.attrs.hMerge === '1' || tc.attrs.vMerge === '1') { curX += colW; continue; }
                const spanCols = Math.max(1, Number(tc.attrs.gridSpan) || 1);
                const spanRows = Math.max(1, Number(tc.attrs.rowSpan) || 1);
                let cellW = 0;
                for (let k = 0; k < spanCols && cIdx + k < colWidths.length; k++) cellW += colWidths[cIdx + k];
                let cellH = 0;
                for (let k = 0; k < spanRows && rIdx + k < rawRowH.length; k++) cellH += rawRowH[rIdx + k];
                const tcPr = child(tc, 'tcPr');
                const fillInfo = resolveFill(tcPr, theme, clrMap);
                const lnB = resolveLineStyle(child(tcPr, 'lnB') || child(tcPr, 'lnL'), theme, clrMap, avgScale);
                const txBody = child(tc, 'txBody');
                const parsed = txBody ? parseTextBody(txBody, null, theme, clrMap, avgScale) : null;
                pushElement(C.element('rect', {
                  x: curX, y: curY, width: Math.max(10, cellW), height: Math.max(16, cellH),
                  fill: fillInfo?.fill || (rIdx === 0 ? '#e3efe9' : '#ffffff'),
                  noFill: fillInfo?.noFill === true,
                  stroke: lnB.strokeWidth ? lnB.stroke : '#b8c8c0',
                  strokeWidth: Math.max(1, lnB.strokeWidth || 1),
                  group: tableGroup,
                  ...(parsed ? {
                    content: parsed.doc, verticalAlign: parsed.verticalAlign || 'middle',
                    textFit: parsed.textFit, fontSize: parsed.fontSize, color: parsed.color, fontFamily: parsed.fontFamily
                  } : {})
                }));
                curX += colW;
              }
              curY += rowH;
            }
          }
        }
      };

      const spTree = findPath(slideXml, 'cSld', 'spTree');
      await processSpTree(spTree, emuScale, emuScale, stageOffX, stageOffY, null);
      if (slideTitle) slideObj.name = slideTitle;
      slideObj.elements = elements;
      slides.push(slideObj);
    }

    const deckName = String(fileName || 'PPTX資料').replace(/\.pptx$/i, '').slice(0, 200) || 'PPTX資料';
    const deck = C.validate({ format: 'assembly-slides', version: 1, id: C.id(), name: deckName, showSlideNumber: false, slides });
    return { deck, warnings };
  }

  const api = { importPptx, readZip, parseXml, resolveColor, mapFont };
  root.SlidePptx = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
