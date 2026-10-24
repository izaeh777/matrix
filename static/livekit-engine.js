/**
 * LiveKit SFU 引擎（H5）
 * 群呼：微信式宫格（每人一格，视频/头像+昵称）
 */
(function (w) {
  if (w.__lkEngineReady) return
  w.__lkEngineReady = true

  var room = null
  var localTracks = []
  var connectedPosted = false
  var videoWanted = false
  var groupMode = false
  var camFacing = 'user'
  var camFlipping = false
  /** @type {Object.<string, {wrap:HTMLElement, video:HTMLVideoElement, label:HTMLElement, face:HTMLElement}>} */
  var tiles = {}

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

  function shortName(identity) {
    var s = identity || ''
    if (s.indexOf('@') === 0) {
      var loc = s.split(':')[0].replace('@', '')
      return loc.length > 0 ? loc : s
    }
    if (s.length > 14) return s.substring(0, 12) + '…'
    return s || '成员'
  }

  function safeId(identity) {
    return String(identity || 'x').replace(/[^a-zA-Z0-9_@.:-]/g, '_').substring(0, 48)
  }

  function applyRootVisible(root) {
    if (!root) return
    // 缩小后严禁再把黑底全屏层拉起来（track/peers 异步回调会踩到）
    if (minimized) {
      root.style.cssText = 'display:none!important;'
      return
    }
    root.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:160px;z-index:9998;background:#111;overflow:hidden;pointer-events:none;'
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
    applyRootVisible(root)
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
    if (!doc.getElementById('lkGrid')) {
      var grid = doc.createElement('div')
      grid.id = 'lkGrid'
      grid.style.cssText = 'display:none;position:absolute;left:0;top:0;right:0;bottom:0;z-index:5;padding:8px;box-sizing:border-box;'
      root.appendChild(grid)
    }
    return root
  }

  function showMediaLayout(hasRemoteVideo) {
    ensureMediaEls()
    if (groupMode) {
      layoutGroupGrid()
      return
    }
    var doc = w.document
    if (!doc) return
    var root = doc.getElementById('callEngineRoot')
    var remote = doc.getElementById('remote')
    var local = doc.getElementById('local')
    var grid = doc.getElementById('lkGrid')
    if (grid) grid.style.display = 'none'
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

  function ensureTile(identity, isLocal) {
    ensureMediaEls()
    var doc = w.document
    var grid = doc.getElementById('lkGrid')
    if (!grid) return null
    var key = isLocal ? '__local__' : identity
    if (tiles[key]) return tiles[key]
    var wrap = doc.createElement('div')
    wrap.className = 'lk-tile'
    wrap.setAttribute('data-id', safeId(key))
    wrap.style.cssText = 'position:relative;background:#1a1a1a;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;'
    var face = doc.createElement('div')
    face.className = 'lk-face'
    var nm = shortName(isLocal ? '我' : identity)
    face.textContent = nm.length > 0 ? nm.substring(0, 1).toUpperCase() : '?'
    face.style.cssText = 'width:48px;height:48px;border-radius:24px;background:#2f6ff2;color:#fff;font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:1;'
    var video = doc.createElement('video')
    video.autoplay = true
    video.muted = true
    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')
    video.playsInline = true
    video.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;display:none;z-index:2;background:#000;'
    var label = doc.createElement('div')
    label.textContent = isLocal ? '我' : shortName(identity)
    label.style.cssText = 'position:absolute;left:0;right:0;bottom:0;padding:4px 6px;background:linear-gradient(transparent,rgba(0,0,0,.65));color:#fff;font-size:11px;z-index:3;text-align:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;'
    wrap.appendChild(face)
    wrap.appendChild(video)
    wrap.appendChild(label)
    grid.appendChild(wrap)
    tiles[key] = { wrap: wrap, video: video, label: label, face: face, identity: identity, isLocal: !!isLocal }
    layoutGroupGrid()
    return tiles[key]
  }

  function matrixUserOf(identity) {
    var s = identity || ''
    if (s.indexOf('@') !== 0) return s
    var parts = s.split(':')
    if (parts.length >= 2) return parts[0] + ':' + parts[1]
    return s
  }

  function removeTile(identity) {
    var key = identity === '__local__' ? '__local__' : identity
    var t = tiles[key]
    if (!t) return
    try {
      if (t.wrap && t.wrap.parentNode) t.wrap.parentNode.removeChild(t.wrap)
    } catch (e) {}
    delete tiles[key]
    layoutGroupGrid()
  }

  function clearTiles() {
    var keys = Object.keys(tiles)
    for (var i = 0; i < keys.length; i++) {
      try {
        var t = tiles[keys[i]]
        if (t && t.wrap && t.wrap.parentNode) t.wrap.parentNode.removeChild(t.wrap)
      } catch (e0) {}
    }
    tiles = {}
  }

  function layoutGroupGrid() {
    var doc = w.document
    if (!doc) return
    var grid = doc.getElementById('lkGrid')
    var remote = doc.getElementById('remote')
    var local = doc.getElementById('local')
    var root = doc.getElementById('callEngineRoot')
    if (!grid) return
    if (!groupMode) {
      grid.style.display = 'none'
      return
    }
    if (remote) remote.style.cssText = 'display:none!important;'
    if (local) local.style.cssText = 'display:none!important;'
    var keys = Object.keys(tiles)
    var n = keys.length
    if (n == 0) {
      grid.style.display = 'none'
      return
    }
    // 微信式：偏小格子，人多时 3～4 列
    var cols = 2
    if (n <= 1) cols = 2
    else if (n <= 4) cols = 2
    else if (n <= 9) cols = 3
    else cols = 4
    var rw = (root && root.clientWidth) ? root.clientWidth : (w.innerWidth || 360)
    var rh = (root && root.clientHeight) ? root.clientHeight : Math.max(240, (w.innerHeight || 640) - 160)
    var gap = 6
    var pad = 10
    var cellW = Math.floor((rw - pad * 2 - gap * (cols - 1)) / cols)
    if (cellW > 120) cellW = 120
    if (cellW < 72) cellW = 72
    var cellH = Math.floor(cellW * 1.15)
    grid.style.display = 'flex'
    grid.style.flexWrap = 'wrap'
    grid.style.justifyContent = 'center'
    grid.style.alignContent = 'center'
    grid.style.alignItems = 'center'
    grid.style.gap = gap + 'px'
    grid.style.padding = pad + 'px'
    for (var i = 0; i < keys.length; i++) {
      var t = tiles[keys[i]]
      if (t && t.wrap) {
        t.wrap.style.width = cellW + 'px'
        t.wrap.style.height = cellH + 'px'
        t.wrap.style.flex = '0 0 auto'
      }
    }
  }

  var floatEl = null
  var minimized = false

  function ensureFloatBtn() {
    var doc = w.document
    if (!doc) return null
    if (floatEl) return floatEl
    floatEl = doc.createElement('div')
    floatEl.id = 'lkCallFloat'
    floatEl.style.cssText = 'display:none;position:fixed;right:16px;bottom:100px;width:64px;height:64px;border-radius:32px;background:#07c160;z-index:10050;box-shadow:0 4px 16px rgba(0,0,0,.35);align-items:center;justify-content:center;flex-direction:column;cursor:pointer;pointer-events:auto;'
    var ico = doc.createElement('div')
    ico.textContent = '📞'
    ico.style.cssText = 'font-size:22px;line-height:1;'
    var tip = doc.createElement('div')
    tip.id = 'lkCallFloatTip'
    tip.textContent = '通话中'
    tip.style.cssText = 'color:#fff;font-size:10px;margin-top:2px;'
    floatEl.appendChild(ico)
    floatEl.appendChild(tip)
    floatEl.onclick = function () {
      emit({ type: 'ui', action: 'expand' })
      try {
        if (typeof w.__lkExpandCall === 'function') w.__lkExpandCall()
      } catch (e0) {}
    }
    doc.body.appendChild(floatEl)
    return floatEl
  }

  function setMinimized(on) {
    minimized = !!on
    var root = ensureMediaEls()
    var btn = ensureFloatBtn()
    if (minimized) {
      applyRootVisible(root)
      if (btn) {
        btn.style.display = 'flex'
        var tip = w.document.getElementById('lkCallFloatTip')
        if (tip) tip.textContent = groupMode ? '群通话' : '通话中'
      }
    } else {
      applyRootVisible(root)
      if (groupMode) layoutGroupGrid()
      else showMediaLayout(true)
      if (btn) btn.style.display = 'none'
    }
  }

  function destroyFloat() {
    if (floatEl && floatEl.parentNode) {
      try { floatEl.parentNode.removeChild(floatEl) } catch (e) {}
    }
    floatEl = null
    minimized = false
  }

  function showTileVideo(tile, on) {
    if (!tile) return
    if (on) {
      tile.video.style.display = 'block'
      tile.face.style.display = 'none'
    } else {
      tile.video.style.display = 'none'
      tile.face.style.display = 'flex'
    }
  }

  function emitPeers() {
    // 人数 = 自己 + SFU 远程（按用户去重）；不以 tiles 为准（宫格可能短暂残留）
    var names = ['我']
    var users = []
    var seen = {}
    var remoteN = 0
    eachRemoteParticipant(function (p) {
      var id = (p && p.identity) || ''
      if (id.length == 0) return
      var uid = matrixUserOf(id)
      var key = uid.length > 0 ? uid : id
      if (seen[key]) return
      seen[key] = true
      remoteN++
      names.push(shortName(id))
      if (uid.length > 2 && uid.indexOf('@') === 0) users.push(uid)
    })
    var count = 1 + remoteN
    emit({ type: 'peers', message: '' + count, peer: names.join('、'), names: users.join(',') })
    console.log('[lk] peers', count, names.join(','))
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
    if (groupMode) {
      var tile = ensureTile(who, false)
      if (track.kind === 'video' && tile) {
        attachTrack(track, tile.video, false)
        showTileVideo(tile, true)
      } else if (track.kind === 'audio') {
        var a = doc.getElementById('remoteAudio')
        // 多人音频：挂到独立 audio，避免互相覆盖
        try {
          var aid = 'lkAudio_' + safeId(who)
          var ae = doc.getElementById(aid)
          if (!ae) {
            ae = doc.createElement('audio')
            ae.id = aid
            ae.autoplay = true
            doc.getElementById('callEngineRoot').appendChild(ae)
          }
          attachTrack(track, ae, false)
        } catch (eA) {
          if (a) attachTrack(track, a, false)
        }
      }
      layoutGroupGrid()
      emitPeers()
      markConnected('track')
      return
    }
    if (track.kind === 'video') {
      showMediaLayout(true)
      attachTrack(track, doc.getElementById('remote'), false)
      markConnected('video')
    } else if (track.kind === 'audio') {
      var a2 = doc.getElementById('remoteAudio')
      attachTrack(track, a2, false)
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
      if (groupMode) ensureTile(participant.identity || '?', false)
      eachPublication(participant, function (pub) {
        if (!pub) return
        try {
          if (pub.setSubscribed) pub.setSubscribed(true)
        } catch (eSub) {}
        if (pub.track) {
          onTrackSubscribed(pub.track, pub, participant)
        }
      })
    })
    if (groupMode) {
      layoutGroupGrid()
      emitPeers()
    }
  }

  async function disconnect() {
    try {
      for (var i = 0; i < localTracks.length; i++) {
        try { localTracks[i].stop() } catch (e0) {}
        try { localTracks[i].detach() } catch (e1) {}
      }
    } catch (e2) {}
    localTracks = []
    clearTiles()
    destroyFloat()
    minimized = false
    try {
      var root = w.document && w.document.getElementById('callEngineRoot')
      if (root) root.style.cssText = 'display:none!important;'
    } catch (eHide) {}
    if (room) {
      try { await room.disconnect(true) } catch (e3) {}
      room = null
    }
    connectedPosted = false
    groupMode = false
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
    groupMode = msg.group === '1' || msg.group === true || msg.group === 1
    var waitPeer = msg.waitPeer === '1' || msg.waitPeer === true || msg.waitPeer === 1
    if (!url || !token) {
      emit({ type: 'failed', reason: 'no_token' })
      return
    }
    await disconnect()
    groupMode = msg.group === '1' || msg.group === true || msg.group === 1
    showMediaLayout(false)
    if (groupMode) {
      ensureTile('__local__', true)
      layoutGroupGrid()
      emitPeers()
    }
    room = new api.Room({
      adaptiveStream: false,
      dynacast: true,
      autoSubscribe: true
    })
    room.on(api.RoomEvent.TrackSubscribed, function (track, publication, participant) {
      onTrackSubscribed(track, publication, participant)
    })
    room.on(api.RoomEvent.TrackPublished, function (publication, participant) {
      try {
        if (publication && publication.setSubscribed) publication.setSubscribed(true)
      } catch (eP) {}
    })
    room.on(api.RoomEvent.ParticipantConnected, function (participant) {
      console.log('[lk] participant connected', participant && participant.identity)
      if (groupMode && participant) ensureTile(participant.identity || '?', false)
      markConnected('participant')
      setTimeout(attachExistingRemoteTracks, 200)
      if (groupMode) emitPeers()
    })
    room.on(api.RoomEvent.ParticipantDisconnected, function (participant) {
      var id = participant && participant.identity
      console.log('[lk] participant left', id)
      if (groupMode && id) removeTile(id)
      if (groupMode) emitPeers()
    })
    room.on(api.RoomEvent.Disconnected, function () {
      emit({ type: 'hangup' })
    })
    try {
      console.log('[lk] connecting', url, 'waitPeer=', waitPeer, 'video=', videoWanted, 'group=', groupMode)
      await room.connect(url, token)
      localTracks = await createLocalMedia(api)
      var doc = w.document
      var localTile = groupMode ? ensureTile('__local__', true) : null
      for (var i = 0; i < localTracks.length; i++) {
        var t = localTracks[i]
        if (t.kind === 'video') {
          if (groupMode && localTile) {
            attachTrack(t, localTile.video, true)
            showTileVideo(localTile, true)
          } else {
            showMediaLayout(hasRemoteParticipant())
            attachTrack(t, doc.getElementById('local'), true)
          }
        }
        try {
          await room.localParticipant.publishTrack(t)
          console.log('[lk] published', t.kind)
        } catch (ePub) {
          console.warn('[lk] publish fail', t.kind, ePub)
        }
      }
      attachExistingRemoteTracks()
      setTimeout(attachExistingRemoteTracks, 500)
      setTimeout(attachExistingRemoteTracks, 1500)
      if (groupMode) {
        layoutGroupGrid()
        emitPeers()
      }
      emit({ type: 'sfuReady' })
      console.log('[lk] joined SFU local=', localTracks.length, 'remote=', hasRemoteParticipant(), 'group=', groupMode)
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
      if (groupMode) {
        var tile = tiles['__local__']
        if (tile) showTileVideo(tile, !off && videoWanted)
      }
    } catch (e) {}
  }

  async function flipCamera(facing) {
    if (!room || camFlipping) return
    var api = lkApi()
    if (!api || !api.createLocalTracks) return
    var next = facing || (camFacing === 'user' ? 'environment' : 'user')
    camFlipping = true
    console.log('[lk] flip to', next)
    try {
      var created = await api.createLocalTracks({
        audio: false,
        video: { facingMode: { ideal: next }, width: { ideal: 640 }, height: { ideal: 480 } }
      })
      var vt = null
      for (var i = 0; i < (created || []).length; i++) {
        if (created[i].kind === 'video') { vt = created[i]; break }
      }
      if (!vt) throw new Error('no video track')
      var keep = []
      for (var j = 0; j < localTracks.length; j++) {
        var old = localTracks[j]
        if (old.kind !== 'video') { keep.push(old); continue }
        try { await room.localParticipant.unpublishTrack(old) } catch (eU) {}
        try { old.stop() } catch (eS) {}
        try { old.detach() } catch (eD) {}
      }
      localTracks = keep
      localTracks.push(vt)
      await room.localParticipant.publishTrack(vt)
      if (groupMode) {
        var tile = ensureTile('__local__', true)
        attachTrack(vt, tile.video, true)
        showTileVideo(tile, true)
      } else {
        showMediaLayout(hasRemoteParticipant())
        attachTrack(vt, w.document.getElementById('local'), true)
      }
      camFacing = next
      console.log('[lk] flip ok', next)
    } catch (e) {
      console.warn('[lk] flip fail', e)
    }
    camFlipping = false
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
    if (msg.cmd === 'lkFlip' || (msg.cmd === 'flip' && room != null)) {
      flipCamera(msg.facing || '')
      return true
    }
    if (msg.cmd === 'lkMinimize') {
      setMinimized(true)
      return true
    }
    if (msg.cmd === 'lkExpand') {
      setMinimized(false)
      return true
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
