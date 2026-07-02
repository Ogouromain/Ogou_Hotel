/**
 * Utilitaire de calcul de prix dynamique pour OGOU_Hôtel
 * 
 * Calcule le prix total d'une réservation en tenant compte de :
 * 1. Tarifs saisonniers (priorité la plus élevée)
 * 2. Tarification weekend
 * 3. Prix standard par nuit
 */

interface RoomPricing {
  price_per_night: number
  weekend_price: number | null
  weekend_days: string // ex: "5,6" (0=Dim, 5=Ven, 6=Sam)
}

interface SeasonalRate {
  id: string
  price_per_night: number
  start_date: string
  end_date: string
  priority: number
}

/**
 * Calcule le prix total d'une réservation en appliquant la tarification dynamique.
 * Pour chaque nuit, le prix est déterminé par :
 * 1. Le tarif saisonnier avec la plus haute priorité qui couvre cette date
 * 2. Si pas de tarif saisonnier et que c'est un jour weekend → prix weekend
 * 3. Sinon → prix standard
 */
export function calculateDynamicPrice(
  room: RoomPricing,
  seasonalRates: SeasonalRate[],
  checkInDate: string, // YYYY-MM-DD
  checkOutDate: string  // YYYY-MM-DD
): number {
  const checkIn = new Date(checkInDate)
  const checkOut = new Date(checkOutDate)

  if (checkOut <= checkIn) return 0

  // Parser les jours weekend
  const weekendDaySet = new Set(
    room.weekend_days.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d))
  )

  let totalPrice = 0
  const currentDate = new Date(checkIn)

  while (currentDate < checkOut) {
    const dayOfWeek = currentDate.getDay() // 0=Dimanche, 1=Lundi, ..., 6=Samedi
    const dateStr = currentDate.toISOString().split('T')[0]

    // 1. Chercher un tarif saisonnier applicable (priorité la plus haute)
    const applicableRate = seasonalRates
      .filter(rate => dateStr >= rate.start_date && dateStr <= rate.end_date)
      .sort((a, b) => b.priority - a.priority)[0]

    if (applicableRate) {
      totalPrice += applicableRate.price_per_night
    } else if (room.weekend_price && weekendDaySet.has(dayOfWeek)) {
      // 2. Weekend pricing
      totalPrice += room.weekend_price
    } else {
      // 3. Prix standard
      totalPrice += room.price_per_night
    }

    // Passer au jour suivant
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return totalPrice
}
