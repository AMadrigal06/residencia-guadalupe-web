// =====================================================================
// Navegación: todas las pantallas del portal, quién puede verlas y qué
// se carga al abrir cada una. La URL muestra la pantalla actual
// (#/muro, #/hoy, #/admin/usuarios…), así funciona el botón «atrás».
//
// Para agregar una pantalla:
//   1. su HTML en pantallas/ y su <incluir> en pantallas/marco.html
//   2. su lógica en js/pantallas/ y su mixin en js/app/componente.js
//   3. una entrada aquí en RUTAS y su bandera ver… en vistaNavegacion()
// =====================================================================
import { MODO_PRUEBA } from "../api/cliente.js";
import { saludo, diaCorto } from "../utilidades/fechas.js";
import { segCls } from "../utilidades/vista.js";
import { EDITOR_VACIO } from "./estado.js";

// rol: quién puede entrar ("todos" | "residente" | "personal" = personal y admin | "admin")
export const RUTAS = {
  "muro":            { nombre: "Muro",   menu: true, rol: "todos" },
  "hoy":             { nombre: "Hoy",    menu: true, rol: "todos" },
  "avisos":          { nombre: "Avisos", menu: true, rol: "residente" },   // buzón de notificaciones
  "perfil":          { nombre: "Perfil", menu: true, rol: "todos" },
  "admin/avisos":    { rol: "personal" },
  "admin/editor":    { rol: "personal" },
  "admin/guardado":  { rol: "personal" },
  "admin/usuarios":  { rol: "admin" },
  "admin/ficha":     { rol: "admin" },
  "admin/auditoria": { rol: "admin" }
};

