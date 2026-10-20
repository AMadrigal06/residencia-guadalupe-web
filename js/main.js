// =====================================================================
// Arranque de la página
//   1. Junta las pantallas (pantallas/marco.html y sus <incluir>) dentro de <x-dc>.
//   2. Deja lista la lógica (js/app/componente.js) para el motor.
//   3. Carga el motor de Claude Design (assets/377c583d.js), que dibuja todo con React.
// =====================================================================
import { crearComponente } from "./app/componente.js";

const MOTOR = "assets/377c583d.js";

// Lee una plantilla y reemplaza sus <incluir src="..."> (rutas relativas al archivo que las incluye)
async function cargarPlantilla(ruta) {
  const r = await fetch(ruta, { cache: "no-cache" });
  if (!r.ok) throw new Error("No se encontró la plantilla " + ruta);
  const html = (await r.text()).replace(/<!--[\s\S]*?-->/g, "");
  const carpeta = ruta.slice(0, ruta.lastIndexOf("/") + 1);
  const partes = html.split(/<incluir src="([^"]+)"><\/incluir>/);
  for (let i = 1; i < partes.length; i += 2) partes[i] = await cargarPlantilla(carpeta + partes[i]);
  return partes.join("");
}

function cargarScript(src) {
  return new Promise((ok, falla) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => falla(new Error("No se pudo cargar " + src));
    document.head.appendChild(s);
  });
}

async function arrancar() {
  document.querySelector("x-dc").innerHTML = await cargarPlantilla("pantallas/marco.html");
  // El <script data-dc-script> de index.html llama a esta función con la clase base del motor
  window.__rgCrearComponente = crearComponente;
  await cargarScript(MOTOR);
}

arrancar().catch(e => {
  console.error(e);
  document.body.insertAdjacentHTML("afterbegin", '<p style="padding:24px;font-family:system-ui">No se pudo abrir la página: ' + e.message + "</p>");
});
