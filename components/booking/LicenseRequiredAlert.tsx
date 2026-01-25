// components/booking/LicenseRequiredAlert.tsx
// Componente Alert per Patente Nautica Richiesta

'use client';

interface LicenseRequiredAlertProps {
  boatName: string;
  className?: string;
}

export function LicenseRequiredAlert({ boatName, className = '' }: LicenseRequiredAlertProps) {
  return (
    <div className={`p-4 bg-amber-50 border-l-4 border-amber-400 rounded-lg ${className}`}>
      <div className="flex items-start gap-3">
        {/* Icona Warning */}
        <div className="flex-shrink-0">
          <svg 
            className="w-6 h-6 text-amber-600" 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path 
              fillRule="evenodd" 
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
              clipRule="evenodd"
            />
          </svg>
        </div>

        {/* Contenuto */}
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"/>
            </svg>
            Patente Nautica Richiesta
          </h4>
          
          <div className="mt-2 space-y-2 text-sm text-amber-800">
            <p>
              L'imbarcazione <strong className="font-semibold">{boatName}</strong> richiede 
              patente nautica valida per la locazione.
            </p>
            
            <div className="space-y-1">
              <p className="font-medium">Il cliente deve essere in possesso di:</p>
              <ul className="ml-4 space-y-1 list-disc list-inside">
                <li>Patente nautica in corso di validità</li>
                <li>Documento d'identità valido</li>
                <li>Eventuali ulteriori documenti richiesti dalla normativa vigente</li>
              </ul>
            </div>

            <div className="mt-3 p-3 bg-amber-100 rounded border border-amber-300">
              <p className="text-xs font-medium text-amber-900">
                ⚠️ Importante: Verificare la documentazione del cliente prima della partenza.
                La mancanza di patente valida impedisce la consegna dell'imbarcazione.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}