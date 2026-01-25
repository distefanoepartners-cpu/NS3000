// types/database.ts
// Types completi per NS3000 - Dedotti dalle query SQL del progetto

// ============================================================================
// BOATS
// ============================================================================

export interface Boat {
  id: string;
  name: string;
  model: string | null;
  length: number | null;
  capacity: number | null;
  engine_power: number | null;
  has_rental: boolean;
  has_charter: boolean;
  requires_license: boolean; // ⭐ NUOVO CAMPO
  status: 'active' | 'inactive' | 'maintenance';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CUSTOMERS
// ============================================================================

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// RENTAL SERVICES
// ============================================================================

export interface RentalService {
  id: string;
  name: string;
  description: string | null;
  type: 'rental' | 'charter' | 'collective';
  base_price: number | null;
  duration_hours: number | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SKIPPERS
// ============================================================================

export interface Skipper {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  license_number: string | null;
  license_expiry_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// BOOKING STATUSES
// ============================================================================

export interface BookingStatus {
  id: string;
  name: string;
  code: 'pending' | 'option' | 'confirmed' | 'cancelled' | 'completed';
  color: string | null;
  created_at: string;
}

// ============================================================================
// PAYMENT METHODS
// ============================================================================

export interface PaymentMethod {
  id: string;
  name: string;
  code: 'stripe' | 'cash' | 'pos' | 'bank_transfer';
  created_at: string;
}

// ============================================================================
// BOOKINGS
// ============================================================================

export interface Booking {
  id: string;
  booking_number: string;
  booking_date: string;
  time_slot: 'morning' | 'afternoon' | 'evening' | 'full_day';
  num_passengers: number;
  
  // Foreign Keys
  customer_id: string;
  boat_id: string;
  service_id: string;
  skipper_id: string | null;
  booking_status_id: string;
  
  // Pricing
  final_price: number;
  deposit_amount: number;
  balance_amount: number;
  deposit_payment_method_id: string | null;
  balance_payment_method_id: string | null;
  
  // Notes
  notes: string | null;
  
  // Metadata
  created_at: string;
  updated_at: string;
  
