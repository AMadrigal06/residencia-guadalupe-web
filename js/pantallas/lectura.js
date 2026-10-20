// Ventana: leer un aviso completo (se abre desde muro, hoy, buzón y administración).
// Plantilla: pantallas/comunes/lectura.html
import { api } from "../api/cliente.js";

export const Lectura = B => class extends B {
  async abrirPost(id, notif) {
    this.callar();
    this.setState({ leyendo: null, leyendoCargando: true });
    try {
      const { payload } = await api("posts/" + id);
      let p = payload.data;
      this.setState({ leyendo: p, leyendoCargando: false });
      (p.attachments || []).forEach(m => this.pedirMedio(m));
      // Al residente se le marca como leído
      if (this.esResidente() && p.status === "published" && !p.isRead) {
        try {
          const r = await api("posts/" + p.id + "/read", { method: "PUT" });
          p = Object.assign({}, p, { isRead: true, readAt: r.payload.data.readAt });
          this.actualizarPost(p);
          this.cargarUnread();
          if (this.state.tab === "avisos") this.cargarNotifs(true);
        } catch (e) { /* no impide leer */ }
      }
    } catch (e) {
      this.setState({ leyendoCargando: false });
      if (e.status === 404 || e.status === 403) {
        this.aviso("Ese aviso ya no está disponible.", false);
        this.quitarPost(id);
        if (notif && !notif.isRead) this.marcarNotif(notif);
      }
      else this.falla(e);
    }
  }

  async reaccionar(p, tipo) {
    const mia = p.reactions && p.reactions.myReaction;
    try {
      const { payload } = mia === tipo
        ? await api("posts/" + p.id + "/reaction", { method: "DELETE" })
        : await api("posts/" + p.id + "/reaction", { method: "PUT", body: { type: tipo } });
      this.actualizarPost(Object.assign({}, this.state.leyendo && this.state.leyendo.id === p.id ? this.state.leyendo : p, { reactions: payload.data }));
    } catch (e) { this.falla(e); }
  }

  vistaLectura(c) {
    const s = c.s;
    return {
      hayLectura: !!s.leyendo || s.leyendoCargando,
      lecturaCargando: s.leyendoCargando,
      lectura: s.leyendo ? [this.tarjeta(s.leyendo)] : [],
      cerrarLectura: () => { this.callar(); this.setState({ leyendo: null, leyendoCargando: false }); }
    };
  }
};
