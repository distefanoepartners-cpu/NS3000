#!/usr/bin/env node
// test-notifications.js
// Script di test per il sistema notifiche NS3000

console.log('🔔 Test Sistema Notifiche NS3000\n');

const fs = require('fs');
const path = require('path');

let errors = 0;
let warnings = 0;
let passes = 0;

function checkFile(filePath, required = true) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${filePath}`);
    passes++;
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

function checkEnvVar(varName, required = true) {
  require('dotenv').config({ path: '.env.local' });
  
  if (process.env[varName]) {
    console.log(`✅ ${varName} configurata`);
    passes++;
    return true;
  } else {
    if (required) {
      console.log(`❌ ${varName} - NON CONFIGURATA`);
      errors++;
    } else {
      console.log(`⚠️  ${varName} - Non configurata (opzionale)`);
      warnings++;
    }
    return false;
  }
}

function checkPackage(packageName) {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
    );
    
    if (packageJson.dependencies && packageJson.dependencies[packageName]) {
      console.log(`✅ ${packageName} installato`);
      passes++;
      return true;
    } else {
      console.log(`❌ ${packageName} - NON INSTALLATO`);
      errors++;
      return false;
    }
  } catch (error) {
    console.log(`❌ Errore lettura package.json`);
    errors++;
    return false;
  }
}

// Test 1: File Principali
console.log('📋 1. File Sistema Notifiche\n');
checkFile('lib/notifications.ts', true);
checkFile('components/NotificationManager.tsx', true);
checkFile('public/sw.js', true);
checkFile('app/api/notifications/subscribe/route.ts', true);
checkFile('app/api/notifications/send/route.ts', true);

// Test 2: File Opzionali
console.log('\n📋 2. File Documentazione\n');
checkFile('GUIDA-NOTIFICHE.md', false);
checkFile('database/notifications-schema.sql', false);
checkFile('public/sounds/README.md', false);

// Test 3: Suoni
console.log('\n📋 3. File Audio\n');
checkFile('public/sounds/alert.mp3', false);
checkFile('public/sounds/info.mp3', false);
checkFile('public/sounds/success.mp3', false);

// Test 4: Dipendenze NPM
console.log('\n📦 4. Dipendenze NPM\n');
checkPackage('web-push');

// Test 5: Variabili Ambiente
console.log('\n🔐 5. Variabili Ambiente\n');

// Controlla se .env.local esiste
if (!fs.existsSync('.env.local')) {
  console.log('⚠️  File .env.local non trovato');
  console.log('   Crea il file .env.local con le chiavi VAPID\n');
  warnings++;
} else {
  checkEnvVar('NEXT_PUBLIC_VAPID_PUBLIC_KEY', true);
  checkEnvVar('VAPID_PRIVATE_KEY', true);
  checkEnvVar('VAPID_SUBJECT', false);
}

// Test 6: Service Worker
console.log('\n🔧 6. Service Worker\n');
const swPath = path.join(process.cwd(), 'public/sw.js');
if (fs.existsSync(swPath)) {
  const swContent = fs.readFileSync(swPath, 'utf8');
  
  if (swContent.includes('addEventListener(\'push\'')) {
    console.log('✅ Service Worker ha listener per push');
    passes++;
  } else {
    console.log('⚠️  Service Worker potrebbe non gestire push');
    warnings++;
  }
  
  if (swContent.includes('notificationclick')) {
    console.log('✅ Service Worker ha listener per click notifica');
    passes++;
  } else {
    console.log('⚠️  Service Worker potrebbe non gestire click');
    warnings++;
  }
}

// Riepilogo
console.log('\n📊 Riepilogo Test\n');
console.log(`✅ Test passati: ${passes}`);
console.log(`❌ Errori: ${errors}`);
console.log(`⚠️  Warning: ${warnings}`);

if (errors === 0 && warnings === 0) {
  console.log('\n✨ Sistema notifiche completamente configurato!');
  console.log('\n🚀 Prossimi passi:');
  console.log('   1. Genera chiavi VAPID: npx web-push generate-vapid-keys');
  console.log('   2. Aggiungi chiavi a .env.local');
  console.log('   3. Esegui lo script SQL in Supabase');
  console.log('   4. Avvia il server: npm run dev');
  console.log('   5. Abilita notifiche nel browser');
  console.log('   6. Testa creando una prenotazione\n');
  process.exit(0);
} else if (errors === 0) {
  console.log('\n⚠️  Sistema configurato con alcuni warning');
  console.log('   Il sistema funzionerà ma alcune funzionalità potrebbero mancare');
  
  if (warnings > 0) {
    console.log('\n📝 Azioni consigliate:');
    if (!fs.existsSync('public/sounds/alert.mp3')) {
      console.log('   • Aggiungi file audio in public/sounds/ (vedi README)');
    }
    if (!process.env.VAPID_SUBJECT) {
      console.log('   • Configura VAPID_SUBJECT in .env.local');
    }
  }
  console.log('');
  process.exit(0);
} else {
  console.log('\n❌ Configurazione incompleta!');
  console.log('\n📋 Azioni richieste:\n');
  
  if (!fs.existsSync('lib/notifications.ts')) {
    console.log('   ❌ Crea il file lib/notifications.ts');
  }
  if (!fs.existsSync('components/NotificationManager.tsx')) {
    console.log('   ❌ Crea il file components/NotificationManager.tsx');
  }
  if (!fs.existsSync('app/api/notifications/subscribe/route.ts')) {
    console.log('   ❌ Crea il file app/api/notifications/subscribe/route.ts');
  }
  
  try {
    const packageJson = JSON.parse(
      fs.readFileSync('package.json', 'utf8')
    );
    if (!packageJson.dependencies || !packageJson.dependencies['web-push']) {
      console.log('   ❌ Installa web-push: npm install web-push');
    }
  } catch (error) {
    console.log('   ❌ Verifica package.json');
  }
  
  if (!fs.existsSync('.env.local')) {
    console.log('   ❌ Crea .env.local con le chiavi VAPID');
  } else if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.log('   ❌ Configura chiavi VAPID in .env.local');
    console.log('      Genera con: npx web-push generate-vapid-keys');
  }
  
  console.log('\n📖 Consulta GUIDA-NOTIFICHE.md per dettagli\n');
  process.exit(1);
}
