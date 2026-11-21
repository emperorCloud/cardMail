/**
 * Nettoyage HTML côté serveur contre les injections XSS stockées ou transmises
 * (complémentaire à DOMPurify côté client dans src/lib/sanitize.ts).
 */
export function sanitizeServerHtml(raw: string): string {
  if (!raw) return '';
  return raw
    // Supprime les balises dangereuses et leur contenu
    .replace(/<(script|style|iframe|object|embed|applet|form|meta|link|base)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|applet|form|meta|link|base)[^>]*\/?>/gi, '')
    // Supprime les attributs d'événements inline (onclick, onerror, onload, etc.)
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Neutralise javascript:, vbscript:, data:text/html dans href/src
    .replace(/(href|src)\s*=\s*(["'])\s*(?:javascript:|vbscript:|data:text\/html)[^"']*\2/gi, '$1="#"')
    .trim();
}
