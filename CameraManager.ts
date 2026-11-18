import type { FramePayload } from '../types/vision';

export interface CameraErrorInfo {
  code: 'PERMISSION_DENIED' | 'NOT_FOUND' | 'UNSUPPORTED' | 'UNKNOWN';
  message: string;
}

export interface FrameTelemetry {
  motionDelta: number;
  suddenCloseWall: boolean;
}

export class CameraManager {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private captureCanvas: HTMLCanvasElement | null = null;
  private telemetryCanvas: HTMLCanvasElement | null = null;
  private prevLumaGrid: Uint8Array | null = null;
  private prevCenterVariance = 100;
  private readonly maxCaptureWidth = 320;

  public isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices) &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  public async startRearCamera(videoEl: HTMLVideoElement): Promise<void> {
    if (!this.isSupported()) {
      throw this.createError('UNSUPPORTED', 'Camera API is not supported in this browser.');
    }

    this.stop();
    this.videoElement = videoEl;
    this.prevLumaGrid = null;
    this.prevCenterVariance = 100;

    const preferredConstraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 960, max: 1280 },
        height: { ideal: 540, max: 720 },
      },
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        } catch (fallbackErr) {
          throw this.mapMediaError(fallbackErr);
        }
      } else {
        throw this.mapMediaError(err);
      }
    }

    videoEl.srcObject = this.stream;
    videoEl.setAttribute('playsinline', 'true');
    videoEl.muted = true;

    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        videoEl.removeEventListener('loadedmetadata', onLoaded);
        videoEl.removeEventListener('error', onErr);
        videoEl
          .play()
          .then(() => resolve())
          .catch((playErr) => reject(this.mapMediaError(playErr)));
      };
      const onErr = () => {
        videoEl.removeEventListener('loadedmetadata', onLoaded);
        videoEl.removeEventListener('error', onErr);
        reject(this.createError('UNKNOWN', 'Failed to initialize video stream.'));
      };
      if (videoEl.readyState >= 1) {
        onLoaded();
      } else {
        videoEl.addEventListener('loadedmetadata', onLoaded);
        videoEl.addEventListener('error', onErr);
      }
    });
  }

  public captureFrame(): FramePayload | null {
    const video = this.videoElement;
    if (!video || !this.stream || video.readyState < 2) {
      return null;
    }

    const srcWidth = video.videoWidth;
    const srcHeight = video.videoHeight;
    if (!srcWidth || !srcHeight) {
      return null;
    }

    const scale = srcWidth > this.maxCaptureWidth ? this.maxCaptureWidth / srcWidth : 1;
    const targetWidth = Math.round(srcWidth * scale);
    const targetHeight = Math.round(srcHeight * scale);

    if (!this.captureCanvas) {
      this.captureCanvas = document.createElement('canvas');
    }
    this.captureCanvas.width = targetWidth;
    this.captureCanvas.height = targetHeight;

    const ctx = this.captureCanvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    const dataUrl = this.captureCanvas.toDataURL('image/jpeg', 0.5);
    const base64Index = dataUrl.indexOf(',');
    if (base64Index === -1) return null;

    return {
      imageBase64: dataUrl.slice(base64Index + 1),
      mimeType: 'image/jpeg',
      width: targetWidth,
      height: targetHeight,
      capturedAt: Date.now(),
    };
  }

  /**
   * Ultra-fast on-device 24x18 grayscale check (<1ms) to detect sudden visual
   * scene changes or an abrupt close wall/obstruction filling the center view.
   */
  public computeQuickTelemetry(): FrameTelemetry | null {
    const video = this.videoElement;
    if (!video || !this.stream || video.readyState < 2) {
      return null;
    }

    const w = 24;
    const h = 18;
    if (!this.telemetryCanvas) {
      this.telemetryCanvas = document.createElement('canvas');
      this.telemetryCanvas.width = w;
      this.telemetryCanvas.height = h;
    }

    const ctx = this.telemetryCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h).data;
    const grid = new Uint8Array(w * h);

    let centerSum = 0;
    let centerCount = 0;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const idx = y * w + x;
        const p = idx * 4;
        const luma = Math.round(pixels[p] * 0.299 + pixels[p + 1] * 0.587 + pixels[p + 2] * 0.114);
        grid[idx] = luma;
        if (x >= 6 && x < 18 && y >= 4 && y < 14) {
          centerSum += luma;
          centerCount += 1;
        }
      }
    }

    const centerMean = centerCount > 0 ? centerSum / centerCount : 0;
    let centerVarianceAcc = 0;
    for (let y = 4; y < 14; y += 1) {
      for (let x = 6; x < 18; x += 1) {
        const diff = grid[y * w + x] - centerMean;
        centerVarianceAcc += diff * diff;
      }
    }
    const centerVariance = centerCount > 0 ? centerVarianceAcc / centerCount : 100;

    let motionDelta = 255;
    if (this.prevLumaGrid && this.prevLumaGrid.length === grid.length) {
      let totalDiff = 0;
      for (let i = 0; i < grid.length; i += 1) {
        totalDiff += Math.abs(grid[i] - this.prevLumaGrid[i]);
      }
      motionDelta = totalDiff / grid.length;
    }

    // Trigger close-wall reflex only when center view abruptly collapses into a flat surface after motion
    const suddenCloseWall =
      this.prevLumaGrid !== null &&
      this.prevCenterVariance > 85 &&
      centerVariance < 28 &&
      motionDelta > 16;

    this.prevLumaGrid = grid;
    this.prevCenterVariance = centerVariance;

    return {
      motionDelta,
      suddenCloseWall,
    };
  }

  public stop(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
    this.prevLumaGrid = null;
  }

  public isActive(): boolean {
    return Boolean(this.stream && this.stream.getVideoTracks().some((t) => t.readyState === 'live'));
  }

  private mapMediaError(err: unknown): CameraErrorInfo {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return this.createError('PERMISSION_DENIED', 'Camera permission denied.');
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return this.createError('NOT_FOUND', 'No camera device detected.');
    }
    return this.createError(
      'UNKNOWN',
      err instanceof Error ? err.message : 'Unable to start camera.'
    );
  }

  private createError(code: CameraErrorInfo['code'], message: string): CameraErrorInfo {
    return { code, message };
  }
}

export const cameraManager = new CameraManager();
