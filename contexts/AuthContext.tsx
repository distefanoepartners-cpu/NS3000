'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type UserRole = 'admin' | 'staff' | 'partner'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  supplier_id?: string | null  // ⭐ Collegamento partner → fornitore
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isAdmin: boolean
  isStaff: boolean
  isPartner: boolean           // ⭐ NUOVO
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      }
    } catch (error) {
      console.error('Error loading user:', error)
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      window.location.href = '/login'
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const isAdmin = user?.role === 'admin'
  const isStaff = user?.role === 'staff'
  const isPartner = user?.role === 'partner'  // ⭐ NUOVO

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isStaff, isPartner, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}