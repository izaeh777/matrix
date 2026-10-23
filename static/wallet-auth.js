/**
 * Web3 钱包桥接（TokenPocket / DeBox / MetaMask / OKX 等）
 * 线上若 index 未带上本文件，login-wallet 会再尝试直接读 ethereum。
 */
(function (w) {
	function provider() {
		try {
			if (w.tokenpocket != null && w.tokenpocket.ethereum != null) return w.tokenpocket.ethereum
		} catch (e0) {}
		try {
			if (w.deboxWallet != null) return w.deboxWallet
		} catch (e1) {}
		try {
			if (w.ethereum != null) return w.ethereum
		} catch (e2) {}
		return null
	}

	function hasEth() {
		return provider() != null
	}

	function walletName() {
		try {
			if (w.tokenpocket != null) return 'TokenPocket'
			if (w.deboxWallet != null) return 'DeBox'
			if (w.ethereum != null && w.ethereum.isMetaMask) return 'MetaMask'
			if (w.ethereum != null && w.ethereum.isOkxWallet) return 'OKX'
			if (w.ethereum != null) return 'Web3'
		} catch (e) {}
		return ''
	}

	async function connect() {
		const eth = provider()
		if (eth == null) {
			throw new Error('未检测到钱包，请在 TokenPocket / DeBox / MetaMask 等钱包浏览器内打开')
		}
		const accounts = await eth.request({ method: 'eth_requestAccounts', params: [] })
		if (accounts == null || accounts.length == 0) {
			throw new Error('未获取到钱包地址')
		}
		return accounts[0]
	}

	async function personalSign(message, address) {
		const eth = provider()
		if (eth == null) {
			throw new Error('未检测到钱包，请在 TokenPocket / DeBox / MetaMask 等钱包浏览器内打开')
		}
		if (message == null || ('' + message).length == 0) {
			throw new Error('签名消息为空')
		}
		if (address == null || ('' + address).length == 0) {
			throw new Error('钱包地址为空')
		}
		return await eth.request({
			method: 'personal_sign',
			params: [message, address]
		})
	}

	w.__itikWallet = {
		hasEth: hasEth,
		walletName: walletName,
		connect: connect,
		personalSign: personalSign,
		provider: provider
	}
})(typeof window !== 'undefined' ? window : globalThis)
