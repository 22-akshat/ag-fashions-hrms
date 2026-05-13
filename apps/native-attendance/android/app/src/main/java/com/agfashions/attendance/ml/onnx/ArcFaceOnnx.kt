package com.agfashions.attendance.ml.onnx

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.graphics.Bitmap
import android.util.Log

/** ArcFace / InsightFace recognition ONNX — expects 112×112 aligned RGB face. */
class ArcFaceOnnx(
  private val env: OrtEnvironment,
  modelBytes: ByteArray,
) {
  private val session: OrtSession
  private val inputName: String
  private val embeddingDim: Int

  private val inputMean = 127.5f
  private val inputStd = 128.0f

  init {
    val opt =
      OrtSession.SessionOptions().apply {
        setIntraOpNumThreads(2)
        setInterOpNumThreads(1)
      }
    session = env.createSession(modelBytes, opt)
    inputName = session.inputInfo.entries.first().key
    val outName = session.outputNames.first()
    val shape = (session.outputInfo[outName]!!.info as ai.onnxruntime.TensorInfo).shape
    embeddingDim =
      when {
        shape.size >= 2 && shape[1] > 0 -> shape[1].toInt()
        shape.size == 1 && shape[0] > 0 -> shape[0].toInt()
        else -> 512
      }
  }

  fun embedAlignedFace112(rgbAligned: Bitmap): FloatArray {
    require(rgbAligned.width == 112 && rgbAligned.height == 112) { "ArcFace input must be 112×112" }
    val blob = bitmapToNchw112(rgbAligned)
    val tensor =
      OnnxTensor.createTensor(
        env,
        java.nio.FloatBuffer.wrap(blob),
        longArrayOf(1, 3, 112, 112),
      )
    val feeds = mapOf(inputName to tensor)
    val outs = session.run(feeds)
    val outTensor = outs[session.outputNames.first()].get() as OnnxTensor
    val fb = outTensor.floatBuffer
    val raw = FloatArray(fb.remaining()).also { fb.get(it) }
    outs.close()
    tensor.close()
    val emb = if (raw.size >= embeddingDim) raw.copyOf(embeddingDim) else raw
    l2Normalize(emb)
    return emb
  }

  private fun bitmapToNchw112(bmp: Bitmap): FloatArray {
    val pixels = IntArray(112 * 112)
    bmp.getPixels(pixels, 0, 112, 0, 0, 112, 112)
    val out = FloatArray(3 * 112 * 112)
    var p = 0
    for (c in 0 until 3) {
      for (y in 0 until 112) {
        for (x in 0 until 112) {
          val pix = pixels[y * 112 + x]
          val r = ((pix shr 16) and 0xff).toFloat()
          val g = ((pix shr 8) and 0xff).toFloat()
          val b = (pix and 0xff).toFloat()
          val v =
            when (c) {
              0 -> (r - inputMean) / inputStd
              1 -> (g - inputMean) / inputStd
              else -> (b - inputMean) / inputStd
            }
          out[p++] = v
        }
      }
    }
    return out
  }

  private fun l2Normalize(v: FloatArray) {
    var s = 0.0
    for (x in v) s += (x * x).toDouble()
    val norm = kotlin.math.sqrt(s).toFloat().coerceAtLeast(1e-12f)
    for (i in v.indices) v[i] /= norm
  }

  fun close() {
    try {
      session.close()
    } catch (e: Exception) {
      Log.w(TAG, "ArcFace close", e)
    }
  }

  companion object {
    private const val TAG = "ArcFaceOnnx"
  }
}
