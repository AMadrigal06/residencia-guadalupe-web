// Base de la app: estado inicial, colores, avisos flotantes, ventana de confirmar,
// lectura en voz alta y archivos privados. Todas las pantallas la usan.
import { descargarArchivo } from "../api/cliente.js";
import { estadoInicial } from "./estado.js";

export const Base = DCLogic => class extends DCLogic {
  state = estadoInicial();

  componentDidMount() {
    this.aplicarTokens();
    try { const e = Number(localStorage.getItem("rg-escala")); if (e) this.setState({ escala: e }); } catch (e) {}
  }
  componentDidUpdate() { this.aplicarTokens(); }

  aplicarTokens() {
    const r = document.documentElement;
    r.style.setProperty("--rg-brick", this.props.colorAcento || "#C05A2E");
    r.style.setProperty("--rg-olive", this.props.colorSecundario || "#4E5C39");
    r.style.setProperty("--rg-gold", "#B08C3E");
    r.style.setProperty("--rg-fs", (this.props.tamanoTexto || "normal") === "grande" ? "19px" : "17px");
  }

  // ---------- quién es ----------
  rol() { return this.state.user ? this.state.user.role : null; }
  esAdmin() { return this.rol() === "admin"; }
  esResidente() { return this.rol() === "resident"; }

  // ---------- moverse ----------
  arriba() { try { window.scrollTo(0, 0); } catch (e) {} }
  // Cambia de pantalla (los nombres de pantalla están en js/app/navegacion.js)
  ir(cambios) { this.callar(); this.setState(Object.assign({ leyendo: null, leyendoCargando: false }, cambios)); this.arriba(); }

  // ---------- aviso flotante (pantallas/comunes/toast.html) ----------
  aviso(texto, deshacer) {
    if (this._t) clearTimeout(this._t);
    this._undo = deshacer || null;
    this.setState({ toast: { texto, deshacer: !!deshacer } });
    this._t = setTimeout(() => { this._undo = null; this.setState({ toast: null }); }, deshacer ? 7000 : 4500);
  }
  deshacer = () => {
    const f = this._undo; this._undo = null;
    this.setState({ toast: null });
    if (f) f();
  };
  falla(e) { if (e && e.status === 401) return; this.aviso(e && e.message ? e.message : "Algo salió mal. Intente de nuevo.", false); }

  // ---------- ventana «¿Está seguro?» (pantallas/comunes/confirmar.html) ----------
  confirmar = async () => {
    const c = this.state.confirm;
    if (!c || c.enviando) return;
    this.setState({ confirm: Object.assign({}, c, { enviando: true }) });
    try { await c.accion(); this.setState({ confirm: null }); }
    catch (e) { this.setState({ confirm: null }); this.falla(e); }
  };

  // Convierte errores 422 de la API en mensajes y campos marcados en rojo
  erroresDeCampos(e, mapa) {
    const errores = [], bad = {};
    (Array.isArray(e.details) ? e.details : []).forEach(d => {
      const campo = Object.keys(mapa).find(k => d.field === k || (d.field || "").indexOf(k + ".") === 0 || (d.field || "").indexOf(k + "[") === 0);
      if (campo) bad[mapa[campo]] = 1;
      errores.push(d.message || "Dato inválido: " + d.field);
    });
    if (!errores.length) errores.push(e.message);
    return { errores, bad };
  }

  // ---------- leer en voz alta ----------
  callar() {
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
    if (this.state && this.state.hablando) this.setState({ hablando: null });
  }
  escuchar(p) {
    const synth = window.speechSynthesis;
    if (!synth) { this.aviso("Este navegador no puede leer en voz alta.", false); return; }
    if (this.state.hablando === p.id) { this.callar(); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance([p.title, this.cuandoTxt(p), p.body].filter(Boolean).join(". "));
    u.lang = "es-MX"; u.rate = 0.92;
    u.onend = () => this.setState(s => (s.hablando === p.id ? { hablando: null } : null));
    this.setState({ hablando: p.id });
    synth.speak(u);
  }

  // ---------- publicaciones en memoria ----------
  // Reemplaza una publicación en todas las listas donde aparezca
  actualizarPost(p) {
    const upd = l => Object.assign({}, l, { items: l.items.map(x => x.id === p.id ? p : x) });
    this.setState(s => ({
      muro: upd(s.muro), adminPosts: upd(s.adminPosts),
      leyendo: s.leyendo && s.leyendo.id === p.id ? p : s.leyendo,
      guardado: s.guardado && s.guardado.id === p.id ? p : s.guardado
    }));
  }
  quitarPost(id) {
    const upd = l => Object.assign({}, l, { items: l.items.filter(x => x.id !== id), total: Math.max(0, l.total - 1) });
    this.setState(s => ({ muro: upd(s.muro), adminPosts: upd(s.adminPosts) }));
  }

  // ---------- archivos privados (fotos y PDF) ----------
  async pedirMedio(m) {
    if (!m || !m.id || this.state.medios[m.id] || (this._mediaPend && this._mediaPend[m.id])) return;
    this._mediaPend = this._mediaPend || {};
    this._mediaPend[m.id] = true;
    try {
      const blob = await descargarArchivo(m.contentUrl);
      if (blob) this.setState(s => ({ medios: Object.assign({}, s.medios, { [m.id]: blob }) }));
    } catch (e) {
      this.setState(s => ({ medios: Object.assign({}, s.medios, { [m.id]: "error" }) }));
    } finally { delete this._mediaPend[m.id]; }
  }
  pedirFotos(posts) { posts.forEach(p => (p.attachments || []).forEach(m => { if (m.mimeType && m.mimeType.indexOf("image/") === 0) this.pedirMedio(m); })); }
  revocarMedios() {
    const m = this.state.medios || {};
    Object.keys(m).forEach(k => { if (m[k] && m[k] !== "error") try { URL.revokeObjectURL(m[k]); } catch (e) {} });
    if (this._editorFoto) { try { URL.revokeObjectURL(this._editorFoto); } catch (e) {} this._editorFoto = null; }
  }

  // Valores de las ventanas comunes (toast y confirmar)
  vistaComunes(c) {
    const s = c.s;
    return {
      hayToast: !!s.toast,
      toastTexto: s.toast ? s.toast.texto : "",
      toastDeshacer: s.toast ? s.toast.deshacer : false,
      deshacer: this.deshacer,

      hayConfirm: !!s.confirm,
      confirmTitulo: s.confirm ? s.confirm.titulo : "",
      confirmTexto: s.confirm ? s.confirm.texto : "",
      confirmBoton: s.confirm ? (s.confirm.enviando ? "Eliminando…" : s.confirm.boton) : "",
      confirmEnviando: !!(s.confirm && s.confirm.enviando),
      confirmar: this.confirmar,
      cancelarConfirm: () => this.setState({ confirm: null })
    };
  }
};
