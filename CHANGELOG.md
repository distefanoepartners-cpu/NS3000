# NS3000 Backoffice - Changelog

## [1.3.1] - 2026-01-17

### 🔧 Bug Fixes Critici

#### Fix 1: Tabella Prezzi Locazione Invertita
- **File**: `app/(dashboard)/boats/page.tsx` (riga 613)
- **Problema**: La tabella "Listino Prezzi LOCAZIONE" appariva quando era selezionato `has_charter` invece di `has_rental`
- **Fix**: Cambiato `formData.has_charter` → `formData.has_rental`

#### Fix 2: Bottone "Servizi" su Barche Sbagliate  
- **File**: `app/(dashboard)/boats/page.tsx` (riga 997)
- **Problema**: Il bottone "Servizi" appariva per barche con `has_rental`, ma dovrebbe apparire solo per tour
- **Fix**: Cambiato `boat.has_rental` → `(boat.has_charter || boat.has_collective)`

### 📋 Comportamento Corretto

**Barche SOLO Locazione** (es. Cab Dorado 10, Manò 24):
- ✅ Modal mostra tabella prezzi locazione
- ❌ Card NON mostra bottone "Servizi"

**Barche Tour Privati/Collettivi** (es. Salpa Soleil, Yamaha):
- ❌ Modal NON mostra tabella prezzi locazione  
- ✅ Card mostra bottone "Servizi"

**Barche Miste** (es. Clubman 26, Conam 60):
- ✅ Modal mostra tabella prezzi locazione
- ✅ Card mostra bottone "Servizi"

---

## [1.3.0] - 2026-01-17

### ✨ Nuove Funzionalità

#### Sistema Filtri Barche per Tipologia Servizio
- Aggiunto campo `has_rental` (Locazione/Charter)
- Aggiunto campo `has_charter` (Tour Privati)
- Aggiunto campo `has_collective` (Tour Collettivi)
- Interfaccia con 3 checkbox per configurare disponibilità

#### Listino Prezzi Locazione per Stagione
- Prezzi per 4 periodi: Apr-Mag-Ott, Giugno, Lug-Set, Agosto
- Tariffe: Mezza giornata, Giornata intera, Settimanale
- Campo Cauzione per barche in locazione

#### Gestione Servizi/Tratte per Barca
- Modal "Servizi" per configurare prezzi tour per tratta
- Prezzi stagionali per ogni servizio (Capri, Amalfi, etc.)
- Visibile solo per barche con tour privati/collettivi

---

## Versioni Precedenti

Vedi changelog per versioni 1.2.x e precedenti.
