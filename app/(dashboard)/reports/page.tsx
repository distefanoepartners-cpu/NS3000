'use client'

import { useEffect, useState } from 'react'
import { Download, Mail, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { 
  generateMonthlySupplierReport, 
  generateAnnualSupplierReport,
  generateAllSuppliersReport 
} from '@/lib/pdf-generator'

type SupplierSummary = {
  supplier: {
    id: string
    name: string
    email: string | null
    commission_percentage: number
  }
  year: string
  total_bookings: number
  total_revenue: number
  total_commission: number
  monthly: MonthlyBreakdown[]
}

type MonthlyBreakdown = {
  month: string
  bookings: number
  revenue: number
  commission: number
  booking_details: BookingDetail[]
}

type BookingDetail = {
  id: string
  booking_number: string
  booking_date: string
  final_price: number
}

type Supplier = {
  id: string
  name: string
  email: string | null
  commission_percentage: number
}

export default function ReportsPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [summary, setSummary] = useState<SupplierSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMonths, setExpandedMonths] = useState<{[key: string]: boolean}>({})

  useEffect(() => {
    loadSuppliers()
  }, [])

  useEffect(() => {
    if (selectedYear) {
      loadSummary()
    }
  }, [selectedSupplierId, selectedYear])

  async function loadSuppliers() {
    try {
      const res = await fetch('/api/suppliers')
      const data = await res.json()
      setSuppliers(data.filter((s: any) => s.is_active))
    } catch (error) {
      console.error('Error loading suppliers:', error)
    }
  }

  async function loadSummary() {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        year: selectedYear
      })
      if (selectedSupplierId) {
        params.append('supplier_id', selectedSupplierId)
      }
      
      const res = await fetch(`/api/reports/suppliers-summary?${params}`)
      const data = await res.json()
      setSummary(data)
    } catch (error) {
      console.error('Error loading summary:', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleMonth(supplierId: string, month: string) {
    const key = `${supplierId}-${month}`
    setExpandedMonths(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  function getMonthName(monthStr: string) {
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  }

  function downloadMonthReport(supplierSummary: SupplierSummary, monthData: MonthlyBreakdown) {
    const lines = [
      `REPORT MENSILE - ${supplierSummary.supplier.name}`,
      `Mese: ${getMonthName(monthData.month)}`,
      ``,
      `RIEPILOGO:`,
      `Prenotazioni: ${monthData.bookings}`,
      `Fatturato: €${monthData.revenue.toFixed(2)}`,
      `Provvigioni (${supplierSummary.supplier.commission_percentage}%): €${monthData.commission.toFixed(2)}`,
      ``,
      `DETTAGLIO PRENOTAZIONI:`,
      ``,
      ...monthData.booking_details.map(b => 
        `${b.booking_number} - ${new Date(b.booking_date).toLocaleDateString('it-IT')} - €${b.final_price.toFixed(2)}`
      )
    ]
    
    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${supplierSummary.supplier.name.replace(/\s+/g, '-')}-${monthData.month}.txt`
    a.click()
  }

  function downloadMonthReportPDF(supplierSummary: SupplierSummary, monthData: MonthlyBreakdown) {
    generateMonthlySupplierReport(
      supplierSummary.supplier,
      monthData,
      supplierSummary.year
    )
  }

  function downloadAnnualReportPDF(supplierSummary: SupplierSummary) {
    generateAnnualSupplierReport(
      supplierSummary.supplier,
      supplierSummary.year,
      supplierSummary.total_bookings,
      supplierSummary.total_revenue,
      supplierSummary.total_commission,
      supplierSummary.monthly
    )
  }

  function downloadAllSuppliersPDF() {
    const suppliersData = summary.map(s => ({
      supplier: s.supplier,
      total_bookings: s.total_bookings,
      total_revenue: s.total_revenue,
      total_commission: s.total_commission
    }))
    
    generateAllSuppliersReport(selectedYear, suppliersData)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">📊 Report Fornitori</h1>
        <p className="text-sm text-gray-600">Riepilogo provvigioni e fatturato</p>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fornitore</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Tutti i fornitori</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.commission_percentage}%)
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anno</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>
        </div>
        
        {/* Pulsante download riepilogo generale */}
        {!selectedSupplierId && summary.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <button
              onClick={downloadAllSuppliersPDF}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <FileText className="w-5 h-5" />
              <span>Scarica Riepilogo PDF Tutti i Fornitori</span>
            </button>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-600">Caricamento...</div>
        </div>
      ) : summary.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-600">Nessun dato trovato per il periodo selezionato</div>
        </div>
      ) : (
        <div className="space-y-6">
          {summary.map(supplierData => (
            <div key={supplierData.supplier.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Header Fornitore */}
              <div className="bg-blue-50 p-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{supplierData.supplier.name}</h2>
                    <p className="text-sm text-gray-600">
                      Provvigioni: {supplierData.supplier.commission_percentage}%
                      {supplierData.supplier.email && ` • ${supplierData.supplier.email}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Anno {supplierData.year}</div>
                      <div className="text-2xl font-bold text-blue-600">
                        €{supplierData.total_commission.toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={() => downloadAnnualReportPDF(supplierData)}
                      className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      title="Scarica Report Annuale PDF"
                    >
                      <FileText className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Totali Anno */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 border-b">
                <div>
                  <div className="text-sm text-gray-600">Prenotazioni Totali</div>
                  <div className="text-xl font-semibold">{supplierData.total_bookings}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Fatturato Totale</div>
                  <div className="text-xl font-semibold">€{supplierData.total_revenue.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Provvigioni Totali</div>
                  <div className="text-xl font-semibold text-green-600">€{supplierData.total_commission.toFixed(2)}</div>
                </div>
              </div>

              {/* Breakdown Mensile */}
              <div className="divide-y">
                {supplierData.monthly.map(monthData => {
                  const isExpanded = expandedMonths[`${supplierData.supplier.id}-${monthData.month}`]
                  
                  return (
                    <div key={monthData.month}>
                      {/* Riga Mese */}
                      <div className="p-4 hover:bg-gray-50 cursor-pointer"
                           onClick={() => toggleMonth(supplierData.supplier.id, monthData.month)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            <div>
                              <div className="font-medium">{getMonthName(monthData.month)}</div>
                              <div className="text-sm text-gray-600">{monthData.bookings} prenotazioni</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="text-sm text-gray-600">Fatturato</div>
                              <div className="font-semibold">€{monthData.revenue.toFixed(2)}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-600">Provvigioni</div>
                              <div className="font-semibold text-green-600">€{monthData.commission.toFixed(2)}</div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  downloadMonthReportPDF(supplierData, monthData)
                                }}
                                className="p-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                title="Scarica PDF"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  downloadMonthReport(supplierData, monthData)
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Scarica TXT"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Dettaglio Prenotazioni */}
                      {isExpanded && (
                        <div className="bg-gray-50 px-4 pb-4">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="py-2 text-left">N. Prenotazione</th>
                                <th className="py-2 text-left">Data</th>
                                <th className="py-2 text-right">Importo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {monthData.booking_details.map(booking => (
                                <tr key={booking.id} className="border-b last:border-0">
                                  <td className="py-2">{booking.booking_number}</td>
                                  <td className="py-2">{new Date(booking.booking_date).toLocaleDateString('it-IT')}</td>
                                  <td className="py-2 text-right">€{booking.final_price.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
