/**
 * 雀聖AI - 効果音 (Web Audio 合成・音声ファイル不使用)
 *
 * - AudioContext は初回ユーザー操作 (pointerdown / keydown / click) で生成・resume する
 *   (ブラウザの自動再生ポリシー対応)。
 * - AudioContext が無い環境 (疑似DOMハーネス等) では全メソッドが無言で無効化される。
 * - ミュート状態は localStorage 'mahjong_sfx_muted' に保存する。
 * - 対局ロジックには一切関与しない (再生は fire-and-forget、待機を生まない)。
 */
(function(window) {
  'use strict';

  var STORAGE_KEY = 'mahjong_sfx_muted';

  var ctx = null;          // AudioContext (遅延生成)
  var masterGain = null;   // マスターゲイン
  var unlocked = false;    // ユーザー操作で解放済みか
  var noiseBuffer = null;  // 打牌音用のノイズバッファ (生成後キャッシュ)

  // ---------- ミュート状態 ----------
  function readMuted() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        return localStorage.getItem(STORAGE_KEY) === '1';
      }
    } catch (e) { /* localStorage 不可の環境では既定値 */ }
    return false;
  }

  var muted = readMuted();

  function writeMuted() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
      }
    } catch (e) { /* 保存できなくても動作は継続 */ }
  }

  // ---------- AudioContext 管理 ----------
  function getAudioCtor() {
    if (typeof window === 'undefined' || !window) return null;
    return window.AudioContext || window.webkitAudioContext || null;
  }

  function ensureContext() {
    if (ctx) {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        try { ctx.resume(); } catch (e) { /* noop */ }
      }
      return ctx;
    }
    var Ctor = getAudioCtor();
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(ctx.destination);
    } catch (e) {
      ctx = null;
      masterGain = null;
    }
    return ctx;
  }

  function unlock() {
    unlocked = true;
    ensureContext();
  }

  // 初回ユーザー操作で AudioContext を解放する
  (function installUnlockListeners() {
    try {
      if (typeof document !== 'undefined' && document &&
          typeof document.addEventListener === 'function') {
        var opts = { passive: true };
        document.addEventListener('pointerdown', unlock, opts);
        document.addEventListener('keydown', unlock, opts);
        document.addEventListener('touchend', unlock, opts);
      }
    } catch (e) { /* リスナを張れなくても致命的ではない */ }
  })();

  // ボタンクリック音 (イベント委譲)。ボタン以外のクリックでは鳴らさない。
  (function installButtonClickSound() {
    try {
      if (typeof document !== 'undefined' && document &&
          typeof document.addEventListener === 'function') {
        document.addEventListener('click', function(ev) {
          try {
            var t = ev && ev.target;
            if (!t) return;
            var btn = null;
            if (typeof t.closest === 'function') btn = t.closest('button');
            else if (t.tagName === 'BUTTON') btn = t;
            if (btn) play('click');
          } catch (e) { /* noop */ }
        }, { passive: true });
      }
    } catch (e) { /* noop */ }
  })();

  // ---------- 合成プリミティブ ----------
  function getNoiseBuffer(c) {
    if (noiseBuffer) return noiseBuffer;
    var len = Math.floor(c.sampleRate * 0.5);
    noiseBuffer = c.createBuffer(1, len, c.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  // 短いノイズバースト (打牌の「カッ」の芯)
  function noiseBurst(c, when, duration, freq, gainVal, q) {
    var src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);
    var filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q || 1.1;
    var g = c.createGain();
    g.gain.setValueAtTime(gainVal, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + duration);
    src.connect(filter); filter.connect(g); g.connect(masterGain);
    src.start(when);
    src.stop(when + duration + 0.02);
  }

  // 短いトーン (クリック・宣言音・ファンファーレの音符)
  function tone(c, when, freq, duration, gainVal, type, slideTo) {
    var osc = c.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, when);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, when + duration);
    }
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gainVal, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(g); g.connect(masterGain);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  // ---------- 効果音本体 ----------
  var sounds = {
    // 打牌: ノイズバースト + 低めのクリックで「カッ」という打牌音に寄せる
    discard: function(c) {
      var t = c.currentTime;
      noiseBurst(c, t, 0.07, 1900, 0.9, 1.2);
      noiseBurst(c, t + 0.015, 0.05, 700, 0.5, 1.0);
      tone(c, t, 210, 0.05, 0.35, 'square');
    },
    // 軽いクリック (ツモ・選択)
    select: function(c) {
      var t = c.currentTime;
      tone(c, t, 1250, 0.045, 0.18, 'sine');
      noiseBurst(c, t, 0.02, 3200, 0.12, 2.0);
    },
    // ボタンクリック
    click: function(c) {
      var t = c.currentTime;
      tone(c, t, 880, 0.04, 0.15, 'triangle');
    },
    // リーチ宣言: 短い上昇音 (2音)
    riichi: function(c) {
      var t = c.currentTime;
      tone(c, t, 659.25, 0.09, 0.28, 'triangle');        // E5
      tone(c, t + 0.085, 987.77, 0.16, 0.3, 'triangle'); // B5
      noiseBurst(c, t, 0.03, 2600, 0.15, 1.5);
    },
    // 和了ファンファーレ: 和音アルペジオ。役満時は長く・豪華に
    agari: function(c, isYakuman) {
      var t = c.currentTime;
      var base = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
      base.forEach(function(f, i) {
        tone(c, t + i * 0.09, f, 0.34, 0.26, 'triangle');
        tone(c, t + i * 0.09, f / 2, 0.34, 0.1, 'sine');
      });
      var endAt = t + base.length * 0.09;
      // 締めの和音
      [523.25, 659.25, 783.99].forEach(function(f) {
        tone(c, endAt, f, 0.5, 0.16, 'triangle');
      });
      if (isYakuman) {
        var t2 = endAt + 0.28;
        [659.25, 783.99, 1046.5, 1318.5].forEach(function(f, i) {
          tone(c, t2 + i * 0.11, f, 0.55, 0.26, 'triangle');
          tone(c, t2 + i * 0.11, f * 2, 0.3, 0.06, 'sine');
        });
        noiseBurst(c, t2, 0.4, 5200, 0.1, 0.7); // 煌めき
        [523.25, 659.25, 783.99, 1046.5].forEach(function(f) {
          tone(c, t2 + 0.48, f, 0.9, 0.14, 'triangle');
        });
      }
    }
  };

  /**
   * 効果音を再生する。未解放・ミュート・非対応環境では何もしない。
   * @param {string} name 'discard' | 'select' | 'click' | 'riichi' | 'agari'
   * @param {*} [arg] agari の場合は役満かどうか (真偽値)
   */
  function play(name, arg) {
    try {
      if (muted) return;
      var fn = sounds[name];
      if (!fn) return;
      // ユーザー操作前は AudioContext を作らない (自動再生ポリシー)。
      // ただし play 自体がクリックハンドラ等から呼ばれる場合は解放を試みる。
      if (!ctx && !unlocked) unlock();
      var c = ensureContext();
      if (!c || !masterGain) return;
      if (c.state === 'suspended') {
        // まだ解放されていない場合は鳴らさない (次回操作時に解放される)
        try { c.resume(); } catch (e) { /* noop */ }
        if (c.state === 'suspended') return;
      }
      fn(c, arg);
    } catch (e) { /* 効果音の失敗で対局を止めない */ }
  }

  var api = {
    play: play,
    unlock: unlock,
    isMuted: function() { return muted; },
    setMuted: function(v) {
      muted = !!v;
      writeMuted();
      return muted;
    },
    toggleMuted: function() {
      muted = !muted;
      writeMuted();
      return muted;
    }
  };

  window.MahjongSfx = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
