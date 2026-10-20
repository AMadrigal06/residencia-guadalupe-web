// ---------- Fechas (zona de negocio: America/Mexico_City) ----------
const TZ = "America/Mexico_City";
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const pad = n => (n < 10 ? "0" : "") + n;
const FMT = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// Partes de un instante en hora de CDMX
export const partesMx = d => {
  const o = {};
  FMT.formatToParts(d).forEach(p => { o[p.type] = p.value; });
  return { fecha: o.year + "-" + o.month + "-" + o.day, hora: o.hour + ":" + o.minute };
};
export const hoyIso = () => partesMx(new Date()).fecha;

// "2026-10-20" + "10:00" en CDMX -> ISO UTC
export const mxAUtc = (fecha, hora) => {
  const f = fecha.split("-").map(Number), h = (hora || "00:00").split(":").map(Number);
  const guess = Date.UTC(f[0], f[1] - 1, f[2], h[0], h[1]);
  const ver = t => { const p = partesMx(new Date(t)); const a = p.fecha.split("-").map(Number), b = p.hora.split(":").map(Number); return Date.UTC(a[0], a[1] - 1, a[2], b[0], b[1]); };
  let t = guess - (ver(guess) - guess);
  t = t - (ver(t) - guess);
  return new Date(t).toISOString();
};

// Fechas de calendario (YYYY-MM-DD), sin zona
export const deIso = s => { const p = s.split("-").map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); };
export const masDias = (s, n) => { const d = deIso(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const diaCorto = s => { const d = deIso(s); return DIAS[d.getUTCDay()] + " " + d.getUTCDate(); };
export const diaLargo = s => { const d = deIso(s); return DIAS[d.getUTCDay()] + " " + d.getUTCDate() + " de " + MESES[d.getUTCMonth()] + " de " + d.getUTCFullYear(); };
export const lunes = () => { const h = hoyIso(); return masDias(h, -((deIso(h).getUTCDay() + 6) % 7)); };
export const horaTxt = h => {
  if (!h) return "";
  const p = h.split(":").map(Number);
  return (p[0] % 12 === 0 ? 12 : p[0] % 12) + ":" + pad(p[1]) + (p[0] < 12 ? " a. m." : " p. m.");
};
export const instanteTxt = iso => { if (!iso) return ""; const p = partesMx(new Date(iso)); return diaCorto(p.fecha) + " · " + horaTxt(p.hora); };
export const fechaHoraTxt = iso => { if (!iso) return ""; const p = partesMx(new Date(iso)); return diaLargo(p.fecha) + " · " + horaTxt(p.hora); };
export const saludo = () => { const h = Number(partesMx(new Date()).hora.slice(0, 2)); return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"; };
