// app/lib/supabase-server.ts
// SERVER ONLY — import this in API route handlers (app/api/**/route.ts).

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// Verifies the user from the Authorization header (Bearer token).
// The client sends this automatically when we configure it correctly.
export async function getUserFromRequest(request: NextRequest) {
  const admin = createSupabaseAdminClient()

  // Try Authorization header first (most reliable in API routes)
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token)
    if (user && !error) return user
  }

  // Fallback: try to find the token in cookies
  const cookies = request.cookies.getAll()
  const tokenCookie = cookies.find(
    c => c.name.includes('auth-token') && !c.name.includes('code-verifier'),
  )
  if (tokenCookie) {
    try {
      // Cookie value may be JSON array [access_token, refresh_token]
      const parsed = JSON.parse(tokenCookie.value)
      const token = Array.isArray(parsed) ? parsed[0] : (parsed.access_token ?? parsed)
      if (token) {
        const {
          data: { user },
          error,
        } = await admin.auth.getUser(token)
        if (user && !error) return user
      }
    } catch {
      // Not JSON, try raw value
      const {
        data: { user },
        error,
      } = await admin.auth.getUser(tokenCookie.value)
      if (user && !error) return user
    }
  }

  return null
}

// Service role client — bypasses RLS, full database access.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
