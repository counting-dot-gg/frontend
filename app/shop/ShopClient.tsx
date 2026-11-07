'use client'

import { useEffect, useState, useCallback } from 'react'
import SiteGoalsSection from './SiteGoalsSection'

import { API } from '@/lib/apiBase'

type Item = {
  id: number
  name: string
  internal_name: string
  description: string
  category: string
  unlockMethod: string
  unlockDescription: string
  price: number
  quantity: number
  levelToUnlock: number
  achievementId: number
}

function Coin({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="gold" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" />
    </svg>
  )
}

function ShopItemCard({
  item,
  money,
  owned,
  onBuy,
  buying,
}: {
  item: Item
  money: number
  owned: boolean
  onBuy: (id: number) => void
  buying: boolean
}) {
  const affordable = money >= item.price

  return (
    <div style={{
      position: 'relative',
      borderRadius: 18,
      border: owned
        ? '1.5px solid rgba(74,222,128,0.5)'
        : affordable
        ? '1.5px solid rgba(249,115,22,0.4)'
        : '1.5px solid var(--line)',
      background: owned
        ? 'linear-gradient(135deg, rgba(74,222,128,0.14), var(--surface-raised))'
        : affordable
        ? 'linear-gradient(135deg, rgba(249,115,22,0.14), var(--surface-raised))'
        : 'var(--surface-raised)',
      boxShadow: owned
        ? '0 0 20px rgba(74,222,128,0.15), inset 0 1px 0 rgb(var(--ink-rgb) / 0.05)'
        : affordable
        ? '0 0 16px rgba(249,115,22,0.12), inset 0 1px 0 rgb(var(--ink-rgb) / 0.05)'
        : 'inset 0 1px 0 rgb(var(--ink-rgb) / 0.04)',
      padding: '20px 16px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      transition: 'transform 0.15s, box-shadow 0.15s',
      cursor: 'default',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = '' }}
    >
      <div style={{ fontSize: 52, lineHeight: 1, userSelect: 'none' }}>{item.name}</div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 13, fontWeight: 700,
        color: owned ? 'var(--success-ink)' : affordable ? 'var(--warn)' : 'var(--danger)',
      }}>
        <Coin size={14} />
        <span>{Number(item.price).toLocaleString()}</span>
      </div>

      {owned ? (
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--success-ink)',
          background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)',
          borderRadius: 20, padding: '4px 14px',
        }}>
          Owned
        </div>
      ) : (
        <button
          onClick={() => !buying && affordable && onBuy(item.id)}
          disabled={!affordable || buying}
          style={{
            fontSize: 12, fontWeight: 700, padding: '5px 18px', borderRadius: 20, border: 'none',
            cursor: affordable && !buying ? 'pointer' : 'not-allowed',
            background: affordable
              ? buying
                ? 'rgba(249,115,22,0.3)'
                : 'linear-gradient(135deg, #f97316, #ea580c)'
              : 'rgb(var(--ink-rgb) / 0.06)',
            color: affordable ? '#fff' : '#555',
            boxShadow: affordable && !buying ? '0 0 12px rgba(249,115,22,0.4)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          {buying ? 'Buying…' : 'Buy'}
        </button>
      )}
    </div>
  )
}

interface Props {
  userUUID: string | null
  isLoggedIn: boolean
  initialMoney: number
  initialOwned: number[]
}

export default function ShopClient({ userUUID, isLoggedIn, initialMoney, initialOwned }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [money, setMoney] = useState(initialMoney)
  const [ownedIds, setOwnedIds] = useState<Set<number>>(() => new Set(initialOwned))
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<number | null>(null)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/user/shop`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const shopItems: Item[] = (Array.isArray(data) ? data : data.items ?? [])
        .filter((i: Item) => i.category === 'emoji')
      shopItems.sort((a, b) => a.price - b.price)
      setItems(shopItems)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const refreshMoney = useCallback(() => {
    fetch(`${API}/api/auth/status`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(s => { if (s?.user?.money != null) setMoney(Number(s.user.money)) })
      .catch(() => {})
  }, [])

  const handleBuy = useCallback(async (itemId: number) => {
    setBuying(itemId)
    setMessage(null)
    try {
      const res = await fetch(`${API}/api/api/purchaseItem`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setOwnedIds(prev => new Set([...prev, itemId]))
        if (data.money != null) {
          setMoney(Number(data.money))
        } else {
          setTimeout(refreshMoney, 500)
        }
        setMessage({ text: 'Purchased!', ok: true })
      } else {
        setMessage({ text: data.message ?? 'Purchase failed', ok: false })
      }
    } catch {
      setMessage({ text: 'Network error', ok: false })
    } finally {
      setBuying(null)
    }
  }, [refreshMoney])

  if (!isLoggedIn) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#555' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 16, color: 'var(--ink-3)', fontWeight: 600 }}>Sign in to visit the shop</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-0)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>
            Shop
          </h1>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
            borderRadius: 20, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)',
            fontSize: 15, fontWeight: 700, color: 'var(--warn)',
          }}>
            <Coin size={18} />
            <span>{money.toLocaleString()}</span>
          </div>
        </div>

        {message && (
          <div style={{
            marginBottom: 16, padding: '10px 16px', borderRadius: 10,
            background: message.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
            border: `1px solid ${message.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
            color: message.ok ? 'var(--success-ink)' : 'var(--danger)',
            fontSize: 13, fontWeight: 600,
          }}>
            {message.text}
          </div>
        )}

        {loading ? (
          <div style={{ color: '#555', fontSize: 13, padding: '40px 0' }}>Loading shop…</div>
        ) : items.length === 0 ? (
          <div style={{ color: '#555', fontSize: 13, padding: '40px 0' }}>Nothing for sale right now.</div>
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
              Emojis
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 14,
            }}>
              {items.map(item => (
                <ShopItemCard
                  key={item.id}
                  item={item}
                  money={money}
                  owned={ownedIds.has(item.id)}
                  onBuy={handleBuy}
                  buying={buying === item.id}
                />
              ))}
            </div>
          </>
        )}

        <SiteGoalsSection money={money} onSpent={refreshMoney} />
      </div>
    </div>
  )
}