// "#/admin/usuarios" -> "admin/usuarios"
const leerHash = () => { try { return decodeURIComponent(window.location.hash.replace(/^#\/?/, "")); } catch (e) { return ""; } };
const urlCon = ruta => window.location.pathname + window.location.search + (ruta ? "#/" + ruta : "");

export const Navegacion = B => class extends B {
  componentDidMount() {
    super.componentDidMount();
    this._rutaPendiente = leerHash();
    this._alCambiarHash = () => this.alCambiarHash();
    window.addEventListener("hashchange", this._alCambiarHash);
    this.sincronizarUrl();
  }
  componentDidUpdate(prev) {
    super.componentDidUpdate(prev);
    this.sincronizarUrl();
  }
  componentWillUnmount() {
    super.componentWillUnmount();
    window.removeEventListener("hashchange", this._alCambiarHash);
  }

  // Pantalla actual según el estado: "muro", "admin/editor", … ("" sin sesión)
  rutaActual() {
    const s = this.state;
    if (!s.user) return "";
    return s.admin ? "admin/" + s.admin : s.tab;
  }
  puedeVer(ruta) {
    const r = RUTAS[ruta], rol = this.rol();
    if (!r || !rol) return false;
    if (r.rol === "todos") return true;
    if (r.rol === "residente") return rol === "resident";
    if (r.rol === "personal") return rol === "admin" || rol === "employee";
    return rol === "admin";
  }

  // Abre una pantalla y carga lo que necesita
  irA(ruta) {
    if (!this.puedeVer(ruta)) ruta = "muro";
    const s = this.state;
    switch (ruta) {
      case "muro":
        this.ir({ tab: "muro", admin: null, perfilEdit: null });
        if (!s.agenda.cargando) this.cargarAgenda();
        if (s.anteriores || !s.muro.items.length || s.tab !== "muro" || s.admin) { this.setState({ anteriores: false }); setTimeout(() => this.cargarMuro(true), 0); }
        break;
      case "hoy":
        this.ir({ tab: "hoy", admin: null, perfilEdit: null });
        if (!s.agenda.cargando) this.cargarAgenda();
        break;
      case "avisos":
        this.ir({ tab: "avisos", admin: null, perfilEdit: null });
        this.cargarNotifs(true);
        break;
      case "perfil":
        this.ir({ tab: "perfil", admin: null, perfilEdit: null });
        if (this.esAdmin()) this.cargarConteos();
        break;
      case "admin/avisos":
        this.limpiarAdjuntoNuevo();
        this.ir({ admin: "avisos", editor: Object.assign({}, EDITOR_VACIO) });
        setTimeout(() => this.cargarAdminPosts(true), 0);
        break;
      case "admin/editor":
        if (s.editor.id || s.editor.titulo || s.editor.texto) this.ir({ admin: "editor" }); else this.nuevoAviso();
        break;
      case "admin/guardado":
        if (s.guardado) this.ir({ admin: "guardado" }); else this.irA("admin/avisos");
        break;
      case "admin/usuarios":
        this.ir({ admin: "usuarios", ficha: null });
        setTimeout(() => { this.cargarUsuarios(true); this.cargarConteos(); }, 0);
        break;
      case "admin/ficha":
        if (s.ficha) this.ir({ admin: "ficha" }); else this.irA("admin/usuarios");
        break;
      case "admin/auditoria":
        this.ir({ admin: "auditoria" });
        setTimeout(() => this.cargarAudit(true), 0);
        break;
    }
  }

  // ---------- URL <-> pantalla ----------
  sincronizarUrl() {
    const ruta = this.rutaActual();
    if (!ruta) {
      // Al salir se limpia la URL; si nunca hubo sesión se deja como llegó (se abre al entrar)
      if (this._conSesion) { this._conSesion = false; try { window.history.replaceState(null, "", urlCon("")); } catch (e) {} }
      return;
    }
    this._conSesion = true;
    if (leerHash() !== ruta) {
      try { window.history.pushState(null, "", urlCon(ruta)); } catch (e) {}
    }
  }
  alCambiarHash() {
    const ruta = leerHash();
    if (!this.state.user) { this._rutaPendiente = ruta; return; }
    if (ruta === this.rutaActual()) return;
    if (RUTAS[ruta] && this.puedeVer(ruta)) this.irA(ruta);
    else { try { window.history.replaceState(null, "", urlCon(this.rutaActual())); } catch (e) {} }
  }
  abrirRutaPendiente() {
    const ruta = this._rutaPendiente;
    this._rutaPendiente = "";
    if (ruta && ruta !== "muro" && RUTAS[ruta] && this.puedeVer(ruta)) this.irA(ruta);
  }

  // Qué pantalla se ve y el menú de arriba
  vistaNavegacion(c) {
    const s = c.s, yo = c.yo;
    const v = {
      esLogin: s.vista === "login",
      esApp: s.vista === "app" && !!yo,
      modoPrueba: MODO_PRUEBA,
      urlReal: (() => { try { return window.location.pathname; } catch (e) { return "/"; } })(),
      marcaSub: MODO_PRUEBA ? "Modo de prueba" : "Mural de la residencia"
    };
    if (!yo) return v;
    const ruta = this.rutaActual();
    const activo = s.admin ? "perfil" : s.tab;   // las pantallas de administración cuelgan de Perfil
    const ir = r => () => this.irA(r);
    return Object.assign(v, {
      nav: Object.keys(RUTAS).filter(r => RUTAS[r].menu && this.puedeVer(r))
        .map(r => ({ nombre: RUTAS[r].nombre, badge: r === "avisos" ? s.unread || null : null, cls: segCls(activo === r), ir: ir(r) })),
      irMuro: ir("muro"), irHoy: ir("hoy"), irAvisos: ir("avisos"), irPerfil: ir("perfil"),
      irAdminAvisos: ir("admin/avisos"), irAdminUsuarios: ir("admin/usuarios"), irAuditoria: ir("admin/auditoria"),

      // Una bandera por pantalla (las lee pantallas/marco.html y cada plantilla)
      verMuro: ruta === "muro",
      verHoy: ruta === "hoy",
      verBuzon: ruta === "avisos",
      verPerfil: ruta === "perfil",
      verAdminAvisos: ruta === "admin/avisos",
      verEditor: ruta === "admin/editor",
      verGuardado: ruta === "admin/guardado" && !!s.guardado,
      verUsuarios: ruta === "admin/usuarios",
      verFicha: ruta === "admin/ficha" && !!s.ficha,
      verAuditoria: ruta === "admin/auditoria",

      saludoFecha: saludo() + " · " + diaCorto(c.hoy),
      primerNombre: (yo.fullName || "").split(" ")[0],
      nombreCompleto: yo.fullName,
      iniciales: (yo.fullName || "?").split(" ").filter(Boolean).slice(0, c.esResidente ? 1 : 2).map(x => x[0]).join("")
    });
  }
};
