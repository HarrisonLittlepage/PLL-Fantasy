// app/lib/supabase.ts

import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

// ── BROWSER CLIENT ────────────────────────────────────────────────────────────
// Use in React components ('use client' files) only.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── SERVER CLIENT (for API routes) ────────────────────────────────────────────
// Reads auth cookies from the incoming request so getUser() works server-side.
// Pass the NextRequest from your route handler.
export function createSupabaseServerClient(request: NextRequest) {
  const response = new Response()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
        },
      },
    }
  )
}

// ── ADMIN CLIENT ──────────────────────────────────────────────────────────────
// Uses service role key — bypasses RLS. Use ONLY for commissioner actions
// and server-side writes after auth has already been verified.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
