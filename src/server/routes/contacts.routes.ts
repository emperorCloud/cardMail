import { Router } from 'express';
import { z } from 'zod';
import { store } from '../db/store.ts';
import { type AuthenticatedRequest, requireAuth, verifyCsrf } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth);

const contactSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(120),
  email: z.string().email('Adresse e-mail invalide').max(255),
  organization: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

router.get('/', async (req: AuthenticatedRequest, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const contacts = await store.listContacts(req.authUser!.id);
  const filtered = q
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.organization || '').toLowerCase().includes(q)
      )
    : contacts;
  return res.json({ data: filtered });
});

router.post('/', verifyCsrf, async (req: AuthenticatedRequest, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Données invalides.' });
  }
  try {
    const created = await store.createContact(req.authUser!.id, parsed.data);
    return res.status(201).json({ data: created });
  } catch (err: unknown) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Erreur création contact.' });
  }
});

router.patch('/:contactId', verifyCsrf, async (req: AuthenticatedRequest, res) => {
  const parsed = contactSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Données invalides.' });
  }
  const updated = await store.updateContact(req.authUser!.id, String(req.params.contactId), parsed.data);
  if (!updated) {
    return res.status(404).json({ error: 'Contact introuvable.' });
  }
  return res.json({ data: updated });
});

router.delete('/:contactId', verifyCsrf, async (req: AuthenticatedRequest, res) => {
  const deleted = await store.deleteContact(req.authUser!.id, String(req.params.contactId));
  if (!deleted) {
    return res.status(404).json({ error: 'Contact introuvable.' });
  }
  return res.json({ success: true });
});

export default router;
