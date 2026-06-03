'use client'

import { useState, FormEvent } from 'react'
import { toast } from 'sonner'
import { LogIn, Eye, EyeOff, Loader2, Hotel } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface LoginFormProps {
  onLogin: (profile: any) => void
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validateForm(): boolean {
    if (!email.trim()) {
      setError('L\'adresse e-mail est requise')
      return false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError('Veuillez entrer une adresse e-mail valide')
      return false
    }
    if (!password) {
      setError('Le mot de passe est requis')
      return false
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return false
    }
    setError(null)
    return true
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error || 'Une erreur est survenue lors de la connexion'
        setError(errorMessage)
        toast.error('Échec de connexion', {
          description: errorMessage,
        })
        return
      }

      toast.success('Connexion réussie', {
        description: 'Bienvenue sur HôtelCI !',
      })

      onLogin(data.profile)
    } catch (err) {
      const errorMessage = 'Erreur de connexion au serveur. Veuillez réessayer.'
      setError(errorMessage)
      toast.error('Erreur de connexion', {
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 px-4 py-8 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <Card className="w-full max-w-md shadow-xl border-amber-200/60 dark:border-amber-900/30">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25">
            <Hotel className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                HôtelCI
              </span>
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Gestion hôtelière — Côte d&apos;Ivoire
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400" role="alert">
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Adresse e-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError(null)
                }}
                disabled={isLoading}
                autoComplete="email"
                autoFocus
                className="h-11 transition-colors focus-visible:border-amber-500 focus-visible:ring-amber-500/25"
                aria-describedby={error ? 'login-error' : undefined}
                aria-invalid={!!error}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Entrez votre mot de passe"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError(null)
                  }}
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="h-11 pr-11 transition-colors focus-visible:border-amber-500 focus-visible:ring-amber-500/25"
                  aria-describedby={error ? 'login-error' : undefined}
                  aria-invalid={!!error}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-amber-600"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex-col gap-4">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-60"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Se connecter
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} HôtelCI — Tous droits réservés
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
