// app/lib/api-fetch.ts
// Wrapper around fetch that automatically attaches the Supabase auth token
// as an Authorization header so API routes can verify the user server-side.

import { createSupabaseBrowserClient } from './supabase-browser'

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const supabase = createSupabaseBrowserClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  }

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  return fetch(url, { ...options, headers })
}
