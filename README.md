# BrickLayer Mobile

Aplicacion web movil para digitalizar manualmente capas 2D de modelos construidos con bloques 1x1.

## Arrancar localmente

Desde esta carpeta:

```bash
python -m http.server 8080
```

Abrir:

```text
http://localhost:8080
```

## Uso

- Cambia el nombre del modelo y las dimensiones X/Y.
- Pinta la cuadricula por capa con la paleta.
- Usa borrar, rellenar, limpiar capa, deshacer y rehacer.
- Crea, copia, elimina y navega capas.
- Agrega una imagen de referencia desde el celular si la necesitas.
- Abre `Vista 3D` para revisar el modelo generado desde las matrices, sin editar datos.
- Usa `Organizar bloques` para generar una distribucion derivada de piezas fisicas 1x1, 1x2 y 1x3.
- Exporta el proyecto con `Guardar como .bricklayers`.
- Importa un archivo previo con `Abrir .bricklayers`.

El proyecto se guarda automaticamente en `localStorage` tras cada cambio.

La organizacion se guarda en `construction_layout` y se marca como desactualizada si cambian las matrices o capas.

## PWA

La app incluye `manifest.json` y `service-worker.js`. En Android Chrome puede instalarse despues de abrirla desde un servidor local o publicado. Tras la primera carga, los archivos principales quedan en cache para uso offline.

El visor 3D usa Three.js local en `vendor/three/`, tambien incluido en la cache offline.

## Tests

```bash
node tests/organizer.test.mjs
```

## Formato

Cada exportacion usa `format: "bricklayers-v1"` y guarda cada fila de matriz como string, por ejemplo:

```json
{
  "z": 0,
  "matrix": [
    "...AAAA...",
    "..AA..AA.."
  ]
}
```
