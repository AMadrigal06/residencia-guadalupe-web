// Pantalla: Administración › Usuarios y residentes (#/admin/usuarios, solo admin).
// Plantilla: pantallas/admin/usuarios.html · Al abrir una cuenta se va a js/pantallas/admin/ficha.js
import { api } from "../../api/cliente.js";
import { qs } from "../../utilidades/formatos.js";
import { segCls, masDe } from "../../utilidades/vista.js";
import { ROLES, ESTADOS } from "../../app/catalogos.js";
import { LISTA_VACIA } from "../../app/estado.js";

export const Usuarios = B => class extends B {
  // Números de las pestañas (Pendientes (3), Activas (20)…) y del globito de Perfil
  async cargarConteos() {
    try {
      const r = await Promise.all(["pending", "active", "disabled"].map(st => api("users?" + qs({ status: st, limit: 1 }))));
      const c = { pending: r[0].payload.meta.total, active: r[1].payload.meta.total, disabled: r[2].payload.meta.total };
      c.all = c.pending + c.active + c.disabled;
      this.setState({ uConteos: c });
    } catch (e) {}
  }

  async cargarUsuarios(reset) {
    const s = this.state;
    const prev = reset ? Object.assign({}, LISTA_VACIA) : s.usuarios;
    const page = prev.page + 1;
    const req = (this._uReq = (this._uReq || 0) + 1);
    this.setState({ usuarios: Object.assign({}, prev, { cargando: true, error: "" }) });
    try {
      const { payload } = await api("users?" + qs({ status: s.uFiltro === "all" ? null : s.uFiltro, q: s.uQuery || null, page, limit: 20 }));
      if (req !== this._uReq) return;
      const items = reset ? payload.data : prev.items.concat(payload.data);
      this.setState({ usuarios: { items, page, total: payload.meta ? payload.meta.total : items.length, cargando: false, error: "" } });
    } catch (e) {
      if (req !== this._uReq) return;
      this.setState(st => ({ usuarios: Object.assign({}, st.usuarios, { cargando: false, error: e.message }) }));
    }
  }

  vistaUsuarios(c) {
    const s = c.s, us = s.usuarios, n = s.uConteos;
    const buscar = () => {
      const q = s.uQuery && s.uBusqueda.trim() === s.uQuery ? "" : s.uBusqueda.trim().slice(0, 100);
      this.setState({ uQuery: q, uBusqueda: q });
      setTimeout(() => this.cargarUsuarios(true), 0);
    };
    return {
      uFiltros: [["pending", "Pendientes"], ["active", "Activas"], ["disabled", "Bajas"], ["all", "Todas"]].map(f => ({
        nombre: f[1] + (typeof n[f[0]] === "number" ? " (" + n[f[0]] + ")" : ""), cls: segCls(s.uFiltro === f[0]),
        elegir: () => { this.setState({ uFiltro: f[0] }); setTimeout(() => this.cargarUsuarios(true), 0); }
      })),
      uBusqueda: s.uBusqueda,
      uSetBusqueda: e => this.setState({ uBusqueda: e.target.value }),
      uEnter: e => { if (e.key === "Enter") buscar(); },
      uBuscar: buscar,
      uBuscarTxt: s.uQuery && s.uBusqueda.trim() === s.uQuery ? "Limpiar" : "Buscar",
      uAlta: this.nuevaFicha,
      uLista: us.items.map(u => {
        const r = u.residentProfile;
        return {
          nombre: u.fullName, rol: ROLES[u.role] || u.role, estado: ESTADOS[u.status] || u.status,
          estadoCls: "p-pill " + (u.status === "pending" ? "pend" : u.status === "active" ? "act" : "baja"),
          detalle: u.email + (r && (r.roomNumber || r.department) ? " · Habitación " + (r.roomNumber || r.department) : u.staffProfile && u.staffProfile.area ? " · " + u.staffProfile.area : ""),
          abrir: () => this.abrirFicha(u)
        };
      }),
      uCargando: us.cargando,
      uError: us.error || null,
      uReintentar: () => this.cargarUsuarios(us.items.length === 0),
      uVacio: !us.cargando && !us.error && us.page > 0 && us.items.length === 0,
      uVacioTitulo: s.uQuery ? "Nadie coincide con la búsqueda" : s.uFiltro === "pending" ? "No hay solicitudes pendientes" : "No hay cuentas aquí",
      uVacioTexto: s.uQuery ? "Revise cómo está escrito el nombre o el correo." : s.uFiltro === "pending" ? "Cuando alguien cree su cuenta desde la app o la página, aparecerá aquí para que la apruebe." : "Cambie el filtro para ver otras cuentas.",
      uHayMas: masDe(us),
      uMas: () => this.cargarUsuarios(false)
    };
  }
};
