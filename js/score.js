/**
 * 麻雀 点数計算 ＆ 全役判定エンジン (Mahjong Scoring & Yaku Engine)
 * プロ競技麻雀標準ルール準拠
 */

(function(window) {
  'use strict';

  /**
   * 点数計算のメインエントリーポイント
   * @param {Object} input
   *   hand: Array<string> (13枚または14枚の手牌、アガリ牌含む)
   *   winTile: string (アガリ牌)
   *   isTsumo: boolean (ツモかロンか)
   *   isDealer: boolean (親か子か)
   *   melds: Array<{ type: 'chi'|'pon'|'kan'|'ankan', tiles: Array<string> }> (副露・鳴き)
   *   options: {
   *     isRiichi: boolean,
   *     isDoubleRiichi: boolean,
   *     isIppatsu: boolean,
   *     isHaitei: boolean,
   *     isHoutei: boolean,
   *     isRinshan: boolean,
   *     isChankan: boolean,
   *     isTenhou: boolean,
   *     isChiihou: boolean,
   *     roundWind: '1z'|'2z', // 東場 or 南場
   *     seatWind: '1z'|'2z'|'3z'|'4z', // 東/南/西/北
   *     doraCount: number,
   *     uraDoraCount: number,
   *     honba: number // 本場数
   *   }
   */
  function calculateScore(input) {
    const { hand, winTile, isTsumo, isDealer, melds = [], options = {} } = input;
    const isMenzen = melds.filter(m => m.type !== 'ankan').length === 0;

    // 赤ドラの枚数カウント
    let redDoraCount = 0;
    hand.forEach(t => { if (t.endsWith('r')) redDoraCount++; });
    melds.forEach(m => m.tiles.forEach(t => { if (t.endsWith('r')) redDoraCount++; }));

    // ノーマライズ手牌
    const normalHand = hand.map(t => window.normalizeTile(t));
    const normalWinTile = window.normalizeTile(winTile);

    // 14枚の手牌（アガリ牌を手牌に含める）
    // 副露がある場合は hand が「閉じた牌のみ」のため、面子分を加味して判定する
    let allTiles = [...normalHand];
    if (allTiles.length + melds.length * 3 === 13) {
      allTiles.push(normalWinTile);
    }

    // 和了判定 (Shanten === -1)
    const counts = window.handToCounts(allTiles);
    const shanten = window.calculateShanten(allTiles, melds.length);

    if (shanten !== -1) {
      return {
        isAgari: false,
        error: '和了形（4面子1雀頭、七対子、または国士無双）になっていません'
      };
    }

    // 1. 特殊形：国士無双の判定
    if (isMenzen && isKokushi(counts)) {
      return evaluateKokushiScore({
        counts, normalWinTile, isTsumo, isDealer, options, redDoraCount
      });
    }

    // 2. 特殊形：七対子の判定
    //    七対子形は面子手（二盃口など）としても解釈できるため、即確定せず
    //    一般手の最良結果と比較して高い方を採用する（高点法）。
    let chiitoiResult = null;
    if (isMenzen && isChiitoitsu(counts)) {
      chiitoiResult = evaluateChiitoitsuScore({
        counts, normalHand, normalWinTile, isTsumo, isDealer, options, redDoraCount
      });
      if (!chiitoiResult || typeof chiitoiResult.totalPoints !== 'number') {
        chiitoiResult = null;
      }
    }

    // 3. 一般手（面子手）の全分解パターンの評価（高点法）
    const handDecompositions = decomposeHand(counts);
    let bestResult = null;

    for (const decomp of handDecompositions) {
      const res = evaluateStandardHand({
        decomp, melds, isMenzen, normalWinTile, isTsumo, isDealer, options, redDoraCount, allTiles
      });
      if (!bestResult || res.totalPoints > bestResult.totalPoints || (res.totalPoints === bestResult.totalPoints && res.han > bestResult.han)) {
        bestResult = res;
        bestResult.bestDecomp = {
          head: window.indexToTile(decomp.head),
          mentsu: decomp.mentsu.map(m => ({
            type: m.type,
            tiles: m.type === 'shuntsu' 
              ? [window.indexToTile(m.tile), window.indexToTile(m.tile + 1), window.indexToTile(m.tile + 2)]
              : [window.indexToTile(m.tile), window.indexToTile(m.tile), window.indexToTile(m.tile)]
          }))
        };
      }
    }

    // 七対子と面子手の両方が成立する場合は高点法で高い方を採用
    if (chiitoiResult) {
      const stdPoints = (bestResult && typeof bestResult.totalPoints === 'number')
        ? bestResult.totalPoints : -1;
      return (stdPoints > chiitoiResult.totalPoints) ? bestResult : chiitoiResult;
    }

    return bestResult || { isAgari: false, error: '役がありません（役なし）' };
  }

  function isKokushi(counts) {
    const yaochyu = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
    let unique = 0;
    let pairs = 0;
    for (const idx of yaochyu) {
      if (counts[idx] >= 1) unique++;
      if (counts[idx] >= 2) pairs++;
    }
    return unique === 13 && pairs === 1;
  }

  function isChiitoitsu(counts) {
    let pairs = 0;
    for (let i = 0; i < 34; i++) {
      if (counts[i] === 2) pairs++;
    }
    return pairs === 7;
  }

  /**
   * 手牌を 雀頭＋4面子 に分解
   */
  function decomposeHand(counts) {
    const results = [];

    // 雀頭を探す
    for (let head = 0; head < 34; head++) {
      if (counts[head] < 2) continue;

      const c = [...counts];
      c[head] -= 2;

      const mentsuList = [];
      findAllMentsu(c, 0, mentsuList, results, head);
    }

    return results;
  }

  function findAllMentsu(c, startIdx, currentMentsu, results, head) {
    let idx = startIdx;
    while (idx < 34 && c[idx] === 0) idx++;
    if (idx >= 34) {
      results.push({ head: head, mentsu: [...currentMentsu] });
      return;
    }

    // 刻子
    if (c[idx] >= 3) {
      c[idx] -= 3;
      currentMentsu.push({ type: 'koutsu', tile: idx });
      findAllMentsu(c, idx, currentMentsu, results, head);
      currentMentsu.pop();
      c[idx] += 3;
    }

    // 順子
    if (idx < 27 && (idx % 9) <= 6 && c[idx + 1] >= 1 && c[idx + 2] >= 1) {
      c[idx]--; c[idx + 1]--; c[idx + 2]--;
      currentMentsu.push({ type: 'shuntsu', tile: idx });
      findAllMentsu(c, idx, currentMentsu, results, head);
      currentMentsu.pop();
      c[idx]++; c[idx + 1]++; c[idx + 2]++;
    }
  }

  /**
   * 国士無双のスコア評価
   */
  function evaluateKokushiScore({ counts, normalWinTile, isTsumo, isDealer, options, redDoraCount }) {
    const winIdx = window.tileToIndex(normalWinTile);
    const is13Wait = counts[winIdx] === 2; // アガリ牌で雀頭が完成した場合が13面待ち
    const yakuList = [];
    if (is13Wait) {
      yakuList.push({ name: '国士無双十三面待ち', han: 26, isYakuman: true, yakumanMultiplier: 2 });
    } else {
      yakuList.push({ name: '国士無双', han: 13, isYakuman: true, yakumanMultiplier: 1 });
    }

    return buildFinalResult({
      yakuList, fu: 0, isTsumo, isDealer, options, redDoraCount
    });
  }

  /**
   * 七対子のスコア評価
   */
  function evaluateChiitoitsuScore({ counts, normalHand, normalWinTile, isTsumo, isDealer, options, redDoraCount }) {
    const yakuList = [];
    yakuList.push({ name: '七対子', han: 2 });

    // タンヤオ判定
    const isTanyao = isAllSimpu(counts);
    if (isTanyao) yakuList.push({ name: '断幺九（タンヤオ）', han: 1 });

    // 混一色・清一色・字一色判定
    const suits = checkSuits(counts);
    if (suits.isTsuuiisou) {
      return buildFinalResult({
        yakuList: [{ name: '字一色', han: 13, isYakuman: true, yakumanMultiplier: 1 }],
        fu: 25, isTsumo, isDealer, options, redDoraCount
      });
    }
    if (suits.isChinitsu) yakuList.push({ name: '清一色', han: 6 });
    else if (suits.isHonitsu) yakuList.push({ name: '混一色', han: 3 });

    // 混老頭
    if (isHonroutou(counts)) yakuList.push({ name: '混老頭', han: 2 });

    // 偶発役
    applySituationYaku(yakuList, options, isTsumo, true);

    return buildFinalResult({
      yakuList, fu: 25, isTsumo, isDealer, options, redDoraCount
    });
  }

  /**
   * 一般手（4面子1雀頭）のスコア評価
   */
  function evaluateStandardHand({ decomp, melds, isMenzen, normalWinTile, isTsumo, isDealer, options, redDoraCount, allTiles }) {
    const winIdx = window.tileToIndex(normalWinTile);
    const yakuList = [];

    // 副露を含めた全面子リストの構築
    const allMentsu = [...decomp.mentsu];
    melds.forEach(m => {
      const firstTileIdx = window.tileToIndex(m.tiles[0]);
      if (m.type === 'chi') {
        allMentsu.push({ type: 'shuntsu', tile: Math.min(...m.tiles.map(t => window.tileToIndex(t))), isMeld: true });
      } else if (m.type === 'pon') {
        allMentsu.push({ type: 'koutsu', tile: firstTileIdx, isMeld: true });
      } else if (m.type === 'kan') {
        allMentsu.push({ type: 'minkan', tile: firstTileIdx, isMeld: true });
      } else if (m.type === 'ankan') {
        allMentsu.push({ type: 'ankan', tile: firstTileIdx, isMeld: false });
      }
    });

    // 役満チェック (四暗刻, 大三元, 緑一色, 字一色, 清老頭, 四槓子)
    const yakumanList = checkYakuman(allTiles, decomp, allMentsu, isMenzen, winIdx, isTsumo);
    if (yakumanList.length > 0) {
      return buildFinalResult({
        yakuList: yakumanList, fu: 0, isTsumo, isDealer, options, redDoraCount
      });
    }

    // 1. 平和 (Pinfu) 判定
    const isPinfu = checkPinfu(decomp, allMentsu, isMenzen, winIdx, options);
    if (isPinfu) yakuList.push({ name: '平和（ピンフ）', han: 1 });

    // 2. 断幺九 (Tanyao) — 食いタンなしルールでは門前のみ
    const counts = window.handToCounts(allTiles);
    if (isAllSimpu(counts) && (isMenzen || options.kuitan !== false)) yakuList.push({ name: '断幺九（タンヤオ）', han: 1 });

    // 3. 門前清自摸和
    if (isMenzen && isTsumo) yakuList.push({ name: '門前清自摸和（ツモ）', han: 1 });

    // 4. 役牌 (Yakuhai)
    const roundWindIdx = window.tileToIndex(options.roundWind || '1z');
    const seatWindIdx = window.tileToIndex(options.seatWind || '1z');

    allMentsu.forEach(m => {
      if (m.type !== 'shuntsu') {
        if (m.tile === 31) yakuList.push({ name: '役牌: 白', han: 1 });
        if (m.tile === 32) yakuList.push({ name: '役牌: 發', han: 1 });
        if (m.tile === 33) yakuList.push({ name: '役牌: 中', han: 1 });
        if (m.tile === roundWindIdx) yakuList.push({ name: '役牌: 場風', han: 1 });
        if (m.tile === seatWindIdx) yakuList.push({ name: '役牌: 自風', han: 1 });
      }
    });

    // 5. 三色同順 (Sanshoku Doujun)
    if (checkSanshokuDoujun(allMentsu)) {
      yakuList.push({ name: '三色同順', han: isMenzen ? 2 : 1 });
    }

    // 6. 一気通貫 (Ikkitsuukan)
    if (checkIkkitsuukan(allMentsu)) {
      yakuList.push({ name: '一気通貫（イッツー）', han: isMenzen ? 2 : 1 });
    }

    // 7. 三色同刻
    if (checkSanshokuDoukou(allMentsu)) {
      yakuList.push({ name: '三色同刻', han: 2 });
    }

    // 8. 対々和 (Toitoi)
    const koutsuCount = allMentsu.filter(m => m.type !== 'shuntsu').length;
    if (koutsuCount === 4) {
      yakuList.push({ name: '対々和（トイトイ）', han: 2 });
    }

    // 9. 三暗刻 (Sanankou)
    let ankouCount = decomp.mentsu.filter(m => m.type === 'koutsu').length;
    melds.forEach(m => { if (m.type === 'ankan') ankouCount++; });
    // ロン和了のときは、アガリ牌を含む刻子は明刻扱いになる
    if (!isTsumo) {
      const winKoutsu = decomp.mentsu.find(m => m.type === 'koutsu' && m.tile === winIdx);
      if (winKoutsu) ankouCount--;
    }
    if (ankouCount === 3) {
      yakuList.push({ name: '三暗刻', han: 2 });
    }

    // 10. 三槓子 (Sankantsu)
    const kantsuCount = allMentsu.filter(m => m.type === 'minkan' || m.type === 'ankan').length;
    if (kantsuCount === 3) yakuList.push({ name: '三槓子', han: 2 });

    // 11. 小三元
    if (checkShousangen(decomp.head, allMentsu)) {
      yakuList.push({ name: '小三元', han: 2 });
    }

    // 12. 混全帯幺九 (Chanta) & 純全帯幺九 (Junchan)
    const chantaResult = checkChanta(decomp.head, allMentsu);
    if (chantaResult === 'junchan') {
      yakuList.push({ name: '純全帯幺九（ジュンチャン）', han: isMenzen ? 3 : 2 });
    } else if (chantaResult === 'chanta') {
      yakuList.push({ name: '混全帯幺九（チャンタ）', han: isMenzen ? 2 : 1 });
    }

    // 13. 混老頭
    if (isHonroutou(counts)) yakuList.push({ name: '混老頭', han: 2 });

    // 14. 一盃口 (Iipeikou) & 二盃口 (Ryanpeikou) - 門前限定
    if (isMenzen) {
      const peikouCount = countPeikou(decomp.mentsu);
      if (peikouCount === 2) yakuList.push({ name: '二盃口（リャンペーコー）', han: 3 });
      else if (peikouCount === 1) yakuList.push({ name: '一盃口（イーペーコー）', han: 1 });
    }

    // 15. 混一色 & 清一色
    const suits = checkSuits(counts);
    if (suits.isChinitsu) yakuList.push({ name: '清一色（チンイツ）', han: isMenzen ? 6 : 5 });
    else if (suits.isHonitsu) yakuList.push({ name: '混一色（ホンイツ）', han: isMenzen ? 3 : 2 });

    // 偶発役 (リーチ, 一発, ハイテイ, リンシャン等)
    applySituationYaku(yakuList, options, isTsumo, isMenzen);

    // 役なし判定
    if (yakuList.length === 0) {
      return { isAgari: false, error: '役がありません（1翻縛り未達成）' };
    }

    // 符計算 (Fu Calculation)
    const fuDetails = calculateFu({
      decomp, allMentsu, isMenzen, isPinfu, winIdx, isTsumo, options
    });

    return buildFinalResult({
      yakuList, fu: fuDetails.fu, fuBreakdown: fuDetails.breakdown, isTsumo, isDealer, options, redDoraCount
    });
  }

  /**
   * 符計算の詳細算出
   */
  function calculateFu({ decomp, allMentsu, isMenzen, isPinfu, winIdx, isTsumo, options }) {
    if (isPinfu && isTsumo) {
      return { fu: 20, breakdown: [{ label: '平和ツモ (固定)', fu: 20 }] };
    }
    if (isPinfu && !isTsumo) {
      return { fu: 30, breakdown: [{ label: '副底 (基本符)', fu: 20 }, { label: '門前加符', fu: 10 }] };
    }

    const breakdown = [{ label: '副底 (基本符)', fu: 20 }];
    let totalFu = 20;

    // 門前ロン加符
    if (isMenzen && !isTsumo) {
      breakdown.push({ label: '門前加符', fu: 10 });
      totalFu += 10;
    }

    // ツモ加符
    if (isTsumo) {
      breakdown.push({ label: 'ツモ符', fu: 2 });
      totalFu += 2;
    }

    // 雀頭符
    const headIdx = decomp.head;
    const roundWindIdx = window.tileToIndex(options.roundWind || '1z');
    const seatWindIdx = window.tileToIndex(options.seatWind || '1z');
    let headFu = 0;
    if (headIdx >= 31 && headIdx <= 33) headFu = 2; // 三元牌
    else if (headIdx === roundWindIdx && headIdx === seatWindIdx) headFu = 4; // 連風牌
    else if (headIdx === roundWindIdx || headIdx === seatWindIdx) headFu = 2; // 場風 or 自風

    if (headFu > 0) {
      breakdown.push({ label: `雀頭符 (${window.indexToTile(headIdx)})`, fu: headFu });
      totalFu += headFu;
    }

    // 面子符
    allMentsu.forEach(m => {
      if (m.type === 'shuntsu') return;

      const isYao = (m.tile % 9 === 0 || m.tile % 9 === 8 || m.tile >= 27);
      let mFu = 0;
      let label = '';

      if (m.type === 'koutsu') {
        const isAnkou = !m.isMeld && (isTsumo || m.tile !== winIdx);
        if (isAnkou) {
          mFu = isYao ? 8 : 4;
          label = `暗刻 (${window.indexToTile(m.tile)})`;
        } else {
          mFu = isYao ? 4 : 2;
          label = `明刻 (${window.indexToTile(m.tile)})`;
        }
      } else if (m.type === 'minkan') {
        mFu = isYao ? 16 : 8;
        label = `明槓 (${window.indexToTile(m.tile)})`;
      } else if (m.type === 'ankan') {
        mFu = isYao ? 32 : 16;
        label = `暗槓 (${window.indexToTile(m.tile)})`;
      }

      if (mFu > 0) {
        breakdown.push({ label, fu: mFu });
        totalFu += mFu;
      }
    });

    // 待ちの形符 (カンチャン、ペンチャン、タンキ: +2符)
    let waitFu = 0;
    let waitLabel = '';
    if (decomp.head === winIdx) {
      waitFu = 2;
      waitLabel = '単騎待ち';
    } else {
      // 順子内の待ちを検証
      for (const m of decomp.mentsu) {
        if (m.type === 'shuntsu') {
          if (m.tile + 1 === winIdx) {
            waitFu = 2;
            waitLabel = '嵌張（カンチャン）待ち';
            break;
          }
          if ((m.tile % 9 === 0 && winIdx === m.tile + 2) || (m.tile % 9 === 6 && winIdx === m.tile)) {
            waitFu = 2;
            waitLabel = '辺張（ペンチャン）待ち';
            break;
          }
        }
      }
    }

    if (waitFu > 0) {
      breakdown.push({ label: waitLabel, fu: waitFu });
      totalFu += waitFu;
    }

    // 喰い平和形の20符ロンは30符に切り上げ、1の位切り上げ (例: 22符 -> 30符)
    const roundedFu = Math.ceil(totalFu / 10) * 10;
    const finalFu = Math.max(30, roundedFu);

    return { fu: finalFu, breakdown };
  }

  /**
   * 偶発役（リーチ、一発、ハイテイ、リンシャン等）
   */
  function applySituationYaku(yakuList, options, isTsumo, isMenzen) {
    if (isMenzen && options.isDoubleRiichi) yakuList.push({ name: 'ダブル立直（ダブルリーチ）', han: 2 });
    else if (isMenzen && options.isRiichi) yakuList.push({ name: '立直（リーチ）', han: 1 });

    if (options.isIppatsu && (options.isRiichi || options.isDoubleRiichi)) yakuList.push({ name: '一発（イッパツ）', han: 1 });
    if (options.isHaitei && isTsumo) yakuList.push({ name: '海底摸月（ハイテイ）', han: 1 });
    if (options.isHoutei && !isTsumo) yakuList.push({ name: '河底撈魚（ホウテイ）', han: 1 });
    if (options.isRinshan && isTsumo) yakuList.push({ name: '嶺上開花（リンシャン）', han: 1 });
    if (options.isChankan && !isTsumo) yakuList.push({ name: '槍槓（チャンカン）', han: 1 });
    if (options.isTenhou && isMenzen) yakuList.push({ name: '天和（テンホウ）', han: 13, isYakuman: true, yakumanMultiplier: 1 });
    if (options.isChiihou && isMenzen) yakuList.push({ name: '地和（チーホウ）', han: 13, isYakuman: true, yakumanMultiplier: 1 });
  }

  /**
   * 最終点数・支払い配分の計算
   */
  function buildFinalResult({ yakuList, fu, fuBreakdown = [], isTsumo, isDealer, options, redDoraCount }) {
    // 役満判定
    const yakumanList = yakuList.filter(y => y.isYakuman);
    if (yakumanList.length > 0) {
      let multiplier = 0;
      yakumanList.forEach(y => { multiplier += (y.yakumanMultiplier || 1); });

      const baseYakumanPoints = isDealer ? 48000 : 32000;
      const totalPoints = baseYakumanPoints * multiplier;

      let scoreText = '';
      let payment = {};

      if (isDealer) {
        if (isTsumo) {
          const each = (16000 * multiplier);
          scoreText = `${each}点オール`;
          payment = { each };
        } else {
          scoreText = `${totalPoints}点`;
          payment = { ron: totalPoints };
        }
      } else {
        if (isTsumo) {
          const oya = (16000 * multiplier);
          const ko = (8000 * multiplier);
          scoreText = `${ko}点 / ${oya}点`;
          payment = { oya, ko };
        } else {
          scoreText = `${totalPoints}点`;
          payment = { ron: totalPoints };
        }
      }

      const rankTitle = multiplier > 1 ? `${multiplier}倍役満` : '役満';

      return {
        isAgari: true,
        isYakuman: true,
        yakumanMultiplier: multiplier,
        rankTitle,
        yakuList,
        han: 13 * multiplier,
        fu: 0,
        fuBreakdown: [],
        fuDetails: [],
        totalPoints,
        scoreText,
        payment,
        points: {
          total: totalPoints,
          ron: payment.ron || totalPoints,
          oyaTsumo: payment.oya || payment.each || 0,
          koTsumo: payment.ko || payment.each || 0,
          honbaBonus: 0
        },
        honbaBonus: 0
      };
    }

    // ドラ加算
    const dora = options.doraCount || 0;
    const uraDora = options.uraDoraCount || 0;
    const redDora = redDoraCount || 0;

    if (dora > 0) yakuList.push({ name: `ドラ (${dora}枚)`, han: dora });
    if (uraDora > 0) yakuList.push({ name: `裏ドラ (${uraDora}枚)`, han: uraDora });
    if (redDora > 0) yakuList.push({ name: `赤ドラ (${redDora}枚)`, han: redDora });

    let totalHan = 0;
    yakuList.forEach(y => { totalHan += y.han; });

    // 基本点・ランク判定
    let basePoints = fu * Math.pow(2, totalHan + 2);
    let rankTitle = '';

    if (totalHan >= 13) {
      rankTitle = '数え役満';
      basePoints = 8000;
    } else if (totalHan >= 11) {
      rankTitle = '三倍満';
      basePoints = 6000;
    } else if (totalHan >= 8) {
      rankTitle = '倍満';
      basePoints = 4000;
    } else if (totalHan >= 6) {
      rankTitle = '跳満';
      basePoints = 3000;
    } else if (totalHan === 5 || basePoints >= 2000) {
      rankTitle = '満貫';
      basePoints = 2000;
    }

    const honba = options.honba || 0;
    const honbaPoints = honba * 300;

    let totalPoints = 0;
    let scoreText = '';
    let payment = {};

    if (isDealer) {
      if (isTsumo) {
        let each = Math.ceil((basePoints * 2) / 100) * 100;
        const eachHonba = honba * 100;
        each += eachHonba;
        totalPoints = each * 3;
        scoreText = `${each}点オール`;
        payment = { each, honbaEach: eachHonba };
      } else {
        let ron = Math.ceil((basePoints * 6) / 100) * 100;
        ron += honbaPoints;
        totalPoints = ron;
        scoreText = `${ron}点`;
        payment = { ron, honba: honbaPoints };
      }
    } else {
      if (isTsumo) {
        let ko = Math.ceil((basePoints * 1) / 100) * 100;
        let oya = Math.ceil((basePoints * 2) / 100) * 100;
        const eachHonba = honba * 100;
        ko += eachHonba;
        oya += eachHonba;
        totalPoints = ko * 2 + oya;
        scoreText = `${ko}点 / ${oya}点`;
        payment = { oya, ko, honbaEach: eachHonba };
      } else {
        let ron = Math.ceil((basePoints * 4) / 100) * 100;
        ron += honbaPoints;
        totalPoints = ron;
        scoreText = `${ron}点`;
        payment = { ron, honba: honbaPoints };
      }
    }

    return {
      isAgari: true,
      isYakuman: false,
      rankTitle: rankTitle || `${totalHan}翻 ${fu}符`,
      yakuList,
      han: totalHan,
      fu,
      fuBreakdown,
      fuDetails: (fuBreakdown || []).map(f => ({ desc: f.label || f.desc, fu: f.fu })),
      totalPoints,
      scoreText,
      payment,
      points: {
        total: totalPoints,
        ron: payment.ron || totalPoints,
        oyaTsumo: payment.oya || payment.each || 0,
        koTsumo: payment.ko || payment.each || 0,
        honbaBonus: honbaPoints || 0
      },
      honbaBonus: honbaPoints
    };
  }

  // 補助判定関数群
  function isAllSimpu(counts) {
    const yao = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
    return !yao.some(idx => counts[idx] > 0);
  }

  function isHonroutou(counts) {
    for (let i = 0; i < 27; i++) {
      if (i % 9 !== 0 && i % 9 !== 8 && counts[i] > 0) return false;
    }
    return true;
  }

  function checkSuits(counts) {
    let man = 0, pin = 0, sou = 0, honor = 0;
    for (let i = 0; i < 9; i++) if (counts[i] > 0) man++;
    for (let i = 9; i < 18; i++) if (counts[i] > 0) pin++;
    for (let i = 18; i < 27; i++) if (counts[i] > 0) sou++;
    for (let i = 27; i < 34; i++) if (counts[i] > 0) honor++;

    const colorCount = (man > 0 ? 1 : 0) + (pin > 0 ? 1 : 0) + (sou > 0 ? 1 : 0);
    return {
      isTsuuiisou: colorCount === 0 && honor > 0,
      isChinitsu: colorCount === 1 && honor === 0,
      isHonitsu: colorCount === 1 && honor > 0
    };
  }

  function checkPinfu(decomp, allMentsu, isMenzen, winIdx, options) {
    if (!isMenzen) return false;
    // 4面子すべて順子
    if (allMentsu.some(m => m.type !== 'shuntsu')) return false;

    // 雀頭が役牌でないこと
    const roundWindIdx = window.tileToIndex(options.roundWind || '1z');
    const seatWindIdx = window.tileToIndex(options.seatWind || '1z');
    if (decomp.head >= 31 || decomp.head === roundWindIdx || decomp.head === seatWindIdx) return false;

    // 両面待ちであること
    for (const m of decomp.mentsu) {
      if (m.type === 'shuntsu') {
        const p = m.tile % 9;
        if (p >= 1 && p <= 5) {
          if (winIdx === m.tile || winIdx === m.tile + 2) return true;
        }
      }
    }
    return false;
  }

  function checkSanshokuDoujun(allMentsu) {
    const shuntsu = allMentsu.filter(m => m.type === 'shuntsu');
    for (let num = 0; num <= 6; num++) {
      const hasM = shuntsu.some(m => m.tile === num);
      const hasP = shuntsu.some(m => m.tile === num + 9);
      const hasS = shuntsu.some(m => m.tile === num + 18);
      if (hasM && hasP && hasS) return true;
    }
    return false;
  }

  function checkIkkitsuukan(allMentsu) {
    const shuntsu = allMentsu.filter(m => m.type === 'shuntsu');
    const suits = [0, 9, 18];
    for (const s of suits) {
      const has123 = shuntsu.some(m => m.tile === s);
      const has456 = shuntsu.some(m => m.tile === s + 3);
      const has789 = shuntsu.some(m => m.tile === s + 6);
      if (has123 && has456 && has789) return true;
    }
    return false;
  }

  function checkSanshokuDoukou(allMentsu) {
    const koutsu = allMentsu.filter(m => m.type !== 'shuntsu');
    for (let num = 0; num < 9; num++) {
      const hasM = koutsu.some(m => m.tile === num);
      const hasP = koutsu.some(m => m.tile === num + 9);
      const hasS = koutsu.some(m => m.tile === num + 18);
      if (hasM && hasP && hasS) return true;
    }
    return false;
  }

  function checkShousangen(head, allMentsu) {
    if (head < 31 || head > 33) return false;
    let sangenKoutsu = 0;
    allMentsu.forEach(m => {
      if (m.type !== 'shuntsu' && m.tile >= 31 && m.tile <= 33) sangenKoutsu++;
    });
    return sangenKoutsu === 2;
  }

  function checkChanta(head, allMentsu) {
    const isYao = (idx) => (idx % 9 === 0 || idx % 9 === 8 || idx >= 27);
    const isRoutou = (idx) => (idx < 27 && (idx % 9 === 0 || idx % 9 === 8));

    if (!isYao(head)) return false;

    let hasHonor = (head >= 27);
    for (const m of allMentsu) {
      if (m.type === 'shuntsu') {
        if (m.tile % 9 !== 0 && m.tile % 9 !== 6) return false;
      } else {
        if (!isYao(m.tile)) return false;
        if (m.tile >= 27) hasHonor = true;
      }
    }

    return hasHonor ? 'chanta' : 'junchan';
  }

  function countPeikou(shuntsuList) {
    const counts = {};
    shuntsuList.forEach(m => {
      counts[m.tile] = (counts[m.tile] || 0) + 1;
    });
    let pairs = 0;
    Object.values(counts).forEach(c => {
      if (c >= 4) pairs += 2;
      else if (c >= 2) pairs += 1;
    });
    return pairs;
  }

  function checkYakuman(allTiles, decomp, allMentsu, isMenzen, winIdx, isTsumo) {
    const list = [];
    const counts = window.handToCounts(allTiles);

    // 四暗刻
    if (isMenzen) {
      const isTanki = decomp.head === winIdx;
      let ankou = decomp.mentsu.filter(m => m.type === 'koutsu').length;
      if (isTsumo || isTanki) {
        if (ankou === 4) {
          if (isTanki) list.push({ name: '四暗刻単騎待ち', han: 26, isYakuman: true, yakumanMultiplier: 2 });
          else list.push({ name: '四暗刻', han: 13, isYakuman: true, yakumanMultiplier: 1 });
        }
      }
    }

    // 大三元
    let sangenCount = 0;
    allMentsu.forEach(m => { if (m.type !== 'shuntsu' && m.tile >= 31 && m.tile <= 33) sangenCount++; });
    if (sangenCount === 3) list.push({ name: '大三元', han: 13, isYakuman: true, yakumanMultiplier: 1 });

    // 小四喜・大四喜 (風牌の刻子/槓子と雀頭)
    const windKoutsu = allMentsu.filter(m => m.type !== 'shuntsu' && m.tile >= 27 && m.tile <= 30).length;
    const headIsWind = decomp.head >= 27 && decomp.head <= 30;
    if (windKoutsu === 4) {
      list.push({ name: '大四喜', han: 26, isYakuman: true, yakumanMultiplier: 2 });
    } else if (windKoutsu === 3 && headIsWind) {
      list.push({ name: '小四喜', han: 13, isYakuman: true, yakumanMultiplier: 1 });
    }

    // 四槓子 (槓子が4つ)
    const kanCount = allMentsu.filter(m => m.type === 'minkan' || m.type === 'ankan').length;
    if (kanCount === 4) {
      list.push({ name: '四槓子', han: 13, isYakuman: true, yakumanMultiplier: 1 });
    }

    // 字一色
    let onlyHonor = true;
    for (let i = 0; i < 27; i++) if (counts[i] > 0) onlyHonor = false;
    if (onlyHonor) list.push({ name: '字一色（ツーイーソー）', han: 13, isYakuman: true, yakumanMultiplier: 1 });

    // 緑一色 (2s, 3s, 4s, 6s, 8s, 6z(發))
    const ryuuTiles = [19, 20, 21, 23, 25, 32];
    let isRyuuiisou = true;
    for (let i = 0; i < 34; i++) {
      if (counts[i] > 0 && !ryuuTiles.includes(i)) isRyuuiisou = false;
    }
    if (isRyuuiisou) list.push({ name: '緑一色（リューイーソー）', han: 13, isYakuman: true, yakumanMultiplier: 1 });

    // 清老頭 (1,9の数牌のみ)
    const routouTiles = [0, 8, 9, 17, 18, 26];
    let isChinroutou = true;
    for (let i = 0; i < 34; i++) {
      if (counts[i] > 0 && !routouTiles.includes(i)) isChinroutou = false;
    }
    if (isChinroutou) list.push({ name: '清老頭（チンロウトウ）', han: 13, isYakuman: true, yakumanMultiplier: 1 });

    // 九蓮宝燈 (門前・萬子/筒子/索子のいずれか1色で 1112345678999+X)
    if (isMenzen && decomp.mentsu.length > 0) {
      const suits = checkSuits(counts);
      if (suits.isChinitsu) {
        const offset = counts[0] > 0 ? 0 : (counts[9] > 0 ? 9 : 18);
        const req = [3, 1, 1, 1, 1, 1, 1, 1, 3];
        let match = true;
        for (let i = 0; i < 9; i++) {
          if (counts[offset + i] < req[i]) match = false;
        }
        if (match) {
          const isJunsei = (counts[offset + (winIdx % 9)] === req[winIdx % 9] + 1);
          if (isJunsei) list.push({ name: '純正九蓮宝燈（9面待ち）', han: 26, isYakuman: true, yakumanMultiplier: 2 });
          else list.push({ name: '九蓮宝燈（チューレンポウトウ）', han: 13, isYakuman: true, yakumanMultiplier: 1 });
        }
      }
    }

    return list;
  }

  // Global expose
  window.calculateScore = calculateScore;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
