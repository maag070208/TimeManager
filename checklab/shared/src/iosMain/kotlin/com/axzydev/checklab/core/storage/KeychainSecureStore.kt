package com.axzydev.checklab.core.storage

import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.alloc
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.value
import org.koin.dsl.module
import platform.CoreFoundation.CFDictionaryAddValue
import platform.CoreFoundation.CFDictionaryCreateMutable
import platform.CoreFoundation.CFMutableDictionaryRef
import platform.CoreFoundation.CFRelease
import platform.CoreFoundation.CFTypeRef
import platform.CoreFoundation.CFTypeRefVar
import platform.CoreFoundation.kCFBooleanTrue
import platform.CoreFoundation.kCFTypeDictionaryKeyCallBacks
import platform.CoreFoundation.kCFTypeDictionaryValueCallBacks
import platform.Foundation.CFBridgingRelease
import platform.Foundation.CFBridgingRetain
import platform.Foundation.NSData
import platform.Foundation.NSString
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.create
import platform.Foundation.dataUsingEncoding
import platform.Security.SecItemAdd
import platform.Security.SecItemCopyMatching
import platform.Security.SecItemDelete
import platform.Security.errSecSuccess
import platform.Security.kSecAttrAccessible
import platform.Security.kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
import platform.Security.kSecAttrAccount
import platform.Security.kSecAttrService
import platform.Security.kSecClass
import platform.Security.kSecClassGenericPassword
import platform.Security.kSecMatchLimit
import platform.Security.kSecMatchLimitOne
import platform.Security.kSecReturnData
import platform.Security.kSecValueData

/** Llavero de iOS (genérico por servicio), solo accesible en este dispositivo. */
@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
class KeychainSecureStore(private val service: String = "com.axzydev.checklab.session") : SecureStore {

    private fun query(account: String, extra: CFMutableDictionaryRef.() -> Unit = {}): CFMutableDictionaryRef {
        val dict = CFDictionaryCreateMutable(null, 0, kCFTypeDictionaryKeyCallBacks.ptr, kCFTypeDictionaryValueCallBacks.ptr)!!
        CFDictionaryAddValue(dict, kSecClass, kSecClassGenericPassword)
        dict.addRetained(kSecAttrService, CFBridgingRetain(service))
        dict.addRetained(kSecAttrAccount, CFBridgingRetain(account))
        dict.extra()
        return dict
    }

    private fun CFMutableDictionaryRef.addRetained(key: CFTypeRef?, value: CFTypeRef?) {
        CFDictionaryAddValue(this, key, value)
        if (value != null) CFRelease(value)
    }

    override fun get(key: String): String? = memScoped {
        val q = query(key) {
            CFDictionaryAddValue(this, kSecReturnData, kCFBooleanTrue)
            CFDictionaryAddValue(this, kSecMatchLimit, kSecMatchLimitOne)
        }
        val result = alloc<CFTypeRefVar>()
        val status = SecItemCopyMatching(q, result.ptr)
        CFRelease(q)
        if (status != errSecSuccess) return@memScoped null
        val data = CFBridgingRelease(result.value) as? NSData ?: return@memScoped null
        NSString.create(data = data, encoding = NSUTF8StringEncoding)?.toString()
    }

    override fun put(key: String, value: String) {
        remove(key)
        val bytes = NSString.create(string = value).dataUsingEncoding(NSUTF8StringEncoding) ?: return
        val q = query(key) {
            addRetained(kSecValueData, CFBridgingRetain(bytes))
            CFDictionaryAddValue(this, kSecAttrAccessible, kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly)
        }
        SecItemAdd(q, null)
        CFRelease(q)
    }

    override fun remove(key: String) {
        val q = query(key)
        SecItemDelete(q)
        CFRelease(q)
    }
}

val iosPlatformModule = module {
    single<SecureStore> { KeychainSecureStore() }
}
