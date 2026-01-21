# 📊 Guida Utente - Report PDF NS3000

## Come Scaricare i Report in PDF

---

## 🎯 Panoramica

La sezione **Report** ti permette ora di scaricare report professionali in formato PDF con intestazione NS3000Rent Srl. I PDF includono:

- ✅ Intestazione aziendale professionale
- ✅ Logo e nome aziendale
- ✅ Date formattate correttamente
- ✅ Importi in Euro (€) con separatori
- ✅ Tabelle ordinate e leggibili
- ✅ Numerazione pagine automatica

---

## 📥 Tipi di Report Disponibili

### 1️⃣ Report Riepilogo Tutti i Fornitori

**Quando usarlo:**
- Vuoi una panoramica annuale di tutti i fornitori
- Devi confrontare le performance tra fornitori
- Ti serve un documento di sintesi generale

**Come scaricarlo:**

1. Vai su **Report** nel menu principale
2. Nel filtro **Fornitore**, seleziona "**Tutti i fornitori**"
3. Seleziona l'**Anno** desiderato
4. Clicca sul pulsante blu **"Scarica Riepilogo PDF Tutti i Fornitori"**

**Cosa contiene:**
- Totali generali (prenotazioni, fatturato, provvigioni)
- Tabella comparativa di tutti i fornitori
- Percentuale provvigione per fornitore
- Fatturato e provvigioni per ogni fornitore

**Nome file generato:**
```
Riepilogo_Fornitori_2025.pdf
```

---

### 2️⃣ Report Annuale Singolo Fornitore

**Quando usarlo:**
- Vuoi il report completo annuale di un fornitore specifico
- Devi inviare al fornitore il riepilogo dell'anno
- Ti serve il breakdown mese per mese

**Come scaricarlo:**

1. Vai su **Report** nel menu principale
2. Nel filtro **Fornitore**, seleziona il fornitore desiderato
3. Seleziona l'**Anno**
4. Nell'intestazione del fornitore (box blu chiaro), clicca sull'icona 📄 in alto a destra

**Cosa contiene:**
- Informazioni fornitore (nome, email, % provvigione)
- Totali annuali (prenotazioni, fatturato, provvigioni)
- Tabella breakdown mensile
- Fatturato e provvigioni per ogni mese

**Nome file generato:**
```
Report_Annuale_[Nome_Fornitore]_2025.pdf
```
Esempio: `Report_Annuale_Rossi_Boats_2025.pdf`

---

### 3️⃣ Report Mensile Singolo Fornitore

**Quando usarlo:**
- Vuoi il dettaglio di un singolo mese
- Devi verificare le prenotazioni mensili
- Ti serve il report per la fatturazione mensile

**Come scaricarlo:**

1. Vai su **Report** nel menu principale
2. Nel filtro **Fornitore**, seleziona il fornitore desiderato (opzionale)
3. Seleziona l'**Anno**
4. Clicca sulla riga del mese desiderato per espanderla
5. Accanto alla riga del mese, trovi 2 pulsanti:
   - 📄 **Blu** = Scarica PDF (NUOVO!)
   - ⬇️ **Outline** = Scarica TXT (formato precedente)
6. Clicca sul pulsante 📄 **blu** per il PDF

**Cosa contiene:**
- Informazioni fornitore e mese
- Riepilogo mensile (n° prenotazioni, fatturato, provvigioni)
- Tabella dettagliata con tutte le prenotazioni
- Per ogni prenotazione: numero, data, importo

**Nome file generato:**
```
Report_[Nome_Fornitore]_2025-01.pdf
```
Esempio: `Report_Rossi_Boats_2025-01.pdf` (Gennaio 2025)

---

## 🎨 Aspetto dei PDF

### Intestazione (su ogni pagina)
```
┌─────────────────────────────────────────┐
│                                         │
│  NS3000Rent Srl    Generato il: gg/mm/aa│
│  Sistema di Gestione Noleggi           │
│                                         │
└─────────────────────────────────────────┘
(Sfondo blu aziendale, testo bianco)
```

