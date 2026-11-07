export interface Rule {
  title: string
  description: string[]
}

export const RULES: Rule[] = [
  {
    title: 'Treat others kindly.',
    description: ['Be kind OR ELSE!'],
  },
  {
    title: 'No counting bots.',
    description: [
      "Bots may never post a count. Don't automate, bot, or cheat the counting process.",
      "Some communities have utility/helper bots that don't count, but perform other functions. If you want to make a utility bot, reach out.",
    ],
  },
  {
    title: '2+ manual inputs are required for each count.',
    description: [
      'If you are not using external tools (macros, scripts, etc.), this rule should not be an issue.',
      'Auto-pasters are allowed (and are built into the site), but you are still required to input a portion of your post manually, and then submit your post manually.',
      'You may not automate the "submit" input. Each count must have a unique, manual "submit" input.',
      'Blatant violations (fully automated inputs i.e. botting) will get you banned.',
    ],
  },
  {
    title: 'No unnecessary spam.',
    description: [
      "Don't spam off-topic posts. Don't spam invalid attempts in bad faith.",
    ],
  },
  {
    title: 'No alternate accounts.',
    description: [
      'You can only have one account at a time. If you want to make a new account or transfer Discord accounts, contact admins privately and we can get it done. If you lie you will just be banned.',
    ],
  },
  {
    title: 'No impersonation.',
    description: ["Don't copy another user's name!"],
  },
  {
    title: 'No illegal content.',
    description: ['Yeah.'],
  },
  {
    title: 'Admins have the authority to make decisions based on their judgment.',
    description: [
      'Situations will be handled on a case-by-case basis and precedence can be changed at any time.',
    ],
  },
  {
    title: 'Be 13 or older.',
    description: ['Per legal requirements, users must be over 13 to participate.'],
  },
]
