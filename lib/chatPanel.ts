'use client'

export interface ChatPanelState {
  hidden: boolean
  unread: number
}

let state: ChatPanelState = { hidden: true, unread: 0 }
let openNonce = 0

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach(l => l())
}

export function subscribeChatPanel(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function readChatPanel(): ChatPanelState {
  return state
}

const SERVER_STATE: ChatPanelState = { hidden: true, unread: 0 }

export function readChatPanelServer(): ChatPanelState {
  return SERVER_STATE
}

export function publishChatPanel(next: ChatPanelState): void {
  if (state.hidden === next.hidden && state.unread === next.unread) return
  state = next
  emit()
}

export function readOpenNonce(): number {
  return openNonce
}

let openTab: string | null = null

export function readOpenTab(): string | null {
  return openTab
}

export function requestOpenChat(tab: string | null = null): void {
  openTab = tab
  openNonce++
  emit()
}
