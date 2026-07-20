'use client'
// app/login/page.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '../lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          PLL Fantasy<span> App</span>
        </div>
        <div className="auth-sub">Private League</div>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                color: 'var(--muted)',
                fontFamily: 'sans-serif',
                marginBottom: 5,
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Email
            </label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                color: 'var(--muted)',
                fontFamily: 'sans-serif',
                marginBottom: 5,
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Password
            </label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <div
              style={{
                padding: '8px 12px',
                background: '#3a1a1a',
                border: '1px solid var(--red)',
                borderRadius: 6,
                fontSize: 12,
                color: '#e06060',
                fontFamily: 'sans-serif',
              }}
            >
              {error}
            </div>
          )}
          <button
            className="btn btn-gold"
            type="submit"
            disabled={loading}
            style={{ marginTop: 4 }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div
          style={{
            marginTop: 20,
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--muted)',
            fontFamily: 'sans-serif',
          }}
        >
          Don't have an account? Ask your commissioner.
        </div>
      </div>
    </div>
  )
}
