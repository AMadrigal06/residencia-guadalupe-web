// Pantalla: inicio de sesión y registro.  Plantilla: pantallas/login.html
import { api } from "../api/cliente.js";
import { hoyIso, diaLargo, saludo } from "../utilidades/fechas.js";
import { CORREO_OK, validarClave, metodoApi, soloDigitos } from "../utilidades/formatos.js";
import { inCls, modos } from "../utilidades/vista.js";
import { LOGIN_VACIO } from "../app/estado.js";

export const Login = B => class extends B {
  setLogin(c) { this.setState(s => ({ login: Object.assign({}, s.login, c) })); }

  entrar = async () => {
    const l = this.state.login;
    if (l.cargando) return;
    const errores = [], bad = {};
    if (!CORREO_OK(l.correo)) { errores.push("Dirección de correo electrónico inválida"); bad.correo = 1; }
    const ec = validarClave(l.tipo, l.clave, true);
    if (ec) { errores.push(ec); bad.clave = 1; }
    if (errores.length) { this.setLogin({ errores, bad, olvido: false, aviso: "" }); return; }
    this.setLogin({ cargando: true, errores: [], bad: {}, aviso: "" });
    try {
      const { payload } = await api("auth/login", { method: "POST", auth: false, body: { email: l.correo.trim(), authMethod: metodoApi(l.tipo), secret: l.clave, clientType: "web" } });
      this.iniciarSesion(payload.data);
    } catch (e) {
      let msg = e.message, b = {};
      if (e.status === 401) { msg = l.tipo === "pin" ? "El correo o el PIN no coinciden. Si usted entra con contraseña, elija «Contraseña» arriba." : "El correo o la contraseña no coinciden. Si usted entra con PIN, elija «PIN» arriba."; b = { correo: 1, clave: 1 }; }
      else if (e.code === "ACCOUNT_PENDING") msg = "Su cuenta todavía no está aprobada. Recepción la revisa en cuanto pueda.";
      else if (e.code === "ACCOUNT_DISABLED") msg = "Esta cuenta está dada de baja. Pregunte en recepción.";
      else if (e.status === 422) { const r = this.erroresDeCampos(e, { email: "correo", secret: "clave" }); this.setLogin({ cargando: false, errores: r.errores, bad: r.bad }); return; }
      this.setLogin({ cargando: false, errores: [msg], bad: b });
    }
  };

  registrar = async () => {
    const l = this.state.login;
    if (l.cargando) return;
    const errores = [], bad = {};
    const nombre = l.nombre.trim();
    if (nombre.length < 2 || nombre.length > 150) { errores.push("Escriba su nombre completo"); bad.nombre = 1; }
    if (!CORREO_OK(l.correo)) { errores.push("Dirección de correo electrónico inválida"); bad.correo = 1; }
    const ec = validarClave(l.tipo, l.clave);
    if (ec) { errores.push(ec); bad.clave = 1; }
    if (errores.length) { this.setLogin({ errores, bad }); return; }
    this.setLogin({ cargando: true, errores: [], bad: {} });
    try {
      await api("auth/register", { method: "POST", auth: false, body: { fullName: nombre, email: l.correo.trim(), authMethod: metodoApi(l.tipo), secret: l.clave } });
      this.setState({ login: Object.assign({}, LOGIN_VACIO, { modo: "registrado", registradoNombre: nombre }) });
    } catch (e) {
      if (e.code === "EMAIL_TAKEN") { this.setLogin({ cargando: false, errores: ["Ese correo ya tiene una cuenta. Intente entrar o pida ayuda en recepción."], bad: { correo: 1 } }); return; }
      const r = e.status === 422 ? this.erroresDeCampos(e, { fullName: "nombre", email: "correo", secret: "clave" }) : { errores: [e.message], bad: {} };
      this.setLogin({ cargando: false, errores: r.errores, bad: r.bad });
    }
  };

  vistaLogin(c) {
    const l = c.s.login;
    return {
      lgVerRegistrado: l.modo === "registrado",
      lgVerForm: l.modo !== "registrado",
      lgRegistradoTexto: "Gracias, " + (l.registradoNombre || "").split(" ")[0] + ". Le abrimos el mural en cuanto recepción apruebe su cuenta y confirme su habitación.",
      lgIrEntrar: () => this.setState({ login: Object.assign({}, LOGIN_VACIO) }),
      lgEsRegistro: l.modo === "registro",
      lgEsEntrar: l.modo === "entrar",
      lgFecha: diaLargo(hoyIso()).replace(/ de \d{4}$/, ""),
      lgTitulo: l.modo === "registro" ? "Cree su cuenta" : saludo(),
      lgSub: l.modo === "registro" ? "Con su nombre y su correo le abrimos el mural. Recepción confirma su habitación." : "Entre con el correo que dio en recepción para ver los avisos de la residencia.",
      lgNombre: l.nombre, lgCorreo: l.correo, lgClave: l.clave,
      lgNombreCls: inCls(l.bad.nombre), lgCorreoCls: inCls(l.bad.correo), lgClaveCls: inCls(l.bad.clave),
      lgSetNombre: e => this.setLogin({ nombre: e.target.value }),
      lgSetCorreo: e => this.setLogin({ correo: e.target.value }),
      lgSetClave: e => this.setLogin({ clave: l.tipo === "pin" ? soloDigitos(e.target.value).slice(0, 6) : e.target.value }),
      lgEnter: e => { if (e.key === "Enter") (l.modo === "registro" ? this.registrar : this.entrar)(); },
      lgModos: modos(l.tipo, id => this.setLogin({ tipo: id, clave: "", errores: [], bad: {} })),
      lgClaveLabel: l.tipo === "pin" ? "PIN" : "Contraseña",
      lgClaveTipo: l.mostrar ? "text" : "password",
      lgClaveModo: l.tipo === "pin" ? "numeric" : "text",
      lgAutocomplete: l.modo === "registro" ? "new-password" : "current-password",
      lgClavePh: l.tipo === "pin" ? "4 a 6 números" : (l.modo === "registro" ? "Al menos 8 caracteres" : "••••••••"),
      lgToggleMostrar: () => this.setLogin({ mostrar: !l.mostrar }),
      lgMostrarTxt: (l.mostrar ? "Ocultar " : "Mostrar ") + (l.tipo === "pin" ? "PIN" : "contraseña"),
      lgHayErrores: l.errores.length > 1,
      lgErrores: l.errores,
      lgNotaCls: "p-note" + (l.errores.length ? " err" : ""),
      lgNota: l.errores.length
        ? (l.errores.length > 1 ? "Revise los datos marcados." : l.errores[0])
        : l.aviso ? l.aviso
        : l.olvido
          ? "Pida en recepción que le repongan la contraseña o el PIN. Por seguridad se entrega en persona."
          : (l.tipo === "pin" ? "Revise su correo y su PIN. Si no lo recuerda, recepción puede reponerlo." : "Revise su correo y su contraseña. Si no la recuerda, recepción puede reponerla."),
      lgCargando: l.cargando,
      lgPrincipal: l.modo === "registro" ? this.registrar : this.entrar,
      lgPrincipalTxt: l.modo === "registro" ? (l.cargando ? "Enviando…" : "Crear cuenta") : (l.cargando ? "Entrando…" : "Iniciar sesión"),
      lgSecundario: () => this.setLogin({ modo: l.modo === "registro" ? "entrar" : "registro", errores: [], bad: {}, olvido: false, clave: "", aviso: "" }),
      lgSecundarioTxt: l.modo === "registro" ? "Ya tengo cuenta" : "Crear cuenta",
      lgOlvido: () => this.setLogin({ olvido: true, errores: [], bad: {}, aviso: "" })
    };
  }
};
