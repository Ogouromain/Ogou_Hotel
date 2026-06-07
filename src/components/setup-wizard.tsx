'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Database,
  Shield,
  CheckCircle2,
  Copy,
  RefreshCw,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  ExternalLink,
  Check,
  X,
  Hotel,
} from 'lucide-react'

interface SetupStatus {
  tablesExist: boolean
  adminExists: boolean
  plansSeeded: boolean
  ready: boolean
}

type Step = 1 | 2 | 3

interface SetupWizardProps {
  onComplete?: () => void
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sqlScript, setSqlScript] = useState<string>('')
  const [isLoadingSql, setIsLoadingSql] = useState(false)
  const [copied, setCopied] = useState(false)

  // Admin form state
  const [adminForm, setAdminForm] = useState({
    email: 'omouitsi@gmail.com',
    password: 'Ogou1987',
    firstName: 'Super',
    lastName: 'Admin',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false)

  const checkSetup = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true)
    try {
      const response = await fetch('/api/setup/check')
      if (!response.ok) throw new Error('Erreur de connexion au serveur')
      const data: SetupStatus = await response.json()
      setSetupStatus(data)

      // Auto-advance steps based on status
      if (data.ready) {
        setCurrentStep(3)
      } else if (data.tablesExist && data.plansSeeded && !data.adminExists) {
        setCurrentStep(2)
      } else {
        setCurrentStep(1)
      }
    } catch (error) {
      toast.error('Impossible de vérifier le statut de la base de données')
      console.error(error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  const fetchSqlScript = useCallback(async () => {
    setIsLoadingSql(true)
    try {
      const response = await fetch('/api/setup/sql-script')
      if (!response.ok) throw new Error('Erreur de chargement du script SQL')
      const data = await response.json()
      setSqlScript(data.sql)
    } catch (error) {
      toast.error('Impossible de charger le script SQL')
      console.error(error)
    } finally {
      setIsLoadingSql(false)
    }
  }, [])

  useEffect(() => {
    checkSetup()
  }, [checkSetup])

  useEffect(() => {
    if (setupStatus && !setupStatus.tablesExist && !sqlScript) {
      fetchSqlScript()
    }
  }, [setupStatus, sqlScript, fetchSqlScript])

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(sqlScript)
      setCopied(true)
      toast.success('Script SQL copié dans le presse-papiers !')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Impossible de copier le script SQL')
    }
  }

  const handleCreateAdmin = async () => {
    if (!adminForm.email || !adminForm.password || !adminForm.firstName || !adminForm.lastName) {
      toast.error('Tous les champs sont requis')
      return
    }

    setIsCreatingAdmin(true)
    try {
      const response = await fetch('/api/setup/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la création de l'administrateur")
      }

      toast.success(data.message || 'Super Administrateur créé avec succès !')

      // Re-check setup status to advance to step 3
      await checkSetup(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la création de l'administrateur")
    } finally {
      setIsCreatingAdmin(false)
    }
  }

  // Step indicator component
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8">
      {[
        { step: 1 as Step, label: 'Base de données', icon: Database },
        { step: 2 as Step, label: 'Administrateur', icon: Shield },
        { step: 3 as Step, label: 'Terminé', icon: CheckCircle2 },
      ].map((item, index) => {
        const isActive = currentStep === item.step
        const isCompleted = currentStep > item.step
        const Icon = item.icon

        return (
          <div key={item.step} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`
                  flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 transition-all duration-300
                  ${isCompleted
                    ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/25'
                    : isActive
                      ? 'bg-amber-50 border-amber-500 text-amber-600 shadow-md shadow-amber-500/10'
                      : 'bg-muted border-muted-foreground/20 text-muted-foreground'
                  }
                `}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors ${
                  isActive ? 'text-amber-700' : isCompleted ? 'text-amber-600' : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </span>
            </div>
            {index < 2 && (
              <div
                className={`
                  w-8 sm:w-16 h-0.5 mx-2 mb-6 transition-all duration-300
                  ${currentStep > item.step ? 'bg-amber-500' : 'bg-muted-foreground/20'}
                `}
              />
            )}
          </div>
        )
      })}
    </div>
  )

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-white p-4">
        <Card className="w-full max-w-md shadow-lg border-amber-200/50">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Hotel className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 opacity-20 animate-pulse" />
            </div>
            <Loader2 className="w-6 h-6 text-amber-500 animate-spin mt-2" />
            <p className="text-sm text-muted-foreground">Vérification du système...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-white p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Hotel className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              OGOU_Hôtel
            </h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">
            Configuration initiale de votre système de gestion hôtelière
          </p>
        </div>

        {/* Step Indicator */}
        <StepIndicator />

        {/* Step 1: Database Verification */}
        {currentStep === 1 && (
          <Card className="shadow-lg border-amber-200/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Database className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Vérification de la Base de Données</CardTitle>
                  <CardDescription>
                    Vérification de l&apos;état de votre base de données Supabase
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Status Items */}
              <div className="space-y-3">
                <StatusItem
                  label="Tables"
                  description="Structure de la base de données"
                  isOk={setupStatus?.tablesExist ?? false}
                />
                <StatusItem
                  label="Plans d'abonnement"
                  description="Plans Essential, Professional et Enterprise"
                  isOk={setupStatus?.plansSeeded ?? false}
                />
                <StatusItem
                  label="Administrateur"
                  description="Super administrateur du système"
                  isOk={setupStatus?.adminExists ?? false}
                />
              </div>

              {/* SQL Script Section - shown when tables don't exist */}
              {setupStatus && !setupStatus.tablesExist && (
                <div className="space-y-4">
                  <Alert className="border-amber-300 bg-amber-50">
                    <Database className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">Base de données non configurée</AlertTitle>
                    <AlertDescription className="text-amber-700">
                      Les tables nécessaires n&apos;existent pas encore. Suivez les instructions ci-dessous pour les créer.
                    </AlertDescription>
                  </Alert>

                  {/* Instructions */}
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <h4 className="font-semibold text-sm">Instructions :</h4>
                    <ol className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold shrink-0 mt-0.5">1</span>
                        <span>Ouvrez le Tableau de bord Supabase → Éditeur SQL</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold shrink-0 mt-0.5">2</span>
                        <span>Collez le script SQL ci-dessous</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold shrink-0 mt-0.5">3</span>
                        <span>Exécutez-le</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold shrink-0 mt-0.5">4</span>
                        <span>Revenez ici et cliquez sur <strong>Vérifier</strong></span>
                      </li>
                    </ol>

                    <a
                      href="https://supabase.com/dashboard/project/rjgiktswlgfokztwuqup/sql"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800 underline underline-offset-2 transition-colors"
                    >
                      Ouvrir l&apos;éditeur SQL Supabase
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* SQL Code Block */}
                  <div className="relative">
                    <div className="flex items-center justify-between rounded-t-lg border border-b-0 bg-muted/50 px-4 py-2">
                      <span className="text-xs font-medium text-muted-foreground">Script SQL</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopySql}
                        className="h-7 gap-1.5 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                        disabled={isLoadingSql || !sqlScript}
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Copié !
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copier le script SQL
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="max-h-72 overflow-y-auto rounded-b-lg border bg-muted/20">
                      {isLoadingSql ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                          <span className="ml-2 text-sm text-muted-foreground">Chargement du script...</span>
                        </div>
                      ) : (
                        <pre className="p-4 text-xs leading-relaxed text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all font-mono">
                          {sqlScript || '-- Aucun script disponible'}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Success message when tables exist but admin doesn't */}
              {setupStatus && setupStatus.tablesExist && !setupStatus.adminExists && (
                <Alert className="border-green-300 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">Base de données prête</AlertTitle>
                  <AlertDescription className="text-green-700">
                    Les tables et les plans d&apos;abonnement sont en place. Passez à l&apos;étape suivante pour créer le Super Administrateur.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => checkSetup(true)}
                disabled={isRefreshing}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Vérification...' : 'Vérifier'}
              </Button>

              {setupStatus && setupStatus.tablesExist && (
                <Button
                  onClick={() => setCurrentStep(2)}
                  className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/25"
                >
                  Suivant
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </CardFooter>
          </Card>
        )}

        {/* Step 2: Create Super Admin */}
        {currentStep === 2 && (
          <Card className="shadow-lg border-amber-200/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Création du Super Administrateur</CardTitle>
                  <CardDescription>
                    Configurez le compte administrateur principal du système
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <Alert className="border-amber-300 bg-amber-50">
                <Shield className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Compte privilégié</AlertTitle>
                <AlertDescription className="text-amber-700">
                  Ce compte aura un accès complet à toutes les fonctionnalités du système. Modifiez les identifiants par défaut pour sécuriser votre installation.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    value={adminForm.firstName}
                    onChange={(e) => setAdminForm({ ...adminForm, firstName: e.target.value })}
                    placeholder="Prénom"
                    className="transition-colors focus-visible:border-amber-500 focus-visible:ring-amber-500/25"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    value={adminForm.lastName}
                    onChange={(e) => setAdminForm({ ...adminForm, lastName: e.target.value })}
                    placeholder="Nom"
                    className="transition-colors focus-visible:border-amber-500 focus-visible:ring-amber-500/25"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Adresse e-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  placeholder="admin@ogouhotel.com"
                  className="transition-colors focus-visible:border-amber-500 focus-visible:ring-amber-500/25"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                    placeholder="Mot de passe"
                    className="pr-10 transition-colors focus-visible:border-amber-500 focus-visible:ring-amber-500/25"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="gap-2"
              >
                Retour
              </Button>
              <Button
                onClick={handleCreateAdmin}
                disabled={isCreatingAdmin}
                className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/25"
              >
                {isCreatingAdmin ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  <>
                    Créer l&apos;administrateur
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 3: Setup Complete */}
        {currentStep === 3 && (
          <Card className="shadow-lg border-green-200/50">
            <CardContent className="py-12 flex flex-col items-center gap-6 text-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/30 animate-[scaleIn_0.5s_ease-out]">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 opacity-15 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-green-700">
                  Votre système OGOU_Hôtel est prêt !
                </h2>
                <p className="text-muted-foreground max-w-md">
                  La base de données est configurée et le Super Administrateur a été créé.
                  Vous pouvez maintenant accéder à votre système de gestion hôtelière.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                  <Check className="w-3 h-3 mr-1" />
                  Base de données
                </Badge>
                <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                  <Check className="w-3 h-3 mr-1" />
                  Plans d&apos;abonnement
                </Badge>
                <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                  <Check className="w-3 h-3 mr-1" />
                  Administrateur
                </Badge>
              </div>

              <Button
                size="lg"
                className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25 px-8"
                onClick={() => {
                  if (onComplete) {
                    onComplete()
                  } else {
                    window.location.href = '/login'
                  }
                }}
              >
                Accéder au système
                <ArrowRight className="w-5 h-5" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-muted-foreground">
          <p>OGOU_Hôtel — Système de gestion hôtelière pour la Côte d&apos;Ivoire</p>
        </div>
      </div>
    </div>
  )
}

// Status item sub-component
function StatusItem({
  label,
  description,
  isOk,
}: {
  label: string
  description: string
  isOk: boolean
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
            isOk
              ? 'bg-green-100 text-green-600'
              : 'bg-red-100 text-red-500'
          }`}
        >
          {isOk ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Badge
        variant={isOk ? 'default' : 'destructive'}
        className={`text-xs ${
          isOk
            ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100'
            : ''
        }`}
      >
        {isOk ? 'Configuré' : 'Manquant'}
      </Badge>
    </div>
  )
}
