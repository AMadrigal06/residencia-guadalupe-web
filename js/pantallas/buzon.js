// Pantalla: Buzón de notificaciones del residente (#/avisos, menú «Avisos»).
// Plantilla: pantallas/portal/buzon.html
import { api } from "../api/cliente.js";
import { instanteTxt } from "../utilidades/fechas.js";
import { qs } from "../utilidades/formatos.js";
import { masDe } from "../utilidades/vista.js";
import { LISTA_VACIA } from "../app/estado.js";

export const Buzon = B => class extends B {
  // Número del globito rojo del menú; se revisa cada minuto (ver js/app/sesion.js)
  async cargarUnread() {
    if (!this.esResidente()) return;
    try { const { payload } = await api("notifications/unread-count"); this.setState({ unread: payload.data.unreadCount }); } catch (e) {}
  }
  async cargarNotifs(reset) {
    const prev = reset ? Object.assign({ unread: this.state.unread }, LISTA_VACIA) : this.state.notifs;
    const page = prev.page + 1;
    this.setState({ notifs: Object.assign({}, prev, { cargando: true, error: "" }) });
    try {
      const { payload } = await api("notifications?" + qs({ page, limit: 30 }));
      const items = reset ? payload.data : prev.items.concat(payload.data);
      const unread = payload.meta && typeof payload.meta.unreadCount === "number" ? payload.meta.unreadCount : this.state.unread;
      this.setState({ notifs: { items, page, total: payload.meta ? payload.meta.total : items.length, cargando: false, error: "", unread }, unread });
    } catch (e) {
      this.setState(s => ({ notifs: Object.assign({}, s.notifs, { cargando: false, error: e.message }) }));
    }
  }
  async marcarNotif(n) {
    try { await api("notifications/" + n.id + "/read", { method: "PUT" }); } catch (e) { if (e.status !== 404) this.falla(e); }
    this.cargarNotifs(true); this.cargarUnread();
  }
  marcarTodas = async () => {
    try { const { payload } = await api("notifications/read-all", { method: "POST" }); this.setState({ unread: payload.data.unreadCount }); this.cargarNotifs(true); this.aviso("Todo quedó como leído.", false); }
    catch (e) { this.falla(e); }
  };
  retirarLeidas = async () => {
    try { const { payload } = await api("notifications/archive-read", { method: "POST" }); this.cargarNotifs(true); this.aviso(payload.data.archived === 1 ? "Se quitó 1 notificación leída." : "Se quitaron " + payload.data.archived + " notificaciones leídas.", false); }
    catch (e) { this.falla(e); }
  };

  vistaBuzon(c) {
    const s = c.s;
    return {
      notifs: s.notifs.items.map(n => ({
        cls: "p-card" + (n.isRead ? " leida" : ""), nueva: !n.isRead, titulo: n.title, texto: n.body,
        cuando: instanteTxt(n.createdAt), conPost: !!n.postId, soloMarcar: !n.postId && !n.isRead,
        abrir: () => this.abrirPost(n.postId, n), marcar: () => this.marcarNotif(n)
      })),
      notifsCargando: s.notifs.cargando,
      notifsError: s.notifs.error || null,
      notifsReintentar: () => this.cargarNotifs(true),
      notifsHayMas: masDe(s.notifs),
      notifsMas: () => this.cargarNotifs(false),
      hayNoLeidas: s.unread > 0,
      hayLeidas: s.notifs.items.some(n => n.isRead),
      sinNotifs: !s.notifs.cargando && !s.notifs.error && s.notifs.items.length === 0,
      marcarLeidas: this.marcarTodas,
      retirarLeidas: this.retirarLeidas
    };
  }
};
