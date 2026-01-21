// lib/pdf-generator.ts
// Generatore PDF per report NS3000 con intestazione NS3000Rent Srl

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MonthlyBreakdown {
  month: string;
  bookings: number;
  revenue: number;
  commission: number;
  booking_details: BookingDetail[];
}

interface BookingDetail {
  id: string;
  booking_number: string;
  booking_date: string;
  final_price: number;
}

interface SupplierInfo {
  id: string;
  name: string;
  email: string | null;
  commission_percentage: number;
}

// Funzione per aggiungere l'intestazione NS3000Rent Srl
function addHeader(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header blu corporate
  doc.setFillColor(41, 128, 185);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  // Logo/Nome azienda
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('NS3000Rent Srl', 15, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema di Gestione Noleggi', 15, 28);
  
  // Data di generazione
  const today = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  doc.setFontSize(9);
  doc.text(`Generato il: ${today}`, pageWidth - 15, 25, { align: 'right' });
  
  // Reset colore testo
  doc.setTextColor(0, 0, 0);
}

// Funzione per aggiungere il footer
function addFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = (doc as any).internal.getNumberOfPages();
  const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
  
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    'NS3000Rent Srl - Sistema di Gestione Noleggi',
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );
  
  doc.text(
    `Pagina ${currentPage} di ${pageCount}`,
    pageWidth - 15,
    pageHeight - 10,
    { align: 'right' }
  );
}

// Funzione per ottenere il nome del mese in italiano
function getMonthName(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

// Genera PDF report mensile fornitore
export function generateMonthlySupplierReport(
  supplier: SupplierInfo,
  monthData: MonthlyBreakdown,
  year: string
) {
  const doc = new jsPDF();
  
  // Intestazione
  addHeader(doc);
  
  let yPosition = 50;
  
  // Titolo report
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Report Mensile Fornitore', 15, yPosition);
  
  yPosition += 10;
  
  // Informazioni fornitore
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Fornitore: ${supplier.name}`, 15, yPosition);
  yPosition += 6;
  
  if (supplier.email) {
    doc.text(`Email: ${supplier.email}`, 15, yPosition);
    yPosition += 6;
  }
  
  doc.text(`Periodo: ${getMonthName(monthData.month)}`, 15, yPosition);
  yPosition += 6;
  
  doc.text(`Percentuale provvigione: ${supplier.commission_percentage}%`, 15, yPosition);
  yPosition += 12;
  
  // Box riepilogo
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(240, 240, 240);
  doc.rect(15, yPosition, pageWidth - 30, 35, 'F');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Riepilogo Mensile', 20, yPosition + 8);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Numero prenotazioni: ${monthData.bookings}`, 20, yPosition + 16);
  doc.text(
    `Fatturato totale: ${new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(monthData.revenue)}`,
    20,
    yPosition + 23
  );
  doc.text(
    `Provvigioni totali: ${new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(monthData.commission)}`,
    20,
    yPosition + 30
  );
  
  yPosition += 45;
  
  // Tabella dettaglio prenotazioni
  if (monthData.booking_details && monthData.booking_details.length > 0) {
    const tableColumn = ['N. Prenotazione', 'Data', 'Importo'];
    const tableRows = monthData.booking_details.map(b => [
      b.booking_number,
      new Date(b.booking_date).toLocaleDateString('it-IT'),
      new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
      }).format(b.final_price)
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { left: 15, right: 15 },
      didDrawPage: () => {
        addFooter(doc);
      }
    });
  } else {
    addFooter(doc);
  }
  
  // Salva il PDF
  const fileName = `Report_${supplier.name.replace(/\s+/g, '_')}_${monthData.month}.pdf`;
  doc.save(fileName);
}

