package com.agfashions.attendance.util

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.facebook.react.bridge.ReactApplicationContext
import java.io.InputStream

object BitmapLoader {
  fun load(reactContext: ReactApplicationContext, imageUri: String): Bitmap? {
    val uri =
      try {
        Uri.parse(imageUri)
      } catch (_: Exception) {
        return null
      }
    val ctx = reactContext.applicationContext
    return try {
      when (uri.scheme) {
        "content" -> ctx.contentResolver.openInputStream(uri)?.use { decode(it) }
        "file" -> {
          val path = uri.path ?: return null
          BitmapFactory.decodeFile(path)
        }
        else -> ctx.contentResolver.openInputStream(uri)?.use { decode(it) }
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun decode(stream: InputStream): Bitmap? = BitmapFactory.decodeStream(stream)
}
