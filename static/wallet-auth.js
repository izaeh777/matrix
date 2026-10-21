/**
 * DeBox / Web3 钱包桥接
 * DeBox 内打开时注入 window.deboxWallet（也可用 window.ethereum 别名）
 * 文档: https://docs.debox.pro/Shares/
 * 对接示例: https://m.itiklink.com/wallet-demo.html
 */
(function (w) {
	function provider() {
		if (w.deboxWallet != null) return w.deboxWallet
		if (w.ethereum != null) return w.ethereum
		return null
	}

	function hasEth() {
		return provider() != null
	}

	function isDebox() {
		return w.deboxWallet != null
	}

	async function connect() {
		const eth = provider()
		if (eth == null) {
			throw new Error('请在 DeBox App 内打开，或安装 DeBox / 兼容 Web3 钱包')
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
			throw new Error('请在 DeBox App 内打开，或安装 DeBox / 兼容 Web3 钱包')
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
		isDebox: isDebox,
		connect: connect,
		personalSign: personalSign
	}
})(window)
