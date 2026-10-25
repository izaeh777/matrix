package uts.sdk.modules.tpWalletSdk

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import io.dcloud.uts.UTSAndroid
import io.dcloud.uts.console
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder

/**
 * 复刻 TokenPocket Mobile-SDK 协议（不依赖 wallet-sdk AAR）
 *
 * 官方 SDK 实际行为：
 * 1) 把 Authorize/Signature 序列化成 JSON
 * 2) Intent.ACTION_VIEW → tpoutside://pull.activity?param=encode(json)
 * 3) extras: packageName / className(AssistActivity) / appName
 * 4) TP 完成后拉起 AssistActivity，带 status + result
 *
 * 这样真机热更新即可用；只需基座/打包时 Manifest 里有 TpAssistActivity。
 */
object TpWalletNative {

	private const val TP_PKG = "vip.mytokenpocket"
	private const val ASSIST_CLASS = "uts.sdk.modules.tpWalletSdk.TpAssistActivity"

	@Volatile
	private var pendingCb: ((Int, String) -> Unit)? = null

	fun isTpInstalled(): Boolean {
		val ctx = UTSAndroid.getAppContext() ?: return false
		return try {
			ctx.packageManager.getPackageInfo(TP_PKG, 0)
			true
		} catch (e: PackageManager.NameNotFoundException) {
			false
		} catch (e: Throwable) {
			false
		}
	}

	/** 供 TpAssistActivity 回调 */
	fun deliverResult(status: Int, result: String?) {
		val cb = pendingCb
		pendingCb = null
		val data = result ?: ""
		if (cb == null) {
			console.warn("[tp-sdk] assist result without pending", status, data)
			return
		}
		// 延后到主线程下一拍，避开 AssistActivity finish / App 切前台瞬间（否则 uni.request 易挂起）
		val code = when (status) {
			0 -> 2
			2 -> 1
			else -> 0
		}
		val act = UTSAndroid.getUniActivity()
		val run = Runnable {
			try {
				cb(code, data)
			} catch (e: Throwable) {
				console.warn("[tp-sdk] deliver cb fail", e)
			}
		}
		if (act != null) {
			act.runOnUiThread {
				android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(run, 320)
			}
		} else {
			android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(run, 320)
		}
	}

	/**
	 * DeepLink callbackSchema 兜底：itiklink://tp-wallet?...
	 * 当 AssistActivity 未打进基座时，用 schema 回跳仍能结束 Promise。
	 */
	fun deliverFromSchema(urlOrQuery: String): Boolean {
		if (urlOrQuery.isEmpty()) return false
		if (pendingCb == null) return false
		try {
			val q = urlOrQuery.substringAfter('?', urlOrQuery)
			val map = linkedMapOf<String, String>()
			for (part in q.split('&')) {
				val i = part.indexOf('=')
				if (i <= 0) continue
				val k = Uri.decode(part.substring(0, i))
				val v = Uri.decode(part.substring(i + 1))
				map[k] = v
			}
			val wallet = map["wallet"] ?: map["account"] ?: map["publickey"] ?: ""
			val sign = map["sign"] ?: map["signature"] ?: ""
			val action = map["action"] ?: ""
			val actionId = map["actionId"] ?: ""
			val resultFlag = map["result"] ?: ""
			val ok = resultFlag == "1" || resultFlag.equals("true", true) || wallet.isNotEmpty() || sign.isNotEmpty()
			val payload = JSONObject()
			payload.put("wallet", wallet)
			payload.put("account", wallet)
			payload.put("sign", sign)
			payload.put("signature", sign)
			payload.put("action", action)
			payload.put("actionId", actionId)
			payload.put("result", if (ok) 1 else 0)
			deliverResult(if (ok) 1 else 2, payload.toString())
			return true
		} catch (e: Throwable) {
			console.warn("[tp-sdk] schema deliver fail", e)
			return false
		}
	}

	fun authorize(
		actionId: String,
		dappName: String,
		dappIcon: String,
		memo: String,
		chainId: String,
		callback: (code: Int, data: String) -> Unit
	) {
		val param = JSONObject()
		param.put("protocol", "TokenPocket")
		param.put("version", "2.0")
		param.put("dappName", dappName)
		param.put("dappIcon", dappIcon)
		param.put("action", "login")
		param.put("actionId", actionId)
		param.put("memo", memo)
		val chains = JSONArray()
		val c = JSONObject()
		c.put("network", "ethereum")
		c.put("chainId", chainId)
		chains.put(c)
		param.put("blockchains", chains)
		// 双通道回传：SDK Intent + DeepLink schema（AssistActivity 未进基座时仍可跳回）
		param.put("callbackSchema", "itiklink://tp-wallet")
		pullWallet(param.toString(), callback)
	}

	fun personalSign(
		message: String,
		actionId: String,
		dappName: String,
		dappIcon: String,
		memo: String,
		chainId: String,
		signType: String,
		callback: (code: Int, data: String) -> Unit
	) {
		// 同时带 HTTPS callbackUrl：票务流可双通道完成
		pullWallet(
			buildSignJson(
				message, actionId, dappName, dappIcon, memo, chainId, signType,
				"https://m.itiklink.com/api/v1/auth/wallet/tp-login",
				"itiklink://tp-wallet"
			),
			callback
		)
	}

