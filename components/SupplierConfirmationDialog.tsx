'use client'

/**
 * SupplierConfirmationDialog
 * --------------------------
 * Dialog modale di conferma per prenotazioni attribuite a un fornitore esterno.
 *
 * Storia:
 *   Introdotto il 04/05/2026 in seguito al bug operativo della prenotazione
 *   NS20260503-0275 — creata manualmente al desk NS3000 ma erroneamente
 *   attribuita al supplier "Blu Alliance" (probabilmente per inheritance di
 *   stato da uno pseudo-booking di un collettivo BA). L'errore è transitato
 *   al DB perché il supplier dropdown era nascosto al momento del salvataggio
 *   (canale != 'supplier') ma `formData.supplier_id` era ancora valorizzato.
 *
 * Scopo:
 *   Forzare un check di consapevolezza dell'operatore quando una NUOVA
 *   prenotazione viene salvata con un `supplier_id`. Il dialog mostra:
 *     - nome del fornitore
 *     - canale (booking_source) selezionato
 *     - calcolo provvigione lordo/netto (se la % è configurata)
 *     - checklist di verifica prima della conferma
 */

interface SupplierConfirmationDialogProps {
  isOpen: boolean
  supplierName: string
  bookingSource: string
  commissionPercentage?: number | null
  finalPrice?: number | null
  isCommissionConfigured: boolean
  onConfirm: () => void
  onCancel: () => void
}

const CHANNEL_LABELS: Record<string, string> = {
  supplier: '🤝 Fornitori',
  blualliance: '⚓ Blu Alliance (sync)',
  in_person: '🏢 NS3000 (desk)',
  online: '🌐 Online',
}

export default function SupplierConfirmationDialog({
  isOpen,
  supplierName,
  bookingSource,
  commissionPercentage,
  finalPrice,
  isCommissionConfigured,
  onConfirm,
  onCancel,
}: SupplierConfirmationDialogProps) {
  if (!isOpen) return null

  const pct = commissionPercentage || 0
  const price = finalPrice || 0
  const commissionAmount = (price * pct) / 100
  const netAmount = price - commissionAmount
  const channelLabel = CHANNEL_LABELS[bookingSource] || bookingSource || '—'

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="supplier-confirm-title"
    >
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b bg-amber-50 rounded-t-xl">
          <h3
            id="supplier-confirm-title"
            className="text-lg font-bold text-amber-900 flex items-center gap-2"
          >
            ⚠️ Conferma attribuzione fornitore
          </h3>
          <p className="text-xs text-amber-700 mt-1">
            Stai salvando una prenotazione attribuita a un fornitore esterno.
            Verifica i dati prima di procedere.
          </p>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Riepilogo attribuzione */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Fornitore:</span>
              <span className="font-bold text-blue-900 text-sm">
                {supplierName}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Canale:</span>
              <span className="font-medium text-gray-900 text-sm">
                {channelLabel}
              </span>
            </div>
          </div>

          {/* Calcolo provvigione (se configurata) */}
          {isCommissionConfigured && price > 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Importo lordo cliente:</span>
                <span className="font-medium text-gray-900">
                  €{price.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Provvigione {supplierName} ({pct.toFixed(2)}%):
                </span>
                <span className="font-medium text-amber-700">
                  −€{commissionAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-gray-300">
                <span className="font-semibold text-gray-700">
                  Netto da incassare:
                </span>
                <span className="font-bold text-green-700">
                  €{netAmount.toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-xs text-yellow-800">
              ℹ️ Nessuna percentuale di provvigione configurata per questo
              fornitore. Le commissioni dovranno essere gestite manualmente.
            </div>
          )}

          {/* Checklist di verifica */}
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-900 mb-2">
              Verifica prima di confermare:
            </p>
            <ul className="space-y-1.5 text-xs text-amber-800">
              <li>
                ✅ Il cliente è arrivato realmente tramite{' '}
                <b>{supplierName}</b>?
              </li>
              <li>
                ✅ Il pagamento sarà gestito tramite il fornitore (settlement
                separato dal flusso NS3000)?
              </li>
              <li>
                ⛔ Se è una prenotazione registrata al desk NS3000{' '}
                <b>senza fornitore</b>, clicca <b>Annulla</b> e cambia canale
                in "🏢 NS3000".
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm"
          >
            ✕ Annulla
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium text-sm"
          >
            ✓ Confermo, salva
          </button>
        </div>
      </div>
    </div>
  )
}