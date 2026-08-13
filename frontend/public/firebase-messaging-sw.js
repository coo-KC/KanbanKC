importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyCO7z2cE8eomj6JVCFCflOeWcLLKBeaMHw',
  authDomain: 'kanbankc.firebaseapp.com',
  projectId: 'kanbankc',
  storageBucket: 'kanbankc.firebasestorage.app',
  messagingSenderId: '1027071921414',
  appId: '1:1027071921414:web:98749e1ba209db917ae287',
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'Notification';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
