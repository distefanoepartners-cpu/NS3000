# 📦 NS3000 - Installazione Sistema Report PDF v1.7.6

## 🎯 Obiettivo
Aggiunta del sistema di download PDF con intestazione NS3000Rent Srl nella sezione Report Fornitori.

---

## ✅ Checklist Pre-Installazione

Prima di procedere, verifica di avere:
- [ ] Accesso al progetto NS3000
- [ ] Node.js e npm installati
- [ ] Backup del progetto corrente
- [ ] Permessi di scrittura sulle cartelle del progetto

---

## 📋 Passaggi di Installazione

### 1️⃣ Installazione Dipendenze

Apri il terminale nella root del progetto e esegui:

```bash
npm install jspdf jspdf-autotable
```

**Output atteso:**
```
added 2 packages, and audited XXX packages in Xs
```

### 2️⃣ Aggiunta File Nuovo

Crea il file `/lib/pdf-generator.ts` con il contenuto fornito.

**Percorso completo:**
```
ns3000_bk/
  └── lib/
      └── pdf-generator.ts  ← NUOVO FILE
```

### 3️⃣ Modifica File Esistente

Sostituisci il contenuto di `/app/(dashboard)/reports/page.tsx` con il nuovo codice fornito.

**Percorso completo:**
```
ns3000_bk/
  └── app/
      └── (dashboard)/
          └── reports/
              └── page.tsx  ← FILE MODIFICATO
```

### 4️⃣ Verifica Installazione

```bash
# Verifica che le dipendenze siano installate
npm list jspdf jspdf-autotable

# Output atteso:
# ns3000rent-backoffice@1.6.0
# ├── jspdf@2.5.1
# └── jspdf-autotable@3.8.2
```

---

## 🚀 Test Funzionalità

### Test 1: Riepilogo Generale
1. Avvia il server: `npm run dev`
2. Vai su `/reports`
3. Seleziona "Tutti i fornitori"
4. Clicca "Scarica Riepilogo PDF Tutti i Fornitori"
5. ✅ Verifica che il PDF si scarichi

### Test 2: Report Annuale
1. Seleziona un fornitore specifico
2. Clicca sull'icona 📄 nell'header del fornitore
3. ✅ Verifica che il PDF si scarichi

### Test 3: Report Mensile
1. Clicca sull'icona 📄 blu accanto a un mese
2. ✅ Verifica che il PDF si scarichi
3. Clicca sull'icona ⬇️ outline
4. ✅ Verifica che il TXT si scarichi ancora

---

## 📁 Struttura File Modificati

```
ns3000_bk/
├── lib/
│   └── pdf-generator.ts                      ← NUOVO
├── app/
│   └── (dashboard)/
│       └── reports/
│           └── page.tsx                      ← MODIFICATO
├── package.json                              ← AGGIORNATO
├── CHANGELOG-PDF-v1.7.6.md                  ← DOCUMENTAZIONE
├── GUIDA-UTENTE-PDF.md                      ← GUIDA UTENTE
└── INTERFACCIA-REPORT-PDF.md                ← REFERENCE UI
```

---

## 🔧 Troubleshooting

### Errore: "Cannot find module 'jspdf'"
**Soluzione:**
```bash
npm install jspdf jspdf-autotable
```

### Errore: "autoTable is not a function"
**Causa:** Import mancante di jspdf-autotable
**Soluzione:** Verifica che in `pdf-generator.ts` ci sia:
```typescript
import 'jspdf-autotable';
```

### PDF non si scarica
**Verifica:**
1. Console del browser (F12) per errori JavaScript
2. Popup blocker del browser
3. Permessi di download del browser

### Caratteri strani nel PDF
**Causa:** Caratteri speciali non supportati
**Note:** jsPDF supporta UTF-8, ma caratteri molto particolari potrebbero non funzionare

---

## 🎨 Personalizzazione

### Cambiare Colore Header
Nel file `pdf-generator.ts`, modifica:
```typescript
// Linea ~20
doc.setFillColor(41, 128, 185); // RGB del blu corporate
```

