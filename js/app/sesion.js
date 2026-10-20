// Sesión: qué pasa al entrar, al salir y cuando la sesión vence.
// El formulario de entrada está en js/pantallas/login.js.
import { api, sesion } from "../api/cliente.js";
import { LOGIN_VACIO, reiniciarEstado } from "./estado.js";

export const Sesion = B => class extends B {
  componentDidMount() {
    super.componentDidMount();
    sesion.alExpirar = () => this.sesionTerminada("Su sesión terminó. Vuelva a entrar con su correo.");
  }
  componentWillUnmount() { super.componentWillUnmount(); this.limpiarSesion(); }

  iniciarSesion(d) {
    sesion.token = d.accessToken;
    const ms = d.expiresAt ? new Date(d.expiresAt).getTime() - Date.now() : 8 * 3600e3;
    if (this._exp) clearTimeout(this._exp);
    this._exp = setTimeout(() => this.sesionTerminada("Su sesión venció por seguridad. Vuelva a entrar."), Math.max(1000, Math.min(ms, 2147483000)));
    this.setState({ user: d.user, vista: "app", tab: "muro", admin: null, filtro: "Todo", anteriores: false, login: Object.assign({}, LOGIN_VACIO), medios: {}, unread: 0 });
    this.arriba();
    setTimeout(() => {
      this.cargarMuro(true);
      this.cargarAgenda();
      if (d.user.role === "resident") { this.cargarUnread(); this._poll = setInterval(() => this.cargarUnread(), 60000); }
      if (d.user.role === "admin") this.cargarConteos();
      this.abrirRutaPendiente();   // si llegó con un enlace como #/hoy, lo abre al entrar
    }, 0);
  }
  limpiarSesion() {
    sesion.token = null;
    if (this._exp) clearTimeout(this._exp);
    if (this._poll) clearInterval(this._poll);
    if (this._t) clearTimeout(this._t);
    this._exp = this._poll = null;
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    this.revocarMedios();
  }
  sesionTerminada(msg) {
    if (!this.state.user) return;
    this.limpiarSesion();
    this.setState(reiniciarEstado({ aviso: msg }));
    this.arriba();
  }
  salir = async () => {
    try { if (sesion.token) await api("auth/logout", { method: "POST" }); } catch (e) {}
    this.limpiarSesion();
    this.setState(reiniciarEstado());
    this.arriba();
  };
};
