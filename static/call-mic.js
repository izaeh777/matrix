(function () {
  if (window.__unlockCallMedia) return

  function liveStream(stream) {
    if (!stream) return false
    try {
      var tracks = stream.getTracks()
      for (var i = 0; i < tracks.length; i++) {
        if (tracks[i].readyState === 'live') return true
      }
    } catch (e) {}
    return false
  }

  function hasVideo(stream) {
    try {
      return !!(stream && stream.getVideoTracks && stream.getVideoTracks().length > 0)
    } catch (e) {
      return false
    }
  }

  function gum(cons) {
    var md = navigator.mediaDevices
    if (md && md.getUserMedia) return md.getUserMedia(cons)
    var legacy = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia
    if (!legacy) return Promise.reject(new Error('no mediaDevices'))
    return new Promise(function (resolve, reject) {
      legacy.call(navigator, cons, resolve, reject)
    })
  }

  function listInputs() {
    var md = navigator.mediaDevices
    if (!md || !md.enumerateDevices) {
      return Promise.resolve({ audioIds: [], videoIds: [] })
    }
    return md.enumerateDevices().then(function (list) {
      var audioIds = []
      var videoIds = []
      for (var i = 0; i < list.length; i++) {
        var d = list[i]
        if (!d || !d.kind) continue
        if (d.kind === 'audioinput' && d.deviceId) audioIds.push(d.deviceId)
        if (d.kind === 'videoinput' && d.deviceId) videoIds.push(d.deviceId)
      }
      return { audioIds: audioIds, videoIds: videoIds }
    }).catch(function () {
      return { audioIds: [], videoIds: [] }
    })
  }

  function errHint(err) {
    var name = (err && err.name) ? err.name : ''
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return '未检测到麦克风，请检查设备是否接入，或在系统设置里打开麦克风'
    }
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return '麦克风权限被拒绝，请在浏览器地址栏右侧允许麦克风'
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return '麦克风被其他应用占用，请关闭后重试'
    }
    if (name === 'OverconstrainedError') {
      return '当前麦克风不满足通话要求，请换一个输入设备'
    }
    return '无法打开麦克风'
  }

  function tryAudioChain(audioIds) {
    var tries = []
    tries.push({ audio: true, video: false })
    tries.push({ audio: { echoCancellation: true }, video: false })
    tries.push({ audio: {}, video: false })
    if (audioIds && audioIds.length > 0) {
      tries.push({ audio: { deviceId: { ideal: audioIds[0] } }, video: false })
      tries.push({ audio: { deviceId: audioIds[0] }, video: false })
    }
    var i = 0
    function next(prevErr) {
      if (i >= tries.length) {
        return Promise.reject(prevErr || new Error('mic fail'))
      }
      var cons = tries[i++]
      return gum(cons).catch(function (err) {
        console.warn('[mic] try fail', cons && cons.audio, err && err.name, err && err.message)
        return next(err)
      })
    }
    return next(null)
  }

  function tryVideoChain(audioIds, videoIds) {
    var tries = []
    tries.push({ audio: true, video: true })
    tries.push({ audio: true, video: { facingMode: 'user' } })
    tries.push({ audio: true, video: { facingMode: { ideal: 'user' } } })
    if (videoIds && videoIds.length > 0) {
      tries.push({
        audio: true,
        video: { deviceId: { ideal: videoIds[0] } }
      })
    }
    var i = 0
    function next(prevErr) {
      if (i >= tries.length) {
        return tryAudioChain(audioIds)
      }
      var cons = tries[i++]
      return gum(cons).catch(function (err) {
        console.warn('[mic] video try fail', err && err.name, err && err.message)
        return next(err)
      })
    }
    return next(null)
  }

  window.__callMediaHint = errHint

  window.__unlockCallMedia = function (video) {
    var cur = window.__callLocalStream
    if (liveStream(cur) && (!video || hasVideo(cur))) {
      return Promise.resolve(cur)
    }
    if (window.__callMediaPromise) return window.__callMediaPromise
    var p = listInputs().then(function (devs) {
      console.log('[mic] devices audio=', devs.audioIds.length, 'video=', devs.videoIds.length)
      if (!video && devs.audioIds.length === 0) {
        // 枚举为空时仍尝试一次 getUserMedia（部分浏览器未授权前不返回 label/id）
        return tryAudioChain([])
      }
      if (video) return tryVideoChain(devs.audioIds, devs.videoIds)
      return tryAudioChain(devs.audioIds)
    }).then(function (stream) {
      window.__callLocalStream = stream
      window.__callMediaPromise = null
      return stream
    }).catch(function (err) {
      window.__callMediaPromise = null
      var hint = errHint(err)
      console.warn('[mic] unlock fail', err && err.name, err && err.message, hint)
      try {
        if (typeof uni !== 'undefined' && uni.showToast) {
          uni.showToast({ title: hint, icon: 'none', duration: 3500 })
        }
      } catch (eToast) {}
      var e2 = err || new Error('mic fail')
      e2.__micHint = hint
      throw e2
    })
    window.__callMediaPromise = p
    return p
  }
})()
