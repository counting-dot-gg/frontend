import type { Metadata } from 'next'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { RULES } from './rules'

export const metadata: Metadata = {
  title: 'Rules | counting.gg',
}

export default function RulesPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Rules</h1>
        </div>

        <Separator className="mb-6" />

        <Accordion type="multiple" className="space-y-2">
          {RULES.map((rule, i) => (
            <AccordionItem
              key={i}
              value={`rule-${i}`}
              className="border border-border rounded-xl px-4 bg-card shadow-sm"
            >
              <AccordionTrigger className="text-sm font-semibold text-left hover:no-underline py-4 gap-3">
                <span className="text-muted-foreground font-mono text-xs w-5 shrink-0">{i + 1}.</span>
                {rule.title}
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-2">
                {rule.description.map((para, j) => (
                  <p key={j} className="text-sm text-muted-foreground leading-relaxed">
                    {para}
                  </p>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

      </div>
    </main>
  )
}
