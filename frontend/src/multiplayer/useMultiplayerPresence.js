/**
 * useMultiplayerPresence — WebSocket sync for avatars + spatial chat.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PRESENCE_WS_URL,
  CHAT_COOLDOWN_MS,
  POSE_SEND_INTERVAL_MS,
  resolveModelUrl,
} from './multiplayerConfig'

function loadLocalIdentity() {
  const key = 'hearth_presence_id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = `guest-${Math.random().toString(36).slice(2, 9)}`
    sessionStorage.setItem(key, id)
  }
  const nameKey = 'hearth_presence_name'
  const name = sessionStorage.getItem(nameKey) || id
  return { id, name, setName: (n) => sessionStorage.setItem(nameKey, n) }
}

export function useMultiplayerPresence({
  enabled = true,
  agentKey = 'default',
  modelUrl = null,
  getPose = () => ({ x: 0, y: 0, z: 0, anim: 'idle' }),
}) {
  const identity = useRef(loadLocalIdentity())
  const [status, setStatus] = useState('offline')
  const [peers, setPeers] = useState({})
  const [receipts, setReceipts] = useState([])
  const [taskEvents, setTaskEvents] = useState([])
  const [lastChatError, setLastChatError] = useState(null)
  const [chatCooldownLeft, setChatCooldownLeft] = useState(0)
  const wsRef = useRef(null)
  const getPoseRef = useRef(getPose)
  getPoseRef.current = getPose
  const lastPoseSent = useRef(0)
  const lastChatAt = useRef(0)

  const mergePeer = useCallback((peer) => {
    if (!peer?.id) return
    setPeers((prev) => ({
      ...prev,
      [peer.id]: {
        ...prev[peer.id],
        ...peer,
        target: {
          x: peer.target_x ?? peer.x ?? prev[peer.id]?.target?.x ?? 0,
          y: peer.target_y ?? peer.y ?? prev[peer.id]?.target?.y ?? 0,
          z: peer.target_z ?? peer.z ?? prev[peer.id]?.target?.z ?? 0,
        },
        anim: peer.anim ?? peer.animation ?? prev[peer.id]?.anim ?? 'idle',
        role: peer.role ?? prev[peer.id]?.role ?? null,
        chivalry: peer.chivalry ?? prev[peer.id]?.chivalry ?? null,
        message: peer.message ?? peer.chat ?? prev[peer.id]?.message ?? null,
        messageUntil: peer.messageUntil
          ?? (peer.expires_at
            ? (peer.expires_at > 1e12 ? peer.expires_at : peer.expires_at * 1000)
            : prev[peer.id]?.messageUntil
          )
          ?? null,
      },
    }))
  }, [])

  useEffect(() => {
    if (!enabled) return undefined

    let closed = false
    setStatus('connecting')

    const ws = new WebSocket(PRESENCE_WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      if (closed) return
      setStatus('connected')
      const { id, name } = identity.current
      const pose = getPoseRef.current()
      ws.send(JSON.stringify({
        type: 'join',
        id,
        name,
        model_url: modelUrl ?? resolveModelUrl(agentKey),
        target_x: pose.x,
        target_y: pose.y,
        target_z: pose.z,
        anim: pose.anim || 'idle',
      }))
    }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'welcome') {
          const map = {}
          for (const p of msg.peers || []) {
            map[p.id] = {
              ...p,
              target: { x: p.target_x, y: p.target_y, z: p.target_z },
            }
          }
          setPeers(map)
        } else if (msg.type === 'peer_join') {
          mergePeer(msg.peer)
        } else if (msg.type === 'peer_leave') {
          setPeers((prev) => {
            const next = { ...prev }
            delete next[msg.id]
            return next
          })
        } else if (msg.type === 'pose') {
          mergePeer(msg)
        } else if (msg.type === 'update') {
          mergePeer(msg)
        } else if (msg.type === 'chat') {
          setPeers((prev) => ({
            ...prev,
            [msg.id]: {
              ...prev[msg.id],
              id: msg.id,
              name: msg.name || prev[msg.id]?.name,
              message: msg.text,
              messageUntil: msg.expires_at
              ? (msg.expires_at > 1e12 ? msg.expires_at : msg.expires_at * 1000)
              : Date.now() + 10_000,
            },
          }))
        } else if (msg.type === 'chat_rejected') {
          setLastChatError(`Wait ${msg.retry_after_sec}s (slow Solarpunk speech)`)
        } else if (msg.type === 'receipt') {
          setReceipts(prev => [msg, ...prev].slice(0, 50))
        } else if (msg.type === 'task_event') {
          setTaskEvents(prev => [msg, ...prev].slice(0, 80))
        }
      } catch (e) {
        console.warn('[presence] bad frame', e)
      }
    }

    ws.onclose = () => {
      if (!closed) setStatus('offline')
    }
    ws.onerror = () => setStatus('error')

    return () => {
      closed = true
      ws.close()
      wsRef.current = null
    }
  }, [enabled, agentKey, modelUrl, mergePeer])

  // Pose broadcast loop
  useEffect(() => {
    if (!enabled || status !== 'connected') return undefined
    const id = setInterval(() => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      const now = performance.now()
      if (now - lastPoseSent.current < POSE_SEND_INTERVAL_MS) return
      lastPoseSent.current = now
      const pose = getPoseRef.current()
      const { id: pid } = identity.current
      ws.send(JSON.stringify({
        type: 'pose',
        id: pid,
        target_x: pose.x,
        target_y: pose.y,
        target_z: pose.z,
        anim: pose.anim || 'idle',
      }))
    }, POSE_SEND_INTERVAL_MS)
    return () => clearInterval(id)
  }, [enabled, status])

  // Chat cooldown ticker
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, CHAT_COOLDOWN_MS - (Date.now() - lastChatAt.current))
      setChatCooldownLeft(Math.ceil(left / 1000))
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [])

  const sendChat = useCallback((text) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    if (Date.now() - lastChatAt.current < CHAT_COOLDOWN_MS) {
      setLastChatError('One message per minute — the Lodge speaks slowly.')
      return false
    }
    const trimmed = String(text).trim()
    if (!trimmed) return false
    ws.send(JSON.stringify({
      type: 'chat',
      id: identity.current.id,
      text: trimmed,
    }))
    lastChatAt.current = Date.now()
    setLastChatError(null)
    return true
  }, [])

  const setDisplayName = useCallback((name) => {
    identity.current.setName(name)
    identity.current.name = name
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'join',
        id: identity.current.id,
        name,
        model_url: modelUrl ?? resolveModelUrl(agentKey),
      }))
    }
  }, [agentKey, modelUrl])

  const localId = identity.current.id
  const localPeer = peers[localId]
  const remotePeers = Object.values(peers).filter((p) => p.id !== localId)

  return {
    status,
    localId,
    localName: identity.current.name,
    localMessage: localPeer?.message ?? null,
    localMessageUntil: localPeer?.messageUntil ?? null,
    remotePeers,
    sendChat,
    setDisplayName,
    lastChatError,
    chatCooldownLeft,
    canChat: chatCooldownLeft <= 0 && status === 'connected',
    receipts,
    taskEvents,
  }
}
