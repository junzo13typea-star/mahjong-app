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
  const size = options.size || 'md'; // sm, md, lg
  const isSelected = options.isSelected ? 'selected' : '';
  const isAgari = options.isAgari ? 'agari-tile' : '';
  const extraClass = options.extraClass || '';
  const customAttrs = options.attrs || '';

  // 牌の中央グラフィック生成
  let innerGraphic = '';

  if (def.type === 'man') {
    const isRed = def.isRed;
    innerGraphic = `
      <div class="tile-man-graphic ${isRed ? 'is-red' : ''}">
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
      // 白（枠線または無地）
      innerGraphic = `<div class="tile-haku-box"></div>`;
    } else {
      innerGraphic = `
        <div class="tile-honor-graphic" style="color: ${def.color};">
          <span class="honor-char">${def.kanji}</span>
        </div>
      `;
    }
  }

  return `
    <div class="mahjong-tile tile-${size} ${isSelected} ${isAgari} ${extraClass}" data-tile="${tileCode}" title="${def.name}" ${customAttrs}>
      <div class="tile-front">
        ${innerGraphic}
        ${def.isRed ? '<span class="red-dora-dot">★</span>' : ''}
      </div>
    </div>
  `;
}

/**
 * 筒子 (Pin) のドットパターンSVG
 */
function renderPinGraphic(num, isRed) {
  const redColor = '#dc2626';
  const blueColor = isRed ? '#dc2626' : '#2563eb';
  const greenColor = isRed ? '#dc2626' : '#16a34a';

  if (num === 1) {
    return `
      <div class="pin-grid pin-1">
        <svg viewBox="0 0 100 100" class="pin-svg-big">
          <circle cx="50" cy="50" r="42" fill="${redColor}" stroke="#b91c1c" stroke-width="4" />
          <circle cx="50" cy="50" r="28" fill="#f87171" opacity="0.4" />
          <circle cx="50" cy="50" r="14" fill="${redColor}" />
        </svg>
      </div>
    `;
  }

  // 2〜9筒のドット配置
  const dots = [];
  const coords = {
    2: [{ x: 50, y: 28, c: blueColor }, { x: 50, y: 72, c: greenColor }],
    3: [{ x: 26, y: 26, c: blueColor }, { x: 50, y: 50, c: redColor }, { x: 74, y: 74, c: greenColor }],
    4: [{ x: 30, y: 30, c: blueColor }, { x: 70, y: 30, c: greenColor }, { x: 30, y: 70, c: greenColor }, { x: 70, y: 70, c: blueColor }],
    5: [{ x: 28, y: 28, c: blueColor }, { x: 72, y: 28, c: greenColor }, { x: 50, y: 50, c: redColor }, { x: 28, y: 72, c: greenColor }, { x: 72, y: 72, c: blueColor }],
    6: [{ x: 32, y: 26, c: greenColor }, { x: 68, y: 26, c: greenColor }, { x: 32, y: 50, c: redColor }, { x: 68, y: 50, c: redColor }, { x: 32, y: 74, c: redColor }, { x: 68, y: 74, c: redColor }],
    7: [{ x: 25, y: 22, c: greenColor }, { x: 50, y: 32, c: greenColor }, { x: 75, y: 42, c: greenColor }, { x: 32, y: 64, c: redColor }, { x: 68, y: 64, c: redColor }, { x: 32, y: 84, c: redColor }, { x: 68, y: 84, c: redColor }],
    8: [{ x: 32, y: 20, c: blueColor }, { x: 68, y: 20, c: blueColor }, { x: 32, y: 40, c: blueColor }, { x: 68, y: 40, c: blueColor }, { x: 32, y: 60, c: blueColor }, { x: 68, y: 60, c: blueColor }, { x: 32, y: 80, c: blueColor }, { x: 68, y: 80, c: blueColor }],
    9: [{ x: 28, y: 24, c: blueColor }, { x: 50, y: 24, c: redColor }, { x: 72, y: 24, c: blueColor }, { x: 28, y: 50, c: blueColor }, { x: 50, y: 50, c: redColor }, { x: 72, y: 50, c: blueColor }, { x: 28, y: 76, c: blueColor }, { x: 50, y: 76, c: redColor }, { x: 72, y: 76, c: blueColor }]
  };

  const currentCoords = coords[num] || [];
  const svgCircles = currentCoords.map(d => `<circle cx="${d.x}" cy="${d.y}" r="11" fill="${d.c}" stroke="rgba(0,0,0,0.15)" stroke-width="1.5" />`).join('');

  return `
    <div class="pin-grid pin-${num}">
      <svg viewBox="0 0 100 100" class="pin-svg">
        ${svgCircles}
      </svg>
    </div>
  `;
}

/**
 * 索子 (Sou) のバンブーパターンSVG
 */
function renderSouGraphic(num, isRed) {
  const gColor = isRed ? '#dc2626' : '#16a34a';
  const rColor = '#dc2626';

  if (num === 1) {
    // 一索（孔雀・鳥）
    return `
      <div class="sou-1-box">
        <svg viewBox="0 0 100 100" class="sou-bird-svg">
          <ellipse cx="50" cy="58" rx="22" ry="28" fill="${gColor}" />
          <circle cx="50" cy="30" r="14" fill="${gColor}" />
          <circle cx="45" cy="28" r="3" fill="#fff" />
          <circle cx="45" cy="28" r="1.5" fill="#000" />
          <polygon points="36,30 20,33 36,36" fill="#eab308" />
          <path d="M 40,78 Q 50,96 60,78" stroke="${rColor}" stroke-width="4" fill="none" />
          <circle cx="50" cy="56" r="8" fill="${rColor}" />
        </svg>
      </div>
    `;
  }

  // 2〜9索の竹スティック
  const sticks = [];
  const stickMap = {
    2: [{ x: 50, y: 26, c: gColor }, { x: 50, y: 74, c: gColor }],
    3: [{ x: 50, y: 24, c: gColor }, { x: 30, y: 72, c: gColor }, { x: 70, y: 72, c: gColor }],
    4: [{ x: 30, y: 30, c: gColor }, { x: 70, y: 30, c: gColor }, { x: 30, y: 70, c: gColor }, { x: 70, y: 70, c: gColor }],
    5: [{ x: 26, y: 26, c: gColor }, { x: 74, y: 26, c: gColor }, { x: 50, y: 50, c: rColor }, { x: 26, y: 74, c: gColor }, { x: 74, y: 74, c: gColor }],
    6: [{ x: 28, y: 30, c: gColor }, { x: 50, y: 30, c: gColor }, { x: 72, y: 30, c: gColor }, { x: 28, y: 70, c: gColor }, { x: 50, y: 70, c: gColor }, { x: 72, y: 70, c: gColor }],
    7: [{ x: 50, y: 20, c: rColor }, { x: 28, y: 46, c: gColor }, { x: 50, y: 46, c: gColor }, { x: 72, y: 46, c: gColor }, { x: 28, y: 76, c: gColor }, { x: 50, y: 76, c: gColor }, { x: 72, y: 76, c: gColor }],
    8: [{ x: 26, y: 20, c: gColor }, { x: 42, y: 20, c: gColor }, { x: 58, y: 20, c: gColor }, { x: 74, y: 20, c: gColor }, { x: 26, y: 74, c: gColor }, { x: 42, y: 74, c: gColor }, { x: 58, y: 74, c: gColor }, { x: 74, y: 74, c: gColor }],
    9: [{ x: 28, y: 22, c: gColor }, { x: 50, y: 22, c: rColor }, { x: 72, y: 22, c: gColor }, { x: 28, y: 50, c: gColor }, { x: 50, y: 50, c: rColor }, { x: 72, y: 50, c: gColor }, { x: 28, y: 78, c: gColor }, { x: 50, y: 78, c: rColor }, { x: 72, y: 78, c: gColor }]
  };

  const list = stickMap[num] || [];
  const stickElements = list.map(s => `
    <g transform="translate(${s.x}, ${s.y})">
      <rect x="-4" y="-12" width="8" height="24" rx="3" fill="${s.c}" stroke="rgba(0,0,0,0.2)" stroke-width="1"/>
      <line x1="-3" y1="0" x2="3" y2="0" stroke="#fff" stroke-width="1.5" opacity="0.6"/>
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
