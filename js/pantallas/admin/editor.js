// Pantallas: Administración › Crear o editar aviso (#/admin/editor) y su confirmación (#/admin/guardado).
// Plantillas: pantallas/admin/editor.html y pantallas/admin/guardado.html
import { api } from "../../api/cliente.js";
import { partesMx, mxAUtc, masDias, diaLargo, pad } from "../../utilidades/fechas.js";
import { uuid } from "../../utilidades/formatos.js";
import { segCls, inCls } from "../../utilidades/vista.js";
import { TIPOS, TIPOS_API, COMIDAS, LIMITE_ARCHIVO } from "../../app/catalogos.js";
import { EDITOR_VACIO } from "../../app/estado.js";

const CAMPOS = ["titulo", "menuDia", "fecha", "hora", "horaFin", "lugar", "texto", "hasta"];

export const Editor = B => class extends B {
  setEd(c) { this.setState(s => ({ editor: Object.assign({}, s.editor, c) })); }

  nuevoAviso = () => {
    this.limpiarAdjuntoNuevo();
    this.ir({ admin: "editor", edCargando: false, editor: Object.assign({}, EDITOR_VACIO) });
  };

  // Publicación de la API -> campos del formulario
  postAEditor(p, etag) {
    const ini = p.eventStartAt ? partesMx(new Date(p.eventStartAt)) : null;
    const fin = p.eventEndAt ? partesMx(new Date(p.eventEndAt)) : null;
    const m = (p.attachments || [])[0];
    return Object.assign({}, EDITOR_VACIO, {
      id: p.id, etag, version: p.version, autorId: p.author ? p.author.id : null, estado: p.status,
      tipo: TIPOS[p.type] || "Aviso", titulo: p.title || "", categoria: p.category || "Aviso",
      menuDia: p.menuDate || "", comida: p.mealType || "lunch",
      fecha: ini ? ini.fecha : "", hora: ini ? ini.hora : "", horaFin: fin ? fin.hora : "", lugar: p.eventLocation || "",
      texto: p.body || "", hasta: p.expiresAt ? partesMx(new Date(p.expiresAt)).fecha : "", expiresOriginal: p.expiresAt || null,
      fijado: !!p.isPinned,
      adjunto: m ? { id: m.id, tipo: m.mimeType === "application/pdf" ? "pdf" : "foto", nombre: m.originalName, existente: true, media: m } : null
    });
  }

  async editarAviso(p) {
    this.limpiarAdjuntoNuevo();
    this.ir({ admin: "editor", edCargando: true, editor: Object.assign({}, EDITOR_VACIO, { id: p.id }) });
    try {
      const { payload, etag } = await api("posts/" + p.id);
      const ed = this.postAEditor(payload.data, etag);
      this.setState({ editor: ed, edCargando: false });
      if (ed.adjunto && ed.adjunto.tipo === "foto") this.pedirMedio(ed.adjunto.media);
    } catch (e) {
      this.setState({ admin: "avisos", edCargando: false });
      this.falla(e);
    }
  }

  // ---------- foto o PDF adjunto ----------
  limpiarAdjuntoNuevo() {
    const a = this.state.editor && this.state.editor.adjunto;
    if (a && a.nuevo && a.id) api("media/" + a.id, { method: "DELETE" }).catch(() => {});
    if (this._editorFoto) { try { URL.revokeObjectURL(this._editorFoto); } catch (e) {} this._editorFoto = null; }
  }
  adjuntar = async e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const limite = LIMITE_ARCHIVO[f.type];
    if (!limite) { this.setEd({ errores: ["Solo se puede adjuntar una foto JPG o PNG, o un PDF."] }); return; }
    if (f.size > limite) { this.setEd({ errores: [f.type === "application/pdf" ? "El PDF pesa más de 9 MB." : "La foto pesa más de 5 MB."] }); return; }
    this.limpiarAdjuntoNuevo();
    const local = f.type === "application/pdf" ? null : URL.createObjectURL(f);
    this._editorFoto = local;
    this.setEd({ adjunto: { id: null, tipo: local ? "foto" : "pdf", nombre: f.name, subiendo: true, nuevo: true, local }, errores: [] });
    try {
      const form = new FormData();
      form.append("file", f);
      form.append("altText", (this.state.editor.titulo || f.name).slice(0, 250));
      const { payload } = await api("media", { method: "POST", body: form });
      this.setState(s => (s.editor.adjunto && s.editor.adjunto.local === local && s.editor.adjunto.nombre === f.name
        ? { editor: Object.assign({}, s.editor, { adjunto: Object.assign({}, s.editor.adjunto, { id: payload.data.id, subiendo: false }) }) }
        : null));
    } catch (err) {
      this.setEd({ adjunto: null, errores: [err.status === 408 ? "La subida tardó demasiado y se cortó. Intente con un archivo más ligero o con mejor conexión." : err.message] });
    }
  };
  quitarAdjunto = () => { this.limpiarAdjuntoNuevo(); this.setEd({ adjunto: null }); };

  // Valida el formulario y arma lo que se manda a la API
  cuerpoEditor() {
    const e = this.state.editor;
    const errores = [], bad = {};
    const titulo = e.titulo.trim(), texto = e.texto.trim();
    if (!titulo) { errores.push("Escriba el título del aviso"); bad.titulo = 1; }
    if (!texto) { errores.push("Escriba el texto del aviso"); bad.texto = 1; }
    if (e.tipo === "Menú" && !e.menuDia) { errores.push("Elija el día del menú"); bad.menuDia = 1; }
    if (e.tipo === "Evento") {
      if (!e.fecha) { errores.push("Elija el día del evento"); bad.fecha = 1; }
      if (!e.hora) { errores.push("Escriba a qué hora empieza"); bad.hora = 1; }
      if (e.horaFin && e.hora && e.horaFin < e.hora) { errores.push("La hora de término debe ser después del inicio"); bad.horaFin = 1; }
      if (!e.lugar.trim()) { errores.push("Escriba el lugar del evento"); bad.lugar = 1; }
    }
    let expiresAt = null;
    if (e.hasta) {
      expiresAt = e.expiresOriginal && partesMx(new Date(e.expiresOriginal)).fecha === e.hasta ? e.expiresOriginal : mxAUtc(masDias(e.hasta, 1), "00:00");
      if (new Date(expiresAt).getTime() <= Date.now()) { errores.push("La fecha de «mostrar hasta» ya pasó"); bad.hasta = 1; }
    }
    if (e.adjunto && e.adjunto.subiendo) errores.push("Espere a que termine de subir el archivo");
    if (errores.length) return { errores, bad };
    const body = { category: e.categoria, title: titulo, body: texto, isPinned: !!e.fijado, attachmentIds: e.adjunto && e.adjunto.id ? [e.adjunto.id] : [], expiresAt };
    if (e.tipo === "Menú") Object.assign(body, { menuDate: e.menuDia, mealType: e.comida });
    if (e.tipo === "Evento") {
      const fin = e.horaFin || (() => { const p = e.hora.split(":").map(Number); return p[0] >= 23 ? "23:59" : pad(p[0] + 1) + ":" + pad(p[1]); })();
      Object.assign(body, { eventStartAt: mxAUtc(e.fecha, e.hora), eventEndAt: mxAUtc(e.fecha, fin), eventLocation: e.lugar.trim() });
    }
    if (!e.id) body.type = TIPOS_API[e.tipo];
    return { body };
  }

  guardarAviso = async () => {
    const e = this.state.editor;
    if (e.enviando) return;
    const r = this.cuerpoEditor();
    if (r.errores) { this.setEd({ errores: r.errores, bad: r.bad }); return; }
    const json = JSON.stringify(r.body);
    // La misma clave de idempotencia se reutiliza mientras el cuerpo no cambie
    const idemKey = !e.id ? (e.idemKey && e.idemBody === json ? e.idemKey : uuid()) : null;
    this.setEd({ enviando: true, errores: [], bad: {}, idemKey, idemBody: json });
    try {
      const res = e.id
        ? await api("posts/" + e.id, { method: "PUT", body: r.body, headers: e.etag ? { "If-Match": e.etag } : {} })
        : await api("posts", { method: "POST", body: r.body, headers: { "Idempotency-Key": idemKey } });
      const p = res.payload.data;
      if (this._editorFoto) { try { URL.revokeObjectURL(this._editorFoto); } catch (x) {} this._editorFoto = null; }
      this.setState({ guardado: { post: p, nuevo: !e.id }, admin: "guardado", editor: Object.assign({}, EDITOR_VACIO) });
      this.pedirFotos([p]);
      this.arriba();
      this.cargarMuro(true);
      this.cargarAgenda();
    } catch (err) {
      if (err.code === "VERSION_CONFLICT") { this.setEd({ enviando: false, conflicto: true }); return; }
      if (err.code === "IDEMPOTENCY_CONFLICT") { this.setEd({ enviando: false, idemKey: null, errores: ["Ese envío ya se había hecho con otros datos. Revise el muro antes de volver a publicar."] }); return; }
      const m = err.status === 422 ? this.erroresDeCampos(err, { title: "titulo", body: "texto", menuDate: "menuDia", mealType: "menuDia", eventStartAt: "fecha", eventEndAt: "horaFin", eventLocation: "lugar", expiresAt: "hasta", attachmentIds: "adjunto", category: "titulo" }) : { errores: [err.message + (err.status === 0 || err.status >= 500 || err.status === 408 ? " Sus datos siguen aquí." : "")], bad: {} };
      this.setEd({ enviando: false, errores: m.errores, bad: m.bad });
      this.arriba();
    }
  };

  // Alguien más editó el aviso mientras tanto (If-Match)
  verVersionActual = async () => {
    const e = this.state.editor;
    try {
      const { payload, etag } = await api("posts/" + e.id);
      this.setEd({ etag, conflicto: false, errores: [] });
      this.aviso("Esta es la versión actual. Si guarda ahora, la suya la reemplazará.", false);
      this.setState({ leyendo: payload.data });
      this.pedirFotos([payload.data]);
    } catch (err) { this.falla(err); }
  };

  vistaEditor(c) {
    const s = c.s, ed = s.editor;
    const gd = s.guardado ? s.guardado.post : null;
    return {
      crearAviso: this.nuevoAviso,

      // formulario
      edCargando: s.edCargando,
      edListo: !s.edCargando,
      edTituloPagina: ed.id ? "Editar aviso" : "Crear aviso nuevo",
      edEditando: !!ed.id,
      edTipos: ["Aviso", "Menú", "Evento"].map(tp => ({
        nombre: tp, cls: segCls(ed.tipo === tp), bloqueado: !!ed.id,
        elegir: () => this.setEd({ tipo: tp, categoria: tp === "Evento" ? "Actividad" : "Aviso", errores: [], bad: {} })
      })),
      edTitulo: ed.titulo,
      edCls: CAMPOS.reduce((o, k) => { o[k] = inCls(ed.bad[k]); return o; }, {}),
      edTituloPh: ed.tipo === "Menú" ? "Menú del día" : ed.tipo === "Evento" ? "Taller de lectura" : "Horario de recepción",
      edCategorias: ["Aviso", "Actividad", "Evento", "Noticia"].map(x => ({ nombre: x, cls: segCls(ed.categoria === x), elegir: () => this.setEd({ categoria: x }) })),
      edEsMenu: ed.tipo === "Menú",
      edEsEvento: ed.tipo === "Evento",
      edMenuDia: ed.menuDia,
      edComidas: Object.keys(COMIDAS).map(x => ({ nombre: COMIDAS[x], cls: segCls(ed.comida === x), elegir: () => this.setEd({ comida: x }) })),
      edFecha: ed.fecha, edHora: ed.hora, edHoraFin: ed.horaFin, edLugar: ed.lugar,
      edTexto: ed.texto,
      edHasta: ed.hasta,
      edHastaAyuda: ed.hasta ? "Deja de verse en el muro al terminar el " + diaLargo(ed.hasta).toLowerCase() + "." : "Sin fecha de retiro: se queda hasta que lo archive.",
      edSet: CAMPOS.reduce((o, k) => { o[k] = e => { const val = e.target.value; this.setState(st => ({ editor: Object.assign({}, st.editor, { [k]: val, bad: Object.assign({}, st.editor.bad, { [k]: 0 }) }) })); }; return o; }, {}),
      edPuedeFijar: c.esAdmin,
      edFijarSiCls: segCls(ed.fijado), edFijarNoCls: segCls(!ed.fijado),
      edFijarSi: () => this.setEd({ fijado: true }), edFijarNo: () => this.setEd({ fijado: false }),
      edSinAdjunto: !ed.adjunto, edConAdjunto: !!ed.adjunto,
      edAdjuntoTxt: ed.adjunto ? (ed.adjunto.subiendo ? "Subiendo " + ed.adjunto.nombre + "…" : (ed.adjunto.tipo === "pdf" ? "📄 " : "") + ed.adjunto.nombre) : "Foto JPG o PNG hasta 5 MB · PDF hasta 9 MB",
      edFoto: ed.adjunto && ed.adjunto.tipo === "foto" ? (ed.adjunto.local || (ed.adjunto.id && s.medios[ed.adjunto.id] !== "error" ? s.medios[ed.adjunto.id] : null) || null) : null,
      edAdjuntar: this.adjuntar,
      edQuitarAdjunto: this.quitarAdjunto,
      edConflicto: !!ed.conflicto,
      edVerActual: this.verVersionActual,
      edHayErrores: ed.errores.length > 0,
      edErrores: ed.errores,
      edEnviando: !!ed.enviando,
      edGuardar: this.guardarAviso,
      edGuardarTxt: ed.enviando ? "Guardando…" : ed.id ? "Guardar cambios" : "Publicar aviso",

      // confirmación (guardado.html)
      gdTitulo: s.guardado && s.guardado.nuevo ? "Aviso publicado" : "Se guardaron los cambios",
      gdTexto: gd ? (s.guardado.nuevo ? "«" + gd.title + "» ya está en el muro y les llegó a los residentes según sus preferencias." : "«" + gd.title + "» ya se ve corregido. Editar no vuelve a enviar notificaciones.") : "",
      gdPreview: gd ? [this.tarjeta(gd)] : []
    };
  }
};
