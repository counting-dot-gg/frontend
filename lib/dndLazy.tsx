'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type {
  DragDropContextProps,
  DroppableProps,
  DraggableProps,
  DroppableProvided,
  DroppableStateSnapshot,
  DraggableProvided,
  DraggableStateSnapshot,
} from '@hello-pangea/dnd'

type Dnd = typeof import('@hello-pangea/dnd')

let mod: Dnd | null = null
let pending = false
const listeners = new Set<() => void>()

export function preloadDnd(): void {
  if (mod || pending) return
  pending = true
  import('@hello-pangea/dnd')
    .then((m) => {
      mod = m
      listeners.forEach((l) => l())
    })
    .catch(() => {
      pending = false
    })
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

const getSnapshot = () => mod
const getServerSnapshot = () => null

export function useDnd(): Dnd | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function useIdlePreloadDnd(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || mod || pending) return
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    }).requestIdleCallback
    if (typeof ric === 'function') {
      const id = ric(() => preloadDnd(), { timeout: 3000 })
      return () => {
        const cic = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback
        cic?.(id)
      }
    }
    const t = setTimeout(preloadDnd, 1200)
    return () => clearTimeout(t)
  }, [enabled])
}

const INERT_DROPPABLE = {
  innerRef: () => {},
  droppableProps: {},
  placeholder: null,
} as unknown as DroppableProvided

const INERT_DROPPABLE_SNAPSHOT = {
  isDraggingOver: false,
} as unknown as DroppableStateSnapshot

const INERT_DRAGGABLE = {
  innerRef: () => {},
  draggableProps: { style: undefined },
  dragHandleProps: {},
} as unknown as DraggableProvided

const INERT_DRAGGABLE_SNAPSHOT = {
  isDragging: false,
} as unknown as DraggableStateSnapshot

export function DragDropContext({ children, ...props }: DragDropContextProps) {
  const m = useDnd()
  if (!m) return <>{children}</>
  return <m.DragDropContext {...props}>{children}</m.DragDropContext>
}

export function Droppable({ children, ...props }: DroppableProps) {
  const m = useDnd()
  if (!m) return <>{children(INERT_DROPPABLE, INERT_DROPPABLE_SNAPSHOT)}</>
  return <m.Droppable {...props}>{children}</m.Droppable>
}

export function Draggable({ children, ...props }: DraggableProps) {
  const m = useDnd()
  if (!m) return <>{children(INERT_DRAGGABLE, INERT_DRAGGABLE_SNAPSHOT, undefined as never)}</>
  return <m.Draggable {...props}>{children}</m.Draggable>
}
