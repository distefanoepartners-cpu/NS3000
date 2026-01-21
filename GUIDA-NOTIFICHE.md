# 🔔 Sistema Notifiche NS3000 - Guida Completa

## 📋 Panoramica

Sistema completo di notifiche per il backoffice NS3000 con supporto per:
- ✅ **Notifiche Push** (Desktop + Mobile)
- ✅ **Notifiche In-App** (Badge e pannello)
- ✅ **Polling Automatico** (controllo nuove prenotazioni)
- ✅ **Suoni di Allerta**
- ✅ **Email** (opzionale, da configurare)

---

## 🚀 Installazione Rapida

### 1️⃣ Installa Dipendenze

```bash
npm install web-push
```

### 2️⃣ Genera Chiavi VAPID

Le chiavi VAPID sono necessarie per le notifiche push:

```bash
npx web-push generate-vapid-keys
```

Output:
```
Public Key: BExxxxxx...
Private Key: xyz123...
```

### 3️⃣ Configura Variabili Ambiente

Aggiungi al file `.env.local`:

```env
# Chiavi VAPID per notifiche push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BExxxxxx...
VAPID_PRIVATE_KEY=xyz123...
VAPID_SUBJECT=mailto:info@ns3000rent.it
```

⚠️ **IMPORTANTE**: 
- La `NEXT_PUBLIC_VAPID_PUBLIC_KEY` deve iniziare con `NEXT_PUBLIC_`
- La `VAPID_PRIVATE_KEY` NON deve essere pubblica
- Cambia l'email in `VAPID_SUBJECT` con la tua

### 4️⃣ Crea Tabelle Database

Vai su **Supabase → SQL Editor** ed esegui lo script:

```sql
-- Vedi file: database/notifications-schema.sql
```

Oppure copia e incolla il contenuto del file `notifications-schema.sql`.

### 5️⃣ Integra il Componente

Aggiungi `NotificationManager` al tuo layout principale:

```typescript
// app/(dashboard)/layout.tsx
import NotificationManager from '@/components/NotificationManager';

export default function DashboardLayout({ children }) {
  // Recupera userId dalla sessione
  const { data: { user } } = await supabase.auth.getUser();
  
  return (
    <div>
      <header>
        {/* ... altri componenti header ... */}
        
        {/* Aggiungi qui il notification manager */}
        {user && <NotificationManager userId={user.id} />}
      </header>
      
      <main>{children}</main>
    </div>
  );
}
```

---

## 📱 Come Funziona

### Sistema Multi-Livello

```
┌─────────────────────────────────────────┐
│  1. CREAZIONE PRENOTAZIONE              │
└─────────┬───────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│  2. TRIGGER DATABASE                    │
│     ↓ Inserisce in notification_logs    │
│     ↓ Esegue pg_notify                  │
└─────────┬───────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│  3. POLLING CLIENT (ogni 30s)           │
│     ↓ Controlla nuove prenotazioni      │
│     ↓ Mostra badge numero notifiche     │
└─────────┬───────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│  4. NOTIFICA PUSH                       │
│     ↓ Service Worker mostra notifica    │
│     ↓ Suono di allerta                  │
│     ↓ Vibrazione (mobile)               │
└─────────────────────────────────────────┘
```

### Flusso Dettagliato

1. **Utente crea prenotazione** (dal sito o backoffice)
2. **Trigger SQL** inserisce record in `notification_logs`
3. **Polling ogni 30 secondi** controlla nuove prenotazioni
4. **Badge aggiornato** con numero notifiche non lette
5. **Notifica push** inviata a tutti gli utenti connessi
6. **Suono** riprodotto automaticamente
7. **Click notifica** apre la prenotazione nel backoffice

---

## 🎯 Configurazione

### Personalizza Intervallo Polling

```typescript
<NotificationManager 
  userId={user.id} 
  pollInterval={15000}  // 15 secondi invece di 30
/>
```

### Personalizza Suoni

Crea la cartella `public/sounds/` con questi file:
- `alert.mp3` - Nuova prenotazione
- `info.mp3` - Aggiornamento
- `success.mp3` - Completamento

