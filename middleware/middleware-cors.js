// Middleware CORS configurable para múltiples orígenes
const allowedOrigins = [
  // Desarrollo local
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8080',
  'http://localhost:3000',
  
  // Producción - Desde variables de entorno
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.ADMIN_URL ? [process.env.ADMIN_URL] : []),
  ...(process.env.BACKEND_URL ? [process.env.BACKEND_URL] : []),
  
  // Orígenes adicionales desde CORS_ORIGINS (separados por coma)
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()) : []),
  
  // Fallback para producción si no hay variables de entorno configuradas
  ...(process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL ? [
    'https://sifrah.vercel.app',
    'https://sifrah-admin.vercel.app',
    'https://admin-moringa.vercel.app',
    'https://app-moringa.vercel.app',
  ] : []),

  // Moringa (siempre en prod aunque exista FRONTEND_URL de otro proyecto)
  'https://admin-moringa.vercel.app',
  'https://app-moringa.vercel.app',
];  

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;

  // Permitir despliegues preview de Vercel para evitar bloqueos CORS en pruebas.
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;

  return false;
}

function setAllowOriginHeader(req, res) {
  const origin = req.headers.origin;

  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV !== 'production') {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8081');
  } else if (origin) {
    // Fallback defensivo: evita "Failed to fetch" por CORS en dominios productivos nuevos.
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
}

function corsMiddleware(req, res, next) {
  setAllowOriginHeader(req, res);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-file-name, x-dir, sentry-trace, baggage');
  
  // Manejar preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (next) next();
}

// Función para aplicar CORS a una respuesta específica
function applyCORS(req, res) {
  setAllowOriginHeader(req, res);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-file-name, x-dir, sentry-trace, baggage');
}

module.exports = {
  corsMiddleware,
  applyCORS
}; 