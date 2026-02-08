// components/SendBookingEmailButton.tsx
'use client'

import { useState } from 'react'
import { Mail, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface SendBookingEmailButtonProps {
  bookingId: string
  customerEmail?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  className?: string
  onSuccess?: () => void
}

export default function SendBookingEmailButton({
  bookingId,
  customerEmail,
  variant = 'outline',
  size = 'sm',
  className = '',
  onSuccess
}: SendBookingEmailButtonProps) {
  const [sending, setSending] = useState(false)

  async function handleSendEmail() {
    if (!customerEmail) {
      toast.error('Email cliente non disponibile')
      return
    }

    const confirmed = confirm(
      `Inviare email di conferma a:\n${customerEmail}?`
    )
    
    if (!confirmed) return

    try {
      setSending(true)

      const response = await fetch(`/api/bookings/${bookingId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Errore invio email')
      }

      toast.success('✅ Email inviata con successo!')
      onSuccess?.()
    } catch (error: any) {
      console.error('Errore invio email:', error)
      toast.error(error.message || 'Errore invio email')
    } finally {
      setSending(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSendEmail}
      disabled={sending || !customerEmail}
      className={`gap-2 ${className}`}
    >
      {sending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Invio...
        </>
      ) : (
        <>
          <Mail className="h-4 w-4" />
          Invia Email
        </>
      )}
    </Button>
  )
}