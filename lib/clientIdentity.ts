export const CLIENT_IP_HEADER = 'x-counting-client-ip'
export const CLIENT_IP_KEY_HEADER = 'x-ssr-client-ip-key'

export function clientIdentityHeaders(incoming: Headers): Record<string, string> {
  const key = process.env.SSR_CLIENT_IP_KEY
  if (!key) return {}
  const ip =
    incoming.get('cf-connecting-ip') ||
    incoming.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (!ip) return {}
  return { [CLIENT_IP_KEY_HEADER]: key, [CLIENT_IP_HEADER]: ip }
}
