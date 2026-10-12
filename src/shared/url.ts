const SCHEME = /^([a-z][a-z0-9+.-]*:\/\/|(about|data|blob|view-source|mailto|javascript):)/i
const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[\w-]+\.local)(:\d+)?(\/|$|\?|#)/i
const HOSTISH = /^[^\s/]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i

/** Turns what was typed in the address bar into a URL, like the car browser. */
export function toUrl(input: string): string {
  const text = input.trim()
  if (!text) return ''
  if (SCHEME.test(text)) return text
  if (LOCAL.test(text)) return `http://${text}`
  if (HOSTISH.test(text)) return `https://${text}`
  return `https://www.google.com/search?q=${encodeURIComponent(text)}`
}
