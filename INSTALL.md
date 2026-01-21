# Sistema Notifiche NS3000

## 📦 Contenuto Pacchetto

Questo pacchetto contiene tutto il necessario per implementare il sistema di notifiche push nel backoffice NS3000.

```
ns3000_notifiche/
├── GUIDA-NOTIFICHE.md                     ← Guida completa
├── INSTALL.md                              ← Questo file
├── test-notifications.js                   ← Script verifica
├── lib/
│   └── notifications.ts                    ← Logica notifiche
├── app/
│   └── api/
│       └── notifications/
│           └── subscribe/
│               └── route.ts                ← API subscription
├── database/
│   └── notifications-schema.sql            ← Schema database
└── public/
    └── sounds/
        └── README.md                       ← Info suoni

```

## 🚀 Installazione Rapida

### 1. Copia i File

Copia il contenuto di questo pacchetto nel tuo progetto NS3000:

```bash
# Dalla directory del pacchetto
cp -r lib/* /percorso/tuo/progetto/lib/
cp -r app/* /percorso/tuo/progetto/app/
cp -r database/* /percorso/tuo/progetto/database/
cp -r public/* /percorso/tuo/progetto/public/
cp test-notifications.js /percorso/tuo/progetto/
```

### 2. Installa Dipendenza

```bash
cd /percorso/tuo/progetto
npm install web-push
```

### 3. Genera Chiavi VAPID

```bash
npx web-push generate-vapid-keys
```

Copia le chiavi generate e aggiungile a `.env.local`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BExxxxxx...
VAPID_PRIVATE_KEY=xyz123...
VAPID_SUBJECT=mailto:info@ns3000rent.it
```

### 4. Esegui Script SQL

1. Vai su **Supabase → SQL Editor**
2. Copia il contenuto di `database/notifications-schema.sql`
3. Esegui lo script

### 5. Integra il Componente

Già esistente in `components/NotificationManager.tsx`.

Aggiungilo al layout se non è già presente:

```typescript
import NotificationManager from '@/components/NotificationManager';

// Nel layout
{user && <NotificationManager userId={user.id} />}
```

### 6. Test

```bash
node test-notifications.js
```

## 📖 Documentazione

Leggi **GUIDA-NOTIFICHE.md** per:
- Configurazione dettagliata
- Come funziona il sistema
- Troubleshooting
- Personalizzazioni
- FAQ

## ✅ Checklist

- [ ] File copiati nel progetto
- [ ] `npm install web-push` eseguito
- [ ] Chiavi VAPID generate e configurate in `.env.local`
- [ ] Script SQL eseguito in Supabase
- [ ] `NotificationManager` integrato nel layout
- [ ] Test con `node test-notifications.js`
- [ ] File audio aggiunti in `public/sounds/` (opzionale)
- [ ] Server avviato e notifiche abilitate nel browser

## 🐛 Problemi?

1. Esegui `node test-notifications.js` per diagnostica
2. Leggi sezione **Troubleshooting** in GUIDA-NOTIFICHE.md
3. Verifica console del browser (F12)

## 📞 Supporto

Per domande o problemi, consulta:
- GUIDA-NOTIFICHE.md (documentazione completa)
- public/sounds/README.md (configurazione audio)
- Console browser (F12) per errori

---

**Versione**: 1.0  
**Compatibilità**: NS3000 v1.7.6+  
**Data**: 20 Gennaio 2025
