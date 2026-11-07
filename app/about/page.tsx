import type { Metadata } from 'next'
import Link from 'next/link'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export const metadata: Metadata = {
  title: 'About | counting.gg',
}

const intro = [
  'counting.gg is a free community-driven counting website. The community is centered around our Discord server, and a Discord account is required to join.',
  "After signing up, you'll need to create your profile. To avoid abuse, profiles are manually approved at the moment. If your account is not approved in a reasonable amount of time, please message the moderators.",
  "Once your profile is approved, you'll be ready to count!",
]

const faqs = [
  {
    q: 'Why? Why would people waste their time on this?',
    a: ["Sign up and ask them! \u{1F920} But don't harass or insult them."],
  },
  {
    q: 'Can I use bots to count?',
    a: ['No.'],
  },
  {
    q: 'How does the site work?',
    a: [
      'The site is divided into several "threads," each having their own unique rules. The main thread is the simplest: count up 1 at a time. No double counting, and mistakes are allowed.',
      'Other threads have different rules. Some threads may reset on a mistake. Other threads may not count by numbers: the "letters" thread counts from A to Z, then AA, AB, and so on...',
      'You can access a list of threads from the left-hand sidebar, under "Threads." Once you open a thread, there is an about page with more information.',
    ],
  },
  {
    q: 'Is counting.gg free?',
    a: ['Yes.'],
  },
  {
    q: 'How can I contact you?',
    a: ['Message me over Discord! Press "login" to receive a Discord invite.'],
  },
  {
    q: 'I have more questions!',
    a: [
      "Feel free to sign up to join the Discord. There's zero commitment in joining and you can quit whenever you need to. Ask others and feel free to send a direct message to the Discord admins if needed.",
    ],
  },
]

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">

        <div className="mb-8">
          <Badge variant="secondary" className="mb-3 text-xs font-medium">Getting Started</Badge>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-4">About counting.gg</h1>
          <div className="space-y-3">
            {intro.map((para, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">{para}</p>
            ))}
          </div>
        </div>

        <Separator className="mb-6" />

        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Frequently asked
        </h2>

        <Accordion type="multiple" className="space-y-2">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="border border-border rounded-xl px-4 bg-card shadow-sm"
            >
              <AccordionTrigger className="text-sm font-semibold text-left hover:no-underline py-4 gap-3">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-2">
                {faq.a.map((para, j) => (
                  <p key={j} className="text-sm text-muted-foreground leading-relaxed">{para}</p>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="text-sm text-muted-foreground mt-8">
          Read the{' '}
          <Link href="/rules" className="underline underline-offset-4 hover:text-foreground transition-colors">
            community rules
          </Link>
          {' '}and our{' '}
          <Link href="/privacy-policy" className="underline underline-offset-4 hover:text-foreground transition-colors">
            privacy policy
          </Link>
          .
        </p>

        <section className="mt-10 border-t border-border/60 pt-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Credits
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Mascot artwork:{' '}
            <a
              href="https://commons.wikimedia.org/wiki/File:Cute_Ball_-_Games.png"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground transition-colors"
            >
              &ldquo;Cute Ball &ndash; Games&rdquo;
            </a>
            {' '}by MazeNL77, licensed under{' '}
            <a
              href="https://creativecommons.org/licenses/by/3.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground transition-colors"
            >
              CC BY 3.0
            </a>
            .
          </p>
        </section>

      </div>
    </main>
  )
}
