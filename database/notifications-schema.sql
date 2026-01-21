-- Script SQL per sistema notifiche NS3000
-- Esegui questo script in Supabase SQL Editor

-- 1. Tabella per le subscription push
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  device_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indice per performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id 
ON push_subscriptions(user_id);

-- 2. Tabella per log notifiche inviate
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'new_booking', 'booking_update', 'booking_cancel', etc.
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivery_status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'failed'
  error_message TEXT,
  metadata JSONB
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_notification_logs_booking_id 
ON notification_logs(booking_id);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id 
ON notification_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at 
ON notification_logs(sent_at DESC);

-- 3. Funzione per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per aggiornare updated_at
DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at
    BEFORE UPDATE ON push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Funzione per inviare notifica quando viene creata una prenotazione
CREATE OR REPLACE FUNCTION notify_new_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserisci un record nel log delle notifiche
  INSERT INTO notification_logs (
    booking_id,
    type,
    title,
    body,
    metadata
  ) VALUES (
    NEW.id,
    'new_booking',
    'Nuova Prenotazione',
    'È stata creata una nuova prenotazione',
    jsonb_build_object(
      'booking_number', NEW.booking_number,
      'customer_id', NEW.customer_id,
      'boat_id', NEW.boat_id,
      'booking_date', NEW.booking_date
    )
  );
  
  -- Qui potresti chiamare una funzione edge per inviare la notifica push
  -- oppure usare un sistema di code come pg_notify
  
  PERFORM pg_notify('new_booking', NEW.id::TEXT);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per notificare nuove prenotazioni
DROP TRIGGER IF EXISTS trigger_notify_new_booking ON bookings;
CREATE TRIGGER trigger_notify_new_booking
    AFTER INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_booking();

-- 5. Policy RLS (Row Level Security)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Gli utenti possono vedere solo le proprie subscriptions
CREATE POLICY "Users can view own subscriptions"
ON push_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
ON push_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
ON push_subscriptions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
ON push_subscriptions FOR DELETE
USING (auth.uid() = user_id);

-- Policy: Service role può fare tutto
CREATE POLICY "Service role has full access to subscriptions"
ON push_subscriptions
USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to logs"
ON notification_logs
USING (auth.role() = 'service_role');

-- 6. Visualizzazione delle notifiche recenti
CREATE OR REPLACE VIEW recent_notifications AS
SELECT 
  nl.id,
  nl.type,
  nl.title,
  nl.body,
  nl.sent_at,
  nl.delivery_status,
  b.booking_number,
  b.booking_date,
  c.first_name || ' ' || c.last_name as customer_name,
  bt.name as boat_name
FROM notification_logs nl
LEFT JOIN bookings b ON nl.booking_id = b.id
LEFT JOIN customers c ON b.customer_id = c.id
LEFT JOIN boats bt ON b.boat_id = bt.id
ORDER BY nl.sent_at DESC
LIMIT 100;

-- Grant permessi sulla view
GRANT SELECT ON recent_notifications TO authenticated;

-- 7. Funzione per pulire vecchie notifiche (opzionale, da eseguire periodicamente)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  -- Elimina notifiche più vecchie di 30 giorni
  DELETE FROM notification_logs 
  WHERE sent_at < NOW() - INTERVAL '30 days';
  
  RAISE NOTICE 'Vecchie notifiche eliminate';
END;
$$ LANGUAGE plpgsql;

-- 8. Commenti per documentazione
COMMENT ON TABLE push_subscriptions IS 'Subscription per notifiche push degli utenti';
COMMENT ON TABLE notification_logs IS 'Log di tutte le notifiche inviate';
COMMENT ON COLUMN push_subscriptions.subscription IS 'Oggetto PushSubscription serializzato in JSON';
COMMENT ON COLUMN notification_logs.delivery_status IS 'Stato di consegna: sent, delivered, failed';

-- Fine script
