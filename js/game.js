/**
 * 雀聖AI - 本格麻雀CPU対戦ゲームエンジン
 * (東風戦 / 半荘戦, 4人麻雀 / 3人麻雀, 3D立体視点対応)
 */

(function(window) {
  'use strict';

  const PLAYER_NAMES = ['あなた', 'CPU 葵 (アオイ)', 'CPU 蓮 (レン)', 'CPU 龍馬 (リョウマ)'];
  const PLAYER_AVATARS = ['🧑', '👩‍💼', '🧑‍💻', '🧓'];
  const KAZE_TILES = ['1z', '2z', '3z', '4z'];

  // ゲーム状態
  const game = {
    isInitialized: false,
    isActive: false,

    // ルール設定
    playerCount: 4,      // 4: 四人麻雀, 3: 三人麻雀 (サンマ)
    matchLength: 'tonpuu', // 'tonpuu': 東風戦, 'hanchan': 半荘戦
    is3D: true,          // 3D立体視点 ON/OFF

    roundWind: '1z',     // '1z': 東場, '2z': 南場
    roundNum: 0,         // 通算局インデックス (0..)
    dealerIdx: 0,        // 親のプレイヤーインデックス
    honba: 0,            // 本場数
    riichiSticks: 0,     // 供託リーチ棒数
    wall: [],            // 牌山
    deadWall: [],        // 王牌 (14枚)
    doraIndicators: [],  // 表ドラ表示牌
    uraDoraIndicators: [], // 裏ドラ表示牌
    players: [],         // プレイヤーリスト
    currentTurn: 0,      // 手番インデックス
    lastDrawnTile: null, // 直前のツモ牌
    lastDiscardedTile: null, // 直前の打牌
    lastDiscarder: -1,   // 直前の打牌者
    pendingActions: null,// アクション待ち状態
    isAssisting: true,   // 待ち牌アシスト表示
    turnTimer: null      // CPUターンタイマー
  };

  let DOM = {};

  function cacheDom() {
    DOM = {
      mahjongTableMat: document.getElementById('mahjongTableMat'),
      segPlayerCount: document.getElementById('segPlayerCount'),
      segMatchLength: document.getElementById('segMatchLength'),
      btnToggle3D: document.getElementById('btnToggle3D'),

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
      seatToimen: document.getElementById('seatToimen'),
      seatKamicha: document.getElementById('seatKamicha'),
      seatShimocha: document.getElementById('seatShimocha'),

      kazeJibun: document.getElementById('kazeJibun'),
      kazeShimocha: document.getElementById('kazeShimocha'),
      kazeToimen: document.getElementById('kazeToimen'),
      kazeKamicha: document.getElementById('kazeKamicha'),

      scoreJibun: document.getElementById('scoreJibun'),
      scoreShimocha: document.getElementById('scoreShimocha'),
      scoreToimen: document.getElementById('scoreToimen'),
      scoreKamicha: document.getElementById('scoreKamicha'),

      riichiFlagJibun: document.getElementById('riichiFlagJibun'),
      riichiFlagShimocha: document.getElementById('riichiFlagShimocha'),
      riichiFlagToimen: document.getElementById('riichiFlagToimen'),
      riichiFlagKamicha: document.getElementById('riichiFlagKamicha'),

      // 河
      kawaJibun: document.getElementById('kawaJibun'),
      kawaShimocha: document.getElementById('kawaShimocha'),
      kawaToimen: document.getElementById('kawaToimen'),
      kawaKamicha: document.getElementById('kawaKamicha'),

      // 敵手牌
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

  function init() {
    cacheDom();
    setupEvents();
    game.isInitialized = true;
    startNewGame();
  }

  function setupEvents() {
    // 1. 人数切替 (4人 / 3人)
    if (DOM.segPlayerCount) {
      DOM.segPlayerCount.querySelectorAll('.rule-seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const count = parseInt(btn.getAttribute('data-players'), 10);
          if (game.playerCount === count) return;
          DOM.segPlayerCount.querySelectorAll('.rule-seg-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          game.playerCount = count;
          startNewGame();
        });
      });
    }

    // 2. 局数切替 (東風戦 / 半荘戦)
    if (DOM.segMatchLength) {
      DOM.segMatchLength.querySelectorAll('.rule-seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const len = btn.getAttribute('data-length');
          if (game.matchLength === len) return;
          DOM.segMatchLength.querySelectorAll('.rule-seg-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          game.matchLength = len;
          startNewGame();
        });
      });
    }

    // 3. 3D立体視点 ON/OFF 切替
    if (DOM.btnToggle3D) {
      DOM.btnToggle3D.addEventListener('click', () => {
        game.is3D = !game.is3D;
        update3DView();
      });
    }

    // 新規対局ボタン
    if (DOM.btnNewGame) {
      DOM.btnNewGame.addEventListener('click', () => {
        if (confirm('現在の対局をリセットして新規対局を開始しますか？')) {
          startNewGame();
        }
      });
    }

    // アシストバーON/OFF
    if (DOM.btnToggleAssist) {
      DOM.btnToggleAssist.addEventListener('click', () => {
        game.isAssisting = !game.isAssisting;
        DOM.btnToggleAssist.textContent = `💡 アシスト: ${game.isAssisting ? 'ON' : 'OFF'}`;
        DOM.gameAssistBar.style.display = game.isAssisting ? 'flex' : 'none';
        if (game.isAssisting) updatePlayerAssist();
      });
    }

    // アクションボタン
    if (DOM.btnActionPass) DOM.btnActionPass.addEventListener('click', () => handlePlayerAction('pass'));
    if (DOM.btnActionRon) DOM.btnActionRon.addEventListener('click', () => handlePlayerAction('ron'));
    if (DOM.btnActionTsumo) DOM.btnActionTsumo.addEventListener('click', () => handlePlayerAction('tsumo'));
    if (DOM.btnActionRiichi) DOM.btnActionRiichi.addEventListener('click', () => handlePlayerAction('riichi'));
    if (DOM.btnActionPon) DOM.btnActionPon.addEventListener('click', () => handlePlayerAction('pon'));
    if (DOM.btnActionChi) DOM.btnActionChi.addEventListener('click', () => handlePlayerAction('chi'));
    if (DOM.btnActionKan) DOM.btnActionKan.addEventListener('click', () => handlePlayerAction('kan'));

    // 次の局へ
    if (DOM.btnNextRound) {
      DOM.btnNextRound.addEventListener('click', () => {
        closeResultModal();
        advanceRound(game.lastRoundRenchan);
      });
    }
  }

  function update3DView() {
    if (!DOM.mahjongTableMat) return;
    if (game.is3D) {
      DOM.mahjongTableMat.classList.add('mode-3d');
      DOM.mahjongTableMat.classList.remove('mode-2d');
      DOM.btnToggle3D.classList.add('active');
      DOM.btnToggle3D.innerHTML = '<span class="icon-3d">🎮</span> 3D立体視: ON';
    } else {
      DOM.mahjongTableMat.classList.remove('mode-3d');
      DOM.mahjongTableMat.classList.add('mode-2d');
      DOM.btnToggle3D.classList.remove('active');
      DOM.btnToggle3D.innerHTML = '<span class="icon-3d">📐</span> 2Dフラット: OFF';
    }
  }

  /**
   * 新規対局開始
   */
  function startNewGame() {
    clearTimeout(game.turnTimer);
    game.roundWind = '1z'; // 東場から開始
    game.roundNum = 0;
    game.dealerIdx = 0;    // あなたが東1局の親
    game.honba = 0;
    game.riichiSticks = 0;

    const startPts = (game.playerCount === 3) ? 35000 : 25000;

    // プレイヤーの初期化 (3人または4人)
    game.players = [];
    for (let i = 0; i < game.playerCount; i++) {
      game.players.push(createPlayer(i, PLAYER_NAMES[i], PLAYER_AVATARS[i], startPts));
    }

    // 3人麻雀時の座席表示切替（上家/対面）
    adjustSeatsForPlayerCount();
    update3DView();

    const modeText = `${game.playerCount}人麻雀・${game.matchLength === 'tonpuu' ? '東風戦' : '半荘戦'}`;
    showGameToast(`新規対局開始: ${modeText}`, 'gold');

    startRound();
  }

  function adjustSeatsForPlayerCount() {
    if (DOM.seatKamicha) {
      // 3人麻雀の場合、上家（龍馬）を卓から外し、あなた・葵・レンの3名でプレイ
      DOM.seatKamicha.style.display = (game.playerCount === 3) ? 'none' : 'flex';
    }
    if (DOM.mahjongTableMat) {
      DOM.mahjongTableMat.classList.toggle('sanma-mode', game.playerCount === 3);
    }
  }

  function createPlayer(idx, name, avatar, score) {
    return {
      idx,
      name,
      avatar,
      score,
      seatWind: '1z',
      hand: [],
      tsumoTile: null,
      kawa: [],
      melds: [],
      isRiichi: false,
      isDoubleRiichi: false,
      ippatsu: false,
      isMenzen: true,
      furiten: false
    };
  }

  /**
   * 1局の開始
   */
  function startRound() {
    clearTimeout(game.turnTimer);
    hideActionBar();
    closeResultModal();

    // 自風の設定
    for (let i = 0; i < game.playerCount; i++) {
      const windOffset = (i - game.dealerIdx + game.playerCount) % game.playerCount;
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

    // 牌山生成（3人麻雀は萬子の2〜8を除外）
    buildWall();

    // 王牌 14枚
    game.deadWall = game.wall.splice(game.wall.length - 14, 14);
    game.doraIndicators = [game.deadWall[4]];
    game.uraDoraIndicators = [game.deadWall[9]];

    // 配牌 (各13枚)
    for (let i = 0; i < game.playerCount; i++) {
      game.players[i].hand = game.wall.splice(0, 13);
      sortHand(game.players[i].hand);
    }

    // 親の第1ツモ
    game.currentTurn = game.dealerIdx;
    const firstTsumo = game.wall.shift();

    renderBoard();
    updatePlayerAssist();

    executeTurn(game.dealerIdx, firstTsumo);
  }

  /**
   * 牌山生成 (4人: 136枚, 3人: 108枚)
   */
  function buildWall() {
    const wall = [];
    const isSanma = (game.playerCount === 3);

    const baseTiles = [
      '1m', '9m',
      '1p','2p','3p','4p','5p','6p','7p','8p','9p',
      '1s','2s','3s','4s','5s','6s','7s','8s','9s',
      '1z','2z','3z','4z','5z','6z','7z'
    ];

    // 4人麻雀は 2萬〜8萬 を追加
    if (!isSanma) {
      baseTiles.push('2m','3m','4m','5m','6m','7m','8m');
    }

    baseTiles.forEach(tile => {
      for (let i = 0; i < 4; i++) {
        if (!isSanma && tile === '5m' && i === 0) wall.push('5mr');
        else if (tile === '5p' && i === 0) wall.push('5pr');
        else if (tile === '5s' && i === 0) wall.push('5sr');
        else wall.push(tile);
      }
    });

    // シャッフル
    for (let i = wall.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wall[i], wall[j]] = [wall[j], wall[i]];
    }

    game.wall = wall;
  }

  function sortHand(hand) {
    const suitOrder = { 'm': 0, 'p': 1, 's': 2, 'z': 3 };
    hand.sort((a, b) => {
      const suitA = a[1];
      const suitB = b[1];
      if (suitOrder[suitA] !== suitOrder[suitB]) {
        return suitOrder[suitA] - suitOrder[suitB];
      }
      return parseInt(a[0], 10) - parseInt(b[0], 10);
    });
  }

  /**
   * 手番の実行
   */
  function executeTurn(playerIdx, drawnTile) {
    clearTimeout(game.turnTimer);
    game.currentTurn = playerIdx;
    game.lastDrawnTile = drawnTile;
    const player = game.players[playerIdx];
    player.tsumoTile = drawnTile;

    renderBoard();

    if (playerIdx === 0) {
      updatePlayerAssist();
      checkPlayerTsumoActions(drawnTile);
      return;
    }

    game.turnTimer = setTimeout(() => {
      cpuExecuteTurn(playerIdx, drawnTile);
    }, 450);
  }

  function checkPlayerTsumoActions(drawnTile) {
    const player = game.players[0];
    const fullHand = [...player.hand, drawnTile];
    let hasActions = false;

    // ツモ和了判定
    const shanten = window.calculateShanten ? window.calculateShanten(fullHand, player.melds.length) : 99;
    if (shanten === -1) {
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

    // リーチ判定
    if (!player.isRiichi && player.isMenzen && player.score >= 1000) {
      if (canRiichi(player.hand, drawnTile)) {
        DOM.btnActionRiichi.style.display = 'inline-block';
        hasActions = true;
      }
    }

    // カン判定
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

    if (player.isRiichi && !hasActions) {
      game.turnTimer = setTimeout(() => {
        handleDiscardTile(0, drawnTile, true);
      }, 350);
    }
  }

  function canRiichi(hand, drawnTile) {
    const fullHand = [...hand, drawnTile];
    for (let i = 0; i < fullHand.length; i++) {
      const testHand = fullHand.filter((_, idx) => idx !== i);
      const s = window.calculateShanten ? window.calculateShanten(testHand, 0) : 99;
      if (s === 0) return true;
    }
    return false;
  }

  function canAnkan(fullHand) {
    const counts = {};
    fullHand.forEach(t => {
      const raw = window.normalizeTile ? window.normalizeTile(t) : t;
      counts[raw] = (counts[raw] || 0) + 1;
    });
    return Object.values(counts).some(c => c === 4);
  }

  function cpuExecuteTurn(playerIdx, drawnTile) {
    const cpu = game.players[playerIdx];
    const fullHand = [...cpu.hand, drawnTile];

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
        handleAgari(playerIdx, -1, drawnTile, true, scoreRes);
        return;
      }
    }

    if (!cpu.isRiichi && cpu.isMenzen && cpu.score >= 1000) {
      if (canRiichi(cpu.hand, drawnTile) && Math.random() < 0.75) {
        declareRiichi(playerIdx);
      }
    }

    let discardTile = drawnTile;
    let isTsumogiri = true;

    if (cpu.isRiichi) {
      discardTile = drawnTile;
      isTsumogiri = true;
    } else {
      discardTile = chooseCpuBestDiscard(fullHand, cpu.melds.length);
      isTsumogiri = (discardTile === drawnTile);
    }

    handleDiscardTile(playerIdx, discardTile, isTsumogiri);
  }

  function chooseCpuBestDiscard(hand14, meldCount) {
    let minShanten = 99;
    const candidates = [];
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

    candidates.sort((a, b) => getDiscardSafetyScore(b) - getDiscardSafetyScore(a));
    return candidates[0] || hand14[hand14.length - 1];
  }

  function getDiscardSafetyScore(tile) {
    const raw = window.normalizeTile ? window.normalizeTile(tile) : tile;
    const suit = raw[1];
    const num = parseInt(raw[0], 10);
    if (suit === 'z') return 100;
    if (num === 1 || num === 9) return 50;
    if (num === 2 || num === 8) return 30;
    return 10;
  }

  function declareRiichi(playerIdx) {
    const player = game.players[playerIdx];
    player.isRiichi = true;
    player.ippatsu = true;
    player.score -= 1000;
    game.riichiSticks += 1;

    showGameToast(`${player.name} が立直（リーチ）！`, 'gold');
    renderBoard();
  }

  function handleDiscardTile(playerIdx, tile, isTsumogiri) {
    clearTimeout(game.turnTimer);
    hideActionBar();

    const player = game.players[playerIdx];

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

    player.kawa.push({
      tile,
      isRiichi: player.isRiichi && player.kawa.length === 0,
      isTsumogiri
    });

    game.lastDiscardedTile = tile;
    game.lastDiscarder = playerIdx;

    renderBoard();
    if (playerIdx === 0) updatePlayerAssist();

    checkOtherPlayersResponses(playerIdx, tile);
  }

  function checkOtherPlayersResponses(discarderIdx, tile) {
    // プレイヤーの反応チェック
    if (discarderIdx !== 0) {
      const player = game.players[0];
      if (checkPlayerResponsesToDiscard(player, discarderIdx, tile)) {
        return;
      }
    }

    // CPUのロンチェック
    for (let i = 1; i < game.playerCount; i++) {
      if (i === discarderIdx) continue;
      const cpu = game.players[i];
      if (checkCpuRon(cpu, tile)) {
        return;
      }
    }

    proceedToNextTurn();
  }

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
      if (scoreRes && scoreRes.han >= 1) canRon = true;
    }

    // 鳴き判定 (リーチ中は不可)
    if (!player.isRiichi) {
      const raw = window.normalizeTile ? window.normalizeTile(tile) : tile;
      const sameCount = player.hand.filter(t => (window.normalizeTile ? window.normalizeTile(t) : t) === raw).length;
      if (sameCount >= 2) canPon = true;

      // 4人麻雀の上家からのみチー可能 (3人麻雀はチー禁止)
      if (game.playerCount === 4 && discarderIdx === 3 && raw[1] !== 'z') {
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

    const has = n => nums.includes(n);
    return (has(num - 2) && has(num - 1)) || (has(num - 1) && has(num + 1)) || (has(num + 1) && has(num + 2));
  }

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

  function proceedToNextTurn() {
    game.players.forEach(p => { p.ippatsu = false; });

    if (game.wall.length === 0) {
      handleRyukyoku();
      return;
    }

    const nextPlayer = (game.lastDiscarder + 1) % game.playerCount;
    const nextTile = game.wall.shift();
    executeTurn(nextPlayer, nextTile);
  }

  function handlePlayerAction(action) {
    const pending = game.pendingActions;
    hideActionBar();
    game.pendingActions = null;

    if (!pending) return;

    if (action === 'pass') {
      if (pending.type === 'discard') proceedToNextTurn();
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

  function executePlayerPon(tile) {
    const player = game.players[0];
    const raw = window.normalizeTile ? window.normalizeTile(tile) : tile;
    const removed = [];

    for (let i = player.hand.length - 1; i >= 0 && removed.length < 2; i--) {
      const hRaw = window.normalizeTile ? window.normalizeTile(player.hand[i]) : player.hand[i];
      if (hRaw === raw) {
        removed.push(player.hand.splice(i, 1)[0]);
      }
    }

    player.melds.push({ type: 'pon', tiles: [...removed, tile] });
    player.isMenzen = false;

    showGameToast('ポン！', 'blue');
    renderBoard();
    game.currentTurn = 0;
    updatePlayerAssist();
  }

  function executePlayerChi(tile) {
    const player = game.players[0];
    const raw = window.normalizeTile ? window.normalizeTile(tile) : tile;
    const suit = raw[1];
    const num = parseInt(raw[0], 10);

    const findTile = n => player.hand.find(t => (window.normalizeTile ? window.normalizeTile(t) : t) === `${n}${suit}`);
    let pair = null;

    if (findTile(num - 1) && findTile(num + 1)) pair = [findTile(num - 1), findTile(num + 1)];
    else if (findTile(num - 2) && findTile(num - 1)) pair = [findTile(num - 2), findTile(num - 1)];
    else if (findTile(num + 1) && findTile(num + 2)) pair = [findTile(num + 1), findTile(num + 2)];

    if (pair) {
      player.hand.splice(player.hand.indexOf(pair[0]), 1);
      player.hand.splice(player.hand.indexOf(pair[1]), 1);

      player.melds.push({ type: 'chi', tiles: [pair[0], tile, pair[1]] });
      player.isMenzen = false;

      showGameToast('チー！', 'blue');
      renderBoard();
      game.currentTurn = 0;
      updatePlayerAssist();
    }
  }

  function handleAgari(winnerIdx, loserIdx, winTile, isTsumo, scoreRes) {
    const winner = game.players[winnerIdx];
    const totalPoints = scoreRes.points || (scoreRes.han >= 5 ? 8000 : 3900);

    if (isTsumo) {
      const otherCount = game.playerCount - 1;
      game.players.forEach(p => {
        if (p.idx !== winnerIdx) {
          const pay = Math.ceil(totalPoints / otherCount / 100) * 100;
          p.score -= pay;
        }
      });
      winner.score += totalPoints + (game.riichiSticks * 1000);
    } else {
      const loser = game.players[loserIdx];
      loser.score -= totalPoints;
      winner.score += totalPoints + (game.riichiSticks * 1000);
    }
    game.riichiSticks = 0;

    game.lastRoundRenchan = (winner.seatWind === '1z');
    showAgariModal(winner, loserIdx, winTile, isTsumo, scoreRes);
  }

  function handleRyukyoku() {
    showGameToast('流局（荒野流局）', 'orange');

    const tenpais = [];
    const notens = [];

    game.players.forEach(p => {
      const s = window.calculateShanten ? window.calculateShanten(p.hand, p.melds.length) : 99;
      if (s === 0) tenpais.push(p);
      else notens.push(p);
    });

    if (tenpais.length > 0 && tenpais.length < game.playerCount) {
      const receive = 3000 / tenpais.length;
      const pay = 3000 / notens.length;
      notens.forEach(p => { p.score -= pay; });
      tenpais.forEach(p => { p.score += receive; });
    }

    const oya = game.players[game.dealerIdx];
    game.lastRoundRenchan = tenpais.includes(oya);

    showRyukyokuModal(tenpais, notens);
  }

  /**
   * 局の進行（東風戦・半荘戦・人数に応じた局数判定）
   */
  function advanceRound(isRenchan) {
    const numPerWind = (game.playerCount === 3) ? 3 : 4;
    const maxRounds = (game.matchLength === 'hanchan') ? numPerWind * 2 : numPerWind;

    if (isRenchan) {
      game.honba += 1;
    } else {
      game.roundNum += 1;
      game.honba = 0;
      game.dealerIdx = (game.dealerIdx + 1) % game.playerCount;

      // 半荘戦で東場が終了した場合、南場へ移行
      if (game.matchLength === 'hanchan' && game.roundNum === numPerWind && game.roundWind === '1z') {
        game.roundWind = '2z';
        showGameToast('南入（ナンニュウ）！南場スタート', 'gold');
      }
    }

    // 規定局数完了でゲームセット
    if (game.roundNum >= maxRounds) {
      showFinalGameSetModal();
      return;
    }

    startRound();
  }

  function getCurrentRoundLabel() {
    const isSouth = (game.roundWind === '2z');
    const windChar = isSouth ? '南' : '東';
    const numPerWind = (game.playerCount === 3) ? 3 : 4;
    const localNum = (game.roundNum % numPerWind) + 1;
    return `${windChar}${localNum}局`;
  }

  function showAgariModal(winner, loserIdx, winTile, isTsumo, scoreRes) {
    if (!DOM.gameResultModal) return;

    DOM.resultModalTitle.textContent = isTsumo ? '🀄️ ツモ和了（ツモアガリ）！' : '🀄️ ロン和了（栄和）！';
    DOM.resultWinnerAvatar.textContent = winner.avatar;
    DOM.resultWinnerName.textContent = winner.name;
    DOM.resultAgariType.textContent = isTsumo ? '門前清自摸和' : `放銃: ${PLAYER_NAMES[loserIdx]}`;

    DOM.resultHandTiles.innerHTML = '';
    const fullHand = [...winner.hand];
    sortHand(fullHand);
    fullHand.forEach(t => DOM.resultHandTiles.appendChild(createTileDom(t, false)));

    const winEl = createTileDom(winTile, false);
    winEl.classList.add('agari-tile');
    DOM.resultHandTiles.appendChild(winEl);

    DOM.resultDoraTiles.innerHTML = '';
    game.doraIndicators.forEach(t => DOM.resultDoraTiles.appendChild(createTileDom(t, true)));

    DOM.resultYakuList.innerHTML = '';
    (scoreRes.yaku || []).forEach(y => {
      const li = document.createElement('li');
      li.className = 'yaku-badge-item';
      li.innerHTML = `<span class="yaku-name">${y.name}</span><span class="yaku-han">${y.han}翻</span>`;
      DOM.resultYakuList.appendChild(li);
    });

    DOM.resultScorePoints.textContent = `${(scoreRes.points || 0).toLocaleString()} 点`;
    DOM.resultScoreRank.textContent = scoreRes.rank || '和了';
    DOM.resultScoreDetails.textContent = `${scoreRes.han || 0}翻 ${scoreRes.fu || 0}符 (本場加算含む)`;

    DOM.gameResultModal.classList.remove('hidden');
  }

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

  function showFinalGameSetModal() {
    const ranking = [...game.players].sort((a, b) => b.score - a.score);

    DOM.resultModalTitle.textContent = '🏆 対局終了（終局）';
    DOM.resultWinnerAvatar.textContent = ranking[0].avatar;
    DOM.resultWinnerName.textContent = `優勝: ${ranking[0].name}`;
    DOM.resultAgariType.textContent = `${game.playerCount}人打・${game.matchLength === 'tonpuu' ? '東風戦' : '半荘戦'} 完了`;

    DOM.resultHandTiles.innerHTML = '';
    DOM.resultYakuList.innerHTML = ranking.map((p, rank) => `
      <li class="yaku-badge-item" style="justify-content: space-between;">
        <span>第${rank + 1}位: ${p.avatar} ${p.name}</span>
        <strong>${p.score.toLocaleString()} 点</strong>
      </li>
    `).join('');

    DOM.resultScorePoints.textContent = `${ranking[0].score.toLocaleString()} 点`;
    DOM.resultScoreRank.textContent = 'ゲームセット';
    DOM.resultScoreDetails.textContent = ranking[0].idx === 0 ? 'お見事！勝利おめでとうございます！' : '惜しい！次回リベンジを果たしましょう！';

    DOM.btnNextRound.textContent = '新規対局を開始する';
    DOM.gameResultModal.classList.remove('hidden');
  }

  function closeResultModal() {
    if (DOM.gameResultModal) DOM.gameResultModal.classList.add('hidden');
    if (DOM.btnNextRound) DOM.btnNextRound.textContent = '次の局へ進む';
  }

  function renderBoard() {
    const currentRoundLabel = getCurrentRoundLabel();

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

    // ターン表示
    if (DOM.turnIndicator) {
      DOM.turnIndicator.textContent = `${PLAYER_NAMES[game.currentTurn]} の手番`;
      DOM.turnIndicator.className = `turn-indicator ${game.currentTurn === 0 ? 'turn-jibun' : ''}`;
    }

    // 自風バッジ表示
    const kazeMap = { '1z': '東', '2z': '南', '3z': '西', '4z': '北' };
    if (DOM.kazeJibun && game.players[0]) DOM.kazeJibun.textContent = kazeMap[game.players[0].seatWind] || '東';
    if (DOM.kazeShimocha && game.players[1]) DOM.kazeShimocha.textContent = kazeMap[game.players[1].seatWind] || '南';
    if (DOM.kazeToimen && game.players[2]) DOM.kazeToimen.textContent = kazeMap[game.players[2].seatWind] || '西';
    if (DOM.kazeKamicha && game.players[3]) DOM.kazeKamicha.textContent = kazeMap[game.players[3].seatWind] || '北';

    // スコア
    if (DOM.scoreJibun && game.players[0]) DOM.scoreJibun.textContent = game.players[0].score.toLocaleString();
    if (DOM.scoreShimocha && game.players[1]) DOM.scoreShimocha.textContent = game.players[1].score.toLocaleString();
    if (DOM.scoreToimen && game.players[2]) DOM.scoreToimen.textContent = game.players[2].score.toLocaleString();
    if (DOM.scoreKamicha && game.players[3]) DOM.scoreKamicha.textContent = game.players[3].score.toLocaleString();

    // リーチフラグ
    if (DOM.riichiFlagJibun && game.players[0]) DOM.riichiFlagJibun.style.display = game.players[0].isRiichi ? 'inline-block' : 'none';
    if (DOM.riichiFlagShimocha && game.players[1]) DOM.riichiFlagShimocha.style.display = game.players[1].isRiichi ? 'inline-block' : 'none';
    if (DOM.riichiFlagToimen && game.players[2]) DOM.riichiFlagToimen.style.display = game.players[2].isRiichi ? 'inline-block' : 'none';
    if (DOM.riichiFlagKamicha && game.players[3]) DOM.riichiFlagKamicha.style.display = game.players[3].isRiichi ? 'inline-block' : 'none';

    // 河の描画
    renderKawa(0, DOM.kawaJibun);
    if (game.playerCount > 1) renderKawa(1, DOM.kawaShimocha);
    if (game.playerCount > 2) renderKawa(2, DOM.kawaToimen);
    if (game.playerCount > 3) renderKawa(3, DOM.kawaKamicha);

    // 敵手牌
    if (game.playerCount > 1) renderEnemyHand(1, DOM.handShimocha);
    if (game.playerCount > 2) renderEnemyHand(2, DOM.handToimen);
    if (game.playerCount > 3) renderEnemyHand(3, DOM.handKamicha);

    // 自分手牌
    renderPlayerHand();
  }

  function renderPlayerHand() {
    const player = game.players[0];
    if (!DOM.jibunHandTiles || !player) return;

    DOM.jibunHandTiles.innerHTML = '';
    DOM.jibunTsumoTile.innerHTML = '';

    player.hand.forEach(tile => {
      const tileEl = createTileDom(tile, false);
      tileEl.addEventListener('click', () => {
        if (game.currentTurn === 0 && !player.isRiichi) {
          handleDiscardTile(0, tile, false);
        }
      });
      DOM.jibunHandTiles.appendChild(tileEl);
    });

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

  function renderEnemyHand(playerIdx, container) {
    if (!container) return;
    const player = game.players[playerIdx];
    if (!player) return;
    container.innerHTML = '';
    const totalCount = player.hand.length + (player.tsumoTile ? 1 : 0);

    for (let i = 0; i < totalCount; i++) {
      const backTile = document.createElement('div');
      backTile.className = 'mj-tile tile-back';
      container.appendChild(backTile);
    }
  }

  function renderKawa(playerIdx, container) {
    if (!container) return;
    const player = game.players[playerIdx];
    if (!player) return;
    container.innerHTML = '';

    player.kawa.forEach(item => {
      const tileEl = createTileDom(item.tile, true);
      if (item.isRiichi) tileEl.classList.add('is-riichi-tile');
      container.appendChild(tileEl);
    });
  }

  function updatePlayerAssist() {
    if (!game.isAssisting || !DOM.gameAssistBar) return;
    const player = game.players[0];
    if (!player) return;
    const fullHand = player.tsumoTile ? [...player.hand, player.tsumoTile] : [...player.hand];

    const shanten = window.calculateShanten ? window.calculateShanten(fullHand, player.melds.length) : 99;

    if (shanten === -1) {
      DOM.gameAssistShanten.textContent = '和了（アガリ）形完成！';
      DOM.gameAssistShanten.style.background = '#dc2626';
      DOM.gameAssistWaits.innerHTML = 'ツモまたはロンボタンを押してください';
    } else if (shanten === 0) {
      DOM.gameAssistShanten.textContent = '🎯 テンパイ中！';
      DOM.gameAssistShanten.style.background = '#10b981';

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
        if (t.endsWith('r')) count++;
      });
    });
    return count;
  }

  function getNextDoraTile(ind) {
    const raw = window.normalizeTile ? window.normalizeTile(ind) : ind;
    const suit = raw[1];
    const num = parseInt(raw[0], 10);
    if (suit === 'z') {
      if (num <= 4) return `${(num % 4) + 1}z`;
      return `${((num - 5 + 1) % 3) + 5}z`;
    }
    // 3人麻雀で1mの次は9m
    if (game.playerCount === 3 && suit === 'm') {
      return (num === 1) ? '9m' : '1m';
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

  window.MahjongGame = {
    init,
    startNewGame,
    isInitialized: false
  };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
