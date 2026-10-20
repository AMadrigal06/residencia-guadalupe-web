// Pantalla: Muro (#/muro).  Plantilla: pantallas/portal/muro.html
// Lista de avisos con filtros + panel lateral (hoy, próximos días, buzón o administración, contacto).
import { api } from "../api/cliente.js";
import { hoyIso, masDias, mxAUtc, diaCorto } from "../utilidades/fechas.js";
import { qs } from "../utilidades/formatos.js";
import { segCls, masDe } from "../utilidades/vista.js";
import { FILTROS } from "../app/catalogos.js";
import { LISTA_VACIA } from "../app/estado.js";

export const Muro = B => class extends B {
  async cargarMuro(reset) {
    const s = this.state;
    const prev = reset ? Object.assign({}, LISTA_VACIA) : s.muro;
    const page = prev.page + 1;
    const req = (this._muroReq = (this._muroReq || 0) + 1);
    this.setState({ muro: Object.assign({}, prev, { cargando: true, error: "" }) });
    const f = FILTROS.find(x => x.nombre === s.filtro) || FILTROS[0];
    const q = Object.assign({ page, limit: 20 }, f.q);
    if (s.anteriores) q.publishedBefore = mxAUtc(masDias(hoyIso(), -30), "00:00");
    try {
      const { payload } = await api("posts?" + qs(q));
      if (req !== this._muroReq) return;
      const items = reset ? payload.data : prev.items.concat(payload.data.filter(p => !prev.items.some(x => x.id === p.id)));
      this.setState({ muro: { items, page, total: payload.meta ? payload.meta.total : items.length, cargando: false, error: "" } });
      this.pedirFotos(payload.data);
    } catch (e) {
      if (req !== this._muroReq) return;
      this.setState(st => ({ muro: Object.assign({}, st.muro, { cargando: false, error: e.message }) }));
    }
  }
  cambiarMuro(c) { this.setState(c); setTimeout(() => this.cargarMuro(true), 0); this.arriba(); }

  vistaMuro(c) {
    const s = c.s, hoy = c.hoy, muro = s.muro, ag = s.agenda.items;
    const proximos = ag.filter(a => a.fecha > hoy && a.fecha <= masDias(hoy, 7));
    return {
      // panel lateral
      agendaHoy: ag.filter(a => a.fecha === hoy).slice(0, 4),
      sinAgendaHoy: !ag.some(a => a.fecha === hoy),
      agendaHoyVacioTxt: s.agenda.cargando && !s.agenda.cargada ? "Cargando…" : s.agenda.error ? "No se pudo cargar la agenda." : "Hoy no hay actividades programadas.",
      semana: proximos.slice(0, 4).map(a => ({ cuando: diaCorto(a.fecha) + " · " + a.horaTxt, titulo: a.titulo, abrir: () => this.abrirPost(a.id) })),
      haySemana: proximos.length > 0,
      buzonTxt: !s.unread ? "Está al día: no tiene avisos pendientes." : s.unread === 1 ? "Tiene 1 aviso sin leer." : "Tiene " + s.unread + " avisos sin leer.",

      // avisos
      filtros: FILTROS.map(f => ({ nombre: f.nombre, cls: segCls(s.filtro === f.nombre), elegir: () => this.cambiarMuro({ filtro: f.nombre }) })),
      muro: muro.items.map(p => this.tarjeta(p)),
      muroCargando: muro.cargando,
      muroError: muro.error || null,
      muroReintentar: () => this.cargarMuro(muro.items.length === 0),
      muroVacio: !muro.cargando && !muro.error && muro.items.length === 0 && muro.page > 0,
      muroHayMas: masDe(muro),
      muroMas: () => this.cargarMuro(false),
      muroAnteriores: s.anteriores,
      muroConAnteriores: !s.anteriores && !masDe(muro) && !muro.cargando && muro.items.length > 0,
      verTodoMuro: () => this.cambiarMuro({ filtro: "Todo", anteriores: false }),
      verAnteriores: () => this.cambiarMuro({ filtro: "Todo", anteriores: true })
    };
  }
};
