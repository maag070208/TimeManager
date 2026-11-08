package com.axzydev.checklab

import android.app.Application
import com.axzydev.checklab.core.storage.androidPlatformModule
import com.axzydev.checklab.di.initKoin
import org.koin.android.ext.koin.androidContext

class CheckLabApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        initKoin(BuildConfig.API_URL, androidPlatformModule(this)) { androidContext(this@CheckLabApplication) }
    }
}
