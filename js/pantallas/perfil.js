// Pantalla: Perfil (#/perfil).  Plantilla: pantallas/portal/perfil.html
// Datos de la persona, tamaño de letra, avisos que quiere recibir, cambiar nombre o clave,
// y los accesos a administración para personal y admin.
import { api } from "../api/cliente.js";
import { diaLargo } from "../utilidades/fechas.js";
import { validarClave, metodoApi, soloDigitos } from "../utilidades/formatos.js";
import { segCls, inCls, modos } from "../utilidades/vista.js";
import { ROLES, ESCALAS } from "../app/catalogos.js";

export const Perfil = B => class extends B {
  guardarPerfil = async () => {
    const p = this.state.perfilForm;
    if (p.enviando) return;
    const setP = c => this.setState(s => ({ perfilForm: Object.assign({}, s.perfilForm, c) }));
    if (this.state.perfilEdit === "nombre") {
      const n = p.valor.trim();
      if (n.length < 2 || n.length > 150) { setP({ error: "Escriba su nombre completo" }); return; }
      setP({ enviando: true, error: "" });
      try {
        const { payload } = await api("auth/me", { method: "PATCH", body: { fullName: n } });
        this.setState({ user: payload.data, perfilEdit: null });
        this.aviso("Se guardó su nombre.", false);
      } catch (e) { setP({ enviando: false, error: e.message }); }
    } else {
      if (!p.actual) { setP({ error: "Escriba su clave actual", badActual: true }); return; }
      const ec = validarClave(p.tipo, p.valor);
      if (ec) { setP({ error: ec.replace("Escriba su PIN", "Escriba el PIN nuevo").replace("Escriba su contraseña", "Escriba la contraseña nueva"), badActual: false }); return; }
      setP({ enviando: true, error: "", badActual: false });
      try {
        await api("auth/me/credentials", { method: "PUT", body: { currentSecret: p.actual, authMethod: metodoApi(p.tipo), secret: p.valor }, noExpira: true });
        this.setState(s => ({ perfilEdit: null, user: Object.assign({}, s.user, { authMethod: metodoApi(p.tipo) }) }));
        this.aviso(p.tipo === "pin" ? "Se guardó su nuevo PIN." : "Se guardó su nueva contraseña.", false);
      } catch (e) {
        const malActual = e.status === 401 || e.status === 403 || /current/i.test(JSON.stringify(e.details || "")) || e.code === "INVALID_CREDENTIALS";
        if (e.status === 401 && e.code === "UNAUTHENTICATED" && /token/i.test(e.message)) { this.sesionTerminada("Su sesión terminó. Vuelva a entrar con su correo."); return; }
        setP({ enviando: false, error: malActual ? "Su clave actual no es correcta." : e.message, badActual: malActual });
      }
    }
  };

  async guardarPrefs(nuevas) {
    const antes = this.state.user.preferences;
    this.setState(s => ({ user: Object.assign({}, s.user, { preferences: nuevas }) }));
    try {
      const { payload } = await api("auth/me/preferences", { method: "PUT", body: nuevas });
      this.setState(s => ({ user: Object.assign({}, s.user, { preferences: payload.data }) }));
    } catch (e) {
      this.setState(s => ({ user: Object.assign({}, s.user, { preferences: antes }) }));
      this.falla(e);
    }
  }

  vistaPerfil(c) {
    const s = c.s, yo = c.yo;
    const rp = yo.residentProfile || {};
    const prefs = yo.preferences || { notifyNotices: true, notifyActivities: true, notifyPhotos: false };
    return {
      perfilLinea: c.esResidente ? (rp.department || rp.roomNumber ? "Habitación " + (rp.roomNumber || rp.department) : "Residente") + (rp.admissionDate ? " · Desde " + rp.admissionDate.slice(0, 4) : "") : ROLES[yo.role] + (yo.staffProfile && yo.staffProfile.area ? " · " + yo.staffProfile.area : ""),
      adminTexto: c.esAdmin ? "Publique avisos, apruebe a los residentes nuevos y administre las cuentas." : "Publique avisos, menús y eventos para los residentes.",
      pendientesBadge: s.uConteos.pending || null,
      tamanos: ESCALAS.map(e => ({ nombre: e.nombre, estilo: "font-size:" + e.fs, cls: segCls((s.escala || 1) === e.k), elegir: () => { this.setState({ escala: e.k }); try { localStorage.setItem("rg-escala", String(e.k)); } catch (x) {} } })),
      datos: (c.esResidente
        ? [["Habitación", rp.roomNumber || rp.department], ["Correo", yo.email], ["Teléfono", rp.phone], ["Familiar", rp.familyContact ? rp.familyContact.fullName + " (" + rp.familyContact.relationship.toLowerCase() + ")" + (rp.familyContact.phone ? " · " + rp.familyContact.phone : "") : ""], ["Ubicación", rp.roomLocation], ["Ingreso", rp.admissionDate ? diaLargo(rp.admissionDate) : ""]]
        : [["Correo", yo.email], ["Área", yo.staffProfile && yo.staffProfile.area], ["Tipo de cuenta", ROLES[yo.role]]]
      ).map(d => ({ etiqueta: d[0], valor: d[1] || "Sin registrar" })),
      prefs: [["notifyNotices", "Avisos de la administración"], ["notifyActivities", "Actividades y talleres"], ["notifyPhotos", "Fotografías de los eventos"]].map(p => ({
        nombre: p[1],
        siCls: segCls(!!prefs[p[0]]), noCls: segCls(!prefs[p[0]]),
        si: () => { if (!prefs[p[0]]) this.guardarPrefs(Object.assign({}, prefs, { [p[0]]: true })); },
        no: () => { if (prefs[p[0]]) this.guardarPrefs(Object.assign({}, prefs, { [p[0]]: false })); }
      })),
      salir: this.salir,

      // cambiar nombre o clave
      peNinguno: !s.perfilEdit,
      peAbierto: !!s.perfilEdit,
      peNombre: s.perfilEdit === "nombre",
      peClave: s.perfilEdit === "clave",
      peValor: s.perfilForm.valor,
      peActual: s.perfilForm.actual,
      peActualLabel: yo.authMethod === "pin" ? "Su PIN actual" : "Su contraseña actual",
      peActualCls: inCls(s.perfilForm.badActual),
      peInputCls: inCls(!!s.perfilForm.error && !s.perfilForm.badActual),
      peSetValor: e => { const val = e.target.value; this.setState(st => ({ perfilForm: Object.assign({}, st.perfilForm, { valor: st.perfilEdit === "clave" && st.perfilForm.tipo === "pin" ? soloDigitos(val).slice(0, 6) : val, error: "" }) })); },
      peSetActual: e => { const val = e.target.value; this.setState(st => ({ perfilForm: Object.assign({}, st.perfilForm, { actual: val, error: "", badActual: false }) })); },
      peAbrirNombre: () => this.setState({ perfilEdit: "nombre", perfilForm: { valor: yo.fullName, actual: "", tipo: "pass", error: "", enviando: false } }),
      peAbrirClave: () => this.setState({ perfilEdit: "clave", perfilForm: { valor: "", actual: "", tipo: yo.authMethod === "pin" ? "pin" : "pass", error: "", enviando: false } }),
      peModos: modos(s.perfilForm.tipo, id => this.setState(st => ({ perfilForm: Object.assign({}, st.perfilForm, { valor: "", tipo: id, error: "" }) }))),
      peClaveLabel: s.perfilForm.tipo === "pin" ? "PIN nuevo" : "Contraseña nueva",
      peClaveModo: s.perfilForm.tipo === "pin" ? "numeric" : "text",
      peClavePh: s.perfilForm.tipo === "pin" ? "4 a 6 números" : "Al menos 8 caracteres",
      peError: s.perfilForm.error || null,
      peEnviando: !!s.perfilForm.enviando,
      peGuardarTxt: s.perfilForm.enviando ? "Guardando…" : "Guardar",
      peGuardar: this.guardarPerfil,
      peCancelar: () => this.setState({ perfilEdit: null })
    };
  }
};
