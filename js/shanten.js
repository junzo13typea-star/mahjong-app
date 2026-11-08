/**
 * 麻雀 シャンテン数（向聴数）＆ 待ち牌・待ち数判定エンジン
 * (Mahjong Shanten & Wait Detector Engine)
 */

(function(window) {
  'use strict';

  // 牌インデックス (0〜33)
  // 0-8: 1m-9m, 9-17: 1p-9p, 18-26: 1s-9s, 27-33: 1z-7z
  function tileToIndex(t) {
    const raw = (window.normalizeTile ? window.normalizeTile(t) : t);
    const num = parseInt(raw[0], 10);
    const suit = raw[1];
    if (suit === 'm') return num - 1;
    if (suit === 'p') return 9 + num - 1;
    if (suit === 's') return 18 + num - 1;
    if (suit === 'z') return 27 + num - 1;
    return -1;
  }

  function indexToTile(idx) {
    if (idx < 9) return `${idx + 1}m`;
    if (idx < 18) return `${idx - 9 + 1}p`;
    if (idx < 27) return `${idx - 18 + 1}s`;
    if (idx < 34) return `${idx - 27 + 1}z`;
    return null;
  }

  /**
   * 手牌配列から34要素の牌カウント配列 [0..33] を作成
   */
  function handToCounts(handTiles) {
    const counts = new Array(34).fill(0);
    handTiles.forEach(t => {
      const idx = tileToIndex(t);
      if (idx >= 0 && idx < 34) {
        counts[idx]++;
      }
    });
    return counts;
  }

  /**
   * 国士無双のシャンテン数
   */
  function calcKokushiShanten(counts) {
    const yaochyuIndices = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
    let uniqueYaochyu = 0;
    let hasPair = false;

    for (const idx of yaochyuIndices) {
      if (counts[idx] > 0) {
        uniqueYaochyu++;
        if (counts[idx] >= 2) hasPair = true;
      }
    }

    return 13 - uniqueYaochyu - (hasPair ? 1 : 0);
  }

  /**
   * 七対子のシャンテン数
   */
  function calcChiitoiShanten(counts) {
    let pairs = 0;
    let uniqueKinds = 0;

    for (let i = 0; i < 34; i++) {
      if (counts[i] >= 2) pairs++;
      if (counts[i] >= 1) uniqueKinds++;
    }

    let shanten = 6 - pairs;
    // 牌種が7種未満の場合は、4枚使いがあっても別対子を作れないためペナルティ
    if (uniqueKinds < 7) {
      shanten += (7 - uniqueKinds);
    }
    return shanten;
  }

  /**
   * 一般手（面子手：4面子1雀頭）のシャンテン数計算
   * バックトラック再帰探索
   */
  function calcStandardShanten(counts, meldCount = 0) {
    let minShanten = 8;

    // 雀頭の候補（対子）を1つ固定するか、雀頭なしの場合を探索
    for (let head = -1; head < 34; head++) {
      if (head >= 0 && counts[head] < 2) continue;

      const c = [...counts];
      let hasHead = false;
      if (head >= 0) {
        c[head] -= 2;
        hasHead = true;
      }

      const res = searchMentsu(c, 0, 0, 0);
      const mentsu = res.maxMentsu + meldCount;
      const kouho = res.maxKouho;

      // 面子＋候補は最大4つまで
      let totalKouho = kouho;
      if (mentsu + totalKouho > 4) {
        totalKouho = 4 - mentsu;
      }

      const s = 8 - 2 * mentsu - totalKouho - (hasHead ? 1 : 0);
      if (s < minShanten) {
        minShanten = s;
      }
    }

    return minShanten;
  }

  function searchMentsu(c, idx, mentsu, kouho) {
    while (idx < 34 && c[idx] === 0) idx++;
    if (idx >= 34) {
      return { maxMentsu: mentsu, maxKouho: kouho };
    }

    let best = { maxMentsu: mentsu, maxKouho: kouho };

    // 1. 刻子 (Anko)
    if (c[idx] >= 3) {
      c[idx] -= 3;
      const res = searchMentsu(c, idx, mentsu + 1, kouho);
      c[idx] += 3;
      best = pickBetter(best, res);
    }

    // 2. 順子 (Shuntsu) - 字牌(idx>=27)は不可、各色の7,8番目は順子の先頭不可
    const suitPos = idx % 9;
    const isNumberTile = idx < 27;
    if (isNumberTile && suitPos <= 6 && c[idx + 1] >= 1 && c[idx + 2] >= 1) {
      c[idx]--; c[idx + 1]--; c[idx + 2]--;
      const res = searchMentsu(c, idx, mentsu + 1, kouho);
      c[idx]++; c[idx + 1]++; c[idx + 2]++;
      best = pickBetter(best, res);
    }

    // 3. 対子 (Taatsu / Pair as kouho)
    if (c[idx] >= 2) {
      c[idx] -= 2;
      const res = searchMentsu(c, idx, mentsu, kouho + 1);
      c[idx] += 2;
      best = pickBetter(best, res);
    }

    // 4. 嵌張・両面・辺張 (Taatsu sequence)
    if (isNumberTile && suitPos <= 7 && c[idx + 1] >= 1) {
      c[idx]--; c[idx + 1]--;
      const res = searchMentsu(c, idx, mentsu, kouho + 1);
      c[idx]++; c[idx + 1]++;
      best = pickBetter(best, res);
    }
    if (isNumberTile && suitPos <= 6 && c[idx + 2] >= 1) {
      c[idx]--; c[idx + 2]--;
      const res = searchMentsu(c, idx, mentsu, kouho + 1);
      c[idx]++; c[idx + 2]++;
      best = pickBetter(best, res);
    }

    // 5. 牌を使わずにスキップ
    c[idx] = 0; // 該当インデックスをスキップ
    const res = searchMentsu(c, idx + 1, mentsu, kouho);
    best = pickBetter(best, res);

    return best;
  }

  function pickBetter(a, b) {
    const scoreA = a.maxMentsu * 2 + a.maxKouho;
    const scoreB = b.maxMentsu * 2 + b.maxKouho;
    return scoreB > scoreA ? b : a;
  }

  /**
   * 手牌の総合シャンテン数を計算
   * @param {Array<string>} handTiles 手牌
   * @param {number} meldCount 鳴き（副露）の面子数（0〜4）
   * @returns {number} -1: 和了(Agari), 0: テンパイ(Tenpai), 1: 1向聴, 2: 2向聴...
   */
  function calculateShanten(handTiles, meldCount = 0) {
    const counts = handToCounts(handTiles);
    const standard = calcStandardShanten(counts, meldCount);

    // 鳴きがない場合のみ七対子・国士無双を考慮
    if (meldCount === 0 && handTiles.length >= 13) {
      const chiitoi = calcChiitoiShanten(counts);
      const kokushi = calcKokushiShanten(counts);
      return Math.min(standard, chiitoi, kokushi);
    }

    return standard;
  }

  /**
   * テンパイ時の待ち牌 ＆ 残り待ち牌枚数・待ちの形を分析
   * @param {Array<string>} hand13 13枚の手牌（または鳴き除いた残り）
   * @param {number} meldCount 鳴き面子数
   * @returns {Object} { isTenpai: boolean, waits: Array<{ tile: string, remaining: number, waitType: string }>, totalRemaining: number }
   */
  function analyzeWaits(hand13, meldCount = 0) {
    const currentShanten = calculateShanten(hand13, meldCount);
    const counts = handToCounts(hand13);

    if (currentShanten > 0) {
      return {
        isTenpai: false,
        shanten: currentShanten,
        waits: [],
        totalRemaining: 0,
        totalWaitCount: 0,
        waitShape: 'ノーテン',
        shapeType: 'ノーテン'
      };
    }

    const waits = [];
    let totalRemaining = 0;

    // 全34種を1枚ずつ足してシャンテン数が -1 (和了) になるかテスト
    for (let i = 0; i < 34; i++) {
      if (counts[i] >= 4) continue; // すでに手牌に4枚ある牌はアガリ牌になれない

      const testCounts = [...counts];
      testCounts[i]++;

      const testHand = [];
      for (let j = 0; j < 34; j++) {
        for (let k = 0; k < testCounts[j]; k++) {
          testHand.push(indexToTile(j));
        }
      }

      const s = calculateShanten(testHand, meldCount);
      if (s === -1) {
        const tile = indexToTile(i);
        const inHandCount = counts[i];
        const remaining = Math.max(0, 4 - inHandCount);
        totalRemaining += remaining;

        waits.push({
          tile: tile,
          remaining: remaining,
          inHandCount: inHandCount
        });
      }
    }

    // 待ちの形（両面、嵌張、辺張、単騎、シャンポン、多面張等）の分類
    const waitShape = determineWaitShape(hand13, waits);

    return {
      isTenpai: waits.length > 0,
      shanten: waits.length > 0 ? 0 : currentShanten,
      waits: waits,
      totalRemaining: totalRemaining,
      totalWaitCount: totalRemaining,
      waitShape: waitShape,
      shapeType: waitShape
    };
  }

  /**
   * 待ちの形状を判定
   */
  function determineWaitShape(hand, waits) {
    if (waits.length === 0) return 'ノーテン';
    if (waits.length === 13) return '国士無双13面待ち';
    if (waits.length === 1) {
      // 1面待ち：単騎、嵌張、辺張
      const w = waits[0].tile;
      const num = parseInt(w[0], 10);
      const suit = w[1];
      if (suit === 'z') return '字牌単騎待ち';
      if (num === 3 && hand.includes(`1${suit}`) && hand.includes(`2${suit}`)) return '辺張（ペンチャン）待ち';
      if (num === 7 && hand.includes(`8${suit}`) && hand.includes(`9${suit}`)) return '辺張（ペンチャン）待ち';
      if (hand.includes(`${num - 1}${suit}`) && hand.includes(`${num + 1}${suit}`)) return '嵌張（カンチャン）待ち';
      return '単騎（タンキ）待ち';
    }
    if (waits.length === 2) {
      const w1 = waits[0].tile;
      const w2 = waits[1].tile;
      // 両面 or シャンポン or ノベタン
      if (w1[1] === w2[1] && Math.abs(parseInt(w1[0], 10) - parseInt(w2[0], 10)) === 3) {
        return '両面（リャンメン）待ち';
      }
      return '双ポン（シャンポン）またはノベタン待ち';
    }
    if (waits.length === 3) {
      return '3面張（サンメンチャン）待ち';
    }
    return `${waits.length}面待ち（変則多面張）`;
  }

  // Global exports
  window.tileToIndex = tileToIndex;
  window.indexToTile = indexToTile;
  window.handToCounts = handToCounts;
  window.calculateShanten = calculateShanten;
  window.analyzeWaits = analyzeWaits;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
