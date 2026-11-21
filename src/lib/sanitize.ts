import DOMPurify from 'dompurify';

export function sanitizeEmailHtml(dirtyHtml: string): string {
  const clean = DOMPurify.sanitize(dirtyHtml, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button', 'meta', 'link', 'style'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'srcdoc'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });

  // Ajoute rel="noopener noreferrer" target="_blank" à tous les liens externes
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  const links = doc.querySelectorAll('a[href]');
  links.forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!/^https?:|^mailto:/i.test(href)) {
      a.removeAttribute('href');
    } else {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  });
  return doc.body.innerHTML;
}
