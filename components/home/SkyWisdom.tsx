'use client'

import { memo, useEffect, useState, useSyncExternalStore } from 'react'
import {
  subscribeSkyWisdom,
  readSkyWisdom,
  readSkyWisdomServer,
  closeSkyWisdom,
  WISDOM_RISE_MS,
} from '@/lib/skyWisdom'
import { WISDOM_ENDPOINT, type WisdomShape } from '@/lib/dailyWisdomShared'
import { RIDGE_VISIBLE_PX, ridgeMaskDataUri } from '@/lib/ridgeline'

const HORIZON_PCT = 70

function SkyWisdom({ wisdom, daySeed }: {
  wisdom: WisdomShape | null
  daySeed: string
}) {
  const open = useSyncExternalStore(
    subscribeSkyWisdom,
    readSkyWisdom,
    readSkyWisdomServer,
  )
  const shapeKey = wisdom ? `${wisdom.w}x${wisdom.h}` : ''
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const loaded = loadedKey === shapeKey
  const [natural, setNatural] = useState<
    { key: string; w: number; h: number } | null
  >(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSkyWisdom() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!wisdom || !open) return null

  const shape = natural?.key === shapeKey ? natural : wisdom

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 0, right: 0, top: 0,
        height: `${HORIZON_PCT}%`,
        overflow: 'hidden',
        pointerEvents: 'none',
        maskImage: `linear-gradient(#000, #000), ${ridgeMaskDataUri(daySeed)}`,
        WebkitMaskImage: `linear-gradient(#000, #000), ${ridgeMaskDataUri(daySeed)}`,
        maskSize: `100% calc(100% - ${RIDGE_VISIBLE_PX - 1}px), 100% ${RIDGE_VISIBLE_PX}px`,
        WebkitMaskSize: `100% calc(100% - ${RIDGE_VISIBLE_PX - 1}px), 100% ${RIDGE_VISIBLE_PX}px`,
        maskPosition: 'top left, bottom left',
        WebkitMaskPosition: 'top left, bottom left',
        maskRepeat: 'no-repeat, no-repeat',
        WebkitMaskRepeat: 'no-repeat, no-repeat',
        zIndex: 0,
      }}
    >
      <style>{`
        @keyframes skyWisdomRise{
          from{transform:translate(-50%, 38vh) scale(0.86)}
          25%{transform:translate(-50%, 6vh) scale(1)}
          to{transform:translate(-50%, -90vh) scale(1)}
        }
        @media (prefers-reduced-motion: reduce){
          .sky-wisdom{animation-duration:0.01ms!important}
          .sky-wisdom-img{transition:none!important}
        }
      `}</style>

      <div
        className="sky-wisdom"
        onAnimationEnd={e => {
          if (e.animationName === 'skyWisdomRise') closeSkyWisdom()
        }}
        style={{
          position: 'absolute',
          left: '50%', top: '48%',
          transform: 'translate(-50%, -50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          perspective: 1200,
          animation: `skyWisdomRise ${WISDOM_RISE_MS}ms linear both`,
        }}
      >
        <div style={{
          marginBottom: 10,
          fontSize: 'clamp(10px, 1.1vw, 13px)',
          fontWeight: 900,
          letterSpacing: '0.34em',
          textIndent: '0.34em',
          textTransform: 'uppercase',
          color: '#F6ECD2',
          textShadow: '0 0 16px rgba(150,190,255,0.6), 0 1px 2px rgb(var(--shadow-rgb) / 0.5)',
          whiteSpace: 'nowrap',
        }}>
          Today&rsquo;s Wisdom
        </div>

        <div style={{
          transform: 'rotateX(-13deg)',
          transformOrigin: 'center center',
          transformStyle: 'preserve-3d',
        }}>
          <div style={{
            filter: `drop-shadow(0 0 1px rgba(214,232,255,0.55)) drop-shadow(0 0 ${
              Math.round(Math.min(70, Math.max(18, Math.min(shape.w * 2, 1100) * 0.08)))
            }px rgba(150,190,255,0.40))`,
          }}>
          <div style={{
            aspectRatio: `${shape.w} / ${shape.h}`,
            width: Math.min(shape.w * 2, 1100),
            maxWidth: `min(86vw, ${(42 * shape.w / shape.h).toFixed(2)}vh)`,
            overflow: 'hidden',
            borderRadius: 10,
            maskImage:
              'radial-gradient(ellipse 108% 112% at 50% 50%, #000 82%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 108% 112% at 50% 50%, #000 82%, transparent 100%)',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="sky-wisdom-img"
              src={WISDOM_ENDPOINT}
              alt=""
              width={shape.w}
              height={shape.h}
              draggable={false}
              onLoad={e => {
                const img = e.currentTarget
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  setNatural({
                    key: shapeKey,
                    w: img.naturalWidth,
                    h: img.naturalHeight,
                  })
                }
                setLoadedKey(shapeKey)
              }}
              style={{
                width: '100%', height: '100%',
                objectFit: 'contain', display: 'block',
                opacity: loaded ? 1 : 0,
                filter: loaded ? 'blur(0px)' : 'blur(16px)',
                transition: 'opacity 0.6s ease, filter 0.8s ease',
              }}
            />
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(SkyWisdom)
