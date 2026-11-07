import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import BlogCreateClient from './BlogCreateClient'

export default async function BlogCreatePage() {
  const session = await getSession()
  if (!session) redirect('/api/auth/login')
  return <BlogCreateClient />
}
