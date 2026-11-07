'use client'

import Link from 'next/link'
import { Settings, ShieldCheck } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface NavUserMenuProps {
  user: {
    username?: string
    counter?: { avatarUrl?: string; username?: string; emoji?: string; roles?: string[] }
    unreadMentionCount?: number
  }
  onLogout: () => void
}

export default function NavUserMenu({ user, onLogout }: NavUserMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className="flex shrink-0 items-center rounded-full ring-2 ring-transparent hover:ring-white/50 transition-all focus:outline-none">
          <Avatar size="lg">
            <AvatarImage src={user.counter?.avatarUrl} alt={user.counter?.username ?? user.username} />
            <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
              {(user.counter?.emoji ?? user.username?.[0])?.toUpperCase() ?? '?'}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link href={`/counter/${user.counter?.username ?? user.username}`}>My Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/mentions" className="flex items-center justify-between">
            Mentions
            {!!user.unreadMentionCount && (
              <span className="ml-2 text-xs bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 font-bold">
                {user.unreadMentionCount}
              </span>
            )}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/prefs"><Settings className="size-3.5 mr-2" />Preferences</Link>
        </DropdownMenuItem>
        {user.counter?.roles?.includes('admin') && (
          <DropdownMenuItem asChild>
            <Link href="/admin/approve"><ShieldCheck className="size-3.5 mr-2" />Approve users</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={e => { e.preventDefault(); onLogout() }}
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
