package com.axzydev.checklab

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform