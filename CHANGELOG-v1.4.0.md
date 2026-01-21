# 🎉 NS3000 Backoffice v1.4.0 - Nuove Funzionalità

## ✨ Nuove Feature Implementate

### 1. 💳 Scelta Tipo Pagamento
L'utente può ora scegliere:
- ☑️ **Solo Acconto** (percentuale configurabile)
- ☑️ **Pagamento Totale** (100%)

### 2. 📊 Percentuale Acconto Personalizzata
- **Slider** da 10% a 100% (step 5%)
- **Input numerico** per valore preciso
- **Anteprima live** di acconto e saldo
- **Ricalcolo automatico** quando cambia final_price

### 3. 📍 Origine Prenotazione
Traccia da dove arriva la prenotazione:
- 🌐 **Online** (dal sito web)
- 🏪 **In Presenza** (ufficio/porto)
- 🏢 **Fornitore/Partner** (con selezione fornitore)

### 4. 🏢 Gestione Fornitori
- Dropdown con lista fornitori attivi
- Mostra **commissione %** accanto al nome
- Visibile solo se origine = "Fornitore"

---

## 🎨 UI Miglioramenti

### Layout Form Prenotazioni

```
┌─────────────────────────────────────┐
│ Cliente, Barca, Servizio, Data...   │
├─────────────────────────────────────┤
│ 💳 Tipo Pagamento                   │
│ ○ Solo Acconto  ● Pagamento Totale  │
│                                     │
│ Percentuale Acconto: 30%            │
│ ━━━━━━━━━●━━━━━━━━━━━ [30] %       │
│ Acconto: €300 • Saldo: €700         │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 📍 Origine Prenotazione             │
│ Canale: [🌐 Online ▼]               │
│ (Se Fornitore → dropdown fornitori) │
└─────────────────────────────────────┘
```

---

## 🔧 Logica Implementata

### Ricalcolo Automatico Importi

```typescript
useEffect(() => {
  if (final_price > 0) {
    if (payment_type === 'full') {
      deposit_amount = final_price
      balance_amount = 0
    } else {
      deposit_amount = final_price * (deposit_percentage / 100)
      balance_amount = final_price - deposit_amount
    }
  }
}, [final_price, payment_type, deposit_percentage])
```

**Esempio**:
- Final Price: €1000
- Payment Type: deposit
- Deposit %: 40%

**Risultato**:
- Deposit Amount: €400
- Balance Amount: €600

---

## 🗄️ Campi Database Utilizzati

Questi campi sono stati aggiunti nella fase SQL:

```sql
bookings.payment_type         -- 'full' o 'deposit'
bookings.deposit_percentage   -- DECIMAL(5,2) default 30.00
bookings.booking_source       -- 'online', 'in_person', 'supplier'
bookings.supplier_id          -- FK a suppliers.id
```

---

## 🧪 Test Funzionalità

### Test 1: Pagamento Totale
1. Nuova Prenotazione
2. Compila dati base (cliente, barca, servizio, data)
3. Prezzo calcolato: €1000
4. **Seleziona**: Pagamento Totale
5. **Verifica**:
   - Acconto: €1000 ✅
   - Saldo: €0 ✅

---

### Test 2: Solo Acconto con % Custom
1. Nuova Prenotazione
2. Prezzo: €1000
3. **Seleziona**: Solo Acconto
4. **Imposta** slider a 40%
5. **Verifica**:
   - Anteprima mostra: Acconto €400, Saldo €600 ✅
   - Campi popolati automaticamente ✅

---

### Test 3: Origine Fornitore
1. Nuova Prenotazione
2. Origine: **Fornitore/Partner**
3. **Verifica**: Dropdown fornitori appare ✅
4. Seleziona "Agenzia Viaggi Costa (15% comm.)"
5. **Verifica**: supplier_id salvato nel database ✅

---

### Test 4: Cambiamento Dinamico %
1. Prenotazione con €1000
2. Solo Acconto 30% → Acconto €300
3. **Cambia** slider a 50%
4. **Verifica**: Acconto diventa €500 istantaneamente ✅

---

## 📊 Report e Analytics

Con questi nuovi campi puoi fare report su:

```sql
-- Prenotazioni per canale
SELECT 
  booking_source,
  COUNT(*) as count,
  SUM(final_price) as total_revenue
FROM bookings
GROUP BY booking_source;

-- Top fornitori per fatturato
SELECT 
  s.name,
  COUNT(b.id) as bookings_count,
  SUM(b.final_price) as total,
  AVG(s.commission_percentage) as avg_commission
FROM bookings b
JOIN suppliers s ON b.supplier_id = s.id
WHERE b.booking_source = 'supplier'
GROUP BY s.name
ORDER BY total DESC;

-- % Pagamenti totali vs acconti
SELECT 
  payment_type,
  COUNT(*) as count,
  ROUND(AVG(deposit_percentage), 2) as avg_deposit_pct
FROM bookings
GROUP BY payment_type;
```

---

## 🎯 Prossimi Passi

1. ✅ Deploy backoffice v1.4.0
2. ✅ Test form prenotazioni
3. ⏳ Implementare stesse funzioni nel **Plugin WordPress**
4. ⏳ Creare pagina **CRUD Fornitori** nel backoffice
5. ⏳ Dashboard analytics con breakdown per canale

---

## 🚀 Deploy

```bash
cd ns3000_bk
npm install
npm run build
vercel --prod
```

O push su GitHub per auto-deploy.

---

## 🔍 Verifica Post-Deploy

Dopo il deploy, vai su:
1. Backoffice → Prenotazioni → "+ Nuova"
2. **Verifica** che compaiano le 2 nuove sezioni:
   - 💳 Tipo Pagamento (verde)
   - 📍 Origine Prenotazione (viola)
3. **Testa** il cambio % acconto in tempo reale
4. **Salva** una prenotazione e verifica nel database

```sql
SELECT 
  booking_number,
  payment_type,
  deposit_percentage,
  deposit_amount,
  balance_amount,
  booking_source,
  supplier_id
FROM bookings
ORDER BY created_at DESC
LIMIT 5;
```

---

**Versione**: 1.4.0  
**Data**: 18 Gennaio 2026  
**Feature**: Tipo Pagamento + Origine Prenotazione  
**Status**: ✅ Pronto per Deploy
