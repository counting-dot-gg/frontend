'use server'

import { revalidatePath } from 'next/cache'

export async function revalidateHomeScene(): Promise<void> {
  revalidatePath('/')
}
