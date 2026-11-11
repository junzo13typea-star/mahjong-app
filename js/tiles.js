/**
 * 麻雀牌定義 & レンダラー (Mahjong Tile Definitions & Visual Component)
 * 萬子(m), 筒子(p), 索子(s), 字牌(z)
 */

const root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);

const TILE_DEFS = {
  // 萬子 (Characters)
  '1m': { type: 'man', num: 1, name: '一萬', kanji: '一', label: '1萬', color: '#dc2626' },
  '2m': { type: 'man', num: 2, name: '二萬', kanji: '二', label: '2萬', color: '#dc2626' },
  '3m': { type: 'man', num: 3, name: '三萬', kanji: '三', label: '3萬', color: '#dc2626' },
  '4m': { type: 'man', num: 4, name: '四萬', kanji: '四', label: '4萬', color: '#dc2626' },
  '5m': { type: 'man', num: 5, name: '五萬', kanji: '五', label: '5萬', color: '#dc2626' },
  '5mr': { type: 'man', num: 5, name: '赤五萬', kanji: '五', label: '赤5萬', color: '#ef4444', isRed: true },
  '6m': { type: 'man', num: 6, name: '六萬', kanji: '六', label: '6萬', color: '#dc2626' },
  '7m': { type: 'man', num: 7, name: '七萬', kanji: '七', label: '7萬', color: '#dc2626' },
  '8m': { type: 'man', num: 8, name: '八萬', kanji: '八', label: '8萬', color: '#dc2626' },
  '9m': { type: 'man', num: 9, name: '九萬', kanji: '九', label: '9萬', color: '#dc2626' },

  // 筒子 (Dots)
  '1p': { type: 'pin', num: 1, name: '一筒', label: '1筒', color: '#2563eb' },
  '2p': { type: 'pin', num: 2, name: '二筒', label: '2筒', color: '#2563eb' },
  '3p': { type: 'pin', num: 3, name: '三筒', label: '3筒', color: '#2563eb' },
  '4p': { type: 'pin', num: 4, name: '四筒', label: '4筒', color: '#2563eb' },
  '5p': { type: 'pin', num: 5, name: '五筒', label: '5筒', color: '#2563eb' },
  '5pr': { type: 'pin', num: 5, name: '赤五筒', label: '赤5筒', color: '#ef4444', isRed: true },
  '6p': { type: 'pin', num: 6, name: '六筒', label: '6筒', color: '#2563eb' },
  '7p': { type: 'pin', num: 7, name: '七筒', label: '7筒', color: '#2563eb' },
  '8p': { type: 'pin', num: 8, name: '八筒', label: '8筒', color: '#2563eb' },
  '9p': { type: 'pin', num: 9, name: '九筒', label: '9筒', color: '#2563eb' },

  // 索子 (Bamboos)
  '1s': { type: 'sou', num: 1, name: '一索', label: '1索', color: '#16a34a' },
  '2s': { type: 'sou', num: 2, name: '二索', label: '2索', color: '#16a34a' },
  '3s': { type: 'sou', num: 3, name: '三索', label: '3索', color: '#16a34a' },
  '4s': { type: 'sou', num: 4, name: '四索', label: '4索', color: '#16a34a' },
  '5s': { type: 'sou', num: 5, name: '五索', label: '5索', color: '#16a34a' },
  '5sr': { type: 'sou', num: 5, name: '赤五索', label: '赤5索', color: '#ef4444', isRed: true },
  '6s': { type: 'sou', num: 6, name: '六索', label: '6索', color: '#16a34a' },
  '7s': { type: 'sou', num: 7, name: '七索', label: '7索', color: '#16a34a' },
  '8s': { type: 'sou', num: 8, name: '八索', label: '8索', color: '#16a34a' },
  '9s': { type: 'sou', num: 9, name: '九索', label: '9索', color: '#16a34a' },

  // 風牌 (Winds)
  '1z': { type: 'honor', num: 1, name: '東', kanji: '東', label: '東', color: '#0f172a' },
  '2z': { type: 'honor', num: 2, name: '南', kanji: '南', label: '南', color: '#0f172a' },
  '3z': { type: 'honor', num: 3, name: '西', kanji: '西', label: '西', color: '#0f172a' },
  '4z': { type: 'honor', num: 4, name: '北', kanji: '北', label: '北', color: '#0f172a' },

  // 三元牌 (Dragons)
  '5z': { type: 'honor', num: 5, name: '白', kanji: '白', label: '白', color: '#94a3b8' },
  '6z': { type: 'honor', num: 6, name: '發', kanji: '發', label: '發', color: '#15803d' },
  '7z': { type: 'honor', num: 7, name: '中', kanji: '中', label: '中', color: '#dc2626' }
};

