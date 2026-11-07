'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RULES } from '../rules/rules'

export default function RulesAgreement({ onDone }: { onDone: () => void }) {
  const [agreed, setAgreed] = useState<boolean[]>(() => RULES.map(() => false))
  const [expanded, setExpanded] = useState<boolean[]>(() => RULES.map(() => false))

  const remaining = agreed.filter((a) => !a).length
  const allAgreed = remaining === 0

  const open = (i: number) => {
    setAgreed((prev) => (prev[i] ? prev : prev.map((v, j) => (j === i ? true : v))))
    setExpanded((prev) => prev.map((v, j) => (j === i ? !v : v)))
  }

  return (
    <section>
      <h2 className="text-base font-semibold mb-1">Agree to the rules</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Click each rule to read it and agree to it. All {RULES.length} are required.
      </p>

      <ul className="space-y-2">
        {RULES.map((rule, i) => (
          <li
            key={rule.title}
            className={
              'rounded-xl border bg-card transition-colors ' +
              (agreed[i] ? 'border-primary/40' : 'border-border')
            }
          >
            <button
              type="button"
              onClick={() => open(i)}
              aria-expanded={expanded[i]}
              aria-label={
                agreed[i]
                  ? `${rule.title} Agreed.`
                  : `${rule.title} Click to agree.`
              }
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
            >
              <span
                className={
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ' +
                  (agreed[i]
                    ? 'bg-primary text-white'
                    : 'border border-border text-muted-foreground')
                }
                aria-hidden="true"
              >
                {agreed[i] ? '✓' : i + 1}
              </span>
              <span className="flex-1 text-sm font-semibold">{rule.title}</span>
              <span
                className={
                  'shrink-0 rounded-md px-2 py-1 text-xs font-semibold ' +
                  (agreed[i]
                    ? 'text-muted-foreground'
                    : 'bg-primary/15 text-primary')
                }
              >
                {agreed[i] ? (expanded[i] ? 'Agreed · Hide' : 'Agreed') : 'Click to agree'}
              </span>
            </button>

            {expanded[i] && (
              <div className="space-y-2 px-4 pb-4 pl-12">
                {rule.description.map((para, j) => (
                  <p key={j} className="text-sm text-muted-foreground leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">
        Check our{' '}
        <Link href="/privacy-policy" target="_blank" className="text-primary underline underline-offset-4">
          privacy policy
        </Link>
        . Questions? Here&apos;s how to{' '}
        <Link href="/about" target="_blank" className="text-primary underline underline-offset-4">
          contact us
        </Link>
        .
      </p>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onDone}
          disabled={!allAgreed}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Agree and continue
        </button>
        {!allAgreed && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {remaining} {remaining === 1 ? 'rule' : 'rules'} left to agree to.
          </p>
        )}
      </div>
    </section>
  )
}
