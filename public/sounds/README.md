# Suoni per Notifiche NS3000

## File Richiesti

Questa cartella deve contenere i seguenti file audio:

- `alert.mp3` - Suono per nuove prenotazioni (urgente)
- `info.mp3` - Suono per aggiornamenti (informativo)
- `success.mp3` - Suono per conferme (positivo)

## Dove Trovare Suoni Gratuiti

### Opzione 1: Freesound.org
https://freesound.org

**Ricerca suggerita**:
- alert: "notification alert", "bell alert", "urgent beep"
- info: "notification subtle", "soft beep", "ding"
- success: "success sound", "positive beep", "achievement"

**Filtri**:
- License: CC0 (dominio pubblico) o CC-BY
- Format: MP3
- Duration: < 2 secondi

### Opzione 2: Mixkit
https://mixkit.co/free-sound-effects/notification/

**Suoni consigliati**:
- Alert: "Alert Warning" o "Notification Alert"
- Info: "Notification Tone" o "Message Pop"
- Success: "Success Notification" o "Achievement Bell"

### Opzione 3: Zapsplat
https://www.zapsplat.com (richiede registrazione gratuita)

## Formato File

- **Formato**: MP3
- **Durata**: 0.5 - 2 secondi
- **Bitrate**: 128 kbps (sufficiente)
- **Dimensione**: < 50 KB per file

## Come Convertire/Ottimizzare

Se hai file in altri formati (WAV, OGG, etc.):

### Online (gratis)
https://online-audio-converter.com

1. Upload file
2. Scegli formato MP3
3. Bitrate: 128 kbps
4. Converti e scarica

### FFmpeg (da riga di comando)
```bash
# Converti WAV in MP3
ffmpeg -i input.wav -b:a 128k alert.mp3

# Taglia i primi 2 secondi
ffmpeg -i input.mp3 -t 2 -b:a 128k alert.mp3
```

## Esempio di Naming

```
public/sounds/
  ├── alert.mp3        ← Nuova prenotazione
  ├── info.mp3         ← Aggiornamento
  ├── success.mp3      ← Conferma
  └── README.md        ← Questo file
```

## Test Suoni

Per testare che i suoni funzionino:

```javascript
// Apri Console del browser (F12)
const audio = new Audio('/sounds/alert.mp3');
audio.play();
```

## Note Importanti

1. **Autoplay**: Alcuni browser bloccano l'autoplay dei suoni finché l'utente non interagisce con la pagina
2. **Volume**: I suoni sono impostati a 50% di volume per default (vedi `lib/notifications.ts`)
3. **Fallback**: Se un suono non viene trovato, l'errore viene solo loggato in console, non blocca le notifiche

## Licenze

Assicurati di:
- ✅ Usare solo suoni con licenza commerciale o CC0
- ✅ Attribuire l'autore se richiesto dalla licenza
- ✅ Non usare suoni protetti da copyright

## Suggerimenti Creativi

### Alert (Nuova Prenotazione)
Caratteristiche:
- Tono urgente ma non fastidioso
- Frequenze medie (400-800 Hz)
- Durata: 0.5-1 secondo
- Volume: medio-alto

### Info (Aggiornamento)
Caratteristiche:
- Tono neutro, professionale
- Frequenze basse (200-400 Hz)
- Durata: 0.3-0.7 secondi
- Volume: medio

### Success (Conferma)
Caratteristiche:
- Tono positivo, allegro
- Frequenze alte (600-1200 Hz)
- Durata: 0.5-1 secondo
- Volume: medio

## Alternative

Se non vuoi usare suoni:

1. Commenta la riga in `lib/notifications.ts`:
```typescript
// playNotificationSound('alert');
```

2. Oppure usa il suono di sistema del browser (già incluso nelle notifiche push)
