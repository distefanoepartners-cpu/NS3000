#!/usr/bin/env node
// verify-pdf-installation.js
// Script di verifica installazione sistema PDF NS3000

const fs = require('fs');
const path = require('path');

console.log('🔍 NS3000 - Verifica Installazione Sistema PDF v1.7.6\n');

let errors = 0;
let warnings = 0;

// Funzione helper per check file
function checkFile(filePath, required = true) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${filePath}`);
    return true;
  } else {
    if (required) {
      console.log(`❌ ${filePath} - MANCANTE (RICHIESTO)`);
      errors++;
    } else {
      console.log(`⚠️  ${filePath} - Non trovato (opzionale)`);
      warnings++;
    }
    return false;
  }
}

// Funzione helper per check contenuto file
function checkFileContent(filePath, searchString, description) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(searchString)) {
      console.log(`✅ ${description}`);
      return true;
    } else {
      console.log(`❌ ${description} - NON TROVATO`);
      errors++;
      return false;
    }
  } else {
    console.log(`❌ ${filePath} - File non esiste`);
    errors++;
    return false;
  }
}

// Funzione helper per check package
function checkPackage(packageName) {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
    );
    
    if (packageJson.dependencies && packageJson.dependencies[packageName]) {
      console.log(`✅ ${packageName} v${packageJson.dependencies[packageName]}`);
      return true;
    } else {
      console.log(`❌ ${packageName} - NON INSTALLATO`);
      errors++;
      return false;
    }
  } catch (error) {
    console.log(`❌ Errore lettura package.json: ${error.message}`);
    errors++;
    return false;
  }
}

console.log('📋 1. Verifica File Principali\n');
checkFile('lib/pdf-generator.ts', true);
checkFile('app/(dashboard)/reports/page.tsx', true);
checkFile('package.json', true);

console.log('\n📋 2. Verifica File Documentazione\n');
checkFile('CHANGELOG-PDF-v1.7.6.md', false);
checkFile('GUIDA-UTENTE-PDF.md', false);
checkFile('INTERFACCIA-REPORT-PDF.md', false);
checkFile('README-INSTALLAZIONE-PDF.md', false);

console.log('\n📦 3. Verifica Dipendenze NPM\n');
checkPackage('jspdf');
checkPackage('jspdf-autotable');

console.log('\n🔍 4. Verifica Contenuto File\n');
checkFileContent(
  'lib/pdf-generator.ts',
  'NS3000Rent Srl',
  'Intestazione NS3000Rent nel pdf-generator.ts'
);
checkFileContent(
  'lib/pdf-generator.ts',
  'generateMonthlySupplierReport',
  'Funzione generateMonthlySupplierReport'
);
checkFileContent(
  'lib/pdf-generator.ts',
  'generateAnnualSupplierReport',
  'Funzione generateAnnualSupplierReport'
);
checkFileContent(
  'lib/pdf-generator.ts',
  'generateAllSuppliersReport',
  'Funzione generateAllSuppliersReport'
);

console.log('\n🔍 5. Verifica Import in page.tsx\n');
checkFileContent(
  'app/(dashboard)/reports/page.tsx',
  "from '@/lib/pdf-generator'",
  'Import pdf-generator in page.tsx'
);
checkFileContent(
  'app/(dashboard)/reports/page.tsx',
  'FileText',
  'Import icona FileText'
);
checkFileContent(
  'app/(dashboard)/reports/page.tsx',
  'downloadMonthReportPDF',
  'Funzione downloadMonthReportPDF'
);
checkFileContent(
  'app/(dashboard)/reports/page.tsx',
  'downloadAnnualReportPDF',
  'Funzione downloadAnnualReportPDF'
);
checkFileContent(
  'app/(dashboard)/reports/page.tsx',
  'downloadAllSuppliersPDF',
  'Funzione downloadAllSuppliersPDF'
);

console.log('\n📊 6. Riepilogo\n');
console.log(`✅ Check passati: ${getTotalChecks() - errors - warnings}`);
console.log(`❌ Errori: ${errors}`);
console.log(`⚠️  Warning: ${warnings}`);

if (errors === 0 && warnings === 0) {
  console.log('\n✨ Installazione completa e corretta!');
  console.log('\n🚀 Prossimi passi:');
  console.log('   1. Avvia il server: npm run dev');
  console.log('   2. Vai su /reports');
  console.log('   3. Testa il download dei PDF');
  console.log('   4. Leggi GUIDA-UTENTE-PDF.md per dettagli\n');
  process.exit(0);
} else if (errors === 0) {
  console.log('\n⚠️  Installazione completata con alcuni file opzionali mancanti');
  console.log('   Il sistema funzionerà correttamente.');
  console.log('   I file mancanti sono solo documentazione.\n');
  process.exit(0);
} else {
  console.log('\n❌ Installazione incompleta!');
  console.log('\n📋 Azioni richieste:');
  if (!fs.existsSync(path.join(process.cwd(), 'lib/pdf-generator.ts'))) {
    console.log('   ❌ Crea il file lib/pdf-generator.ts');
  }
  if (!fs.existsSync(path.join(process.cwd(), 'app/(dashboard)/reports/page.tsx'))) {
    console.log('   ❌ Verifica il file app/(dashboard)/reports/page.tsx');
  }
  
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
    );
    if (!packageJson.dependencies || !packageJson.dependencies['jspdf']) {
      console.log('   ❌ Esegui: npm install jspdf jspdf-autotable');
    }
  } catch (error) {
    console.log('   ❌ Verifica package.json');
  }
  
  console.log('\n📖 Consulta README-INSTALLAZIONE-PDF.md per dettagli\n');
  process.exit(1);
}

function getTotalChecks() {
  // Conta approssimativamente i check totali eseguiti
  return 15; // Aggiorna se aggiungi/rimuovi check
}
