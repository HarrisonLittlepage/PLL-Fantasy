// app/lib/supabase-browser.ts
// BROWSER ONLY — safe to import in 'use client' components.
// Do NOT import this in API routes.

import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