  // Relations (quando fai .select() con join)
  customer?: Customer;
  boat?: Boat;
  service?: RentalService;
  skipper?: Skipper | null;
  booking_status?: BookingStatus;
  deposit_payment_method?: PaymentMethod | null;
  balance_payment_method?: PaymentMethod | null;
}

// ============================================================================
// DAILY BRIEFINGS
// ============================================================================

export interface DailyBriefing {
  id: string;
  date: string;
  bookings_count: number;
  total_passengers: number;
  content: any; // JSON con array di bookings arricchiti
  created_at: string;
  updated_at: string;
}

// ============================================================================
// BRIEFING CONFIRMATIONS
// ============================================================================

export interface BriefingConfirmation {
  id: string;
  briefing_id: string;
  user_id: string;
  confirmed_at: string;
}

// ============================================================================
// PUSH SUBSCRIPTIONS
// ============================================================================

export interface PushSubscription {
  id: string;
  user_id: string;
  subscription: any; // JSON con endpoint, keys, etc
  created_at: string;
  updated_at: string;
}

// ============================================================================
// USERS (Auth)
// ============================================================================

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'staff';
  created_at: string;
  updated_at: string;
}

// ============================================================================
// FORM DATA TYPES (per form input)
// ============================================================================

export interface BoatFormData {
  name: string;
  model: string;
  length: string;
  capacity: string;
  engine_power: string;
  has_rental: boolean;
  has_charter: boolean;
  requires_license: boolean; // ⭐ NUOVO CAMPO
  status: 'active' | 'inactive' | 'maintenance';
  notes: string;
}

export interface BookingFormData {
  booking_date: string;
  time_slot: string;
  num_passengers: string;
  customer_id: string;
  boat_id: string;
  service_id: string;
  skipper_id: string;
  booking_status_id: string;
  final_price: string;
  deposit_amount: string;
  balance_amount: string;
  deposit_payment_method_id: string;
  balance_payment_method_id: string;
  notes: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function boatFormDataToBoat(formData: BoatFormData): Partial<Boat> {
  return {
    name: formData.name,
    model: formData.model || null,
    length: formData.length ? parseFloat(formData.length) : null,
    capacity: formData.capacity ? parseInt(formData.capacity) : null,
    engine_power: formData.engine_power ? parseFloat(formData.engine_power) : null,
    has_rental: formData.has_rental,
    has_charter: formData.has_charter,
    requires_license: formData.requires_license, // ⭐ CONVERSIONE
    status: formData.status,
    notes: formData.notes || null,
  };
}

export function boatToFormData(boat: Boat): BoatFormData {
  return {
    name: boat.name,
    model: boat.model || '',
    length: boat.length?.toString() || '',
    capacity: boat.capacity?.toString() || '',
    engine_power: boat.engine_power?.toString() || '',
    has_rental: boat.has_rental,
    has_charter: boat.has_charter,
    requires_license: boat.requires_license, // ⭐ CONVERSIONE
    status: boat.status,
    notes: boat.notes || '',
  };
}

export function bookingFormDataToBooking(formData: BookingFormData): Partial<Booking> {
  return {
    booking_date: formData.booking_date,
    time_slot: formData.time_slot as Booking['time_slot'],
    num_passengers: parseInt(formData.num_passengers),
    customer_id: formData.customer_id,
    boat_id: formData.boat_id,
    service_id: formData.service_id,
    skipper_id: formData.skipper_id || null,
    booking_status_id: formData.booking_status_id,
    final_price: parseFloat(formData.final_price) || 0,
    deposit_amount: parseFloat(formData.deposit_amount) || 0,
    balance_amount: parseFloat(formData.balance_amount) || 0,
    deposit_payment_method_id: formData.deposit_payment_method_id || null,
    balance_payment_method_id: formData.balance_payment_method_id || null,
    notes: formData.notes || null,
  };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateBoat(boat: Partial<Boat>): string[] {
  const errors: string[] = [];

  if (!boat.name || boat.name.trim() === '') {
    errors.push('Il nome dell\'imbarcazione è obbligatorio');
  }

  if (!boat.has_rental && !boat.has_charter) {
    errors.push('Seleziona almeno un servizio disponibile (Locazione o Charter)');
  }

  // ⭐ VALIDAZIONE: requires_license può essere true solo se has_rental è true
  if (boat.requires_license && !boat.has_rental) {
    errors.push('Il requisito patente nautica può essere applicato solo a imbarcazioni con locazione abilitata');
  }

  if (boat.capacity && boat.capacity < 1) {
    errors.push('La capacità deve essere almeno 1 passeggero');
  }

  if (boat.length && boat.length < 0) {
    errors.push('La lunghezza deve essere un valore positivo');
  }

  if (boat.engine_power && boat.engine_power < 0) {
    errors.push('La potenza motore deve essere un valore positivo');
  }

  return errors;
}

export function validateBooking(booking: Partial<Booking>): string[] {
  const errors: string[] = [];

  if (!booking.booking_date) {
    errors.push('La data è obbligatoria');
  }

  if (!booking.customer_id) {
    errors.push('Il cliente è obbligatorio');
  }

  if (!booking.boat_id) {
    errors.push('La barca è obbligatoria');
  }

  if (!booking.service_id) {
    errors.push('Il servizio è obbligatorio');
  }

  if (!booking.num_passengers || booking.num_passengers < 1) {
    errors.push('Il numero di passeggeri deve essere almeno 1');
  }

  return errors;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'full_day';
export type BookingStatusCode = 'pending' | 'option' | 'confirmed' | 'cancelled' | 'completed';
export type PaymentMethodCode = 'stripe' | 'cash' | 'pos' | 'bank_transfer';
export type BoatStatus = 'active' | 'inactive' | 'maintenance';
export type UserRole = 'admin' | 'staff';

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface BookingStats {
  totale_prenotazioni: number;
  totale_incassato: number;
  totale_da_incassare: number;
  ricavi_oggi: number;
  ricavi_settimana: number;
  ricavi_mese: number;
  prenotazioni_confermate: number;
}