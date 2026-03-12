import webpush from 'web-push';
import pool from '../db';

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const mailto = process.env.VAPID_MAILTO || 'mailto:admin@8wut.org';

if (publicKey && privateKey) {
  webpush.setVapidDetails(mailto, publicKey, privateKey);
}

export async function sendPushNotification(userId: string, payload: any) {
  try {
    const { rows } = await pool.query(
      'SELECT subscription FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    const promises = rows.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify(payload));
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription expired or no longer valid
          console.log('Removing invalid subscription for user:', userId);
          await pool.query(
            'DELETE FROM push_subscriptions WHERE user_id = $1 AND subscription = $2',
            [userId, JSON.stringify(row.subscription)]
          );
        } else {
          console.error('Error sending push notification:', err);
        }
      }
    });

    await Promise.all(promises);
  } catch (err) {
    console.error('Push notification system error:', err);
  }
}