Oppure usa suoni gratuiti da:
- https://freesound.org
- https://mixkit.co/free-sound-effects/

### Disabilita Notifiche Push

```typescript
// lib/notifications.ts
export async function initializeNotifications(userId: string): Promise<boolean> {
  // Commenta o rimuovi questa riga per disabilitare
  // return false;
}
```

---

## 🔧 Test Sistema

### Test 1: Notifiche Browser

1. Apri il backoffice
2. Clicca sul pulsante **"🔔 Abilita Notifiche Push"**
3. Accetta il permesso nel browser
4. ✅ Dovresti vedere "Notifiche push abilitate"

### Test 2: Creazione Prenotazione

1. Crea una nuova prenotazione dal backoffice
2. Entro 30 secondi dovresti:
   - ✅ Vedere il badge con "1"
   - ✅ Ricevere notifica push
   - ✅ Sentire il suono di allerta

### Test 3: Pannello Notifiche

1. Clicca sull'icona 🔔 (in alto a destra)
2. Dovresti vedere:
   - ✅ Lista delle notifiche
   - ✅ Numero non lette
   - ✅ Pulsanti "Segna come letta" e "Rimuovi"

---

## 📊 Monitoraggio

### Visualizza Log Notifiche

Nel SQL Editor di Supabase:

```sql
-- Notifiche recenti
SELECT * FROM recent_notifications;

-- Notifiche di oggi
SELECT * FROM notification_logs 
WHERE sent_at >= CURRENT_DATE
ORDER BY sent_at DESC;

-- Statistiche per tipo
SELECT 
  type,
  COUNT(*) as total,
  COUNT(CASE WHEN delivery_status = 'delivered' THEN 1 END) as delivered,
  COUNT(CASE WHEN delivery_status = 'failed' THEN 1 END) as failed
FROM notification_logs
GROUP BY type;
```

### Verifica Subscriptions Attive

```sql
SELECT 
  ps.*,
  u.email,
  u.full_name
FROM push_subscriptions ps
JOIN users u ON ps.user_id = u.id
ORDER BY ps.updated_at DESC;
```

---

## 🐛 Troubleshooting

### ❌ "Le notifiche non sono supportate"

**Causa**: Browser non compatibile o HTTPS non configurato

**Soluzione**:
- Usa Chrome, Firefox, Edge o Safari (versioni recenti)
- Assicurati che il sito sia su HTTPS (obbligatorio per notifiche push)
- In development, `localhost` funziona anche senza HTTPS

### ❌ "Permesso notifiche non concesso"

**Causa**: Utente ha negato il permesso

**Soluzione**:
1. Clicca sull'icona 🔒 nella barra degli indirizzi
2. Vai su **Impostazioni sito**
3. Trova **Notifiche** e cambia in **Consenti**
4. Ricarica la pagina

### ❌ Badge non si aggiorna

**Causa**: Polling non funziona o API bloccata

**Soluzione**:
1. Apri Console del browser (F12)
2. Cerca errori nella tab **Console**
3. Verifica che l'API `/api/bookings` risponda correttamente
4. Controlla che il `pollInterval` sia impostato

### ❌ Notifiche push non arrivano

**Causa**: Service Worker non registrato o chiavi VAPID errate

**Soluzione**:
1. Verifica che `public/sw.js` esista
2. Controlla Console → Application → Service Workers
3. Verifica che le chiavi VAPID siano corrette in `.env.local`
4. Riavvia il server: `npm run dev`

### ❌ Suono non si riproduce

**Causa**: File audio mancante o browser blocca autoplay

**Soluzione**:
1. Crea cartella `public/sounds/`
2. Aggiungi file `alert.mp3`
3. Alcuni browser bloccano autoplay: richiede interazione utente prima

### ❌ Errore "Module not found: web-push"

**Soluzione**:
```bash
npm install web-push
npm run build
```

---

## 🌐 Supporto Browser

| Browser | Desktop | Mobile | Push | Suoni |
|---------|---------|--------|------|-------|
| Chrome | ✅ | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ | ✅ |
| Safari | ✅ | ✅ | ⚠️ iOS 16.4+ | ✅ |
| Edge | ✅ | ✅ | ✅ | ✅ |

