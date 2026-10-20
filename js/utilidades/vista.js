// Ayudas para armar los valores que leen las plantillas (pantallas/*.html).

// Clase de un botón de selector: "on" cuando está elegido
export const segCls = on => on ? "on" : "";
// Clase de un campo de texto: marcado en rojo si tiene error
export const inCls = b => "p-input" + (b ? " bad" : "");
// Selector Contraseña / PIN
export const modos = (actual, elegir) => [{ id: "pass", nombre: "Contraseña" }, { id: "pin", nombre: "PIN" }]
  .map(m => ({ nombre: m.nombre, cls: segCls(actual === m.id), elegir: () => elegir(m.id) }));
// ¿Hay más páginas por cargar en una lista paginada?
export const masDe = lst => lst.items.length < lst.total && !lst.cargando && !lst.error;
