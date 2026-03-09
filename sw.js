// sw.js
const CACHE_VERSION = "v2"; // <-- cambia a v3, v4, etc. por release
const CACHE_NAME = `flashcards-${CACHE_VERSION}`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js"
];

// Install: precache básico (la activación se controla desde la app)
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    await Promise.all(
      CORE_ASSETS.map(async (url) => {
        const req = new Request(url, { cache: "reload" });
        const res = await fetch(req);
        await cache.put(url, res);
      })
    );

    // NOTA: no forzamos skipWaiting aquí. Dejamos que la app controle la activación
    // mediante el mensaje SKIP_WAITING cuando el usuario decide actualizar.
  })());
});

// Activate: limpia caches viejos + toma control de clientes
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

// Permite que la página diga: "actívate ya"
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch: HTML (navegación) => Network First
//        resto => Cache First
self.addEventListener("fetch", (event) => {
  
  const req = event.request;
  if (req.method !== "GET") return;

const url = new URL(req.url);

  // ✅ Novedades: siempre traer de red (no cachear)
  if (url.pathname.endsWith("/novedades.json")) {
    event.respondWith(fetch(req));
    return;
  }
  const isNavigation =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    event.respondWith(networkFirstHTML(req));
    return;
  }

  event.respondWith(cacheFirst(req));
});

async function networkFirstHTML(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    // Guardar el HTML actualizado para offline
    cache.put("./index.html", fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match("./index.html");
    return cached || new Response("Offline", { status: 503 });
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;

  const fresh = await fetch(req);
  const cache = await caches.open(CACHE_NAME);
  cache.put(req, fresh.clone());
  return fresh;
}


