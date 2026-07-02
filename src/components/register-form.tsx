'use client'

import { useState, FormEvent, useEffect } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'
import {
  Key,
  User,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  MapPin,
  Phone,
  Building2,
  Mail,
  Lock,
  AlertTriangle,
  Hotel,
  Star,
  Users,
  PartyPopper,
} from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { useIsMobile } from '@/hooks/use-mobile'

// ─── Types ───────────────────────────────────────────────────────────────────

interface RegisterFormProps {
  onSwitchToLogin: () => void
  onRegistrationSuccess: (data: RegistrationSuccessData) => void
}

interface RegistrationSuccessData {
  hotel: { id: string; name: string; city: string }
  plan: { name: string; price_fcfa: number }
  subscription: { starts_at: string; ends_at: string; status: string }
  user: { id: string; email: string; first_name: string; last_name: string; role: string }
}

interface VerifiedCodeInfo {
  id: string
  code: string
  duration_months: number
  expires_at: string
  plan: {
    id: string
    name: string
    price_fcfa: number
  }
}

type Step = 1 | 2 | 3

// ─── CI Cities ────────────────────────────────────────────────────────────────

const CI_CITIES = [
  'Abidjan', 'Yamoussoukro', 'Bouaké', 'San-Pedro', 'Daloa',
  'Korhogo', 'Man', 'Gagnoa', 'Abengourou', 'Bondo',
  'Sassandra', 'Grand-Bassam', 'Bingerville', 'Soubré', 'Katiola',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }

  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (score <= 1) return { score: 20, label: 'Faible', color: 'bg-red-500' }
  if (score === 2) return { score: 40, label: 'Moyen', color: 'bg-orange-500' }
  if (score === 3) return { score: 60, label: 'Bon', color: 'bg-amber-500' }
  if (score === 4) return { score: 80, label: 'Fort', color: 'bg-emerald-400' }
  return { score: 100, label: 'Excellent', color: 'bg-emerald-500' }
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps = [
    { num: 1, label: 'Code', description: 'Activation', icon: <Key className="h-4 w-4" /> },
    { num: 2, label: 'Hôtel', description: 'Établissement', icon: <Building2 className="h-4 w-4" /> },
    { num: 3, label: 'Propriétaire', description: 'Votre compte', icon: <User className="h-4 w-4" /> },
  ]

  const progressValue = currentStep === 1 ? 0 : currentStep === 2 ? 50 : 100

  return (
    <div className="space-y-4">
      {/* Horizontal progress bar */}
      <Progress
        value={progressValue}
        className="h-1.5 bg-amber-100 dark:bg-amber-900/30 [&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-amber-500 [&>[data-slot=progress-indicator]]:to-orange-500"
      />

      {/* Step circles and labels */}
      <div className="flex items-start justify-between">
        {steps.map((step, idx) => {
          const isActive = currentStep === step.num
          const isCompleted = currentStep > step.num

          return (
            <div key={step.num} className="flex-1 flex flex-col items-center">
              {/* Numbered circle */}
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-500 border-2 ${
                  isCompleted
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/30'
                    : isActive
                    ? 'bg-gradient-to-br from-amber-500 to-orange-600 border-amber-500 text-white shadow-md shadow-amber-500/30 scale-110'
                    : 'bg-white border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : (
                  <span className="text-sm font-bold">{step.num}</span>
                )}
              </div>

              {/* Label & description */}
              <div className="mt-2 text-center">
                <p
                  className={`text-xs font-semibold transition-colors duration-300 ${
                    isCompleted
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : isActive
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {step.label}
                </p>
                <p
                  className={`text-[10px] transition-colors duration-300 ${
                    isActive ? 'text-muted-foreground' : 'text-transparent'
                  }`}
                >
                  {step.description}
                </p>
              </div>

              {/* Connecting line */}
              {idx < steps.length - 1 && (
                <div className="hidden sm:block absolute" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Success Animation ────────────────────────────────────────────────────────

function SuccessAnimation({ hotelName, onSwitchToLogin }: { hotelName: string; onSwitchToLogin: () => void }) {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          onSwitchToLogin()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [onSwitchToLogin])

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-6 animate-in fade-in duration-500">
      {/* Celebration icon */}
      <div className="relative">
        <div className="absolute inset-0 animate-ping bg-emerald-400/30 rounded-full" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/40">
          <PartyPopper className="h-10 w-10 text-white" />
        </div>
      </div>

      {/* Celebration text */}
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Félicitations ! 🎉
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Votre établissement <span className="font-semibold text-amber-600">{hotelName}</span> a été créé avec succès.
        </p>
      </div>

      {/* Confetti dots (decorative) */}
      <div className="flex gap-2">
        {['bg-amber-400', 'bg-emerald-400', 'bg-orange-400', 'bg-amber-500', 'bg-emerald-500'].map((color, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full ${color} animate-bounce`}
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>

      {/* Countdown */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Redirection vers la connexion dans{' '}
          <span className="font-bold text-amber-600">{countdown}</span>s
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 text-amber-600 border-amber-300 hover:bg-amber-50"
          onClick={onSwitchToLogin}
        >
          Se connecter maintenant
        </Button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RegisterForm({ onSwitchToLogin, onRegistrationSuccess }: RegisterFormProps) {
  const { signIn } = useAuth()
  const isMobile = useIsMobile()
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [registeredHotelName, setRegisteredHotelName] = useState('')

  // Step 1 state
  const [activationCode, setActivationCode] = useState('')
  const [verifiedCode, setVerifiedCode] = useState<VerifiedCodeInfo | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)

  // Step 2 state
  const [hotelName, setHotelName] = useState('')
  const [hotelCity, setHotelCity] = useState('')
  const [hotelPhone, setHotelPhone] = useState('')
  const [hotelAddress, setHotelAddress] = useState('')

  // Step 3 state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const passwordStrength = getPasswordStrength(password)

  // ─── Step 1: Verify Code ──────────────────────────────────────────────

  async function handleVerifyCode() {
    if (!activationCode.trim()) {
      setCodeError('Veuillez saisir un code d\'activation')
      return
    }

    setIsLoading(true)
    setCodeError(null)

    try {
      const res = await fetch('/api/auth/register/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: activationCode.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setCodeError(data.error || 'Code invalide')
        setVerifiedCode(null)
        return
      }

      setVerifiedCode(data)
      toast.success('Code validé avec succès !')
    } catch {
      setCodeError('Erreur de connexion au serveur')
      setVerifiedCode(null)
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Step 2: Validate Hotel Info ──────────────────────────────────────

  function validateStep2(): boolean {
    if (!hotelName.trim()) {
      toast.error('Le nom de l\'établissement est requis')
      return false
    }
    if (!hotelCity.trim()) {
      toast.error('La ville est requise')
      return false
    }
    if (!hotelPhone.trim()) {
      toast.error('Le téléphone de l\'hôtel est requis')
      return false
    }
    return true
  }

  // ─── Step 3: Submit Registration ──────────────────────────────────────

  async function handleRegister(e: FormEvent) {
    e.preventDefault()

    // Validate step 3 fields
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Le prénom et le nom sont requis')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      toast.error('Veuillez entrer une adresse e-mail valide')
      return
    }
    if (password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères')
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activationCode: activationCode.trim(),
          hotelName: hotelName.trim(),
          hotelCity: hotelCity.trim(),
          hotelPhone: hotelPhone.trim(),
          hotelAddress: hotelAddress.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de l\'inscription')
        return
      }

      toast.success('Inscription réussie ! Connexion en cours...')
      
      // Show success animation
      setRegisteredHotelName(hotelName.trim())
      setShowSuccess(true)
      
      // Auto-login after successful registration
      const loginResult = await signIn(email.trim().toLowerCase(), password)
      if (loginResult.error) {
        // If auto-login fails, redirect to login page
        toast.info('Votre compte a été créé. Veuillez vous connecter.')
        onSwitchToLogin()
        return
      }
      
      onRegistrationSuccess(data)
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Navigation helpers ───────────────────────────────────────────────

  function goNext() {
    if (currentStep === 1 && !verifiedCode) return
    if (currentStep === 2 && !validateStep2()) return
    setCurrentStep((Math.min(currentStep + 1, 3)) as Step)
  }

  function goBack() {
    setCurrentStep((Math.max(currentStep - 1, 1)) as Step)
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen">
      {/* ─── Decorative Left Panel (desktop only) ──────────────────────── */}
      {!isMobile && (
        <div className="hidden lg:flex lg:w-[40%] relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700">
          {/* Decorative patterns */}
          <div className="absolute inset-0">
            <div className="absolute top-32 left-8 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-24 right-8 w-80 h-80 bg-emerald-300/15 rounded-full blur-3xl" />
            <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-teal-300/10 rounded-full blur-2xl" />
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col justify-center items-center px-10 w-full">
            {/* Logo */}
            <div className="mb-8">
              <Image
                src="/logo.svg"
                alt="OGOU_Hôtel"
                height={90}
                width={90}
                className="object-contain mx-auto drop-shadow-lg brightness-0 invert"
                priority
              />
            </div>

            <h2 className="text-3xl font-bold text-white text-center mb-3 tracking-tight">
              Rejoignez OGOU_Hôtel
            </h2>
            <p className="text-emerald-100 text-center text-base mb-10 max-w-sm">
              Créez votre établissement en quelques étapes et commencez à gérer votre hôtel
            </p>

            {/* Steps preview */}
            <div className="space-y-4 w-full max-w-xs">
              <div className="flex items-center gap-4 text-white/90">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl backdrop-blur-sm transition-all duration-300 ${
                  currentStep >= 1 ? 'bg-white/25 ring-2 ring-white/50' : 'bg-white/10'
                }`}>
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Code d&apos;activation</p>
                  <p className="text-xs text-white/60">Validez votre licence</p>
                </div>
                {currentStep > 1 && <CheckCircle2 className="h-5 w-5 text-emerald-300 ml-auto" />}
              </div>

              <div className="flex items-center gap-4 text-white/90">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl backdrop-blur-sm transition-all duration-300 ${
                  currentStep >= 2 ? 'bg-white/25 ring-2 ring-white/50' : 'bg-white/10'
                }`}>
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Votre hôtel</p>
                  <p className="text-xs text-white/60">Informations de l&apos;établissement</p>
                </div>
                {currentStep > 2 && <CheckCircle2 className="h-5 w-5 text-emerald-300 ml-auto" />}
              </div>

              <div className="flex items-center gap-4 text-white/90">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl backdrop-blur-sm transition-all duration-300 ${
                  currentStep >= 3 ? 'bg-white/25 ring-2 ring-white/50' : 'bg-white/10'
                }`}>
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Votre compte</p>
                  <p className="text-xs text-white/60">Identifiants propriétaire</p>
                </div>
              </div>
            </div>

            {/* Trust badge */}
            <div className="mt-10 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
              <ShieldCheck className="h-4 w-4 text-emerald-200" />
              <span className="text-sm text-white/80 font-medium">Inscription sécurisée</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Right Panel: Registration Form ───────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 px-4 py-8 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="w-full max-w-lg space-y-6">
          {/* Logo and branding */}
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
                Inscription — Créez votre établissement
              </p>
            </div>
          </div>

          {/* Step Indicator */}
          <StepIndicator currentStep={currentStep} />

          {/* Success Animation */}
          {showSuccess ? (
            <Card className="shadow-xl border-emerald-200/60 dark:border-emerald-900/30">
              <CardContent className="pt-6">
                <SuccessAnimation
                  hotelName={registeredHotelName}
                  onSwitchToLogin={onSwitchToLogin}
                />
              </CardContent>
            </Card>
          ) : (
            /* Registration Card */
            <Card className="shadow-xl border-amber-200/60 dark:border-amber-900/30 overflow-hidden">
              <CardHeader className="text-center space-y-1 pb-4">
                <CardTitle className="text-xl font-semibold">
                  {currentStep === 1 && 'Activation de votre compte'}
                  {currentStep === 2 && 'Informations de l\'établissement'}
                  {currentStep === 3 && 'Vos informations personnelles'}
                </CardTitle>
                <CardDescription className="text-sm">
                  {currentStep === 1 && 'Saisissez le code d\'activation fourni par l\'administrateur'}
                  {currentStep === 2 && 'Renseignez les détails de votre hôtel'}
                  {currentStep === 3 && 'Créez votre compte propriétaire'}
                </CardDescription>
              </CardHeader>

              <form onSubmit={currentStep === 3 ? handleRegister : (e) => { e.preventDefault(); goNext() }}>
                <CardContent className="space-y-5">
                  {/* ─── STEP 1: Code Verification ──────────────────────────────── */}
                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="activation-code" className="text-sm font-medium flex items-center gap-2">
                          <Key className="h-4 w-4 text-amber-600" />
                          Code d&apos;activation
                        </Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                            <Input
                              id="activation-code"
                              type="text"
                              placeholder="HTL-XXXX-XXXX-2026"
                              value={activationCode}
                              onChange={(e) => {
                                setActivationCode(e.target.value.toUpperCase())
                                if (codeError) setCodeError(null)
                                if (verifiedCode) setVerifiedCode(null)
                              }}
                              disabled={isLoading}
                              className="h-12 pl-10 font-mono text-center tracking-widest text-lg focus-visible:border-amber-500 focus-visible:ring-amber-500/25 focus-visible:ring-2 transition-all duration-200"
                              maxLength={19}
                              autoFocus
                            />
                          </div>
                          <Button
                            type="button"
                            onClick={handleVerifyCode}
                            disabled={isLoading || !activationCode.trim()}
                            className="h-12 px-5 bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 shrink-0 shadow-md shadow-amber-500/20 transition-all duration-300"
                          >
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Vérifier'
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Error display with icon */}
                      {codeError && (
                        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
                          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                          <p className="text-sm text-red-700 dark:text-red-400">{codeError}</p>
                        </div>
                      )}

                      {/* Success display */}
                      {verifiedCode && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                                Code Valide
                              </p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                                  Plan {verifiedCode.plan.name}
                                </Badge>
                                <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                                  {verifiedCode.duration_months} mois inclus
                                </Badge>
                              </div>
                              <p className="text-xs text-emerald-600">
                                {formatFCFA(verifiedCode.plan.price_fcfa)}/an
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Support help for code issues */}
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950/20 dark:border-amber-900/40">
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1.5">Besoin d&apos;aide pour obtenir un code ?</p>
                        <div className="flex flex-col gap-1.5">
                          <a
                            href="mailto:omouitsi@gmail.com?subject=Code%20d%27activation%20H%C3%B4telCI"
                            className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 font-medium"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            omouitsi@gmail.com
                          </a>
                          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            +225 05 76 10 32 77
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── STEP 2: Hotel Information ───────────────────────────────── */}
                  {currentStep === 2 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="hotel-name" className="text-sm font-medium flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-amber-600" />
                          Nom de l&apos;établissement
                        </Label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                          <Input
                            id="hotel-name"
                            type="text"
                            placeholder="Hôtel Palm Beach"
                            value={hotelName}
                            onChange={(e) => setHotelName(e.target.value)}
                            disabled={isLoading}
                            className="h-12 pl-10 text-base focus-visible:border-amber-500 focus-visible:ring-amber-500/25 focus-visible:ring-2 transition-all duration-200"
                            autoFocus
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="hotel-city" className="text-sm font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-amber-600" />
                          Ville
                        </Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                          <Input
                            id="hotel-city"
                            type="text"
                            list="ci-cities"
                            placeholder="Abidjan"
                            value={hotelCity}
                            onChange={(e) => setHotelCity(e.target.value)}
                            disabled={isLoading}
                            className="h-12 pl-10 text-base focus-visible:border-amber-500 focus-visible:ring-amber-500/25 focus-visible:ring-2 transition-all duration-200"
                            required
                          />
                        </div>
                        <datalist id="ci-cities">
                          {CI_CITIES.map((city) => (
                            <option key={city} value={city} />
                          ))}
                        </datalist>
                        <p className="text-xs text-muted-foreground">
                          Principales villes : Abidjan, Yamoussoukro, Bouaké, San-Pedro...
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="hotel-phone" className="text-sm font-medium flex items-center gap-2">
                          <Phone className="h-4 w-4 text-amber-600" />
                          Téléphone de l&apos;hôtel
                        </Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                          <Input
                            id="hotel-phone"
                            type="tel"
                            placeholder="+225 01 02 03 04 05"
                            value={hotelPhone}
                            onChange={(e) => setHotelPhone(e.target.value)}
                            disabled={isLoading}
                            className="h-12 pl-10 text-base focus-visible:border-amber-500 focus-visible:ring-amber-500/25 focus-visible:ring-2 transition-all duration-200"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="hotel-address" className="text-sm font-medium">
                          Adresse physique
                        </Label>
                        <Input
                          id="hotel-address"
                          type="text"
                          placeholder="Boulevard VGE, Cocody"
                          value={hotelAddress}
                          onChange={(e) => setHotelAddress(e.target.value)}
                          disabled={isLoading}
                          className="h-12 text-base focus-visible:border-amber-500 focus-visible:ring-amber-500/25 focus-visible:ring-2 transition-all duration-200"
                        />
                      </div>

                      {/* Show plan info */}
                      {verifiedCode && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 dark:bg-amber-950/30 dark:border-amber-900/50">
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            <span className="font-semibold">Plan {verifiedCode.plan.name}</span> — {verifiedCode.duration_months} mois — {formatFCFA(verifiedCode.plan.price_fcfa)}/an
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── STEP 3: Owner Information ───────────────────────────────── */}
                  {currentStep === 3 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="first-name" className="text-sm font-medium flex items-center gap-2">
                            <User className="h-4 w-4 text-amber-600" />
                            Prénom
                          </Label>
                          <Input
                            id="first-name"
                            type="text"
                            placeholder="Amadou"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            disabled={isLoading}
                            className="h-12 text-base focus-visible:border-amber-500 focus-visible:ring-amber-500/25 focus-visible:ring-2 transition-all duration-200"
                            autoFocus
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="last-name" className="text-sm font-medium">
                            Nom
                          </Label>
                          <Input
                            id="last-name"
                            type="text"
                            placeholder="Koné"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            disabled={isLoading}
                            className="h-12 text-base focus-visible:border-amber-500 focus-visible:ring-amber-500/25 focus-visible:ring-2 transition-all duration-200"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reg-email" className="text-sm font-medium flex items-center gap-2">
                          <Mail className="h-4 w-4 text-amber-600" />
                          Email professionnel
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                          <Input
                            id="reg-email"
                            type="email"
                            placeholder="amadou@hotel.ci"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                            className="h-12 pl-10 text-base focus-visible:border-amber-500 focus-visible:ring-amber-500/25 focus-visible:ring-2 transition-all duration-200"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reg-password" className="text-sm font-medium flex items-center gap-2">
                          <Lock className="h-4 w-4 text-amber-600" />
                          Mot de passe
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                          <Input
                            id="reg-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Minimum 8 caractères"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            className="h-12 pl-10 pr-12 text-base focus-visible:border-amber-500 focus-visible:ring-amber-500/25 focus-visible:ring-2 transition-all duration-200"
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 text-muted-foreground hover:text-amber-600"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                            tabIndex={-1}
                            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>

                        {/* Password strength indicator */}
                        {password && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 mr-3">
                                <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${passwordStrength.color}`}
                                    style={{ width: `${passwordStrength.score}%` }}
                                  />
                                </div>
                              </div>
                              <span className={`text-xs font-medium ${
                                passwordStrength.score <= 40 ? 'text-red-500' :
                                passwordStrength.score <= 60 ? 'text-amber-500' :
                                'text-emerald-500'
                              }`}>
                                {passwordStrength.label}
                              </span>
                            </div>
                            {password.length < 8 && (
                              <p className="text-xs text-amber-600">
                                Le mot de passe doit contenir au moins 8 caractères ({password.length}/8)
                              </p>
                            )}
                            {password.length >= 8 && passwordStrength.score < 60 && (
                              <p className="text-xs text-muted-foreground">
                                Astuce : ajoutez des majuscules, chiffres et symboles pour renforcer votre mot de passe
                              </p>
                            )}
                            {passwordStrength.score >= 60 && (
                              <p className="text-xs text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Mot de passe conforme
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Summary */}
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 dark:bg-amber-950/30 dark:border-amber-900/50">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Récapitulatif</p>
                        <div className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                          <p>🏨 {hotelName} — {hotelCity}</p>
                          <p>📋 Plan {verifiedCode?.plan.name} — {verifiedCode?.duration_months} mois</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex-col gap-3">
                  <div className="flex w-full gap-3">
                    {currentStep > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={goBack}
                        disabled={isLoading}
                        className="flex-1 h-12 text-base"
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Retour
                      </Button>
                    )}

                    {currentStep < 3 ? (
                      <Button
                        type="submit"
                        disabled={isLoading || (currentStep === 1 && !verifiedCode)}
                        className="flex-1 h-12 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-orange-700 hover:shadow-amber-500/40 transition-all duration-300 disabled:opacity-60 text-base"
                        size="lg"
                      >
                        Suivant
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 h-12 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-emerald-700 hover:shadow-emerald-500/40 transition-all duration-300 disabled:opacity-60 text-base"
                        size="lg"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            Création en cours...
                          </>
                        ) : (
                          <>
                            Créer mon établissement
                            <CheckCircle2 className="h-4 w-4 ml-2" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    className="text-sm text-muted-foreground hover:text-amber-600"
                    onClick={onSwitchToLogin}
                    disabled={isLoading}
                  >
                    Déjà inscrit ? Se connecter
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}

          {/* Security badge */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-900/50">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">Inscription sécurisée</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground">
            <p>
              © {new Date().getFullYear()} OGOU_Hôtel — Gestion Hôtelière, Côte d&apos;Ivoire
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
