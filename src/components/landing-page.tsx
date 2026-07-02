'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import Image from 'next/image'
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
  CalendarDays,
  Users,
  Search,
  CreditCard,
  PartyPopper,
  Facebook,
  Instagram,
  Twitter,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

interface HotelInfo {
  id: string
  name: string
  city: string
}

interface AvailableRoom {
  id: string
  room_number: string
  room_type: string
  price_per_night: number
  weekend_price: number | null
  total_price: number
  status: string
}

// ─── Feature Data ──────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <Bed className="h-7 w-7" />,
    title: 'Gestion des Chambres',
    description: 'Suivi en temps réel de l\'état des chambres, tarification dynamique et planification du ménage.',
    color: 'from-amber-500 to-orange-500',
    glowColor: 'hover:shadow-amber-200/50',
  },
  {
    icon: <CalendarCheck className="h-7 w-7" />,
    title: 'Réservations & Agenda',
    description: 'Agenda interactif, réservations en ligne, check-in/check-out simplifiés et suivi des occupants.',
    color: 'from-emerald-500 to-teal-500',
    glowColor: 'hover:shadow-emerald-200/50',
  },
  {
    icon: <UtensilsCrossed className="h-7 w-7" />,
    title: 'Restaurant & Room Service',
    description: 'Gestion du menu, commandes en salle et en chambre, suivi des encaissements.',
    color: 'from-rose-500 to-pink-500',
    glowColor: 'hover:shadow-rose-200/50',
  },
  {
    icon: <Package className="h-7 w-7" />,
    title: 'Gestion des Stocks',
    description: 'Suivi des inventaires, alertes de seuil minimum, historique des entrées et sorties.',
    color: 'from-violet-500 to-purple-500',
    glowColor: 'hover:shadow-violet-200/50',
  },
  {
    icon: <MonitorSmartphone className="h-7 w-7" />,
    title: 'Salles de Conférence',
    description: 'Réservation de salles, planification des événements, facturation horaire automatisée.',
    color: 'from-sky-500 to-cyan-500',
    glowColor: 'hover:shadow-sky-200/50',
  },
  {
    icon: <Smartphone className="h-7 w-7" />,
    title: 'Interface Mobile Staff',
    description: 'Application mobile dédiée pour réceptionnistes, femmes de chambre et personnel de restaurant.',
    color: 'from-orange-500 to-red-500',
    glowColor: 'hover:shadow-orange-200/50',
  },
]

// ─── Pricing Plans ─────────────────────────────────────────────────────────

const PLANS = [
  {
    name: 'Basique',
    price: '25 000',
    period: '/an',
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
    period: '/an',
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
    period: '/an',
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
    text: 'OGOU_Hôtel a transformé notre gestion. Nous avons réduit les erreurs de réservation de 80% en un mois.',
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

// ─── Formatteur FCFA ───────────────────────────────────────────────────────

function formatFCFA(amount: number): string {
  return amount.toLocaleString('fr-FR') + ' FCFA'
}

// ─── Room type label ───────────────────────────────────────────────────────

function getRoomTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    Single: 'Single',
    Double: 'Double',
    Suite: 'Suite',
    Triple: 'Triple',
    Familiale: 'Familiale',
  }
  return labels[type] || type
}

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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
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

// ─── Booking Section ───────────────────────────────────────────────────────

