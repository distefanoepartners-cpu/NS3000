import type { CapacitorConfig } from '@capacitor/cli';

/ capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.blufleet.ns3000',
  appName: 'NS3000 RENT',
  
  // ⭐ MODALITÀ LIVE SERVER: l'app carica direttamente dal tuo Vercel
  server: {
    url: 'https://ns-3000.vercel.app',
    cleartext: false, // Solo HTTPS
  },
  
  // Configurazione Android
  android: {
    // Permetti mixed content se necessario
    allowMixedContent: false,
    // Abilita il pinch-to-zoom (utile per il planning)
    overScrollMode: 'never',
  },
  
  // Plugin configurazioni
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0066cc',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0066cc',
    },
  },
};


export default config;
