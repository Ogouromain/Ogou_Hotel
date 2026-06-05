'use client'

import { useState, FormEvent } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'
import {
  Key,
  Hotel,
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
  MessageSquare,
} from 'lucide-react'
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

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps = [
    { num: 1, label: 'Code', icon: <Key className="h-4 w-4" /> },
    { num: 2, label: 'Hôtel', icon: <Hotel className="h-4 w-4" /> },
    { num: 3, label: 'Propriétaire', icon: <User className="h-4 w-4" /> },
  ]

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, idx) => {
        const isActive = currentStep === step.num
        const isCompleted = currentStep > step.num

        return (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                    : isActive
                    ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : step.icon}
              </div>
              <span
                className={`text-xs mt-1 font-medium ${
                  isCompleted ? 'text-emerald-600' : isActive ? 'text-amber-600' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-12 sm:w-20 h-0.5 mx-2 mb-5 transition-colors duration-300 ${
                  currentStep > step.num ? 'bg-emerald-400' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RegisterForm({ onSwitchToLogin, onRegistrationSuccess }: RegisterFormProps) {
  const { signIn } = useAuth()
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [isLoading, setIsLoading] = useState(false)

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
      
      // Auto-login after successful registration
      const loginResult = await signIn(email.trim().toLowerCase(), password)
      if (loginResult.error) {
        // If auto-login fails, redirect to login page
        toast.info('Votre compte a été créé. Veuillez vous connecter.')
        onSwitchToLogin()
        return
      }
      
      onRegistrationSuccess()
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 px-4 py-8 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="w-full max-w-lg space-y-6">
        {/* Logo and branding */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-xl shadow-amber-500/30">
            <Hotel className="h-10 w-10 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                HôtelCI
              </span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Inscription — Créez votre établissement
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Registration Card */}
        <Card className="shadow-xl border-amber-200/60 dark:border-amber-900/30">
          <CardHeader className="text-center space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold">
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
                      <Input
                        id="activation-code"
                        type="text"
                        placeholder="HTL-XXXX-XXXX-2026"
                        value={activationCode}
                        onChange={(e) => {
                          setActivationCode(e.target.value.toUpperCase())
                          if (codeError) setCodeError(null)
                          // Reset verified state if code changes
                          if (verifiedCode) setVerifiedCode(null)
                        }}
                        disabled={isLoading}
                        className="h-11 font-mono text-center tracking-widest text-lg focus-visible:border-amber-500 focus-visible:ring-amber-500/25"
                        maxLength={19}
                        autoFocus
                      />
                      <Button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={isLoading || !activationCode.trim()}
                        className="h-11 px-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 shrink-0"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Vérifier'
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Error display */}
                  {codeError && (
                    <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-950/30">
                      <AlertDescription className="text-sm text-red-700 dark:text-red-400">
                        {codeError}
                      </AlertDescription>
                    </Alert>
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
                            {formatFCFA(verifiedCode.plan.price_fcfa)}/mois
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Support help for code issues */}
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-medium text-amber-800 mb-1.5">Besoin d&apos;aide pour obtenir un code ?</p>
                    <div className="flex flex-col gap-1.5">
                      <a
                        href="https://wa.me/2250576103277?text=Bonjour%2C%20j%27ai%20besoin%20d%27un%20code%20d%27activation%20H%C3%B4telCI"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 font-medium"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        WhatsApp : +225 05 76 10 32 77
                      </a>
                      <a
                        href="mailto:omouitsi@gmail.com?subject=Code%20d%27activation%20H%C3%B4telCI"
                        className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 font-medium"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        omouitsi@gmail.com
                      </a>
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
                    <Input
                      id="hotel-name"
                      type="text"
                      placeholder="Hôtel Palm Beach"
                      value={hotelName}
                      onChange={(e) => setHotelName(e.target.value)}
                      disabled={isLoading}
                      className="h-11 focus-visible:border-amber-500 focus-visible:ring-amber-500/25"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hotel-city" className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-amber-600" />
                      Ville
                    </Label>
                    <Input
                      id="hotel-city"
                      type="text"
                      list="ci-cities"
                      placeholder="Abidjan"
                      value={hotelCity}
                      onChange={(e) => setHotelCity(e.target.value)}
                      disabled={isLoading}
                      className="h-11 focus-visible:border-amber-500 focus-visible:ring-amber-500/25"
                      required
                    />
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
                    <Input
                      id="hotel-phone"
                      type="tel"
                      placeholder="+225 01 02 03 04 05"
                      value={hotelPhone}
                      onChange={(e) => setHotelPhone(e.target.value)}
                      disabled={isLoading}
                      className="h-11 focus-visible:border-amber-500 focus-visible:ring-amber-500/25"
                      required
                    />
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
                      className="h-11 focus-visible:border-amber-500 focus-visible:ring-amber-500/25"
                    />
                  </div>

                  {/* Show plan info */}
                  {verifiedCode && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 dark:bg-amber-950/30 dark:border-amber-900/50">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        <span className="font-semibold">Plan {verifiedCode.plan.name}</span> — {verifiedCode.duration_months} mois — {formatFCFA(verifiedCode.plan.price_fcfa)}/mois
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
                      <Label htmlFor="first-name" className="text-sm font-medium">
                        Prénom
                      </Label>
                      <Input
                        id="first-name"
                        type="text"
                        placeholder="Amadou"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        disabled={isLoading}
                        className="h-11 focus-visible:border-amber-500 focus-visible:ring-amber-500/25"
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
                        className="h-11 focus-visible:border-amber-500 focus-visible:ring-amber-500/25"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-email" className="text-sm font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4 text-amber-600" />
                      Email professionnel
                    </Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="amadou@hotel.ci"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className="h-11 focus-visible:border-amber-500 focus-visible:ring-amber-500/25"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-password" className="text-sm font-medium">
                      Mot de passe
                    </Label>
                    <div className="relative">
                      <Input
                        id="reg-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Minimum 8 caractères"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        className="h-11 pr-11 focus-visible:border-amber-500 focus-visible:ring-amber-500/25"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-amber-600"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLoading}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {password && password.length < 8 && (
                      <p className="text-xs text-amber-600">
                        Le mot de passe doit contenir au moins 8 caractères ({password.length}/8)
                      </p>
                    )}
                    {password && password.length >= 8 && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Mot de passe conforme
                      </p>
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
                    className="flex-1 h-11"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                  </Button>
                )}

                {currentStep < 3 ? (
                  <Button
                    type="submit"
                    disabled={isLoading || (currentStep === 1 && !verifiedCode)}
                    className="flex-1 h-11 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-60"
                    size="lg"
                  >
                    Suivant
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 h-11 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold shadow-md shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-60"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Création de votre hôtel en cours...
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

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Inscription sécurisée — Données chiffrées</span>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>
            © {new Date().getFullYear()} HôtelCI — Gestion Hôtelière, Côte d&apos;Ivoire
          </p>
        </div>
      </div>
    </div>
  )
}
