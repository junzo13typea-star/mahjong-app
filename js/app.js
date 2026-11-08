/**
 * 雀聖AI (Mahjong Master Pro) - メインアプリケーションコントローラー
 */

(function() {
  'use strict';

  // --- アプリケーション状態 ---
  const state = {
    hand: [],               // 通常の手牌 (例: ['1m', '2m', '3m'])
    winTile: null,          // 和了牌 (アガリ牌)
    melds: [],              // 副露 (鳴き) [{ type: 'chi', tiles: ['1m', '2m', '3m'] }]
    doraList: [],           // ドラ表示牌 (最大5枚)
    uraDoraList: [],        // 裏ドラ表示牌 (最大5枚)
    activeDoraSlot: null,   // 現在ドラ選択中のスロット情報 { type: 'dora'|'uradora', index: number }

    // ルール・状況フラグ
    isDealer: true,         // 親 (東家) か 子か
    isTsumo: true,          // ツモ か ロンか
    bakaze: '1z',           // 場風 (1z=東, 2z=南)
    jikaze: '1z',           // 自風 (1z=東, 2z=南, 3z=西, 4z=北)
    honba: 0,
    kyotaku: 0,

    // 役オプション
    options: {
      isRiichi: false,
      isDoubleRiichi: false,
      isIppatsu: false,
      isHaitei: false,
      isHoutei: false,
      isRinshan: false,
      isChankan: false,
      isTenhou: false,
      isChiihou: false
    },

    currentTab: 'score',
    currentPaletteSuit: 'm', // 'm', 'p', 's', 'z'

    // 副露モーダルの一時状態
    meldModalState: {
      type: 'chi',
      selectedTiles: []
    }
  };

  // OCRエンジンインスタンス
  let ocrEngine = null;
  let ocrDetectedTiles = [];

  // --- DOM要素 ---
  const DOM = {};

  function cacheDomElements() {
    DOM.navTabs = document.querySelectorAll('.nav-tab');
    DOM.tabPanels = document.querySelectorAll('.tab-panel');

    DOM.handTilesContainer = document.getElementById('handTilesContainer');
    DOM.winTileSlot = document.getElementById('winTileSlot');
    DOM.handCountBadge = document.getElementById('handCountBadge');
    DOM.shantenQuickBadge = document.getElementById('shantenQuickBadge');

    DOM.btnQuickSample = document.getElementById('btnQuickSample');
    DOM.btnClearHand = document.getElementById('btnClearHand');
    DOM.btnSortHand = document.getElementById('btnSortHand');
    DOM.btnRemoveLast = document.getElementById('btnRemoveLast');

    // 牌パレット
    DOM.paletteTabs = document.querySelectorAll('.palette-tab');
    DOM.paletteTilesContainer = document.getElementById('paletteTilesContainer');

    // 点数計算タブ
    DOM.ctrlDealer = document.getElementById('ctrlDealer');
    DOM.ctrlTsumo = document.getElementById('ctrlTsumo');
    DOM.selectBakaze = document.getElementById('selectBakaze');
    DOM.selectJikaze = document.getElementById('selectJikaze');
    DOM.inputHonba = document.getElementById('inputHonba');
    DOM.inputKyotaku = document.getElementById('inputKyotaku');
    DOM.doraSlots = document.querySelectorAll('.dora-slot');
    DOM.btnCalculateScore = document.getElementById('btnCalculateScore');
    DOM.scoreResultContainer = document.getElementById('scoreResultContainer');

    // 計算結果表示
    DOM.resScoreRank = document.getElementById('resScoreRank');
    DOM.resScorePoints = document.getElementById('resScorePoints');
    DOM.resScorePayment = document.getElementById('resScorePayment');
    DOM.resHanFu = document.getElementById('resHanFu');
    DOM.resHonbaDesc = document.getElementById('resHonbaDesc');
    DOM.resKyotakuDesc = document.getElementById('resKyotakuDesc');
    DOM.resYakuList = document.getElementById('resYakuList');
    DOM.resFuList = document.getElementById('resFuList');
    DOM.resTotalFuCalc = document.getElementById('resTotalFuCalc');
    DOM.resDecompDisplay = document.getElementById('resDecompDisplay');

    // 待ち牌タブ
    DOM.shantenStatusText = document.getElementById('shantenStatusText');
    DOM.waitSummaryBadge = document.getElementById('waitSummaryBadge');
    DOM.waitTilesGrid = document.getElementById('waitTilesGrid');
    DOM.waitShapeExplanation = document.getElementById('waitShapeExplanation');
    DOM.waitShapeTag = document.getElementById('waitShapeTag');
    DOM.waitShapeDesc = document.getElementById('waitShapeDesc');
    DOM.discardAssistSection = document.getElementById('discardAssistSection');
    DOM.discardCandidatesGrid = document.getElementById('discardCandidatesGrid');
    DOM.statGeneralShanten = document.getElementById('statGeneralShanten');
    DOM.statChitoiShanten = document.getElementById('statChitoiShanten');
    DOM.statKokushiShanten = document.getElementById('statKokushiShanten');

    // OCRタブ
    DOM.cameraVideo = document.getElementById('cameraVideo');
    DOM.ocrCanvas = document.getElementById('ocrCanvas');
    DOM.cameraPlaceholder = document.getElementById('cameraPlaceholder');
    DOM.cameraControls = document.getElementById('cameraControls');
    DOM.btnStartCamera = document.getElementById('btnStartCamera');
    DOM.btnStopCamera = document.getElementById('btnStopCamera');
    DOM.btnCapturePhoto = document.getElementById('btnCapturePhoto');
    DOM.fileInputOcr = document.getElementById('fileInputOcr');
    DOM.ocrResultCard = document.getElementById('ocrResultCard');
    DOM.ocrDetectedTiles = document.getElementById('ocrDetectedTiles');
    DOM.btnApplyOcrToHand = document.getElementById('btnApplyOcrToHand');
    DOM.btnApplyOcrToWait = document.getElementById('btnApplyOcrToWait');

    // 早見表タブ
    DOM.btnShowKoTable = document.getElementById('btnShowKoTable');
    DOM.btnShowOyaTable = document.getElementById('btnShowOyaTable');
    DOM.tableKoWrap = document.getElementById('tableKoWrap');
    DOM.tableOyaWrap = document.getElementById('tableOyaWrap');

    // 副露モーダル
    DOM.meldModal = document.getElementById('meldModal');
    DOM.btnAddMeldModal = document.getElementById('btnAddMeldModal');
    DOM.btnCloseMeldModal = document.getElementById('btnCloseMeldModal');
    DOM.btnCancelMeld = document.getElementById('btnCancelMeld');
    DOM.btnConfirmMeld = document.getElementById('btnConfirmMeld');
    DOM.meldStagingTiles = document.getElementById('meldStagingTiles');
    DOM.meldPickerPalette = document.getElementById('meldPickerPalette');
    DOM.meldPromptText = document.getElementById('meldPromptText');
    DOM.meldsArea = document.getElementById('meldsArea');
    DOM.meldsList = document.getElementById('meldsList');
  }

  // --- 初期化 ---
  function init() {
    cacheDomElements();
    setupEventListeners();
    renderPalette();
    renderHand();
    updateShantenDisplay();

    // デフォルトでサンプル牌姿を1つロード（清一色・多面張テンパイ）
    loadSampleHand(0);
  }

  // --- イベントリスナー設定 ---
  function setupEventListeners() {
    // タブ切り替え
    DOM.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });

    // 牌パレットのスート切り替え
    DOM.paletteTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        DOM.paletteTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.currentPaletteSuit = tab.getAttribute('data-suit');
        renderPalette();
      });
    });

    // 手牌操作コントロール
    DOM.btnSortHand.addEventListener('click', sortHand);
    DOM.btnRemoveLast.addEventListener('click', removeLastTile);
    DOM.btnClearHand.addEventListener('click', clearAll);
    DOM.btnQuickSample.addEventListener('click', cycleSampleHands);

    // 和了牌スロットのタップ
    DOM.winTileSlot.addEventListener('click', () => {
      if (state.winTile) {
        // 和了牌を手牌に戻す
        state.hand.push(state.winTile);
        state.winTile = null;
        renderHand();
        updateShantenDisplay();
      }
    });

    // 和了条件切り替え (親/子, ツモ/ロン)
    DOM.ctrlDealer.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.ctrlDealer.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.isDealer = (btn.getAttribute('data-value') === 'true');
        DOM.selectJikaze.value = state.isDealer ? '1z' : '2z';
        state.jikaze = DOM.selectJikaze.value;
      });
    });

    DOM.ctrlTsumo.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.ctrlTsumo.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.isTsumo = (btn.getAttribute('data-value') === 'true');
      });
    });

    // 場風・自風
    DOM.selectBakaze.addEventListener('change', (e) => {
      state.bakaze = e.target.value;
    });
    DOM.selectJikaze.addEventListener('change', (e) => {
      state.jikaze = e.target.value;
      const isOya = (e.target.value === '1z');
      state.isDealer = isOya;
      DOM.ctrlDealer.querySelectorAll('.seg-btn').forEach(b => {
        b.classList.toggle('active', (b.getAttribute('data-value') === 'true') === isOya);
      });
    });

    // 本場 & 供託
    DOM.inputHonba.addEventListener('change', (e) => {
      state.honba = Math.max(0, parseInt(e.target.value, 10) || 0);
    });
    DOM.inputKyotaku.addEventListener('change', (e) => {
      state.kyotaku = Math.max(0, parseInt(e.target.value, 10) || 0);
    });

    // ドラ枠クリック
    DOM.doraSlots.forEach(slot => {
      slot.addEventListener('click', () => {
        const type = slot.getAttribute('data-type');
        const index = parseInt(slot.getAttribute('data-index'), 10);
        const list = (type === 'dora') ? state.doraList : state.uraDoraList;

        if (list[index]) {
          // すでに設定されている牌をクリックしたら削除
          list.splice(index, 1);
          state.activeDoraSlot = null;
          renderDoraSlots();
        } else {
          // 選択モードにセット
          state.activeDoraSlot = { type, index };
          renderDoraSlots();
        }
      });
    });

    // 役チェックボックス群
    const flagIds = ['chkRiichi', 'chkDoubleRiichi', 'chkIppatsu', 'chkHaitei', 'chkHoutei', 'chkRinshan', 'chkChankan', 'chkTenhou', 'chkChiihou'];
    flagIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', (e) => {
          const optKey = 'is' + id.substring(3);
          state.options[optKey] = e.target.checked;
        });
      }
    });

    // 計算ボタン
    DOM.btnCalculateScore.addEventListener('click', handleCalculateScore);

    // 早見表切り替え
    DOM.btnShowKoTable.addEventListener('click', () => {
      DOM.btnShowKoTable.classList.add('active');
      DOM.btnShowOyaTable.classList.remove('active');
      DOM.tableKoWrap.classList.remove('hidden');
      DOM.tableOyaWrap.classList.add('hidden');
    });
    DOM.btnShowOyaTable.addEventListener('click', () => {
      DOM.btnShowOyaTable.classList.add('active');
      DOM.btnShowKoTable.classList.remove('active');
      DOM.tableOyaWrap.classList.remove('hidden');
      DOM.tableKoWrap.classList.add('hidden');
    });

    // OCR関連イベント
    setupOcrEvents();

    // 副露モーダルイベント
    setupMeldModalEvents();
  }

  // --- タブ切り替え ---
  function switchTab(tabId) {
    state.currentTab = tabId;
    DOM.navTabs.forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });
    DOM.tabPanels.forEach(p => {
      p.classList.toggle('active', p.id === `tab-${tabId}`);
    });

    if (tabId === 'wait') {
      updateShantenDisplay();
    }
  }

  // --- 牌パレット描画 ---
  function renderPalette() {
    DOM.paletteTilesContainer.innerHTML = '';
    const suit = state.currentPaletteSuit;

    let tilesToRender = [];
    if (suit === 'm') {
      tilesToRender = ['1m', '2m', '3m', '4m', '5m', '5mr', '6m', '7m', '8m', '9m'];
    } else if (suit === 'p') {
      tilesToRender = ['1p', '2p', '3p', '4p', '5p', '5pr', '6p', '7p', '8p', '9p'];
    } else if (suit === 's') {
      tilesToRender = ['1s', '2s', '3s', '4s', '5s', '5sr', '6s', '7s', '8s', '9s'];
    } else if (suit === 'z') {
      tilesToRender = ['1z', '2z', '3z', '4z', '5z', '6z', '7z'];
    }

    tilesToRender.forEach(tileKey => {
      const tileNode = createTileElement(tileKey, false);
      tileNode.addEventListener('click', () => handlePaletteTileClick(tileKey));
      DOM.paletteTilesContainer.appendChild(tileNode);
    });
  }

  // 牌DOM要素の生成
  function createTileElement(tileKey, isSmall) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = window.renderTileHtml(tileKey, { isSmall });
    return wrapper.firstElementChild;
  }

  // パレットの牌がタップされた時の処理
  function handlePaletteTileClick(tileKey) {
    // もしドラ枠選択中の場合、ドラ牌として登録
    if (state.activeDoraSlot) {
      const { type, index } = state.activeDoraSlot;
      const list = (type === 'dora') ? state.doraList : state.uraDoraList;
      list[index] = tileKey;
      state.activeDoraSlot = null;
      renderDoraSlots();
      return;
    }

    // 手牌枚数チェック (最大14枚 = 手牌 + 鳴き*3 + 和了牌)
    const meldTileCount = state.melds.length * 3;
    const currentTotal = state.hand.length + meldTileCount + (state.winTile ? 1 : 0);

    if (currentTotal >= 14) {
      // 13枚の状態で14枚目を押したら自動的に和了牌にセット
      if (currentTotal === 13 && !state.winTile) {
        state.winTile = tileKey;
        renderHand();
        updateShantenDisplay();
        return;
      }
      showToast('手牌は最大14枚です');
      return;
    }

    // 13枚揃っている状態で14枚目を追加する場合は和了牌へセット
    if (state.hand.length + meldTileCount === 13 && !state.winTile) {
      state.winTile = tileKey;
    } else {
      state.hand.push(tileKey);
    }

    renderHand();
    updateShantenDisplay();
  }

  // --- 手牌トレイ描画 ---
  function renderHand() {
    DOM.handTilesContainer.innerHTML = '';
    const totalCount = state.hand.length + (state.melds.length * 3) + (state.winTile ? 1 : 0);
    DOM.handCountBadge.textContent = `${totalCount} / 14枚`;

    if (state.hand.length === 0 && !state.winTile) {
      DOM.handTilesContainer.innerHTML = '<div class="empty-tray-msg">下の牌パレットをタップして手牌を入力してください</div>';
    } else {
      state.hand.forEach((tileKey, idx) => {
        const tileNode = createTileElement(tileKey, false);
        // 手牌牌をタップしたときの挙動
        tileNode.addEventListener('click', () => {
          // 和了牌が空いていて14枚目の状態なら和了牌にセットできる
          // あるいはタップで手牌から消去
          handleHandTileClick(idx);
        });
        DOM.handTilesContainer.appendChild(tileNode);
      });
    }

    // 和了牌スロットの描画
    DOM.winTileSlot.innerHTML = '';
    if (state.winTile) {
      const winTileNode = createTileElement(state.winTile, false);
      DOM.winTileSlot.appendChild(winTileNode);
    } else {
      DOM.winTileSlot.innerHTML = '<span class="slot-placeholder">？</span>';
    }

    // 副露（鳴き）エリア
    renderMelds();
  }

  // 手牌の牌をタップした時の処理
  function handleHandTileClick(index) {
    const tile = state.hand[index];
    // もし和了牌が未指定で、手牌が14枚ある場合はこの牌を和了牌にする
    if (!state.winTile && state.hand.length + (state.melds.length * 3) === 14) {
      state.winTile = tile;
      state.hand.splice(index, 1);
    } else {
      // それ以外は削除
      state.hand.splice(index, 1);
    }
    renderHand();
    updateShantenDisplay();
  }

  // 理牌（ソート）
  function sortHand() {
    state.hand.sort((a, b) => {
      const idxA = window.tileToIndex(a);
      const idxB = window.tileToIndex(b);
      return idxA - idxB;
    });
    renderHand();
  }

  // 1枚消去
  function removeLastTile() {
    if (state.winTile) {
      state.winTile = null;
    } else if (state.hand.length > 0) {
      state.hand.pop();
    }
    renderHand();
    updateShantenDisplay();
  }

  // 全消去
  function clearAll() {
    state.hand = [];
    state.winTile = null;
    state.melds = [];
    DOM.scoreResultContainer.classList.add('hidden');
    renderHand();
    updateShantenDisplay();
  }

  // ドラ枠の描画
  function renderDoraSlots() {
    DOM.doraSlots.forEach(slot => {
      const type = slot.getAttribute('data-type');
      const index = parseInt(slot.getAttribute('data-index'), 10);
      const list = (type === 'dora') ? state.doraList : state.uraDoraList;
      const tileKey = list[index];

      slot.innerHTML = '';
      slot.classList.remove('selected');

      if (state.activeDoraSlot && state.activeDoraSlot.type === type && state.activeDoraSlot.index === index) {
        slot.classList.add('selected');
        slot.textContent = '選択中';
      } else if (tileKey) {
        const tNode = createTileElement(tileKey, true);
        slot.appendChild(tNode);
      } else {
        slot.textContent = '＋';
      }
    });
  }

  // 副露（鳴き）表示
  function renderMelds() {
    if (state.melds.length === 0) {
      DOM.meldsArea.classList.add('hidden');
      return;
    }
    DOM.meldsArea.classList.remove('hidden');
    DOM.meldsList.innerHTML = '';

    state.melds.forEach((meld, mIdx) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'meld-group';

      meld.tiles.forEach(tKey => {
        const tEl = createTileElement(tKey, true);
        groupEl.appendChild(tEl);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-del-meld';
      delBtn.textContent = '×';
      delBtn.title = '鳴きを解除';
      delBtn.addEventListener('click', () => {
        state.melds.splice(mIdx, 1);
        renderHand();
        updateShantenDisplay();
      });
      groupEl.appendChild(delBtn);

      DOM.meldsList.appendChild(groupEl);
    });
  }

  // --- シャンテン数・待ち牌判定の更新 ---
  function updateShantenDisplay() {
    const fullHand = [...state.hand];
    if (state.winTile) fullHand.push(state.winTile);

    if (fullHand.length === 0) {
      DOM.shantenQuickBadge.textContent = '-';
      DOM.shantenStatusText.textContent = '手牌を入力してください';
      DOM.waitSummaryBadge.textContent = '手牌なし';
      DOM.waitTilesGrid.innerHTML = '';
      DOM.waitShapeExplanation.classList.add('hidden');
      DOM.discardAssistSection.classList.add('hidden');
      DOM.statGeneralShanten.textContent = '-';
      DOM.statChitoiShanten.textContent = '-';
      DOM.statKokushiShanten.textContent = '-';
      return;
    }

    const counts = window.handToCounts(fullHand);
    const shantenRes = window.calculateShanten(counts);
    const minShanten = shantenRes.min;

    // 向聴バッジ更新
    let badgeText = '';
    if (minShanten === -1) {
      badgeText = '和了 (アガリ)';
    } else if (minShanten === 0) {
      badgeText = '聴牌 (テンパイ)';
    } else {
      badgeText = `${minShanten}向聴`;
    }
    DOM.shantenQuickBadge.textContent = badgeText;
    DOM.shantenStatusText.textContent = badgeText;

    DOM.statGeneralShanten.textContent = shantenRes.general >= 99 ? '不可' : `${shantenRes.general}向聴`;
    DOM.statChitoiShanten.textContent = shantenRes.chitoi >= 99 ? '不可' : `${shantenRes.chitoi}向聴`;
    DOM.statKokushiShanten.textContent = shantenRes.kokushi >= 99 ? '不可' : `${shantenRes.kokushi}向聴`;

    // 待ち牌・テンパイ解析
    // テンパイ判定は「13枚の手牌」に対して行う
    let hand13 = [...state.hand];
    if (fullHand.length === 14) {
      // 14枚ある場合は、和了判定または打牌アシスト
      if (minShanten === -1) {
        // 和了形
        renderTenpaiWaits(fullHand, true);
        DOM.discardAssistSection.classList.add('hidden');
      } else {
        // 14枚でノーテンまたはテンパイからの打牌選択
        renderDiscardAssist(fullHand);
      }
    } else {
      // 13枚以下の場合は待ち牌解析
      renderTenpaiWaits(fullHand, false);
      DOM.discardAssistSection.classList.add('hidden');
    }
  }

  // 待ち牌グリッドの描画
  function renderTenpaiWaits(tiles, is14Tiles) {
    const waitAnalysis = window.analyzeWaits(tiles);

    if (waitAnalysis.isTenpai && waitAnalysis.waits.length > 0) {
      DOM.waitSummaryBadge.textContent = `待ち: 計 ${waitAnalysis.totalWaitCount} 枚 (${waitAnalysis.waits.length}種)`;
      DOM.waitTilesGrid.innerHTML = '';

      waitAnalysis.waits.forEach(w => {
        const card = document.createElement('div');
        card.className = 'wait-tile-card';

        const tileEl = createTileElement(w.tile, false);
        card.appendChild(tileEl);

        const countText = document.createElement('div');
        countText.className = 'wait-card-count';
        countText.innerHTML = `残り <span class="count-num">${w.remaining}</span> 枚`;
        card.appendChild(countText);

        const meter = document.createElement('div');
        meter.className = 'wait-meter-bar';
        const fill = document.createElement('div');
        fill.className = 'wait-meter-fill';
        fill.style.width = `${(w.remaining / 4) * 100}%`;
        meter.appendChild(fill);
        card.appendChild(meter);

        // クリックで和了牌にセットして点数計算タブへジャンプ
        card.title = 'クリックしてこの牌で和了';
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          state.winTile = w.tile;
          // 手牌にすでに入っていたら調整
          renderHand();
          switchTab('score');
          handleCalculateScore();
        });

        DOM.waitTilesGrid.appendChild(card);
      });

      // 待ち形状の解説
      DOM.waitShapeExplanation.classList.remove('hidden');
      DOM.waitShapeTag.textContent = waitAnalysis.shapeType;
      DOM.waitShapeDesc.textContent = getShapeDescription(waitAnalysis.shapeType, waitAnalysis.waits.length);
    } else {
      DOM.waitSummaryBadge.textContent = 'ノーテン（テンパイしていません）';
      DOM.waitTilesGrid.innerHTML = '<p class="assist-note">手牌を揃えてテンパイすると、ここに待ち牌と残り枚数がリアルタイム表示されます。</p>';
      DOM.waitShapeExplanation.classList.add('hidden');
    }
  }

  function getShapeDescription(shapeType, count) {
    if (shapeType.includes('両面')) {
      return '両面待ち（リャンメン）：順子の両端を待つ最も基本的でアガリやすい形です。';
    }
    if (shapeType.includes('嵌張')) {
      return '嵌張待ち（カンチャン）：順子の真ん中を待つ形です（例: 2・4で3待ち）。';
    }
    if (shapeType.includes('辺張')) {
      return '辺張待ち（ペンチャン）：1・2で3待ち、または8・9で7待ちの端待ちです。';
    }
    if (shapeType.includes('単騎')) {
      return '単騎待ち（タンキ）：雀頭（アタマ）を待つ形です。符計算で2符加算されます。';
    }
    if (shapeType.includes('双ポン')) {
      return '双ポン待ち（シャンポン）：2組の対子のうち、どちらかを刻子にする待ちです。';
    }
    if (shapeType.includes('3面張')) {
      return '3面張待ち（サンメンチャン）：順子が連続した美しい多面待ちです（例: 23456で1-4-7待ち）。';
    }
    return `${count}面待ちの変則多面張です。状況に応じて高得点の役を狙えます。`;
  }

  // 14枚時の打牌アシスト（何切る？）
  function renderDiscardAssist(full14) {
    DOM.discardAssistSection.classList.remove('hidden');
    DOM.discardCandidatesGrid.innerHTML = '';

    // 重複する牌種をユニーク化
    const uniqueTiles = [...new Set(full14)];
    const candidates = [];

    uniqueTiles.forEach(discardTile => {
      // この牌を1枚抜いた手牌
      const remainingHand = [...full14];
      const removeIdx = remainingHand.indexOf(discardTile);
      remainingHand.splice(removeIdx, 1);

      const counts = window.handToCounts(remainingHand);
      const sh = window.calculateShanten(counts);
      const waits = window.analyzeWaits(remainingHand);

      candidates.push({
        discard: discardTile,
        shanten: sh.min,
        waitCount: waits.totalWaitCount,
        waits: waits.waits
      });
    });

    // シャンテン数が少ない順、受け入れ枚数が多い順にソート
    candidates.sort((a, b) => {
      if (a.shanten !== b.shanten) return a.shanten - b.shanten;
      return b.waitCount - a.waitCount;
    });

    candidates.forEach(cand => {
      const card = document.createElement('div');
      card.className = 'discard-candidate-card';

      const tileEl = createTileElement(cand.discard, true);
      card.appendChild(tileEl);

      const info = document.createElement('div');
      info.className = 'discard-candidate-info';

      let shantenLabel = cand.shanten === 0 ? '聴牌 (テンパイ)' : `${cand.shanten}向聴`;
      info.innerHTML = `
        <span class="discard-cut-label">切: ${cand.discard}</span>
        <span class="discard-shanten-res">→ ${shantenLabel}</span>
        <span class="discard-wait-count">受入: ${cand.waitCount}枚 (${cand.waits.length}種)</span>
      `;
      card.appendChild(info);

      // クリックでその牌を捨てて13枚に
      card.addEventListener('click', () => {
        const idx = state.hand.indexOf(cand.discard);
        if (idx !== -1) {
          state.hand.splice(idx, 1);
        } else if (state.winTile === cand.discard) {
          state.winTile = null;
        }
        renderHand();
        updateShantenDisplay();
      });

      DOM.discardCandidatesGrid.appendChild(card);
    });
  }

  // --- 点数計算ハンドラー ---
  function handleCalculateScore() {
    // 手牌の準備
    const fullHand = [...state.hand];
    let winTile = state.winTile;

    if (!winTile) {
      if (fullHand.length === 14) {
        // 14枚の手牌の最後の牌を和了牌とみなす
        winTile = fullHand[fullHand.length - 1];
      } else {
        showToast('和了牌（アガリ牌）を指定するか、手牌を14枚入力してください');
        return;
      }
    }

    const totalCount = fullHand.length + (state.winTile ? 1 : 0) + (state.melds.length * 3);
    if (totalCount !== 14) {
      showToast(`手牌が合計14枚になっていません (現在: ${totalCount}枚)`);
      return;
    }

    // ドラの結合
    const allDoras = [...state.doraList.filter(Boolean)];
    const allUraDoras = [...state.uraDoraList.filter(Boolean)];

    // 計算実行
    const calcInput = {
      hand: fullHand,
      winTile: winTile,
      isTsumo: state.isTsumo,
      isDealer: state.isDealer,
      melds: state.melds,
      doraTiles: allDoras,
      uraDoraTiles: allUraDoras,
      options: state.options,
      bakaze: state.bakaze,
      jikaze: state.jikaze,
      honba: state.honba,
      kyotaku: state.kyotaku
    };

    const result = window.calculateScore(calcInput);

    if (result.error) {
      showToast(result.error);
      return;
    }

    renderScoreResult(result);
  }

  // 点数計算結果のレンダリング
  function renderScoreResult(res) {
    DOM.scoreResultContainer.classList.remove('hidden');
    DOM.scoreResultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // ランク & 得点
    DOM.resScoreRank.textContent = res.rankTitle ? `【${res.rankTitle}】` : '';
    DOM.resScorePoints.innerHTML = `${res.points.total.toLocaleString()} <span class="pts-unit">点</span>`;

    // 支払い内訳テキスト
    let paymentDesc = '';
    if (res.isDealer) {
      if (res.isTsumo) {
        paymentDesc = `（子：各 ${res.points.koTsumo.toLocaleString()} 点オール）`;
      } else {
        paymentDesc = `（放銃者：${res.points.ron.toLocaleString()} 点）`;
      }
    } else {
      if (res.isTsumo) {
        paymentDesc = `（親：${res.points.oyaTsumo.toLocaleString()} 点 / 子：各 ${res.points.koTsumo.toLocaleString()} 点）`;
      } else {
        paymentDesc = `（放銃者：${res.points.ron.toLocaleString()} 点）`;
      }
    }
    DOM.resScorePayment.textContent = paymentDesc;

    // 翻数・符数バッジ
    if (res.isYakuman) {
      DOM.resHanFu.textContent = `役満 (${res.yakumanMultiplier}倍役満)`;
    } else {
      DOM.resHanFu.textContent = `${res.han} 翻  ${res.fu} 符`;
    }

    DOM.resHonbaDesc.textContent = `本場加算: +${(res.points.honbaBonus || 0).toLocaleString()}点 (${res.honba}本場)`;
    DOM.resKyotakuDesc.textContent = `供託受取: +${((res.kyotaku || 0) * 1000).toLocaleString()}点 (${res.kyotaku}本)`;

    // 役一覧
    DOM.resYakuList.innerHTML = '';
    res.yakuList.forEach(y => {
      const item = document.createElement('div');
      item.className = 'yaku-item';
      item.innerHTML = `
        <span class="yaku-name">${y.name}</span>
        <span class="yaku-han">${y.isYakuman ? '役満' : `${y.han}翻`}</span>
      `;
      DOM.resYakuList.appendChild(item);
    });

    // 符の内訳詳細
    DOM.resFuList.innerHTML = '';
    DOM.resTotalFuCalc.textContent = `${res.fu}符`;
    if (res.fuDetails && res.fuDetails.length > 0) {
      res.fuDetails.forEach(f => {
        const fItem = document.createElement('div');
        fItem.className = 'fu-item';
        fItem.innerHTML = `
          <span>${f.desc}</span>
          <span>${f.fu} 符</span>
        `;
        DOM.resFuList.appendChild(fItem);
      });
      document.getElementById('fuDetailBlock').classList.remove('hidden');
    } else {
      document.getElementById('fuDetailBlock').classList.add('hidden');
    }

    // 面子構成の描画
    DOM.resDecompDisplay.innerHTML = '';
    if (res.bestDecomp) {
      // 雀頭
      if (res.bestDecomp.head) {
        const headGroup = document.createElement('div');
        headGroup.className = 'decomp-group';
        headGroup.title = '雀頭 (アタマ)';
        headGroup.appendChild(createTileElement(res.bestDecomp.head, true));
        headGroup.appendChild(createTileElement(res.bestDecomp.head, true));
        DOM.resDecompDisplay.appendChild(headGroup);
      }
      // 面子
      if (res.bestDecomp.mentsu) {
        res.bestDecomp.mentsu.forEach(m => {
          const mGroup = document.createElement('div');
          mGroup.className = 'decomp-group';
          mGroup.title = m.type === 'shuntsu' ? '順子' : '刻子';
          m.tiles.forEach(t => {
            mGroup.appendChild(createTileElement(t, true));
          });
          DOM.resDecompDisplay.appendChild(mGroup);
        });
      }
    }
  }

  // --- OCRカメラスキャナー関連 ---
  function setupOcrEvents() {
    ocrEngine = new window.MahjongOcrEngine();

    DOM.btnStartCamera.addEventListener('click', async () => {
      try {
        await ocrEngine.startCamera(DOM.cameraVideo);
        DOM.cameraVideo.classList.remove('hidden');
        DOM.cameraPlaceholder.classList.add('hidden');
        DOM.cameraControls.classList.remove('hidden');
      } catch (err) {
        alert('カメラの起動に失敗しました: ' + err.message);
      }
    });

    DOM.btnStopCamera.addEventListener('click', () => {
      ocrEngine.stopCamera();
      DOM.cameraVideo.classList.add('hidden');
      DOM.cameraPlaceholder.classList.remove('hidden');
      DOM.cameraControls.classList.add('hidden');
    });

    DOM.btnCapturePhoto.addEventListener('click', () => {
      const snap = ocrEngine.captureSnapshot(DOM.cameraVideo);
      if (snap) {
        processOcrImage(snap.image);
      }
    });

    DOM.fileInputOcr.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            processOcrImage(img);
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });

    DOM.btnApplyOcrToHand.addEventListener('click', () => {
      if (ocrDetectedTiles.length > 0) {
        state.hand = [...ocrDetectedTiles.slice(0, 13)];
        state.winTile = ocrDetectedTiles[13] || null;
        renderHand();
        switchTab('score');
        handleCalculateScore();
      }
    });

    DOM.btnApplyOcrToWait.addEventListener('click', () => {
      if (ocrDetectedTiles.length > 0) {
        state.hand = [...ocrDetectedTiles.slice(0, 13)];
        state.winTile = ocrDetectedTiles[13] || null;
        renderHand();
        switchTab('wait');
      }
    });
  }

  // OCR画像解析実行
  function processOcrImage(imgElement) {
    const detected = ocrEngine.detectHandFromImage(imgElement, 14);
    ocrDetectedTiles = detected;

    DOM.ocrResultCard.classList.remove('hidden');
    DOM.ocrDetectedTiles.innerHTML = '';

    detected.forEach((tileKey, idx) => {
      const tEl = createTileElement(tileKey, false);
      tEl.title = 'クリックしてこの牌を変更';
      // タップで別スート・別数字に変更できるクイック修正
      tEl.addEventListener('click', () => {
        promptEditOcrTile(idx);
      });
      DOM.ocrDetectedTiles.appendChild(tEl);
    });

    showToast(`手牌14枚を検出しました！誤認識があれば牌をタップして修正できます。`);
  }

  function promptEditOcrTile(idx) {
    const current = ocrDetectedTiles[idx];
    const newTile = prompt(`牌の修正（例: 1m, 5p, 7s, 1z）`, current);
    if (newTile && window.TILE_DEFS[newTile]) {
      ocrDetectedTiles[idx] = newTile;
      DOM.ocrDetectedTiles.children[idx].replaceWith(createTileElement(newTile, false));
    }
  }

  // --- 副露（鳴き）モーダル関連 ---
  function setupMeldModalEvents() {
    DOM.btnAddMeldModal.addEventListener('click', () => {
      state.meldModalState.selectedTiles = [];
      state.meldModalState.type = 'chi';
      DOM.meldModal.classList.remove('hidden');
      renderMeldPickerPalette();
      renderMeldStaging();
    });

    DOM.btnCloseMeldModal.addEventListener('click', () => DOM.meldModal.classList.add('hidden'));
    DOM.btnCancelMeld.addEventListener('click', () => DOM.meldModal.classList.add('hidden'));

    DOM.meldModal.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.meldModal.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.meldModalState.type = btn.getAttribute('data-meld-type');
        state.meldModalState.selectedTiles = [];
        renderMeldStaging();
      });
    });

    DOM.btnConfirmMeld.addEventListener('click', () => {
      const { type, selectedTiles } = state.meldModalState;
      state.melds.push({
        type: type,
        tiles: [...selectedTiles]
      });
      DOM.meldModal.classList.add('hidden');
      renderHand();
      updateShantenDisplay();
    });
  }

  function renderMeldPickerPalette() {
    DOM.meldPickerPalette.innerHTML = '';
    window.ALL_BASE_TILES.forEach(tKey => {
      const tEl = createTileElement(tKey, true);
      tEl.addEventListener('click', () => {
        const reqCount = (state.meldModalState.type === 'kan' || state.meldModalState.type === 'ankan') ? 4 : 3;
        if (state.meldModalState.selectedTiles.length < reqCount) {
          state.meldModalState.selectedTiles.push(tKey);
          renderMeldStaging();
        }
      });
      DOM.meldPickerPalette.appendChild(tEl);
    });
  }

  function renderMeldStaging() {
    DOM.meldStagingTiles.innerHTML = '';
    const reqCount = (state.meldModalState.type === 'kan' || state.meldModalState.type === 'ankan') ? 4 : 3;
    DOM.meldPromptText.textContent = `牌をタップして選択してください (${state.meldModalState.selectedTiles.length} / ${reqCount}枚)`;

    state.meldModalState.selectedTiles.forEach((tKey, idx) => {
      const tEl = createTileElement(tKey, false);
      tEl.addEventListener('click', () => {
        state.meldModalState.selectedTiles.splice(idx, 1);
        renderMeldStaging();
      });
      DOM.meldStagingTiles.appendChild(tEl);
    });

    DOM.btnConfirmMeld.disabled = (state.meldModalState.selectedTiles.length !== reqCount);
  }

  // --- サンプル牌姿プリセット ---
  const SAMPLE_HANDS = [
    {
      name: '清一色・多面張（5面待ち）',
      hand: ['2m', '3m', '4m', '5m', '6m', '7m', '8m', '2m', '3m', '4m', '5m', '5m', '5m'],
      winTile: '1m',
      options: { isRiichi: true },
      dora: ['9p']
    },
    {
      name: '国士無双 13面待ち',
      hand: ['1m', '9m', '1p', '9p', '1s', '9s', '1z', '2z', '3z', '4z', '5z', '6z', '7z'],
      winTile: '1m',
      options: { isTenhou: false },
      dora: ['5m']
    },
    {
      name: '大三元・字一色・四暗刻単騎 (トリプル役満)',
      hand: ['5z', '5z', '5z', '6z', '6z', '6z', '7z', '7z', '7z', '1z', '1z', '1z', '2z'],
      winTile: '2z',
      options: {},
      dora: ['5z']
    },
    {
      name: '門前清自摸和・平和・赤ドラ2 (満貫)',
      hand: ['2m', '3m', '4m', '5mr', '6m', '7m', '2p', '3p', '4p', '7s', '8s', '9s', '2s'],
      winTile: '2s',
      isTsumo: true,
      options: { isRiichi: false },
      dora: ['4m']
    },
    {
      name: '七対子・ドラ2 (4翻50符)',
      hand: ['1m', '1m', '4m', '4m', '9p', '9p', '2s', '2s', '6s', '6s', '1z', '1z', '7z'],
      winTile: '7z',
      options: { isRiichi: true },
      dora: ['1m']
    }
  ];

  let sampleIndex = 0;
  function cycleSampleHands() {
    sampleIndex = (sampleIndex + 1) % SAMPLE_HANDS.length;
    loadSampleHand(sampleIndex);
  }

  function loadSampleHand(idx) {
    const s = SAMPLE_HANDS[idx];
    state.hand = [...s.hand];
    state.winTile = s.winTile;
    state.melds = [];
    state.doraList = s.dora ? [...s.dora] : [];
    state.uraDoraList = [];
    state.isTsumo = s.isTsumo !== undefined ? s.isTsumo : true;

    // リセット＆適用
    renderHand();
    renderDoraSlots();
    updateShantenDisplay();
    showToast(`サンプルを読み込みました: ${s.name}`);
  }

  // トースト通知
  function showToast(msg) {
    const existing = document.querySelector('.mahjong-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'mahjong-toast';
    toast.textContent = msg;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(4, 30, 23, 0.95);
      color: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 20px;
      padding: 8px 18px;
      font-size: 0.85rem;
      font-weight: 700;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
      z-index: 9999;
      animation: fadeIn 0.2s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2800);
  }

  // DOMContentLoadedで起動
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

