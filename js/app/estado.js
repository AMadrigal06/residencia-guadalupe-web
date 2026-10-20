// Estado de la app: cómo arranca y cómo se limpia al cerrar sesión.

export const LOGIN_VACIO = { modo: "entrar", nombre: "", correo: "", tipo: "pass", clave: "", mostrar: false, errores: [], bad: {}, olvido: false, cargando: false, registradoNombre: "", aviso: "" };
export const EDITOR_VACIO = { id: null, etag: null, tipo: "Aviso", titulo: "", categoria: "Aviso", menuDia: "", comida: "lunch", fecha: "", hora: "", horaFin: "", lugar: "", texto: "", hasta: "", fijado: false, adjunto: null, errores: [], bad: {}, enviando: false, conflicto: false, idemKey: null, idemBody: null };
export const LISTA_VACIA = { items: [], page: 0, total: 0, cargando: false, error: "" };
const AGENDA_VACIA = { cargando: false, error: "", items: [], cargada: false };

export const estadoInicial = () => ({
  // navegación (ver js/app/navegacion.js)
  vista: "login",        // "login" | "app"
  tab: "muro",           // menú principal: muro | hoy | avisos | perfil
  admin: null,           // pantalla de administración abierta: avisos | editor | guardado | usuarios | ficha | auditoria
  // sesión
  login: Object.assign({}, LOGIN_VACIO),
  user: null,
  // muro y lectura
  filtro: "Todo",
  anteriores: false,
  muro: Object.assign({}, LISTA_VACIA),
  leyendo: null,
  leyendoCargando: false,
  hablando: null,
  medios: {},
  // hoy
  agenda: Object.assign({}, AGENDA_VACIA),
  hoyTab: "hoy",
  // buzón
  notifs: Object.assign({ unread: 0 }, LISTA_VACIA),
  unread: 0,
  // perfil
  perfilEdit: null,
  perfilForm: { valor: "", actual: "", tipo: "pass", error: "", badActual: false, enviando: false },
  escala: 1,
  // administración
  editor: Object.assign({}, EDITOR_VACIO),
  edCargando: false,
  guardado: null,
  apFiltro: "published",
  adminPosts: Object.assign({}, LISTA_VACIA),
  uFiltro: "pending",
  uBusqueda: "",
  uQuery: "",
  usuarios: Object.assign({}, LISTA_VACIA),
  uConteos: {},
  ficha: null,
  fichaCargando: false,
  reponer: { tipo: "pin", clave: "", error: "", enviando: false },
  auFiltro: "",
  audit: Object.assign({}, LISTA_VACIA),
  // ventanas
  confirm: null,
  toast: null
});

// Lo que se borra al salir o cuando vence la sesión
export const reiniciarEstado = loginExtra => ({
  vista: "login", user: null, admin: null, tab: "muro", leyendo: null, confirm: null, toast: null, hablando: null,
  muro: Object.assign({}, LISTA_VACIA), adminPosts: Object.assign({}, LISTA_VACIA), usuarios: Object.assign({}, LISTA_VACIA),
  audit: Object.assign({}, LISTA_VACIA), notifs: Object.assign({ unread: 0 }, LISTA_VACIA), agenda: Object.assign({}, AGENDA_VACIA),
  editor: Object.assign({}, EDITOR_VACIO), ficha: null, guardado: null, medios: {}, unread: 0, perfilEdit: null,
  login: Object.assign({}, LOGIN_VACIO, loginExtra || {})
});
