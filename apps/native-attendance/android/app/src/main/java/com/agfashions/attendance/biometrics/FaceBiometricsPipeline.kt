package com.agfashions.attendance.biometrics

import android.content.res.AssetManager
import android.graphics.Bitmap
import com.agfashions.attendance.ml.align.FaceAlign
import com.agfashions.attendance.ml.onnx.AntiSpoofOnnx
import com.agfashions.attendance.ml.onnx.ArcFaceOnnx
import com.agfashions.attendance.ml.onnx.ScrfdDetector
import java.io.IOException
import java.util.concurrent.atomic.AtomicReference
import ai.onnxruntime.OrtEnvironment

/**
 * Order: **Detect (SCRFD) → silent anti-spoof → 5-pt align → ArcFace (512-D) → client cosine match.**
 */
class FaceBiometricsPipeline(
  private val assets: AssetManager,
) {
  private val env: OrtEnvironment = OrtEnvironment.getEnvironment()
  private val scrfd = AtomicReference<ScrfdDetector?>(null)
  private val arc = AtomicReference<ArcFaceOnnx?>(null)
  private val spoil = AtomicReference<AntiSpoofOnnx?>(null)

  var antiSpoofThreshold: Float = 0.45f
  var scrfdNms: Float
    get() = scrfd.get()?.nmsThresh ?: 0.4f
    set(v) {
      scrfd.get()?.nmsThresh = v
    }
  var scrfdDet: Float
    get() = scrfd.get()?.detThresh ?: 0.5f
    set(v) {
      scrfd.get()?.detThresh = v
    }

  data class Result(
    val embedding: FloatArray,
    val liveScore: Float,
    val detScore: Float,
    val timingMs: Long,
  )

  @Throws(IOException::class, IllegalStateException::class)
  fun extractFromBitmap(bitmap: Bitmap): Result {
    val t0 = System.currentTimeMillis()
    val s = ensureLoaded()
    val det = s.scrfd.detectMaxFace(bitmap) ?: throw IllegalStateException("NO_FACE")
    if (det.kps == null || det.kps.size < 10) {
      throw IllegalStateException("NO_LANDMARKS")
    }
    if (det.score < scrfdDet) {
      throw IllegalStateException("LOW_DETECTION_SCORE")
    }

    val expand = expandSquare(det, bitmap.width, bitmap.height, 0.25f)
    val crop = Bitmap.createBitmap(bitmap, expand[0], expand[1], expand[2], expand[3])
    val live = s.antiSpoof.scoreLive(crop)
    crop.recycle()
    if (live < antiSpoofThreshold) {
      throw IllegalStateException("LIVENESS_FAILED")
    }

    val aligned = FaceAlign.warp112Rgb(bitmap, det.kps)
    val emb = s.arcface.embedAlignedFace112(aligned)
    aligned.recycle()
    return Result(emb, live, det.score, System.currentTimeMillis() - t0)
  }

  /** Detection + anti-spoof only (no ArcFace) — for motion-challenge helper hooks. */
  @Throws(Exception::class)
  fun silentAntiSpoofOnly(bitmap: Bitmap): Float {
    val s = ensureLoaded()
    val det = s.scrfd.detectMaxFace(bitmap) ?: throw IllegalStateException("NO_FACE")
    val expand = expandSquare(det, bitmap.width, bitmap.height, 0.25f)
    val crop = Bitmap.createBitmap(bitmap, expand[0], expand[1], expand[2], expand[3])
    val live = s.antiSpoof.scoreLive(crop)
    crop.recycle()
    return live
  }

  private data class Sessions(
    val scrfd: ScrfdDetector,
    val arcface: ArcFaceOnnx,
    val antiSpoof: AntiSpoofOnnx,
  )

  @Throws(IOException::class)
  private fun ensureLoaded(): Sessions {
    scrfd.get()?.let { s1 ->
      arc.get()?.let { a1 ->
        spoil.get()?.let { sp1 -> return Sessions(s1, a1, sp1) }
      }
    }
    val bScrfd = readAssetOrThrow(FILE_SCRFD)
    val bArc = readAssetOrThrow(FILE_ARC)
    val bAs = readAssetOrThrow(FILE_SPOOF)

    val s = ScrfdDetector(env, bScrfd)
    val a = ArcFaceOnnx(env, bArc)
    val sp = AntiSpoofOnnx(env, bAs, SPOOF_INPUT)
    scrfd.set(s)
    arc.set(a)
    spoil.set(sp)
    return Sessions(s, a, sp)
  }

  private fun readAssetOrThrow(name: String): ByteArray {
    return try {
      assets.open("models/$name").use { it.readBytes() }
    } catch (e: Exception) {
      throw IOException("Missing model assets/models/$name. See models/README.md.", e)
    }
  }

  private fun expandSquare(
    det: ScrfdDetector.FaceDet,
    w: Int,
    h: Int,
    margin: Float,
  ): IntArray {
    val cx = (det.x1 + det.x2) / 2f
    val cy = (det.y1 + det.y2) / 2f
    val side = maxOf(det.x2 - det.x1, det.y2 - det.y1) * (1f + margin * 2f)
    var x1 = (cx - side / 2f).toInt().coerceAtLeast(0)
    var y1 = (cy - side / 2f).toInt().coerceAtLeast(0)
    var x2 = (cx + side / 2f).toInt().coerceAtMost(w - 1)
    var y2 = (cy + side / 2f).toInt().coerceAtMost(h - 1)
    if (x2 <= x1) x2 = minOf(w - 1, x1 + 2)
    if (y2 <= y1) y2 = minOf(h - 1, y1 + 2)
    return intArrayOf(x1, y1, x2 - x1, y2 - y1)
  }

  fun release() {
    scrfd.getAndSet(null)?.close()
    arc.getAndSet(null)?.close()
    spoil.getAndSet(null)?.close()
  }

  companion object {
    private const val TAG = "FaceBiometricsPipeline"
    const val FILE_SCRFD = "scrfd_500m_bnkps.onnx"
    const val FILE_ARC = "arcface_w600k_r50.onnx"
    const val FILE_SPOOF = "silent_fas_mini.onnx"
    private const val SPOOF_INPUT = 80
  }
}
