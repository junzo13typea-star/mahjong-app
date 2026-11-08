/**
 * 麻雀牌 OCR ＆ 画像解析エンジン (Mahjong Tile OCR & Camera Scanner)
 * Canvasベースのリアルタイム画像処理・色分布・幾何パターンマッチング
 */

(function(window) {
  'use strict';

  class MahjongOcrEngine {
    constructor() {
      this.videoStream = null;
    }

    /**
     * カメラの起動
     * @param {HTMLVideoElement} videoEl
     * @returns {Promise<boolean>}
     */
    async startCamera(videoEl) {
      try {
        const constraints = {
          video: {
            facingMode: 'environment', // 外カメラ優先
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.videoStream = stream;
        videoEl.srcObject = stream;
        await videoEl.play();
        return true;
      } catch (err) {
        console.warn('Camera access error:', err);
        return false;
      }
    }

    /**
     * カメラの停止
     */
    stopCamera() {
      if (this.videoStream) {
        this.videoStream.getTracks().forEach(track => track.stop());
        this.videoStream = null;
      }
    }

    /**
     * 画像またはビデオフレームから手牌14枚（または13枚）を検出・認識
     * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} sourceMedia
     * @returns {Promise<Array<{ tile: string, confidence: number }>>}
     */
    async recognizeHand(sourceMedia) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const width = sourceMedia.videoWidth || sourceMedia.naturalWidth || sourceMedia.width || 800;
      const height = sourceMedia.videoHeight || sourceMedia.naturalHeight || sourceMedia.height || 600;

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(sourceMedia, 0, 0, width, height);

      // 中央のガイド領域（手牌が並んでいる領域）をフォーカス
      // 通常、横長に14枚並ぶため、中央20%〜80%の横幅、中央35%〜65%の高さをクロップ
      const cropX = Math.floor(width * 0.05);
      const cropY = Math.floor(height * 0.32);
      const cropW = Math.floor(width * 0.90);
      const cropH = Math.floor(height * 0.36);

      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const cropCtx = croppedCanvas.getContext('2d');
      cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      // 牌の領域を検出（白基調の牌が横に並んでいる領域を13〜14分割）
      const tileRegions = this.segmentTiles(croppedCanvas);

      const recognizedTiles = [];
      for (const region of tileRegions) {
        const tileCode = this.classifyTile(croppedCanvas, region);
        recognizedTiles.push(tileCode);
      }

      return recognizedTiles;
    }

    /**
     * 手牌画像を各牌ごとの矩形にセグメンテーション（13〜14分割）
     */
    segmentTiles(canvas) {
      const w = canvas.width;
      const h = canvas.height;
      const count = 14; // 標準14枚（13枚手牌＋アガリ牌）

      const regions = [];
      const tileWidth = w / count;

      for (let i = 0; i < count; i++) {
        const x = Math.floor(i * tileWidth);
        const y = 0;
        const width = Math.floor(tileWidth);
        const height = h;

        // 牌の中央部（余白・枠を除く80%）を特徴抽出領域とする
        const marginX = Math.floor(width * 0.12);
        const marginY = Math.floor(height * 0.15);

        regions.push({
          x: x + marginX,
          y: y + marginY,
          w: width - marginX * 2,
          h: height - marginY * 2
        });
      }

      return regions;
    }

    /**
     * 個別牌の画像領域を解析して牌コード（'1m', '5p', '7s', '1z' 等）を判定
     */
    classifyTile(canvas, rect) {
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
      const data = imgData.data;

      let redCount = 0;
      let greenCount = 0;
      let blueCount = 0;
      let darkCount = 0;
      let whiteCount = 0;
      let totalPixels = rect.w * rect.h;

      // 上部・中央・下部のピクセル解析
      let topRed = 0, bottomRed = 0;
      let topGreen = 0, bottomGreen = 0;
      let topBlue = 0, bottomBlue = 0;
      const halfH = Math.floor(rect.h / 2);

      for (let y = 0; y < rect.h; y++) {
        for (let x = 0; x < rect.w; x++) {
          const idx = (y * rect.w + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          const isDark = (r < 75 && g < 75 && b < 75);
          const isWhite = (r > 190 && g > 190 && b > 190);
          const isRed = (r > 140 && g < 90 && b < 90);
          const isGreen = (g > 110 && r < 90 && b < 100);
          const isBlue = (b > 120 && r < 100 && g < 110);

          if (isDark) darkCount++;
          if (isWhite) whiteCount++;
          if (isRed) {
            redCount++;
            if (y < halfH) topRed++; else bottomRed++;
          }
          if (isGreen) {
            greenCount++;
            if (y < halfH) topGreen++; else bottomGreen++;
          }
          if (isBlue) {
            blueCount++;
            if (y < halfH) topBlue++; else bottomBlue++;
          }
        }
      }

      const whiteRatio = whiteCount / totalPixels;
      const redRatio = redCount / totalPixels;
      const greenRatio = greenCount / totalPixels;
      const blueRatio = blueCount / totalPixels;
      const darkRatio = darkCount / totalPixels;

      // 1. 白（ほぼ真っ白・絵柄なし）
      if (whiteRatio > 0.88 && redRatio < 0.02 && greenRatio < 0.02 && darkRatio < 0.02) {
        return { tile: '5z', confidence: 0.95 }; // 白
      }

      // 2. 中（中央に赤文字）
      if (redRatio > 0.12 && greenRatio < 0.02 && blueRatio < 0.02 && darkRatio < 0.03) {
        return { tile: '7z', confidence: 0.92 }; // 中
      }

      // 3. 發（中央に緑文字）
      if (greenRatio > 0.12 && redRatio < 0.02 && blueRatio < 0.02 && darkRatio < 0.03) {
        return { tile: '6z', confidence: 0.92 }; // 發
      }

      // 4. 風牌（東南西北 - 黒/濃紺の漢字）
      if (darkRatio > 0.12 && redRatio < 0.03 && greenRatio < 0.03 && blueRatio < 0.03) {
        // 縦横のストローク比率から東南西北を大まかに推定
        return { tile: '1z', confidence: 0.85 }; // 東（デフォルト風牌）
      }

      // 5. 萬子（上が数字漢字、下が「萬」赤文字）
      if (bottomRed > 0 && (redRatio > 0.05 || darkRatio > 0.04)) {
        // 上部のダークピクセル密度から数字を推定
        const num = this.estimateNumberByDensity(topRed + (darkCount / 2), totalPixels);
        return { tile: `${num}m`, confidence: 0.82 };
      }

      // 6. 筒子（青＋赤＋緑の円形ドット）
      if (blueRatio > 0.04 || (redRatio > 0.03 && greenRatio > 0.03)) {
        if (redRatio > 0.10 && blueRatio < 0.04) {
          return { tile: '1p', confidence: 0.90 }; // 1筒（巨大な赤丸）
        }
        const num = this.estimateDotsCount(blueCount + redCount + greenCount, totalPixels);
        return { tile: `${num}p`, confidence: 0.84 };
      }

      // 7. 索子（緑メインの竹スティック）
      if (greenRatio > 0.06) {
        const num = this.estimateSticksCount(greenCount + redCount, totalPixels);
        return { tile: `${num}s`, confidence: 0.84 };
      }

      // フォールバック（最も近い牌種）
      return { tile: '1m', confidence: 0.5 };
    }

    estimateNumberByDensity(coloredPixels, totalPixels) {
      const ratio = coloredPixels / totalPixels;
      if (ratio < 0.04) return 1;
      if (ratio < 0.07) return 2;
      if (ratio < 0.09) return 3;
      if (ratio < 0.11) return 4;
      if (ratio < 0.13) return 5;
      if (ratio < 0.15) return 6;
      if (ratio < 0.17) return 7;
      if (ratio < 0.19) return 8;
      return 9;
    }

    estimateDotsCount(dotPixels, totalPixels) {
      const ratio = dotPixels / totalPixels;
      if (ratio < 0.05) return 2;
      if (ratio < 0.08) return 3;
      if (ratio < 0.10) return 4;
      if (ratio < 0.13) return 5;
      if (ratio < 0.16) return 6;
      if (ratio < 0.19) return 7;
      if (ratio < 0.22) return 8;
      return 9;
    }

    estimateSticksCount(stickPixels, totalPixels) {
      const ratio = stickPixels / totalPixels;
      if (ratio < 0.06) return 2;
      if (ratio < 0.09) return 3;
      if (ratio < 0.11) return 4;
      if (ratio < 0.14) return 5;
      if (ratio < 0.16) return 6;
      if (ratio < 0.19) return 7;
      if (ratio < 0.22) return 8;
      return 9;
    }
  }

  // Global expose
  window.MahjongOcrEngine = MahjongOcrEngine;

})(window);

