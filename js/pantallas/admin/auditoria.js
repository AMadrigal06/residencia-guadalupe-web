// Pantalla: Administración › Registro de cambios (#/admin/auditoria, solo admin).
// Plantilla: pantallas/admin/auditoria.html
import { api } from "../../api/cliente.js";
import { fechaHoraTxt } from "../../utilidades/fechas.js";
import { qs } from "../../utilidades/formatos.js";
import { segCls, masDe } from "../../utilidades/vista.js";
import { accionTxt } from "../../app/catalogos.js";
import { LISTA_VACIA } from "../../app/estado.js";

export const Auditoria = B => class extends B {
  async cargarAudit(reset) {
    const prev = reset ? Object.assign({}, LISTA_VACIA) : this.state.audit;
    const page = prev.page + 1;
    const req = (this._auReq = (this._auReq || 0) + 1);
    this.setState({ audit: Object.assign({}, prev, { cargando: true, error: "" }) });
    try {
      const { payload } = await api("audit-logs?" + qs({ page, limit: 30, entityType: this.state.auFiltro || null }));
      if (req !== this._auReq) return;
      const items = reset ? payload.data : prev.items.concat(payload.data);
      this.setState({ audit: { items, page, total: payload.meta ? payload.meta.total : items.length, cargando: false, error: "" } });
      // Nombres de quienes aparecen, para no mostrar solo números
      const faltan = [...new Set(payload.data.map(a => a.actorId).filter(id => id && !(this._nombres || {})[id]))];
      this._nombres = this._nombres || {};
      faltan.slice(0, 15).forEach(async id => {
        try { const r = await api("users/" + id); this._nombres[id] = r.payload.data.fullName; this.setState({}); } catch (e) { this._nombres[id] = "Usuario " + id; }
      });
    } catch (e) {
      if (req !== this._auReq) return;
      this.setState(s => ({ audit: Object.assign({}, s.audit, { cargando: false, error: e.message }) }));
    }
  }

  vistaAuditoria(c) {
    const s = c.s;
    return {
      auFiltros: [["", "Todo"], ["user", "Usuarios"], ["post", "Publicaciones"], ["media", "Archivos"], ["session", "Sesiones"]].map(f => ({
        nombre: f[1], cls: segCls(s.auFiltro === f[0]), elegir: () => { this.setState({ auFiltro: f[0] }); setTimeout(() => this.cargarAudit(true), 0); }
      })),
      auLista: s.audit.items.map(a => {
        const quien = a.actorId ? ((this._nombres || {})[a.actorId] || "Usuario " + a.actorId) : "El sistema";
        return { cuando: fechaHoraTxt(a.createdAt), texto: quien + " · " + accionTxt(a) };
      }),
      auHay: s.audit.items.length > 0,
      auCargando: s.audit.cargando,
      auError: s.audit.error || null,
      auReintentar: () => this.cargarAudit(s.audit.items.length === 0),
      auVacio: !s.audit.cargando && !s.audit.error && s.audit.page > 0 && s.audit.items.length === 0,
      auHayMas: masDe(s.audit),
      auMas: () => this.cargarAudit(false)
    };
  }
};
