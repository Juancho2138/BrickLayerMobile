# Editor UX v1.1

## Paleta oficial

BrickLayer v1.1 usa 15 codigos de color. Los codigos son la identidad del proyecto y se guardan sin transformar en archivos `.bricklayers`.

| Codigo | Nombre |
| --- | --- |
| A | Amarillo |
| N | Negro |
| R | Rojo |
| B | Blanco |
| C | Cian |
| M | Marron |
| P | Piel |
| G | Gris |
| V | Verde |
| L | Morado |
| U | Azul |
| S | Rosado |
| O | Naranja |
| I | Lila |
| Q | Marron claro |

La definicion central vive en `palette.js` con `{ code, name, hex }`. Los 10 codigos previos no cambiaron; solo se agregaron `U`, `S`, `O`, `I` y `Q`.

## Atajos de escritorio

Los atajos globales se ignoran cuando el foco esta en `input`, `textarea`, `select`, contenido editable o un dialogo con campo de texto activo.

| Tecla | Accion |
| --- | --- |
| A/N/R/B/C/M/P/G/V/L/U/S/O/I/Q | Cambiar a Pintar y seleccionar color |
| E | Borrador |
| F | Referencia |
| T | Plantilla |
| Flecha izquierda/derecha | Capa anterior/siguiente |
| Shift + flecha izquierda/derecha | Primera/ultima capa |
| K | Nueva capa |
| D | Duplicar capa |
| Z | Deshacer |
| Y | Rehacer |
| Espacio | Editar/Navegar |
| + / - / 0 | Acercar, alejar, ajustar |

BrickLayer no intercepta `Ctrl+N`, `Ctrl+D`, `Ctrl+Z` ni `Ctrl+Y`; esas combinaciones quedan libres para el navegador o el sistema.

## Modo movil

La interfaz decide por ancho y capacidad de puntero, no por user-agent. En pantallas pequenas la prioridad visual es: referencia, estado, boton Editar/Navegar, editor, controles tactiles y navegacion de capas.

El estado inicial en dispositivos sin puntero fino es `NAVEGAR`, para evitar pintura accidental. En `NAVEGAR`, la cuadricula permite desplazamiento normal y no modifica celdas. En `EDITAR`, el tap aplica la herramienta actual.

`Pintar arrastrando` queda disponible como opcion. En movil inicia desactivado; en escritorio inicia activado.

## Referencias

La herramienta Referencia crea puntos automaticos `R1`, `R2`, `R3` y continua con el siguiente numero disponible. No pide nombre manual por defecto.

Las referencias son metadata independiente:

- no cuentan como bloques;
- no aparecen como voxeles fisicos;
- no modifican inventario, organizacion ni geometria;
- se pueden borrar desde el dialogo de referencia sin tocar el bloque de esa celda.

Cada marcador se ve encima de la celda con su ID. Al abrir una referencia se muestra ID, X, Y y capa inicial. La lista de referencias permite localizar el punto y cambiar a la capa correspondiente.

## Imagen de referencia

La imagen de referencia se muestra dentro del area central, justo encima del editor. Sus controles son compactos: ocultar/mostrar, ampliar y ajuste visual por rango.

## Compatibilidad

Los `.bricklayers` antiguos siguen abriendo porque la normalizacion mezcla la paleta guardada con la paleta oficial actual. Los archivos nuevos pueden contener `U`, `S`, `O`, `I` y `Q`.

PDF, visor 3D y organizador usan los codigos del proyecto. El PDF toma los nombres desde `palette.js`; el organizador y el visor 3D usan `project.palette`, por lo que reconocen los 15 colores sin cambiar sus algoritmos.
