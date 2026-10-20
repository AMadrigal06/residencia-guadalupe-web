// =====================================================================
// Conexión con la API de Residencias Guadalupe (ver GUIA-PORTAL-WEB.md)
// La URL se puede cambiar para pruebas con ?api=http://localhost:8099/api/v1/
// =====================================================================
export const API_DEFAULT = "https://jmuq4nqote.execute-api.us-east-1.amazonaws.com/api/v1/";
export const API_BASE = (() => {
  try {
    const q = new URLSearchParams(window.location.search).get("api");
    if (q && /^https?:\/\//.test(q)) return q.endsWith("/") ? q : q + "/";
  } catch (e) {}
  return API_DEFAULT;
})();
export const API_ORIGIN = new URL(API_BASE).origin;
export const MODO_PRUEBA = API_BASE !== API_DEFAULT ? API_BASE.replace(/^https?:\/\//, "").replace(/\/api\/v1\/$/, "") : null;

// Sesión en memoria (no se guarda en el navegador). alExpirar lo registra la app (js/app/sesion.js).
export const sesion = { token: null, alExpirar: null };

function expiro() {
  sesion.token = null;
  if (sesion.alExpirar) sesion.alExpirar();
}

export async function api(path, { method = "GET", body, headers = {}, auth = true, noExpira = false } = {}) {
  const url = new URL(path, API_BASE);
  if (!url.href.startsWith(API_BASE)) throw new Error("Ruta de API inválida");
  const h = new Headers(headers);
  h.set("Accept", "application/json");
  if (auth) {
    if (!sesion.token) throw Object.assign(new Error("Su sesión terminó. Vuelva a entrar."), { status: 401 });
    h.set("Authorization", "Bearer " + sesion.token);
  }
  const multipart = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !multipart) h.set("Content-Type", "application/json");
  let response;
  try {
    response = await fetch(url, {
      method, headers: h, credentials: "omit", cache: "no-store",
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body)
    });
  } catch (e) {
    throw Object.assign(new Error("No hay conexión con el servidor. Revise su internet e intente de nuevo."), { status: 0, red: true });
  }
  const text = response.status === 204 ? "" : await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch (e) { /* respuesta no JSON (p. ej. HTML de AWS) */ }
  if (!response.ok) {
    const err = Object.assign(new Error(mensajeError(response.status, payload)), {
      status: response.status,
      code: payload && payload.error ? payload.error.code : null,
      details: payload && payload.error ? payload.error.details : null,
      requestId: response.headers.get("X-Request-Id") || (payload && payload.error ? payload.error.requestId : null),
      retryAfter: response.headers.get("Retry-After")
    });
    if (auth && response.status === 401 && !noExpira) expiro();
    throw err;
  }
  if (response.status !== 204 && payload === null) throw new Error("El servidor respondió algo inesperado. Intente de nuevo.");
  return { payload, etag: response.headers.get("ETag") };
}

// Descarga un archivo privado (foto o PDF) y devuelve una URL local (blob:), o null si la sesión terminó.
export async function descargarArchivo(contentUrl) {
  const url = new URL(contentUrl, API_ORIGIN);
  if (url.origin !== API_ORIGIN) throw new Error("Origen de archivo inválido");
  const r = await fetch(url, { headers: { Authorization: "Bearer " + sesion.token }, credentials: "omit", cache: "no-store" });
  if (r.status === 401) { expiro(); return null; }
  if (!r.ok) throw new Error(String(r.status));
  const blob = URL.createObjectURL(await r.blob());
  if (!sesion.token) { URL.revokeObjectURL(blob); return null; }
  return blob;
}

function mensajeError(status, payload) {
  const m = payload && payload.error && payload.error.message;
  if (status === 429) return "Demasiados intentos. Espere un momento e intente de nuevo.";
  if (status === 408 || status === 504) return "El servidor tardó demasiado. Intente de nuevo.";
  if (status >= 500) return "El servidor tuvo un problema. Intente de nuevo en un momento.";
  if (status === 413) return "El archivo es demasiado grande.";
  if (status === 415) return "Ese tipo de archivo no se admite.";
  if (status === 403 && !m) return "No tiene permiso para hacer esto.";
  if (status === 404 && !m) return "Ya no existe o no está disponible.";
  return m || "No se pudo completar la solicitud (" + status + ").";
}
