package com.agfashions.attendance.ml.onnx

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.graphics.Bitmap
import android.util.Log
import kotlin.math.max
import kotlin.math.min

/**
 * SCRFD ONNX — ports InsightFace `insightface/model_zoo/scrfd.py` for 9-output BNKPS models
 * (strides 8 / 16 / 32, two anchors per cell).
 */
class ScrfdDetector(
  private val env: OrtEnvironment,
  modelBytes: ByteArray,
) {
  private val session: OrtSession
  private val inputName: String
  private val outputNames: List<String>
  private val batched: Boolean
  private val fmc: Int
  private val featStrideFpn: IntArray
  private val numAnchors: Int
  private val useKps: Boolean
  private var inputSize: Pair<Int, Int>? = null
  private val centerCache = HashMap<Triple<Int, Int, Int>, FloatArray>()

  var nmsThresh = 0.4f
  var detThresh = 0.5f
  private val inputMean = 127.5f
  private val inputStd = 128.0f

  init {
    val opt =
      OrtSession.SessionOptions().apply {
        setIntraOpNumThreads(2)
        setInterOpNumThreads(1)
      }
    session = env.createSession(modelBytes, opt)
    val in0 = session.inputInfo.entries.first()
    inputName = in0.key
    val inShape = (in0.value.info as ai.onnxruntime.TensorInfo).shape
    if (inShape.size >= 4 && inShape[2] > 0 && inShape[3] > 0) {
      inputSize = Pair(inShape[3].toInt(), inShape[2].toInt())
    }
    outputNames = session.outputNames.toList()
    val out0 = session.outputInfo[outputNames[0]]!!.info as ai.onnxruntime.TensorInfo
    batched = out0.shape.size >= 3 && out0.shape[0] == 1L
    when (outputNames.size) {
      9 -> {
        fmc = 3
        featStrideFpn = intArrayOf(8, 16, 32)
        numAnchors = 2
        useKps = true
      }
      6 -> {
        fmc = 3
        featStrideFpn = intArrayOf(8, 16, 32)
        numAnchors = 2
        useKps = false
      }
      else ->
        throw IllegalArgumentException(
          "Unsupported SCRFD ONNX: expected 9 or 6 outputs, got ${outputNames.size}",
        )
    }
  }

  data class FaceDet(
    val x1: Float,
    val y1: Float,
    val x2: Float,
    val y2: Float,
    val score: Float,
    val kps: FloatArray?,
  )

  fun detectMaxFace(bitmap: Bitmap): FaceDet? {
    val targetSize = inputSize ?: return null
    val iw = targetSize.first
    val ih = targetSize.second
    val imRatio = bitmap.height.toFloat() / bitmap.width.toFloat()
    val modelRatio = ih.toFloat() / iw.toFloat()
    val newW: Int
    val newH: Int
    if (imRatio > modelRatio) {
      newH = ih
      newW = (newH / imRatio).toInt()
    } else {
      newW = iw
      newH = (newW * imRatio).toInt()
    }
    val scaled = Bitmap.createScaledBitmap(bitmap, newW, newH, true)
    val detImg = Bitmap.createBitmap(iw, ih, Bitmap.Config.ARGB_8888)
    val canvas = android.graphics.Canvas(detImg)
    canvas.drawBitmap(scaled, 0f, 0f, null)
    if (scaled !== bitmap) scaled.recycle()

    val detScale = newH.toFloat() / bitmap.height.toFloat()
    val blob = blobFromImage(detImg, iw, ih)
    detImg.recycle()

    val tensor =
      OnnxTensor.createTensor(
        env,
        java.nio.FloatBuffer.wrap(blob),
        longArrayOf(1, 3, ih.toLong(), iw.toLong()),
      )
    val feeds = mapOf(inputName to tensor)
    val outs = session.run(feeds)
    val netOuts = Array(outputNames.size) { FloatArray(0) }
    for ((idx, name) in outputNames.withIndex()) {
      val v = outs[name].get() as OnnxTensor
      val fb = v.floatBuffer
      netOuts[idx] = FloatArray(fb.remaining()).also { fb.get(it) }
    }
    outs.close()
    tensor.close()

    val merged = forwardMerge(ih, iw, netOuts) ?: return null

    val inv = 1f / detScale
    val kps =
      merged.kps?.clone()?.also {
        for (i in it.indices) it[i] *= inv
      }
    return FaceDet(
      merged.x1 * inv,
      merged.y1 * inv,
      merged.x2 * inv,
      merged.y2 * inv,
      merged.score,
      kps,
    )
  }

  private fun forwardMerge(
    inputHeight: Int,
    inputWidth: Int,
    netOuts: Array<FloatArray>,
  ): FaceDet? {
    val scoresAll = ArrayList<Float>()
    val boxesAll = ArrayList<FloatArray>()
    val kpsAll = ArrayList<FloatArray>()

    for (idx in 0 until fmc) {
      val stride = featStrideFpn[idx]
      val scoresRaw = netOuts[idx]
      val bboxRaw = netOuts[idx + fmc]
      val kpsRaw = if (useKps) netOuts[idx + fmc * 2] else FloatArray(0)

      val scores =
        if (batched && scoresRaw.size > inputHeight * inputWidth * numAnchors) {
          stripBatch(scoresRaw)
        } else {
          scoresRaw
        }
      val bboxSrc =
        if (batched && bboxRaw.size > inputHeight * inputWidth * numAnchors * 4) {
          stripBatch(bboxRaw)
        } else {
          bboxRaw
        }
      val bboxPreds = FloatArray(bboxSrc.size) { i -> bboxSrc[i] * stride }

      val kpsPreds =
        if (useKps) {
          val kSrc =
            if (batched && kpsRaw.size > inputHeight * inputWidth * numAnchors * 10) {
              stripBatch(kpsRaw)
            } else {
              kpsRaw
            }
          FloatArray(kSrc.size) { i -> kSrc[i] * stride }
        } else {
          FloatArray(0)
        }

      val height = inputHeight / stride
      val width = inputWidth / stride
      val key = Triple(height, width, stride)
      val anchors = centerCache.getOrPut(key) { makeAnchors(height, width, stride) }

      val n = height * width * numAnchors
      if (scores.size < n || bboxPreds.size < n * 4) {
        Log.e(TAG, "Stride $stride: scores=${scores.size} bbox=${bboxPreds.size} need n=$n")
        continue
      }

      val bboxes = distance2bbox(anchors, bboxPreds, n)
      val kpss =
        if (useKps && kpsPreds.size >= n * 10) distance2kps(anchors, kpsPreds, n) else null

      for (i in 0 until n) {
        if (scores[i] < detThresh) continue
        scoresAll.add(scores[i])
        boxesAll.add(floatArrayOf(bboxes[i * 4], bboxes[i * 4 + 1], bboxes[i * 4 + 2], bboxes[i * 4 + 3]))
        if (kpss != null) {
          val kp = FloatArray(10)
          System.arraycopy(kpss, i * 10, kp, 0, 10)
          kpsAll.add(kp)
        }
      }
    }

    if (scoresAll.isEmpty()) return null

    val order = scoresAll.indices.sortedByDescending { scoresAll[it] }
    val preDet = ArrayList<FloatArray>()
    val preKps = ArrayList<FloatArray?>()
    for (i in order) {
      val b = boxesAll[i]
      preDet.add(floatArrayOf(b[0], b[1], b[2], b[3], scoresAll[i]))
      preKps.add(if (kpsAll.isNotEmpty()) kpsAll[i] else null)
    }

    val keep = nms(preDet)
    if (keep.isEmpty()) return null

    val bi = keep[0]
    val d = preDet[bi]
    val kp = preKps.getOrNull(bi)?.clone()
    return FaceDet(d[0], d[1], d[2], d[3], d[4], kp)
  }

  private fun stripBatch(raw: FloatArray): FloatArray {
    // assume leading dim 1 merged — heuristic: return tail half if exactly 2x
    return raw
  }

  private fun distance2bbox(
    anchors: FloatArray,
    bboxPreds: FloatArray,
    n: Int,
  ): FloatArray {
    val out = FloatArray(n * 4)
    for (i in 0 until n) {
      val ax = anchors[i * 2]
      val ay = anchors[i * 2 + 1]
      out[i * 4] = ax - bboxPreds[i * 4]
      out[i * 4 + 1] = ay - bboxPreds[i * 4 + 1]
      out[i * 4 + 2] = ax + bboxPreds[i * 4 + 2]
      out[i * 4 + 3] = ay + bboxPreds[i * 4 + 3]
    }
    return out
  }

  /** Five landmark offsets added to the same anchor center (InsightFace SCRFD). */
  private fun distance2kps(
    anchors: FloatArray,
    distance: FloatArray,
    n: Int,
  ): FloatArray {
    val out = FloatArray(n * 10)
    for (i in 0 until n) {
      val ax = anchors[i * 2]
      val ay = anchors[i * 2 + 1]
      for (k in 0 until 5) {
        out[i * 10 + k * 2] = ax + distance[i * 10 + k * 2]
        out[i * 10 + k * 2 + 1] = ay + distance[i * 10 + k * 2 + 1]
      }
    }
    return out
  }

  private fun makeAnchors(
    height: Int,
    width: Int,
    stride: Int,
  ): FloatArray {
    val out = FloatArray(height * width * numAnchors * 2)
    var o = 0
    for (y in 0 until height) {
      for (x in 0 until width) {
        repeat(numAnchors) {
          out[o++] = x * stride.toFloat()
          out[o++] = y * stride.toFloat()
        }
      }
    }
    return out
  }

  private fun blobFromImage(
    bmp: Bitmap,
    width: Int,
    height: Int,
  ): FloatArray {
    val pixels = IntArray(width * height)
    bmp.getPixels(pixels, 0, width, 0, 0, width, height)
    val out = FloatArray(3 * width * height)
    var p = 0
    for (c in 0 until 3) {
      for (y in 0 until height) {
        for (x in 0 until width) {
          val pix = pixels[y * width + x]
          val r = ((pix shr 16) and 0xff).toFloat()
          val g = ((pix shr 8) and 0xff).toFloat()
          val b = (pix and 0xff).toFloat()
          val v =
            when (c) {
              0 -> (b - inputMean) / inputStd
              1 -> (g - inputMean) / inputStd
              else -> (r - inputMean) / inputStd
            }
          out[p++] = v
        }
      }
    }
    return out
  }

  private fun nms(dets: List<FloatArray>): IntArray {
    if (dets.isEmpty()) return intArrayOf()
    val thresh = nmsThresh
    val x1 = FloatArray(dets.size)
    val y1 = FloatArray(dets.size)
    val x2 = FloatArray(dets.size)
    val y2 = FloatArray(dets.size)
    val sc = FloatArray(dets.size)
    val areas = FloatArray(dets.size)
    for (i in dets.indices) {
      x1[i] = dets[i][0]
      y1[i] = dets[i][1]
      x2[i] = dets[i][2]
      y2[i] = dets[i][3]
      sc[i] = dets[i][4]
      areas[i] = (x2[i] - x1[i] + 1) * (y2[i] - y1[i] + 1)
    }
    val order = dets.indices.sortedByDescending { sc[it] }.toMutableList()
    val keep = ArrayList<Int>()
    while (order.isNotEmpty()) {
      val i = order.removeAt(0)
      keep.add(i)
      if (order.isEmpty()) break
      val remain = ArrayList<Int>()
      for (j in order) {
        val xx1 = max(x1[i], x1[j])
        val yy1 = max(y1[i], y1[j])
        val xx2 = min(x2[i], x2[j])
        val yy2 = min(y2[i], y2[j])
        val w = max(0f, xx2 - xx1 + 1)
        val h = max(0f, yy2 - yy1 + 1)
        val inter = w * h
        val ovr = inter / (areas[i] + areas[j] - inter)
        if (ovr <= thresh) remain.add(j)
      }
      order.clear()
      order.addAll(remain)
    }
    return keep.toIntArray()
  }

  fun close() {
    try {
      session.close()
    } catch (e: Exception) {
      Log.w(TAG, "close session", e)
    }
  }

  companion object {
    private const val TAG = "ScrfdDetector"
  }
}