⚠️ Safari richiede iOS 16.4+ per notifiche push

---

## 📈 Ottimizzazioni

### Ridurre Carico Server

Aumenta l'intervallo di polling:

```typescript
<NotificationManager 
  userId={user.id} 
  pollInterval={60000}  // 1 minuto
/>
```

### Notifiche Solo per Utenti Attivi

Modifica il polling per controllare se l'utente è attivo:

```typescript
// Aggiungi in NotificationManager.tsx
useEffect(() => {
  let isActive = true;
  
  const handleVisibilityChange = () => {
    isActive = !document.hidden;
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  const interval = setInterval(() => {
    if (isActive) {
      checkForNewBookings();
    }
  }, pollInterval);
  
  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [checkForNewBookings, pollInterval]);
```

### Usa WebSockets (Avanzato)

Per notifiche real-time senza polling, implementa WebSockets con Supabase Realtime:

```typescript
// Esempio con Supabase Realtime
const subscription = supabase
  .channel('bookings-channel')
  .on('postgres_changes', 
    { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'bookings' 
    }, 
    (payload) => {
      notifyNewBooking(payload.new);
    }
  )
  .subscribe();
```

---

## 🔐 Sicurezza

### Best Practices

1. **Mai esporre VAPID Private Key** nel codice client
2. **Usa HTTPS** in produzione (obbligatorio per push)
3. **Valida permessi** utente prima di inviare notifiche
4. **Rate limiting** sull'API di invio notifiche
5. **Pulisci subscriptions** non valide periodicamente

### RLS (Row Level Security)

Le policy SQL sono già configurate per:
- Utenti vedono solo le proprie subscriptions
- Service role ha accesso completo
- Logs visibili solo al service role

---

## 📱 PWA e Mobile

### Aggiungi al Manifest

Assicurati che `public/manifest.json` includa:

```json
{
  "name": "NS3000Rent Backoffice",
  "short_name": "NS3000",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2980b9",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Test su Mobile

1. Apri il backoffice da mobile (Chrome/Safari)
2. Aggiungi alla Home Screen
3. Apri l'app dalla Home
4. Abilita notifiche
5. Crea una prenotazione dal PC
6. ✅ Dovresti ricevere la notifica sul mobile

---

## 🎓 FAQ

### Come faccio a testare senza creare prenotazioni reali?

Usa l'API direttamente:

```bash
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notifica",
    "body": "Questa è una notifica di test",
    "url": "/bookings"
  }'
```

### Le notifiche funzionano anche se chiudo il browser?

**Desktop**: Sì, se il browser supporta notifiche in background (Chrome, Edge)
**Mobile**: Dipende dal sistema operativo e browser

### Posso personalizzare l'icona della notifica?

Sì, modifica in `lib/notifications.ts`:

```typescript
icon: '/tua-icona-custom.png'
```

### Come invio notifiche solo a specifici utenti?

Usa l'API `/api/notifications/send` con parametro `userId`:

```typescript
await fetch('/api/notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Notifica Personale',
    body: 'Messaggio per te',
    userId: 'xxx-yyy-zzz' // UUID dell'utente
  })
});
```

---

## 📚 File del Sistema

```
ns3000_bk/
├── lib/
│   └── notifications.ts              ← Logica notifiche
├── components/
│   └── NotificationManager.tsx       ← UI notifiche
├── app/
│   └── api/
│       └── notifications/
│           ├── subscribe/
│           │   └── route.ts          ← Salva subscriptions
│           └── send/
│               └── route.ts          ← Invia notifiche
├── public/
│   ├── sw.js                         ← Service Worker
│   ├── sounds/
│   │   ├── alert.mp3
│   │   ├── info.mp3
│   │   └── success.mp3
│   └── manifest.json
└── database/
    └── notifications-schema.sql      ← Schema database
```

---

**Versione**: 1.0  
**Data**: 20 Gennaio 2025  
**Compatibilità**: NS3000 v1.7.6+
