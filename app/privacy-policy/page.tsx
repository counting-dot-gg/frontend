import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import PrivacyAchievement from './PrivacyAchievement'

export const metadata: Metadata = {
  title: 'Privacy Policy | counting.gg',
}

type Block = { h: string; p?: string[]; ul?: string[] }

const sections: Block[] = [
  {
    h: 'Consent',
    p: ['By using our website, you hereby consent to our Privacy Policy and agree to its terms.'],
  },
  {
    h: 'Information we collect',
    p: [
      'The personal information that you are asked to provide, and the reasons why you are asked to provide it, will be made clear to you at the point we ask you to provide your personal information.',
      'If you contact us directly, we may receive additional information about you such as your name, email address, phone number, the contents of the message and/or attachments you may send us, and any other information you may choose to provide.',
      'When you register for an Account, we may ask for your contact information, including items such as name, company name, address, email address, and telephone number.',
    ],
  },
  {
    h: 'How we use your information',
    p: ['We use the information we collect in various ways, including to:'],
    ul: [
      'Provide, operate, and maintain our website',
      'Improve, personalize, and expand our website',
      'Understand and analyze how you use our website',
      'Develop new products, services, features, and functionality',
      'Communicate with you, either directly or through one of our partners, including for customer service, to provide you with updates and other information relating to the website, and for marketing and promotional purposes',
      'Send you emails',
      'Find and prevent fraud',
    ],
  },
  {
    h: 'Log Files',
    p: [
      "counting.gg follows a standard procedure of using log files. These files log visitors when they visit websites. All hosting companies do this and a part of hosting services' analytics. The information collected by log files include internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks. These are not linked to any information that is personally identifiable. The purpose of the information is for analyzing trends, administering the site, tracking users' movement on the website, and gathering demographic information.",
    ],
  },
  {
    h: 'Cookies and Web Beacons',
    p: [
      "Like any other website, counting.gg uses 'cookies'. These cookies are used to store information including visitors' preferences, and the pages on the website that the visitor accessed or visited. The information is used to optimize the users' experience by customizing our web page content based on visitors' browser type and/or other information.",
    ],
  },
  {
    h: 'Advertising Partners Privacy Policies',
    p: [
      'You may consult this list to find the Privacy Policy for each of the advertising partners of counting.gg.',
      "Third-party ad servers or ad networks uses technologies like cookies, JavaScript, or Web Beacons that are used in their respective advertisements and links that appear on counting.gg, which are sent directly to users' browser. They automatically receive your IP address when this occurs. These technologies are used to measure the effectiveness of their advertising campaigns and/or to personalize the advertising content that you see on websites that you visit.",
      'Note that counting.gg has no access to or control over these cookies that are used by third-party advertisers.',
    ],
  },
  {
    h: 'Third Party Privacy Policies',
    p: [
      "counting.gg's Privacy Policy does not apply to other advertisers or websites. Thus, we are advising you to consult the respective Privacy Policies of these third-party ad servers for more detailed information. It may include their practices and instructions about how to opt-out of certain options.",
      "You can choose to disable cookies through your individual browser options. To know more detailed information about cookie management with specific web browsers, it can be found at the browsers' respective websites.",
    ],
  },
  {
    h: 'CCPA Privacy Rights (Do Not Sell My Personal Information)',
    p: [
      'Under the CCPA, among other rights, California consumers have the right to:',
      "Request that a business that collects a consumer's personal data disclose the categories and specific pieces of personal data that a business has collected about consumers.",
      'Request that a business delete any personal data about the consumer that a business has collected.',
      "Request that a business that sells a consumer's personal data, not sell the consumer's personal data.",
      'If you make a request, we have one month to respond to you. If you would like to exercise any of these rights, please contact us.',
    ],
  },
  {
    h: 'GDPR Data Protection Rights',
    p: [
      'We would like to make sure you are fully aware of all of your data protection rights. Every user is entitled to the following:',
      'The right to access – You have the right to request copies of your personal data. We may charge you a small fee for this service.',
      'The right to rectification – You have the right to request that we correct any information you believe is inaccurate. You also have the right to request that we complete the information you believe is incomplete.',
      'The right to erasure – You have the right to request that we erase your personal data, under certain conditions.',
      'The right to restrict processing – You have the right to request that we restrict the processing of your personal data, under certain conditions.',
      'The right to object to processing – You have the right to object to our processing of your personal data, under certain conditions.',
      'The right to data portability – You have the right to request that we transfer the data that we have collected to another organization, or directly to you, under certain conditions.',
      'If you make a request, we have one month to respond to you. If you would like to exercise any of these rights, please contact us.',
    ],
  },
  {
    h: "Children's Information",
    p: [
      'Another part of our priority is adding protection for children while using the internet. We encourage parents and guardians to observe, participate in, and/or monitor and guide their online activity.',
      'counting.gg does not knowingly collect any Personal Identifiable Information from children under the age of 13. If you think that your child provided this kind of information on our website, we strongly encourage you to contact us immediately and we will do our best efforts to promptly remove such information from our records.',
    ],
  },
]

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background">
      <PrivacyAchievement />
      <div className="max-w-2xl mx-auto px-4 py-12">

        <div className="mb-8">
          <Badge variant="secondary" className="mb-3 text-xs font-medium">Legal</Badge>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-4">
            Privacy Policy
          </h1>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              At counting.gg, one of our main priorities is the privacy of our visitors. This
              Privacy Policy document contains types of information that is collected and recorded
              by counting.gg and how we use it.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you have additional questions or require more information about our Privacy Policy,
              do not hesitate to{' '}
              <Link href="/about" className="underline underline-offset-4 hover:text-foreground transition-colors">
                contact us
              </Link>
              .
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This Privacy Policy applies only to our online activities and is valid for visitors to
              our website with regards to the information that they shared and/or collect in
              counting.gg. This policy is not applicable to any information collected offline or via
              channels other than this website.
            </p>
          </div>
        </div>

        <Separator className="mb-8" />

        <div className="space-y-8">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-base font-semibold text-foreground mb-2">{s.h}</h2>
              <div className="space-y-2">
                {s.p?.map((para, j) => (
                  <p key={j} className="text-sm text-muted-foreground leading-relaxed">{para}</p>
                ))}
                {s.ul && (
                  <ul className="list-disc pl-5 space-y-1.5 pt-1">
                    {s.ul.map((li, j) => (
                      <li key={j} className="text-sm text-muted-foreground leading-relaxed">{li}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>

      </div>
    </main>
  )
}
