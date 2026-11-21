import { Mail, Pencil, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import React, { useState } from 'react';
import { apiFetch } from '../../lib/api.ts';
import { getInitials } from '../../lib/utils.ts';
import type { ContactItem } from '../../types/cardmail.ts';
import { Button, Dialog, DialogContent, Input } from '../ui/primitives.tsx';

interface ContactsViewProps {
  contacts: ContactItem[];
  onRefresh: () => Promise<void>;
  onComposeTo: (email: string) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({ contacts, onRefresh, onComposeTo }) => {
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContactItem | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setEmail('');
    setOrganization('');
    setPhone('');
    setNotes('');
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (c: ContactItem) => {
    setEditing(c);
    setName(c.name);
    setEmail(c.email);
    setOrganization(c.organization || '');
    setPhone(c.phone || '');
    setNotes(c.notes || '');
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        email,
        organization: organization || null,
        phone: phone || null,
        notes: notes || null,
      };
      if (editing) {
        await apiFetch(`/api/contacts/${encodeURIComponent(editing.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/contacts', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur d\'enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/contacts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await onRefresh();
  };

  const filtered = contacts.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.organization || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-6 lg:p-8 dark:bg-[#070C1C]">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
              Carnet d'adresses
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Vos contacts personnels privés · {contacts.length} entrée{contacts.length > 1 ? 's' : ''}
            </p>
          </div>
          <Button onClick={openCreate}>
            <UserPlus className="h-4 w-4" />
            <span>Nouveau contact</span>
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par nom, e-mail ou organisation…"
            className="pl-9"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Aucun contact trouvé
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Ajoutez vos correspondants pour activer l'autocomplétion lors de la rédaction.
            </p>
            <Button variant="outline" size="sm" onClick={openCreate} className="mt-4">
              <Plus className="h-4 w-4" />
              <span>Ajouter un contact</span>
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Collaborateur / Partenaire</th>
                    <th className="px-4 py-3">Adresse e-mail</th>
                    <th className="hidden md:table-cell px-4 py-3">Organisation</th>
                    <th className="hidden lg:table-cell px-4 py-3">Téléphone</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 font-display text-xs font-semibold text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                            {getInitials(c.name)}
                          </div>
                          <span className="font-medium text-slate-900 dark:text-white">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                        {c.email}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {c.organization || '—'}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {c.phone || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onComposeTo(c.email)}
                            title="Envoyer un message"
                          >
                            <Mail className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(c)}
                            title="Modifier"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDelete(c.id)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          title={editing ? 'Modifier le contact' : 'Nouveau contact'}
          className="max-w-md"
        >
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
              {error}
            </div>
          )}
          <form onSubmit={handleSave} className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Nom complet</label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Adresse e-mail</label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Organisation</label>
              <Input value={organization} onChange={(e) => setOrganization(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Téléphone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
