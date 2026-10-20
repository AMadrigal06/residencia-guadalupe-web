// Validaciones y formatos pequeños que usan varias pantallas.

export const CORREO_OK = c => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(c.trim());
export const soloDigitos = v => (v || "").replace(/\D/g, "");
export const telOk = v => !v || /^\d{10}$/.test(soloDigitos(v));

// login = true no revisa el largo de la contraseña (cuentas viejas pueden tener otra regla)
export const validarClave = (tipo, clave, login) => {
  if (!clave) return tipo === "pin" ? "Escriba su PIN" : "Escriba su contraseña";
  if (tipo === "pin" && !/^\d{4,6}$/.test(clave)) return "El PIN lleva de 4 a 6 números";
  if (!login && tipo === "pass" && (clave.length < 8 || clave.length > 128)) return "La contraseña lleva de 8 a 128 caracteres";
  return null;
};
// "pass" | "pin" (pantalla) -> "password" | "pin" (API)
export const metodoApi = t => (t === "pin" ? "pin" : "password");

// { page: 1, q: "" } -> "page=1" (omite vacíos)
export const qs = obj => {
  const q = new URLSearchParams();
  Object.keys(obj).forEach(k => { if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") q.set(k, String(obj[k])); });
  return q.toString();
};
export const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "k" + Date.now() + Math.random().toString(16).slice(2);
