package com.agfashions.attendance.biometrics

import com.agfashions.attendance.util.BitmapLoader
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class FaceBiometricsModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private val pipeline by lazy { FaceBiometricsPipeline(reactContext.assets) }
  private val executor: ExecutorService = Executors.newFixedThreadPool(1)

  override fun getName(): String = "FaceBiometrics"

  @ReactMethod
  fun extractEmbedding(
    imageUri: String,
    options: ReadableMap?,
    promise: Promise,
  ) {
    executor.execute {
      try {
        val bmp =
          BitmapLoader.load(reactApplicationContext, imageUri)
            ?: throw IllegalArgumentException("BITMAP_LOAD_FAILED")
        applyOptions(options)
        val r = pipeline.extractFromBitmap(bmp)
        bmp.recycle()
        val map = Arguments.createMap()
        map.putArray(
          "embedding",
          Arguments.fromList(r.embedding.map { it.toDouble() }.toList()),
        )
        map.putDouble("liveScore", r.liveScore.toDouble())
        map.putDouble("detScore", r.detScore.toDouble())
        map.putInt("embeddingDim", r.embedding.size)
        map.putDouble("timingMs", r.timingMs.toDouble())
        promise.resolve(map)
      } catch (e: Exception) {
        promise.reject(e.javaClass.simpleName, e.message, e)
      }
    }
  }

  /** Lightweight silent anti-spoof score (SCRFD crop → MiniFAS-style ONNX). */
  @ReactMethod
  fun silentLivenessScore(
    imageUri: String,
    options: ReadableMap?,
    promise: Promise,
  ) {
    executor.execute {
      try {
        val bmp =
          BitmapLoader.load(reactApplicationContext, imageUri)
            ?: throw IllegalArgumentException("BITMAP_LOAD_FAILED")
        applyOptions(options)
        val score = pipeline.silentAntiSpoofOnly(bmp)
        bmp.recycle()
        promise.resolve(score.toDouble())
      } catch (e: Exception) {
        promise.reject(e.javaClass.simpleName, e.message, e)
      }
    }
  }

  private fun applyOptions(options: ReadableMap?) {
    if (options == null) return
    if (options.hasKey("antiSpoofThreshold")) {
      pipeline.antiSpoofThreshold = options.getDouble("antiSpoofThreshold").toFloat()
    }
    if (options.hasKey("detThresh")) {
      pipeline.scrfdDet = options.getDouble("detThresh").toFloat()
    }
    if (options.hasKey("nmsThresh")) {
      pipeline.scrfdNms = options.getDouble("nmsThresh").toFloat()
    }
  }

  override fun invalidate() {
    pipeline.release()
    executor.shutdown()
    super.invalidate()
  }
}
