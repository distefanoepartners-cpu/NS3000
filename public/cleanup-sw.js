// Rimuove tutti i Service Worker vecchi
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister()
      console.log('Service Worker rimosso:', registration)
    }
  })
  
  // Pulisci anche le cache
  caches.keys().then(function(names) {
    for (let name of names) {
      caches.delete(name)
    }
  })
}