// 全34種の基本牌キーリスト（赤ドラ除く）
const ALL_BASE_TILES = [
  '1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m',
  '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p',
  '1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s',
  '1z', '2z', '3z', '4z', '5z', '6z', '7z'
];

/**
 * 牌をノーマライズ（赤ドラを通常の5に正規化）
 */
function normalizeTile(tile) {
  if (tile === '5mr') return '5m';
  if (tile === '5pr') return '5p';
  if (tile === '5sr') return '5s';
  return tile;
}

/**
 * 美しい立体麻雀牌のHTMLを生成
 */
function renderTileHtml(tileCode, options = {}) {
  const def = TILE_DEFS[tileCode] || { name: '?', label: '?', type: 'unknown', color: '#666' };
  const size = options.size || (options.isSmall ? 'sm' : 'md'); // sm, md, lg
  const isSelected = options.isSelected ? 'selected' : '';
  const isAgari = options.isAgari ? 'agari-tile' : '';
  const extraClass = options.extraClass || '';
  const customAttrs = options.attrs || '';

  // 牌の中央グラフィック生成
  let innerGraphic = '';

  if (def.type === 'man') {
    const isRed = def.isRed;
    innerGraphic = `
      <div class="man-text tile-man-graphic ${isRed ? 'is-red' : ''}">
        <span class="man-num">${def.kanji}</span>
        <span class="man-kanji">萬</span>
      </div>
    `;
  } else if (def.type === 'pin') {
    innerGraphic = renderPinGraphic(def.num, def.isRed);
  } else if (def.type === 'sou') {
    innerGraphic = renderSouGraphic(def.num, def.isRed);
  } else if (def.type === 'honor') {
    if (def.num === 5) {
      // 白は無地（古典標準セットの図柄どおり。2026-11-11 ユーザー指定）
      innerGraphic = '';
    } else {
      innerGraphic = `
        <div class="ji-text tile-honor-graphic" style="color: ${def.color};">
          <span class="honor-char">${def.kanji}</span>
        </div>
      `;
    }
  }

  return `
    <div class="mj-tile mahjong-tile ${size === 'sm' ? 'tile-sm' : ''} ${isSelected} ${isAgari} ${extraClass} ${def.isRed ? 'tile-red-dora' : ''}" data-tile="${tileCode}" title="${def.name}" ${customAttrs}>
      <div class="mj-tile-face tile-front">
        ${innerGraphic}
        ${def.isRed ? '<span class="red-dot-badge" title="赤ドラ"></span>' : ''}
      </div>
    </div>
  `;
}

/**
 * 筒子 (Pin) のドットパターンSVG（高コントラスト二重輪刻印デザイン）
 */
