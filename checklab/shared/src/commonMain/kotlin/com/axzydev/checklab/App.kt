package com.axzydev.checklab

import androidx.compose.runtime.Composable
import com.axzydev.checklab.design.CheckLabTheme
import com.axzydev.checklab.navigation.AppNavHost

@Composable
fun App() {
    CheckLabTheme {
        AppNavHost()
    }
}
