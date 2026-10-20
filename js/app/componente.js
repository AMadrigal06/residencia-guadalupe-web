// Une todas las piezas en el componente que dibuja el motor de Claude Design.
// Cada pantalla aporta sus funciones (mixin) y sus valores para la plantilla (vista…).
import { hoyIso } from "../utilidades/fechas.js";
import { Base } from "./base.js";
import { Tarjetas } from "./tarjeta.js";
import { Sesion } from "./sesion.js";
import { Navegacion } from "./navegacion.js";
import { Login } from "../pantallas/login.js";
import { Muro } from "../pantallas/muro.js";
import { Lectura } from "../pantallas/lectura.js";
import { Hoy } from "../pantallas/hoy.js";
import { Buzon } from "../pantallas/buzon.js";
import { Perfil } from "../pantallas/perfil.js";
import { AdminAvisos } from "../pantallas/admin/avisos.js";
import { Editor } from "../pantallas/admin/editor.js";
import { Usuarios } from "../pantallas/admin/usuarios.js";
import { Ficha } from "../pantallas/admin/ficha.js";
import { Auditoria } from "../pantallas/admin/auditoria.js";

const PIEZAS = [Tarjetas, Sesion, Navegacion, Login, Muro, Lectura, Hoy, Buzon, Perfil, AdminAvisos, Editor, Usuarios, Ficha, Auditoria];

export function crearComponente(DCLogic) {
  const App = PIEZAS.reduce((Clase, pieza) => pieza(Clase), Base(DCLogic));

  return class Component extends App {
    // Todos los valores que leen las plantillas de pantallas/
    renderVals() {
      const s = this.state, yo = s.user;
      const c = { s, yo, hoy: hoyIso() };
      if (yo) {
        c.esAdmin = yo.role === "admin";
        c.esPersonal = yo.role === "admin" || yo.role === "employee";
        c.esResidente = yo.role === "resident";
      }
      const v = Object.assign({ hoyIso: c.hoy }, this.vistaNavegacion(c), this.vistaComunes(c), this.vistaLogin(c));
      if (!yo) return v;

      // todos con sesión
      Object.assign(v, { appEstilo: "--k:" + (s.escala || 1), esAdmin: c.esAdmin, esPersonal: c.esPersonal, esResidente: c.esResidente },
        this.vistaMuro(c), this.vistaLectura(c), this.vistaHoy(c), this.vistaBuzon(c), this.vistaPerfil(c));
      if (!c.esPersonal) return v;

      // personal y admin
      Object.assign(v, this.vistaAdminAvisos(c), this.vistaEditor(c));
      if (!c.esAdmin) return v;

      // solo admin
      return Object.assign(v, this.vistaUsuarios(c), this.vistaFicha(c), this.vistaAuditoria(c));
    }
  };
}
