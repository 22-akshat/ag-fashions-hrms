package com.agfashions.attendance.mlkit

import android.graphics.BitmapFactory
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions

class FaceGeometryModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val detector by lazy {
    FaceDetection.getClient(
      FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
        .build(),
    )
  }

  override fun getName(): String = "FaceGeometry"

  @ReactMethod
  fun detectFaces(imageUri: String, promise: Promise) {
    val uri =
      try {
        Uri.parse(imageUri)
      } catch (e: Exception) {
        promise.reject("INVALID_URI", e.message, e)
        return
      }

    val bitmap =
      try {
        loadBitmap(uri)
      } catch (e: Exception) {
        promise.reject("BITMAP_LOAD_FAILED", e.message, e)
        return
      }

    if (bitmap == null) {
      promise.reject("BITMAP_NULL", "Could not decode image")
      return
    }

    val image = InputImage.fromBitmap(bitmap, 0)

    detector
      .process(image)
      .addOnSuccessListener { faces ->
        val facesArray = Arguments.createArray()
        for (face in faces) {
          val b = face.boundingBox
          val map = Arguments.createMap()
          map.putDouble("x", b.left.toDouble())
          map.putDouble("y", b.top.toDouble())
          map.putDouble("width", (b.right - b.left).toDouble())
          map.putDouble("height", (b.bottom - b.top).toDouble())
          facesArray.pushMap(map)
        }
        val out = Arguments.createMap()
        out.putArray("faces", facesArray)
        out.putInt("imageWidth", bitmap.width)
        out.putInt("imageHeight", bitmap.height)
        promise.resolve(out)
      }
      .addOnFailureListener { e -> promise.reject("FACE_DETECT_FAILED", e.message, e) }
  }

  private fun loadBitmap(uri: Uri): android.graphics.Bitmap? {
    val ctx = reactApplicationContext
    return try {
      when (uri.scheme) {
        "content" ->
          ctx.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) }
        "file" -> {
          val path = uri.path ?: return null
          BitmapFactory.decodeFile(path)
        }
        else ->
          ctx.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) }
      }
    } catch (_: Exception) {
      null
    }
  }
}
