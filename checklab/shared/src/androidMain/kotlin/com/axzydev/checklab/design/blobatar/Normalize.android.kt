package com.axzydev.checklab.design.blobatar

import java.text.Normalizer

internal actual fun normalizeNfc(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFC)
