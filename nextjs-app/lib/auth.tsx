'use client'

import { createContext, useContext, useState, useEffect } from 'react'

interface User {
  id: string
  email: string
  name?: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string, name?: string) => Promise<boolean>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for stored user on mount
    const storedUser = localStorage.getItem('medical-companion-user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    // Simple mock authentication - in real app, this would call an API
    if (email && password.length >= 6) {
      const newUser = {
        id: Date.now().toString(),
        email,
        name: email.split('@')[0]
      }
      setUser(newUser)
      localStorage.setItem('medical-companion-user', JSON.stringify(newUser))
      return true
    }
    return false
  }

  const register = async (email: string, password: string, name?: string): Promise<boolean> => {
    // Simple mock registration
    if (email && password.length >= 6) {
      const newUser = {
        id: Date.now().toString(),
        email,
        name: name || email.split('@')[0]
      }
      setUser(newUser)
      localStorage.setItem('medical-companion-user', JSON.stringify(newUser))
      return true
    }
    return false
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('medical-companion-user')
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
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