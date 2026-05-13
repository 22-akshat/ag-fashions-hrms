package com.agfashions.attendance.ml.onnx

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.graphics.Bitmap
import android.util.Log

/**
 * Silent face anti-spoofing ONNX (e.g. MiniFASNet family).
 * Expects a tight RGB crop (default 80×80); higher score ⇒ more likely live.
 */
class AntiSpoofOnnx(
  private val env: OrtEnvironment,
  modelBytes: ByteArray,
  val inputSize: Int = 80,
) {
  private val session: OrtSession
  private val inputName: String

  init {
    val opt =
      OrtSession.SessionOptions().apply {
        setIntraOpNumThreads(2)
        setInterOpNumThreads(1)
      }
    session = env.createSession(modelBytes, opt)
    inputName = session.inputInfo.entries.first().key
  }

  /** Returns live probability in ~[0,1] (softmax of real class or sigmoid). */
  fun scoreLive(faceCrop: Bitmap): Float {
    val scaled =
      if (faceCrop.width != inputSize || faceCrop.height != inputSize) {
        Bitmap.createScaledBitmap(faceCrop, inputSize, inputSize, true)
      } else {
        faceCrop
      }
    val blob = bitmapToNchw(scaled, inputSize)
    if (scaled !== faceCrop) scaled.recycle()

    val tensor =
      OnnxTensor.createTensor(
        env,
        java.nio.FloatBuffer.wrap(blob),
        longArrayOf(1, 3, inputSize.toLong(), inputSize.toLong()),
      )
    val feeds = mapOf(inputName to tensor)
    val outs = session.run(feeds)
    val outName = session.outputNames.first()
    val outTensor = outs[outName].get() as OnnxTensor
    val fb = outTensor.floatBuffer
    val raw = FloatArray(fb.remaining()).also { fb.get(it) }
    outs.close()
    tensor.close()

    return when (raw.size) {
      1 -> sigmoid(raw[0])
      2 -> softmax2(raw)[1]
      else -> raw.maxOrNull() ?: 0f
    }
  }

  private fun sigmoid(x: Float): Float = (1.0 / (1.0 + kotlin.math.exp(-x.toDouble()))).toFloat()

  private fun softmax2(x: FloatArray): FloatArray {
    val m = maxOf(x[0], x[1])
    val e0 = kotlin.math.exp((x[0] - m).toDouble())
    val e1 = kotlin.math.exp((x[1] - m).toDouble())
    val s = (e0 + e1).toFloat().coerceAtLeast(1e-8f)
    return floatArrayOf((e0 / s).toFloat(), (e1 / s).toFloat())
  }

  private fun bitmapToNchw(
    bmp: Bitmap,
    size: Int,
  ): FloatArray {
    val pixels = IntArray(size * size)
    bmp.getPixels(pixels, 0, size, 0, 0, size, size)
    val out = FloatArray(3 * size * size)
    var p = 0
    for (c in 0 until 3) {
      for (y in 0 until size) {
        for (x in 0 until size) {
          val pix = pixels[y * size + x]
          val r = ((pix shr 16) and 0xff) / 255f
          val g = ((pix shr 8) and 0xff) / 255f
          val b = (pix and 0xff) / 255f
          val v =
            when (c) {
              0 -> (r - 0.5f) / 0.5f
              1 -> (g - 0.5f) / 0.5f
              else -> (b - 0.5f) / 0.5f
            }
          out[p++] = v
        }
      }
    }
    return out
  }

  fun close() {
    try {
      session.close()
    } catch (e: Exception) {
      Log.w(TAG, "AntiSpoof close", e)
    }
  }

  companion object {
    private const val TAG = "AntiSpoofOnnx"
  }
}
