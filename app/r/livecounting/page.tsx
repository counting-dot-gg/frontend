import { redirect } from 'next/navigation'
import { LC_THREAD_NAME } from '@/lib/reddit'

export default function RLivecountingRedirect() {
  redirect(`/thread/${LC_THREAD_NAME}`)
}
