import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const VAPID_PUBLIC_KEY = 'BB6aKY8EOVprxgbw0LycgltTUncBdJVJz-sD_uwU5LDFbw1QNRnHJvrkRuQAj5Puo7arKHHkMob0XFUZK3F5DwE';

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(('Notification' in window) ? Notification.permission : 'default');

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    setSubscription(sub);
  };

  const subscribe = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        toast.error('Permission for notifications denied');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      await axios.post('/notifications/subscribe', { subscription: sub });
      setSubscription(sub);
      toast.success('Push notifications enabled!');
    } catch (err) {
      console.error('Failed to subscribe:', err);
      toast.error('Could not enable push notifications');
    }
  };

  const unsubscribe = async () => {
    try {
      if (subscription) {
        await subscription.unsubscribe();
        await axios.post('/notifications/unsubscribe', { subscription });
        setSubscription(null);
        toast.success('Push notifications disabled');
      }
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
      toast.error('Could not disable push notifications');
    }
  };

  return { isSupported, subscription, permission, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
