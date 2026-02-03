import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { api } from '../services/api'

interface User {
  id: number
  email: string
  displayName: string
  role: string
  repos?: string
  isActive: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<string | null>
  logout: () => void
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

// Parse JWT to get expiry time
function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp ? payload.exp * 1000 : null // Convert to ms
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [loading, setLoading] = useState(!!localStorage.getItem('token'))
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleRefresh = useCallback((jwt: string) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }

    const expiry = getTokenExpiry(jwt)
    if (!expiry) return

    // Refresh 1 hour before expiry
    const refreshAt = expiry - Date.now() - (60 * 60 * 1000)
    if (refreshAt <= 0) return // Already past refresh window

    refreshTimerRef.current = setTimeout(async () => {
      const storedRefreshToken = localStorage.getItem('refreshToken')
      if (!storedRefreshToken) return

      try {
        const result = await api.refreshToken(storedRefreshToken)
        localStorage.setItem('token', result.token)
        localStorage.setItem('refreshToken', result.refreshToken)
        setToken(result.token)
        setUser(result.user)
        scheduleRefresh(result.token)
      } catch {
        // Refresh failed — user will be redirected on next API call
      }
    }, refreshAt)
  }, [])

  useEffect(() => {
    if (token) {
      api.getMe()
        .then((u) => {
          setUser(u)
          scheduleRefresh(token)
        })
        .catch(() => {
          localStorage.removeItem('token')
          localStorage.removeItem('refreshToken')
          setToken(null)
        })
        .finally(() => setLoading(false))
    }
  }, [token, scheduleRefresh])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [])

  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const result = await api.login(email, password)
      localStorage.setItem('token', result.token)
      localStorage.setItem('refreshToken', result.refreshToken)
      setToken(result.token)
      setUser(result.user)
      scheduleRefresh(result.token)
      return null
    } catch (err: any) {
      return err.message || 'Login failed'
    }
  }

  const logout = async () => {
    const storedRefreshToken = localStorage.getItem('refreshToken')
    if (storedRefreshToken) {
      try {
        await api.logout(storedRefreshToken)
      } catch {
        // Best effort — clear local state regardless
      }
    }
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      isAdmin: user?.role === 'admin'
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
