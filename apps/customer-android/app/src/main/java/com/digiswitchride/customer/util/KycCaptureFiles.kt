package com.digiswitchride.customer.util

import android.content.Context
import androidx.core.content.FileProvider
import java.io.File

object KycCaptureFiles {
    fun newCameraPhoto(context: Context): Pair<File, android.net.Uri> {
        val dir = File(context.cacheDir, "kyc").apply { mkdirs() }
        val file = File(dir, "capture-${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        return file to uri
    }
}
