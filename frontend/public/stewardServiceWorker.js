/**
 * Hearthlands Personal Steward — WebLLM service worker (served from site root).
 * Inference runs here, not on the main thread / rAF loop.
 */
import { ServiceWorkerMLCEngineHandler } from 'https://esm.sh/@mlc-ai/web-llm@0.2.84'

new ServiceWorkerMLCEngineHandler()

console.log('[Steward SW] WebGPU engine handler ready')