function renderPinGraphic(num, isRed) {
  const redColor = '#dc2626';
  const blueColor = isRed ? '#dc2626' : '#1d4ed8';
  const greenColor = isRed ? '#dc2626' : '#15803d';

  if (num === 1) {
    // 一筒（古典セット倣い: 濃紺の外周帯に多色の花弁ドット＋装飾輪＋中心ジュエル）
    const petalColors = ['#ffffff', '#f59e0b', '#ffffff', '#93c5fd'];
    const petals = Array.from({ length: 12 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 12;
      const px = (50 + 41.5 * Math.cos(a)).toFixed(1);
      const py = (50 + 41.5 * Math.sin(a)).toFixed(1);
      return `<circle cx="${px}" cy="${py}" r="2.1" fill="${petalColors[i % 4]}" opacity="0.9" />`;
    }).join('');
    return `
      <div class="pin-grid pin-1">
        <svg viewBox="0 0 100 100" class="pin-svg-big">
          <!-- 外周リング（濃紺帯＋花弁ドット） -->
          <circle cx="50" cy="50" r="44" fill="#1e3a5f" stroke="#172554" stroke-width="2" />
          ${petals}
          <circle cx="50" cy="50" r="38" fill="#ffffff" />
          <!-- 緑の装飾花弁 -->
          <circle cx="50" cy="50" r="33" fill="${greenColor}" stroke="#14532d" stroke-width="1.5" />
          <circle cx="50" cy="50" r="23" fill="#ffffff" />
          <!-- センターの真紅ジュエル -->
          <circle cx="50" cy="50" r="16" fill="${redColor}" stroke="#7f1d1d" stroke-width="1.5" />
          <circle cx="46" cy="46" r="4.5" fill="#ffffff" opacity="0.85" />
        </svg>
      </div>
    `;
  }

  // 2〜9筒のドット配置（外周リング＋内玉の本格彫り込み表現）
  const coords = {
    2: [{ x: 50, y: 28, c: blueColor }, { x: 50, y: 72, c: greenColor }],
    // 古典セットの配色: 三筒=両端青+中央赤 / 四筒=全青 / 五筒=四隅青+中央赤 / 六筒=上2青・下4赤 / 七筒=斜め3青・下4赤
    3: [{ x: 26, y: 26, c: blueColor }, { x: 50, y: 50, c: redColor }, { x: 74, y: 74, c: blueColor }],
    4: [{ x: 30, y: 30, c: blueColor }, { x: 70, y: 30, c: blueColor }, { x: 30, y: 70, c: blueColor }, { x: 70, y: 70, c: blueColor }],
    5: [{ x: 28, y: 28, c: blueColor }, { x: 72, y: 28, c: blueColor }, { x: 50, y: 50, c: redColor }, { x: 28, y: 72, c: blueColor }, { x: 72, y: 72, c: blueColor }],
    6: [{ x: 32, y: 25, c: blueColor }, { x: 68, y: 25, c: blueColor }, { x: 32, y: 50, c: redColor }, { x: 68, y: 50, c: redColor }, { x: 32, y: 75, c: redColor }, { x: 68, y: 75, c: redColor }],
    7: [{ x: 25, y: 20, c: blueColor }, { x: 50, y: 30, c: blueColor }, { x: 75, y: 40, c: blueColor }, { x: 32, y: 64, c: redColor }, { x: 68, y: 64, c: redColor }, { x: 32, y: 84, c: redColor }, { x: 68, y: 84, c: redColor }],
    8: [{ x: 32, y: 20, c: blueColor }, { x: 68, y: 20, c: blueColor }, { x: 32, y: 40, c: blueColor }, { x: 68, y: 40, c: blueColor }, { x: 32, y: 60, c: blueColor }, { x: 68, y: 60, c: blueColor }, { x: 32, y: 80, c: blueColor }, { x: 68, y: 80, c: blueColor }],
    // 九筒は伝統的に行ごとに色が分かれる図柄: 上段=青・中段=赤・下段=緑の横縞として即読できるようにする
    9: [{ x: 28, y: 24, c: blueColor }, { x: 50, y: 24, c: blueColor }, { x: 72, y: 24, c: blueColor }, { x: 28, y: 50, c: redColor }, { x: 50, y: 50, c: redColor }, { x: 72, y: 50, c: redColor }, { x: 28, y: 76, c: greenColor }, { x: 50, y: 76, c: greenColor }, { x: 72, y: 76, c: greenColor }]
  };

  const currentCoords = coords[num] || [];
  const svgCircles = currentCoords.map(d => `
    <g transform="translate(${d.x}, ${d.y})">
      <!-- 外枠リング -->
      <circle cx="0" cy="0" r="12" fill="none" stroke="${d.c}" stroke-width="3.1" />
      <!-- 中心丸（リングとの間の溝を広げ、小表示でも輪と玉が分離して見えるように） -->
      <circle cx="0" cy="0" r="7.2" fill="${d.c}" />
      <!-- 光沢ハイライト -->
      <circle cx="-2.5" cy="-2.5" r="2" fill="#ffffff" opacity="0.75" />
    </g>
  `).join('');

  return `
    <div class="pin-grid pin-${num}">
      <svg viewBox="0 0 100 100" class="pin-svg">
        ${svgCircles}
      </svg>
    </div>
  `;
}