### Cambiare Nome Azienda
Nel file `pdf-generator.ts`, modifica:
```typescript
// Linea ~26
doc.text('NS3000Rent Srl', 15, 20);
```

### Cambiare Sottotitolo
Nel file `pdf-generator.ts`, modifica:
```typescript
// Linea ~30
doc.text('Sistema di Gestione Noleggi', 15, 28);
```

---

## 📊 File Generati

I PDF vengono salvati nella cartella **Download** con questi nomi:

### Riepilogo Generale
```
Riepilogo_Fornitori_2025.pdf
```

### Report Annuale
```
Report_Annuale_[Nome_Fornitore]_2025.pdf
```
Esempio: `Report_Annuale_Rossi_Boats_2025.pdf`

### Report Mensile
```
Report_[Nome_Fornitore]_2025-01.pdf
```
Esempio: `Report_Rossi_Boats_2025-01.pdf`

---

## 🔄 Rollback (se necessario)

Se qualcosa non funziona, puoi fare rollback:

### 1. Ripristina package.json precedente
```bash
npm uninstall jspdf jspdf-autotable
```

### 2. Ripristina page.tsx precedente
Usa il backup o il file dalla versione precedente

### 3. Rimuovi pdf-generator.ts
```bash
rm lib/pdf-generator.ts
```

---

## 📈 Versioning

| Versione | Data | Modifiche |
|----------|------|-----------|
| 1.7.6 | 20/01/2025 | Aggiunto sistema PDF con intestazione NS3000Rent |
| 1.7.5 | [Precedente] | Traduzione timeslot |
| ... | ... | ... |

---

## 🔒 Deployment Production

Prima del deploy in produzione:

### Pre-Deploy Checklist
- [ ] Test completi in ambiente di sviluppo
- [ ] Verifica compatibilità browser (Chrome, Firefox, Safari)
- [ ] Test su mobile
- [ ] Backup database
- [ ] Tag Git della versione

### Deploy Steps
```bash
# 1. Commit modifiche
git add .
git commit -m "feat: Aggiunto sistema report PDF v1.7.6"

# 2. Tag versione
git tag v1.7.6

# 3. Push
git push origin main --tags

# 4. Build production
npm run build

# 5. Deploy
# (Seguire procedura specifica del vostro hosting)
```

---

## 📞 Supporto

### Documentazione Disponibile
- `CHANGELOG-PDF-v1.7.6.md` - Changelog tecnico completo
- `GUIDA-UTENTE-PDF.md` - Guida per l'utente finale
- `INTERFACCIA-REPORT-PDF.md` - Reference interfaccia e UI

### Contatti
- **Email tecnica:** dev@ns3000rent.it
- **Supporto utenti:** supporto@ns3000rent.it

---

## ✨ Features Implementate

- ✅ Download PDF report mensile con intestazione aziendale
- ✅ Download PDF report annuale fornitore
- ✅ Download PDF riepilogo tutti fornitori
- ✅ Intestazione NS3000Rent Srl professionale
- ✅ Footer con paginazione automatica
- ✅ Formattazione valute (€) e date italiane
- ✅ Tabelle con righe alternate
- ✅ Box riepilogo con statistiche
- ✅ Compatibilità con formato TXT esistente
- ✅ Responsive design (desktop + mobile)
- ✅ Nomi file descrittivi
- ✅ Generazione client-side (no server load)

---

## 🎓 Best Practices

### Per Sviluppatori
1. Sempre fare backup prima di modificare
2. Testare in locale prima del deploy
3. Verificare console browser per errori
4. Documentare ogni modifica
5. Usare Git per versioning

### Per Utenti
1. Usare PDF per comunicazioni esterne
2. Usare TXT solo per backup/elaborazioni
3. Verificare i dati prima di inviare report
4. Mantenere nomenclatura file standard
5. Archiviare PDF importanti

---

**Versione:** 1.7.6  
**Data Rilascio:** 20 Gennaio 2025  
**Compatibilità:** Next.js 16+, React 19+  
**Browser Support:** Chrome, Firefox, Safari, Edge (ultime 2 versioni)
