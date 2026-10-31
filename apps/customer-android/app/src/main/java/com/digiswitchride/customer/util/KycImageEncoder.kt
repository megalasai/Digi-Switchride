package com.digiswitchride.customer.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import java.io.ByteArrayOutputStream
import kotlin.math.max

object KycImageEncoder {
    private const val MAX_EDGE = 1600
    private const val MAX_BYTES = 4_500_000

    fun uriToDataUrl(context: Context, uri: Uri): String {
        context.contentResolver.openInputStream(uri)?.use { input ->
            val raw = BitmapFactory.decodeStream(input) ?: throw IllegalArgumentException("Could not read image")
            return bitmapToDataUrl(scaleDown(raw))
        }
        throw IllegalArgumentException("Could not open image")
    }

    private fun scaleDown(source: Bitmap): Bitmap {
        val w = source.width
        val h = source.height
        val longest = max(w, h)
        if (longest <= MAX_EDGE) return source
        val scale = MAX_EDGE.toFloat() / longest
        val nw = (w * scale).toInt().coerceAtLeast(1)
        val nh = (h * scale).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(source, nw, nh, true)
    }

    private fun bitmapToDataUrl(bitmap: Bitmap): String {
        var quality = 88
        var bytes: ByteArray
        do {
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream)
            bytes = stream.toByteArray()
            quality -= 8
        } while (bytes.size > MAX_BYTES && quality >= 40)
        if (bytes.size > MAX_BYTES) {
            throw IllegalArgumentException("Image is too large. Try a smaller photo.")
        }
        val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
        return "data:image/jpeg;base64,$b64"
    }
}
