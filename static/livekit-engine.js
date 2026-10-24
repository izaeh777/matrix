/**
 * LiveKit SFU 引擎（H5）
 * 挂到 __callJson：cmd=lkConnect / lkHang / lkMute / lkCamera
 * 回传 type=connected|failed|hangup|sfuReady（与 call-engine 一致）
 */
(function (w) {
  if (w.__lkEngineReady) return
  w.__lkEngineReady = true

  var room = null
  var localTracks = []
  var connectedPosted = false
  var videoWanted = false

  function emit(obj) {
    try {
      obj.__callEngine = true
      if (w.parent && w.parent !== w) {
        try { w.parent.postMessage(obj, '*') } catch (e0) {}
      }
      w.postMessage(obj, '*')
      if (w.uni && uni.postMessage) uni.postMessage({ data: obj })
    } catch (e) {}
  }

  function lkApi() {
    return w.LivekitClient || null
  }

  function ensureMediaEls() {
    var doc = w.document
    if (!doc) return null
    var root = doc.getElementById('callEngineRoot')
    if (!root) {
      root = doc.createElement('div')
      root.id = 'callEngineRoot'
      doc.body.appendChild(root)
    }
    root.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:160px;z-index:9998;background:#111;overflow:hidden;pointer-events:none;'
    if (!doc.getElementById('remote')) {
      var remote = doc.createElement('video')
      remote.id = 'remote'
      remote.autoplay = true
      remote.setAttribute('playsinline', 'true')
      remote.setAttribute('webkit-playsinline', 'true')
      remote.playsInline = true
      remote.muted = true
      root.appendChild(remote)
    }
    if (!doc.getElementById('local')) {
      var local = doc.createElement('video')
      local.id = 'local'
      local.autoplay = true
      local.muted = true
      local.setAttribute('playsinline', 'true')
      local.setAttribute('webkit-playsinline', 'true')
      local.playsInline = true
      root.appendChild(local)
    }
    if (!doc.getElementById('remoteAudio')) {
      var audio = doc.createElement('audio')
      audio.id = 'remoteAudio'
      audio.autoplay = true
      audio.setAttribute('playsinline', 'true')
      root.appendChild(audio)
    }
    return root
  }

  function showMediaLayout(hasRemoteVideo) {
    ensureMediaEls()
    var doc = w.document
    if (!doc) return
    var root = doc.getElementById('callEngineRoot')
    var remote = doc.getElementById('remote')
    var local = doc.getElementById('local')
    var w0 = (root && root.clientWidth) ? root.clientWidth : (w.innerWidth || 360)
    var h0 = (root && root.clientHeight) ? root.clientHeight : Math.max(240, (w.innerHeight || 640) - 160)
    if (typeof w.setVideoLayout === 'function') {
      try { w.setVideoLayout(true) } catch (e0) {}
    }
    if (remote) {
      remote.style.cssText = 'position:absolute;left:0;top:0;width:' + w0 + 'px;height:' + h0 + 'px;object-fit:cover;background:#111;z-index:1;opacity:1;visibility:visible;'
      remote.muted = true
    }
    if (local) {
      if (hasRemoteVideo || videoWanted) {
        var pipW = Math.floor(w0 * 0.28)
        if (pipW < 96) pipW = 96
        var pipH = Math.floor(pipW * 1.36)
        local.style.cssText = 'position:absolute;right:12px;top:12px;width:' + pipW + 'px;height:' + pipH + 'px;object-fit:cover;background:#000;z-index:3;opacity:1;visibility:visible;border-radius:12px;border:2px solid rgba(255,255,255,.4);'
      } else {
        local.style.cssText = 'position:absolute;left:0;top:0;width:' + w0 + 'px;height:' + h0 + 'px;object-fit:cover;background:#111;z-index:2;opacity:1;visibility:visible;'
      }
      local.muted = true
    }
  }

  function attachTrack(track, el, isLocal) {
    if (!track || !el) return false
    try {
      track.attach(el)
      el.muted = !!isLocal || track.kind === 'video'
      var p = el.play && el.play()
      if (p && p.catch) p.catch(function () {})
      return true
    } catch (e) {
      console.warn('[lk] attach fail', track.kind, e)
      return false
    }
  }

  function onTrackSubscribed(track, publication, participant) {
    ensureMediaEls()
    var doc = w.document
    var who = (participant && (participant.identity || participant.name)) || '?'
    console.log('[lk] track subscribed', track.kind, who, publication && publication.trackSid)
    if (track.kind === 'video') {
      showMediaLayout(true)
      attachTrack(track, doc.getElementById('remote'), false)
      markConnected('video')
    } else if (track.kind === 'audio') {
      var a = doc.getElementById('remoteAudio')
      attachTrack(track, a, false)
      markConnected('audio')
    }
  }

  function eachPublication(participant, fn) {
    if (!participant) return
    var pubs = participant.trackPublications || participant.tracks
    if (!pubs) return
    var list = []
    try {
      if (typeof pubs.forEach === 'function') {
        pubs.forEach(function (pub) { list.push(pub) })
      } else if (pubs.values) {
        list = Array.from(pubs.values())
      } else {
        for (var k in pubs) {
          if (Object.prototype.hasOwnProperty.call(pubs, k)) list.push(pubs[k])
        }
      }
    } catch (e) {}
    for (var i = 0; i < list.length; i++) fn(list[i])
  }

  function eachRemoteParticipant(fn) {
    if (!room) return
    var remotes = room.remoteParticipants
    if (!remotes) return
    try {
      if (typeof remotes.forEach === 'function') {
        remotes.forEach(function (p) { fn(p) })
        return
      }
      if (remotes.values) {
        Array.from(remotes.values()).forEach(fn)
        return
      }
      for (var k in remotes) {
        if (Object.prototype.hasOwnProperty.call(remotes, k)) fn(remotes[k])
      }
    } catch (e) {}
  }

  function attachExistingRemoteTracks() {
    eachRemoteParticipant(function (participant) {
      eachPublication(participant, function (pub) {
        if (!pub) return
        try {
          if (pub.setSubscribed) pub.setSubscribed(true)
        } catch (eSub) {}
        if (pub.track) {
          onTrackSubscribed(pub.track, pub, participant)
        } else {
          console.log('[lk] remote pub pending', pub.kind || '', pub.trackSid || '')
        }
      })
    })
  }

  async function disconnect() {
    try {
      for (var i = 0; i < localTracks.length; i++) {
        try { localTracks[i].stop() } catch (e0) {}
        try { localTracks[i].detach() } catch (e1) {}
      }
    } catch (e2) {}
    localTracks = []
    if (room) {
      try { await room.disconnect(true) } catch (e3) {}
      room = null
    }
    connectedPosted = false
  }

  function waitApi(ms) {
    return new Promise(function (resolve) {
      var t0 = Date.now()
      var tick = function () {
        var api = lkApi()
        if (api && api.Room) {
          resolve(api)
          return
        }
        if (Date.now() - t0 >= ms) {
          resolve(null)
          return
        }
        setTimeout(tick, 200)
      }
      tick()
    })
  }

  function markConnected(why) {
    if (connectedPosted) return
    connectedPosted = true
    console.log('[lk] mark connected', why || '')
    emit({ type: 'connected' })
  }

  function hasRemoteParticipant() {
    if (!room) return false
    var remotes = room.remoteParticipants
    if (!remotes) return false
    if (typeof remotes.size === 'number') return remotes.size > 0
    try { return Object.keys(remotes).length > 0 } catch (e) { return false }
  }

  async function createLocalMedia(api) {
    var tracks = []
    // 音视频分开申请：无麦时仍尽量开摄像头
    try {
      var audioTracks = await api.createLocalTracks({ audio: true, video: false }) || []
      tracks = tracks.concat(audioTracks)
    } catch (eA) {
      console.warn('[lk] local audio fail', eA)
    }
    if (videoWanted) {
      try {
        var videoTracks = await api.createLocalTracks({ audio: false, video: true }) || []
        tracks = tracks.concat(videoTracks)
      } catch (eV) {
        console.warn('[lk] local video fail', eV)
      }
    }
    return tracks
  }

  async function connect(msg) {
    var api = await waitApi(8000)
    if (!api || !api.Room) {
      console.error('[lk] LivekitClient missing')
      emit({ type: 'failed', reason: 'no_livekit_sdk' })
      return
    }
    var url = msg.url || ''
    var token = msg.token || msg.jwt || ''
    videoWanted = msg.video === '1' || msg.video === true || msg.video === 1
    var waitPeer = msg.waitPeer === '1' || msg.waitPeer === true || msg.waitPeer === 1
    if (!url || !token) {
      emit({ type: 'failed', reason: 'no_token' })
      return
    }
    await disconnect()
    // 先把画面容器摆出来，再进房（避免 adaptiveStream 因 0 尺寸不拉流）
    showMediaLayout(false)
    room = new api.Room({
      adaptiveStream: false,
      dynacast: true,
      autoSubscribe: true
    })
    room.on(api.RoomEvent.TrackSubscribed, function (track, publication, participant) {
      onTrackSubscribed(track, publication, participant)
    })
    room.on(api.RoomEvent.TrackPublished, function (publication, participant) {
      console.log('[lk] track published', publication && publication.kind, participant && participant.identity)
      try {
        if (publication && publication.setSubscribed) publication.setSubscribed(true)
      } catch (eP) {}
    })
    room.on(api.RoomEvent.ParticipantConnected, function (participant) {
      console.log('[lk] participant connected', participant && participant.identity)
      markConnected('participant')
      setTimeout(attachExistingRemoteTracks, 200)
    })
    room.on(api.RoomEvent.Disconnected, function () {
      emit({ type: 'hangup' })
    })
    try {
      console.log('[lk] connecting', url, 'waitPeer=', waitPeer, 'video=', videoWanted)
      await room.connect(url, token)
      localTracks = await createLocalMedia(api)
      var doc = w.document
      for (var i = 0; i < localTracks.length; i++) {
        var t = localTracks[i]
        if (t.kind === 'video') {
          showMediaLayout(hasRemoteParticipant())
          attachTrack(t, doc.getElementById('local'), true)
        }
        try {
          await room.localParticipant.publishTrack(t)
          console.log('[lk] published', t.kind)
        } catch (ePub) {
          console.warn('[lk] publish fail', t.kind, ePub)
        }
      }
      // 对端可能已在房：立即挂载已有轨
      attachExistingRemoteTracks()
      setTimeout(attachExistingRemoteTracks, 500)
      setTimeout(attachExistingRemoteTracks, 1500)
      emit({ type: 'sfuReady' })
      console.log('[lk] joined SFU local=', localTracks.length, 'remote=', hasRemoteParticipant())
      if (!waitPeer || hasRemoteParticipant()) {
        markConnected(waitPeer ? 'peer-already' : 'incoming')
      } else {
        console.log('[lk] waiting peer…')
      }
    } catch (e) {
      console.error('[lk] connect fail', e)
      emit({ type: 'failed', reason: '' + e })
      await disconnect()
    }
  }

  function setMuted(on) {
    try {
      if (!room) return
      room.localParticipant.setMicrophoneEnabled(!on)
    } catch (e) {}
  }

  function setCameraOff(off) {
    try {
      if (!room) return
      room.localParticipant.setCameraEnabled(!off)
      if (!off) showMediaLayout(hasRemoteParticipant())
    } catch (e) {}
  }

  function handleCmd(msg) {
    if (!msg || !msg.cmd) return false
    if (msg.cmd === 'lkConnect') {
      connect(msg)
      return true
    }
    if (msg.cmd === 'lkHang' || msg.cmd === 'hangup') {
      if (room != null || msg.cmd === 'lkHang') {
        disconnect()
        return msg.cmd === 'lkHang'
      }
      return false
    }
    if (msg.cmd === 'lkMute' || (msg.cmd === 'mute' && room != null)) {
      setMuted(msg.on === '1' || msg.on === true || msg.muted === true)
      return msg.cmd === 'lkMute' || room != null
    }
    if (msg.cmd === 'lkCamera' || (msg.cmd === 'camera' && room != null)) {
      setCameraOff(msg.off === '1' || msg.off === true)
      return msg.cmd === 'lkCamera' || room != null
    }
    return false
  }

  w.__lkHandle = handleCmd
  w.__lkHang = function () { disconnect() }
  w.__lkConnect = connect

  function wrapCallJson() {
    var prev = w.__callJson
    if (prev && prev.__lkWrapped) return
    var wrapped = function (raw) {
      try {
        var msg = raw
        if (typeof raw === 'string') {
          try { msg = JSON.parse(raw) } catch (e0) { msg = null }
        }
        if (msg && handleCmd(msg)) return
      } catch (e1) {}
      if (typeof prev === 'function') return prev(raw)
    }
    wrapped.__lkWrapped = true
    w.__callJson = wrapped
  }

  wrapCallJson()
  var n = 0
  var timer = setInterval(function () {
    n++
    try {
      if (!w.__callJson || !w.__callJson.__lkWrapped) wrapCallJson()
    } catch (eW) {}
    if (n > 80) clearInterval(timer)
  }, 200)

  console.log('[lk] engine ready')
})(typeof window !== 'undefined' ? window : globalThis);
