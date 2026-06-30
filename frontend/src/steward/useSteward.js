/**
 * useSteward — lazy WebLLM init via Service Worker (never blocks rAF).
 */
import { useCallback, useRef, useState } from 'react'
import { buildSoulFile, stewardGreeting } from './soulFile'

const PRIMARY_MODEL = 'gemma-2b-it-q4f32_1-MLC'
const FALLBACK_MODEL = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'
const MAX_TOKENS = 60

async function checkWebGPU() {
  if (!navigator.gpu) return false
  try {
    const adapter = await navigator.gpu.requestAdapter()
    return !!adapter
  } catch {
    return false
  }
}

async function createEngine(setProgress) {
  const { CreateServiceWorkerMLCEngine } = await import('@mlc-ai/web-llm')
  const config = {
    initProgressCallback: (report) => {
      setProgress(Math.round((report?.progress ?? 0) * 100))
    },
  }

  try {
    return await CreateServiceWorkerMLCEngine(PRIMARY_MODEL, config)
  } catch (primaryErr) {
    console.warn('[Steward] Primary model failed, trying fallback:', primaryErr)
    setProgress(0)
    return CreateServiceWorkerMLCEngine(FALLBACK_MODEL, config)
  }
}

export function useSteward({ agentHandle, plotId, emberBalance, realm = 'biosphere' }) {
  const engineRef = useRef(null)
  const messagesRef = useRef([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [messages, setMessages] = useState([])
  const [supported, setSupported] = useState(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [streaming, setStreaming] = useState(false)

  const initialize = useCallback(async () => {
    if (engineRef.current || loading) return engineRef.current

    setError(null)
    const gpuOk = await checkWebGPU()
    if (!gpuOk) {
      setSupported(false)
      return null
    }
    setSupported(true)
    setLoading(true)
    setProgress(0)

    try {
      const eng = await createEngine(setProgress)
      engineRef.current = eng
      setReady(true)

      const greeting = stewardGreeting(agentHandle, plotId)
      const seeded = [{ role: 'assistant', content: greeting }]
      messagesRef.current = seeded
      setMessages(seeded)
      return eng
    } catch (e) {
      console.error('[Steward] init failed:', e)
      setError(e instanceof Error ? e.message : 'Steward failed to wake')
      setReady(false)
      return null
    } finally {
      setLoading(false)
    }
  }, [agentHandle, plotId, loading])

  const chat = useCallback(async (userMessage) => {
    const engine = engineRef.current
    const trimmed = String(userMessage || '').trim()
    if (!engine || !trimmed || streaming) return

    setStreaming(true)
    setError(null)

    const soul = buildSoulFile({ agentHandle, plotId, emberBalance, realm })
    const history = messagesRef.current.filter((m) => m.role === 'user' || m.role === 'assistant')

    const allMessages = [
      { role: 'system', content: soul },
      ...history,
      { role: 'user', content: trimmed },
    ]

    const next = [
      ...messagesRef.current,
      { role: 'user', content: trimmed },
      { role: 'assistant', content: '' },
    ]
    messagesRef.current = next
    setMessages(next)

    try {
      const stream = await engine.chat.completions.create({
        messages: allMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: MAX_TOKENS,
        top_p: 0.95,
      })

      let full = ''
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content || ''
        full += delta
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: full }
          messagesRef.current = updated
          return updated
        })
        // Yield to the browser between chunks so rAF keeps breathing
        await new Promise((r) => setTimeout(r, 0))
      }
    } catch (e) {
      console.error('[Steward] chat failed:', e)
      setError(e instanceof Error ? e.message : 'Chat failed')
      setMessages((prev) => prev.slice(0, -1))
      messagesRef.current = messagesRef.current.slice(0, -2)
    } finally {
      setStreaming(false)
    }
  }, [agentHandle, plotId, emberBalance, realm, streaming])

  return {
    initialize,
    chat,
    messages,
    loading,
    progress,
    supported,
    ready,
    error,
    streaming,
  }
}
