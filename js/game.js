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
    rules: {
      akadora: true,     // 赤ドラ (赤5萬・赤5筒・赤5索) あり
      kuitan: true,      // 食いタン (喰い断) あり
      kuikae: true       // 喰い替え禁止 あり (true = 禁止する)
    },

    roundWind: '1z',     // '1z': 東場, '2z': 南場
    roundNum: 0,         // 通算局インデックス (0..)
    dealerIdx: 0,        // 親のプレイヤーインデックス
    honba: 0,            // 本場数
    riichiSticks: 0,     // 供託リーチ棒数
    discardSeq: 0,       // この局の通算打牌数 (天和・地和・ダブルリーチ判定用)
    kanCount: 0,         // この局のカン回数 (槓ドラ表示牌の参照用)
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
    pendingCpuRons: [],  // 打牌に対してロンできるCPU一覧 (ダブロン解決用)
    isAssisting: true,   // 待ち牌アシスト表示
    turnTimer: null,     // CPUターンタイマー

    // 演出用 (視覚・聴覚のみ。対局ロジックには影響しない)
    justDiscarded: null, // 直近の打牌 { playerIdx, seq, rendered } → 河の登場アニメ用
    kanDoraFlipPending: false, // 槓ドラが増えた直後の renderBoard でめくりアニメを付ける
    riichiSticksShown: 0 // 供託表示のポップアニメ判定用 (前回描画時の本数)
  };

  let DOM = {};

  // 効果音ヘルパー: sfx.js 未読込・非対応環境では無言で素通りする
  function sfx(name, arg) {
    try {
      if (window.MahjongSfx && typeof window.MahjongSfx.play === 'function') {
        window.MahjongSfx.play(name, arg);
      }
    } catch (e) { /* 効果音の失敗で対局を止めない */ }
  }

  // 点数カウントアップの世代トークン (閉じたら旧アニメを打ち切る)
  let scoreCountToken = 0;

  /**
   * 和了点数を 0 → 確定値まで約0.8秒でカウントアップ表示する。
   * requestAnimationFrame が無い環境・モーション軽減時は即座に最終値を表示。
   * 最終値は必ず正確な値で止まる。モーダルを閉じるとトークンで打ち切る。
   */
  function animateScoreCount(el, totalPoints) {
    if (!el) return;
    const finalText = `${(totalPoints || 0).toLocaleString()} 点`;
    const token = ++scoreCountToken;

    const reduceMotion = typeof window !== 'undefined' && window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || typeof requestAnimationFrame !== 'function') {
      el.textContent = finalText;
      return;
    }

    const duration = 800;
    const target = totalPoints || 0;
    const start = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
    const step = (now) => {
      if (token !== scoreCountToken) return; // 閉じられた/別の和了に切替
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      el.textContent = `${Math.round(target * eased).toLocaleString()} 点`;
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = finalText; // 最終値は必ず正確な値
      }
    };
    requestAnimationFrame(step);
  }

  function cacheDom() {
    DOM = {
      mahjongTableMat: document.getElementById('mahjongTableMat'),
      segPlayerCount: document.getElementById('segPlayerCount'),
      segMatchLength: document.getElementById('segMatchLength'),
      btnToggle3D: document.getElementById('btnToggle3D'),
      btnRuleAkadora: document.getElementById('btnRuleAkadora'),
      btnRuleKuitan: document.getElementById('btnRuleKuitan'),
      btnRuleKuikae: document.getElementById('btnRuleKuikae'),
      btnSfxToggle: document.getElementById('btnSfxToggle'),

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
      actionBarContext: document.getElementById('actionBarContext'),
      diceOverlay: document.getElementById('diceOverlay'),
      diceFace1: document.getElementById('diceFace1'),
      diceFace2: document.getElementById('diceFace2'),
      diceRoundLabel: document.getElementById('diceRoundLabel'),
      diceSumLabel: document.getElementById('diceSumLabel'),
      btnActionRon: document.getElementById('btnActionRon'),
      btnActionTsumo: document.getElementById('btnActionTsumo'),
      btnActionRiichi: document.getElementById('btnActionRiichi'),
      btnActionPon: document.getElementById('btnActionPon'),
      btnActionChi: document.getElementById('btnActionChi'),
      btnActionKan: document.getElementById('btnActionKan'),
      btnActionRyukyoku: document.getElementById('btnActionRyukyoku'),
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
      btnNextRound: document.getElementById('btnNextRound'),

      // カスタム確認ダイアログ
      confirmModal: document.getElementById('confirmModal'),
      confirmModalMessage: document.getElementById('confirmModalMessage'),
      btnConfirmOk: document.getElementById('btnConfirmOk'),
      btnConfirmCancel: document.getElementById('btnConfirmCancel')
    };
  }

  // ---------- 設定の保存 / 復元 (localStorage・sfx.js と同じ防御方式) ----------
  const SETTINGS_KEY = 'mahjong_game_settings_v1';

  function readStoredSettings() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      }
    } catch (e) { /* 保存が無い/読めない環境では既定値を使う */ }
    return null;
  }

  function saveSettings() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
          akadora: game.rules.akadora,
          kuitan: game.rules.kuitan,
          kuikae: game.rules.kuikae,
          is3D: game.is3D,
          playerCount: game.playerCount,
          matchLength: game.matchLength,
          isAssisting: game.isAssisting
        }));
      }
    } catch (e) { /* 保存できなくても対局は継続する */ }
  }

  function applyStoredSettings() {
    const s = readStoredSettings();
    if (!s) return;
    if (typeof s.akadora === 'boolean') game.rules.akadora = s.akadora;
    if (typeof s.kuitan === 'boolean') game.rules.kuitan = s.kuitan;
    if (typeof s.kuikae === 'boolean') game.rules.kuikae = s.kuikae;
    if (typeof s.is3D === 'boolean') game.is3D = s.is3D;
    if (s.playerCount === 3 || s.playerCount === 4) game.playerCount = s.playerCount;
    if (s.matchLength === 'tonpuu' || s.matchLength === 'hanchan') game.matchLength = s.matchLength;
    if (typeof s.isAssisting === 'boolean') game.isAssisting = s.isAssisting;
  }

  // 復元した設定をコントロール類の表示に反映する
  function syncSettingsUi() {
    if (DOM.segPlayerCount) {
      DOM.segPlayerCount.querySelectorAll('.rule-seg-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.getAttribute('data-players'), 10) === game.playerCount);
      });
    }
    if (DOM.segMatchLength) {
      DOM.segMatchLength.querySelectorAll('.rule-seg-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-length') === game.matchLength);
      });
    }
    if (DOM.btnRuleAkadora) {
      DOM.btnRuleAkadora.textContent = `赤ドラ: ${game.rules.akadora ? 'ON' : 'OFF'}`;
      DOM.btnRuleAkadora.classList.toggle('active', game.rules.akadora);
    }
    if (DOM.btnRuleKuitan) {
      DOM.btnRuleKuitan.textContent = `食いタン: ${game.rules.kuitan ? 'ON' : 'OFF'}`;
      DOM.btnRuleKuitan.classList.toggle('active', game.rules.kuitan);
    }
    if (DOM.btnRuleKuikae) {
      DOM.btnRuleKuikae.textContent = `喰い替え禁止: ${game.rules.kuikae ? 'ON' : 'OFF'}`;
      DOM.btnRuleKuikae.classList.toggle('active', game.rules.kuikae);
    }
    if (DOM.btnToggleAssist) {
      DOM.btnToggleAssist.textContent = `💡 アシスト: ${game.isAssisting ? 'ON' : 'OFF'}`;
    }
    if (DOM.gameAssistBar) {
      DOM.gameAssistBar.style.display = game.isAssisting ? 'flex' : 'none';
    }
    update3DView();
  }

  // ---------- カスタム確認ダイアログ (ネイティブ confirm の置換) ----------
  let pendingConfirmAction = null;

  function showConfirmDialog(message, onConfirm) {
    if (!DOM.confirmModal) {
      // モーダルが使えない環境向けフォールバック
      if (typeof confirm === 'function') {
        if (confirm(message)) onConfirm();
      } else {
        onConfirm();
      }
      return;
    }
    if (DOM.confirmModalMessage) DOM.confirmModalMessage.textContent = message;
    pendingConfirmAction = onConfirm;
    DOM.confirmModal.classList.remove('hidden');
  }

  function closeConfirmDialog() {
    if (DOM.confirmModal) DOM.confirmModal.classList.add('hidden');
    pendingConfirmAction = null;
  }

  function init() {
    cacheDom();
    applyStoredSettings();
    setupEvents();
    syncSettingsUi();
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
          saveSettings();
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
          saveSettings();
          startNewGame();
        });
      });
    }

    // 3. 3D立体視点 ON/OFF 切替
    if (DOM.btnToggle3D) {
      DOM.btnToggle3D.addEventListener('click', () => {
        game.is3D = !game.is3D;
        update3DView();
        saveSettings();
      });
    }

    // 4. ルール: 赤ドラ ON/OFF (牌山の構成が変わるため新規対局で反映)
    if (DOM.btnRuleAkadora) {
      DOM.btnRuleAkadora.addEventListener('click', () => {
        game.rules.akadora = !game.rules.akadora;
        DOM.btnRuleAkadora.textContent = `赤ドラ: ${game.rules.akadora ? 'ON' : 'OFF'}`;
        DOM.btnRuleAkadora.classList.toggle('active', game.rules.akadora);
        saveSettings();
        startNewGame();
        showGameToast(`赤ドラ ${game.rules.akadora ? 'ON' : 'OFF'} で新規対局を開始しました`);
      });
    }

    // 5. ルール: 食いタン ON/OFF (点数計算に即時反映)
    if (DOM.btnRuleKuitan) {
      DOM.btnRuleKuitan.addEventListener('click', () => {
        game.rules.kuitan = !game.rules.kuitan;
        DOM.btnRuleKuitan.textContent = `食いタン: ${game.rules.kuitan ? 'ON' : 'OFF'}`;
        DOM.btnRuleKuitan.classList.toggle('active', game.rules.kuitan);
        saveSettings();
        showGameToast(`食いタン ${game.rules.kuitan ? 'ON (喰い断あり)' : 'OFF (門前のみ断幺九)'}`);
      });
    }

    // 6. ルール: 喰い替え禁止 ON/OFF (鳴き直後の打牌制限に即時反映)
    if (DOM.btnRuleKuikae) {
      DOM.btnRuleKuikae.addEventListener('click', () => {
        game.rules.kuikae = !game.rules.kuikae;
        DOM.btnRuleKuikae.textContent = `喰い替え禁止: ${game.rules.kuikae ? 'ON' : 'OFF'}`;
        DOM.btnRuleKuikae.classList.toggle('active', game.rules.kuikae);
        saveSettings();
        showGameToast(`喰い替え禁止 ${game.rules.kuikae ? 'ON' : 'OFF (制限なし)'}`);
      });
    }

    // 6.5 効果音 ON/OFF (状態は sfx.js が localStorage に保存)
    if (DOM.btnSfxToggle) {
      const syncSfxBtn = () => {
        const isMuted = window.MahjongSfx && typeof window.MahjongSfx.isMuted === 'function'
          ? window.MahjongSfx.isMuted() : false;
        DOM.btnSfxToggle.textContent = isMuted ? '🔇 サウンド: OFF' : '🔊 サウンド: ON';
        DOM.btnSfxToggle.classList.toggle('active', !isMuted);
      };
      syncSfxBtn();
      DOM.btnSfxToggle.addEventListener('click', () => {
        if (window.MahjongSfx && typeof window.MahjongSfx.toggleMuted === 'function') {
          window.MahjongSfx.toggleMuted();
        }
        syncSfxBtn();
        const isMutedNow = window.MahjongSfx && window.MahjongSfx.isMuted();
        showGameToast(isMutedNow ? '効果音 OFF' : '効果音 ON');
        if (!isMutedNow) sfx('click');
      });
    }

    // 新規対局ボタン (カスタム確認ダイアログで確認してからリセット)
    if (DOM.btnNewGame) {
      DOM.btnNewGame.addEventListener('click', () => {
        showConfirmDialog('現在の対局をリセットして新規対局を開始しますか？', startNewGame);
      });
    }

    // 確認ダイアログのボタン配線 (キャンセルでは何も起きない)
    if (DOM.btnConfirmOk) {
      DOM.btnConfirmOk.addEventListener('click', () => {
        const action = pendingConfirmAction;
        closeConfirmDialog();
        if (action) action();
      });
    }
    if (DOM.btnConfirmCancel) {
      DOM.btnConfirmCancel.addEventListener('click', () => {
        closeConfirmDialog();
      });
    }
    if (DOM.confirmModal) {
      DOM.confirmModal.addEventListener('click', (e) => {
        if (e && e.target === DOM.confirmModal) closeConfirmDialog();
      });
    }

    // アシストバーON/OFF
    if (DOM.btnToggleAssist) {
      DOM.btnToggleAssist.addEventListener('click', () => {
        game.isAssisting = !game.isAssisting;
        DOM.btnToggleAssist.textContent = `💡 アシスト: ${game.isAssisting ? 'ON' : 'OFF'}`;
        DOM.gameAssistBar.style.display = game.isAssisting ? 'flex' : 'none';
        saveSettings();
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
    if (DOM.btnActionRyukyoku) DOM.btnActionRyukyoku.addEventListener('click', () => handlePlayerAction('ryukyoku'));

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
      ippatsuDeclarationPending: false, // リーチ宣言直後で宣言打牌がまだ済んでいない
      isMenzen: true,
      furiten: false,
      tempFuriten: false,      // 同巡内見逃しフリテン (自分の次のツモまで)
      riichiFuriten: false,    // リーチ後見逃しフリテン (その局ずっと)
      discardCount: 0,         // この局の自分の打牌数 (ダブルリーチ判定用)
      kuikaeForbidden: null,   // 喰い替え禁止中の牌 (正規化済みコードの配列, 1打牌のみ有効)
      lastDrawWasRinshan: false // 直前のツモが嶺上牌かどうか
    };
  }

  /**
   * 1局の開始
   */
  const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  // 局開始のサイコロ演出 (見た目のみ・対局進行は妨げない)
  function showDiceRoll() {
    if (!DOM.diceOverlay || !DOM.diceFace1 || !DOM.diceFace2) return;
    const roll1 = 1 + Math.floor(Math.random() * 6);
    const roll2 = 1 + Math.floor(Math.random() * 6);
    if (DOM.diceRoundLabel) DOM.diceRoundLabel.textContent = getCurrentRoundLabel();
    if (DOM.diceSumLabel) DOM.diceSumLabel.textContent = '';
    DOM.diceOverlay.style.display = 'flex';
    DOM.diceOverlay.classList.remove('dice-done');
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      DOM.diceFace1.textContent = DICE_FACES[Math.floor(Math.random() * 6)];
      DOM.diceFace2.textContent = DICE_FACES[Math.floor(Math.random() * 6)];
      if (ticks >= 9) {
        clearInterval(timer);
        DOM.diceFace1.textContent = DICE_FACES[roll1 - 1];
        DOM.diceFace2.textContent = DICE_FACES[roll2 - 1];
        if (DOM.diceSumLabel) {
          DOM.diceSumLabel.textContent = `出目 ${roll1 + roll2} ・ 親は ${PLAYER_NAMES[game.dealerIdx]}`;
        }
        DOM.diceOverlay.classList.add('dice-done');
        setTimeout(() => { if (DOM.diceOverlay) DOM.diceOverlay.style.display = 'none'; }, 650);
      }
    }, 70);
  }

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
      game.players[i].ippatsuDeclarationPending = false;
      game.players[i].isMenzen = true;
      game.players[i].furiten = false;
      game.players[i].tempFuriten = false;
      game.players[i].riichiFuriten = false;
      game.players[i].discardCount = 0;
      game.players[i].kuikaeForbidden = null;
      game.players[i].lastDrawWasRinshan = false;
      game.players[i].lastDrawSeq = 0;
      game.players[i].drawSeqRendered = 0;
    }

    game.discardSeq = 0;
    game.kanCount = 0;
    game.justDiscarded = null;
    game.dealPending = true;
    showDiceRoll();

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
        if (game.rules.akadora && !isSanma && tile === '5m' && i === 0) wall.push('5mr');
        else if (game.rules.akadora && tile === '5p' && i === 0) wall.push('5pr');
        else if (game.rules.akadora && tile === '5s' && i === 0) wall.push('5sr');
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
    game.drawSeq = (game.drawSeq || 0) + 1;
    const player = game.players[playerIdx];
    player.lastDrawSeq = game.drawSeq;
    player.tsumoTile = drawnTile;
    player.lastDrawWasRinshan = false;
    player.tempFuriten = false; // 同巡内見逃しフリテンは自分のツモで解除

    renderBoard();

    if (playerIdx === 0) {
      sfx('select'); // 自分のツモ: 軽いクリック音
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
          honba: game.honba,
          ...buildSituationalOptions(player, true)
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

    // カン判定 (暗槓・加槓)。リーチ後は暗槓のみ可
    const kanOptions = getKanOptions(player, fullHand);
    const kanAvailable = kanOptions.length > 0 &&
      (!player.isRiichi || kanOptions.some(o => o.kind === 'ankan'));
    if (kanAvailable) {
      DOM.btnActionKan.style.display = 'inline-block';
      hasActions = true;
    }

    // 九種九牌判定: 自分の最初のツモで、まだ誰も鳴いておらず、
    // 么九牌が9種類以上あれば途中流局を選べる
    const noCallsYet = game.players.every(p => p.melds.length === 0);
    if (player.discardCount === 0 && player.kawa.length === 0 && noCallsYet) {
      const yaochuKinds = new Set(
        fullHand.map(t => normTileCode(t)).filter(c =>
          c === '1m' || c === '9m' || c === '1p' || c === '9p' || c === '1s' || c === '9s' ||
          (c[1] === 'z' && c[0] >= '1' && c[0] <= '7'))
      );
      if (yaochuKinds.size >= 9 && DOM.btnActionRyukyoku) {
        DOM.btnActionRyukyoku.style.display = 'inline-block';
        hasActions = true;
      }
    }

    if (hasActions) {
      if (DOM.actionBarContext) DOM.actionBarContext.style.display = 'none';
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

  // 可能なカン (暗槓・加槓) の一覧
  function getKanOptions(player, fullHand) {
    const options = [];
    const counts = {};
    fullHand.forEach(t => {
      const raw = normTileCode(t);
      counts[raw] = (counts[raw] || 0) + 1;
    });
    Object.keys(counts).forEach(raw => {
      if (counts[raw] === 4) options.push({ kind: 'ankan', tile: raw });
    });
    player.melds.forEach(m => {
      if (m.type === 'pon') {
        const raw = normTileCode(m.tiles[0]);
        if (counts[raw] >= 1) options.push({ kind: 'kakan', tile: raw });
      }
    });
    return options;
  }

  // 槓ドラ表示牌を追加する (表・裏とも次の表示牌へ)
  function addKanDora() {
    game.kanCount += 1;
    const ind = game.deadWall[4 + game.kanCount];
    if (ind) {
      game.doraIndicators.push(ind);
      game.kanDoraFlipPending = true; // 次回 renderBoard で新規表示牌にめくりアニメ
    }
    const ura = game.deadWall[9 + game.kanCount];
    if (ura) game.uraDoraIndicators.push(ura);
  }

  // 嶺上牌を王牌から引く (王牌14枚を維持するため牌山の最後尾から補充)
  function drawRinshanTile() {
    if (game.deadWall.length === 0) return null;
    const tile = game.deadWall.pop();
    if (game.wall.length > 0) {
      game.deadWall.push(game.wall.pop());
    }
    return tile;
  }

  // カン成立後の共通処理: 槓ドラ → 嶺上ツモ → ツモフェーズへ戻る
  function afterPlayerKan(player) {
    // 自分のカンで一発は消滅する (嶺上開花とは複合しない)
    player.ippatsu = false;
    player.ippatsuDeclarationPending = false;

    addKanDora();

    const rinshan = drawRinshanTile();
    game.currentTurn = player.idx;
    if (!rinshan) {
      renderBoard();
      return;
    }
    player.tsumoTile = rinshan;
    player.lastDrawWasRinshan = true;
    game.lastDrawnTile = rinshan;

    renderBoard();
    updatePlayerAssist();
    checkPlayerTsumoActions(rinshan);
  }

  // プレイヤーの暗槓・加槓 (ツモフェーズ)
  function executePlayerKan() {
    const player = game.players[0];
    const fullHand = [...player.hand, player.tsumoTile].filter(t => t !== null && t !== undefined);
    const options = getKanOptions(player, fullHand)
      .filter(o => !player.isRiichi || o.kind === 'ankan');
    if (options.length === 0) return;
    const opt = options.find(o => o.kind === 'ankan') || options[0];

    if (opt.kind === 'ankan') {
      const kanTiles = fullHand.filter(t => normTileCode(t) === opt.tile);
      player.hand = fullHand.filter(t => normTileCode(t) !== opt.tile);
      player.melds.push({ type: 'ankan', tiles: kanTiles });
      showGameToast('暗槓（アンカン）！', 'blue');
    } else {
      // 加槓: ポンの刻子に手牌 (またはツモ牌) の1枚を加える
      const meld = player.melds.find(m => m.type === 'pon' && normTileCode(m.tiles[0]) === opt.tile);
      const idx = fullHand.findIndex(t => normTileCode(t) === opt.tile);
      const added = fullHand[idx];
      const remain = [...fullHand];
      remain.splice(idx, 1);
      player.hand = remain;
      meld.type = 'kan';
      meld.tiles = [...meld.tiles, added];
      showGameToast('加槓（カカン）！', 'blue');
    }
    player.tsumoTile = null;

    afterPlayerKan(player);
  }

  // プレイヤーの明槓 (他家の打牌を鳴く)
  function executePlayerMinkan(tile) {
    const player = game.players[0];
    const raw = normTileCode(tile);
    const removed = [];

    for (let i = player.hand.length - 1; i >= 0 && removed.length < 3; i--) {
      if (normTileCode(player.hand[i]) === raw) {
        removed.push(player.hand.splice(i, 1)[0]);
      }
    }
    if (removed.length < 3) return; // 安全策 (通常は到達しない)

    player.melds.push({ type: 'kan', tiles: [...removed, tile] });
    player.isMenzen = false;

    // 鳴きが入ると全員の一発は消滅する
    game.players.forEach(p => { p.ippatsu = false; p.ippatsuDeclarationPending = false; });

    showGameToast('カン（明槓）！', 'blue');
    game.currentTurn = 0;

    afterPlayerKan(player);
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
          honba: game.honba,
          ...buildSituationalOptions(cpu, true)
        }
      });

      if (scoreRes && scoreRes.han >= 1) {
        handleAgari(playerIdx, -1, drawnTile, true, scoreRes);
        return;
      }
    }

    // カン (暗槓・加槓): 向聴を崩さない場合のみ行う
    if (tryCpuKanInTurn(playerIdx, fullHand, shanten)) {
      return;
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
      discardTile = chooseCpuBestDiscard(fullHand, cpu.melds.length, cpu.kuikaeForbidden);
      isTsumogiri = (discardTile === drawnTile);
    }

    handleDiscardTile(playerIdx, discardTile, isTsumogiri);
  }

  function chooseCpuBestDiscard(hand14, meldCount, forbiddenTiles) {
    let minShanten = 99;
    const candidates = [];
    const uniqueTiles = [...new Set(hand14)];
    // 喰い替え禁止の牌は候補から外す (全て禁止の場合のみ例外的に許可)
    const forbidden = (game.rules.kuikae && Array.isArray(forbiddenTiles)) ? forbiddenTiles : [];
    const allowedTiles = uniqueTiles.filter(t => !forbidden.includes(normTileCode(t)));
    const targetTiles = allowedTiles.length > 0 ? allowedTiles : uniqueTiles;

    targetTiles.forEach(t => {
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
    player.ippatsuDeclarationPending = true; // 宣言打牌で消費する (P1-6)
    if (player.discardCount === 0) {
      player.isDoubleRiichi = true; // 自分の最初の打牌でのリーチ宣言
    }
    player.score -= 1000;
    game.riichiSticks += 1;

    sfx('riichi');
    showGameToast(`${player.name} が立直（リーチ）！`, 'gold');
    renderBoard();
  }

  function handleDiscardTile(playerIdx, tile, isTsumogiri) {
    const player = game.players[playerIdx];

    // 喰い替え禁止: 鳴き直後の1打牌だけ、指定牌は切れない (プレイヤーのみブロック)
    if (playerIdx === 0 && game.rules.kuikae && player.kuikaeForbidden &&
        player.kuikaeForbidden.includes(normTileCode(tile))) {
      showGameToast('喰い替え禁止の牌です（鳴いた形と同じになる牌は切れません）', 'orange');
      return;
    }

    clearTimeout(game.turnTimer);
    hideActionBar();

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

    player.discardCount += 1;
    game.discardSeq += 1;

    // 喰い替え制限はこの1打牌で解除される
    player.kuikaeForbidden = null;

    // 一発の寿命 (P1-6): 宣言打牌では消えず、宣言者の「次の打牌」で消える。
    // 他家の打牌やターンの進行では消えない (鳴きが入った場合は鳴き側で消す)。
    if (player.ippatsu) {
      if (player.ippatsuDeclarationPending) {
        player.ippatsuDeclarationPending = false;
      } else {
        player.ippatsu = false;
      }
    }

    game.lastDiscardedTile = tile;
    game.lastDiscarder = playerIdx;

    // 演出: 河の最新牌に登場アニメを付けるための印 + 打牌音
    game.justDiscarded = { playerIdx, seq: game.discardSeq, rendered: false };
    sfx('discard');

    renderBoard();
    if (playerIdx === 0) updatePlayerAssist();

    checkOtherPlayersResponses(playerIdx, tile);
  }

  function checkOtherPlayersResponses(discarderIdx, tile) {
    // CPUのロンは全員分を先に集める (ダブロン/トリロン対応。
    // 以前はプレイヤーがパスするとCPUのロン自体が見送られていた)
    game.pendingCpuRons = [];
    for (let i = 1; i < game.playerCount; i++) {
      if (i === discarderIdx) continue;
      const cpu = game.players[i];
      const scoreRes = cpuRonScore(cpu, tile);
      if (scoreRes) game.pendingCpuRons.push({ idx: i, scoreRes });
    }

    // プレイヤーの反応チェック (CPUのロンがある場合は、ロンが鳴きに優先するため鳴きは提示しない)
    if (discarderIdx !== 0) {
      const player = game.players[0];
      if (checkPlayerResponsesToDiscard(player, discarderIdx, tile, game.pendingCpuRons.length > 0)) {
        return;
      }
    }

    resolveCpuResponses(discarderIdx, tile);
  }

  // プレイヤーの応答が無い/パスされた後に、CPUのロン→鳴きの順で解決する
  function resolveCpuResponses(discarderIdx, tile) {
    // 四風連打: 全員の最初の打牌が同じ風牌で鳴きがなければ途中流局 (ロンは上の段で優先済み)
    if (game.playerCount === 4 &&
        game.players.every(p => p.kawa.length === 1 && p.melds.length === 0)) {
      const winds = game.players.map(p => normTileCode(p.kawa[0].tile));
      if (winds.every(w => w === winds[0]) && ['1z', '2z', '3z', '4z'].includes(winds[0])) {
        handleInterruptedRyukyoku('四風連打');
        return;
      }
    }

    if (game.pendingCpuRons && game.pendingCpuRons.length > 0) {
      const winners = game.pendingCpuRons.map(r => ({ idx: r.idx, scoreRes: r.scoreRes }));
      game.pendingCpuRons = [];
      fireRonWinners(winners, discarderIdx, tile);
      return;
    }

    // ポン/カン (全員) がチー (下家のみ) に優先する
    const n = game.playerCount;
    for (let step = 1; step < n; step++) {
      const idx = (discarderIdx + step) % n;
      if (idx === 0) continue;
      const cpu = game.players[idx];
      if (cpu.isRiichi) continue;
      if (cpuWantsMinkan(cpu, tile)) { executeCpuCall(idx, 'kan', tile); return; }
      if (cpuWantsPon(cpu, tile)) { executeCpuCall(idx, 'pon', tile); return; }
    }
    if (n === 4) {
      const shimochaIdx = (discarderIdx + 1) % n;
      if (shimochaIdx !== 0) {
        const cpu = game.players[shimochaIdx];
        if (!cpu.isRiichi) {
          const chiChoice = cpuDecideChi(cpu, tile);
          if (chiChoice) { executeCpuCall(shimochaIdx, 'chi', tile, chiChoice); return; }
        }
      }
    }

    proceedToNextTurn();
  }

  // ロン和了の解決 (1人なら通常処理、複数ならダブロン/トリロン)
  function fireRonWinners(winners, loserIdx, tile) {
    if (winners.length === 1) {
      handleAgari(winners[0].idx, loserIdx, tile, false, winners[0].scoreRes);
      return;
    }
    // ダブロン/トリロン: 各和了者が放銃者から満額を受け取る。
    // 供託リーチ棒は放銃者から時計回りに最も近い和了者 (頭) が全て得る。
    const n = game.playerCount;
    winners.sort((a, b) => ((a.idx - loserIdx + n) % n) - ((b.idx - loserIdx + n) % n));
    const loser = game.players[loserIdx];
    const sticksBonus = game.riichiSticks * 1000;
    winners.forEach((w, i) => {
      const pts = (w.scoreRes && w.scoreRes.points && typeof w.scoreRes.points === 'object')
        ? w.scoreRes.points : { ron: 0 };
      loser.score -= pts.ron;
      game.players[w.idx].score += pts.ron + (i === 0 ? sticksBonus : 0);
    });
    game.riichiSticks = 0;
    game.lastRoundRenchan = winners.some(w => game.players[w.idx].seatWind === '1z');
    showMultiAgariModal(winners, loserIdx, tile);
  }

  function showMultiAgariModal(winners, loserIdx, tile) {
    if (!DOM.gameResultModal) return;
    const label = winners.length >= 3 ? 'トリプルロン' : 'ダブロン';
    DOM.resultModalTitle.textContent = `🀄️ ${label}！`;
    DOM.resultWinnerAvatar.textContent = '🎉';
    DOM.resultWinnerName.textContent = winners.map(w => game.players[w.idx].name).join(' ＆ ');
    DOM.resultAgariType.textContent = `放銃: ${PLAYER_NAMES[loserIdx]}`;

    DOM.resultHandTiles.innerHTML = '';
    winners.forEach(w => {
      const winner = game.players[w.idx];
      const fullHand = [...winner.hand];
      sortHand(fullHand);
      fullHand.forEach(t => DOM.resultHandTiles.appendChild(createTileDom(t, false)));
      const winEl = createTileDom(tile, false);
      winEl.classList.add('agari-tile');
      DOM.resultHandTiles.appendChild(winEl);
    });

    DOM.resultDoraTiles.innerHTML = '';
    game.doraIndicators.forEach(t => DOM.resultDoraTiles.appendChild(createTileDom(t, true)));

    DOM.resultYakuList.innerHTML = '';
    winners.forEach(w => {
      const names = (w.scoreRes.yakuList || []).map(y => y.name).join('・') || '役あり';
      const li = document.createElement('li');
      li.className = 'yaku-badge-item';
      li.innerHTML = `<span class="yaku-name">${game.players[w.idx].name}: ${names}</span><span class="yaku-han">${w.scoreRes.han || 0}翻</span>`;
      DOM.resultYakuList.appendChild(li);
    });

    const total = winners.reduce((s, w) => s + (w.scoreRes.totalPoints || 0), 0);
    animateScoreCount(DOM.resultScorePoints, total);
    DOM.resultScoreRank.textContent = label;
    DOM.resultScoreDetails.textContent = `合計 ${total}点 (供託は先頭の和了者へ)`;

    sfx('agari', winners.some(w => w.scoreRes.isYakuman));
    DOM.gameResultModal.classList.remove('hidden');
  }

  function checkPlayerResponsesToDiscard(player, discarderIdx, tile, suppressCalls) {
    let canRon = false;
    let canPon = false;
    let canChi = false;
    let canKan = false;

    // ロン判定 (フリテンの場合は不可)
    const testHand = [...player.hand, tile];
    const s = window.calculateShanten ? window.calculateShanten(testHand, player.melds.length) : 99;
    if (s === -1 && !isFuritenNow(player)) {
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
          honba: game.honba,
          ...buildSituationalOptions(player, false)
        }
      });
      if (scoreRes && scoreRes.han >= 1) canRon = true;
    }

    // 鳴き判定 (リーチ中は不可。CPUのロンがある場合はロン優先のため鳴きを提示しない)
    if (!player.isRiichi && !suppressCalls) {
      const raw = window.normalizeTile ? window.normalizeTile(tile) : tile;
      const sameCount = player.hand.filter(t => (window.normalizeTile ? window.normalizeTile(t) : t) === raw).length;
      if (sameCount >= 2) canPon = true;
      if (sameCount >= 3) canKan = true; // 明槓

      // 4人麻雀の上家からのみチー可能 (3人麻雀はチー禁止)
      if (game.playerCount === 4 && discarderIdx === 3 && raw[1] !== 'z') {
        canChi = checkCanChi(player.hand, raw);
      }
    }

    if (canRon || canPon || canChi || canKan) {
      if (canRon) DOM.btnActionRon.style.display = 'inline-block';
      if (canPon) DOM.btnActionPon.style.display = 'inline-block';
      if (canChi) DOM.btnActionChi.style.display = 'inline-block';
      if (canKan) DOM.btnActionKan.style.display = 'inline-block';
      DOM.btnActionPass.style.display = 'inline-block';
      DOM.gameActionBar.style.display = 'flex';

      game.pendingActions = {
        type: 'discard',
        discarderIdx,
        tile,
        canRon,
        canPon,
        canChi,
        canKan
      };

      // どの牌への反応か分かるように、対象の捨て牌を光らせて名前と牌をバーに表示する
      const kawaContainers = [DOM.kawaJibun, DOM.kawaShimocha, DOM.kawaToimen, DOM.kawaKamicha];
      const kc = kawaContainers[discarderIdx];
      if (kc && kc.lastElementChild) kc.lastElementChild.classList.add('kawa-call-target');
      if (DOM.actionBarContext) {
        DOM.actionBarContext.innerHTML = '';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${PLAYER_NAMES[discarderIdx]} の捨て牌`;
        DOM.actionBarContext.appendChild(nameSpan);
        DOM.actionBarContext.appendChild(createTileDom(tile, true));
        DOM.actionBarContext.style.display = 'inline-flex';
      }
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

  // CPUがその牌でロンできるなら scoreRes を、できなければ null を返す (発火は呼び出し側)
  function cpuRonScore(cpu, tile) {
    const testHand = [...cpu.hand, tile];
    const s = window.calculateShanten ? window.calculateShanten(testHand, cpu.melds.length) : 99;
    if (s === -1 && !isFuritenNow(cpu)) {
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
          honba: game.honba,
          ...buildSituationalOptions(cpu, false)
        }
      });
      if (scoreRes && scoreRes.han >= 1) return scoreRes;
    }
    return null;
  }

  function proceedToNextTurn() {
    // ※ 一発はここでは消さない (宣言者の打牌ライフサイクルで管理する: P1-6)

    // 四家立直: 全員のリーチ宣言打牌が通ったら途中流局
    if (game.playerCount === 4 && game.players.every(p => p.isRiichi)) {
      handleInterruptedRyukyoku('四家立直');
      return;
    }

    // 四槓散了: 合計4回のカンが複数のプレイヤーに分散していたら途中流局
    if (game.kanCount >= 4) {
      const kanMakers = game.players.filter(p =>
        p.melds.some(m => m.type === 'kan' || m.type === 'ankan'));
      if (kanMakers.length >= 2) {
        handleInterruptedRyukyoku('四槓散了');
        return;
      }
    }

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
    // 鳴き・ロンで対象牌が河から離れたら最新マーカーを消す
    if (action === 'pon' || action === 'chi' || action === 'kan' || action === 'ron') {
      game.justDiscarded = null;
    }

    if (!pending) return;

    if (action === 'pass') {
      if (pending.type === 'discard') {
        // ロンを見逃した場合はフリテンになる
        if (pending.canRon) {
          const player = game.players[0];
          if (player.isRiichi) player.riichiFuriten = true; // その局ずっと
          else player.tempFuriten = true;                    // 自分の次のツモまで
          player.furiten = true;
        }
        // パス後はCPU側のロン・鳴きを解決する
        resolveCpuResponses(pending.discarderIdx, pending.tile);
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
          honba: game.honba,
          ...buildSituationalOptions(player, true)
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
          honba: game.honba,
          ...buildSituationalOptions(player, false)
        }
      });
      // CPUにもロンがある場合はダブロンとしてまとめて解決する
      const winners = [{ idx: 0, scoreRes }];
      if (game.pendingCpuRons) winners.push(...game.pendingCpuRons);
      game.pendingCpuRons = [];
      fireRonWinners(winners, pending.discarderIdx, pending.tile);
      return;
    }

    if (action === 'riichi') {
      declareRiichi(0);
      return;
    }

    if (action === 'ryukyoku') {
      if (pending.type === 'tsumo') {
        handleInterruptedRyukyoku('九種九牌');
      }
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

    if (action === 'kan') {
      if (pending.type === 'tsumo') {
        executePlayerKan();
      } else if (pending.type === 'discard' && pending.canKan) {
        executePlayerMinkan(pending.tile);
      }
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

    // 鳴きが入ると全員の一発は消滅する
    game.players.forEach(p => { p.ippatsu = false; p.ippatsuDeclarationPending = false; });

    // 喰い替え禁止: 鳴いた牌と同種の牌は次の打牌で切れない
    if (game.rules.kuikae) player.kuikaeForbidden = [raw];

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

      // 鳴きが入ると全員の一発は消滅する
      game.players.forEach(p => { p.ippatsu = false; p.ippatsuDeclarationPending = false; });

      // 喰い替え禁止: 鳴いた牌そのものと、反対側で同じ順子になる牌は次の打牌で切れない
      // 例: 3・4 で 2 をチー → 2 と 5 が禁止 / 4・5 で 6 をチー → 6 と 3 が禁止
      if (game.rules.kuikae) {
        const handNums = pair.map(t => parseInt(normTileCode(t)[0], 10));
        const low = Math.min(...handNums, num);
        const forbidden = [raw];
        if (num === low && low + 3 <= 9) forbidden.push(`${low + 3}${suit}`);
        else if (num === low + 2 && low - 1 >= 1) forbidden.push(`${low - 1}${suit}`);
        player.kuikaeForbidden = forbidden;
      }

      showGameToast('チー！', 'blue');
      renderBoard();
      game.currentTurn = 0;
      updatePlayerAssist();
    }
  }

  // ---------- CPUの鳴き (ポン・チー・カン) ----------
  function cpuShanten(hand, meldCount) {
    return window.calculateShanten ? window.calculateShanten(hand, meldCount) : 99;
  }

  // 門前から鳴く場合の最低条件: 鳴いた後に役の見込みがあるか
  function cpuHasYakuPotential(cpu, handAfter, calledTiles) {
    const counts = {};
    handAfter.forEach(t => { const r = normTileCode(t); counts[r] = (counts[r] || 0) + 1; });
    calledTiles.forEach(t => { const r = normTileCode(t); counts[r] = (counts[r] || 0) + 1; });
    const yakuhaiTiles = ['5z', '6z', '7z', game.roundWind, cpu.seatWind];
    if (yakuhaiTiles.some(y => (counts[y] || 0) >= 2)) return true;
    // タンヤオ見込み: 么九牌が合計2枚以下 (頭に1組まで許容する簡易判定)
    let yaochu = 0;
    Object.entries(counts).forEach(([code, c]) => {
      if (code[1] === 'z' || code[0] === '1' || code[0] === '9') yaochu += c;
    });
    if (yaochu <= 2) return true;
    // ドラ3枚以上なら押し切る
    if (countDora([...handAfter, ...calledTiles], game.doraIndicators) >= 3) return true;
    return false;
  }

  function cpuWantsPon(cpu, tile) {
    const raw = normTileCode(tile);
    const sameIdx = [];
    cpu.hand.forEach((t, i) => { if (normTileCode(t) === raw) sameIdx.push(i); });
    if (sameIdx.length < 2) return false;
    const handAfter = cpu.hand.filter((_, i) => i !== sameIdx[0] && i !== sameIdx[1]);
    const sBefore = cpuShanten(cpu.hand, cpu.melds.length);
    const sAfter = cpuShanten(handAfter, cpu.melds.length + 1);
    if (sAfter > sBefore) return false;
    const tripTiles = [cpu.hand[sameIdx[0]], cpu.hand[sameIdx[1]], tile];
    const isYakuhaiSet = ['5z', '6z', '7z', game.roundWind, cpu.seatWind].includes(raw);
    const doraSet = countDora(tripTiles, game.doraIndicators) > 0;
    if (sAfter < sBefore) {
      // 門前1向聴のリーチ狙いは半分見送る
      if (cpu.isMenzen && sBefore === 1 && !isYakuhaiSet && Math.random() < 0.5) return false;
      if (cpu.isMenzen && !cpuHasYakuPotential(cpu, handAfter, tripTiles)) return false;
      return true;
    }
    // 同向聴では役牌・ドラ刻子のみ (副露済みかテンパイ近傍に限る)
    return (isYakuhaiSet || doraSet) && (!cpu.isMenzen || sBefore <= 1);
  }

  function cpuDecideChi(cpu, tile) {
    const raw = normTileCode(tile);
    if (raw[1] === 'z') return null;
    const suit = raw[1];
    const num = parseInt(raw[0], 10);
    const findIdx = (n) => cpu.hand.findIndex(t => normTileCode(t) === `${n}${suit}`);
    const patterns = [[num - 2, num - 1], [num - 1, num + 1], [num + 1, num + 2]];
    const sBefore = cpuShanten(cpu.hand, cpu.melds.length);
    let best = null;
    for (const [a, b] of patterns) {
      if (a < 1 || b > 9) continue;
      const ia = findIdx(a);
      const ib = findIdx(b);
      if (ia === -1 || ib === -1) continue;
      const handAfter = cpu.hand.filter((_, i) => i !== ia && i !== ib);
      const sAfter = cpuShanten(handAfter, cpu.melds.length + 1);
      if (!best || sAfter < best.sAfter) best = { ia, ib, sAfter, handAfter };
    }
    if (!best || best.sAfter >= sBefore) return null;
    if (cpu.isMenzen && sBefore === 1 && Math.random() < 0.5) return null;
    if (cpu.isMenzen && !cpuHasYakuPotential(cpu, best.handAfter, [cpu.hand[best.ia], cpu.hand[best.ib], tile])) return null;
    return best;
  }

  function cpuWantsMinkan(cpu, tile) {
    const raw = normTileCode(tile);
    const count = cpu.hand.filter(t => normTileCode(t) === raw).length;
    if (count !== 3) return false;
    const handAfter = cpu.hand.filter(t => normTileCode(t) !== raw);
    const sBefore = cpuShanten(cpu.hand, cpu.melds.length);
    const sAfter = cpuShanten(handAfter, cpu.melds.length + 1);
    if (sAfter > sBefore) return false;
    const isYakuhaiSet = ['5z', '6z', '7z', game.roundWind, cpu.seatWind].includes(raw);
    return isYakuhaiSet || !cpu.isMenzen || countDora([tile, tile, tile, tile], game.doraIndicators) > 0;
  }

  function executeCpuCall(playerIdx, type, tile, chiChoice) {
    const cpu = game.players[playerIdx];
    const raw = normTileCode(tile);

    // 鳴きが入ると全員の一発は消滅する
    game.players.forEach(p => { p.ippatsu = false; p.ippatsuDeclarationPending = false; });
    game.justDiscarded = null;

    if (type === 'pon') {
      const removed = [];
      for (let i = cpu.hand.length - 1; i >= 0 && removed.length < 2; i--) {
        if (normTileCode(cpu.hand[i]) === raw) removed.push(cpu.hand.splice(i, 1)[0]);
      }
      if (removed.length < 2) { proceedToNextTurn(); return; }
      cpu.melds.push({ type: 'pon', tiles: [...removed, tile] });
      if (game.rules.kuikae) cpu.kuikaeForbidden = [raw];
      showGameToast(`${cpu.name} ポン！`, 'blue');
    } else if (type === 'chi') {
      const choice = chiChoice || cpuDecideChi(cpu, tile);
      if (!choice) { proceedToNextTurn(); return; }
      const t1 = cpu.hand[choice.ia];
      const t2 = cpu.hand[choice.ib];
      cpu.hand = cpu.hand.filter((_, i) => i !== choice.ia && i !== choice.ib);
      cpu.melds.push({ type: 'chi', tiles: [t1, tile, t2] });
      if (game.rules.kuikae) {
        const num = parseInt(raw[0], 10);
        const nums = [parseInt(normTileCode(t1)[0], 10), parseInt(normTileCode(t2)[0], 10), num];
        const low = Math.min(...nums);
        const forbidden = [raw];
        if (num === low && low + 3 <= 9) forbidden.push(`${low + 3}${raw[1]}`);
        else if (num === low + 2 && low - 1 >= 1) forbidden.push(`${low - 1}${raw[1]}`);
        cpu.kuikaeForbidden = forbidden;
      }
      showGameToast(`${cpu.name} チー！`, 'blue');
    } else if (type === 'kan') {
      const removed = [];
      for (let i = cpu.hand.length - 1; i >= 0 && removed.length < 3; i--) {
        if (normTileCode(cpu.hand[i]) === raw) removed.push(cpu.hand.splice(i, 1)[0]);
      }
      if (removed.length < 3) { proceedToNextTurn(); return; }
      cpu.melds.push({ type: 'kan', tiles: [...removed, tile] });
      showGameToast(`${cpu.name} カン（明槓）！`, 'blue');
    }
    cpu.isMenzen = false;
    game.currentTurn = playerIdx;
    renderBoard();

    if (type === 'kan') {
      // 明槓: 槓ドラをめくり、嶺上からツモって続行する
      addKanDora();
      const rinshan = drawRinshanTile();
      if (!rinshan) { renderBoard(); return; }
      cpu.tsumoTile = rinshan;
      cpu.lastDrawWasRinshan = true;
      game.lastDrawnTile = rinshan;
      game.turnTimer = setTimeout(() => cpuExecuteTurn(playerIdx, rinshan), 450);
      return;
    }

    // ポン・チー後はそのCPUが打牌する
    game.turnTimer = setTimeout(() => cpuDiscardAfterCall(playerIdx), 450);
  }

  function cpuDiscardAfterCall(playerIdx) {
    const cpu = game.players[playerIdx];
    cpu.tsumoTile = null; // 鳴き後はツモ牌なしで手牌から切る
    const discardTile = chooseCpuBestDiscard(cpu.hand, cpu.melds.length, cpu.kuikaeForbidden);
    handleDiscardTile(playerIdx, discardTile, false);
  }

  // CPUのツモ時のカン (暗槓・加槓): 向聴を崩さない場合のみ
  function tryCpuKanInTurn(playerIdx, fullHand, shantenNow) {
    const cpu = game.players[playerIdx];
    const kanOptions = getKanOptions(cpu, fullHand);
    if (kanOptions.length === 0) return false;
    const opt = kanOptions.find(o => o.kind === 'ankan') || kanOptions[0];
    let handAfterKan;
    if (opt.kind === 'ankan') {
      handAfterKan = fullHand.filter(t => normTileCode(t) !== opt.tile);
    } else {
      const idx = fullHand.findIndex(t => normTileCode(t) === opt.tile);
      handAfterKan = fullHand.filter((_, i) => i !== idx);
    }
    const meldsAfter = cpu.melds.length + (opt.kind === 'ankan' ? 1 : 0);
    const sAfterKan = cpuShanten(handAfterKan, meldsAfter);
    const kanOk = cpu.isRiichi
      ? (opt.kind === 'ankan' && sAfterKan === 0)
      : (sAfterKan <= shantenNow);
    if (!kanOk) return false;

    cpu.ippatsu = false;
    cpu.ippatsuDeclarationPending = false;
    if (opt.kind === 'ankan') {
      const kanTiles = fullHand.filter(t => normTileCode(t) === opt.tile);
      cpu.hand = fullHand.filter(t => normTileCode(t) !== opt.tile);
      cpu.melds.push({ type: 'ankan', tiles: kanTiles });
      showGameToast(`${cpu.name} 暗槓（アンカン）！`, 'blue');
    } else {
      const meld = cpu.melds.find(m => m.type === 'pon' && normTileCode(m.tiles[0]) === opt.tile);
      if (!meld) return false;
      const idx = fullHand.findIndex(t => normTileCode(t) === opt.tile);
      const added = fullHand[idx];
      const remain = [...fullHand];
      remain.splice(idx, 1);
      cpu.hand = remain;
      meld.type = 'kan';
      meld.tiles = [...meld.tiles, added];
      showGameToast(`${cpu.name} 加槓（カカン）！`, 'blue');
    }
    cpu.tsumoTile = null;

    addKanDora();
    const rinshan = drawRinshanTile();
    game.currentTurn = playerIdx;
    if (!rinshan) { renderBoard(); return true; }
    cpu.tsumoTile = rinshan;
    cpu.lastDrawWasRinshan = true;
    game.lastDrawnTile = rinshan;
    renderBoard();
    game.turnTimer = setTimeout(() => cpuExecuteTurn(playerIdx, rinshan), 450);
    return true;
  }

  function handleAgari(winnerIdx, loserIdx, winTile, isTsumo, scoreRes) {
    const winner = game.players[winnerIdx];
    // calculateScore の返却形式: points = { total, ron, oyaTsumo, koTsumo, honbaBonus }
    // oyaTsumo / koTsumo は「1人あたりの支払額」(本場分込み)、ron は本場込み総額
    const pts = (scoreRes && scoreRes.points && typeof scoreRes.points === 'object')
      ? scoreRes.points
      : { total: 0, ron: 0, oyaTsumo: 0, koTsumo: 0, honbaBonus: 0 };
    const sticksBonus = game.riichiSticks * 1000;

    if (isTsumo) {
      let received = 0;
      game.players.forEach(p => {
        if (p.idx === winnerIdx) return;
        // 親ツモは全員 oyaTsumo、子ツモは親が oyaTsumo・子が koTsumo を支払う
        const pay = (winner.seatWind === '1z' || p.seatWind === '1z')
          ? pts.oyaTsumo : pts.koTsumo;
        p.score -= pay;
        received += pay;
      });
      winner.score += received + sticksBonus;
    } else {
      const loser = game.players[loserIdx];
      loser.score -= pts.ron;
      winner.score += pts.ron + sticksBonus;
    }
    game.riichiSticks = 0;

    game.lastRoundRenchan = (winner.seatWind === '1z');
    showAgariModal(winner, loserIdx, winTile, isTsumo, scoreRes);
  }

  // 途中流局 (九種九牌・四風連打・四家立直・四槓散了): 点数移動なし、親は連荘
  function handleInterruptedRyukyoku(reason) {
    clearTimeout(game.turnTimer);
    hideActionBar();
    game.pendingActions = null;
    game.lastRoundRenchan = true;
    showGameToast(`流局（${reason}）`, 'orange');

    if (!DOM.gameResultModal) return;
    DOM.resultModalTitle.textContent = `💨 途中流局（${reason}）`;
    DOM.resultWinnerAvatar.textContent = '⚖️';
    DOM.resultWinnerName.textContent = reason;
    DOM.resultAgariType.textContent = '点数移動なし • 親は連荘します';
    DOM.resultHandTiles.innerHTML = '';
    DOM.resultDoraTiles.innerHTML = '';
    DOM.resultYakuList.innerHTML = '<li class="yaku-badge-item">途中流局のためノーテン罰符はありません</li>';
    DOM.resultScorePoints.textContent = '流局';
    DOM.resultScoreRank.textContent = '親連荘';
    DOM.resultScoreDetails.textContent = `次局は ${game.honba + 1} 本場 • 供託 ${game.riichiSticks * 1000}点は次局へ持ち越し`;

    DOM.gameResultModal.classList.remove('hidden');
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
    (scoreRes.yakuList || []).forEach(y => {
      const li = document.createElement('li');
      li.className = 'yaku-badge-item';
      li.innerHTML = `<span class="yaku-name">${y.name}</span><span class="yaku-han">${y.isYakuman ? '役満' : `${y.han}翻`}</span>`;
      DOM.resultYakuList.appendChild(li);
    });

    // 点数は 0 → 確定値へカウントアップ表示 (最終値は必ず正確な値で止まる)
    animateScoreCount(DOM.resultScorePoints, scoreRes.totalPoints || 0);
    DOM.resultScoreRank.textContent = scoreRes.rankTitle || '和了';
    DOM.resultScoreDetails.textContent = scoreRes.isYakuman
      ? `${scoreRes.rankTitle || '役満'} (本場加算含む)`
      : `${scoreRes.han || 0}翻 ${scoreRes.fu || 0}符 (本場加算含む)`;

    // 演出: ランクバッジをスケールインさせる (クラス付け直しで毎回再生)
    if (DOM.resultScoreRank) {
      DOM.resultScoreRank.classList.remove('rank-pop');
      void DOM.resultScoreRank.offsetWidth; // リフローでアニメをリスタート
      DOM.resultScoreRank.classList.add('rank-pop');
    }

    // 演出: 画面フラッシュ + 役満時は金色の強い演出 (光線)
    DOM.gameResultModal.classList.remove('agari-flash', 'yakuman-mode');
    void DOM.gameResultModal.offsetWidth;
    DOM.gameResultModal.classList.add('agari-flash');
    if (scoreRes.isYakuman) DOM.gameResultModal.classList.add('yakuman-mode');
    const modalEl = DOM.gameResultModal;
    setTimeout(() => { if (modalEl) modalEl.classList.remove('agari-flash'); }, 900);

    sfx('agari', !!scoreRes.isYakuman);

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
    scoreCountToken++; // 進行中のカウントアップを打ち切る (閉じた後に書き換えない)
    if (DOM.gameResultModal) {
      DOM.gameResultModal.classList.add('hidden');
      DOM.gameResultModal.classList.remove('agari-flash', 'yakuman-mode');
    }
    if (DOM.btnNextRound) DOM.btnNextRound.textContent = '次の局へ進む';
  }

  function renderBoard() {
    const currentRoundLabel = getCurrentRoundLabel();

    if (DOM.gameRoundName) DOM.gameRoundName.textContent = currentRoundLabel;
    if (DOM.centerRoundText) DOM.centerRoundText.textContent = currentRoundLabel;
    if (DOM.gameHonbaBadge) DOM.gameHonbaBadge.textContent = `${game.honba}本場`;
    if (DOM.gameRiichiSticks) {
      DOM.gameRiichiSticks.textContent = `供託: ${game.riichiSticks * 1000}点`;
      // 演出: リーチ棒 (供託) が増えた瞬間だけバッジを弾ませる
      if (game.riichiSticks > game.riichiSticksShown) {
        DOM.gameRiichiSticks.classList.add('stick-pop');
        const sticksEl = DOM.gameRiichiSticks;
        setTimeout(() => { if (sticksEl) sticksEl.classList.remove('stick-pop'); }, 700);
      }
      game.riichiSticksShown = game.riichiSticks;
    }
    if (DOM.gameRemainingWall) DOM.gameRemainingWall.textContent = game.wall.length;

    // ドラ表示牌 (カンで増えた分も含め全て表示)
    if (DOM.gameDoraTile) {
      DOM.gameDoraTile.innerHTML = '';
      game.doraIndicators.forEach((ind, i) => {
        const indEl = createTileDom(ind, true);
        // 演出: 槓ドラで増えた最新表示牌だけ「めくり」アニメを付ける
        if (game.kanDoraFlipPending && i === game.doraIndicators.length - 1) {
          indEl.classList.add('dora-flip-in');
        }
        DOM.gameDoraTile.appendChild(indEl);
      });
      game.kanDoraFlipPending = false;
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
    if (game.playerCount > 1) renderEnemyMelds(1, DOM.meldsShimocha);
    if (game.playerCount > 2) renderEnemyMelds(2, DOM.meldsToimen);
    if (game.playerCount > 3) renderEnemyMelds(3, DOM.meldsKamicha);

    // 自分手牌
    renderPlayerHand();

    // 手番の座席プレートを光らせる
    const seatOrder = ['seat-jibun', 'seat-shimocha', 'seat-toimen', 'seat-kamicha'];
    document.querySelectorAll('.table-seat').forEach(el => {
      if (el.classList.contains(seatOrder[game.currentTurn])) el.classList.add('seat-active');
      else el.classList.remove('seat-active');
    });

    // 配牌モーションは最初の描画だけ
    game.dealPending = false;
  }

  function renderPlayerHand() {
    const player = game.players[0];
    if (!DOM.jibunHandTiles || !player) return;

    DOM.jibunHandTiles.innerHTML = '';
    DOM.jibunTsumoTile.innerHTML = '';

    player.hand.forEach((tile, idx) => {
      const tileEl = createTileDom(tile, false);
      // 配牌モーション: 局の最初だけ1枚ずつ順に配られる
      if (game.dealPending) {
        tileEl.classList.add('deal-in');
        tileEl.style.animationDelay = `${idx * 45}ms`;
      }
      tileEl.addEventListener('click', () => {
        // リーチ中はツモ切りのみ。ただし宣言直後 (宣言打牌前) は手牌からも切れる
        if (game.currentTurn === 0 && (!player.isRiichi || player.ippatsuDeclarationPending)) {
          handleDiscardTile(0, tile, false);
        }
      });
      DOM.jibunHandTiles.appendChild(tileEl);
    });

    if (player.tsumoTile) {
      const tsumoEl = createTileDom(player.tsumoTile, false);
      tsumoEl.classList.add('tsumo-highlight');
      // ツモモーション: 新しく引いた牌だけ山側から滑り込む
      if (player.lastDrawSeq && player.lastDrawSeq !== player.drawSeqRendered) {
        tsumoEl.classList.add('tsumo-slide-in');
        player.drawSeqRendered = player.lastDrawSeq;
      }
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
      // 左右の家の伏せ牌は本人の方を向く (右の家=+90° / 左の家=-90°)
      if (playerIdx === 1 || playerIdx === 3) backTile.classList.add(`back-seat-${playerIdx}`);
      // 配牌モーション
      if (game.dealPending) {
        backTile.classList.add('deal-in');
        backTile.style.animationDelay = `${i * 45}ms`;
      }
      // ツモモーション: その家が引いた直後だけ最後の1枚が滑り込む
      if (i === totalCount - 1 && player.lastDrawSeq && player.lastDrawSeq !== player.drawSeqRendered) {
        backTile.classList.add('back-slide-in');
        player.drawSeqRendered = player.lastDrawSeq;
      }
      container.appendChild(backTile);
    }
  }

  // 敵の副露 (鳴き) を専用枠に描画する。暗槓は両端を伏せる
  function renderEnemyMelds(playerIdx, container) {
    if (!container) return;
    const player = game.players[playerIdx];
    if (!player) return;
    container.innerHTML = '';
    player.melds.forEach(m => {
      const meldWrap = document.createElement('div');
      meldWrap.className = 'meld-group';
      if (m.type === 'ankan' && m.tiles.length === 4) {
        const back1 = document.createElement('div');
        back1.className = 'mj-tile tile-back';
        meldWrap.appendChild(back1);
        meldWrap.appendChild(createTileDom(m.tiles[1], true));
        meldWrap.appendChild(createTileDom(m.tiles[2], true));
        const back2 = document.createElement('div');
        back2.className = 'mj-tile tile-back';
        meldWrap.appendChild(back2);
      } else {
        m.tiles.forEach(t => meldWrap.appendChild(createTileDom(t, true)));
      }
      container.appendChild(meldWrap);
    });
  }

  function renderKawa(playerIdx, container) {
    if (!container) return;
    const player = game.players[playerIdx];
    if (!player) return;
    container.innerHTML = '';

    player.kawa.forEach((item, i) => {
      const tileEl = createTileDom(item.tile, true);
      // 捨て牌は打った本人の方を向く (下家=右向き90° / 対面=180° / 上家=-90°)
      if (playerIdx > 0) tileEl.classList.add(`kawa-seat-${playerIdx}`);
      if (item.isRiichi) tileEl.classList.add('is-riichi-tile');
      // 鳴き・ロン応答待ちの対象牌は光らせ続ける (再描画されても維持)
      const pa = game.pendingActions;
      if (pa && pa.type === 'discard' && pa.discarderIdx === playerIdx && i === player.kawa.length - 1) {
        tileEl.classList.add('kawa-call-target');
      }
      // 演出: 打たれた直後の最新牌だけ、打牌者の方向から滑り込む登場アニメを付ける
      // (renderBoard の再構築方式に合わせたクラス方式。初回描画時のみ・再生は1回だけ)
      const jd = game.justDiscarded;
      if (jd && !jd.rendered && jd.playerIdx === playerIdx && i === player.kawa.length - 1) {
        tileEl.classList.add('kawa-just-placed', `kawa-drop-${playerIdx}`);
        if (item.isRiichi) tileEl.classList.add('riichi-declare-drop');
        jd.rendered = true;
      }
      // 最新の捨て牌マーカー (次の打牌まで残る)
      if (jd && jd.playerIdx === playerIdx && i === player.kawa.length - 1) {
        tileEl.classList.add('kawa-latest');
      }
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
        const waitRes = window.analyzeWaits(player.hand, player.melds.length);
        const waits = (waitRes && Array.isArray(waitRes.waits)) ? waitRes.waits : [];
        if (waits.length > 0) {
          DOM.gameAssistWaits.innerHTML = '待ち牌: ' + waits.map(w => {
            const def = window.TILE_DEFS ? window.TILE_DEFS[w.tile] : null;
            const label = def ? def.label : w.tile;
            return `<span class="assist-wait-chip">${label} (${w.remaining}枚)</span>`;
          }).join(' ');
        } else {
          DOM.gameAssistWaits.textContent = '待ち牌: なし';
        }
      }
    } else {
      DOM.gameAssistShanten.textContent = `${shanten} 向聴（シャンテン）`;
      DOM.gameAssistShanten.style.background = '#047857';
      DOM.gameAssistWaits.textContent = '手牌をタップして打牌してください';
    }
  }

  function hideActionBar() {
    if (DOM.actionBarContext) {
      DOM.actionBarContext.style.display = 'none';
      DOM.actionBarContext.innerHTML = '';
    }
    document.querySelectorAll('.kawa-call-target').forEach(el => el.classList.remove('kawa-call-target'));
    if (DOM.gameActionBar) {
      DOM.gameActionBar.style.display = 'none';
      DOM.btnActionRon.style.display = 'none';
      DOM.btnActionTsumo.style.display = 'none';
      DOM.btnActionRiichi.style.display = 'none';
      DOM.btnActionPon.style.display = 'none';
      DOM.btnActionChi.style.display = 'none';
      DOM.btnActionKan.style.display = 'none';
      if (DOM.btnActionRyukyoku) DOM.btnActionRyukyoku.style.display = 'none';
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
        const merged = {
          ...input,
          options: { kuitan: game.rules.kuitan, ...(input.options || {}) }
        };
        return window.calculateScore(merged);
      } catch (err) {
        console.error('Score calculation error:', err);
      }
    }
    // フォールバックも calculateScore と同じ返却形式にそろえる
    return {
      isAgari: true,
      isYakuman: false,
      rankTitle: '満貫',
      yakuList: [{ name: '満貫', han: 4 }],
      han: 4,
      fu: 40,
      totalPoints: 8000,
      points: { total: 8000, ron: 8000, oyaTsumo: 4000, koTsumo: 2000, honbaBonus: 0 },
      honbaBonus: 0
    };
  }

  function countDora(tiles, indicators) {
    let count = 0;
    indicators.forEach(ind => {
      const target = getNextDoraTile(ind);
      tiles.forEach(t => {
        const raw = window.normalizeTile ? window.normalizeTile(t) : t;
        if (raw === target) count++;
      });
    });
    // 赤ドラは表示牌の枚数に関わらず1枚につき1つ
    tiles.forEach(t => {
      if (t.endsWith('r')) count++;
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

  function normTileCode(t) {
    return window.normalizeTile ? window.normalizeTile(t) : t;
  }

  /**
   * 状況役の options を組み立てる (ダブルリーチ / 海底 / 河底 / 嶺上 / 天和・地和)
   * 一発は player.ippatsu がそのまま options.isIppatsu として各呼び出し側で渡される
   */
  function buildSituationalOptions(player, isTsumo) {
    const opts = { isDoubleRiichi: !!player.isDoubleRiichi };
    if (isTsumo) {
      opts.isRinshan = !!player.lastDrawWasRinshan;
      opts.isHaitei = !player.lastDrawWasRinshan && game.wall.length === 0;
      if (game.discardSeq === 0) {
        // 誰も打牌していない最初のツモ和了
        if (player.seatWind === '1z') opts.isTenhou = true;
        else opts.isChiihou = true;
      }
    } else {
      opts.isHoutei = game.wall.length === 0;
    }
    return opts;
  }

  /**
   * テンパイ時の待ち牌一覧 (正規化済みコード)。テンパイでなければ空配列
   */
  function getWaitTiles(player) {
    if (!window.analyzeWaits) return [];
    const res = window.analyzeWaits(player.hand, player.melds.length);
    if (!res || !res.isTenpai || !Array.isArray(res.waits)) return [];
    return res.waits.map(w => w.tile);
  }

  /**
   * 現在フリテンかどうか
   * (a) 捨て牌フリテン: 自分の河に自分の待ち牌がある
   * (b) 同巡内見逃しフリテン: tempFuriten (自分の次のツモで解除)
   * (c) リーチ後見逃しフリテン: riichiFuriten (その局ずっと)
   */
  function isFuritenNow(player) {
    let result = !!(player.tempFuriten || player.riichiFuriten);
    if (!result) {
      const waits = getWaitTiles(player);
      if (waits.length > 0) {
        const kawaSet = new Set(player.kawa.map(k => normTileCode(k.tile)));
        result = waits.some(w => kawaSet.has(w));
      }
    }
    player.furiten = result; // 旧フラグも同期しておく
    return result;
  }

  function showGameToast(msg, color = 'green') {
    const toast = document.createElement('div');
    toast.className = `game-toast toast-${color}`;
    toast.textContent = msg;
    // 読み上げ対応 (疑似DOM等の setAttribute が無い環境では素通り)
    if (typeof toast.setAttribute === 'function') {
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
    }
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
