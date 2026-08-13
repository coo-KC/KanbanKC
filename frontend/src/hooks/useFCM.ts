import { useEffect, useRef } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../firebase';
import { getAuth } from 'firebase/auth';

const VAPID_KEY = 'BAU9GDVtt33a3ktDiyHza3PZuBagmGDOFHKw-FHvvjCtEFj9_Ilzv3PsKFkC-oCt_UUXz6lIpyjRZlA6UNaFqpE';

export const useFCM = () => {
  const registered = useRef(false);

  useEffect(() => {
    const requestPermissionAndRegister = async () => {
      if (registered.current) return;
      
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('Notification permission granted.');
          const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
          
          if (currentToken) {
            console.log('FCM Token retrieved:', currentToken);
            // Send token to backend
            const auth = getAuth();
            const idToken = await auth.currentUser?.getIdToken();
            if (idToken) {
              await fetch('http://localhost:5000/api/profile/device-token', {
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
        console.error('An error occurred while retrieving token. ', err);
      }
    };

    const unsubscribe = getAuth().onAuthStateChanged((user) => {
      if (user) {
        requestPermissionAndRegister();
      }
    });

    const onMessageListener = onMessage(messaging, (payload) => {
      console.log('Message received. ', payload);
      // Can show toast notification here if desired
    });

    return () => {
      unsubscribe();
      // To properly clean up onMessage is tricky as it doesn't return an unsubscribe directly in all versions, 
      // but typically we can ignore it since useFCM is mounted once in App.
    };
  }, []);
};