	/**
	 * tp-login 票务流：本地拼完整 sign 协议（含 signType + HTTPS callbackUrl），
	 * 用官方 URLEncoder + Intent extras 拉起，避免服务端 deeplink 缺字段 / 重编码损坏。
	 * 结果靠服务端 callbackUrl + 轮询 ticket；不挂 pendingCb。
	 */
	fun pullTicketSign(
		message: String,
		actionId: String,
		dappName: String,
		dappIcon: String,
		memo: String,
		chainId: String,
		callbackUrl: String,
		callbackSchema: String
	): Boolean {
		val activity = UTSAndroid.getUniActivity()
		if (activity == null) return false
		if (message.isEmpty() || actionId.isEmpty()) return false
		// 票务流只靠 HTTPS callbackUrl，清掉旧的 SDK Promise 回调
		pendingCb = null
		val json = buildSignJson(
			message, actionId, dappName, dappIcon, memo, chainId,
			"ethPersonalSign", callbackUrl, callbackSchema
		)
		val run = Runnable {
			startPull(activity, json, null)
		}
		return try {
			if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
				startPull(activity, json, null)
			} else {
				activity.runOnUiThread(run)
				true
			}
		} catch (e: Throwable) {
			console.warn("[tp-sdk] pullTicketSign fail", e)
			false
		}
	}

	private fun buildSignJson(
		message: String,
		actionId: String,
		dappName: String,
		dappIcon: String,
		memo: String,
		chainId: String,
		signType: String,
		callbackUrl: String,
		callbackSchema: String
	): String {
		val param = JSONObject()
		param.put("protocol", "TokenPocket")
		param.put("version", "2.0")
		param.put("dappName", dappName)
		param.put("dappIcon", dappIcon)
		param.put("action", "sign")
		param.put("actionId", actionId)
		param.put("memo", memo)
		param.put("message", message)
		param.put("signType", signType)
		param.put("hash", false)
		val chains = JSONArray()
		val c = JSONObject()
		c.put("network", "ethereum")
		c.put("chainId", chainId)
		chains.put(c)
		param.put("blockchains", chains)
		if (callbackUrl.isNotEmpty()) {
			param.put("callbackUrl", callbackUrl)
		}
		if (callbackSchema.isNotEmpty()) {
			param.put("callbackSchema", callbackSchema)
		}
		return param.toString()
	}

	private fun pullWallet(json: String, callback: (code: Int, data: String) -> Unit) {
		val activity = UTSAndroid.getUniActivity()
		if (activity == null) {
			callback(1, "no activity")
			return
		}
		val run = Runnable {
			val ok = startPull(activity, json, callback)
			if (!ok) {
				callback(1, "pull fail")
			}
		}
		if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
			run.run()
		} else {
			activity.runOnUiThread(run)
		}
	}

	private fun startPull(
		activity: Activity,
		json: String,
		callback: ((code: Int, data: String) -> Unit)?
	): Boolean {
		return try {
			if (callback != null) {
				pendingCb = callback
			}
			// 与官方 Mobile-SDK 一致：Java URLEncoder（空格→+）
			val encoded = URLEncoder.encode(json, "utf-8")
			val uri = Uri.parse("tpoutside://pull.activity?param=$encoded")
			val intent = Intent()
			intent.action = Intent.ACTION_VIEW
			intent.data = uri
			intent.putExtra("packageName", activity.packageName)
			intent.putExtra("className", ASSIST_CLASS)
			intent.putExtra("appName", appLabel(activity))
			// 显式拉起 PullUpActivity，避免只进 TP 桌面
			try {
				intent.setClassName(TP_PKG, "com.tokenbank.pull.PullUpActivity")
			} catch (_: Throwable) {
			}
			console.log("[tp-sdk] pull", activity.packageName, ASSIST_CLASS, "jsonLen=", json.length)
			activity.startActivity(intent)
			true
		} catch (e: Throwable) {
			if (callback != null) {
				pendingCb = null
			}
			console.warn("[tp-sdk] pull fail", e)
			try {
				val encoded = URLEncoder.encode(json, "utf-8")
				val uri = Uri.parse("tpoutside://pull.activity?param=$encoded")
				val intent = Intent(Intent.ACTION_VIEW, uri)
				intent.setPackage(TP_PKG)
				intent.putExtra("packageName", activity.packageName)
				intent.putExtra("className", ASSIST_CLASS)
				intent.putExtra("appName", appLabel(activity))
				activity.startActivity(intent)
				if (callback != null) pendingCb = callback
				true
			} catch (e2: Throwable) {
				console.warn("[tp-sdk] pull retry fail", e2)
				false
			}
		}
	}

	private fun appLabel(activity: Activity): String {
		return try {
			val pm = activity.packageManager
			val ai = pm.getApplicationInfo(activity.packageName, 0)
			val label = pm.getApplicationLabel(ai)
			label.toString()
		} catch (e: Throwable) {
			"i-tiklink"
		}
	}
}
