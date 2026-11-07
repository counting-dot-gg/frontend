import { cookies, headers } from 'next/headers'
import { clientIdentityHeaders } from './clientIdentity'

export async function internalHeaders(): Promise<Record<string, string>> {
  try {
    return clientIdentityHeaders(await headers())
  } catch {
    return {}
  }
}

export async function cookieHeader(): Promise<string> {
  const store = await cookies()
  return store.getAll().map(c => `${c.name}=${c.value}`).join('; ')
}

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const [internal, cookie] = await Promise.all([internalHeaders(), cookieHeader()])
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...internal, cookie },
  })
}
