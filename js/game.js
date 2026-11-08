/**
 * 雀聖AI - 本格4人麻雀ゲームエンジン (CPU対戦 / 東風戦)
 * (Full Mahjong Game Engine & CPU Match Controller)
 */

(function(window) {
  'use strict';

  const PLAYER_NAMES = ['あなた', 'CPU 葵 (アオイ)', 'CPU 蓮 (レン)', 'CPU 龍馬 (リョウマ)'];
  const PLAYER_AVATARS = ['🧑', '👩‍💼', '🧑‍💻', '🧓'];
  const KAZE_NAMES = ['東', '南', '西', '北'];
  const KAZE_TILES = ['1z', '2z', '3z', '4z'];

  // ゲーム状態
  const game = {
    isInitialized: false,
    isActive: false,
    roundWind: '1z', // 東場
    roundNum: 0,     // 0: 東1局, 1: 東2局, 2: 東3局, 3: 東4局
    dealerIdx: 0,    // 親のプレイヤーインデックス (0..3)
    honba: 0,        // 本場数
    riichiSticks: 0, // 供託リーチ棒数
    wall: [],        // 牌山
    deadWall: [],    // 王牌 (14枚)
    doraIndicators: [], // 表ドラ表示牌
    uraDoraIndicators: [], // 裏ドラ表示牌
    players: [],     // 4名のプレイヤーデータ
    currentTurn: 0,  // 手番 (0..3)
    lastDrawnTile: null, // 直前のツモ牌
    lastDiscardedTile: null, // 直前の打牌
    lastDiscarder: -1, // 直前の打牌者
    pendingActions: null, // プレイヤーの鳴き・ロン選択待ち
    isAssisting: true, // 待ち牌アシスト表示
    turnTimer: null  // CPUターン実行タイマー
  };

  // DOM要素キャッシュ
  let DOM = {};

  function cacheDom() {
    DOM = {
      gameRoundName: document.getElementById('gameRoundName'),
      gameHonbaBadge: document.getElementById('gameHonbaBadge'),
      gameRiichiSticks: document.getElementById('gameRiichiSticks'),
      gameRemainingWall: document.getElementById('gameRemainingWall'),
      centerRoundText: document.getElementById('centerRoundText'),
      gameDoraTile: document.getElementById('gameDoraTile'),
      turnIndicator: document.getElementById('turnIndicator'),
      btnNewGame: document.getElementById('btnNewGame'),
      btnToggleAssist: document.getElementById('btnToggleAssist'),

      // スコア・ステータス
      scoreJibun: document.getElementById('scoreJibun'),
      scoreShimocha: document.getElementById('scoreShimocha'),
      scoreToimen: document.getElementById('scoreToimen'),
      scoreKamicha: document.getElementById('scoreKamicha'),

      riichiFlagJibun: document.getElementById('riichiFlagJibun'),
      riichiFlagShimocha: document.getElementById('riichiFlagShimocha'),
      riichiFlagToimen: document.getElementById('riichiFlagToimen'),
      riichiFlagKamicha: document.getElementById('riichiFlagKamicha'),

      // 河 (捨牌置き場)
      kawaJibun: document.getElementById('kawaJibun'),
      kawaShimocha: document.getElementById('kawaShimocha'),
      kawaToimen: document.getElementById('kawaToimen'),
      kawaKamicha: document.getElementById('kawaKamicha'),

      // 敵手牌・副露
      handShimocha: document.getElementById('handShimocha'),
      meldsShimocha: document.getElementById('meldsShimocha'),
      handToimen: document.getElementById('handToimen'),
      meldsToimen: document.getElementById('meldsToimen'),
      handKamicha: document.getElementById('handKamicha'),
      meldsKamicha: document.getElementById('meldsKamicha'),

      // 自分手牌
      jibunHandTiles: document.getElementById('jibunHandTiles'),
      jibunTsumoTile: document.getElementById('jibunTsumoTile'),
      jibunMelds: document.getElementById('jibunMelds'),

      // アクションバー
      gameActionBar: document.getElementById('gameActionBar'),
      btnActionRon: document.getElementById('btnActionRon'),
      btnActionTsumo: document.getElementById('btnActionTsumo'),
      btnActionRiichi: document.getElementById('btnActionRiichi'),
      btnActionPon: document.getElementById('btnActionPon'),
      btnActionChi: document.getElementById('btnActionChi'),
      btnActionKan: document.getElementById('btnActionKan'),
      btnActionPass: document.getElementById('btnActionPass'),

      // アシストバー
      gameAssistBar: document.getElementById('gameAssistBar'),
      gameAssistShanten: document.getElementById('gameAssistShanten'),
      gameAssistWaits: document.getElementById('gameAssistWaits'),

      // リザルトモーダル
      gameResultModal: document.getElementById('gameResultModal'),
      resultModalTitle: document.getElementById('resultModalTitle'),
      resultWinnerAvatar: document.getElementById('resultWinnerAvatar'),
      resultWinnerName: document.getElementById('resultWinnerName'),
      resultAgariType: document.getElementById('resultAgariType'),
      resultHandTiles: document.getElementById('resultHandTiles'),
      resultDoraTiles: document.getElementById('resultDoraTiles'),
      resultYakuList: document.getElementById('resultYakuList'),
      resultScorePoints: document.getElementById('resultScorePoints'),
      resultScoreRank: document.getElementById('resultScoreRank'),
      resultScoreDetails: document.getElementById('resultScoreDetails'),
      btnNextRound: document.getElementById('btnNextRound')
    };
  }

  /**
   * ゲーム初期化
   */
  function init() {
    cacheDom();
    setupEvents();
    game.isInitialized = true;
    startNewGame();
  }

  function setupEvents() {
    if (DOM.btnNewGame) {
      DOM.btnNewGame.addEventListener('click', () => {
        if (confirm('現在の対局をリセットして最初から始めますか？')) {
          startNewGame();
        }
      });
    }

    if (DOM.btnToggleAssist) {
      DOM.btnToggleAssist.addEventListener('click', () => {
        game.isAssisting = !game.isAssisting;
        DOM.btnToggleAssist.textContent = `💡 アシスト: ${game.isAssisting ? 'ON' : 'OFF'}`;
        DOM.gameAssistBar.style.display = game.isAssisting ? 'flex' : 'none';
        if (game.isAssisting) updatePlayerAssist();
      });
    }

    if (DOM.btnActionPass) {
      DOM.btnActionPass.addEventListener('click', () => handlePlayerAction('pass'));
    }
    if (DOM.btnActionRon) {
      DOM.btnActionRon.addEventListener('click', () => handlePlayerAction('ron'));
    }
    if (DOM.btnActionTsumo) {
      DOM.btnActionTsumo.addEventListener('click', () => handlePlayerAction('tsumo'));
    }
    if (DOM.btnActionRiichi) {
      DOM.btnActionRiichi.addEventListener('click', () => handlePlayerAction('riichi'));
    }
    if (DOM.btnActionPon) {
      DOM.btnActionPon.addEventListener('click', () => handlePlayerAction('pon'));
    }
    if (DOM.btnActionChi) {
      DOM.btnActionChi.addEventListener('click', () => handlePlayerAction('chi'));
    }
    if (DOM.btnActionKan) {
      DOM.btnActionKan.addEventListener('click', () => handlePlayerAction('kan'));
    }
    if (DOM.btnNextRound) {
      DOM.btnNextRound.addEventListener('click', () => {
        closeResultModal();
        advanceRound(game.lastRoundRenchan);
      });
    }
  }

  /**
   * 新規対局（東風戦）開始
   */
  function startNewGame() {
    clearTimeout(game.turnTimer);
    game.roundWind = '1z'; // 東場
    game.roundNum = 0;     // 東1局
    game.dealerIdx = 0;    // あなたが東1局の親
    game.honba = 0;
    game.riichiSticks = 0;

    // 4名のプレイヤー初期化
    game.players = [
      createPlayer(0, PLAYER_NAMES[0], PLAYER_AVATARS[0]),
      createPlayer(1, PLAYER_NAMES[1], PLAYER_AVATARS[1]),
      createPlayer(2, PLAYER_NAMES[2], PLAYER_AVATARS[2]),
      createPlayer(3, PLAYER_NAMES[3], PLAYER_AVATARS[3])
    ];

    startRound();
  }

  function createPlayer(idx, name, avatar) {
    return {
      idx,
      name,
      avatar,
      score: 25000,
      seatWind: '1z',
      hand: [],
      tsumoTile: null,
      kawa: [],      // 打牌リスト: { tile: string, isRiichi: boolean, isTsumogiri: boolean }
      melds: [],     // 副露
      isRiichi: false,
      isDoubleRiichi: false,
      ippatsu: false,
      isMenzen: true,
      furiten: false
    };
  }

  /**
   * 1局の開始（洗牌・配牌・ドラ設定）
   */
  function startRound() {
    clearTimeout(game.turnTimer);
    hideActionBar();
    closeResultModal();

    // 自風の設定 (親が東、下家が南、対面が西、上家が北)
    for (let i = 0; i < 4; i++) {
      const windOffset = (i - game.dealerIdx + 4) % 4;
      game.players[i].seatWind = KAZE_TILES[windOffset];
      game.players[i].hand = [];
      game.players[i].tsumoTile = null;
      game.players[i].kawa = [];
      game.players[i].melds = [];
      game.players[i].isRiichi = false;
      game.players[i].isDoubleRiichi = false;
      game.players[i].ippatsu = false;
      game.players[i].isMenzen = true;
      game.players[i].furiten = false;
    }

    // 牌山の生成 (136枚: 萬子, 筒子, 索子, 字牌 各4枚 + 赤ドラ3枚)
    buildWall();

    // 王牌 (14枚) を確保
    game.deadWall = game.wall.splice(game.wall.length - 14, 14);
    // ドラ表示牌 (王牌の3番目)
    game.doraIndicators = [game.deadWall[4]];
    game.uraDoraIndicators = [game.deadWall[9]];

    // 配牌 (各13枚)
    for (let i = 0; i < 4; i++) {
      game.players[i].hand = game.wall.splice(0, 13);
      sortHand(game.players[i].hand);
    }

    // 親のツモ牌 (14枚目)
    game.currentTurn = game.dealerIdx;
    const firstTsumo = game.wall.shift();

    renderBoard();
    updatePlayerAssist();

    // 親のターンを開始
    executeTurn(game.dealerIdx, firstTsumo);
  }

  /**
   * 136枚の牌山生成 & シャッフル
   */
  function buildWall() {
    const wall = [];
    const baseTiles = [
      '1m','2m','3m','4m','5m','6m','7m','8m','9m',
      '1p','2p','3p','4p','5p','6p','7p','8p','9p',
      '1s','2s','3s','4s','5s','6s','7s','8s','9s',
      '1z','2z','3z','4z','5z','6z','7z'
    ];

    baseTiles.forEach(tile => {
      for (let i = 0; i < 4; i++) {
        // 赤ドラ（5萬, 5筒, 5索 の各1枚を赤ドラに）
        if (tile === '5m' && i === 0) wall.push('5mr');
        else if (tile === '5p' && i === 0) wall.push('5pr');
        else if (tile === '5s' && i === 0) wall.push('5sr');
        else wall.push(tile);
      }
    });

    // Fisher-Yates シャッフル
    for (let i = wall.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wall[i], wall[j]] = [wall[j], wall[i]];
    }

    game.wall = wall;
  }

  /**
   * 牌のソート（理牌）
   */
  function sortHand(hand) {
    const suitOrder = { 'm': 0, 'p': 1, 's': 2, 'z': 3 };
    hand.sort((a, b) => {
      const suitA = a[1];
      const suitB = b[1];
      if (suitOrder[suitA] !== suitOrder[suitB]) {
        return suitOrder[suitA] - suitOrder[suitB];
      }
      const numA = parseInt(a[0], 10);
      const numB = parseInt(b[0], 10);
      return numA - numB;
    });
  }

  /**
   * 手番の実行（ツモ処理）
   */
  function executeTurn(playerIdx, drawnTile) {
    clearTimeout(game.turnTimer);
    game.currentTurn = playerIdx;
    game.lastDrawnTile = drawnTile;
    const player = game.players[playerIdx];
    player.tsumoTile = drawnTile;

    renderBoard();

    // プレイヤー（あなた）の手番
    if (playerIdx === 0) {
      updatePlayerAssist();
      checkPlayerTsumoActions(drawnTile);
      return;
    }

    // CPUの手番（少しディレイを入れて思考感を演出）
    game.turnTimer = setTimeout(() => {
      cpuExecuteTurn(playerIdx, drawnTile);
    }, 450);
  }

  /**
   * プレイヤー（あなた）のツモ時のアクションチェック
   */
  function checkPlayerTsumoActions(drawnTile) {
    const player = game.players[0];
    const fullHand = [...player.hand, drawnTile];

    let hasActions = false;

    // 1. ツモアガリチェック
    const shanten = window.calculateShanten ? window.calculateShanten(fullHand, player.melds.length) : 99;
    if (shanten === -1) {
      // 役があるか計算
      const scoreRes = calcScoreSafe({
        hand: player.hand,
        winTile: drawnTile,
        isTsumo: true,
        isDealer: (player.seatWind === '1z'),
        melds: player.melds,
        options: {
          isRiichi: player.isRiichi,
          isIppatsu: player.ippatsu,
          roundWind: game.roundWind,
          seatWind: player.seatWind,
          doraCount: countDora(fullHand, game.doraIndicators),
          uraDoraCount: player.isRiichi ? countDora(fullHand, game.uraDoraIndicators) : 0,
          honba: game.honba
        }
      });

      if (scoreRes && scoreRes.han >= 1) {
        DOM.btnActionTsumo.style.display = 'inline-block';
        hasActions = true;
      }
    }

    // 2. リーチチェック (門前、テンパイ、持ち点1000点以上、未リーチ)
    if (!player.isRiichi && player.isMenzen && player.score >= 1000) {
      if (canRiichi(player.hand, drawnTile)) {
        DOM.btnActionRiichi.style.display = 'inline-block';
        hasActions = true;
      }
    }

    // 3. 暗槓チェック
    if (!player.isRiichi && canAnkan(fullHand)) {
      DOM.btnActionKan.style.display = 'inline-block';
      hasActions = true;
    }

    if (hasActions) {
      DOM.btnActionPass.style.display = 'inline-block';
      DOM.gameActionBar.style.display = 'flex';
      game.pendingActions = { type: 'tsumo', playerIdx: 0, drawnTile };
    } else {
      hideActionBar();
    }

    // すでにリーチ中なら自動ツモ切り
    if (player.isRiichi && !hasActions) {
      game.turnTimer = setTimeout(() => {
        handleDiscardTile(0, drawnTile, true);
      }, 350);
    }
  }

  /**
   * リーチ可能か判定
   */
  function canRiichi(hand, drawnTile) {
    const fullHand = [...hand, drawnTile];
    for (let i = 0; i < fullHand.length; i++) {
      const testHand = fullHand.filter((_, idx) => idx !== i);
      const s = window.calculateShanten ? window.calculateShanten(testHand, 0) : 99;
      if (s === 0) return true; // テンパイ
    }
    return false;
  }

  /**
   * 暗槓可能か判定
   */
  function canAnkan(fullHand) {
    const counts = {};
    fullHand.forEach(t => {
      const raw = window.normalizeTile ? window.normalizeTile(t) : t;
      counts[raw] = (counts[raw] || 0) + 1;
    });
    return Object.values(counts).some(c => c === 4);
  }

  /**
   * CPU思考ルーチン
   */
  function cpuExecuteTurn(playerIdx, drawnTile) {
    const cpu = game.players[playerIdx];
    const fullHand = [...cpu.hand, drawnTile];

    // 1. ツモアガリチェック
    const shanten = window.calculateShanten ? window.calculateShanten(fullHand, cpu.melds.length) : 99;
    if (shanten === -1) {
      const scoreRes = calcScoreSafe({
        hand: cpu.hand,
        winTile: drawnTile,
        isTsumo: true,
        isDealer: (cpu.seatWind === '1z'),
        melds: cpu.melds,
        options: {
          isRiichi: cpu.isRiichi,
          isIppatsu: cpu.ippatsu,
          roundWind: game.roundWind,
          seatWind: cpu.seatWind,
          doraCount: countDora(fullHand, game.doraIndicators),
          uraDoraCount: cpu.isRiichi ? countDora(fullHand, game.uraDoraIndicators) : 0,
          honba: game.honba
        }
      });

      if (scoreRes && scoreRes.han >= 1) {
        // CPUツモアガリ！
        handleAgari(playerIdx, -1, drawnTile, true, scoreRes);
        return;
      }
    }

    // 2. リーチ宣言判定 (門前テンパイ時、70%の確率でリーチ)
    if (!cpu.isRiichi && cpu.isMenzen && cpu.score >= 1000) {
      if (canRiichi(cpu.hand, drawnTile) && Math.random() < 0.75) {
        declareRiichi(playerIdx);
      }
    }

    // 3. 打牌選択
    let discardTile = drawnTile;
    let isTsumogiri = true;

    if (cpu.isRiichi) {
      // リーチ中はツモ切り固定
      discardTile = drawnTile;
      isTsumogiri = true;
    } else {
      // 向聴数を最小化し、不要な孤立牌から優先して打牌
      discardTile = chooseCpuBestDiscard(fullHand, cpu.melds.length);
      isTsumogiri = (discardTile === drawnTile);
    }

    handleDiscardTile(playerIdx, discardTile, isTsumogiri);
  }

  /**
   * CPUの最適打牌選択AI
   */
  function chooseCpuBestDiscard(hand14, meldCount) {
    let bestDiscard = hand14[hand14.length - 1];
    let minShanten = 99;
    const candidates = [];

    // 14枚それぞれを切った時のシャンテン数を計算
    const uniqueTiles = [...new Set(hand14)];
    uniqueTiles.forEach(t => {
      const remain = [...hand14];
      remain.splice(remain.indexOf(t), 1);
      const s = window.calculateShanten ? window.calculateShanten(remain, meldCount) : 99;
      if (s < minShanten) {
        minShanten = s;
        candidates.length = 0;
        candidates.push(t);
      } else if (s === minShanten) {
        candidates.push(t);
      }
    });

    // 最小シャンテン数を保つ候補の中で、不要な牌を優先
    // 孤立字牌 > 1,9牌 > 2,8牌 > その他
    candidates.sort((a, b) => {
      const scoreA = getDiscardSafetyScore(a);
      const scoreB = getDiscardSafetyScore(b);
      return scoreB - scoreA;
    });

    return candidates[0] || hand14[hand14.length - 1];
  }

  function getDiscardSafetyScore(tile) {
    const raw = window.normalizeTile ? window.normalizeTile(tile) : tile;
    const suit = raw[1];
    const num = parseInt(raw[0], 10);
    if (suit === 'z') return 100; // 字牌は捨てやすい
    if (num === 1 || num === 9) return 50; // 端牌
    if (num === 2 || num === 8) return 30;
    return 10;
  }

  /**
   * リーチ宣言処理
   */
  function declareRiichi(playerIdx) {
    const player = game.players[playerIdx];
    player.isRiichi = true;
    player.ippatsu = true;
    player.score -= 1000;
    game.riichiSticks += 1;

    showGameToast(`${player.name} が立直（リーチ）！`, 'gold');
    renderBoard();
  }

  /**
   * 打牌処理
   */
  function handleDiscardTile(playerIdx, tile, isTsumogiri) {
    clearTimeout(game.turnTimer);
    hideActionBar();

    const player = game.players[playerIdx];

    // 手牌から切った牌を削除
    if (isTsumogiri && player.tsumoTile === tile) {
      player.tsumoTile = null;
    } else {
      const idx = player.hand.indexOf(tile);
      if (idx !== -1) {
        player.hand.splice(idx, 1);
        if (player.tsumoTile) {
          player.hand.push(player.tsumoTile);
          player.tsumoTile = null;
        }
      }
    }
    sortHand(player.hand);

    // 河に打牌を追加
    player.kawa.push({
      tile,
      isRiichi: player.isRiichi && player.kawa.length === 0,
      isTsumogiri
    });

    game.lastDiscardedTile = tile;
    game.lastDiscarder = playerIdx;

    renderBoard();
    if (playerIdx === 0) updatePlayerAssist();

    // 他家の鳴き・ロン判定
    checkOtherPlayersResponses(playerIdx, tile);
  }

  /**
   * 捨て牌に対する他家のアクション判定 (ロン, ポン, チー, カン)
   */
  function checkOtherPlayersResponses(discarderIdx, tile) {
    // 1. プレイヤー（あなた）のロン・ポン・チー判定 (discarderIdx !== 0)
    if (discarderIdx !== 0) {
      const player = game.players[0];
      const hasAction = checkPlayerResponsesToDiscard(player, discarderIdx, tile);
      if (hasAction) {
        return; // プレイヤーの入力待ち
      }
    }

    // 2. CPUのロン判定
    for (let i = 1; i < 4; i++) {
      if (i === discarderIdx) continue;
      const cpu = game.players[i];
      if (checkCpuRon(cpu, tile)) {
        return; // CPUがロン
      }
    }

    // 誰も鳴き・ロンしない場合、次の手番へ進む
    proceedToNextTurn();
  }

  /**
   * プレイヤーが捨て牌に対してアクション可能か判定
   */
  function checkPlayerResponsesToDiscard(player, discarderIdx, tile) {
    let canRon = false;
    let canPon = false;
    let canChi = false;

    // ロン判定
    const testHand = [...player.hand, tile];
    const s = window.calculateShanten ? window.calculateShanten(testHand, player.melds.length) : 99;
    if (s === -1 && !player.furiten) {
      const scoreRes = calcScoreSafe({
        hand: player.hand,
        winTile: tile,
        isTsumo: false,
        isDealer: (player.seatWind === '1z'),
        melds: player.melds,
        options: {
          isRiichi: player.isRiichi,
          isIppatsu: player.ippatsu,
          roundWind: game.roundWind,
          seatWind: player.seatWind,
          doraCount: countDora(testHand, game.doraIndicators),
          uraDoraCount: player.isRiichi ? countDora(testHand, game.uraDoraIndicators) : 0,
          honba: game.honba
        }
      });
      if (scoreRes && scoreRes.han >= 1) {
        canRon = true;
      }
    }

    // 鳴き判定 (リーチ中は不可)
    if (!player.isRiichi) {
      // ポン判定 (同じ牌が2枚以上)
      const raw = window.normalizeTile ? window.normalizeTile(tile) : tile;
      const sameCount = player.hand.filter(t => (window.normalizeTile ? window.normalizeTile(t) : t) === raw).length;
      if (sameCount >= 2) canPon = true;

      // チー判定 (上家からの打牌のみ)
      if (discarderIdx === 3 && raw[1] !== 'z') {
        canChi = checkCanChi(player.hand, raw);
      }
    }

    if (canRon || canPon || canChi) {
      if (canRon) DOM.btnActionRon.style.display = 'inline-block';
      if (canPon) DOM.btnActionPon.style.display = 'inline-block';
      if (canChi) DOM.btnActionChi.style.display = 'inline-block';
      DOM.btnActionPass.style.display = 'inline-block';
      DOM.gameActionBar.style.display = 'flex';

      game.pendingActions = {
        type: 'discard',
        discarderIdx,
        tile,
        canRon,
        canPon,
        canChi
      };
      return true;
    }

    return false;
  }

  function checkCanChi(hand, rawTile) {
    const suit = rawTile[1];
    const num = parseInt(rawTile[0], 10);
    const nums = hand
      .map(t => window.normalizeTile ? window.normalizeTile(t) : t)
      .filter(t => t[1] === suit)
      .map(t => parseInt(t[0], 10));

    // (num-2, num-1), (num-1, num+1), (num+1, num+2)
    const has = n => nums.includes(n);
    if (has(num - 2) && has(num - 1)) return true;
    if (has(num - 1) && has(num + 1)) return true;
    if (has(num + 1) && has(num + 2)) return true;
    return false;
  }

  /**
   * CPUのロンチェック
   */
  function checkCpuRon(cpu, tile) {
    const testHand = [...cpu.hand, tile];
    const s = window.calculateShanten ? window.calculateShanten(testHand, cpu.melds.length) : 99;
    if (s === -1) {
      const scoreRes = calcScoreSafe({
        hand: cpu.hand,
        winTile: tile,
        isTsumo: false,
        isDealer: (cpu.seatWind === '1z'),
        melds: cpu.melds,
        options: {
          isRiichi: cpu.isRiichi,
          isIppatsu: cpu.ippatsu,
          roundWind: game.roundWind,
          seatWind: cpu.seatWind,
          doraCount: countDora(testHand, game.doraIndicators),
          uraDoraCount: cpu.isRiichi ? countDora(testHand, game.uraDoraIndicators) : 0,
          honba: game.honba
        }
      });
      if (scoreRes && scoreRes.han >= 1) {
        handleAgari(cpu.idx, game.lastDiscarder, tile, false, scoreRes);
        return true;
      }
    }
    return false;
  }

  /**
   * 次の手番へ進む
   */
  function proceedToNextTurn() {
    // 全員のイッパツフラグをクリア
    game.players.forEach(p => { p.ippatsu = false; });

    // 残り牌山チェック (流局判定)
    if (game.wall.length === 0) {
      handleRyukyoku();
      return;
    }

    const nextPlayer = (game.lastDiscarder + 1) % 4;
    const nextTile = game.wall.shift();
    executeTurn(nextPlayer, nextTile);
  }

  /**
   * プレイヤーのアクション選択処理
   */
  function handlePlayerAction(action) {
    const pending = game.pendingActions;
    hideActionBar();
    game.pendingActions = null;

    if (!pending) return;

    if (action === 'pass') {
      if (pending.type === 'discard') {
        proceedToNextTurn();
      }
      return;
    }

    if (action === 'tsumo') {
      const player = game.players[0];
      const fullHand = [...player.hand, player.tsumoTile];
      const scoreRes = calcScoreSafe({
        hand: player.hand,
        winTile: player.tsumoTile,
        isTsumo: true,
        isDealer: (player.seatWind === '1z'),
        melds: player.melds,
        options: {
          isRiichi: player.isRiichi,
          isIppatsu: player.ippatsu,
          roundWind: game.roundWind,
          seatWind: player.seatWind,
          doraCount: countDora(fullHand, game.doraIndicators),
          uraDoraCount: player.isRiichi ? countDora(fullHand, game.uraDoraIndicators) : 0,
          honba: game.honba
        }
      });
      handleAgari(0, -1, player.tsumoTile, true, scoreRes);
      return;
    }

    if (action === 'ron') {
      const player = game.players[0];
      const fullHand = [...player.hand, pending.tile];
      const scoreRes = calcScoreSafe({
        hand: player.hand,
        winTile: pending.tile,
        isTsumo: false,
        isDealer: (player.seatWind === '1z'),
        melds: player.melds,
        options: {
          isRiichi: player.isRiichi,
          isIppatsu: player.ippatsu,
          roundWind: game.roundWind,
          seatWind: player.seatWind,
          doraCount: countDora(fullHand, game.doraIndicators),
          uraDoraCount: player.isRiichi ? countDora(fullHand, game.uraDoraIndicators) : 0,
          honba: game.honba
        }
      });
      handleAgari(0, pending.discarderIdx, pending.tile, false, scoreRes);
      return;
    }

    if (action === 'riichi') {
      declareRiichi(0);
      return;
    }

    if (action === 'pon') {
      executePlayerPon(pending.tile);
      return;
    }

    if (action === 'chi') {
      executePlayerChi(pending.tile);
      return;
    }
  }

  /**
   * ポン実行
   */
  function executePlayerPon(tile) {
    const player = game.players[0];
    const raw = window.normalizeTile ? window.normalizeTile(tile) : tile;

    // 手牌から同種牌を2枚取り出す
    const removed = [];
    for (let i = player.hand.length - 1; i >= 0 && removed.length < 2; i--) {
      const hRaw = window.normalizeTile ? window.normalizeTile(player.hand[i]) : player.hand[i];
      if (hRaw === raw) {
        removed.push(player.hand.splice(i, 1)[0]);
      }
    }

    player.melds.push({
      type: 'pon',
      tiles: [...removed, tile]
    });
    player.isMenzen = false;

    showGameToast('ポン！', 'blue');
    renderBoard();

    // 鳴いたプレイヤーが手牌から1枚打牌するターンへ
    game.currentTurn = 0;
    updatePlayerAssist();
  }

  /**
   * チー実行
   */
  function executePlayerChi(tile) {
    const player = game.players[0];
    const raw = window.normalizeTile ? window.normalizeTile(tile) : tile;
    const suit = raw[1];
    const num = parseInt(raw[0], 10);

    // 順子を作れる2枚を手牌から選択
    const findTile = n => player.hand.find(t => (window.normalizeTile ? window.normalizeTile(t) : t) === `${n}${suit}`);
    let pair = null;

    if (findTile(num - 1) && findTile(num + 1)) pair = [findTile(num - 1), findTile(num + 1)];
    else if (findTile(num - 2) && findTile(num - 1)) pair = [findTile(num - 2), findTile(num - 1)];
    else if (findTile(num + 1) && findTile(num + 2)) pair = [findTile(num + 1), findTile(num + 2)];

    if (pair) {
      player.hand.splice(player.hand.indexOf(pair[0]), 1);
      player.hand.splice(player.hand.indexOf(pair[1]), 1);

      player.melds.push({
        type: 'chi',
        tiles: [pair[0], tile, pair[1]]
      });
      player.isMenzen = false;

      showGameToast('チー！', 'blue');
      renderBoard();

      game.currentTurn = 0;
      updatePlayerAssist();
    }
  }

  /**
   * 和了（アガリ）処理
   */
  function handleAgari(winnerIdx, loserIdx, winTile, isTsumo, scoreRes) {
    const winner = game.players[winnerIdx];
    const totalPoints = scoreRes.points || (scoreRes.han >= 5 ? 8000 : 3900);

    // 点棒の移動
    if (isTsumo) {
      // ツモ和了: 他の3名から分配徴収
      const isOya = (winner.seatWind === '1z');
      game.players.forEach(p => {
        if (p.idx !== winnerIdx) {
          const pay = isOya
            ? Math.ceil(totalPoints / 3 / 100) * 100
            : (p.seatWind === '1z' ? Math.ceil(totalPoints / 2 / 100) * 100 : Math.ceil(totalPoints / 4 / 100) * 100);
          p.score -= pay;
        }
      });
      winner.score += totalPoints + (game.riichiSticks * 1000);
    } else {
      // ロン和了: 放銃者から全額徴収
      const loser = game.players[loserIdx];
      loser.score -= totalPoints;
      winner.score += totalPoints + (game.riichiSticks * 1000);
    }
    game.riichiSticks = 0;

    // 親の連荘判定 (勝者が親なら連荘)
    game.lastRoundRenchan = (winner.seatWind === '1z');

    // リザルトモーダル表示
    showAgariModal(winner, loserIdx, winTile, isTsumo, scoreRes);
  }

  /**
   * 流局（荒廃流局）処理
   */
  function handleRyukyoku() {
    showGameToast('流局（荒野流局）', 'orange');

    // 各自のテンパイ判定
    const tenpaiPlayers = [];
    const notenPlayers = [];

    game.players.forEach(p => {
      const s = window.calculateShanten ? window.calculateShanten(p.hand, p.melds.length) : 99;
      if (s === 0) tenpaiPlayers.push(p);
      else notenPlayers.push(p);
    });

    // ノーテン罰符 (場に3,000点)
    if (tenpaiPlayers.length > 0 && tenpaiPlayers.length < 4) {
      const receive = 3000 / tenpaiPlayers.length;
      const pay = 3000 / notenPlayers.length;
      notenPlayers.forEach(p => { p.score -= pay; });
      tenpaiPlayers.forEach(p => { p.score += receive; });
    }

    // 親がテンパイしていれば連荘、ノーテンなら親流れ
    const oya = game.players[game.dealerIdx];
    game.lastRoundRenchan = tenpaiPlayers.includes(oya);

    showRyukyokuModal(tenpaiPlayers, notenPlayers);
  }

  /**
   * 次の局へ進む
   */
  function advanceRound(isRenchan) {
    if (isRenchan) {
      game.honba += 1;
    } else {
      game.roundNum += 1;
      game.honba = 0;
      game.dealerIdx = (game.dealerIdx + 1) % 4;
    }

    // 東4局終了時 (東風戦完了)
    if (game.roundNum >= 4) {
      showFinalGameSetModal();
      return;
    }

    startRound();
  }

  /**
   * 和了結果モーダルの表示
   */
  function showAgariModal(winner, loserIdx, winTile, isTsumo, scoreRes) {
    if (!DOM.gameResultModal) return;

    DOM.resultModalTitle.textContent = isTsumo ? '🀄️ ツモ和了（ツモアガリ）！' : '🀄️ ロン和了（栄和）！';
    DOM.resultWinnerAvatar.textContent = winner.avatar;
    DOM.resultWinnerName.textContent = winner.name;
    DOM.resultAgariType.textContent = isTsumo ? '門前清自摸和' : `放銃: ${PLAYER_NAMES[loserIdx]}`;

    // 和了手牌の描画
    DOM.resultHandTiles.innerHTML = '';
    const fullHand = [...winner.hand];
    sortHand(fullHand);
    fullHand.forEach(t => {
      const el = createTileDom(t, false);
      DOM.resultHandTiles.appendChild(el);
    });

    // 和了牌
    const winEl = createTileDom(winTile, false);
    winEl.classList.add('agari-tile');
    DOM.resultHandTiles.appendChild(winEl);

    // ドラ表示牌
    DOM.resultDoraTiles.innerHTML = '';
    game.doraIndicators.forEach(t => {
      DOM.resultDoraTiles.appendChild(createTileDom(t, true));
    });

    // 成立役リスト
    DOM.resultYakuList.innerHTML = '';
    (scoreRes.yaku || []).forEach(y => {
      const li = document.createElement('li');
      li.className = 'yaku-badge-item';
      li.innerHTML = `<span class="yaku-name">${y.name}</span><span class="yaku-han">${y.han}翻</span>`;
      DOM.resultYakuList.appendChild(li);
    });

    // 点数
    DOM.resultScorePoints.textContent = `${(scoreRes.points || 0).toLocaleString()} 点`;
    DOM.resultScoreRank.textContent = scoreRes.rank || '和了';
    DOM.resultScoreDetails.textContent = `${scoreRes.han || 0}翻 ${scoreRes.fu || 0}符 (本場加算含む)`;

    DOM.gameResultModal.classList.remove('hidden');
  }

  /**
   * 流局モーダル表示
   */
  function showRyukyokuModal(tenpais, notens) {
    if (!DOM.gameResultModal) return;

    DOM.resultModalTitle.textContent = '💨 流局（荒野流局）';
    DOM.resultWinnerAvatar.textContent = '⚖️';
    DOM.resultWinnerName.textContent = '牌山終了';
    DOM.resultAgariType.textContent = `テンパイ: ${tenpais.map(p => p.name).join(', ') || 'なし'}`;

    DOM.resultHandTiles.innerHTML = '';
    DOM.resultDoraTiles.innerHTML = '';
    DOM.resultYakuList.innerHTML = '<li class="yaku-badge-item">ノーテン罰符授受（計3,000点）</li>';
    DOM.resultScorePoints.textContent = '流局';
    DOM.resultScoreRank.textContent = game.lastRoundRenchan ? '親連荘' : '親流れ';
    DOM.resultScoreDetails.textContent = `本場: ${game.honba} / 供託: ${game.riichiSticks * 1000}点`;

    DOM.gameResultModal.classList.remove('hidden');
  }

  /**
   * 終局（東風戦終了）モーダル
   */
  function showFinalGameSetModal() {
    // 持ち点順位ソート
    const ranking = [...game.players].sort((a, b) => b.score - a.score);

    DOM.resultModalTitle.textContent = '🏆 対局終了（終局）';
    DOM.resultWinnerAvatar.textContent = ranking[0].avatar;
    DOM.resultWinnerName.textContent = `優勝: ${ranking[0].name}`;
    DOM.resultAgariType.textContent = '東風戦 全4局 終了';

    DOM.resultHandTiles.innerHTML = '';
    DOM.resultYakuList.innerHTML = ranking.map((p, rank) => `
      <li class="yaku-badge-item" style="justify-content: space-between;">
        <span>第${rank + 1}位: ${p.avatar} ${p.name}</span>
        <strong>${p.score.toLocaleString()} 点</strong>
      </li>
    `).join('');

    DOM.resultScorePoints.textContent = `${ranking[0].score.toLocaleString()} 点`;
    DOM.resultScoreRank.textContent = 'ゲームセット';
    DOM.resultScoreDetails.textContent = ranking[0].idx === 0 ? 'おめでとうございます！見事勝利です！' : 'お疲れ様でした！次回リベンジしましょう！';

    DOM.btnNextRound.textContent = '新規対局を開始する';
    DOM.gameResultModal.classList.remove('hidden');
  }

  function closeResultModal() {
    if (DOM.gameResultModal) DOM.gameResultModal.classList.add('hidden');
    if (DOM.btnNextRound) DOM.btnNextRound.textContent = '次の局へ進む';
  }

  /**
   * ボード全体（手牌・河・点数・ドラ）の描画
   */
  function renderBoard() {
    // 卓情報
    const roundLabels = ['東1局', '東2局', '東3局', '東4局'];
    const currentRoundLabel = roundLabels[game.roundNum] || '東風戦';

    if (DOM.gameRoundName) DOM.gameRoundName.textContent = currentRoundLabel;
    if (DOM.centerRoundText) DOM.centerRoundText.textContent = currentRoundLabel;
    if (DOM.gameHonbaBadge) DOM.gameHonbaBadge.textContent = `${game.honba}本場`;
    if (DOM.gameRiichiSticks) DOM.gameRiichiSticks.textContent = `供託: ${game.riichiSticks * 1000}点`;
    if (DOM.gameRemainingWall) DOM.gameRemainingWall.textContent = game.wall.length;

    // ドラ表示牌
    if (DOM.gameDoraTile) {
      DOM.gameDoraTile.innerHTML = '';
      if (game.doraIndicators[0]) {
        DOM.gameDoraTile.appendChild(createTileDom(game.doraIndicators[0], false));
      }
    }

    // ターンインジケータ
    if (DOM.turnIndicator) {
      DOM.turnIndicator.textContent = `${PLAYER_NAMES[game.currentTurn]} の手番`;
      DOM.turnIndicator.className = `turn-indicator ${game.currentTurn === 0 ? 'turn-jibun' : ''}`;
    }

    // 点数表示
    if (DOM.scoreJibun) DOM.scoreJibun.textContent = game.players[0].score.toLocaleString();
    if (DOM.scoreShimocha) DOM.scoreShimocha.textContent = game.players[1].score.toLocaleString();
    if (DOM.scoreToimen) DOM.scoreToimen.textContent = game.players[2].score.toLocaleString();
    if (DOM.scoreKamicha) DOM.scoreKamicha.textContent = game.players[3].score.toLocaleString();

    // リーチフラグ
    if (DOM.riichiFlagJibun) DOM.riichiFlagJibun.style.display = game.players[0].isRiichi ? 'inline-block' : 'none';
    if (DOM.riichiFlagShimocha) DOM.riichiFlagShimocha.style.display = game.players[1].isRiichi ? 'inline-block' : 'none';
    if (DOM.riichiFlagToimen) DOM.riichiFlagToimen.style.display = game.players[2].isRiichi ? 'inline-block' : 'none';
    if (DOM.riichiFlagKamicha) DOM.riichiFlagKamicha.style.display = game.players[3].isRiichi ? 'inline-block' : 'none';

    // 河（捨て牌）の描画
    renderKawa(0, DOM.kawaJibun);
    renderKawa(1, DOM.kawaShimocha);
    renderKawa(2, DOM.kawaToimen);
    renderKawa(3, DOM.kawaKamicha);

    // 敵手牌（伏せ牌）の描画
    renderEnemyHand(1, DOM.handShimocha);
    renderEnemyHand(2, DOM.handToimen);
    renderEnemyHand(3, DOM.handKamicha);

    // 自分の手牌の描画
    renderPlayerHand();
  }

  /**
   * 自分の手牌描画
   */
  function renderPlayerHand() {
    const player = game.players[0];
    if (!DOM.jibunHandTiles) return;

    DOM.jibunHandTiles.innerHTML = '';
    DOM.jibunTsumoTile.innerHTML = '';

    player.hand.forEach((tile, idx) => {
      const tileEl = createTileDom(tile, false);
      tileEl.addEventListener('click', () => {
        if (game.currentTurn === 0 && !player.isRiichi) {
          handleDiscardTile(0, tile, false);
        }
      });
      DOM.jibunHandTiles.appendChild(tileEl);
    });

    // ツモ牌（手牌の右側に少し隙間を空けて配置）
    if (player.tsumoTile) {
      const tsumoEl = createTileDom(player.tsumoTile, false);
      tsumoEl.classList.add('tsumo-highlight');
      tsumoEl.addEventListener('click', () => {
        if (game.currentTurn === 0) {
          handleDiscardTile(0, player.tsumoTile, true);
        }
      });
      DOM.jibunTsumoTile.appendChild(tsumoEl);
    }

    // 副露（鳴き牌）
    if (DOM.jibunMelds) {
      DOM.jibunMelds.innerHTML = '';
      player.melds.forEach(m => {
        const meldWrap = document.createElement('div');
        meldWrap.className = 'meld-group';
        m.tiles.forEach(t => meldWrap.appendChild(createTileDom(t, true)));
        DOM.jibunMelds.appendChild(meldWrap);
      });
    }
  }

  /**
   * 敵の伏せ牌描画
   */
  function renderEnemyHand(playerIdx, container) {
    if (!container) return;
    const player = game.players[playerIdx];
    container.innerHTML = '';
    const totalCount = player.hand.length + (player.tsumoTile ? 1 : 0);

    for (let i = 0; i < totalCount; i++) {
      const backTile = document.createElement('div');
      backTile.className = 'mj-tile tile-back';
      container.appendChild(backTile);
    }
  }

  /**
   * 河（捨て牌）の描画
   */
  function renderKawa(playerIdx, container) {
    if (!container) return;
    const player = game.players[playerIdx];
    container.innerHTML = '';

    player.kawa.forEach(item => {
      const tileEl = createTileDom(item.tile, true);
      if (item.isRiichi) tileEl.classList.add('is-riichi-tile');
      container.appendChild(tileEl);
    });
  }

  /**
   * プレイヤー向けアシストバー（向聴数・待ち牌表示）
   */
  function updatePlayerAssist() {
    if (!game.isAssisting || !DOM.gameAssistBar) return;
    const player = game.players[0];
    const fullHand = player.tsumoTile ? [...player.hand, player.tsumoTile] : [...player.hand];

    const shanten = window.calculateShanten ? window.calculateShanten(fullHand, player.melds.length) : 99;

    if (shanten === -1) {
      DOM.gameAssistShanten.textContent = '和了（アガリ）形成立！';
      DOM.gameAssistShanten.style.background = '#dc2626';
      DOM.gameAssistWaits.innerHTML = 'ツモまたはロンボタンを押してください';
    } else if (shanten === 0) {
      DOM.gameAssistShanten.textContent = '🎯 テンパイ中！';
      DOM.gameAssistShanten.style.background = '#10b981';

      // 待ち牌の解析
      if (window.analyzeWaits) {
        const waits = window.analyzeWaits(player.hand, player.melds);
        DOM.gameAssistWaits.innerHTML = '待ち牌: ' + waits.map(w => `<span class="assist-wait-chip">${w.name} (${w.leftCount}枚)</span>`).join(' ');
      }
    } else {
      DOM.gameAssistShanten.textContent = `${shanten} 向聴（シャンテン）`;
      DOM.gameAssistShanten.style.background = '#047857';
      DOM.gameAssistWaits.textContent = '手牌をタップして打牌してください';
    }
  }

  function hideActionBar() {
    if (DOM.gameActionBar) {
      DOM.gameActionBar.style.display = 'none';
      DOM.btnActionRon.style.display = 'none';
      DOM.btnActionTsumo.style.display = 'none';
      DOM.btnActionRiichi.style.display = 'none';
      DOM.btnActionPon.style.display = 'none';
      DOM.btnActionChi.style.display = 'none';
      DOM.btnActionKan.style.display = 'none';
    }
  }

  function createTileDom(tileKey, isSmall) {
    const wrap = document.createElement('div');
    wrap.innerHTML = window.renderTileHtml ? window.renderTileHtml(tileKey, { isSmall }) : `<div class="mj-tile">${tileKey}</div>`;
    return wrap.firstElementChild;
  }

  function calcScoreSafe(input) {
    if (window.calculateScore) {
      try {
        return window.calculateScore(input);
      } catch (err) {
        console.error('Score calculation error:', err);
      }
    }
    return { points: 8000, han: 4, fu: 40, rank: '満貫', yaku: [{ name: '満貫', han: 4 }] };
  }

  function countDora(tiles, indicators) {
    let count = 0;
    indicators.forEach(ind => {
      const target = getNextDoraTile(ind);
      tiles.forEach(t => {
        const raw = window.normalizeTile ? window.normalizeTile(t) : t;
        if (raw === target) count++;
        if (t.endsWith('r')) count++; // 赤ドラ
      });
    });
    return count;
  }

  function getNextDoraTile(ind) {
    const raw = window.normalizeTile ? window.normalizeTile(ind) : ind;
    const suit = raw[1];
    const num = parseInt(raw[0], 10);
    if (suit === 'z') {
      if (num <= 4) return `${(num % 4) + 1}z`; // 東->南->西->北->東
      return `${((num - 5 + 1) % 3) + 5}z`; // 白->發->中->白
    }
    return `${(num % 9) + 1}${suit}`;
  }

  function showGameToast(msg, color = 'green') {
    const toast = document.createElement('div');
    toast.className = `game-toast toast-${color}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 1800);
  }

  // グローバル公開
  window.MahjongGame = {
    init,
    startNewGame,
    isInitialized: false
  };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
