import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Contest Guidelines | counting.gg',
}

const RULES: { title: string; description: string[] }[] = [
  {
    title: 'The competition is just for fun.',
    description: [
      `For legal reasons we cannot offer a reward for contests. Too many laws lol.`,
      `Don't sue me. It is just for fun and there is no guaranteed reward.`,
      `Any gifts, such as a $25 gift card, that are given are entirely coincidental and have nothing to do with this competition.`,
    ],
  },
  {
    title: 'There may be audio at points.',
    description: [
      `Audio warning. The site may play audio for this event.`,
      `If you are in a place where you don't want audio make sure your volume is lowered. Smh at people going on this site at school`,
      `If you REALLY hate audio you can right-click the tab and hit "mute website" on chrome-based browsers.`,
    ],
  },
  {
    title: 'Breaking site rules puts you at risk of disqualification.',
    description: [
      `Don't break site rules, and don't exploit any harmful bugs to gain an advantage.`,
      `Use common sense. If you break rules you may be disqualified. Bans or mutes in general, even if unrelated to the contest, are also grounds for disqualification.`,
      `If you have any questions about the "limits" please ask admins before you "test the limits." It will be a case-by-case basis depending on your request.`,
    ],
  },
  {
    title: 'There may only be one final winner.',
    description: [
      `Don't be salty if you lose. Well you can be, but just don't break any rules smh.`,
      `And if you are eliminated for some reason you disagree with, sorry but oh well.`,
    ],
  },
  {
    title: 'Exploits, bugs, and other issues will be handled on a case-by-case basis.',
    description: [
      `Sorry in advance if this happens but it's probably inevitable.`,
      `If you believe there is an issue feel free to reach out privately.`,
    ],
  },
  {
    title: 'Play in your best interest.',
    description: [
      `You may collaborate with anyone but like... Try to avoid sharing outright spoilers, especially if working with other groups. For collaborative parts, feel free to share anything with your own group though.`,
      `And if someone is really really stuck on something. Hints are better than just leaking answers to start. Well this is just etiquette and not a hard rule but cmon. Be epic instead of cringe. I believe in you.`,
      `Also like. If you have an idea but think it may be cheating. Ask first smh. And don't be surprised if the response is "get good" because you don't really need to cheat for anything.`,
    ],
  },
  {
    title: 'Once again, no alternate accounts.',
    description: [
      `Cmon. Bruh. That just ruins the spirit of the game. Also if I find out I will permaban you lol.`,
      `Imagine being permabanned because of the april fools game. Smh`,
      `I won't even be mad. Just disappointed in you. Because you not only have to click this and agree to it. You have to do it twice. Don't do me like that. You're better than that.`,
    ],
  },
]

export default function ContestRulesPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-0)', padding: '24px 16px 64px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>
          Contest Guidelines
        </h1>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {RULES.map((rule, i) => (
            <section
              key={rule.title}
              style={{
                borderRadius: 14,
                border: '1px solid rgb(var(--ink-rgb) / 0.07)',
                background: 'rgb(var(--ink-rgb) / 0.02)',
                padding: '16px 18px',
              }}
            >
              <h2 style={{
                margin: 0, display: 'flex', gap: 10, alignItems: 'baseline',
                fontSize: 16, fontWeight: 700, color: 'var(--ink-1)', lineHeight: 1.4,
              }}>
                <span style={{
                  flexShrink: 0, fontSize: 12, fontWeight: 800, color: '#facc15',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {i + 1}
                </span>
                {rule.title}
              </h2>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {rule.description.map((line, j) => (
                  <p key={j} style={{ margin: 0, fontSize: 13, color: '#9aa2b5', lineHeight: 1.65 }}>
                    {line}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p style={{ marginTop: 22, fontSize: 12, color: '#6b7280', lineHeight: 1.7 }}>
          Check out our{' '}
          <Link href="/privacy-policy" style={{ color: '#7cc4ff' }}>privacy policy</Link>
          . Questions? Here&rsquo;s how to{' '}
          <Link href="/about" style={{ color: '#7cc4ff' }}>contact us</Link>.
        </p>
      </div>
    </div>
  )
}
