import { createApp } from 'vue';
import './style.css';
import App from './App.vue';

// PWA Service Worker Registration
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('Service Worker registration skipped:', err);
    });
  });
}

createApp(App).mount('#app');