function BookingSection() {
  // État du formulaire
  const [hotels, setHotels] = useState<HotelInfo[]>([])
  const [selectedHotel, setSelectedHotel] = useState<string>('')
  const [checkIn, setCheckIn] = useState<string>('')
  const [checkOut, setCheckOut] = useState<string>('')
  const [guests, setGuests] = useState<string>('1')
  const [roomTypePref, setRoomTypePref] = useState<string>('all')

  // État des disponibilités
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string>('')
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // État des infos client
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')

  // État de la soumission
  const [submitting, setSubmitting] = useState(false)
  const [bookingResult, setBookingResult] = useState<{
    confirmation_code: string
    total_price: number
    room_number: string
    room_type: string
    check_in_date: string
    check_out_date: string
  } | null>(null)

  // Charger les hôtels
  useEffect(() => {
    async function loadHotels() {
      try {
        const res = await fetch('/api/hotels')
        const data = await res.json()
        if (res.ok && data.hotels) {
          const hotelList: HotelInfo[] = data.hotels.map((h: Record<string, unknown>) => ({
            id: h.id as string,
            name: h.name as string,
            city: h.city as string,
          }))
          setHotels(hotelList)
          // Auto-sélectionner s'il n'y a qu'un seul hôtel
          if (hotelList.length === 1) {
            setSelectedHotel(hotelList[0].id)
          }
        }
      } catch {
        // Silently fail
      }
    }
    loadHotels()
  }, [])

  // Vérifier la disponibilité
  const checkAvailability = useCallback(async () => {
    if (!selectedHotel || !checkIn || !checkOut) return

    setSearching(true)
    setHasSearched(true)
    setSelectedRoom('')

    try {
      const params = new URLSearchParams({
        hotel_id: selectedHotel,
        check_in: checkIn,
        check_out: checkOut,
      })
      const res = await fetch(`/api/rooms?${params}`)
      const data = await res.json()

      if (res.ok) {
        let rooms: AvailableRoom[] = data.rooms || []
        // Filtrer par type de chambre si sélectionné
        if (roomTypePref && roomTypePref !== 'all') {
          rooms = rooms.filter((r: AvailableRoom) => r.room_type === roomTypePref)
        }
        setAvailableRooms(rooms)
      } else {
        toast.error(data.error || 'Erreur lors de la recherche')
        setAvailableRooms([])
      }
    } catch {
      toast.error('Erreur de connexion')
      setAvailableRooms([])
    } finally {
      setSearching(false)
    }
  }, [selectedHotel, checkIn, checkOut, roomTypePref])

  // Recherche automatique quand les dates changent
  useEffect(() => {
    if (selectedHotel && checkIn && checkOut && checkOut > checkIn) {
      checkAvailability()
    }
  }, [selectedHotel, checkIn, checkOut, checkAvailability])

  // Recherche quand le filtre de type change
  useEffect(() => {
    if (hasSearched && selectedHotel && checkIn && checkOut) {
      checkAvailability()
    }
  }, [roomTypePref, hasSearched, selectedHotel, checkIn, checkOut, checkAvailability])

  // Soumettre la réservation
  async function handleReservation(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedRoom) {
      toast.error('Veuillez sélectionner une chambre')
      return
    }

    if (!firstName || !lastName || !phone) {
      toast.error('Veuillez remplir vos informations personnelles')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/public/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotel_id: selectedHotel,
          room_id: selectedRoom,
          check_in_date: checkIn,
          check_out_date: checkOut,
          first_name: firstName,
          last_name: lastName,
          phone,
          email: email || undefined,
          guests: parseInt(guests),
          special_requests: specialRequests || undefined,
        }),
      })

      const data = await res.json()

      if (res.ok && data.reservation) {
        setBookingResult({
          confirmation_code: data.reservation.confirmation_code,
          total_price: data.reservation.total_price,
          room_number: data.reservation.room?.room_number || '',
          room_type: data.reservation.room?.room_type || '',
          check_in_date: checkIn,
          check_out_date: checkOut,
        })
        toast.success('Réservation envoyée avec succès !')
      } else {
        toast.error(data.error || 'Erreur lors de la réservation')
      }
    } catch {
      toast.error('Erreur de connexion. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  // Dates minimum (aujourd'hui)
  const today = new Date().toISOString().split('T')[0]
  // Date minimum pour le checkout = checkin + 1 jour
  const minCheckOut = checkIn
    ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().split('T')[0]
    : today

  const selectedRoomData = availableRooms.find(r => r.id === selectedRoom)
  const nights = checkIn && checkOut && checkOut > checkIn
    ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
    : 0

  // ─── Écran de confirmation ──────────────────────────────────
  if (bookingResult) {
    return (
      <section id="booking" className="py-20 sm:py-28 bg-gradient-to-b from-emerald-50/60 to-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="border-2 border-emerald-200 shadow-xl rounded-2xl">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col items-center text-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 animate-fade-in-up">
                  <PartyPopper className="h-10 w-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-emerald-700">Réservation Envoyée !</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Votre demande de réservation a été enregistrée. Vous recevrez une confirmation par téléphone ou email.
                  </p>
                </div>

                <div className="w-full bg-emerald-50 rounded-xl p-5 space-y-3 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Code de confirmation</span>
                    <span className="text-lg font-bold text-emerald-700 font-mono">{bookingResult.confirmation_code}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Chambre</span>
                    <span className="font-semibold">{bookingResult.room_number} — {getRoomTypeLabel(bookingResult.room_type)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Arrivée</span>
                    <span className="font-semibold">{new Date(bookingResult.check_in_date).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Départ</span>
                    <span className="font-semibold">{new Date(bookingResult.check_out_date).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="border-t border-emerald-200 pt-3 flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Prix total</span>
                    <span className="text-xl font-bold text-amber-700">{formatFCFA(bookingResult.total_price)}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Conservez votre code de confirmation : <strong>{bookingResult.confirmation_code}</strong>
                </p>

                <Button
                  className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md transition-all duration-300"
                  onClick={() => {
                    setBookingResult(null)
                    setSelectedRoom('')
                    setAvailableRooms([])
                    setHasSearched(false)
                    setFirstName('')
                    setLastName('')
                    setPhone('')
                    setEmail('')
                    setSpecialRequests('')
                  }}
                >
                  Nouvelle Recherche
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    )
  }

  return (
    <section id="booking" className="py-20 sm:py-28 bg-gradient-to-b from-amber-50/60 to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En-tête */}
        <div className="text-center mb-12 sm:mb-16">
          <Badge variant="outline" className="mb-4 text-amber-700 border-amber-200 bg-amber-50/50">
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
            Réservation en Ligne
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Réservez Votre Séjour
          </h2>
          <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
            Vérifiez la disponibilité et réservez votre chambre en quelques clics. Confirmation instantanée.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* ─── Formulaire de recherche ─────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Carte : Sélection de l'hôtel et dates */}
            <Card className="border-amber-200 shadow-md rounded-2xl">
              <CardHeader className="pb-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-2xl">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5 text-amber-600" />
                  Rechercher une Chambre
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 space-y-5">
                {/* Hôtel */}
                {hotels.length > 1 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-amber-600" />
                      Hôtel *
                    </Label>
                    <Select value={selectedHotel} onValueChange={setSelectedHotel}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sélectionnez un hôtel" />
                      </SelectTrigger>
                      <SelectContent>
                        {hotels.map(h => (
                          <SelectItem key={h.id} value={h.id}>
                            {h.name} — {h.city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Dates et invités */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-amber-600" />
                      Date d&apos;arrivée *
                    </Label>
                    <Input
                      type="date"
                      min={today}
                      value={checkIn}
                      onChange={e => {
                        setCheckIn(e.target.value)
                        if (checkOut && e.target.value >= checkOut) {
                          setCheckOut('')
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-amber-600" />
                      Date de départ *
                    </Label>
                    <Input
                      type="date"
                      min={minCheckOut}
                      value={checkOut}
                      onChange={e => setCheckOut(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-amber-600" />
                      Nombre de personnes
                    </Label>
                    <Select value={guests} onValueChange={setGuests}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 personne</SelectItem>
                        <SelectItem value="2">2 personnes</SelectItem>
                        <SelectItem value="3">3 personnes</SelectItem>
                        <SelectItem value="4">4 personnes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Filtre par type */}
                <div className="space-y-2">
                  <Label>Type de chambre</Label>
                  <Select value={roomTypePref} onValueChange={setRoomTypePref}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      <SelectItem value="Single">Single</SelectItem>
                      <SelectItem value="Double">Double</SelectItem>
                      <SelectItem value="Suite">Suite</SelectItem>
                      <SelectItem value="Triple">Triple</SelectItem>
                      <SelectItem value="Familiale">Familiale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* ─── Résultats de disponibilité ──────────────────────── */}
            {searching && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                <span className="ml-3 text-muted-foreground">Recherche en cours...</span>
              </div>
            )}

            {!searching && hasSearched && availableRooms.length === 0 && (
              <Card className="border-amber-200 rounded-2xl">
                <CardContent className="p-8 text-center">
                  <Bed className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-semibold text-gray-700">Aucune chambre disponible</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Essayez d&apos;autres dates ou un autre type de chambre.
                  </p>
                </CardContent>
              </Card>
            )}

            {!searching && availableRooms.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Bed className="h-5 w-5 text-amber-600" />
                  Chambres disponibles
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                    {availableRooms.length} trouvée{availableRooms.length > 1 ? 's' : ''}
                  </Badge>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {availableRooms.map(room => (
                    <Card
                      key={room.id}
                      className={`cursor-pointer transition-all duration-300 rounded-2xl hover:shadow-lg hover:-translate-y-0.5 ${
                        selectedRoom === room.id
                          ? 'border-2 border-amber-400 shadow-lg ring-2 ring-amber-200 bg-gradient-to-br from-amber-50/50 to-white'
                          : 'border border-gray-200 hover:border-amber-300 bg-white'
                      }`}
                      onClick={() => setSelectedRoom(room.id)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg font-bold text-gray-900">Chambre {room.room_number}</span>
                              <Badge variant="outline" className="text-xs bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 text-amber-700">{getRoomTypeLabel(room.room_type)}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formatFCFA(room.price_per_night)} / nuit
                              {room.weekend_price ? (
                                <span className="text-amber-600 ml-1">({formatFCFA(room.weekend_price)} we)</span>
                              ) : null}
                            </p>
                          </div>
                          {selectedRoom === room.id ? (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shrink-0 shadow-md">
                              <Check className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                              <span className="text-xs font-bold">✓</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Total ({nights} nuit{nights > 1 ? 's' : ''})
                          </span>
                          <span className="text-lg font-bold text-amber-700">
                            {formatFCFA(room.total_price)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Informations client ─────────────────────────────── */}
            {selectedRoom && (
              <Card className="border-amber-200 shadow-md rounded-2xl">
                <CardHeader className="pb-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-2xl">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-amber-600" />
                    Vos Informations
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 sm:p-6">
                  <form onSubmit={handleReservation} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bk-firstname">Prénom *</Label>
                        <Input
                          id="bk-firstname"
                          placeholder="Amadou"
                          value={firstName}
                          onChange={e => setFirstName(e.target.value)}
                          required
                          minLength={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bk-lastname">Nom *</Label>
                        <Input
                          id="bk-lastname"
                          placeholder="Koné"
                          value={lastName}
                          onChange={e => setLastName(e.target.value)}
                          required
                          minLength={2}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bk-phone">Téléphone (+225) *</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="bk-phone"
                            placeholder="07 08 09 10 11"
                            className="pl-9"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            required
                            minLength={8}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bk-email">Email (optionnel)</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="bk-email"
                            type="email"
                            placeholder="amadou.kone@email.com"
                            className="pl-9"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bk-requests">Demandes spéciales (optionnel)</Label>
                      <Textarea
                        id="bk-requests"
                        placeholder="Arrivée tardive, lit bébé, etc."
                        rows={2}
                        value={specialRequests}
                        onChange={e => setSpecialRequests(e.target.value)}
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/30 h-12 text-base transition-all duration-300"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          Envoi en cours...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-5 w-5 mr-2" />
                          Confirmer la Réservation
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ─── Récapitulatif latéral ──────────────────────────────── */}
          <div className="lg:col-span-1">
            <Card className="border-amber-200 shadow-md sticky top-24 rounded-2xl">
              <CardHeader className="pb-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-2xl">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-amber-600" />
                  Récapitulatif
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {!selectedHotel && !checkIn && !checkOut && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sélectionnez vos dates pour voir les disponibilités
                  </p>
                )}

                {/* Hôtel sélectionné */}
                {selectedHotel && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <Building2 className="h-5 w-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Hôtel</p>
                      <p className="text-sm font-semibold">{hotels.find(h => h.id === selectedHotel)?.name || 'Sélectionné'}</p>
                    </div>
                  </div>
                )}

                {/* Dates */}
                {checkIn && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <CalendarDays className="h-5 w-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Arrivée</p>
                      <p className="text-sm font-semibold">{new Date(checkIn).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                )}
                {checkOut && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <CalendarDays className="h-5 w-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Départ</p>
                      <p className="text-sm font-semibold">{new Date(checkOut).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                )}

                {/* Nuits */}
                {nights > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <Users className="h-5 w-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Durée</p>
                      <p className="text-sm font-semibold">{nights} nuit{nights > 1 ? 's' : ''} — {guests} personne{parseInt(guests) > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                )}

                {/* Chambre sélectionnée */}
                {selectedRoomData && (
                  <>
                    <div className="border-t border-amber-200 pt-4">
                      <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
                        <Bed className="h-5 w-5 text-amber-600 shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Chambre</p>
                          <p className="text-sm font-semibold">{selectedRoomData.room_number} — {getRoomTypeLabel(selectedRoomData.room_type)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-amber-200 pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Prix total</span>
                        <span className="text-2xl font-bold text-amber-700">{formatFCFA(selectedRoomData.total_price)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Tarification dynamique appliquée (weekend & saisons)
                      </p>
                    </div>
                  </>
                )}

                {/* Aide */}
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-emerald-500" />
                    Réservation sécurisée
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-amber-500" />
                    Confirmation par téléphone
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-amber-500" />
                    Confirmation par email
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Main Landing Page ─────────────────────────────────────────────────────

export function LandingPage({ onLogin, onRegister, onDemo }: LandingPageProps) {
  const [leadDialogOpen, setLeadDialogOpen] = useState(false)

  function scrollToBooking() {
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-amber-100/80 bg-white/90 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo.svg"
              alt="OGOU_Hôtel"
              height={36}
              width={36}
              className="object-contain animate-float"
              priority
            />
            <span className="text-xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent">OGOU</span>
              <span className="text-gray-800">_Hôtel</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a href="#features" className="text-gray-600 hover:text-amber-700 transition-colors duration-300">Fonctionnalités</a>
            <a href="#booking" className="text-gray-600 hover:text-amber-700 transition-colors duration-300">Réserver</a>
            <a href="#pricing" className="text-gray-600 hover:text-amber-700 transition-colors duration-300">Tarifs</a>
            <a href="#testimonials" className="text-gray-600 hover:text-amber-700 transition-colors duration-300">Témoignages</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-amber-200 text-amber-700 hover:bg-amber-50 hidden sm:inline-flex transition-all duration-300" onClick={onLogin}>
              Connexion
            </Button>
            <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md transition-all duration-300" onClick={onRegister}>
              S&apos;inscrire
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,158,11,0.15),rgba(255,255,255,0))]" />

        {/* Decorative geometric shapes */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-amber-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-orange-200/20 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-32 h-32 bg-emerald-200/15 rounded-full blur-2xl" />

        {/* Dot pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle, #92400e 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
          <div className="flex flex-col items-center text-center gap-8">
            {/* Badge */}
            <Badge className="bg-amber-100/80 text-amber-800 border-amber-200 hover:bg-amber-100 px-4 py-1.5 text-sm font-medium backdrop-blur-sm animate-fade-in-up">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Application de Gestion Hôtelière N° 1 en Côte d&apos;Ivoire
            </Badge>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 max-w-5xl leading-[1.08] animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              Simplifiez la gestion de votre{' '}
              <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-clip-text text-transparent">
                hôtel en Côte d&apos;Ivoire
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              Réservations, chambres, restaurant, stocks, salles de conférence — tout dans une seule application.
              Temps réel, mobile, sécurisé. Conçu pour les hôtels ivoiriens.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Button
                size="lg"
                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/30 text-base px-8 h-13 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/40 animate-pulse-glow"
                onClick={() => setLeadDialogOpen(true)}
              >
                Demander une Démo
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 text-base px-8 h-13 transition-all duration-300"
                onClick={scrollToBooking}
              >
                <CalendarDays className="h-5 w-5 mr-2" />
                Réserver en Ligne
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 text-base px-8 h-13 transition-all duration-300"
                onClick={onRegister}
              >
                <Key className="h-5 w-5 mr-2" />
                S&apos;inscrire avec un Code
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-4 text-sm text-gray-500 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <span className="flex items-center gap-1.5 bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-100">
                <Shield className="h-4 w-4 text-emerald-500" />
                Données sécurisées (RLS)
              </span>
              <span className="flex items-center gap-1.5 bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-100">
                <Zap className="h-4 w-4 text-amber-500" />
                Temps réel
              </span>
              <span className="flex items-center gap-1.5 bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-100">
                <Smartphone className="h-4 w-4 text-amber-500" />
                Interface mobile staff
              </span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="h-6 w-6 text-amber-400" />
        </div>
      </section>

      {/* ─── Features Section ───────────────────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 sm:mb-18">
            <Badge variant="outline" className="mb-4 text-amber-700 border-amber-200 bg-amber-50/50">Fonctionnalités</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              Tout ce dont votre hôtel a besoin
            </h2>
            <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
              Une suite complète de modules conçus spécifiquement pour l&apos;hôtellerie ivoirienne
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {FEATURES.map((feature, index) => (
              <Card
                key={feature.title}
                className={`group border border-gray-100 hover:border-amber-200 hover:shadow-xl ${feature.glowColor} hover:-translate-y-1 transition-all duration-300 bg-white rounded-2xl animate-fade-in-up`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-6">
                  <div className={`inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br ${feature.color} text-white mb-4 shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-amber-700 transition-colors duration-300">{feature.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Booking Section ────────────────────────────────────────────────── */}
      <BookingSection />

      {/* ─── Pricing Section ───────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 sm:py-28 bg-gradient-to-b from-amber-50/60 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 sm:mb-18">
            <Badge variant="outline" className="mb-4 text-amber-700 border-amber-200 bg-amber-50/50">Tarifs</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              Des tarifs adaptés à chaque établissement
            </h2>
            <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
              Pas de frais cachés. Prix en FCFA, facturation annuelle transparente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {PLANS.map((plan) => (
              <Card
                key={plan.name}
                className={`relative overflow-hidden border-2 ${plan.borderColor} ${plan.highlight ? 'scale-[1.02] sm:scale-105 shadow-xl ring-2 ring-amber-400/30' : 'shadow-md'} transition-all duration-300 hover:shadow-xl rounded-2xl hover:-translate-y-1`}
              >
                {plan.highlight && (
                  <div className="absolute top-0 right-0 z-10">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold px-5 py-1.5 rounded-bl-xl shadow-md">
                      ⭐ POPULAIRE
                    </div>
                  </div>
                )}
                <CardHeader className={`pb-4 bg-gradient-to-br ${plan.gradient} rounded-t-2xl`}>
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
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 mt-0.5 shrink-0">
                          <Check className="h-3 w-3 text-emerald-600" />
                        </div>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full transition-all duration-300 ${plan.buttonClass}`}
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
      <section id="testimonials" className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 sm:mb-18">
            <Badge variant="outline" className="mb-4 text-amber-700 border-amber-200 bg-amber-50/50">Témoignages</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              Ils nous font confiance
            </h2>
            <p className="mt-3 text-lg text-gray-600">
              Des hôteliers satisfaits partout en Côte d&apos;Ivoire
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {TESTIMONIALS.map((testimonial) => (
              <Card key={testimonial.name} className="border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 rounded-2xl bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-4 italic">&ldquo;{testimonial.text}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-sm font-bold shadow-md">
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
      <section className="relative py-20 sm:py-28 bg-gradient-to-r from-amber-500 to-orange-600 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Prêt à transformer votre gestion hôtelière ?
          </h2>
          <p className="text-lg text-amber-100 mb-8 max-w-2xl mx-auto">
            Rejoignez les hôtels ivoiriens qui utilisent déjà OGOU_Hôtel pour optimiser leurs opérations au quotidien.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-white text-amber-700 hover:bg-amber-50 shadow-lg text-base px-8 h-13 transition-all duration-300 hover:shadow-xl"
              onClick={() => setLeadDialogOpen(true)}
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              Demander une Démo Gratuite
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto border-white/30 text-white hover:bg-white/10 text-base px-8 h-13 transition-all duration-300"
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <Image
                  src="/logo.svg"
                  alt="OGOU_Hôtel"
                  height={36}
                  width={36}
                  className="object-contain"
                />
                <span className="text-xl font-bold">
                  <span className="bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">OGOU</span>
                  <span className="text-white">_Hôtel</span>
                </span>
              </div>
              <p className="text-sm leading-relaxed max-w-sm">
                La plateforme de gestion hôtelière multi-tenant conçue pour les établissements de Côte d&apos;Ivoire.
                Simple, sécurisée, mobile.
              </p>
              {/* Social links */}
              <div className="flex items-center gap-3 mt-5">
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:bg-amber-600 hover:text-white transition-all duration-300"
                  aria-label="Facebook"
                >
                  <Facebook className="h-4 w-4" />
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:bg-amber-600 hover:text-white transition-all duration-300"
                  aria-label="Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:bg-amber-600 hover:text-white transition-all duration-300"
                  aria-label="Twitter"
                >
                  <Twitter className="h-4 w-4" />
                </a>
                <a
                  href="mailto:omouitsi@gmail.com"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:bg-amber-600 hover:text-white transition-all duration-300"
                  aria-label="Email"
                >
                  <Mail className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Produit</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#features" className="hover:text-amber-400 transition-colors duration-300">Fonctionnalités</a></li>
                <li><a href="#booking" className="hover:text-amber-400 transition-colors duration-300">Réserver en Ligne</a></li>
                <li><a href="#pricing" className="hover:text-amber-400 transition-colors duration-300">Tarifs</a></li>
                <li><a href="#testimonials" className="hover:text-amber-400 transition-colors duration-300">Témoignages</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Contact</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-amber-500" />
                  <a href="tel:+2250576103277" className="hover:text-amber-400 transition-colors duration-300">+225 05 76 10 32 77</a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-amber-500" />
                  <a href="mailto:omouitsi@gmail.com" className="hover:text-amber-400 transition-colors duration-300">omouitsi@gmail.com</a>
                </li>
                <li className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-amber-500" />
                  Abidjan, Côte d&apos;Ivoire
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} OGOU_Hôtel. Tous droits réservés.</p>
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
