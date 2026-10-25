package uts.sdk.modules.tpWalletSdk

import android.app.Activity
import android.os.Bundle
import io.dcloud.uts.console

/**
 * 对应官方 SDK 的 TPAssistActivity：
 * TokenPocket 完成后拉起本 Activity，Intent 携带 status / result。
 */
class TpAssistActivity : Activity() {
	override fun onCreate(savedInstanceState: Bundle?) {
		super.onCreate(savedInstanceState)
		try {
			val intent = intent
			val status = intent?.getIntExtra("status", 0) ?: 0
			val result = intent?.getStringExtra("result")
			console.log("[tp-sdk] assist status=", status, "resultLen=", result?.length ?: 0)
			TpWalletNative.deliverResult(status, result)
		} catch (e: Throwable) {
			console.warn("[tp-sdk] assist fail", e)
			TpWalletNative.deliverResult(2, "" + e.message)
		}
		finish()
	}
}
