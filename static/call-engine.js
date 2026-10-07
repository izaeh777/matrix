var ENGINE_PAGE = false
try {
  ENGINE_PAGE = (location.pathname || '').indexOf('call-engine.html') >= 0
  if (!ENGINE_PAGE && document.body && document.body.id === 'callEngineRoot') ENGINE_PAGE = true
} catch (eEng) {}
var pc = null
var localStream = null
var muted = false
var camFacing = 'user'
var camFlipping = false
var started = false
var remoteSet = false
var applyingAnswer = false
var connectedPosted = false
var iceBuf = []
var HS = ''
var TOKEN = ''
var ROOM = ''
var CALL = ''
var PARTY = ''
var INVITEE = ''
var pendingRemoteAnswer = ''
var pendingSdp = ''
var pendingIce = '[]'
var pendingVideo = false
var hasRemote = false
var remoteStream = null
var links = {}
var groupMode = false
function peerKey(msg) {
  if (!msg) return INVITEE || 'default'
  var p = msg.peer || msg.invitee || INVITEE || 'default'
  return p || 'default'
}
function getLink(key) {
  if (!key) key = 'default'
  if (!links[key]) {
    links[key] = { pc: null, remoteSet: false, iceBuf: [], applyingAnswer: false, connected: false, stream: null }
  }
  return links[key]
}
function attachPeerAudio(key, stream) {
  if (!stream) return
  var id = 'remoteAudio_' + String(key).replace(/[^a-zA-Z0-9_@.:-]/g, '_')
  var a = document.getElementById(id)
  if (!a) {
    a = document.createElement('audio')
    a.id = id
    a.autoplay = true
    a.setAttribute('playsinline', 'true')
    a.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none'
    document.body.appendChild(a)
  }
  a.srcObject = stream
  safePlay(a)
}
function engineRoot() {
  return document.getElementById('callEngineRoot') || document.body
}
function setUi(msg) {
  var name = document.getElementById('name')
  var sub = document.getElementById('sub')
  if (name && msg.name) name.textContent = msg.name
  if (sub && msg.sub) sub.textContent = msg.sub
  var phase = msg.phase || ''
  var incoming = msg.incoming === '1'
  var acc = document.getElementById('btnAccept')
  var rej = document.getElementById('btnReject')
  var hang = document.getElementById('btnHang')
  if (acc) acc.style.display = (phase === 'ringing' && incoming) ? 'inline-block' : 'none'
  if (rej) rej.style.display = (phase === 'ringing' && incoming) ? 'inline-block' : 'none'
  if (hang) hang.style.display = (phase === 'idle' || (phase === 'ringing' && incoming)) ? 'none' : 'inline-block'
}
function hideAccept() {
  var root = engineRoot()
  if (root && root.classList) root.classList.remove('need-accept')
}
function runAnswer() {
  hideAccept()
  post({ type: 'ui', action: 'accept' })
  safePlay(document.getElementById('remote'))
  safePlay(document.getElementById('remoteAudio'))
  if (started) return
  var sdp = pendingSdp
  if (!sdp) {
    console.log('[engine] runAnswer wait sdp')
    media(pendingVideo).then(function (stream) {
      localStream = stream
      console.log('[engine] media unlocked, wait sdp')
    }).catch(function (e) { failMedia(e) })
    return
  }
  started = true
  beginAnswer(sdp, parseIce(pendingIce || '[]'), pendingVideo)
}
window.runAnswer = runAnswer
function saveAuth(msg) {
  if (msg.hs) HS = msg.hs
  if (msg.token) TOKEN = msg.token
  if (msg.room) ROOM = msg.room
  if (msg.call) CALL = msg.call
  if (msg.party) PARTY = msg.party
  if (msg.invitee) INVITEE = msg.invitee
}
function emit(obj) {
  var packed = ''
  try { packed = JSON.stringify(obj) } catch (e0) {}
  window.__lastCallMsg = obj
  window.__lastCallPacked = packed
  if (obj && obj.type === 'offer') {
    window.__lastOfferMsg = obj
    window.__lastOfferPacked = packed
    if (!window.__offerPackedList) window.__offerPackedList = []
    window.__offerPackedList.push(packed)
  }
  if (obj && obj.type === 'answer') {
    window.__lastAnswerMsg = obj
    window.__lastAnswerPacked = packed
    if (!window.__answerPackedList) window.__answerPackedList = []
    window.__answerPackedList.push(packed)
  }
  if (obj && obj.type === 'ice') {
    if (!window.__icePackedList) window.__icePackedList = []
    window.__icePackedList.push(packed)
  }
  try { console.log('[engine] emit', obj.type, packed ? packed.length : 0) } catch (e1) {}
  try {
    var out = { __callEngine: true, type: obj.type }
    if (obj.sdp) out.sdp = obj.sdp
    if (obj.message) out.message = obj.message
    if (obj.action) out.action = obj.action
    if (obj.candidate) out.candidate = obj.candidate
    if (obj.sdpMid != null) out.sdpMid = obj.sdpMid
    if (obj.sdpMLineIndex != null) out.sdpMLineIndex = obj.sdpMLineIndex
    if (obj.peer) out.peer = obj.peer
    window.postMessage(out, '*')
    if (window.parent && window.parent !== window) window.parent.postMessage(out, '*')
  } catch (eH5) {}
  try {
    if (window.uni && uni.webView && uni.webView.postMessage) {
      if (packed) uni.webView.postMessage({ data: packed })
      uni.webView.postMessage({ data: obj })
    }
  } catch (e2) {}
  try {
    if (window.__dcloud_weex_postMessage) {
      window.__dcloud_weex_postMessage({ data: packed ? [packed, obj] : [obj] })
    }
  } catch (e3) {}
  try {
    if (window.uni && uni.postMessage) uni.postMessage({ data: packed || obj })
  } catch (e4) {}
}
function post(obj) { emit(obj) }
function mxSend(type, content) {
  if (!ENGINE_PAGE) return
  if (!TOKEN || !ROOM) return
  var txn = 't' + Date.now() + '_' + Math.floor(Math.random() * 10000)
  var base = HS || ''
  var url = base + '/_matrix/client/v3/rooms/' + encodeURIComponent(ROOM) + '/send/' + encodeURIComponent(type) + '/' + txn
  fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(content)
  }).then(function (r) {
    console.log('[engine] mxSend', type, r.status)
  }).catch(function (e) {
    console.log('[engine] mxSend fail', type, e && e.message)
  })
}
function callBase() {
  return { call_id: CALL, version: 1, party_id: PARTY, room_id: ROOM }
}
function parseIce(text) {
  try {
    var v = JSON.parse(text)
    if (v && v.length) return v
  } catch (e) {}
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
}
function toIce(c) {
  var idx = c.sdpMLineIndex
  if (idx == null || idx === '') idx = 0
  idx = parseInt(idx, 10)
  if (idx !== idx) idx = 0
  var mid = c.sdpMid
  if (mid == null || mid === '') mid = '0'
  var init = { candidate: c.candidate || '', sdpMid: '' + mid, sdpMLineIndex: idx }
  try { return new RTCIceCandidate(init) } catch (e) { return init }
}
function queueIce(c) {
  if (!c || !c.candidate) return
  iceBuf.push(c)
  flushIceBuf()
}
function flushIceBuf() {
  if (!pc || !remoteSet) return
  while (iceBuf.length) {
    var one = iceBuf.shift()
    try { pc.addIceCandidate(toIce(one)) } catch (e) {
      console.log('[engine] addIce fail', e && e.message)
    }
  }
}
function safePlay(el) {
  if (!el || !el.play) return
  try {
    var p = el.play()
    if (p && p.catch) p.catch(function () {})
  } catch (e) {}
}
function setVideoLayout(on) {
  pendingVideo = !!on
  var root = engineRoot()
  if (root && root.classList) {
    root.classList.toggle('call-video', !!on)
    root.classList.toggle('call-audio', !on)
    root.classList.toggle('has-remote', !!hasRemote)
  }
  if (!on) {
    var hide = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;visibility:hidden;pointer-events:none;border:0'
    var remote = document.getElementById('remote')
    var local = document.getElementById('local')
    if (remote) remote.style.cssText = hide
    if (local) local.style.cssText = hide
    return
  }
  layoutVideos()
}
function layoutVideos() {
  if (!pendingVideo) return
  var remote = document.getElementById('remote')
  var local = document.getElementById('local')
  var root = engineRoot()
  var w = (root && root.clientWidth) ? root.clientWidth : (window.innerWidth || 360)
  var h = (root && root.clientHeight) ? root.clientHeight : (window.innerHeight || 640)
  if (remote) {
    remote.style.cssText = 'position:absolute;left:0;top:0;width:' + w + 'px;height:' + h + 'px;object-fit:cover;background:#111;z-index:1;opacity:1;visibility:visible'
  }
  if (!local) return
  if (hasRemote) {
    var pipW = Math.floor(w * 0.28)
    if (pipW < 96) pipW = 96
    var pipH = Math.floor(pipW * 1.36)
    local.style.cssText = 'position:absolute;right:12px;top:12px;width:' + pipW + 'px;height:' + pipH + 'px;object-fit:cover;background:#000;z-index:3;opacity:1;visibility:visible;border-radius:12px;border:2px solid rgba(255,255,255,.4)'
  } else {
    local.style.cssText = 'position:absolute;left:0;top:0;width:' + w + 'px;height:' + h + 'px;object-fit:cover;background:#111;z-index:2;opacity:1;visibility:visible;border-radius:0;border:0'
  }
}
function attachRemote(stream) {
  if (!stream) return
  var v = document.getElementById('remote')
  var a = document.getElementById('remoteAudio')
  var vtracks = stream.getVideoTracks ? stream.getVideoTracks() : []
  var hasVideo = vtracks.length > 0
  if (hasVideo) {
    hasRemote = true
    pendingVideo = true
    for (var i = 0; i < vtracks.length; i++) {
      try { vtracks[i].enabled = true } catch (e0) {}
    }
    setVideoLayout(true)
  }
  if (v && hasVideo) {
    v.setAttribute('autoplay', 'true')
    v.setAttribute('playsinline', 'true')
    v.setAttribute('webkit-playsinline', 'true')
    v.muted = true
    v.srcObject = stream
    safePlay(v)
  }
  if (a) {
    a.srcObject = stream
    a.autoplay = true
    a.playsInline = true
    safePlay(a)
  }
}
function takeRemoteTrack(ev) {
  if (!ev || !ev.track) return
  try { ev.track.enabled = true } catch (e0) {}
  if (!remoteStream) remoteStream = new MediaStream()
  var already = remoteStream.getTracks()
  for (var i = 0; i < already.length; i++) {
    if (already[i].id === ev.track.id) {
      attachRemote(remoteStream)
      return
    }
  }
  try { remoteStream.addTrack(ev.track) } catch (e1) {}
  if (ev.streams && ev.streams[0]) {
    var extra = ev.streams[0].getTracks()
    for (var j = 0; j < extra.length; j++) {
      var dup = false
      var cur = remoteStream.getTracks()
      for (var k = 0; k < cur.length; k++) {
        if (cur[k].id === extra[j].id) dup = true
      }
      if (!dup) {
        try { remoteStream.addTrack(extra[j]) } catch (e2) {}
      }
    }
  }
  console.log('[engine] remote track', ev.track.kind, remoteStream.getVideoTracks().length)
  attachRemote(remoteStream)
}
function failMedia(e) {
  var m = (e && e.message) ? e.message : ''
  var name = (e && e.name) ? e.name : ''
  console.log('[engine] media fail', name, m)
  if (m.indexOf('play()') >= 0 || m.indexOf('user gesture') >= 0) return
  if (name === 'NotAllowedError' || m.indexOf('Permission') >= 0) {
    post({ type: 'error', message: '请允许麦克风/摄像头权限' })
    return
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    post({ type: 'error', message: '当前页面无法使用通话' })
    return
  }
  post({ type: 'error', message: m || '无法打开麦克风/摄像头' })
}
function ensurePc(ice) {
  if (pc) return pc
  pc = new RTCPeerConnection({
    iceServers: ice,
    iceCandidatePoolSize: 4
  })
  pc.onicecandidate = function (ev) {
    if (!ev || !ev.candidate || !ev.candidate.candidate) return
    var cand = {
      candidate: ev.candidate.candidate,
      sdpMid: ev.candidate.sdpMid,
      sdpMLineIndex: ev.candidate.sdpMLineIndex
    }
    post({
      type: 'ice',
      candidate: cand.candidate,
      sdpMid: cand.sdpMid,
      sdpMLineIndex: cand.sdpMLineIndex
    })
    var body = callBase()
    body.candidates = [cand]
    mxSend('m.call.candidates', body)
  }
  pc.ontrack = function (ev) {
    takeRemoteTrack(ev)
  }
  pc.onconnectionstatechange = function () {
    if (!pc) return
    console.log('[engine] pc', pc.connectionState)
    if (pc.connectionState === 'connected') markConnected()
    else if (pc.connectionState === 'failed') post({ type: 'failed' })
  }
  pc.oniceconnectionstatechange = function () {
    if (!pc) return
    var s = '' + pc.iceConnectionState
    console.log('[engine] ice', s)
    if (s === 'connected' || s === 'completed') markConnected()
    else if (s === 'failed') post({ type: 'failed' })
  }
  return pc
}
function markConnected() {
  if (connectedPosted) return
  connectedPosted = true
  try { window.__callConnected = true } catch (e0) {}
  post({ type: 'connected' })
}
function bindTrackToPc(track, stream) {
  if (!pc || !track) return
  var senders = pc.getSenders ? pc.getSenders() : []
  for (var i = 0; i < senders.length; i++) {
    if (senders[i].track === track) return
    if (senders[i].track && senders[i].track.kind === track.kind) {
      try { senders[i].replaceTrack(track) } catch (e0) {}
      return
    }
  }
  if (pc.getTransceivers) {
    var trs = pc.getTransceivers()
    for (var t = 0; t < trs.length; t++) {
      var sender = trs[t].sender
      if (!sender || sender.track) continue
      var rec = trs[t].receiver
      var kind = rec && rec.track ? rec.track.kind : ''
      if (kind === track.kind && sender.replaceTrack) {
        try { sender.replaceTrack(track) } catch (e1) {}
        return
      }
    }
  }
  try { pc.addTrack(track, stream) } catch (e2) {}
}
function addLocal(stream) {
  localStream = stream
  var el = document.getElementById('local')
  var hasVideo = stream.getVideoTracks && stream.getVideoTracks().length > 0
  if (hasVideo) setVideoLayout(true)
  else setVideoLayout(false)
  if (el && hasVideo) {
    el.muted = true
    el.setAttribute('playsinline', 'true')
    el.setAttribute('webkit-playsinline', 'true')
    el.srcObject = stream
    el.style.transform = camFacing === 'environment' ? 'none' : 'scaleX(-1)'
    safePlay(el)
  } else if (el) {
    try { el.srcObject = null } catch (e0) {}
  }
  if (!pc) return
  var tracks = stream.getTracks()
  for (var i = 0; i < tracks.length; i++) bindTrackToPc(tracks[i], stream)
}
function videoConstraints() {
  return {
    facingMode: { ideal: camFacing },
    width: { ideal: 640 },
    height: { ideal: 480 }
  }
}
function applyLocalMirror() {
  var el = document.getElementById('local')
  if (!el) return
  el.style.transform = camFacing === 'environment' ? 'none' : 'scaleX(-1)'
}
function applyNewVideo(ns, want) {
  var nt = ns.getVideoTracks && ns.getVideoTracks()[0]
  if (!nt || !localStream) throw new Error('no video')
  if (pc && pc.getSenders) {
    var senders = pc.getSenders()
    for (var i = 0; i < senders.length; i++) {
      var t = senders[i].track
      if (t && t.kind === 'video' && senders[i].replaceTrack) senders[i].replaceTrack(nt)
    }
  }
  var olds = localStream.getVideoTracks()
  for (var j = 0; j < olds.length; j++) {
    try { localStream.removeTrack(olds[j]) } catch (e0) {}
    try { olds[j].stop() } catch (e1) {}
  }
  localStream.addTrack(nt)
  camFacing = want
  var el = document.getElementById('local')
  if (el) {
    el.srcObject = localStream
    applyLocalMirror()
    safePlay(el)
  }
}
function flipCamera(want) {
  if (camFlipping || !localStream) return
  var olds = localStream.getVideoTracks ? localStream.getVideoTracks() : []
  if (!olds.length) return
  var next = want || (camFacing === 'user' ? 'environment' : 'user')
  camFlipping = true
  var exact = { audio: false, video: { facingMode: { exact: next }, width: { ideal: 640 }, height: { ideal: 480 } } }
  var soft = { audio: false, video: { facingMode: { ideal: next }, width: { ideal: 640 }, height: { ideal: 480 } } }
  navigator.mediaDevices.getUserMedia(exact).catch(function () {
    return navigator.mediaDevices.getUserMedia(soft)
  }).then(function (ns) {
    applyNewVideo(ns, next)
    camFlipping = false
    console.log('[engine] flipped', next)
  }).catch(function (e) {
    camFlipping = false
    console.log('[engine] flip fail', e && e.message)
  })
}
function audioConstraints() {
  return {
    echoCancellation: { ideal: true },
    noiseSuppression: { ideal: true },
    autoGainControl: { ideal: true },
    channelCount: { ideal: 1 }
  }
}
function applyAudio3A(stream) {
  try {
    var tracks = stream.getAudioTracks()
    for (var i = 0; i < tracks.length; i++) {
      try { tracks[i].applyConstraints(audioConstraints()) } catch (e0) {}
    }
  } catch (e) {}
}
function callTop() {
  try {
    if (window.parent && window.parent !== window) return window.parent
  } catch (e0) {}
  return window
}
function media(video) {
  try {
    var top = callTop()
    var cached = window.__callLocalStream || top.__callLocalStream
    if (cached) {
      var hasV = cached.getVideoTracks && cached.getVideoTracks().length > 0
      if (!video || hasV) {
        localStream = cached
        applyAudio3A(cached)
        return Promise.resolve(cached)
      }
    }
    var inflight = window.__callMediaPromise || top.__callMediaPromise
    if (inflight) {
      return inflight.then(function (stream) {
        if (!stream) throw new Error('无法打开麦克风/摄像头')
        var hasV2 = stream.getVideoTracks && stream.getVideoTracks().length > 0
        if (video && !hasV2) {
          return navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(function (vs) {
            localStream = vs
            window.__callLocalStream = vs
            applyAudio3A(vs)
            return vs
          })
        }
        localStream = stream
        applyAudio3A(stream)
        return stream
      })
    }
  } catch (eCache) {}
  if (localStream) {
    var hasV = localStream.getVideoTracks && localStream.getVideoTracks().length > 0
    if (!video || hasV) return Promise.resolve(localStream)
    try {
      var old = localStream.getTracks()
      for (var i = 0; i < old.length; i++) old[i].stop()
    } catch (e0) {}
    localStream = null
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return Promise.reject(new Error('当前页面无法使用通话'))
  }
  if (video) setVideoLayout(true)
  var constraints = { audio: audioConstraints(), video: video ? videoConstraints() : false }
  return navigator.mediaDevices.getUserMedia(constraints).catch(function () {
    if (!video) return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    return navigator.mediaDevices.getUserMedia({ audio: true, video: true })
  }).then(function (stream) {
    localStream = stream
    window.__callLocalStream = stream
    applyAudio3A(stream)
    return stream
  })
}
function applyRemoteAnswer(sdp) {
  if (!sdp) return
  if (!pc) {
    pendingRemoteAnswer = sdp
    console.log('[engine] stash remoteAnswer', sdp.length)
    return
  }
  if (remoteSet || applyingAnswer) {
    console.log('[engine] remoteAnswer skip', remoteSet, applyingAnswer)
    flushIceBuf()
    return
  }
  applyingAnswer = true
  pendingRemoteAnswer = ''
  pc.setRemoteDescription({ type: 'answer', sdp: sdp }).then(function () {
    remoteSet = true
    applyingAnswer = false
    flushIceBuf()
    console.log('[engine] remote answer set')
  }).catch(function (e) {
    applyingAnswer = false
    if (remoteSet || connectedPosted) {
      console.log('[engine] ignore answer error', e && e.message)
      return
    }
    post({ type: 'error', message: (e && e.message) ? e.message : '接通失败' })
  })
}
function hangLocal() {
  try {
    if (localStream) {
      var ts = localStream.getTracks()
      for (var i = 0; i < ts.length; i++) ts[i].stop()
    }
  } catch (e) {}
  try { if (pc) pc.close() } catch (e2) {}
  try {
    var keys = Object.keys(links)
    for (var i = 0; i < keys.length; i++) {
      var lk = links[keys[i]]
      try { if (lk && lk.pc) lk.pc.close() } catch (eL) {}
      try {
        var el = document.getElementById('remoteAudio_' + String(keys[i]).replace(/[^a-zA-Z0-9_@.:-]/g, '_'))
        if (el && el.parentNode) el.parentNode.removeChild(el)
      } catch (eA) {}
    }
  } catch (eLinks) {}
  links = {}
  groupMode = false
  pc = null
  localStream = null
  started = false
  camFacing = 'user'
  camFlipping = false
  remoteSet = false
  applyingAnswer = false
  connectedPosted = false
  iceBuf = []
  hasRemote = false
  remoteStream = null
  pendingRemoteAnswer = ''
  try {
    window.__callLocalStream = null
    window.__callMediaPromise = null
    window.__icePackedList = []
    window.__callConnected = false
  } catch (e3) {}
}
function ensurePeerPc(ice, key) {
  var link = getLink(key)
  if (link.pc) {
    if (!pc) pc = link.pc
    return link.pc
  }
  var peerPc = new RTCPeerConnection({
    iceServers: ice,
    iceCandidatePoolSize: 4
  })
  link.pc = peerPc
  if (!pc) pc = peerPc
  peerPc.onicecandidate = function (ev) {
    if (!ev || !ev.candidate || !ev.candidate.candidate) return
    post({
      type: 'ice',
      peer: key,
      candidate: ev.candidate.candidate,
      sdpMid: ev.candidate.sdpMid,
      sdpMLineIndex: ev.candidate.sdpMLineIndex
    })
  }
  peerPc.ontrack = function (ev) {
    if (!ev || !ev.track) return
    try { ev.track.enabled = true } catch (e0) {}
    if (!link.stream) link.stream = new MediaStream()
    try { link.stream.addTrack(ev.track) } catch (e1) {}
    if (ev.streams && ev.streams[0]) {
      var extra = ev.streams[0].getTracks()
      for (var j = 0; j < extra.length; j++) {
        try { link.stream.addTrack(extra[j]) } catch (e2) {}
      }
    }
    attachPeerAudio(key, link.stream)
    takeRemoteTrack(ev)
  }
  peerPc.onconnectionstatechange = function () {
    if (!peerPc) return
    console.log('[engine] pc', key, peerPc.connectionState)
    if (peerPc.connectionState === 'connected') {
      link.connected = true
      markConnected()
      post({ type: 'peerConnected', peer: key })
    } else if (peerPc.connectionState === 'failed') {
      post({ type: 'peerFailed', peer: key })
      if (!groupMode) post({ type: 'failed' })
    }
  }
  peerPc.oniceconnectionstatechange = function () {
    if (!peerPc) return
    var s = '' + peerPc.iceConnectionState
    if (s === 'connected' || s === 'completed') {
      link.connected = true
      markConnected()
      post({ type: 'peerConnected', peer: key })
    } else if (s === 'failed' && !groupMode) post({ type: 'failed' })
  }
  return peerPc
}
function addLocalToPc(peerPc, stream) {
  if (!peerPc || !stream) return
  var tracks = stream.getTracks()
  for (var i = 0; i < tracks.length; i++) {
    var track = tracks[i]
    var senders = peerPc.getSenders ? peerPc.getSenders() : []
    var replaced = false
    for (var s = 0; s < senders.length; s++) {
      if (senders[s].track && senders[s].track.kind === track.kind) {
        try { senders[s].replaceTrack(track); replaced = true } catch (e0) {}
      }
    }
    if (!replaced) {
      try { peerPc.addTrack(track, stream) } catch (e1) {}
    }
  }
}
function flushPeerIce(key) {
  var link = getLink(key)
  if (!link.pc || !link.remoteSet) return
  while (link.iceBuf.length) {
    var one = link.iceBuf.shift()
    try { link.pc.addIceCandidate(toIce(one)) } catch (e) {}
  }
}
function offerToPeer(key, ice, video) {
  var peerPc = ensurePeerPc(ice, key)
  addLocalToPc(peerPc, localStream)
  var opts = { offerToReceiveAudio: true, offerToReceiveVideo: !!video }
  return peerPc.createOffer(opts).then(function (offer) {
    return peerPc.setLocalDescription(offer).then(function () {
      console.log('[engine] group offer', key, (offer.sdp || '').length)
      post({ type: 'offer', peer: key, sdp: offer.sdp })
    })
  })
}
function answerFromPeer(key, sdp, ice, video) {
  var link = getLink(key)
  var peerPc = ensurePeerPc(ice, key)
  return media(!!video).catch(function () { return media(false) }).then(function (stream) {
    localStream = stream
    addLocal(stream)
    addLocalToPc(peerPc, stream)
    return peerPc.setRemoteDescription({ type: 'offer', sdp: sdp }).then(function () {
      link.remoteSet = true
      flushPeerIce(key)
      return peerPc.createAnswer().then(function (answer) {
        return peerPc.setLocalDescription(answer).then(function () {
          post({ type: 'answer', peer: key, sdp: answer.sdp })
        })
      })
    })
  })
}
window.__flushCall = function () {
  var msg = window.__lastAnswerMsg || window.__lastOfferMsg
  if (msg) emit(msg)
}
function beginAnswer(sdp, ice, video) {
  var wantVideo = !!video || (sdp && sdp.indexOf('m=video') >= 0)
  console.log('[engine] beginAnswer', sdp.length, 'video', wantVideo)
  media(wantVideo).catch(function () {
    return media(false)
  }).then(function (stream) {
    ensurePc(ice)
    addLocal(stream)
    return pc.setRemoteDescription({ type: 'offer', sdp: sdp }).then(function () {
      remoteSet = true
      flushIceBuf()
      return pc.createAnswer().then(function (answer) {
        return pc.setLocalDescription(answer).then(function () {
          console.log('[engine] local answer', (answer.sdp || '').length)
          post({ type: 'answer', sdp: answer.sdp })
          var body = callBase()
          body.answer = { type: 'answer', sdp: answer.sdp }
          mxSend('m.call.answer', body)
        })
      })
    })
  }).catch(function (e) {
    started = false
    failMedia(e)
  })
}
window.__callJson = function (msg) {
  if (!msg) return
  if (typeof msg === 'string') {
    try { msg = JSON.parse(msg) } catch (e0) { return }
  }
  var cmd = msg.cmd
  saveAuth(msg)
  if (cmd === 'ui') {
    setUi(msg)
    setVideoLayout(msg.video === '1')
    return
  }
  if (cmd === 'armAnswer') {
    pendingSdp = msg.sdp || ''
    pendingIce = msg.ice || '[]'
    pendingVideo = msg.video === '1'
    setVideoLayout(pendingVideo)
    if (!msg.phase) {
      msg.phase = 'ringing'
      msg.incoming = '1'
    }
    setUi(msg)
    console.log('[engine] armed answer', pendingSdp.length)
    return
  }
  if (cmd === 'flush') {
    window.__flushCall()
    return
  }
  if (cmd === 'unlock') {
    safePlay(document.getElementById('remote'))
    safePlay(document.getElementById('remoteAudio'))
    safePlay(document.getElementById('local'))
    return
  }
  if (cmd === 'startGroupOffer') {
    groupMode = true
    started = true
    var gIce = parseIce(msg.ice || '[]')
    var plist = String(msg.peers || '').split(',')
    var peers = []
    for (var pi = 0; pi < plist.length; pi++) {
      var one = (plist[pi] || '').trim()
      if (one.length > 0 && peers.indexOf(one) < 0) peers.push(one)
    }
    console.log('[engine] startGroupOffer', peers.length)
    setVideoLayout(false)
    media(false).then(function (stream) {
      localStream = stream
      addLocal(stream)
      var chain = Promise.resolve()
      for (var gi = 0; gi < peers.length; gi++) {
        ;(function (peer) {
          chain = chain.then(function () {
            return offerToPeer(peer, gIce, false)
          }).catch(function (e) {
            console.log('[engine] offer peer fail', peer, e && e.message)
          })
        })(peers[gi])
      }
      return chain
    }).catch(failMedia)
    return
  }
  if (cmd === 'startAnswerPeer') {
    groupMode = true
    hideAccept()
    var aPeer = peerKey(msg)
    var aSdp = msg.sdp || ''
    if (!aSdp || aSdp.indexOf('ice-ufrag:stub') >= 0) {
      post({ type: 'error', message: '对方信令无效' })
      return
    }
    started = true
    console.log('[engine] startAnswerPeer', aPeer, aSdp.length)
    answerFromPeer(aPeer, aSdp, parseIce(msg.ice || pendingIce || '[]'), false).catch(failMedia)
    return
  }
  if (cmd === 'startOffer') {
    if (started) return
    started = true
    var ice = parseIce(msg.ice || '[]')
    var video = msg.video === '1'
    setVideoLayout(video)
    console.log('[engine] startOffer video', video)
    media(video).then(function (stream) {
      ensurePc(ice)
      addLocal(stream)
      try {
        if (video && pc.addTransceiver) {
          var hasVid = false
          var senders = pc.getSenders ? pc.getSenders() : []
          for (var si = 0; si < senders.length; si++) {
            if (senders[si].track && senders[si].track.kind === 'video') hasVid = true
          }
          if (!hasVid) pc.addTransceiver('video', { direction: 'sendrecv' })
        }
      } catch (eTr) {}
      var opts = { offerToReceiveAudio: true, offerToReceiveVideo: !!video }
      return pc.createOffer(opts).then(function (offer) {
        return pc.setLocalDescription(offer).then(function () {
          console.log('[engine] local offer', (offer.sdp || '').length)
          post({ type: 'offer', sdp: offer.sdp })
          var inv = callBase()
          inv.lifetime = 90000
          inv.offer = { type: 'offer', sdp: offer.sdp }
          if (INVITEE) inv.invitee = INVITEE
          mxSend('m.call.invite', inv)
          if (pendingRemoteAnswer) applyRemoteAnswer(pendingRemoteAnswer)
        })
      })
    }).catch(failMedia)
    return
  }
  if (cmd === 'startAnswer') {
    hideAccept()
    if (started && pc && !groupMode) return
    var sdp = msg.sdp || pendingSdp
    if (msg.ice) pendingIce = msg.ice
    if (msg.video === '1') pendingVideo = true
    setVideoLayout(pendingVideo)
    console.log('[engine] startAnswer sdp', (sdp || '').length, 'started', started)
    if (!sdp || sdp.indexOf('ice-ufrag:stub') >= 0) {
      post({ type: 'error', message: '对方信令无效，请重拨' })
      return
    }
    if (msg.peer && groupMode) {
      started = true
      answerFromPeer(peerKey(msg), sdp, parseIce(pendingIce || '[]'), pendingVideo).catch(failMedia)
      return
    }
    if (started) return
    started = true
    beginAnswer(sdp, parseIce(pendingIce || '[]'), pendingVideo)
    return
  }
  if (cmd === 'remoteAnswer') {
    var raPeer = peerKey(msg)
    if (groupMode && raPeer && raPeer !== 'default') {
      var raLink = getLink(raPeer)
      if (!raLink.pc) {
        raLink.pendingAnswer = msg.sdp || ''
        return
      }
      if (raLink.remoteSet || raLink.applyingAnswer) return
      raLink.applyingAnswer = true
      raLink.pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp || '' }).then(function () {
        raLink.remoteSet = true
        raLink.applyingAnswer = false
        flushPeerIce(raPeer)
      }).catch(function () { raLink.applyingAnswer = false })
      return
    }
    applyRemoteAnswer(msg.sdp || '')
    return
  }
  if (cmd === 'remoteOffer') {
    if (!pc) return
    pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp || '' }).then(function () {
      remoteSet = true
      flushIceBuf()
    }).catch(function () {})
    return
  }
  if (cmd === 'ice') {
    var icePeer = peerKey(msg)
    if (groupMode && icePeer && icePeer !== 'default') {
      var iceLink = getLink(icePeer)
      iceLink.iceBuf.push({
        candidate: msg.candidate || '',
        sdpMid: msg.sdpMid || '',
        sdpMLineIndex: msg.sdpMLineIndex
      })
      flushPeerIce(icePeer)
      return
    }
    queueIce({
      candidate: msg.candidate || '',
      sdpMid: msg.sdpMid || '',
      sdpMLineIndex: msg.sdpMLineIndex
    })
    return
  }
  if (cmd === 'mute') {
    muted = !muted
    try {
      if (localStream) {
        var at = localStream.getAudioTracks()
        for (var i = 0; i < at.length; i++) at[i].enabled = !muted
      }
    } catch (e) {}
    return
  }
  if (cmd === 'camera') {
    var off = msg.off === '1'
    try {
      if (localStream) {
        var vt = localStream.getVideoTracks()
        for (var i = 0; i < vt.length; i++) vt[i].enabled = !off
      }
    } catch (e) {}
    return
  }
  if (cmd === 'flip') {
    flipCamera(msg.facing || '')
    return
  }
  if (cmd === 'hangup') {
    hangLocal()
  }
}
window.addEventListener('message', function (ev) {
  try {
    var d = ev.data
    if (d == null) return
    if (d.__callEngine === true) return
    if (d.__callToEngine === true) {
      window.__callJson(d.json != null ? d.json : d)
      return
    }
    if (typeof d === 'string' && d.indexOf('"cmd"') >= 0) {
      window.__callJson(d)
    }
  } catch (eM) {
    console.log('[engine] parent msg fail', eM && eM.message)
  }
})
function bootFromQuery() {
  var q = location.search || ''
  var hash = location.hash || ''
  var incoming = q.indexOf('p=in') >= 0 || hash.indexOf('p=in') >= 0
  var outgoing = q.indexOf('p=out') >= 0 || hash.indexOf('p=out') >= 0
  var video = q.indexOf('v=1') >= 0 || hash.indexOf('v=1') >= 0
  setVideoLayout(video)
  if (q.indexOf('ui=1') >= 0 || hash.indexOf('ui=1') >= 0) {
    document.body.className += (document.body.className ? ' ' : '') + 'show-ui'
  }
  if (incoming) {
    document.body.className += (document.body.className ? ' ' : '') + 'need-accept'
    setUi({ name: '通话', sub: video ? '邀请你视频通话' : '邀请你语音通话', phase: 'ringing', incoming: '1' })
    return true
  }
  if (outgoing) {
    setUi({ name: '通话', sub: video ? '正在呼叫（视频）…' : '正在呼叫…', phase: 'outgoing', incoming: '0' })
    return true
  }
  return false
}
function bootFromHash() {
  try {
    var h = location.hash ? location.hash.replace(/^#/, '') : ''
    if (!h || h.indexOf('{') < 0) return
    var msg = JSON.parse(decodeURIComponent(h))
    window.__callJson(msg)
  } catch (e) {}
}
function bindUiButtons() {
  var acc = document.getElementById('btnAccept')
  var acc2 = document.getElementById('accBtn')
  var rej = document.getElementById('btnReject')
  var hang = document.getElementById('btnHang')
  if (acc) acc.onclick = function () { runAnswer() }
  if (acc2) acc2.onclick = function () { runAnswer() }
  if (rej) rej.onclick = function () { post({ type: 'ui', action: 'reject' }) }
  if (hang) hang.onclick = function () { post({ type: 'ui', action: 'hang' }) }
}
emit({ type: 'ready', secure: (window.isSecureContext ? '1' : '0') })
window.addEventListener('resize', function () { layoutVideos() })
if (ENGINE_PAGE) {
  bootFromQuery()
  bootFromHash()
  bindUiButtons()
  if (document.readyState !== 'complete') {
    window.addEventListener('load', function () {
      bootFromQuery()
      bootFromHash()
      bindUiButtons()
    })
  }
}
console.log('[engine] loaded', ENGINE_PAGE ? 'page' : 'in-app')
