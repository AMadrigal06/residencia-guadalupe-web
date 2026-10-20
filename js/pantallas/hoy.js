// Pantalla: Hoy (#/hoy).  Plantilla: pantallas/portal/hoy.html
// Agenda de la casa: eventos y menús de hoy, mañana y esta semana. El muro también usa la agenda.
import { api } from "../api/cliente.js";
import { hoyIso, lunes, masDias, mxAUtc, partesMx, horaTxt, diaCorto } from "../utilidades/fechas.js";
import { qs } from "../utilidades/formatos.js";
import { segCls } from "../utilidades/vista.js";
import { COMIDAS, COMIDA_ORDEN } from "../app/catalogos.js";

export const Hoy = B => class extends B {
  async cargarAgenda() {
    const hoy = hoyIso(), ini = lunes();
    const fin = [masDias(ini, 6), masDias(hoy, 1)].sort()[1];
    this.setState(s => ({ agenda: Object.assign({}, s.agenda, { cargando: true, error: "" }) }));
    try {
      const [ev, me] = await Promise.all([
        api("posts?" + qs({ type: "event", eventFrom: mxAUtc(ini, "00:00"), eventTo: mxAUtc(masDias(fin, 1), "00:00"), sort: "eventStartAt", limit: 100 })),
        api("posts?" + qs({ type: "menu", sort: "-publishedAt", limit: 100 }))
      ]);
      const items = [];
      ev.payload.data.forEach(p => {
        const a = partesMx(new Date(p.eventStartAt));
        const b = p.eventEndAt ? partesMx(new Date(p.eventEndAt)) : null;
        items.push({ fecha: a.fecha, orden: a.hora, horaTxt: horaTxt(a.hora) + (b && b.hora !== a.hora && b.fecha === a.fecha ? " – " + horaTxt(b.hora) : ""), titulo: p.title, lugar: p.eventLocation || "En la residencia", id: p.id });
      });
      me.payload.data.forEach(p => {
        if (p.menuDate && p.menuDate >= ini && p.menuDate <= fin) items.push({ fecha: p.menuDate, orden: COMIDA_ORDEN[p.mealType] || "00:00", horaTxt: COMIDAS[p.mealType] || "Menú", titulo: p.title, lugar: "Restaurante · menú", id: p.id });
      });
      items.sort((x, y) => (x.fecha + x.orden > y.fecha + y.orden ? 1 : -1));
      this.setState({ agenda: { cargando: false, error: "", items, cargada: true } });
    } catch (e) {
      this.setState({ agenda: { cargando: false, error: e.message, items: [], cargada: false } });
    }
  }

  vistaHoy(c) {
    const s = c.s, hoy = c.hoy;
    const finSemana = masDias(lunes(), 6);
    const manana = masDias(hoy, 1);
    const rango = { hoy: [hoy, hoy], manana: [manana, manana], semana: [lunes(), finSemana] }[s.hoyTab];
    const items = s.agenda.items.filter(a => a.fecha >= rango[0] && a.fecha <= rango[1]);
    return {
      hoyTabs: [{ id: "hoy", nombre: "Hoy" }, { id: "manana", nombre: "Mañana" }, { id: "semana", nombre: "Esta semana" }]
        .map(x => ({ nombre: x.nombre, cls: segCls(s.hoyTab === x.id), elegir: () => this.setState({ hoyTab: x.id }) })),
      hoyEtiqueta: s.hoyTab === "hoy" ? "Hoy · " + diaCorto(hoy) : s.hoyTab === "manana" ? "Mañana · " + diaCorto(manana)
        : "Del " + diaCorto(lunes()).toLowerCase() + " al " + diaCorto(finSemana).toLowerCase(),
      hoyItems: items.map(a => Object.assign({}, a, { cuando: (s.hoyTab === "semana" ? diaCorto(a.fecha) + " · " : "") + a.horaTxt, abrir: () => this.abrirPost(a.id) })),
      hoyCargando: s.agenda.cargando && !s.agenda.cargada,
      hoyError: s.agenda.error || null,
      hoyReintentar: () => this.cargarAgenda(),
      hoyHay: items.length > 0,
      hoyVacio: s.agenda.cargada && !s.agenda.error && items.length === 0,
      hoyAlterna: () => this.setState({ hoyTab: s.hoyTab === "hoy" ? "manana" : "hoy" }),
      hoyAlternaTxt: s.hoyTab === "hoy" ? "Ver las de mañana" : "Ver las de hoy"
    };
  }
};
