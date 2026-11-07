'use client'

import { useEffect, useRef, useState } from 'react'
import { getSocket } from '@/lib/socket'
import ReactionPickerOverlay from './ReactionPickerOverlay'
import {
  buildRowHTML,
  setRowInteractive,
  setRowThreadName,
  setRowViewer,
  type PostRow,
  type RenderPrefs,
} from './ThreadView'

export default function InteractivePostList({
  posts,
  prefs,
  threadName,
  validationType,
  viewerUUID,
  viewerRoles,
  highlightUUID,
}: {
  posts: PostRow[]
  prefs: RenderPrefs
  threadName: string
  validationType?: string
  viewerUUID?: string
  viewerRoles?: string[]
  highlightUUID?: string
}) {
  const olRef = useRef<HTMLOListElement>(null)
  const cacheRef = useRef(new Map<string, PostRow>())
  const [reactionTarget, setReactionTarget] = useState<{ postUuid: string; x: number; y: number } | null>(null)

  setRowThreadName(threadName, false, validationType)
  setRowViewer(viewerUUID, viewerRoles)
  setRowInteractive(true)

  useEffect(() => {
    const ol = olRef.current
    if (!ol) return

    cacheRef.current = new Map(posts.map(p => [p.uuid, p]))
    ol.innerHTML = posts.map(p => buildRowHTML(p, prefs)).join('')
    if (highlightUUID) {
      ol.querySelector(`[data-uuid="${highlightUUID}"]`)?.classList.add('post-row-focus')
    }

    const handleClick = (e: MouseEvent) => {
      const deleteBtn = (e.target as Element).closest('[data-action="delete-comment"]') as HTMLElement | null
      if (deleteBtn) {
        const uuid = deleteBtn.dataset.uuid
        if (!uuid) return
        if (!e.shiftKey && !confirm('Delete this comment? The count itself will remain. This can\'t be undone.')) return
        getSocket().emit('deleteComment', { uuid })
        return
      }

      const chip = (e.target as Element).closest('[data-action="toggle-reaction"]') as HTMLElement | null
      if (chip) {
        const uuid = chip.dataset.uuid
        const id = chip.dataset.reaction
        if (!uuid || !id) return
        getSocket().emit('updateReactions', { post_uuid: uuid, id })
        return
      }

      const add = (e.target as Element).closest('[data-action="add-reaction"]') as HTMLElement | null
      if (add) {
        const uuid = add.dataset.uuid
        if (!uuid) return
        const rect = add.getBoundingClientRect()
        ol.querySelectorAll('.post-row.reaction-picker-open')
          .forEach(el => el.classList.remove('reaction-picker-open'))
        add.closest('.post-row')?.classList.add('reaction-picker-open')
        setReactionTarget({ postUuid: uuid, x: rect.left, y: rect.bottom })
      }
    }
    ol.addEventListener('click', handleClick)

    const rerender = (uuid: string, next: PostRow) => {
      cacheRef.current.set(uuid, next)
      const li = ol.querySelector(`[data-uuid="${uuid}"]`)
      if (!li) return
      const wasOpen = li.classList.contains('reaction-picker-open')
      const wasFocus = li.classList.contains('post-row-focus')
      const tmp = document.createElement('template')
      tmp.innerHTML = buildRowHTML(next, prefs)
      const node = tmp.content.firstElementChild as HTMLElement
      if (wasOpen) node.classList.add('reaction-picker-open')
      if (wasFocus) node.classList.add('post-row-focus')
      ol.replaceChild(node, li)
    }

    const onUpdateReaction = (data: { post_uuid: string; reactions: Record<string, string[]> }) => {
      const cached = data?.post_uuid && cacheRef.current.get(data.post_uuid)
      if (!cached) return
      rerender(data.post_uuid, { ...cached, reactions: data.reactions ?? {} })
    }

    const onDeleteComment = (data: { uuid: string }) => {
      const cached = data?.uuid && cacheRef.current.get(data.uuid)
      if (!cached) return
      rerender(data.uuid, { ...cached, comment: undefined })
    }

    const socket = getSocket()
    socket.on('updateReaction', onUpdateReaction)
    socket.on('deleteComment', onDeleteComment)
    if (!socket.connected) socket.connect()

    return () => {
      ol.removeEventListener('click', handleClick)
      socket.off('updateReaction', onUpdateReaction)
      socket.off('deleteComment', onDeleteComment)
    }
  }, [posts, prefs, highlightUUID])

  return (
    <>
      <ol ref={olRef} style={{ listStyle: 'none', margin: 0, padding: 0 }} />
      {reactionTarget && (
        <ReactionPickerOverlay
          x={reactionTarget.x}
          y={reactionTarget.y}
          onClose={() => {
            olRef.current?.querySelectorAll('.post-row.reaction-picker-open')
              .forEach(el => el.classList.remove('reaction-picker-open'))
            setReactionTarget(null)
          }}
          onSelect={(id) => {
            getSocket().emit('updateReactions', { post_uuid: reactionTarget.postUuid, id })
            olRef.current?.querySelectorAll('.post-row.reaction-picker-open')
              .forEach(el => el.classList.remove('reaction-picker-open'))
            setReactionTarget(null)
          }}
        />
      )}
    </>
  )
}
