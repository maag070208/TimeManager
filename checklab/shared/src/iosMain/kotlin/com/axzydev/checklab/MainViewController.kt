package com.axzydev.checklab

import androidx.compose.ui.window.ComposeUIViewController
import com.axzydev.checklab.core.storage.iosPlatformModule
import com.axzydev.checklab.di.initKoin
import platform.Foundation.NSBundle
import platform.UIKit.UIViewController

private var koinStarted = false

/** URL del API desde `Info.plist` (`CHECKLAB_API_URL`, definida en `Config.xcconfig`). */
private fun apiUrl(): String =
    (NSBundle.mainBundle.objectForInfoDictionaryKey("CHECKLAB_API_URL") as? String)
        ?.takeIf { it.isNotBlank() && !it.startsWith("$(") }
        ?: "http://localhost:4021/api/v1"

fun MainViewController(): UIViewController {
    if (!koinStarted) {
        initKoin(apiUrl(), iosPlatformModule)
        koinStarted = true
    }
    return ComposeUIViewController { App() }
}
