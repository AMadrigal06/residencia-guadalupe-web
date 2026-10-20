// Cómo se muestra una publicación (aviso, menú o evento) en cualquier lista:
// muro, ventana de lectura, avisos publicados y confirmación de guardado.
import { partesMx, diaCorto, horaTxt, instanteTxt } from "../utilidades/fechas.js";
import { TIPOS, COMIDAS, REACCIONES } from "./catalogos.js";

export const Tarjetas = B => class extends B {
  // "Martes 20 · Cena" o "Miércoles 21 · 11:00 a. m. a 12:30 p. m. · Jardín"
  cuandoTxt(p) {
    if (p.type === "menu" && p.menuDate) return diaCorto(p.menuDate) + " · " + (COMIDAS[p.mealType] || "Menú");
    if (p.type === "event" && p.eventStartAt) {
      const a = partesMx(new Date(p.eventStartAt)), b = p.eventEndAt ? partesMx(new Date(p.eventEndAt)) : null;
      return diaCorto(a.fecha) + " · " + horaTxt(a.hora) + (b && b.fecha === a.fecha && b.hora !== a.hora ? " a " + horaTxt(b.hora) : "") + (p.eventLocation ? " · " + p.eventLocation : "");
    }
    return "";
  }

  tarjeta(p) {
    const s = this.state;
    const m = (p.attachments || [])[0];
    const esFoto = m && m.mimeType && m.mimeType.indexOf("image/") === 0;
    const esPdf = m && m.mimeType === "application/pdf";
    const blob = m ? s.medios[m.id] : null;
    const re = p.reactions || { counts: {}, total: 0, myReaction: null };
    const vencido = p.expiresAt && new Date(p.expiresAt).getTime() < Date.now();
    return {
      id: p.id, titulo: p.title, texto: p.body, categoria: p.category, fijado: !!p.isPinned,
      nuevo: this.esResidente() && p.isRead === false,
      meta: [instanteTxt(p.publishedAt || p.createdAt), p.author ? p.author.fullName : ""].filter(Boolean).join(" · "),
      strong: this.cuandoTxt(p) || null,
      adminMeta: [TIPOS[p.type], this.cuandoTxt(p), p.author ? p.author.fullName : "", p.publishedAt ? "publicado " + instanteTxt(p.publishedAt).toLowerCase() : ""].filter(Boolean).join(" · "),
      estadoTxt: p.status === "archived" ? "Archivado" : p.status === "draft" ? "Borrador" : vencido ? "Vencido" : null,
      foto: esFoto && blob && blob !== "error" ? blob : null,
      fotoAlt: m && m.altText ? m.altText : "Fotografía del aviso",
      pdf: esPdf && blob && blob !== "error" ? blob : null,
      pdfCargando: esPdf && !blob,
      pdfNombre: esPdf ? m.originalName : null,
      reaccionesTxt: re.total ? REACCIONES.filter(r => re.counts[r.id]).map(r => r.icono + " " + re.counts[r.id]).join("  ") : null,
      puedeReaccionar: this.esResidente() && p.status === "published",
      reacciones: REACCIONES.map(r => ({ icono: r.icono, nombre: r.nombre, n: re.counts[r.id] || "", cls: re.myReaction === r.id ? "on" : "", elegir: () => this.reaccionar(p, r.id) })),
      leer: () => this.abrirPost(p.id),
      escuchar: () => this.escuchar(p),
      escucharTxt: s.hablando === p.id ? "Detener" : "Escuchar",
      detener: e => e.stopPropagation()
    };
  }
};
