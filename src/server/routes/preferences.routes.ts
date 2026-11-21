import { Router } from 'express';
import { z } from 'zod';
import { store } from '../db/store.ts';
import { type AuthenticatedRequest, requireAuth, verifyCsrf } from '../middleware/auth.ts';
import { sanitizeServerHtml } from '../utils/sanitize.ts';

const router = Router();
router.use(requireAuth);

const prefSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  signatureHtml: z.string().max(4000).optional(),
  pushEnabled: z.boolean().optional(),
  compactDensity: z.boolean().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().max(512).nullable().optional(),
});

router.get('/', async (req: AuthenticatedRequest, res) => {
  const pref = await store.getPreference(req.authUser!.id);
  return res.json({ data: pref });
});

router.patch('/', verifyCsrf, async (req: AuthenticatedRequest, res) => {
  const parsed = prefSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Préférences invalides.' });
  }
  const { firstName, lastName, avatarUrl, ...prefPatch } = parsed.data;
  if (prefPatch.signatureHtml !== undefined) {
    prefPatch.signatureHtml = sanitizeServerHtml(prefPatch.signatureHtml);
  }
  if (firstName !== undefined || lastName !== undefined || avatarUrl !== undefined) {
    await store.updateUser(req.authUser!.id, {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    });
  }
  const updatedPref = await store.updatePreference(req.authUser!.id, prefPatch);
  const updatedUser = await store.findUserById(req.authUser!.id);
  return res.json({
    data: updatedPref,
    user: updatedUser ? store.toPublicUser(updatedUser) : req.authUser,
  });
});

export default router;
