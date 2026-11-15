/**
 * 牌譜 (対局記録) の記録と再生エンジン
 * - 記録: 局ごとに牌山の順序と全アクションを localStorage へ保存する (直近10対局)。
 *   記録処理の失敗が対局の進行を妨げないよう、例外はすべて握りつぶす。
 * - 再生: 記録どおりに牌を動かして盤面を再構成する (判断ロジックは再生に不要)。
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'mahjong_kifu_v1';
  const MAX_GAMES = 10;

  function normTile(code) {
    if (global.normalizeTile) return global.normalizeTile(code);
    return (typeof code === 'string' && code.length === 3 && code[2] === 'r') ? code.slice(0, 2) : code;
  }

  function sortHand(hand) {
    const suitOrder = { m: 0, p: 1, s: 2, z: 3 };
    hand.sort((a, b) => {
      if (suitOrder[a[1]] !== suitOrder[b[1]]) return suitOrder[a[1]] - suitOrder[b[1]];
      return parseInt(a[0], 10) - parseInt(b[0], 10);
    });
    return hand;
  }

  // ---------------- 記録 ----------------

  let current = null; // 進行中の対局レコード
  let round = null;   // 進行中の局レコード

  function safe(fn) { try { fn(); } catch (e) { /* 記録の失敗で対局を止めない */ } }

  function loadAll(storage) {
    try {
      const raw = (storage || global.localStorage).getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function persistCurrent(storage) {
    if (!current) return;
    try {
      const list = loadAll(storage).filter(g => g.id !== current.id);
      list.push(current);
      while (list.length > MAX_GAMES) list.shift();
      (storage || global.localStorage).setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) { /* 容量超過などは無視 */ }
  }

  const recorder = {
    beginGame(info) {
      safe(() => {
        current = {
          id: 'g' + Date.now(),
          date: new Date().toISOString(),
          playerCount: info.playerCount,
          matchLength: info.matchLength,
          names: info.names ? [...info.names] : null,
          rounds: [],
          finalScores: null,
          finalRank: null,
        };
        round = null;
      });
    },
    startRound(meta) {
      safe(() => {
        if (!current) {
          recorder.beginGame({ playerCount: meta.playerCount, matchLength: meta.matchLength });
        }
        round = {
          roundWind: meta.roundWind,
          roundNum: meta.roundNum,
          honba: meta.honba,
          dealerIdx: meta.dealerIdx,
          playerCount: meta.playerCount,
          wall: [...meta.wall],
          startScores: [...meta.startScores],
          events: [],
          end: null,
        };
        current.rounds.push(round);
      });
    },
    event(ev) {
      safe(() => { if (round && !round.end) round.events.push(ev); });
    },
    endRound(end, storage) {
      safe(() => {
        if (!round) return;
        round.end = end;
        round = null;
        persistCurrent(storage);
      });
    },
    finishGame(finalScores, finalRank, storage) {
      safe(() => {
        if (!current) return;
        current.finalScores = [...finalScores];
        current.finalRank = finalRank;
        persistCurrent(storage);
        current = null;
        round = null;
      });
    },
    listGames(storage) { return loadAll(storage); },
    _reset() { current = null; round = null; },
    _current() { return current; },
    _round() { return round; },
  };

  // ---------------- 再生 ----------------

  function createReplay(rec) {
    const pc = rec.playerCount;
    let state = null;
    let idx = 0;

    function initialState() {
      const wallAll = [...rec.wall];
      const deadWall = wallAll.splice(wallAll.length - 14, 14);
      const players = [];
      for (let i = 0; i < pc; i++) {
        players.push({
          hand: sortHand(wallAll.splice(0, 13)),
          tsumoTile: null,
          kawa: [],
          melds: [],
          kitaCount: 0,
          isRiichi: false,
          score: rec.startScores[i],
        });
      }
      return {
        wall: wallAll,
        deadWall,
        doraIndicators: [deadWall[4]],
        kanCount: 0,
        players,
        lastDiscard: null, // {p, tile}
        turn: rec.dealerIdx,
      };
    }

    function combined(pl) {
      return pl.tsumoTile ? [...pl.hand, pl.tsumoTile] : [...pl.hand];
    }

    // 手牌 (必要ならツモ牌も含む) から norm 一致の牌を count 枚取り除く。
    // 戻り値: { rest: 残り, taken: 取り除いた実物 (赤5などもそのまま) }
    function removeTiles(pl, code, count, includeTsumo) {
      const arr = includeTsumo ? combined(pl) : [...pl.hand];
      const target = normTile(code);
      const taken = [];
      const rest = [];
      for (const t of arr) {
        if (taken.length < count && normTile(t) === target) { taken.push(t); continue; }
        rest.push(t);
      }
      return { rest, taken };
    }

    function applyDraw(pl, ev) {
      let tile;
      if (ev.rinshan) {
        if (!state.deadWall.length) return;
        tile = state.deadWall.pop();
        if (state.wall.length) state.deadWall.push(state.wall.pop());
      } else {
        tile = state.wall.shift();
      }
      pl.tsumoTile = (ev.tile !== undefined) ? ev.tile : tile;
      state.turn = ev.p;
    }

    function applyKanDora() {
      state.kanCount += 1;
      const ind = state.deadWall[4 + state.kanCount];
      if (ind) state.doraIndicators.push(ind);
    }

    // 鳴かれた牌は河から消さず「鳴かれた」印を付ける (実物は副露側の牌と同一)。
    function applyCallFromKawa(ev) {
      const from = state.players[ev.from];
      if (from && from.kawa.length) from.kawa[from.kawa.length - 1].called = true;
    }

    function apply(ev) {
      const pl = state.players[ev.p];
      switch (ev.t) {
        case 'draw':
          applyDraw(pl, ev);
          break;
        case 'discard': {
          const { rest } = removeTiles(pl, ev.tile, 1, true);
          pl.hand = sortHand(rest);
          pl.tsumoTile = null;
          pl.kawa.push({ tile: ev.tile, isRiichi: !!pl._riichiPending, isTsumogiri: !!ev.tsumogiri });
          pl._riichiPending = false;
          state.lastDiscard = { p: ev.p, tile: ev.tile };
          state.turn = ev.p;
          break;
        }
        case 'riichi':
          pl.isRiichi = true;
          pl._riichiPending = true;
          pl.score -= 1000;
          break;
        case 'pon': {
          applyCallFromKawa(ev);
          const { rest, taken } = removeTiles(pl, ev.tile, 2, false);
          pl.hand = sortHand(rest);
          pl.melds.push({ type: 'pon', tiles: [...taken, ev.tile] });
          state.turn = ev.p;
          break;
        }
        case 'chi': {
          applyCallFromKawa(ev);
          let rest = [...pl.hand];
          for (const ht of ev.handTiles || []) {
            const i = rest.indexOf(ht);
            if (i !== -1) rest.splice(i, 1);
          }
          pl.hand = sortHand(rest);
          pl.melds.push({ type: 'chi', tiles: [ev.handTiles[0], ev.tile, ev.handTiles[1]] });
          state.turn = ev.p;
          break;
        }
        case 'minkan': {
          applyCallFromKawa(ev);
          const { rest, taken } = removeTiles(pl, ev.tile, 3, false);
          pl.hand = sortHand(rest);
          pl.melds.push({ type: 'kan', tiles: [...taken, ev.tile] });
          applyKanDora();
          state.turn = ev.p;
          break;
        }
        case 'ankan': {
          const { rest, taken } = removeTiles(pl, ev.tile, 4, true);
          pl.hand = sortHand(rest);
          pl.tsumoTile = null;
          pl.melds.push({ type: 'ankan', tiles: taken });
          applyKanDora();
          break;
        }
        case 'kakan': {
          const { rest } = removeTiles(pl, ev.tile, 1, true);
          pl.hand = sortHand(rest);
          pl.tsumoTile = null;
          const meld = pl.melds.find(m => m.type === 'pon' && normTile(m.tiles[0]) === normTile(ev.tile));
          if (meld) { meld.type = 'kan'; meld.tiles = [...meld.tiles, ev.tile]; }
          applyKanDora();
          break;
        }
        case 'kita': {
          const { rest } = removeTiles(pl, '4z', 1, true);
          pl.hand = sortHand(rest);
          pl.tsumoTile = null;
          pl.kitaCount += 1;
          break;
        }
        default:
          break;
      }
    }

    function snapshot() {
      return {
        step: idx,
        total: rec.events.length,
        players: state.players.map(p => ({
          hand: [...p.hand],
          tsumoTile: p.tsumoTile,
          kawa: p.kawa.map(k => ({ ...k })),
          melds: p.melds.map(m => ({ type: m.type, tiles: [...m.tiles] })),
          kitaCount: p.kitaCount,
          isRiichi: p.isRiichi,
          score: p.score,
        })),
        doraIndicators: [...state.doraIndicators],
        wallCount: state.wall.length,
        turn: state.turn,
        lastDiscard: state.lastDiscard ? { ...state.lastDiscard } : null,
        end: (idx >= rec.events.length) ? (rec.end || null) : null,
      };
    }

    function rebuild(toIdx) {
      state = initialState();
      idx = 0;
      while (idx < toIdx && idx < rec.events.length) {
        apply(rec.events[idx]);
        idx++;
      }
      return snapshot();
    }

    rebuild(0);
    return {
      total: rec.events.length,
      state: () => snapshot(),
      step() { if (idx < rec.events.length) { apply(rec.events[idx]); idx++; } return snapshot(); },
      back() { return rebuild(Math.max(0, idx - 1)); },
      seek(n) { return rebuild(Math.max(0, Math.min(rec.events.length, n))); },
      reset() { return rebuild(0); },
    };
  }

  // ---------------- 再生画面 (ビューア) ----------------

  const WINDS = ['東', '南', '西', '北'];
  const view = { game: null, rec: null, replay: null, timer: null };

  function roundLabel(rec) {
    const pc = rec.playerCount;
    const wind = rec.roundWind === '1z' ? '東' : '南';
    const num = (rec.roundNum % pc) + 1;
    return `${wind}${num}局${rec.honba ? ` ${rec.honba}本場` : ''}`;
  }

  function gameNames(game) {
    return game.names || ['あなた', 'レン', '葵', '龍馬'];
  }

  function endSummary(game, rec) {
    if (!rec.end) return '（未完）';
    const names = gameNames(game);
    const e = rec.end;
    if (e.type === 'tsumo') return `${names[e.winner]} のツモ和了`;
    if (e.type === 'ron') {
      const ws = e.winners || [e.winner];
      return `${ws.map(w => names[w]).join('・')} のロン（${names[e.loser]} の放銃）`;
    }
    if (e.type === 'ryukyoku') return '流局';
    if (e.type === 'interrupted') return `途中流局（${e.reason || ''}）`;
    return '';
  }

  function tileEl(code, small) {
    const wrap = document.createElement('div');
    wrap.innerHTML = global.renderTileHtml ? global.renderTileHtml(code, { isSmall: !!small }) : `<div class="mj-tile">${code}</div>`;
    return wrap.firstElementChild || wrap;
  }

  function el(tag, cssText, text) {
    const e = document.createElement(tag);
    if (cssText) e.style.cssText = cssText;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  const ROW_BTN = 'display:block;width:100%;text-align:left;background:rgba(255,255,255,0.06);border:1px solid rgba(245,158,11,0.35);color:#fef3c7;border-radius:10px;padding:10px 12px;margin:0 0 8px;font-size:0.9rem;cursor:pointer;';
  const CTRL_BTN = 'background:rgba(255,255,255,0.08);border:1px solid rgba(245,158,11,0.4);color:#fef3c7;border-radius:8px;padding:6px 12px;font-size:0.9rem;cursor:pointer;';

  function stopAuto() {
    if (view.timer) { clearInterval(view.timer); view.timer = null; }
    const btn = document.getElementById('kifuAutoBtn');
    if (btn) btn.textContent = '⏯ 自動再生';
  }

  function renderGames(body) {
    stopAuto();
    view.game = null; view.rec = null; view.replay = null;
    body.innerHTML = '';
    const games = recorder.listGames().slice().reverse();
    if (!games.length) {
      body.appendChild(el('p', 'color:#fef3c7;opacity:0.85;', '保存された牌譜はまだありません。対局すると自動で記録されます。'));
      return;
    }
    games.forEach(g => {
      const d = new Date(g.date);
      const dateText = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const kind = `${g.playerCount}人・${g.matchLength === 'hanchan' ? '半荘戦' : '東風戦'}`;
      const tail = g.finalRank ? `／ 最終 ${g.finalRank}位` : '／ 対局途中';
      const btn = el('button', ROW_BTN, `${dateText}　${kind}　${g.rounds.length}局${tail}`);
      btn.addEventListener('click', () => renderRounds(body, g));
      body.appendChild(btn);
    });
  }

  function renderRounds(body, game) {
    stopAuto();
    view.game = game; view.rec = null; view.replay = null;
    body.innerHTML = '';
    const back = el('button', CTRL_BTN + 'margin-bottom:10px;', '← 対局一覧へ戻る');
    back.addEventListener('click', () => renderGames(body));
    body.appendChild(back);
    game.rounds.forEach(rec => {
      const btn = el('button', ROW_BTN, `${roundLabel(rec)}　${endSummary(game, rec)}`);
      btn.addEventListener('click', () => startReplay(body, game, rec));
      body.appendChild(btn);
    });
  }

  function startReplay(body, game, rec) {
    stopAuto();
    view.game = game; view.rec = rec;
    view.replay = createReplay(rec);
    renderStage(body);
  }

  function renderStage(body) {
    const game = view.game, rec = view.rec, replay = view.replay;
    const snap = replay.state();
    const names = gameNames(game);
    body.innerHTML = '';

    const back = el('button', CTRL_BTN + 'margin-bottom:10px;', '← 局一覧へ戻る');
    back.addEventListener('click', () => renderRounds(body, game));
    body.appendChild(back);

    // ヘッダ: 局・ドラ・残牌・手順
    const head = el('div', 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:10px;color:#fef3c7;');
    head.appendChild(el('strong', 'font-size:1.05rem;', roundLabel(rec)));
    const doraBox = el('span', 'display:inline-flex;gap:2px;align-items:center;');
    doraBox.appendChild(el('span', 'opacity:0.8;font-size:0.8rem;margin-right:2px;', 'ドラ表示'));
    snap.doraIndicators.forEach(t => doraBox.appendChild(tileEl(t, true)));
    head.appendChild(doraBox);
    head.appendChild(el('span', 'opacity:0.85;font-size:0.85rem;', `残牌 ${snap.wallCount}枚`));
    head.appendChild(el('span', 'opacity:0.85;font-size:0.85rem;', `手順 ${snap.step} / ${snap.total}`));
    body.appendChild(head);

    // 各プレイヤー
    snap.players.forEach((p, i) => {
      const windIdx = (i - rec.dealerIdx + rec.playerCount) % rec.playerCount;
      const card = el('div', 'background:rgba(4,30,23,0.9);border:1px solid ' + (snap.turn === i ? '#f59e0b' : 'rgba(245,158,11,0.3)') + ';border-radius:12px;padding:8px 10px;margin-bottom:8px;');
      const scoreShown = snap.end && snap.end.scoresAfter ? snap.end.scoresAfter[i] : p.score;
      const title = el('div', 'color:#fef3c7;font-size:0.88rem;margin-bottom:4px;',
        `${WINDS[windIdx]}家 ${names[i]}　${scoreShown.toLocaleString()}点` +
        (p.isRiichi ? '　🔴リーチ' : '') + (p.kitaCount ? `　北×${p.kitaCount}` : ''));
      card.appendChild(title);

      const handRow = el('div', 'display:flex;flex-wrap:wrap;gap:1px;align-items:flex-end;');
      p.hand.forEach(t => handRow.appendChild(tileEl(t, true)));
      if (p.tsumoTile) {
        const sep = el('span', 'width:8px;');
        handRow.appendChild(sep);
        handRow.appendChild(tileEl(p.tsumoTile, true));
      }
      p.melds.forEach(m => {
        const sep = el('span', 'width:8px;');
        handRow.appendChild(sep);
        m.tiles.forEach(t => handRow.appendChild(tileEl(t, true)));
      });
      if (p.kitaCount) {
        const sep = el('span', 'width:8px;');
        handRow.appendChild(sep);
        for (let k = 0; k < p.kitaCount; k++) handRow.appendChild(tileEl('4z', true));
      }
      card.appendChild(handRow);

      // 河 (6枚ずつの行)
      const kawaBox = el('div', 'margin-top:6px;');
      for (let r = 0; r * 6 < p.kawa.length; r++) {
        const row = el('div', 'display:flex;gap:1px;margin-bottom:1px;');
        p.kawa.slice(r * 6, r * 6 + 6).forEach(k => {
          const t = tileEl(k.tile, true);
          if (k.called) t.style.opacity = '0.4';
          if (k.isRiichi) t.style.outline = '2px solid #f59e0b';
          row.appendChild(t);
        });
        kawaBox.appendChild(row);
      }
      card.appendChild(kawaBox);
      body.appendChild(card);
    });

    // 終局バナー
    if (snap.end) {
      body.appendChild(el('div', 'background:rgba(245,158,11,0.15);border:1px solid #f59e0b;color:#fef3c7;border-radius:10px;padding:8px 12px;margin:4px 0 10px;font-size:0.92rem;',
        `🏁 ${endSummary(game, rec)}`));
    }

    // コントロール
    const ctrls = el('div', 'display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;');
    const mkBtn = (label, fn, id) => {
      const b = el('button', CTRL_BTN, label);
      if (id) b.id = id;
      b.addEventListener('click', fn);
      ctrls.appendChild(b);
      return b;
    };
    mkBtn('⏮ 最初', () => { stopAuto(); replay.reset(); renderStage(body); });
    mkBtn('◀ 前へ', () => { stopAuto(); replay.back(); renderStage(body); });
    mkBtn('▶ 次へ', () => { replay.step(); renderStage(body); if (replay.state().step >= replay.total) stopAuto(); });
    mkBtn('⏭ 最後', () => { stopAuto(); replay.seek(replay.total); renderStage(body); });
    mkBtn('⏯ 自動再生', () => {
      if (view.timer) { stopAuto(); return; }
      const btn = document.getElementById('kifuAutoBtn');
      if (btn) btn.textContent = '⏸ 一時停止';
      view.timer = setInterval(() => {
        replay.step();
        renderStage(body);
        if (replay.state().step >= replay.total) stopAuto();
      }, 900);
    }, 'kifuAutoBtn');
    body.appendChild(ctrls);
  }

  function openViewer() {
    const modal = document.getElementById('kifuModal');
    const body = document.getElementById('kifuBody');
    if (!modal || !body) return;
    modal.classList.remove('hidden');
    renderGames(body);
  }

  function closeViewer() {
    stopAuto();
    const modal = document.getElementById('kifuModal');
    if (modal) modal.classList.add('hidden');
  }

  function wireViewer() {
    const open = document.getElementById('btnShowKifu');
    if (open) open.addEventListener('click', openViewer);
    const close = document.getElementById('btnCloseKifu');
    if (close) close.addEventListener('click', closeViewer);
    const modal = document.getElementById('kifuModal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeViewer(); });
  }
  if (typeof document !== 'undefined') wireViewer();

  global.MahjongKifu = { ...recorder, createReplay, openViewer, closeViewer, STORAGE_KEY, MAX_GAMES };
})(typeof window !== 'undefined' ? window : globalThis);
