export { toUrl } from '@shared/url'

export function isBlank(url: string): boolean {
  return !url || url === 'about:blank'
}

export function displayUrl(url: string): string {
  if (isBlank(url)) return ''
  return url
}