### Corpo del Documento
- Titolo grande e in grassetto
- Box riepilogo con sfondo grigio chiaro
- Tabelle con:
  - Header blu con testo bianco
  - Righe alternate grigio/bianco
  - Importi formattati (€1.234,56)
  - Date formato italiano (31/01/2025)

### Footer (su ogni pagina)
```
┌─────────────────────────────────────────┐
│ NS3000Rent Srl - Sistema...   Pagina 1  │
└─────────────────────────────────────────┘
```

---

## 💡 Consigli Pratici

### Per il Riepilogo Generale
✅ **Usa quando:**
- Devi presentare dati alla direzione
- Serve una visione d'insieme trimestrale/annuale
- Vuoi confrontare le performance tra fornitori

### Per il Report Annuale
✅ **Usa quando:**
- Fine anno fiscale
- Riconciliazione conti con fornitore
- Archiviazione documenti annuali

### Per il Report Mensile
✅ **Usa quando:**
- Fatturazione mensile
- Verifica provvigioni del mese
- Controllo puntuale delle prenotazioni

---

## 🔄 Differenze PDF vs TXT

| Caratteristica | PDF (nuovo) | TXT (precedente) |
|---------------|-------------|------------------|
| Intestazione aziendale | ✅ Sì | ❌ No |
| Formattazione professionale | ✅ Sì | ❌ No |
| Tabelle ordinate | ✅ Sì | ❌ No |
| Valute formattate | ✅ € con separatori | ❌ Solo numeri |
| Logo/Brand | ✅ Sì | ❌ No |
| Numerazione pagine | ✅ Automatica | ❌ No |
| Stampa professionale | ✅ Ottima | ⚠️ Base |
| Invio a fornitori | ✅ Consigliato | ⚠️ Meno professionale |

**Raccomandazione:** Usa sempre il PDF per comunicazioni esterne e il TXT solo per backup o elaborazioni automatiche.

---

## 📱 Utilizzo da Mobile

I report PDF funzionano perfettamente anche da smartphone e tablet:

1. **Download:** Il PDF viene scaricato nella cartella Download
2. **Visualizzazione:** Si apre automaticamente con il lettore PDF del dispositivo
3. **Condivisione:** Usa il pulsante "Condividi" per inviare via email/WhatsApp
4. **Stampa:** Funzione "Stampa" disponibile dal lettore PDF

---

## ❓ Domande Frequenti

### Non vedo il pulsante "Scarica Riepilogo PDF Tutti i Fornitori"
**Soluzione:** Assicurati di aver selezionato "Tutti i fornitori" nel filtro Fornitore. Il pulsante appare solo in questa modalità.

### Il PDF ha più di una pagina
**Risposta:** È normale! Se un report ha molte prenotazioni, jsPDF crea automaticamente più pagine. Ogni pagina ha intestazione e footer.

### Dove finiscono i PDF scaricati?
**Risposta:** Nella cartella **Download** del tuo browser/dispositivo, come qualsiasi altro file scaricato.

### Posso modificare i PDF scaricati?
**Risposta:** I PDF sono in sola lettura. Per modifiche, usa software come Adobe Acrobat o online tool PDF editor.

### Il formato TXT è ancora disponibile?
**Risposta:** Sì! Accanto al pulsante PDF blu c'è ancora il pulsante TXT con l'icona ⬇️. Puoi usare entrambi.

### I PDF si possono inviare via email?
**Risposta:** Certamente! Dopo aver scaricato il PDF, puoi allegarlo normalmente a qualsiasi email.

---

## 🔐 Privacy e Sicurezza

- I PDF vengono generati **localmente** nel tuo browser
- **Nessun dato** viene inviato a server esterni
- I file contengono **solo i dati** del report selezionato
- **Sicuro** per l'invio a fornitori esterni

---

## 📞 Supporto

Se hai problemi con i PDF o domande, contatta:
- **Email:** supporto@ns3000rent.it
- **Tel:** [Numero supporto]
- **Chat:** Usa il pulsante supporto nel sistema

---

**Versione Guida:** 1.0  
**Aggiornata al:** 20 Gennaio 2025  
**Sistema:** NS3000Rent v1.7.6
