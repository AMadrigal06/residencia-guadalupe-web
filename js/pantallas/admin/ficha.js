// Pantalla: Administración › Ficha de una cuenta (#/admin/ficha, solo admin).
// Plantilla: pantallas/admin/ficha.html
// Dar de alta, aprobar un registro, editar datos, dar de baja / reactivar y reponer la clave.
import { api } from "../../api/cliente.js";
import { hoyIso } from "../../utilidades/fechas.js";
import { CORREO_OK, validarClave, metodoApi, soloDigitos, telOk } from "../../utilidades/formatos.js";
import { segCls, inCls, modos } from "../../utilidades/vista.js";
import { ROLES } from "../../app/catalogos.js";

const CAMPOS = ["nombre", "correo", "clave", "habitacion", "ingreso", "ubicacion", "telefono", "famNombre", "famParentesco", "famTelefono", "area"];

export const Ficha = B => class extends B {
  // Usuario de la API -> campos del formulario
  userAFicha(u) {
    const rp = u.residentProfile || {}, fam = rp.familyContact || {};
    return {
      id: u.id, nuevo: false, nombre: u.fullName || "", correo: u.email || "", rol: u.role, rolOriginal: u.role, estado: u.status,
      habitacion: rp.department || rp.roomNumber || "", ingreso: rp.admissionDate || "", ubicacion: rp.roomLocation || "",
      telefono: rp.phone || "", famNombre: fam.fullName || "", famParentesco: fam.relationship || "", famTelefono: fam.phone || "",
      area: u.staffProfile && u.staffProfile.area ? u.staffProfile.area : "", tenia: !!u.residentProfile,
      modo: "pass", clave: "", errores: [], bad: {}, msg: "", enviando: false
    };
  }

  nuevaFicha = () => this.ir({ admin: "ficha", fichaCargando: false, ficha: Object.assign(this.userAFicha({ role: "resident", status: "active" }), { nuevo: true, id: null, modo: "pin" }) });

  async abrirFicha(u) {
    this.ir({ admin: "ficha", ficha: this.userAFicha(u), fichaCargando: true, reponer: { tipo: u.authMethod === "pin" ? "pin" : "pass", clave: "", error: "", enviando: false } });
    try {
      const { payload } = await api("users/" + u.id);
      this.setState({ ficha: this.userAFicha(payload.data), fichaCargando: false });
    } catch (e) {
      this.setState({ fichaCargando: false, admin: "usuarios" });
      this.falla(e);
    }
  }
  setFicha(c) { this.setState(s => ({ ficha: Object.assign({}, s.ficha, c) })); }

  // Valida y arma el perfil; requerirCompleto = hace falta habitación e ingreso
  perfilFicha(requerirCompleto) {
    const f = this.state.ficha;
    const errores = [], bad = {};
    const nombre = f.nombre.trim();
    if (nombre.length < 2 || nombre.length > 150) { errores.push("Escriba el nombre completo"); bad.nombre = 1; }
    if (f.nuevo) {
      if (!CORREO_OK(f.correo)) { errores.push("Dirección de correo electrónico inválida"); bad.correo = 1; }
      const ec = validarClave(f.modo, f.clave);
      if (ec) { errores.push(ec.replace("Escriba su", "Escriba la").replace("la PIN", "el PIN")); bad.clave = 1; }
    }
    let perfil;
    if (f.rol === "resident") {
      const algo = f.habitacion.trim() || f.ingreso || f.ubicacion.trim() || f.telefono.trim() || f.famNombre.trim() || f.famParentesco.trim() || f.famTelefono.trim();
      if (requerirCompleto || algo) {
        if (!f.habitacion.trim()) { errores.push("Escriba la habitación"); bad.habitacion = 1; }
        if (!f.ingreso) { errores.push("Elija la fecha de ingreso"); bad.ingreso = 1; }
        else if (f.ingreso > hoyIso()) { errores.push("La fecha de ingreso no puede ser futura"); bad.ingreso = 1; }
        if (!telOk(f.telefono)) { errores.push("El teléfono lleva 10 dígitos"); bad.telefono = 1; }
        const fam = f.famNombre.trim() || f.famParentesco.trim() || f.famTelefono.trim();
        if (fam) {
          if (!f.famNombre.trim()) { errores.push("Escriba el nombre del familiar"); bad.famNombre = 1; }
          if (!f.famParentesco.trim()) { errores.push("Escriba el parentesco del familiar"); bad.famParentesco = 1; }
          if (!/^\d{10}$/.test(soloDigitos(f.famTelefono))) { errores.push("El teléfono del familiar lleva 10 dígitos"); bad.famTelefono = 1; }
        }
        perfil = { residentProfile: {
          phone: f.telefono.trim() ? soloDigitos(f.telefono) : null,
          department: f.habitacion.trim(), admissionDate: f.ingreso,
          roomLocation: f.ubicacion.trim() || null,
          familyContact: fam ? { fullName: f.famNombre.trim(), relationship: f.famParentesco.trim(), phone: soloDigitos(f.famTelefono) } : null
        } };
      }
    } else if (f.area.trim()) {
      perfil = { staffProfile: { area: f.area.trim() } };
    }
    this.setFicha({ errores, bad, msg: "" });
    return errores.length ? null : Object.assign({ fullName: nombre }, perfil || {});
  }
  erroresFicha(e) {
    if (e.code === "EMAIL_TAKEN") return { errores: ["Ese correo ya tiene una cuenta"], bad: { correo: 1 } };
    if (e.status === 422) return this.erroresDeCampos(e, {
      fullName: "nombre", email: "correo", secret: "clave",
      "residentProfile.department": "habitacion", "residentProfile.admissionDate": "ingreso", "residentProfile.roomLocation": "ubicacion",
      "residentProfile.phone": "telefono", "residentProfile.familyContact.fullName": "famNombre",
      "residentProfile.familyContact.relationship": "famParentesco", "residentProfile.familyContact.phone": "famTelefono",
      "staffProfile.area": "area"
    });
    return { errores: [e.message], bad: {} };
  }

  async guardarFicha(estado, mensaje, volver, requerirCompleto) {
    const f = this.state.ficha;
    if (f.enviando) return;
    const base = this.perfilFicha(requerirCompleto);
    if (!base) { this.arriba(); return; }
    this.setFicha({ enviando: true });
    try {
      const { payload } = await api("users/" + f.id, { method: "PUT", body: Object.assign(base, { role: f.rol, status: estado || f.estado }) });
      this.cargarConteos();
      if (volver) { this.ir({ admin: "usuarios", ficha: null, uFiltro: estado || this.state.uFiltro }); this.cargarUsuarios(true); this.aviso(mensaje, false); }
      else this.setState({ ficha: Object.assign(this.userAFicha(payload.data), { msg: mensaje }) });
    } catch (e) {
      const r = this.erroresFicha(e);
      this.setFicha({ enviando: false, errores: r.errores, bad: r.bad });
    }
  }
  async cambiarEstadoUsuario(estado, mensaje) {
    const f = this.state.ficha;
    if (f.enviando) return;
    this.setFicha({ enviando: true });
    try {
      const { payload } = await api("users/" + f.id, { method: "PUT", body: { fullName: f.nombre.trim() || f.nombre, role: f.rolOriginal, status: estado } });
      this.cargarConteos();
      this.setState({ ficha: Object.assign(this.userAFicha(payload.data), { msg: mensaje }) });
    } catch (e) { this.setFicha({ enviando: false, errores: [e.message], bad: {} }); }
  }
  altaFicha = async () => {
    const f = this.state.ficha;
    if (f.enviando) return;
    const base = this.perfilFicha(f.rol === "resident");
    if (!base) { this.arriba(); return; }
    this.setFicha({ enviando: true });
    try {
      const { payload } = await api("users", { method: "POST", body: Object.assign(base, { email: f.correo.trim(), role: f.rol, authMethod: metodoApi(f.modo), secret: f.clave }) });
      this.cargarConteos();
      this.ir({ admin: "usuarios", ficha: null, uFiltro: "active" });
      this.cargarUsuarios(true);
      this.aviso("Se dio de alta a " + payload.data.fullName + ". Entréguele su clave en persona.", false);
    } catch (e) {
      const r = this.erroresFicha(e);
      this.setFicha({ enviando: false, errores: r.errores, bad: r.bad });
      this.arriba();
    }
  };
  reponerClave = async () => {
    const r = this.state.reponer, f = this.state.ficha;
    if (r.enviando) return;
    const ec = validarClave(r.tipo, r.clave);
    if (ec) { this.setState({ reponer: Object.assign({}, r, { error: ec.replace("Escriba su PIN", "Escriba el PIN nuevo").replace("Escriba su contraseña", "Escriba la contraseña nueva") }) }); return; }
    this.setState({ reponer: Object.assign({}, r, { enviando: true, error: "" }) });
    try {
      await api("users/" + f.id + "/credentials", { method: "PUT", body: { authMethod: metodoApi(r.tipo), secret: r.clave } });
      this.setState({ reponer: { tipo: r.tipo, clave: "", error: "", enviando: false } });
      this.aviso((r.tipo === "pin" ? "Se repuso el PIN de " : "Se repuso la contraseña de ") + f.nombre + ". Entrégueselo en persona.", false);
    } catch (e) { this.setState({ reponer: Object.assign({}, r, { enviando: false, error: e.message }) }); }
  };

  vistaFicha(c) {
    const s = c.s, fc = s.ficha;
    if (!fc) return {};
    const pend = fc.estado === "pending";
    const soyYo = fc.id === c.yo.id;
    const botones = fc.nuevo
      ? [["Dar de alta", "p-btn pri full", this.altaFicha], ["Cancelar", "p-btn full", () => this.irA("admin/usuarios")]]
      : pend
        ? [["Aprobar cuenta", "p-btn pri full", () => this.guardarFicha("active", "Se aprobó la cuenta de " + fc.nombre.trim() + ". Ya puede entrar.", true, fc.rol === "resident")],
           ["Guardar sin aprobar", "p-btn full", () => this.guardarFicha(null, "Se guardaron los cambios de " + fc.nombre.trim() + ".", false, false)],
           ["Rechazar solicitud", "p-btn full danger", () => this.cambiarEstadoUsuario("disabled", "Se rechazó la solicitud. La cuenta quedó dada de baja.")]]
        : [["Guardar cambios", "p-btn pri full", () => this.guardarFicha(null, "Se guardaron los cambios de " + fc.nombre.trim() + ".", false, false)]]
          .concat(soyYo ? [] : fc.estado === "active"
            ? [["Dar de baja", "p-btn full danger", () => this.cambiarEstadoUsuario("disabled", fc.nombre + " ya no puede entrar. Puede reactivar la cuenta cuando quiera.")]]
            : [["Reactivar cuenta", "p-btn full", () => this.cambiarEstadoUsuario("active", fc.nombre + " puede volver a entrar.")]]);
    const r = s.reponer;
    return {
      fc,
      fcCargando: s.fichaCargando,
      fcListo: !s.fichaCargando,
      fcCls: CAMPOS.reduce((o, k) => { o[k] = inCls(fc.bad[k]); return o; }, {}),
      fcSet: CAMPOS.reduce((o, k) => {
        o[k] = e => { let val = e.target.value; if (k === "clave" && this.state.ficha.modo === "pin") val = soloDigitos(val).slice(0, 6); this.setState(st => ({ ficha: Object.assign({}, st.ficha, { [k]: val, msg: "", bad: Object.assign({}, st.ficha.bad, { [k]: 0 }) }) })); };
        return o;
      }, {}),
      fcTitulo: fc.nuevo ? "Dar de alta" : pend ? "Aprobar registro" : "Cuenta de " + fc.nombre.split(" ")[0],
      fcSub: fc.nuevo ? "La cuenta queda activa en cuanto la guarde." : pend ? "Complete la habitación y la fecha de ingreso, y apruebe la cuenta para que pueda entrar." : null,
      fcNuevo: !!fc.nuevo,
      fcCorreoBloqueado: !fc.nuevo,
      fcRoles: Object.keys(ROLES).map(k => ({ nombre: ROLES[k] === "Administración" ? "Admin" : ROLES[k], cls: segCls(fc.rol === k), elegir: () => (soyYo ? this.aviso("No puede cambiar su propio tipo de cuenta.", false) : this.setFicha({ rol: k })) })),
      fcModos: modos(fc.modo, id => this.setFicha({ modo: id, clave: "" })),
      fcClaveLabel: fc.modo === "pin" ? "PIN inicial" : "Contraseña inicial",
      fcClaveModo: fc.modo === "pin" ? "numeric" : "text",
      fcClavePh: fc.modo === "pin" ? "4 a 6 números" : "Al menos 8 caracteres",
      fcConEstado: !fc.nuevo,
      fcEstadoCls: "p-pill " + (pend ? "pend" : fc.estado === "active" ? "act" : "baja"),
      fcEstadoTxt: pend ? "Pendiente de aprobación" : fc.estado === "active" ? "Activa" : "Dada de baja",
      fcEsResidente: fc.rol === "resident",
      fcEsPersonal: fc.rol !== "resident",
      fcAvisoRol: fc.rol === "admin" ? "Administración puede aprobar residentes, crear cuentas, reponer claves, fijar y eliminar avisos." : "Personal puede publicar avisos y editar los suyos, pero no administra cuentas.",
      fcMsg: fc.msg || null,
      fcHayErrores: fc.errores.length > 0,
      fcErrores: fc.errores,
      fcEnviando: !!fc.enviando,
      fcBotones: botones.map(b => ({ nombre: b[0], cls: b[1], accion: b[2] })),
      fcConReponer: !fc.nuevo && !soyYo,
      rpModos: modos(r.tipo, id => this.setState({ reponer: { tipo: id, clave: "", error: "", enviando: false } })),
      rpLabel: r.tipo === "pin" ? "PIN nuevo" : "Contraseña nueva",
      rpModo: r.tipo === "pin" ? "numeric" : "text",
      rpPh: r.tipo === "pin" ? "4 a 6 números" : "Al menos 8 caracteres",
      rpClave: r.clave,
      rpCls: inCls(!!r.error),
      rpSetClave: e => { const val = e.target.value; this.setState(st => ({ reponer: Object.assign({}, st.reponer, { clave: st.reponer.tipo === "pin" ? soloDigitos(val).slice(0, 6) : val, error: "" }) })); },
      rpError: r.error || null,
      rpEnviando: !!r.enviando,
      rpReponer: this.reponerClave
    };
  }
};
