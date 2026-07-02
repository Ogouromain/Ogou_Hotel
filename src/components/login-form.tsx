'use client'

import { useState, FormEvent } from 'react'
import { toast } from 'sonner'
import { LogIn, Eye, EyeOff, Loader2, ShieldCheck, Mail, Lock, AlertTriangle, Hotel, Star, Users, CheckCircle2 } from 'lucide-react'
import Image from 'next/image'
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
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/lib/auth-context'
import { useIsMobile } from '@/hooks/use-mobile'

interface LoginFormProps {
  onSwitchToRegister?: () => void
}

export function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const { signIn, isLoading: authLoading } = useAuth()
  const isMobile = useIsMobile()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState(false)

  function validateForm(): boolean {
    if (!email.trim()) {
      setError("L'adresse e-mail est requise")
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
      const { error: signInError } = await signIn(email.trim(), password)

      if (signInError) {
        setError(signInError)
        toast.error('Échec de connexion', {
          description: signInError,
        })
        return
      }

      toast.success('Connexion réussie', {
        description: 'Bienvenue sur OGOU_Hôtel !',
      })
    } catch (err) {
      const errorMessage =
        'Erreur de connexion au serveur. Veuillez réessayer.'
      setError(errorMessage)
      toast.error('Erreur de connexion', {
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const isSubmitting = isLoading || authLoading

  return (
    <div className="flex min-h-screen">
      {/* ─── Decorative Left Panel (desktop only) ──────────────────────── */}
      {!isMobile && (
        <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600">
          {/* Decorative patterns */}
          <div className="absolute inset-0">
            <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-300/15 rounded-full blur-2xl" />
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col justify-center items-center px-12 w-full">
            {/* Logo */}
            <div className="mb-8">
              <Image
                src="/logo.svg"
                alt="OGOU_Hôtel"
                height={100}
                width={100}
                className="object-contain mx-auto drop-shadow-lg brightness-0 invert"
                priority
              />
            </div>

            <h2 className="text-4xl font-bold text-white text-center mb-3 tracking-tight">
              OGOU_Hôtel
            </h2>
            <p className="text-amber-100 text-center text-lg mb-10 max-w-sm">
              La plateforme de gestion hôtelière de référence en Côte d&apos;Ivoire
            </p>

            {/* Feature highlights */}
            <div className="space-y-4 w-full max-w-xs">
              <div className="flex items-center gap-4 text-white/90">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <Hotel className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Gestion complète</p>
                  <p className="text-xs text-white/70">Chambres, réservations, factures</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-white/90">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Clients & walk-ins</p>
                  <p className="text-xs text-white/70">Check-in rapide et suivi</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-white/90">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <Star className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Rapports détaillés</p>
                  <p className="text-xs text-white/70">Tableau de bord en temps réel</p>
                </div>
              </div>
            </div>

            {/* Testimonial / trust */}
            <div className="mt-12 bg-white/10 backdrop-blur-sm rounded-2xl p-5 max-w-xs border border-white/20">
              <div className="flex items-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                ))}
              </div>
              <p className="text-white/90 text-sm italic leading-relaxed">
                &ldquo;OGOU_Hôtel a transformé la gestion de notre établissement. Simple, rapide et efficace.&rdquo;
              </p>
              <p className="text-white/60 text-xs mt-2">— Directeur, Hôtel Palm Beach</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Right Panel: Login Form ─────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 px-4 py-8 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 relative">
        <div className="w-full max-w-md space-y-6">
          {/* Logo and branding (visible on all screens, larger on mobile) */}
          <div className="text-center space-y-3">
            <div className="mx-auto">
              <Image
                src="/logo.svg"
                alt="OGOU_Hôtel"
                height={isMobile ? 72 : 72}
                width={isMobile ? 72 : 72}
                className="object-contain mx-auto"
                priority
              />
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent">
                  OGOU
                </span>
                <span className="text-gray-800 dark:text-gray-200">_Hôtel</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Gestion hôtelière — Côte d&apos;Ivoire
              </p>
            </div>
          </div>

          {/* Login Card */}
          <Card className="shadow-xl border-amber-200/60 dark:border-amber-900/30 overflow-hidden">
            <CardHeader className="text-center space-y-1 pb-4">
              <CardTitle className="text-xl font-semibold">
                Connexion
              </CardTitle>
              <CardDescription className="text-sm">
                Entrez vos identifiants pour accéder au système
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-5">
                {/* Error display with icon */}
                {error && (
                  <div
                    className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30"
                    role="alert"
                  >
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                  </div>
                )}

                {/* Email field with icon */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Adresse e-mail
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (error) setError(null)
                      }}
                      disabled={isSubmitting}
                      autoComplete="email"
                      autoFocus
                      className="h-12 pl-10 text-base transition-all duration-200 focus-visible:border-amber-500 focus-visible:ring-amber-500/25 focus-visible:ring-2"
                      aria-invalid={!!error}
                    />
                  </div>
                </div>

                {/* Password field with icon and toggle */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Mot de passe
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Entrez votre mot de passe"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (error) setError(null)
                      }}
                      disabled={isSubmitting}
                      autoComplete="current-password"
                      className="h-12 pl-10 pr-12 text-base transition-all duration-200 focus-visible:border-amber-500 focus-visible:ring-amber-500/25 focus-visible:ring-2"
                      aria-invalid={!!error}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 text-muted-foreground hover:text-amber-600"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isSubmitting}
                      aria-label={
                        showPassword
                          ? 'Masquer le mot de passe'
                          : 'Afficher le mot de passe'
                      }
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Remember me checkbox */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                  />
                  <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer select-none">
                    Se souvenir de moi
                  </Label>
                </div>

                {/* Shimmer loading overlay */}
                {isSubmitting && (
                  <div className="absolute inset-0 bg-white/40 dark:bg-gray-900/40 backdrop-blur-[1px] z-10 pointer-events-none rounded-lg">
                    <div className="h-full w-full animate-pulse bg-gradient-to-r from-transparent via-amber-200/20 to-transparent bg-[length:200%_100%]" style={{ animation: 'shimmer 1.5s infinite' }} />
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex-col gap-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-orange-700 hover:shadow-amber-500/40 transition-all duration-300 disabled:opacity-60 text-base"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Connexion en cours...
                    </>
                  ) : (
                    <>
                      <LogIn className="h-5 w-5 mr-2" />
                      Se connecter
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Register Link */}
          {onSwitchToRegister && (
            <div className="text-center">
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-sm text-amber-600 hover:text-amber-700 font-medium hover:underline transition-colors"
              >
                Vous avez un code d&apos;activation ? Inscrivez-vous
              </button>
            </div>
          )}

          {/* Security badge */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-900/50">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">Connexion sécurisée</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground">
            <p>
              © {new Date().getFullYear()} OGOU_Hôtel — Gestion Hôtelière, Côte
              d&apos;Ivoire
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
