// Pantalla: Administración › Avisos publicados (#/admin/avisos).  Plantilla: pantallas/admin/avisos.html
// Personal: edita y archiva los suyos. Admin: además fija y elimina cualquiera.
import { api } from "../../api/cliente.js";
import { qs } from "../../utilidades/formatos.js";
import { segCls, masDe } from "../../utilidades/vista.js";
import { LISTA_VACIA } from "../../app/estado.js";

export const AdminAvisos = B => class extends B {
  async cargarAdminPosts(reset) {
    const prev = reset ? Object.assign({}, LISTA_VACIA) : this.state.adminPosts;
    const page = prev.page + 1;
    const req = (this._apReq = (this._apReq || 0) + 1);
    this.setState({ adminPosts: Object.assign({}, prev, { cargando: true, error: "" }) });
    try {
      const { payload } = await api("posts?" + qs({ status: this.state.apFiltro, page, limit: 20, sort: "-publishedAt" }));
      if (req !== this._apReq) return;
      const items = reset ? payload.data : prev.items.concat(payload.data.filter(p => !prev.items.some(x => x.id === p.id)));
      this.setState({ adminPosts: { items, page, total: payload.meta ? payload.meta.total : items.length, cargando: false, error: "" } });
    } catch (e) {
      if (req !== this._apReq) return;
      this.setState(s => ({ adminPosts: Object.assign({}, s.adminPosts, { cargando: false, error: e.message }) }));
    }
  }

  async fijar(p, valor, silencioso) {
    try {
      const { payload } = await api("posts/" + p.id + "/pin", { method: "PATCH", body: { isPinned: valor } });
      this.actualizarPost(payload.data);
      if (!silencioso) this.aviso(valor ? "Se fijó como importante en el muro." : "Ya no está fijado en el muro.", () => this.fijar(payload.data, !valor, true));
    } catch (e) { this.falla(e); }
  }

  async cambiarEstado(p, estado, silencioso) {
    try {
      const { payload } = await api("posts/" + p.id + "/status", { method: "PATCH", body: { status: estado } });
      const filtro = this.state.apFiltro;
      if (filtro !== "all" && filtro !== estado) this.quitarPost(p.id); else this.actualizarPost(payload.data);
      this.setState(s => ({ muro: Object.assign({}, s.muro, { items: estado === "published" ? s.muro.items : s.muro.items.filter(x => x.id !== p.id) }) }));
      if (!silencioso) this.aviso(estado === "archived" ? "Se archivó. Ya no se ve en el muro." : "Regresó al muro.", () => this.cambiarEstado(payload.data, estado === "archived" ? "published" : "archived", true).then(() => this.cargarAdminPosts(true)));
    } catch (e) {
      if (e.code === "INVALID_STATUS_TRANSITION" || e.status === 422) this.aviso((e.message || "No se puede cambiar el estado.") + " Si ya venció, edítelo y cambie la fecha de «mostrar hasta».", false);
      else this.falla(e);
    }
  }

  pedirEliminar(p) {
    this.setState({ confirm: {
      titulo: "¿Eliminar este aviso?",
      texto: "«" + p.title + "» se borrará para siempre junto con su archivo, lecturas y notificaciones. No se puede deshacer. Si solo quiere quitarlo del muro, mejor archívelo.",
      boton: "Sí, eliminar para siempre",
      accion: async () => {
        await api("posts/" + p.id, { method: "DELETE" });
        this.quitarPost(p.id);
        this.aviso("Se eliminó «" + p.title + "».", false);
      }
    } });
  }

  vistaAdminAvisos(c) {
    const s = c.s, yo = c.yo, esAdmin = c.esAdmin, ap = s.adminPosts;
    const puede = p => esAdmin || (p.author && p.author.id === yo.id);
    return {
      apSub: esAdmin ? "Aquí se edita, se fija y se archiva lo que ven los residentes." : "Aquí edita y archiva sus avisos. Fijar y eliminar le toca a la administración.",
      apFiltros: [["published", "En el muro"], ["archived", "Archivados"], ["all", "Todos"]].map(f => ({
        nombre: f[1], cls: segCls(s.apFiltro === f[0]), elegir: () => { this.setState({ apFiltro: f[0] }); setTimeout(() => this.cargarAdminPosts(true), 0); }
      })),
      adminAvisos: ap.items.map(p => {
        const acciones = [];
        if (puede(p)) acciones.push({ nombre: "Editar", hacer: () => this.editarAviso(p) });
        if (esAdmin && p.status === "published") acciones.push({ nombre: p.isPinned ? "No fijar" : "Fijar", hacer: () => this.fijar(p, !p.isPinned) });
        if (puede(p) && p.status !== "draft") acciones.push({ nombre: p.status === "archived" ? "Republicar" : "Archivar", hacer: () => this.cambiarEstado(p, p.status === "archived" ? "published" : "archived") });
        if (esAdmin) acciones.push({ nombre: "Eliminar", cls: "del", hacer: () => this.pedirEliminar(p) });
        return Object.assign(this.tarjeta(p), { acciones: acciones.map(a => Object.assign({ cls: "" }, a)), conAcciones: acciones.length > 0 });
      }),
      apCargando: ap.cargando,
      apError: ap.error || null,
      apReintentar: () => this.cargarAdminPosts(ap.items.length === 0),
      apVacio: !ap.cargando && !ap.error && ap.page > 0 && ap.items.length === 0,
      apHayMas: masDe(ap),
      apMas: () => this.cargarAdminPosts(false)
    };
  }
};
