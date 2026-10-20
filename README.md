# Residencia Guadalupe · Portal web

Portal para residentes, personal y administración de Residencia Guadalupe A.C. (Cuernavaca).
Se conecta a la API del equipo (Node/Express/MySQL en AWS). El diseño viene de Claude Design.

## Cómo correrlo

```bash
python3 -m http.server 5173
# abrir http://localhost:5173
```

Necesita un servidor (no funciona abriendo `index.html` con doble clic).

**Modo de prueba** (datos inventados, no toca la base de datos real):

```bash
node pruebas/servidor-prueba.js 8099
# abrir http://localhost:5173/?api=http://localhost:8099/api/v1/
```

Cuentas de prueba: `admin@prueba.com` PIN 1234 · `empleado@prueba.com` / empleado123 · `residente@prueba.com` / residente123.

## Dónde está cada cosa

Cada pantalla tiene **el mismo nombre** en tres lugares: su HTML en `pantallas/`, su lógica en `js/pantallas/` y su ruta en la URL.

| Pantalla | Ruta | HTML | Lógica |
|---|---|---|---|
| Inicio de sesión | — | `pantallas/login.html` | `js/pantallas/login.js` |
| Muro | `#/muro` | `pantallas/portal/muro.html` | `js/pantallas/muro.js` |
| Hoy (agenda) | `#/hoy` | `pantallas/portal/hoy.html` | `js/pantallas/hoy.js` |
| Buzón (residentes) | `#/avisos` | `pantallas/portal/buzon.html` | `js/pantallas/buzon.js` |
| Perfil | `#/perfil` | `pantallas/portal/perfil.html` | `js/pantallas/perfil.js` |
| Avisos publicados | `#/admin/avisos` | `pantallas/admin/avisos.html` | `js/pantallas/admin/avisos.js` |
| Crear / editar aviso | `#/admin/editor` | `pantallas/admin/editor.html` | `js/pantallas/admin/editor.js` |
| Aviso guardado | `#/admin/guardado` | `pantallas/admin/guardado.html` | `js/pantallas/admin/editor.js` |
| Usuarios (admin) | `#/admin/usuarios` | `pantallas/admin/usuarios.html` | `js/pantallas/admin/usuarios.js` |
| Ficha de cuenta (admin) | `#/admin/ficha` | `pantallas/admin/ficha.html` | `js/pantallas/admin/ficha.js` |
| Registro de cambios (admin) | `#/admin/auditoria` | `pantallas/admin/auditoria.html` | `js/pantallas/admin/auditoria.js` |
| Leer un aviso (ventana) | — | `pantallas/comunes/lectura.html` | `js/pantallas/lectura.js` |

```
index.html              esqueleto: carga estilos y js/main.js
pantallas/
  marco.html            índice de pantallas y en qué orden se arman
  login.html
  portal/               barra de arriba, muro, hoy, buzón, perfil
  admin/                avisos, editor, guardado, usuarios, ficha, auditoría
  comunes/              lectura de aviso, «¿está seguro?», aviso flotante
estilos/
  sistema-diseno.css    exportado de Claude Design (no editar)
  fuentes.css           Playfair Display y Source Sans 3
  base.css              fondo, enlaces, foco
  componentes.css       botones, tarjetas, campos, barra, ventanas
  login.css             portada con fotos y formulario
  portal.css            acomodo en escritorio (2 columnas) y celular
  accesibilidad.css     «reducir movimiento»
js/
  main.js               arranque: junta las pantallas y enciende el motor
  api/cliente.js        conexión con la API (URL, sesión, errores, archivos privados)
  utilidades/           fechas (hora de CDMX), validaciones, ayudas para plantillas
  app/
    componente.js       une todas las piezas
    navegacion.js       rutas, permisos por rol y qué se carga en cada pantalla
    sesion.js           entrar, salir, sesión vencida
    estado.js           estado inicial de la app
    base.js             avisos flotantes, confirmar, leer en voz alta, fotos
    tarjeta.js          cómo se muestra un aviso en cualquier lista
    catalogos.js        tipos, comidas, roles, filtros, textos de auditoría
  pantallas/            lógica de cada pantalla (ver tabla)
assets/                 imágenes, fuentes, React y el motor de Claude Design
pruebas/                servidor de prueba con datos inventados
```

## Cómo funciona

1. `js/main.js` lee `pantallas/marco.html`, reemplaza cada `<incluir src="...">` por su archivo y lo pone en `<x-dc>`.
2. Carga el motor de Claude Design (`assets/377c583d.js`), que dibuja las plantillas con React.
3. El motor pide la lógica: `js/app/componente.js` arma la clase uniendo una pieza por pantalla.
4. En las plantillas, `{{ algo }}` es un valor que da la función `vista…()` de esa pantalla, y `sc-camel-on-click="{{ algo }}"` es lo que pasa al hacer clic.

## Agregar una pantalla nueva

1. Crear `pantallas/<lugar>/<nombre>.html` envuelto en `<sc-if value="{{ ver<Nombre> }}">` y agregar su `<incluir>` en `pantallas/marco.html`.
2. Crear `js/pantallas/<nombre>.js` con su mixin (`export const Nombre = B => class extends B { … vistaNombre(c) { … } }`) y agregarlo a `PIEZAS` y a `renderVals()` en `js/app/componente.js`.
3. Agregar la ruta en `RUTAS`, su caso en `irA()` y su bandera `ver<Nombre>` en `vistaNavegacion()` (`js/app/navegacion.js`).
