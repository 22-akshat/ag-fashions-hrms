package com.agfashions.attendance.ml.align

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint

/**
 * InsightFace-style 112×112 similarity warp using the first three landmarks
 * (typically left eye, right eye, nose). Matches common ArcFace ONNX crops.
 */
object FaceAlign {
  /** ArcFace / InsightFace reference landmarks on 112×112 canvas (partial subset). */
  private val DST_TRI =
    floatArrayOf(
      38.2946f,
      51.6963f,
      73.5318f,
      51.5014f,
      56.0252f,
      71.7366f,
    )

  fun warp112Rgb(bitmap: Bitmap, kps5x2: FloatArray): Bitmap {
    require(kps5x2.size >= 6) { "Need at least 3 landmark points (6 floats)" }
    val src =
      floatArrayOf(
        kps5x2[0],
        kps5x2[1],
        kps5x2[2],
        kps5x2[3],
        kps5x2[4],
        kps5x2[5],
      )
    val m = Matrix()
    if (!m.setPolyToPoly(src, 0, DST_TRI, 0, 3)) {
      throw IllegalStateException("setPolyToPoly failed")
    }
    val out = Bitmap.createBitmap(112, 112, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(out)
    val paint =
      Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    canvas.drawBitmap(bitmap, m, paint)
    return out
  }
}
