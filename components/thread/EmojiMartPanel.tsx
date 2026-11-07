'use client'

import Picker from '@emoji-mart/react'
import { init, Data } from 'emoji-mart'
import data from '@emoji-mart/data'
import { useEffect, useMemo, useState } from 'react'
import { getAllEmotes } from '@/lib/emotes'

const CUSTOM_CATEGORY_ID = 'countgg'

export interface SelectedEmoji {
  native?: string
  id: string
}

export default function EmojiMartPanel({ onSelect }: { onSelect: (e: SelectedEmoji) => void }) {
  const custom = useMemo(() => ([
    {
      id: CUSTOM_CATEGORY_ID,
      name: 'counting.gg',
      emojis: getAllEmotes().map(e => ({
        id: e.id,
        name: e.id,
        keywords: e.names,
        skins: [{ src: e.imgUrl }],
      })),
    },
  ]), [])

  const [ready, setReady] = useState(false)
  const [categories, setCategories] = useState<string[] | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await init({ data })
        const original = (Data as any)?.originalCategories
        if (Array.isArray(original)) {
          if (!original.some((c: any) => c?.id === CUSTOM_CATEGORY_ID)) {
            const frequentIdx = original.findIndex((c: any) => c?.id === 'frequent')
            original.splice(frequentIdx >= 0 ? frequentIdx + 1 : 0, 0, custom[0])
          }
          const ids = original.map((c: any) => c?.id).filter(Boolean)
          if (ids.includes(CUSTOM_CATEGORY_ID)) {
            if (!cancelled) setCategories(ids)
          }
        }
      } catch {
      }
      if (!cancelled) setReady(true)
    })()
    return () => { cancelled = true }
  }, [custom])

  if (!ready) {
    return (
      <div style={{ padding: 20, fontSize: 12, color: '#666', width: 280, textAlign: 'center' }}>
        Loading emotes…
      </div>
    )
  }

  return (
    <Picker
      data={data}
      custom={custom}
      categories={categories}
      onEmojiSelect={onSelect}
      theme="dark"
      previewPosition="none"
      skinTonePosition="none"
      perLine={8}
      maxFrequentRows={1}
    />
  )
}
