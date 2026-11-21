import { createRequire } from 'node:module';
import type webPushType from 'web-push';
import { serverEnv } from '../config/env.ts';
import { store } from '../db/store.ts';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof webPushType;

class PushService {
  private configured = false;

  private ensureConfigured(): { publicKey: string; privateKey: string } {
    if (serverEnv.vapidPublicKey && serverEnv.vapidPrivateKey) {
      if (!this.configured) {
        webpush.setVapidDetails(
          serverEnv.vapidSubject,
          serverEnv.vapidPublicKey,
          serverEnv.vapidPrivateKey
        );
        this.configured = true;
      }
      return {
        publicKey: serverEnv.vapidPublicKey,
        privateKey: serverEnv.vapidPrivateKey,
      };
    }

    throw new Error('Clés VAPID absentes : définissez VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY.');
  }

  public getPublicKey(): string {
    return this.ensureConfigured().publicKey;
  }

  public async sendToUser(
    userId: string,
    payload: { title: string; body: string; url?: string; tag?: string }
  ): Promise<void> {
    try { this.ensureConfigured(); } catch { return; }
    const pref = await store.getPreference(userId);
    if (!pref.pushEnabled) return;

    const subscriptions = await store.listPushSubscriptions(userId);
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await store.removePushSubscription(userId, sub.endpoint);
        }
      }
    }
  }
}

export const pushService = new PushService();