/**
 * 索子 (Sou) のバンブーパターンSVG（鮮明な竹節・極太ハイコントラスト）
 */
function renderSouGraphic(num, isRed) {
  const gColor = isRed ? '#dc2626' : '#16a34a';
  const bColor = isRed ? '#dc2626' : '#1d4ed8';
  const rColor = '#dc2626';

  if (num === 1) {
    // 一索（気品ある日本の孔雀・尾羽・止まり木デザイン）
    return `
      <div class="sou-grid sou-1-box">
        <svg viewBox="0 0 100 100" class="sou-bird-svg">
          <!-- 扇状の尾羽 -->
          <path d="M 50,60 C 22,46 12,24 26,12 C 36,4 45,28 50,56" fill="${gColor}" stroke="#14532d" stroke-width="1.2" />
          <circle cx="25" cy="14" r="5" fill="${rColor}" />
          <circle cx="25" cy="14" r="2" fill="#fef08a" />

          <path d="M 50,60 C 35,34 30,14 44,7 C 53,4 53,28 50,56" fill="${gColor}" stroke="#14532d" stroke-width="1.2" />
          <circle cx="44" cy="9" r="5" fill="${rColor}" />
          <circle cx="44" cy="9" r="2" fill="#fef08a" />

          <path d="M 50,60 C 65,34 70,14 56,7 C 47,4 47,28 50,56" fill="${gColor}" stroke="#14532d" stroke-width="1.2" />
          <circle cx="56" cy="9" r="5" fill="${rColor}" />
          <circle cx="56" cy="9" r="2" fill="#fef08a" />

          <path d="M 50,60 C 78,46 88,24 74,12 C 64,4 55,28 50,56" fill="${gColor}" stroke="#14532d" stroke-width="1.2" />
          <circle cx="75" cy="14" r="5" fill="${rColor}" />
          <circle cx="75" cy="14" r="2" fill="#fef08a" />

          <!-- 胴体と頭部 -->
          <ellipse cx="50" cy="62" rx="15" ry="18" fill="${gColor}" stroke="#14532d" stroke-width="1.5" />
          <path d="M 40,62 Q 50,76 60,62" fill="${rColor}" />
          <circle cx="50" cy="40" r="10" fill="${gColor}" stroke="#14532d" stroke-width="1.5" />
          <!-- 冠羽 -->
          <path d="M 50,31 L 46,20 M 50,31 L 50,18 M 50,31 L 54,20" stroke="${rColor}" stroke-width="2.5" stroke-linecap="round" />
          <!-- 目と嘴 -->
          <circle cx="46" cy="38" r="3" fill="#ffffff" />
          <circle cx="45.5" cy="38" r="1.5" fill="#000000" />
          <polygon points="41,40 30,42 41,44" fill="#eab308" stroke="#ca8a04" stroke-width="1" />
          <!-- 止まり木 -->
          <rect x="25" y="82" width="50" height="7" rx="3.5" fill="#ca8a04" stroke="#a16207" stroke-width="1" />
          <line x1="44" y1="78" x2="42" y2="83" stroke="#a16207" stroke-width="2" stroke-linecap="round" />
          <line x1="56" y1="78" x2="58" y2="83" stroke="#a16207" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
    `;
  }

  // 2〜9索の竹スティック
  const stickMap = {
    // 二索は古典配色で上段=青・下段=緑
    2: [{ x: 50, y: 26, c: bColor }, { x: 50, y: 74, c: gColor }],
    3: [{ x: 50, y: 24, c: gColor }, { x: 30, y: 72, c: gColor }, { x: 70, y: 72, c: gColor }],
    4: [{ x: 30, y: 30, c: gColor }, { x: 70, y: 30, c: gColor }, { x: 30, y: 70, c: gColor }, { x: 70, y: 70, c: gColor }],
    5: [{ x: 26, y: 26, c: gColor }, { x: 74, y: 26, c: gColor }, { x: 50, y: 50, c: rColor }, { x: 26, y: 74, c: gColor }, { x: 74, y: 74, c: gColor }],
    6: [{ x: 28, y: 30, c: gColor }, { x: 50, y: 30, c: gColor }, { x: 72, y: 30, c: gColor }, { x: 28, y: 70, c: gColor }, { x: 50, y: 70, c: gColor }, { x: 72, y: 70, c: gColor }],
    7: [{ x: 50, y: 18, c: rColor }, { x: 28, y: 47, c: gColor }, { x: 50, y: 47, c: gColor }, { x: 72, y: 47, c: gColor }, { x: 28, y: 77, c: gColor }, { x: 50, y: 77, c: gColor }, { x: 72, y: 77, c: gColor }],
    // 八索は伝統図柄: 上段=ハの字ペア×2（上端が寄り下端が開く斜め配置）、
    // 下段=その上下反転ペア×2（上端が開き下端が寄る）。古典セット同様に上下とも斜めペアで構成し、
    // 等間隔グリッド（6索・9索と同系統のシルエット）と違いシルエットで判別できる形にする
    8: [
      { x: 22.5, y: 23, c: gColor, r: 16 }, { x: 35.5, y: 23, c: gColor, r: -16 },
      { x: 64.5, y: 23, c: gColor, r: 16 }, { x: 77.5, y: 23, c: gColor, r: -16 },
      { x: 22.5, y: 72, c: gColor, r: -16 }, { x: 35.5, y: 72, c: gColor, r: 16 },
      { x: 64.5, y: 72, c: gColor, r: -16 }, { x: 77.5, y: 72, c: gColor, r: 16 }
    ],
    9: [{ x: 28, y: 22, c: gColor }, { x: 50, y: 22, c: rColor }, { x: 72, y: 22, c: gColor }, { x: 28, y: 50, c: gColor }, { x: 50, y: 50, c: rColor }, { x: 72, y: 50, c: gColor }, { x: 28, y: 78, c: gColor }, { x: 50, y: 78, c: rColor }, { x: 72, y: 78, c: gColor }]
  };

  const list = stickMap[num] || [];
  const stickElements = list.map(s => `
    <g transform="translate(${s.x}, ${s.y})${s.r ? ` rotate(${s.r})` : ''}">
      <!-- 竹の幹（厚みと丸みのあるバー） -->
      <rect x="-5" y="-13" width="10" height="26" rx="3.5" fill="${s.c}" stroke="rgba(0,0,0,0.35)" stroke-width="1.2"/>
      <!-- 円筒ハイライト（1本ごとの分離感を持たせる） -->
      <rect x="-3.2" y="-10.5" width="2.6" height="21" rx="1.3" fill="#ffffff" opacity="0.20"/>
      <!-- 竹の節（白帯: 本体からの張り出しを抑え、輪郭線で段差を明示） -->
      <rect x="-5.5" y="-2.8" width="11" height="5.6" rx="1.6" fill="#ffffff" opacity="0.95" stroke="rgba(0,0,0,0.25)" stroke-width="0.8"/>
      <!-- 節の中央ライン -->
      <line x1="-4" y1="0" x2="4" y2="0" stroke="${s.c}" stroke-width="1.4"/>
    </g>
  `).join('');

  return `
    <div class="sou-grid sou-${num}">
      <svg viewBox="0 0 100 100" class="sou-svg">
        ${stickElements}
      </svg>
    </div>
  `;
}

// Global expose
root.TILE_DEFS = TILE_DEFS;
root.ALL_BASE_TILES = ALL_BASE_TILES;
root.normalizeTile = normalizeTile;
root.renderTileHtml = renderTileHtml;
