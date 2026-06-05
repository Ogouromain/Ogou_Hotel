'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Hotel,
  Bed,
  CalendarCheck,
  UtensilsCrossed,
  Package,
  MonitorSmartphone,
  Smartphone,
  ArrowRight,
  Check,
  Loader2,
  Phone,
  Building2,
  User,
  MapPin,
  MessageSquare,
  Star,
  Shield,
  Zap,
  Globe,
  ChevronDown,
  Mail,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ─── Types ─────────────────────────────────────────────────────────────────

interface LandingPageProps {
  onLogin: () => void
  onRegister: () => void
  onDemo: () => void
}

// ─── Feature Data ──────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <Bed className="h-7 w-7" />,
    title: 'Gestion des Chambres',
    description: 'Suivi en temps réel de l\'état des chambres, tarification dynamique et planification du ménage.',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50',
  },
  {
    icon: <CalendarCheck className="h-7 w-7" />,
    title: 'Réservations & Agenda',
    description: 'Agenda interactif, réservations en ligne, check-in/check-out simplifiés et suivi des occupants.',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-50',
  },
  {
    icon: <UtensilsCrossed className="h-7 w-7" />,
    title: 'Restaurant & Room Service',
    description: 'Gestion du menu, commandes en salle et en chambre, suivi des encaissements.',
    color: 'from-rose-500 to-pink-500',
    bgColor: 'bg-rose-50',
  },
  {
    icon: <Package className="h-7 w-7" />,
    title: 'Gestion des Stocks',
    description: 'Suivi des inventaires, alertes de seuil minimum, historique des entrées et sorties.',
    color: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-50',
  },
  {
    icon: <MonitorSmartphone className="h-7 w-7" />,
    title: 'Salles de Conférence',
    description: 'Réservation de salles, planification des événements, facturation horaire automatisée.',
    color: 'from-sky-500 to-cyan-500',
    bgColor: 'bg-sky-50',
  },
  {
    icon: <Smartphone className="h-7 w-7" />,
    title: 'Interface Mobile Staff',
    description: 'Application mobile dédiée pour réceptionnistes, femmes de chambre et personnel de restaurant.',
    color: 'from-orange-500 to-red-500',
    bgColor: 'bg-orange-50',
  },
]

// ─── Pricing Plans ─────────────────────────────────────────────────────────

const PLANS = [
  {
    name: 'Basique',
    price: '25 000',
    period: '/mois',
    description: 'Idéal pour démarrer',
    features: [
      '1 Administrateur',
      '1 Réceptionniste',
      'Jusqu\'à 20 chambres',
      'Gestion des réservations',
      'Fiches clients sécurisées',
      'Support WhatsApp',
    ],
    highlight: false,
    gradient: 'from-amber-50 to-orange-50',
    borderColor: 'border-amber-200',
    buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  {
    name: 'Standard',
    price: '50 000',
    period: '/mois',
    description: 'Le plus populaire',
    features: [
      '1 Administrateur',
      '3 Réceptionnistes',
      'Jusqu\'à 50 chambres',
      'Tous les modules Basique',
      'Rapports avancés & Analytics',
      'Support prioritaire',
      'Notifications SMS/WhatsApp',
    ],
    highlight: true,
    gradient: 'from-amber-100 to-orange-100',
    borderColor: 'border-amber-400',
    buttonClass: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/30',
  },
  {
    name: 'Premium',
    price: '95 000',
    period: '/mois',
    description: 'Pour les grands établissements',
    features: [
      'Chambres illimitées',
      '5 Réceptionnistes + Managers',
      'Modules Restaurant + Stocks',
      'Modules Salles de conférence',
      'Support dédié 24h/24',
      'Formation personnalisée',
      'Analytics & BI avancés',
      'Interface Mobile Staff',
    ],
    highlight: false,
    gradient: 'from-amber-50 to-orange-50',
    borderColor: 'border-amber-200',
    buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
]

// ─── Testimonials ──────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    name: 'Aminata Koné',
    hotel: 'Hôtel Les Palmiers',
    city: 'Abidjan',
    text: 'HôtelCI a transformé notre gestion. Nous avons réduit les erreurs de réservation de 80% en un mois.',
    rating: 5,
  },
  {
    name: 'Jean-Marc Bété',
    hotel: 'Résidence Le Baobab',
    city: 'Bouaké',
    text: 'L\'interface mobile est un game-changer pour notre équipe. Les femmes de chambre adorent la simplicité.',
    rating: 5,
  },
  {
    name: 'Fatou Diallo',
    hotel: 'Espace Cocody',
    city: 'Abidjan',
    text: 'Le suivi en temps réel et les notifications SMS nous permettent de réagir instantanément. Indispensable !',
    rating: 5,
  },
]

// ─── Lead Form Dialog ──────────────────────────────────────────────────────

function LeadFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    prospect_name: '',
    hotel_name: '',
    city: '',
    prospect_phone: '',
    prospect_email: '',
    hotel_size_rooms: '',
    message: '',
  })

  function updateField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          hotel_size_rooms: parseInt(form.hotel_size_rooms) || 0,
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setSuccess(true)
        toast.success('Demande envoyée avec succès !')
      } else {
        toast.error(data.error || 'Erreur lors de l\'envoi')
      }
    } catch {
      toast.error('Erreur de connexion. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    onOpenChange(false)
    if (success) {
      setSuccess(false)
      setForm({
        prospect_name: '',
        hotel_name: '',
        city: '',
        prospect_phone: '',
        prospect_email: '',
        hotel_size_rooms: '',
        message: '',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5 text-amber-600" />
            Demander une Démo
          </DialogTitle>
          <DialogDescription>
            Remplissez ce formulaire et notre équipe vous contactera sous 24h pour une démonstration personnalisée.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 flex flex-col items-center text-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-8 w-8" />
            </div>
            <div>
              <p className="text-lg font-semibold text-emerald-700">Demande enregistrée !</p>
              <p className="text-sm text-muted-foreground mt-1">
                Notre équipe commerciale vous contactera sous 24h au numéro indiqué.
              </p>
            </div>
            <Button onClick={handleClose} className="bg-amber-600 hover:bg-amber-700 text-white">
              Fermer
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prospect_name">Votre Nom *</Label>
                <Input
                  id="prospect_name"
                  placeholder="Aminata Koné"
                  value={form.prospect_name}
                  onChange={e => updateField('prospect_name', e.target.value)}
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hotel_name">Nom de l&apos;Établissement *</Label>
                <Input
                  id="hotel_name"
                  placeholder="Hôtel Les Palmiers"
                  value={form.hotel_name}
                  onChange={e => updateField('hotel_name', e.target.value)}
                  required
                  minLength={2}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Ville *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="city"
                    placeholder="Abidjan"
                    className="pl-9"
                    value={form.city}
                    onChange={e => updateField('city', e.target.value)}
                    required
                    minLength={2}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hotel_size_rooms">Nombre de Chambres *</Label>
                <Input
                  id="hotel_size_rooms"
                  type="number"
                  placeholder="30"
                  min={1}
                  max={10000}
                  value={form.hotel_size_rooms}
                  onChange={e => updateField('hotel_size_rooms', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prospect_phone">Téléphone (+225) *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="prospect_phone"
                    placeholder="05 76 10 32 77"
                    className="pl-9"
                    value={form.prospect_phone}
                    onChange={e => updateField('prospect_phone', e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect_email">Email (optionnel)</Label>
                <Input
                  id="prospect_email"
                  type="email"
                  placeholder="omouitsi@gmail.com"
                  value={form.prospect_email}
                  onChange={e => updateField('prospect_email', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message (optionnel)</Label>
              <Textarea
                id="message"
                placeholder="Décrivez vos besoins spécifiques..."
                rows={3}
                value={form.message}
                onChange={e => updateField('message', e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    Envoyer ma Demande
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Landing Page ─────────────────────────────────────────────────────

export function LandingPage({ onLogin, onRegister, onDemo }: LandingPageProps) {
  const [leadDialogOpen, setLeadDialogOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-amber-100 bg-white/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/20">
              <Hotel className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-amber-900">HôtelCI</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a href="#features" className="text-gray-600 hover:text-amber-700 transition-colors">Fonctionnalités</a>
            <a href="#pricing" className="text-gray-600 hover:text-amber-700 transition-colors">Tarifs</a>
            <a href="#testimonials" className="text-gray-600 hover:text-amber-700 transition-colors">Témoignages</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-amber-200 text-amber-700 hover:bg-amber-50 hidden sm:inline-flex" onClick={onLogin}>
              Connexion
            </Button>
            <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md" onClick={onRegister}>
              S&apos;inscrire
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,158,11,0.15),rgba(255,255,255,0))]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
          <div className="flex flex-col items-center text-center gap-8">
            {/* Badge */}
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 px-4 py-1.5 text-sm font-medium">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              SaaS de Gestion Hôtelière #1 en Côte d&apos;Ivoire
            </Badge>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 max-w-4xl leading-[1.1]">
              Simplifiez la gestion de votre{' '}
              <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                hôtel en Côte d&apos;Ivoire
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed">
              Réservations, chambres, restaurant, stocks, salles de conférence — tout dans une seule application.
              Temps réel, mobile, sécurisé. Conçu pour les hôtels ivoiriens.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/30 text-base px-8 h-12"
                onClick={() => setLeadDialogOpen(true)}
              >
                Demander une Démo
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-amber-300 text-amber-700 hover:bg-amber-50 text-base px-8 h-12"
                onClick={onRegister}
              >
                <Key className="h-5 w-5 mr-2" />
                S&apos;inscrire avec un Code
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-emerald-500" />
                Données sécurisées (RLS)
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-500" />
                Temps réel
              </span>
              <span className="flex items-center gap-1.5">
                <Smartphone className="h-4 w-4 text-sky-500" />
                Interface mobile staff
              </span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="h-6 w-6 text-amber-400" />
        </div>
      </section>

      {/* ─── Features Section ───────────────────────────────────────────────── */}
      <section id="features" className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <Badge variant="outline" className="mb-4 text-amber-700 border-amber-200">Fonctionnalités</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              Tout ce dont votre hôtel a besoin
            </h2>
            <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
              Une suite complète de modules conçus spécifiquement pour l&apos;hôtellerie ivoirienne
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="group border border-gray-100 hover:border-amber-200 hover:shadow-lg transition-all duration-300 bg-white">
                <CardContent className="p-6">
                  <div className={`inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br ${feature.color} text-white mb-4 shadow-md group-hover:scale-110 transition-transform`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing Section ───────────────────────────────────────────────── */}
      <section id="pricing" className="py-16 sm:py-24 bg-gradient-to-b from-amber-50/50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <Badge variant="outline" className="mb-4 text-amber-700 border-amber-200">Tarifs</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              Des tarifs adaptés à chaque établissement
            </h2>
            <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
              Pas de frais cachés. Prix en FCFA, facturation mensuelle transparente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {PLANS.map((plan) => (
              <Card
                key={plan.name}
                className={`relative overflow-hidden border-2 ${plan.borderColor} ${plan.highlight ? 'scale-[1.02] sm:scale-105 shadow-xl' : 'shadow-md'} transition-all hover:shadow-lg`}
              >
                {plan.highlight && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">
                      POPULAIRE
                    </div>
                  </div>
                )}
                <CardHeader className={`pb-4 bg-gradient-to-br ${plan.gradient}`}>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription className="text-gray-600">{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                    <span className="text-lg text-gray-500 ml-1">FCFA{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm text-gray-700">
                        <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full ${plan.buttonClass}`}
                    onClick={() => setLeadDialogOpen(true)}
                  >
                    {plan.highlight ? 'Demander une Démo' : 'Commencer'}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials Section ───────────────────────────────────────────── */}
      <section id="testimonials" className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <Badge variant="outline" className="mb-4 text-amber-700 border-amber-200">Témoignages</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              Ils nous font confiance
            </h2>
            <p className="mt-3 text-lg text-gray-600">
              Des hôteliers satisfaits partout en Côte d&apos;Ivoire
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((testimonial) => (
              <Card key={testimonial.name} className="border border-gray-100 hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-4 italic">&ldquo;{testimonial.text}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-sm font-bold">
                      {testimonial.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{testimonial.name}</p>
                      <p className="text-xs text-gray-500">{testimonial.hotel}, {testimonial.city}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Section ────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-gradient-to-r from-amber-500 to-orange-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Prêt à transformer votre gestion hôtelière ?
          </h2>
          <p className="text-lg text-amber-100 mb-8 max-w-2xl mx-auto">
            Rejoignez les hôtels ivoiriens qui utilisent déjà HôtelCI pour optimiser leurs opérations au quotidien.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-white text-amber-700 hover:bg-amber-50 shadow-lg text-base px-8 h-12"
              onClick={() => setLeadDialogOpen(true)}
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              Demander une Démo Gratuite
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto border-white/30 text-white hover:bg-white/10 text-base px-8 h-12"
              onClick={onRegister}
            >
              S&apos;inscrire Maintenant
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
                  <Hotel className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">HôtelCI</span>
              </div>
              <p className="text-sm leading-relaxed max-w-sm">
                La plateforme SaaS de gestion hôtelière multi-tenant conçue pour les établissements de Côte d&apos;Ivoire.
                Simple, sécurisée, mobile.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Produit</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-amber-400 transition-colors">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-amber-400 transition-colors">Tarifs</a></li>
                <li><a href="#testimonials" className="hover:text-amber-400 transition-colors">Témoignages</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  <a href="tel:+2250576103277" className="hover:text-amber-400 transition-colors">+225 05 76 10 32 77</a>
                </li>
                <li className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <a href="https://wa.me/2250576103277" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">WhatsApp Support</a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  <a href="mailto:omouitsi@gmail.com" className="hover:text-amber-400 transition-colors">omouitsi@gmail.com</a>
                </li>
                <li className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  Abidjan, Côte d&apos;Ivoire
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} HôtelCI. Tous droits réservés.</p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              Fait avec <span className="text-amber-400">&hearts;</span> en Côte d&apos;Ivoire
            </p>
          </div>
        </div>
      </footer>

      {/* ─── Lead Form Dialog ───────────────────────────────────────────────── */}
      <LeadFormDialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen} />
    </div>
  )
}

// Re-export Key icon for the CTA button
function Key(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}
