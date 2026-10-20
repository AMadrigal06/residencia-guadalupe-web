// ---------- Catálogos y traducciones API <-> pantalla ----------

export const TIPOS = { notice: "Aviso", menu: "Menú", event: "Evento" };
export const TIPOS_API = { "Aviso": "notice", "Menú": "menu", "Evento": "event" };
export const COMIDAS = { breakfast: "Desayuno", lunch: "Comida", dinner: "Cena", daily: "Todo el día" };
export const COMIDA_ORDEN = { breakfast: "08:00", lunch: "14:00", dinner: "19:00", daily: "00:00" };
export const ROLES = { resident: "Residente", employee: "Personal", admin: "Administración" };
export const ESTADOS = { pending: "Pendiente", active: "Activa", disabled: "Baja" };

// Filtros del muro
export const FILTROS = [
  { nombre: "Todo", q: {} },
  { nombre: "Avisos", q: { category: "Aviso" } },
  { nombre: "Actividades", q: { category: "Actividad" } },
  { nombre: "Eventos", q: { category: "Evento" } },
  { nombre: "Noticias", q: { category: "Noticia" } },
  { nombre: "Fotografías", q: { hasImage: "true" } }
];
// Tamaños de letra (Perfil)
export const ESCALAS = [{ nombre: "A-", k: 0.9, fs: "15px" }, { nombre: "A", k: 1, fs: "18px" }, { nombre: "A+", k: 1.15, fs: "21px" }];
export const REACCIONES = [{ id: "like", icono: "👍", nombre: "Me gusta" }, { id: "love", icono: "❤️", nombre: "Me encanta" }, { id: "happy", icono: "😊", nombre: "Me alegra" }];
// Archivos que se pueden adjuntar y su peso máximo
export const LIMITE_ARCHIVO = { "image/jpeg": 5000000, "image/png": 5000000, "application/pdf": 9000000 };

// ---------- Registro de cambios (auditoría) ----------
const ACCIONES = { created: "creó", create: "creó", updated: "editó", update: "editó", deleted: "eliminó", delete: "eliminó", pinned: "fijó", unpinned: "dejó de fijar", archived: "archivó", published: "publicó", republished: "republicó", approved: "aprobó", disabled: "dio de baja", enabled: "reactivó", revoked: "cerró", uploaded: "subió", read: "leyó", credentials_updated: "cambió la clave de", credentials_reset: "repuso la clave de" };
const ACCION_SESION = { created: "inició sesión", revoked: "cerró sesión", deleted: "cerró sesión" };
const ENTIDADES = { user: "usuario", post: "publicación", media: "archivo", session: "sesión", preferences: "preferencias", notification: "notificación" };

// "post.pinned" -> "fijó · publicación #27"; "session.created" -> "inició sesión"
export const accionTxt = a => {
  const partes = String(a.action || "").split(".");
  const verbo = partes.length > 1 ? partes.slice(1).join("_") : partes[0];
  const ent = partes.length > 1 ? partes[0] : a.entityType;
  if (ent === "session") return ACCION_SESION[verbo] || "sesión: " + verbo;
  return (ACCIONES[verbo] || verbo.replace(/_/g, " ")) + " · " + (ENTIDADES[ent] || ENTIDADES[a.entityType] || ent) + (a.entityId ? " #" + a.entityId : "");
};
