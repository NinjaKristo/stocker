export const STATIC_SITE_MODE = String(import.meta.env.VITE_STATIC_SITE || '').toLowerCase() === 'true';

export const getStaticDataUrl = (relativePath = 'manifest.json') => {
  const normalizedPath = String(relativePath).replace(/^\/+/, '');
  const configuredBase = String(import.meta.env.VITE_STATIC_DATA_BASE_URL || '').trim();
  if (configuredBase) {
    const normalizedBase = configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`;
    return `${normalizedBase}${normalizedPath}`;
  }
  return `${import.meta.env.BASE_URL}static-data/${normalizedPath}`;
};
