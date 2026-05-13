import * as jpeg from 'jpeg-js';
import { NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { loadTensorflowModel } from 'react-native-fast-tflite';

const MODEL_ASSET = require('../assets/models/mobilefacenet.tflite');

const INPUT_SIZE = 112;
const EMBEDDING_DIM = 192;

export class NoFaceInImageError extends Error {
  constructor(message = 'No face detected in image') {
    super(message);
    this.name = 'NoFaceInImageError';
  }
}

type FaceBox = { x: number; y: number; width: number; height: number };

type FaceGeometryNative = {
  detectFaces: (uri: string) => Promise<{
    imageWidth: number;
    imageHeight: number;
    faces: FaceBox[];
  }>;
};

function getFaceGeometry(): FaceGeometryNative | undefined {
  const mod = NativeModules.FaceGeometry as FaceGeometryNative | undefined;
  return Platform.OS === 'android' ? mod : undefined;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function readUriBytes(uri: string): Promise<Uint8Array> {
  const path =
    uri.startsWith('content://') ? uri : uri.startsWith('file://') ? uri.replace(/^file:\/\//, '') : uri;
  const b64 = await RNFS.readFile(path, 'base64');
  return base64ToUint8Array(b64);
}

function bilinearResizeRgb(src: Uint8Array, srcW: number, srcH: number, dstW: number, dstH: number): Uint8Array {
  const dst = new Uint8Array(dstW * dstH * 3);
  const xScale = srcW / dstW;
  const yScale = srcH / dstH;
  for (let y = 0; y < dstH; y += 1) {
    const sy = (y + 0.5) * yScale - 0.5;
    const y0 = clamp(Math.floor(sy), 0, srcH - 1);
    const y1 = clamp(y0 + 1, 0, srcH - 1);
    const wy = sy - y0;
    for (let x = 0; x < dstW; x += 1) {
      const sx = (x + 0.5) * xScale - 0.5;
      const x0 = clamp(Math.floor(sx), 0, srcW - 1);
      const x1 = clamp(x0 + 1, 0, srcW - 1);
      const wx = sx - x0;
      for (let c = 0; c < 3; c += 1) {
        const i00 = (y0 * srcW + x0) * 3 + c;
        const i10 = (y0 * srcW + x1) * 3 + c;
        const i01 = (y1 * srcW + x0) * 3 + c;
        const i11 = (y1 * srcW + x1) * 3 + c;
        const v =
          src[i00]! * (1 - wx) * (1 - wy) +
          src[i10]! * wx * (1 - wy) +
          src[i01]! * (1 - wx) * wy +
          src[i11]! * wx * wy;
        dst[(y * dstW + x) * 3 + c] = Math.round(v);
      }
    }
  }
  return dst;
}

function rgbBufferFromJpegDecoded(decoded: { width: number; height: number; data: Uint8Array }): {
  rgb: Uint8Array;
  width: number;
  height: number;
} {
  const { width, height, data } = decoded;
  const pixels = width * height;
  const perPixel = data.length / pixels;
  if (perPixel === 3) {
    return { rgb: Uint8Array.from(data), width, height };
  }
  if (perPixel === 4) {
    const rgb = new Uint8Array(pixels * 3);
    let j = 0;
    for (let i = 0; i < data.length; i += 4) {
      rgb[j++] = data[i]!;
      rgb[j++] = data[i + 1]!;
      rgb[j++] = data[i + 2]!;
    }
    return { rgb, width, height };
  }
  throw new Error(`Unsupported JPEG channel layout (${perPixel} ch)`);
}

function extractCrop(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  x0: number,
  y0: number,
  cw: number,
  ch: number,
): Uint8Array {
  const xStart = clamp(Math.floor(x0), 0, srcW - 1);
  const yStart = clamp(Math.floor(y0), 0, srcH - 1);
  const xEnd = clamp(Math.ceil(x0 + cw), xStart + 1, srcW);
  const yEnd = clamp(Math.ceil(y0 + ch), yStart + 1, srcH);
  const cw2 = xEnd - xStart;
  const ch2 = yEnd - yStart;
  const out = new Uint8Array(cw2 * ch2 * 3);
  for (let y = 0; y < ch2; y += 1) {
    const sy = yStart + y;
    for (let x = 0; x < cw2; x += 1) {
      const sx = xStart + x;
      const si = (sy * srcW + sx) * 3;
      const di = (y * cw2 + x) * 3;
      out[di] = src[si]!;
      out[di + 1] = src[si + 1]!;
      out[di + 2] = src[si + 2]!;
    }
  }
  return out;
}

/** Largest face box by area; pads/clamps like reference MobileFaceNet samples. */
function pickFaceCrop(
  faces: FaceBox[],
  imageWidth: number,
  imageHeight: number,
  padPx: number,
): { x: number; y: number; width: number; height: number } {
  let best = faces[0]!;
  let bestArea = best.width * best.height;
  for (const f of faces) {
    const a = f.width * f.height;
    if (a > bestArea) {
      best = f;
      bestArea = a;
    }
  }
  let x = Math.floor(best.x - padPx);
  let y = Math.floor(best.y - padPx);
  let w = Math.ceil(best.width + padPx * 2);
  let h = Math.ceil(best.height + padPx * 2);
  x = clamp(x, 0, imageWidth - 1);
  y = clamp(y, 0, imageHeight - 1);
  w = clamp(w, 1, imageWidth - x);
  h = clamp(h, 1, imageHeight - y);
  return { x, y, width: w, height: h };
}

async function decodePhotoToRgb(uriForRead: string): Promise<{ rgb: Uint8Array; width: number; height: number }> {
  const bytes = await readUriBytes(uriForRead);
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: false });
  if (!decoded.width || !decoded.height) {
    throw new Error('Invalid JPEG decode');
  }
  return rgbBufferFromJpegDecoded(decoded);
}

/**
 * 112×112 RGB aligned face crop: ML Kit accurate boxes on Android; centered square on iOS / fallback.
 */
async function buildAlignedRgb112(localUri: string): Promise<Uint8Array> {
  const uri =
    localUri.startsWith('file://') || localUri.startsWith('content://') ? localUri : `file://${localUri}`;
  const uriForRead = uri.startsWith('content://') ? uri : uri.replace(/^file:\/\//, '');

  const fg = getFaceGeometry();
  const { rgb, width, height } = await decodePhotoToRgb(uriForRead);

  if (fg?.detectFaces) {
    try {
      const res = await fg.detectFaces(uri);
      const faces = res.faces ?? [];
      if (faces.length === 0) {
        throw new NoFaceInImageError();
      }
      const crop = pickFaceCrop(faces, res.imageWidth, res.imageHeight, 12);
      const croppedRgb = extractCrop(rgb, width, height, crop.x, crop.y, crop.width, crop.height);
      return bilinearResizeRgb(croppedRgb, crop.width, crop.height, INPUT_SIZE, INPUT_SIZE);
    } catch (e) {
      if (e instanceof NoFaceInImageError) {
        throw e;
      }
      // Missing Play Services / transient ML Kit failure — fall back below.
    }
  }

  const side = Math.min(width, height);
  const ox = Math.floor((width - side) / 2);
  const oy = Math.floor((height - side) / 2);
  const centered = extractCrop(rgb, width, height, ox, oy, side, side);
  return bilinearResizeRgb(centered, side, side, INPUT_SIZE, INPUT_SIZE);
}

function mobileFaceNetInputFloats(rgb112: Uint8Array): Float32Array {
  if (rgb112.length !== INPUT_SIZE * INPUT_SIZE * 3) {
    throw new Error('Invalid RGB tensor size');
  }
  const out = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);
  let k = 0;
  for (let i = 0; i < INPUT_SIZE; i += 1) {
    for (let j = 0; j < INPUT_SIZE; j += 1) {
      const idx = (i * INPUT_SIZE + j) * 3;
      out[k++] = (rgb112[idx]! - 128) / 128;
      out[k++] = (rgb112[idx + 1]! - 128) / 128;
      out[k++] = (rgb112[idx + 2]! - 128) / 128;
    }
  }
  return out;
}

let modelPromise: ReturnType<typeof loadTensorflowModel> | null = null;

async function getEmbeddingModel() {
  if (!modelPromise) {
    modelPromise = loadTensorflowModel(MODEL_ASSET, []);
  }
  return modelPromise;
}

/** Full pipeline: aligned 112 crop → MobileFaceNet → 192-D embedding. */
export async function embeddingFromPhotoUri(photoUri: string): Promise<number[]> {
  const uri = String(photoUri ?? '').trim();
  if (!uri) {
    throw new Error('Missing photo URI');
  }

  const rgb112 = await buildAlignedRgb112(uri);
  const input = mobileFaceNetInputFloats(rgb112);
  const model = await getEmbeddingModel();
  const srcBytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  const inputCopy = new ArrayBuffer(srcBytes.byteLength);
  new Uint8Array(inputCopy).set(srcBytes);
  const outputs = await model.run([inputCopy]);
  const first = outputs[0];
  if (!first) {
    throw new Error('TFLite produced no output');
  }
  const floats = new Float32Array(first);
  const arr = Array.from(floats);
  if (arr.length < EMBEDDING_DIM) {
    throw new Error(`Unexpected embedding length ${arr.length}`);
  }
  return arr.slice(0, EMBEDDING_DIM);
}
