import { useEffect, useRef } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../firebase';
import { getAuth } from 'firebase/auth';
import { BACKEND_URL } from '../config';

const VAPID_KEY = 'BAU9GDVtt33a3ktDiyHza3PZuBagmGDOFHKw-FHvvjCtEFj9_Ilzv3PsKFkC-oCt_UUXz6lIpyjRZlA6UNaFqpE';

export const useFCM = (onWarning?: () => void) => {
  const registered = useRef(false);

  useEffect(() => {
    const requestPermissionAndRegister = async () => {
      if (registered.current) return;
      
      try {
        if (!('serviceWorker' in navigator)) {
          console.log('Service workers are not supported in this browser.');
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('Notification permission granted.');

          const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          await navigator.serviceWorker.ready;

          const currentToken = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swRegistration,
          });
          
          if (currentToken) {
            console.log('FCM Token retrieved:', currentToken);
            // Send token to backend
            const auth = getAuth();
            const idToken = await auth.currentUser?.getIdToken();
            if (idToken) {
              await fetch(`${BACKEND_URL}/api/profile/device-token`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ token: currentToken })
              });
              registered.current = true;
            }
          } else {
            console.log('No registration token available. Request permission to generate one.');
          }
        } else {
          console.log('Unable to get permission to notify.');
        }
      } catch (err) {
        console.error('An error occurred while retrieving FCM token. ', err);
      }
    };

    const unsubscribe = getAuth().onAuthStateChanged((user) => {
      if (user) {
        requestPermissionAndRegister();
      }
    });

    const unsubMessage = onMessage(messaging, (payload) => {
      console.log('Foreground message received: ', payload);
      if (payload.data?.type === 'warning') {
        onWarning?.();
      }

      if (Notification.permission === 'granted') {
        const title = payload.notification?.title || payload.data?.title || 'KanbanKC Notification';
        const body = payload.notification?.body || payload.data?.body || '';
        try {
          new Notification(title, { body, icon: '/icon-192.png' });
        } catch {
          // Fallback if Notification constructor fails on mobile
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, { body, icon: '/icon-192.png' });
          });
        }
      }
    });

    return () => {
      unsubscribe();
      if (typeof unsubMessage === 'function') unsubMessage();
    };
  }, []);
};
