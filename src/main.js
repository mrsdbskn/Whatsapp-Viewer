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

const app = createApp(App);

app.config.errorHandler = (err, instance, info) => {
  console.error('Vue runtime error:', err, info);
};

app.mount('#app');
