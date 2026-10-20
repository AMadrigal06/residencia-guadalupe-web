// Servidor de PRUEBA que imita la API (GUIA-PORTAL-WEB.md) con datos inventados. NO es el backend real.
// Uso: node pruebas/servidor-prueba.js 8099  y abrir  http://localhost:5173/?api=http://localhost:8099/api/v1/
// Cuentas: admin@prueba.com PIN 1234 · empleado@prueba.com / empleado123 · residente@prueba.com / residente123 · pendiente@prueba.com PIN 2580
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const PORT = Number(process.argv[2] || 8099);
const LOG = [];

const now = () => new Date();
const iso = d => d.toISOString();
const mxDate = (d = now()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(d);
const addDays = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mxToUtc = (date, time) => new Date(date + "T" + time + ":00-06:00").toISOString();

let seq = 100;
const nid = () => String(++seq);
const users = [];
const sessions = {};
const posts = [];
const media = {};
const notifs = [];
const reads = {};      // userId:postId -> readAt
const reacts = {};     // postId -> {userId: type}
const audits = [];
const idem = {};

function mkUser(fullName, email, role, status, authMethod, secret, rp, sp) {
  const u = { id: nid(), fullName, email, role, status, authMethod, secret, emailVerifiedAt: null, approvedBy: null, approvedAt: status === "active" ? iso(now()) : null,
    createdAt: iso(now()), updatedAt: iso(now()), residentProfile: rp || null, staffProfile: sp || null, preferences: { notifyNotices: true, notifyActivities: true, notifyPhotos: false } };
  users.push(u); return u;
}
const admin = mkUser("José Francisco González", "admin@prueba.com", "admin", "active", "pin", "1234", null, { area: "Recepción" });
const emp = mkUser("Rocío Beltrán", "empleado@prueba.com", "employee", "active", "password", "empleado123", null, { area: "Enfermería" });
const res = mkUser("Sebastián Ruiz Mendoza", "residente@prueba.com", "resident", "active", "password", "residente123",
  { phone: "7771234567", department: "1", admissionDate: "2026-09-23", roomLocation: "Ala sur", familyContact: { fullName: "Mariana Ruiz", relationship: "Hija", phone: "5512345678" } });
mkUser("Alfonso Rivera Lugo", "pendiente@prueba.com", "resident", "pending", "pin", "2580", null);
mkUser("Josefina Ortiz", "baja@prueba.com", "resident", "disabled", "password", "josefina12", null);

function addMedia(file, mime, name, owner) {
  const m = { id: nid(), postId: null, originalName: name, mimeType: mime, sizeBytes: 0, altText: name, sortOrder: 0, createdAt: iso(now()), owner, data: fs.readFileSync(path.join(__dirname, file)) };
  m.sizeBytes = m.data.length; m.contentUrl = "/api/v1/media/" + m.id + "/content"; media[m.id] = m; return m;
}
function mkPost(o, author, daysAgo) {
  const p = Object.assign({ id: nid(), type: "notice", category: "Aviso", title: "", body: "", status: "published", isPinned: false,
    menuDate: null, mealType: null, eventStartAt: null, eventEndAt: null, eventLocation: null, expiresAt: null, version: 1,
    attachmentIds: [], createdAt: iso(now()), updatedAt: iso(now()) }, o);
  p.authorId = author.id; p.publishedAt = iso(new Date(Date.now() - (daysAgo || 0) * 86400e3 - 3600e3));
  p.attachmentIds.forEach(id => { media[id].postId = p.id; });
  posts.push(p); return p;
}
const H = mxDate();
const m1 = addMedia("chiles.jpg", "image/jpeg", "chiles.jpg", admin.id);
const m2 = addMedia("jardin.jpg", "image/jpeg", "jardin.jpg", emp.id);
const m3 = addMedia("programa.pdf", "application/pdf", "programa-octubre.pdf", admin.id);
mkPost({ type: "menu", category: "Evento", title: "Chiles en nogada", body: "Los invitamos por un chilito en nogada.", menuDate: H, mealType: "dinner", isPinned: true, attachmentIds: [m1.id] }, admin, 1);
mkPost({ type: "event", category: "Actividad", title: "Taller de jardinería", body: "Sembramos las macetas de temporada.", eventStartAt: mxToUtc(addDays(H, 1), "11:00"), eventEndAt: mxToUtc(addDays(H, 1), "12:30"), eventLocation: "Jardín central", attachmentIds: [m2.id] }, emp, 2);
mkPost({ type: "notice", category: "Aviso", title: "Programa del mes", body: "Consulte el programa de actividades en el PDF.", attachmentIds: [m3.id] }, admin, 3);
mkPost({ type: "notice", category: "Noticia", title: "Bienvenida a nuevos residentes", body: "Este mes llegaron tres vecinos nuevos." }, admin, 40);
mkPost({ type: "notice", category: "Aviso", title: "Aviso archivado viejo", body: "Ya no aplica.", status: "archived" }, admin, 50);
posts.forEach(p => { if (p.status === "published") notifs.push({ id: nid(), userId: res.id, type: "post", title: p.title, body: p.body.slice(0, 120), createdAt: p.publishedAt, isRead: p.id !== posts[0].id ? true : false, readAt: null, postId: p.id, archived: false }); });

// ---------- utilidades HTTP ----------
function send(res, status, body, headers = {}) {
  const h = Object.assign({ "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "X-Request-Id,ETag,Retry-After", "X-Request-Id": crypto.randomUUID() }, headers);
  if (status === 204) { res.writeHead(204, h); return res.end(); }
  if (Buffer.isBuffer(body)) { res.writeHead(status, h); return res.end(body); }
  h["Content-Type"] = "application/json";
  res.writeHead(status, h); res.end(JSON.stringify(body));
}
const err = (res, status, code, message, details) => send(res, status, { error: { code, message, requestId: "req-" + Date.now(), details: details || null } });
const vfail = (res, details) => err(res, 422, "VALIDATION_FAILED", "Revise los datos marcados.", details);
const readBody = req => new Promise(r => { const c = []; req.on("data", d => c.push(d)); req.on("end", () => r(Buffer.concat(c))); });
function strict(obj, allowed) { return Object.keys(obj || {}).filter(k => !allowed.includes(k)).map(k => ({ field: k, message: "Campo no permitido." })); }
function pubUser(u) { const o = Object.assign({}, u); delete o.secret; if (o.residentProfile) o.residentProfile = Object.assign({}, o.residentProfile, { roomNumber: o.residentProfile.department }); return o; }
function visibleTo(p, u) {
  if (u.role === "admin") return true;
  if (u.role === "employee") return p.authorId === u.id || (p.status === "published" && !(p.expiresAt && new Date(p.expiresAt) < now()));
  return p.status === "published" && !(p.expiresAt && new Date(p.expiresAt) < now());
}
function pubPost(p, u) {
  const a = users.find(x => x.id === p.authorId);
  const r = reacts[p.id] || {};
  const counts = { like: 0, love: 0, happy: 0 }; Object.values(r).forEach(t => counts[t]++);
  const o = Object.assign({}, p, {
    author: { id: a.id, fullName: a.fullName, area: a.staffProfile ? a.staffProfile.area : null },
    isRead: u.role === "resident" ? !!reads[u.id + ":" + p.id] : false,
    attachments: p.attachmentIds.map(id => { const m = Object.assign({}, media[id]); delete m.data; delete m.owner; return m; }),
    reactions: { counts, total: Object.keys(r).length, myReaction: r[u.id] || null }
  });
  delete o.authorId; delete o.attachmentIds; return o;
}
function audit(actor, action, entityType, entityId) { audits.unshift({ id: nid(), actorId: actor ? actor.id : null, action, entityType, entityId, requestId: "req", createdAt: iso(now()) }); }
function page(q) { return { page: Math.max(1, Number(q.get("page") || 1)), limit: Math.min(100, Math.max(1, Number(q.get("limit") || 20))) }; }
function list(res, arr, q, extraMeta) { const { page: pg, limit } = page(q); send(res, 200, { data: arr.slice((pg - 1) * limit, pg * limit), meta: Object.assign({ page: pg, limit, total: arr.length }, extraMeta || {}) }); }

function validatePost(b, creating, u, existing) {
  const d = [];
  const base = ["category", "title", "body", "isPinned", "attachmentIds", "expiresAt", "menuDate", "mealType", "eventStartAt", "eventEndAt", "eventLocation"];
  d.push(...strict(b, creating ? base.concat("type") : base));
  const type = creating ? b.type : existing.type;
  if (!["notice", "menu", "event"].includes(type)) d.push({ field: "type", message: "Tipo inválido." });
  if (!b.title || b.title.length > 150) d.push({ field: "title", message: "El título es obligatorio." });
  if (!b.body || b.body.length > 5000) d.push({ field: "body", message: "El cuerpo es obligatorio." });
  if (!["Aviso", "Actividad", "Evento", "Noticia"].includes(b.category)) d.push({ field: "category", message: "Categoría inválida." });
  if (type === "menu") { if (!/^\d{4}-\d\d-\d\d$/.test(b.menuDate || "")) d.push({ field: "menuDate", message: "Fecha de menú obligatoria." }); if (!["breakfast", "lunch", "dinner", "daily"].includes(b.mealType)) d.push({ field: "mealType", message: "Comida inválida." }); }
  else if (b.menuDate !== undefined || b.mealType !== undefined) d.push({ field: "menuDate", message: "Solo para menús." });
  if (type === "event") {
    if (!b.eventStartAt) d.push({ field: "eventStartAt", message: "Inicio obligatorio." });
    if (!b.eventEndAt || new Date(b.eventEndAt) < new Date(b.eventStartAt)) d.push({ field: "eventEndAt", message: "El fin debe ser posterior al inicio." });
    if (!b.eventLocation || b.eventLocation.length > 120) d.push({ field: "eventLocation", message: "Ubicación obligatoria." });
  } else if (b.eventStartAt !== undefined) d.push({ field: "eventStartAt", message: "Solo para eventos." });
  if (b.expiresAt && new Date(b.expiresAt) <= now()) d.push({ field: "expiresAt", message: "El vencimiento debe ser futuro." });
  if ((b.attachmentIds || []).length > 1) d.push({ field: "attachmentIds", message: "Máximo un adjunto." });
  (b.attachmentIds || []).forEach(id => { const m = media[id]; if (!m || (m.postId && (!existing || m.postId !== existing.id)) || (!m.postId && m.owner !== u.id)) d.push({ field: "attachmentIds", message: "Adjunto no disponible." }); });
  if (u.role === "employee") { const want = !!b.isPinned, had = existing ? existing.isPinned : false; if (want !== had) d.push({ field: "isPinned", message: "Solo admin puede fijar." }); }
  return d;
}
function multipart(buf, ctype) {
  const bnd = "--" + (ctype.match(/boundary=(.+)$/) || [])[1];
  const parts = {}; let s = buf.toString("latin1");
  s.split(bnd).forEach(p => {
    const i = p.indexOf("\r\n\r\n"); if (i < 0) return;
    const head = p.slice(0, i); const name = (head.match(/name="([^"]+)"/) || [])[1]; if (!name) return;
    const body = Buffer.from(p.slice(i + 4, p.length - 2), "latin1");
    parts[name] = { filename: (head.match(/filename="([^"]*)"/) || [])[1], type: (head.match(/Content-Type: (.+)/i) || [])[1], data: body };
  });
  return parts;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  LOG.push(req.method + " " + url.pathname + url.search);
  if (req.method === "OPTIONS") return send(res, 204, null, { "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE", "Access-Control-Allow-Headers": req.headers["access-control-request-headers"] || "" });
  if (url.pathname === "/__log") return send(res, 200, { data: LOG });
  const p = url.pathname.replace(/^\/api\/v1\//, "").replace(/\/$/, "");
  const raw = await readBody(req);
  let b = {};
  const ct = req.headers["content-type"] || "";
  if (raw.length && ct.includes("application/json")) { try { b = JSON.parse(raw.toString()); } catch (e) { return err(res, 400, "BAD_JSON", "JSON inválido"); } }
  const q = url.searchParams;
  const M = req.method;

  if (p === "health") return send(res, 200, { data: { status: "ok" } });
  if (p === "ready") return send(res, 200, { data: { status: "ready" } });
  if (p === "auth/register" && M === "POST") {
    const d = strict(b, ["fullName", "email", "authMethod", "secret"]);
    if (!b.fullName || b.fullName.length < 2) d.push({ field: "fullName", message: "Nombre obligatorio." });
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(b.email || "")) d.push({ field: "email", message: "Correo inválido." });
    if (b.authMethod === "pin" ? !/^\d{4,6}$/.test(b.secret || "") : (b.secret || "").length < 8) d.push({ field: "secret", message: "Credencial inválida." });
    if (d.length) return vfail(res, d);
    if (users.some(u => u.email === b.email.toLowerCase())) return err(res, 409, "EMAIL_TAKEN", "El correo ya está registrado.");
    const u = mkUser(b.fullName, b.email.toLowerCase(), "resident", "pending", b.authMethod, b.secret, null);
    audit(null, "create", "user", u.id);
    return send(res, 201, { data: pubUser(u) });
  }
  if (p === "auth/login" && M === "POST") {
    const d = strict(b, ["email", "authMethod", "secret", "clientType"]);
    if (d.length) return vfail(res, d);
    const u = users.find(x => x.email === (b.email || "").toLowerCase());
    if (!u || u.authMethod !== b.authMethod || u.secret !== b.secret) return err(res, 401, "INVALID_CREDENTIALS", "Credenciales incorrectas.");
    if (u.status === "pending") return err(res, 403, "ACCOUNT_PENDING", "Cuenta pendiente.");
    if (u.status === "disabled") return err(res, 403, "ACCOUNT_DISABLED", "Cuenta deshabilitada.");
    const tok = crypto.randomBytes(16).toString("hex"); sessions[tok] = u.id;
    audit(u, "login", "session", tok.slice(0, 6));
    return send(res, 200, { data: { user: pubUser(u), accessToken: tok, tokenType: "Bearer", expiresAt: iso(new Date(Date.now() + 8 * 3600e3)) } });
  }
  // ---- autenticadas ----
  const tok = (req.headers.authorization || "").replace(/^Bearer /, "");
  const me = users.find(u => u.id === sessions[tok]);
  if (!me) return err(res, 401, "UNAUTHENTICATED", "Token Bearer requerido.");
  if (me.status !== "active") return err(res, 403, "ACCOUNT_DISABLED", "Cuenta deshabilitada.");
  const isAdmin = me.role === "admin", isStaff = me.role !== "resident";
  let mm;

  if (p === "auth/me" && M === "GET") return send(res, 200, { data: pubUser(me) });
  if (p === "auth/me" && M === "PATCH") { const d = strict(b, ["fullName"]); if (!b.fullName) d.push({ field: "fullName", message: "Obligatorio" }); if (d.length) return vfail(res, d); me.fullName = b.fullName; return send(res, 200, { data: pubUser(me) }); }
  if (p === "auth/me/credentials" && M === "PUT") {
    if (b.currentSecret !== me.secret) return err(res, 401, "INVALID_CREDENTIALS", "La credencial actual no es correcta.");
    me.authMethod = b.authMethod; me.secret = b.secret; return send(res, 204);
  }
  if (p === "auth/me/preferences") { if (M === "PUT") { const d = strict(b, ["notifyNotices", "notifyActivities", "notifyPhotos"]); if (d.length) return vfail(res, d); me.preferences = b; } return send(res, 200, { data: me.preferences }); }
  if (p === "auth/logout" && M === "POST") { delete sessions[tok]; return send(res, 204); }

  if (p === "posts" && M === "GET") {
    const st = q.get("status") || "published";
    if (me.role === "resident" && st !== "published") return err(res, 403, "FORBIDDEN", "Sin permiso.");
    for (const k of q.keys()) if (!["page", "limit", "status", "type", "category", "hasImage", "pinned", "eventFrom", "eventTo", "publishedBefore", "sort"].includes(k)) return vfail(res, [{ field: k, message: "Filtro no permitido." }]);
    let arr = posts.filter(x => visibleTo(x, me));
    if (st !== "all") arr = arr.filter(x => x.status === st);
    if (me.role === "employee" && st !== "published") arr = arr.filter(x => x.authorId === me.id);
    if (q.get("type")) arr = arr.filter(x => x.type === q.get("type"));
    if (q.get("category")) arr = arr.filter(x => x.category === q.get("category"));
    if (q.get("hasImage")) arr = arr.filter(x => x.attachmentIds.some(id => media[id].mimeType.startsWith("image/")) === (q.get("hasImage") === "true"));
    if (q.get("eventFrom")) arr = arr.filter(x => x.eventStartAt && x.eventStartAt >= q.get("eventFrom"));
    if (q.get("eventTo")) arr = arr.filter(x => x.eventStartAt && x.eventStartAt < q.get("eventTo"));
    if (q.get("publishedBefore")) arr = arr.filter(x => x.publishedAt < q.get("publishedBefore"));
    const sort = q.get("sort") || "-pinned,-publishedAt";
    arr.sort((a, c) => sort === "eventStartAt" ? (a.eventStartAt > c.eventStartAt ? 1 : -1) : sort === "-publishedAt" ? (a.publishedAt < c.publishedAt ? 1 : -1) : ((c.isPinned - a.isPinned) || (a.publishedAt < c.publishedAt ? 1 : -1)));
    return list(res, arr.map(x => pubPost(x, me)), q);
  }
  if (p === "posts" && M === "POST") {
    if (!isStaff) return err(res, 403, "FORBIDDEN", "Sin permiso.");
    const key = req.headers["idempotency-key"];
    if (key && idem[key]) { if (idem[key].body !== JSON.stringify(b)) return err(res, 409, "IDEMPOTENCY_CONFLICT", "Clave reutilizada con otros datos."); return send(res, 201, { data: pubPost(idem[key].post, me) }, { ETag: '"' + idem[key].post.version + '"' }); }
    const d = validatePost(b, true, me, null); if (d.length) return vfail(res, d);
    const np = mkPost(Object.assign({}, b, { attachmentIds: b.attachmentIds || [] }), me, 0); np.publishedAt = iso(now());
    if (key) idem[key] = { body: JSON.stringify(b), post: np };
    users.filter(u => u.role === "resident" && u.status === "active").forEach(u => notifs.unshift({ id: nid(), userId: u.id, type: "post", title: np.title, body: np.body.slice(0, 120), createdAt: iso(now()), isRead: false, readAt: null, postId: np.id, archived: false }));
    audit(me, "create", "post", np.id);
    return send(res, 201, { data: pubPost(np, me) }, { ETag: '"1"' });
  }
  if ((mm = p.match(/^posts\/(\d+)(?:\/(status|pin|read|reaction))?$/))) {
    const post = posts.find(x => x.id === mm[1]);
    if (!post || !visibleTo(post, me)) return err(res, 404, "NOT_FOUND", "Publicación no encontrada.");
    const sub = mm[2];
    const own = isAdmin || post.authorId === me.id;
    if (!sub && M === "GET") return send(res, 200, { data: pubPost(post, me) }, { ETag: '"' + post.version + '"' });
    if (!sub && M === "PUT") {
      if (!isStaff || !own) return err(res, 403, "FORBIDDEN", "Sin permiso.");
      if (req.headers["if-match"] && req.headers["if-match"] !== '"' + post.version + '"') return err(res, 409, "VERSION_CONFLICT", "Otra persona modificó la publicación.");
      if (b.type) return vfail(res, [{ field: "type", message: "No se puede cambiar el tipo." }]);
      const d = validatePost(b, false, me, post); if (d.length) return vfail(res, d);
      post.attachmentIds.forEach(id => { if (!(b.attachmentIds || []).includes(id)) media[id].postId = null; });
      Object.assign(post, { menuDate: null, mealType: null, eventStartAt: null, eventEndAt: null, eventLocation: null }, b, { isPinned: !!b.isPinned, expiresAt: b.expiresAt || null, attachmentIds: b.attachmentIds || [] });
      post.attachmentIds.forEach(id => { media[id].postId = post.id; });
      post.version++; post.updatedAt = iso(now()); audit(me, "update", "post", post.id);
      return send(res, 200, { data: pubPost(post, me) }, { ETag: '"' + post.version + '"' });
    }
    if (!sub && M === "DELETE") { if (!isAdmin) return err(res, 403, "FORBIDDEN", "Sin permiso."); posts.splice(posts.indexOf(post), 1); for (let i = notifs.length - 1; i >= 0; i--) if (notifs[i].postId === post.id) notifs.splice(i, 1); audit(me, "delete", "post", post.id); return send(res, 204); }
    if (sub === "status" && M === "PATCH") {
      if (!isStaff || !own) return err(res, 403, "FORBIDDEN", "Sin permiso.");
      if (b.status === "published" && post.expiresAt && new Date(post.expiresAt) < now()) return err(res, 409, "INVALID_STATUS_TRANSITION", "La publicación está vencida.");
      post.status = b.status; post.isPinned = false; post.version++; audit(me, "update", "post", post.id); return send(res, 200, { data: pubPost(post, me) });
    }
    if (sub === "pin" && M === "PATCH") { if (!isAdmin) return err(res, 403, "FORBIDDEN", "Sin permiso."); if (post.status !== "published") return err(res, 409, "INVALID_STATUS_TRANSITION", "Solo publicadas."); post.isPinned = !!b.isPinned; post.version++; return send(res, 200, { data: pubPost(post, me) }); }
    if (sub === "read" && M === "PUT") {
      if (me.role !== "resident") return err(res, 403, "FORBIDDEN", "Solo residentes.");
      const k = me.id + ":" + post.id; reads[k] = reads[k] || iso(now());
      notifs.filter(n => n.userId === me.id && n.postId === post.id).forEach(n => { n.isRead = true; n.readAt = n.readAt || iso(now()); });
      return send(res, 200, { data: { read: true, readAt: reads[k] } });
    }
    if (sub === "reaction") {
      if (me.role !== "resident") return err(res, 403, "FORBIDDEN", "Solo residentes.");
      reacts[post.id] = reacts[post.id] || {};
      if (M === "PUT") { if (!["like", "love", "happy"].includes(b.type)) return vfail(res, [{ field: "type", message: "Inválida" }]); reacts[post.id][me.id] = b.type; }
      else delete reacts[post.id][me.id];
      return send(res, 200, { data: pubPost(post, me).reactions });
    }
  }
  if (p === "media" && M === "POST") {
    if (!isStaff) return err(res, 403, "FORBIDDEN", "Sin permiso.");
    const parts = multipart(raw, ct); const f = parts.file;
    if (!f) return vfail(res, [{ field: "file", message: "Archivo obligatorio." }]);
    const lim = { "image/jpeg": 5e6, "image/png": 5e6, "application/pdf": 9e6 }[f.type];
    if (!lim) return err(res, 415, "UNSUPPORTED_MEDIA_TYPE", "Formato no admitido.");
    if (f.data.length > lim) return err(res, 413, "PAYLOAD_TOO_LARGE", "Archivo demasiado grande.");
    const m = { id: nid(), postId: null, originalName: f.filename, mimeType: f.type, sizeBytes: f.data.length, altText: parts.altText ? parts.altText.data.toString() : null, sortOrder: 0, createdAt: iso(now()), owner: me.id, data: f.data };
    m.contentUrl = "/api/v1/media/" + m.id + "/content"; media[m.id] = m; audit(me, "create", "media", m.id);
    const o = Object.assign({}, m); delete o.data; delete o.owner; return send(res, 201, { data: o });
  }
  if ((mm = p.match(/^media\/(\d+)(\/content)?$/))) {
    const m = media[mm[1]]; if (!m) return err(res, 404, "NOT_FOUND", "No encontrado.");
    if (mm[2] && M === "GET") return send(res, 200, m.data, { "Content-Type": m.mimeType, "Cache-Control": "private, no-store" });
    if (!mm[2] && M === "DELETE") { if (m.postId) return err(res, 409, "MEDIA_IN_USE", "Archivo en uso."); delete media[m.id]; return send(res, 204); }
  }
  if (p.startsWith("notifications")) {
    if (me.role !== "resident") return err(res, 403, "FORBIDDEN", "Solo residentes.");
    const mine = notifs.filter(n => n.userId === me.id && !n.archived);
    const unreadCount = mine.filter(n => !n.isRead).length;
    if (p === "notifications" && M === "GET") { let arr = mine; if (q.get("read")) arr = arr.filter(n => n.isRead === (q.get("read") === "true")); return list(res, arr.map(n => { const o = Object.assign({}, n); delete o.userId; delete o.archived; return o; }), q, { unreadCount }); }
    if (p === "notifications/unread-count") return send(res, 200, { data: { unreadCount } });
    if (p === "notifications/read-all") { mine.forEach(n => { n.isRead = true; }); return send(res, 200, { data: { updated: unreadCount, unreadCount: 0 } }); }
    if (p === "notifications/archive-read") { const r = mine.filter(n => n.isRead); r.forEach(n => { n.archived = true; }); return send(res, 200, { data: { archived: r.length } }); }
    if ((mm = p.match(/^notifications\/(\d+)\/read$/))) { const n = mine.find(x => x.id === mm[1]); if (!n) return err(res, 404, "NOT_FOUND", "No encontrada"); n.isRead = true; return send(res, 200, { data: n }); }
  }
  if (p.startsWith("users") || p === "audit-logs") {
    if (!isAdmin) return err(res, 403, "FORBIDDEN", "Sin permiso.");
    if (p === "audit-logs") { let arr = audits; if (q.get("entityType")) arr = arr.filter(a => a.entityType === q.get("entityType")); return list(res, arr, q); }
    if (p === "users" && M === "GET") {
      let arr = users.slice();
      if (q.get("status")) arr = arr.filter(u => u.status === q.get("status"));
      if (q.get("role")) arr = arr.filter(u => u.role === q.get("role"));
      if (q.get("q")) arr = arr.filter(u => (u.fullName + " " + u.email).toLowerCase().includes(q.get("q").toLowerCase()));
      return list(res, arr.map(pubUser), q);
    }
    const checkProfile = (b, role) => {
      const d = [];
      if (role === "resident" && b.staffProfile) d.push({ field: "staffProfile", message: "No aplica." });
      if (role !== "resident" && b.residentProfile) d.push({ field: "residentProfile", message: "No aplica." });
      if (b.residentProfile === null) d.push({ field: "residentProfile", message: "No puede ser null." });
      const r = b.residentProfile;
      if (r) {
        d.push(...strict(r, ["phone", "department", "admissionDate", "roomLocation", "familyContact"]).map(x => ({ field: "residentProfile." + x.field, message: x.message })));
        if (!r.department) d.push({ field: "residentProfile.department", message: "Habitación obligatoria." });
        if (!r.admissionDate || r.admissionDate > mxDate()) d.push({ field: "residentProfile.admissionDate", message: "Fecha inválida." });
        if (r.phone && !/^\d{10}$/.test(r.phone)) d.push({ field: "residentProfile.phone", message: "10 dígitos." });
        if (r.familyContact && !/^\d{10}$/.test(r.familyContact.phone || "")) d.push({ field: "residentProfile.familyContact.phone", message: "10 dígitos." });
      }
      return d;
    };
    if (p === "users" && M === "POST") {
      const d = strict(b, ["fullName", "email", "role", "authMethod", "secret", "residentProfile", "staffProfile"]).concat(checkProfile(b, b.role));
      if (b.role === "resident" && !b.residentProfile) d.push({ field: "residentProfile", message: "Obligatorio para residentes." });
      if (d.length) return vfail(res, d);
      if (users.some(u => u.email === b.email.toLowerCase())) return err(res, 409, "EMAIL_TAKEN", "El correo ya está registrado.");
      const u = mkUser(b.fullName, b.email.toLowerCase(), b.role, "active", b.authMethod, b.secret, b.residentProfile, b.staffProfile);
      audit(me, "create", "user", u.id); return send(res, 201, { data: pubUser(u) });
    }
    if ((mm = p.match(/^users\/(\d+)(\/credentials)?$/))) {
      const u = users.find(x => x.id === mm[1]); if (!u) return err(res, 404, "NOT_FOUND", "No encontrado.");
      if (!mm[2] && M === "GET") return send(res, 200, { data: pubUser(u) });
      if (mm[2] && M === "PUT") { u.authMethod = b.authMethod; u.secret = b.secret; Object.keys(sessions).forEach(k => { if (sessions[k] === u.id) delete sessions[k]; }); audit(me, "update", "user", u.id); return send(res, 204); }
      if (!mm[2] && M === "PUT") {
        const d = strict(b, ["fullName", "role", "status", "residentProfile", "staffProfile"]).concat(checkProfile(b, b.role));
        if (!b.fullName || !b.role || !b.status) d.push({ field: "status", message: "fullName, role y status obligatorios." });
        if (d.length) return vfail(res, d);
        if (u.id === me.id && (b.status !== "active" || b.role !== "admin")) return err(res, 409, "SELF_LOCKOUT", "No puede deshabilitarse ni degradarse a sí mismo.");
        if (u.status === "pending" && b.status === "active") { u.approvedBy = me.id; u.approvedAt = iso(now()); }
        Object.assign(u, { fullName: b.fullName, role: b.role, status: b.status });
        if (b.residentProfile) u.residentProfile = b.residentProfile;
        if (b.staffProfile) u.staffProfile = b.staffProfile;
        if (b.status !== "active") Object.keys(sessions).forEach(k => { if (sessions[k] === u.id) delete sessions[k]; });
        audit(me, b.status === "disabled" ? "disable" : "update", "user", u.id);
        return send(res, 200, { data: pubUser(u) });
      }
    }
  }
  return err(res, 404, "NOT_FOUND", "Ruta no encontrada: " + M + " " + p);
}).listen(PORT, () => console.log("mock en http://localhost:" + PORT + "/api/v1/"));