// Genera PDF report annuale fornitore
export function generateAnnualSupplierReport(
  supplier: SupplierInfo,
  year: string,
  totalBookings: number,
  totalRevenue: number,
  totalCommission: number,
  monthlyData: MonthlyBreakdown[]
) {
  const doc = new jsPDF();
  
  // Intestazione
  addHeader(doc);
  
  let yPosition = 50;
  
  // Titolo report
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Report Annuale Fornitore', 15, yPosition);
  
  yPosition += 10;
  
  // Informazioni fornitore
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Fornitore: ${supplier.name}`, 15, yPosition);
  yPosition += 6;
  
  if (supplier.email) {
    doc.text(`Email: ${supplier.email}`, 15, yPosition);
    yPosition += 6;
  }
  
  doc.text(`Anno: ${year}`, 15, yPosition);
  yPosition += 6;
  
  doc.text(`Percentuale provvigione: ${supplier.commission_percentage}%`, 15, yPosition);
  yPosition += 12;
  
  // Box riepilogo annuale
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(240, 240, 240);
  doc.rect(15, yPosition, pageWidth - 30, 35, 'F');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Riepilogo Annuale', 20, yPosition + 8);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Prenotazioni totali: ${totalBookings}`, 20, yPosition + 16);
  doc.text(
    `Fatturato totale: ${new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(totalRevenue)}`,
    20,
    yPosition + 23
  );
  doc.text(
    `Provvigioni totali: ${new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(totalCommission)}`,
    20,
    yPosition + 30
  );
  
  yPosition += 45;
  
  // Tabella breakdown mensile
  if (monthlyData && monthlyData.length > 0) {
    const tableColumn = ['Mese', 'Prenotazioni', 'Fatturato', 'Provvigioni'];
    const tableRows = monthlyData.map(m => [
      getMonthName(m.month),
      m.bookings.toString(),
      new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
      }).format(m.revenue),
      new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
      }).format(m.commission)
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { left: 15, right: 15 },
      didDrawPage: () => {
        addFooter(doc);
      }
    });
  } else {
    addFooter(doc);
  }
  
  // Salva il PDF
  const fileName = `Report_Annuale_${supplier.name.replace(/\s+/g, '_')}_${year}.pdf`;
  doc.save(fileName);
}

// Genera PDF riepilogo tutti i fornitori
export function generateAllSuppliersReport(
  year: string,
  suppliersData: Array<{
    supplier: SupplierInfo;
    total_bookings: number;
    total_revenue: number;
    total_commission: number;
  }>
) {
  const doc = new jsPDF();
  
  // Intestazione
  addHeader(doc);
  
  let yPosition = 50;
  
  // Titolo report
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Riepilogo Fornitori', 15, yPosition);
  
  yPosition += 10;
  
  // Anno
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Anno: ${year}`, 15, yPosition);
  yPosition += 12;
  
  // Calcolo totali
  const grandTotalBookings = suppliersData.reduce((sum, s) => sum + s.total_bookings, 0);
  const grandTotalRevenue = suppliersData.reduce((sum, s) => sum + s.total_revenue, 0);
  const grandTotalCommission = suppliersData.reduce((sum, s) => sum + s.total_commission, 0);
  
  // Box riepilogo generale
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(240, 240, 240);
  doc.rect(15, yPosition, pageWidth - 30, 35, 'F');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Totali Generali', 20, yPosition + 8);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Prenotazioni totali: ${grandTotalBookings}`, 20, yPosition + 16);
  doc.text(
    `Fatturato totale: ${new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(grandTotalRevenue)}`,
    20,
    yPosition + 23
  );
  doc.text(
    `Provvigioni totali: ${new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(grandTotalCommission)}`,
    20,
    yPosition + 30
  );
  
  yPosition += 45;
  
  // Tabella fornitori
  if (suppliersData && suppliersData.length > 0) {
    const tableColumn = ['Fornitore', '%', 'Prenotazioni', 'Fatturato', 'Provvigioni'];
    const tableRows = suppliersData.map(s => [
      s.supplier.name,
      `${s.supplier.commission_percentage}%`,
      s.total_bookings.toString(),
      new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
      }).format(s.total_revenue),
      new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
      }).format(s.total_commission)
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { left: 15, right: 15 },
      didDrawPage: () => {
        addFooter(doc);
      }
    });
  } else {
    addFooter(doc);
  }
  
  // Salva il PDF
  const fileName = `Riepilogo_Fornitori_${year}.pdf`;
  doc.save(fileName);
}
