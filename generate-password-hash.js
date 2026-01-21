/**
 * NS3000 - Password Hash Generator
 * 
 * Questo script genera un hash bcrypt per la password dell'admin
 * 
 * ISTRUZIONI:
 * 1. Modifica la PASSWORD qui sotto
 * 2. Esegui: node generate-password-hash.js
 * 3. Copia l'hash generato nello script SQL
 */

const bcrypt = require('bcryptjs');

// ⚠️ MODIFICA QUESTA PASSWORD CON LA TUA PASSWORD SICURA
const PASSWORD = 'Admin2026!NS3000';  // Cambia questa password!

// Genera hash (salt rounds = 10)
const hash = bcrypt.hashSync(PASSWORD, 10);

console.log('\n=================================================');
console.log('NS3000 - Hash Password Generato');
console.log('=================================================\n');
console.log('Password in chiaro:', PASSWORD);
console.log('\nHash bcrypt da inserire nel database:');
console.log('\x1b[32m%s\x1b[0m', hash);  // Verde
console.log('\n=================================================');
console.log('\n📋 ISTRUZIONI:');
console.log('1. Copia l\'hash verde sopra');
console.log('2. Apri setup_users_roles_SAFE.sql');
console.log('3. Cerca la riga con password_hash (circa riga 135)');
console.log('4. Sostituisci il valore con l\'hash copiato');
console.log('5. Modifica anche l\'email admin@ns3000.it');
console.log('6. Esegui lo script SQL in Supabase');
console.log('\n=================================================\n');

// Test di verifica
const testPassword = PASSWORD;
const isValid = bcrypt.compareSync(testPassword, hash);
console.log('✅ Test verifica hash:', isValid ? 'OK' : 'ERRORE');
console.log('\n');
