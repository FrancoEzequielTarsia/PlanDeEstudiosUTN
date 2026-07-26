# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Un único usuario: Franco, estudiante de Ingeniería en Sistemas de Información en UTN FRBA,
plan **K23**. Lo usa fuera de SIGA, en su propia computadora, en dos situaciones distintas:

1. **Al cerrar un cuatrimestre** — carga qué aprobó, qué regularizó, qué abandonó y con qué
   nota, y quiere ver de inmediato cómo se movió su peso académico y su promedio.
2. **Al inscribirse al cuatrimestre siguiente** — necesita responder rápido "¿qué puedo
   cursar?" mirando las correlativas, sin recorrer el mapa a ojo.

No es multiusuario, no tiene cuentas y no sincroniza con SIGA.

## Product Purpose

Llevar el seguimiento del plan de estudios K23 completo: estado y nota de cada materia,
cálculo del peso académico bajo las dos fórmulas vigentes (la actual y la que rige desde
CL2027), los promedios que UTN publica, y una lectura del mapa de correlativas que indique
sin ambigüedad qué materias están habilitadas para cursar y cuáles no, y qué falta para
habilitarlas.

Éxito: que el usuario pueda decidir su inscripción cuatrimestral mirando sólo esta app, y
que el peso académico que muestra coincida con el que SIGA/UTN.BA Helper le mostraría.

## Positioning

SIGA muestra el estado actual pero no deja simular ni proyectar; el mapa de correlativas de
Franja Morada es un PDF estático que no sabe nada del avance del alumno. Esta app cruza las
dos cosas: el grafo de correlativas real del plan K23 evaluado contra el estado que el
usuario carga, más la aritmética oficial del peso académico, en una sola pantalla que
funciona sin conexión y sin credenciales.

## Operating Context

- Se abre como archivo local (`index.html`) en el navegador, sin build ni servidor.
- El estado vive en `localStorage` del navegador; se puede exportar e importar como JSON.
- Opcionalmente, el usuario elige un archivo del disco y la app lo reescribe en cada cambio
  (File System Access API, con el handle persistido en IndexedDB). Es una copia **adicional**:
  `localStorage` sigue siendo la fuente primaria, y un fallo al escribir el archivo nunca puede
  afectar los datos guardados. Verificado que `file://` es contexto seguro y que tanto
  `showSaveFilePicker` como IndexedDB funcionan desde ahí.
- El ciclo lectivo en UTN arranca **el 15 de marzo**: una fecha anterior al 15/03 pertenece
  al ciclo lectivo del año anterior. Esto importa para los términos "del último ciclo".
- Momentos de uso concentrados: fin de cuatrimestre (julio y diciembre) e inscripciones
  (febrero/marzo y julio/agosto).

## Capabilities and Constraints

### Alcance del plan

- 37 materias obligatorias del plan K23, agrupadas en 5 niveles.
- Electivas de 3º/4º nivel: el usuario elige cuáles cursa; cuentan como materias aprobadas.
- **Los niveles se toman de SIGA, no del PDF de correlativas.** El mapa de Franja Morada
  dibuja *Análisis Numérico* y *Ciencia de Datos* en la columna 4º, pero SIGA los ubica en
  Nivel 3 y Nivel 5. Manda SIGA.
- El PDF declara explícitamente: *"No están las correlativas que no son directas"*. El grafo
  cargado es el de correlativas **directas**, y la habilitación se resuelve contra ellas: si la
  materia previa está regularizada, sus propias correlativas ya se cumplieron necesariamente. El
  cierre transitivo se usa sólo para explicar la cadena completa de lo que falta.

### Estados y modelo por materia

Cada materia registra estado, nota, ciclo lectivo del hecho, y las marcas de ausencia y
abandono que la fórmula nueva necesita. El usuario eligió el modelo **completo**: la app
deriva los cinco términos del polinomio nuevo del historial, sin contadores manuales.

### Correlativas

Dos tipos de requisito, tal como los distingue el mapa:

- **Regularizar** — basta con tener la cursada aprobada de la materia previa.
- **Aprobar** — hace falta el final aprobado de la materia previa.

### Peso académico — fórmula vigente hasta CL2026

    P = 11 × MAp − 5 × añosDeCarrera − 3 × finalesDesaprobados

`añosDeCarrera = añoActual − añoDeInicio + 1`, donde el año de inicio es el del hecho
académico más antiguo registrado. Verificado contra dos ejemplos reales:
`11×15 − 5×4 − 3×4 = 133` y `11×17 − 3×1 − 5×3 = 169`.

### Peso académico — fórmula vigente desde CL2027 (resolución 2902/25)

    P = 11 × MAp_total − 7 × FAd_total − 19 × FAu_ciclo − 17 × MAb_ciclo + 5 × MR_ciclo

- **MAp_total** — materias aprobadas (con final, promocionadas o acreditadas) desde el inicio.
- **FAd_total** — finales adeudados desde el inicio: materias con cursada aprobada y final
  todavía no aprobado.
- **FAu_ciclo** — finales ausentes en el último ciclo lectivo (se inscribió a mesa, no se
  presentó y no se dio de baja en el período de preinscripción).
- **MAb_ciclo** — materias abandonadas en el último ciclo (no se presentó al menos a una de
  las instancias previstas por la cátedra).
- **MR_ciclo** — materias regularizadas en el último ciclo.

Verificado: `11×15 − 7×2 − 19×0 − 17×0 + 5×0 = 151`.

### Nota ponderada (Ordenanza Nº 1549)

La ponderación **sólo se aplica a notas de ciclos lectivos anteriores a 2017**. Tabla:

    1→1 · 2→2.67 · 3→4.33 · 4→6 · 5→6.67 · 6→7.33 · 7→8 · 8→8.67 · 9→9.33 · 10→10

Desde el ciclo lectivo 2017 inclusive, la nota ponderada **es igual** a la nota original.
Por eso, para un alumno que empezó después de 2017, los promedios ponderado y original
coinciden siempre.

### Promedios

Cuatro variantes, como en SIGA: notas ponderadas y notas originales, cada una con y sin
desaprobados. Se calculan sólo sobre finales que tienen nota numérica (una equivalencia
total sin nota no promedia). Redondeo a dos decimales.

### Restricciones técnicas

- HTML + CSS + JavaScript vanilla. Sin framework, sin build, sin dependencias externas.
- Debe funcionar abriendo el archivo con doble clic (`file://`), lo que descarta módulos ES
  cargados por red y cualquier `fetch` a archivos locales.
- Sin backend. Sin telemetría.

### Decisiones explícitamente abiertas

- El listado de electivas capturado puede estar incompleto (la captura del usuario está
  cortada). La app permite agregar electivas propias, así que la incompletitud no bloquea.
- El código de materia de *Práctica Profesional Supervisada* no aparece en la captura de
  SIGA; queda sin código hasta que el usuario lo confirme.
- Las correlativas de las electivas no están en el mapa; se tratan como sin correlativas
  hasta que el usuario indique lo contrario.

## Evidence on Hand

- `D:\franc\Mapa Correlativas K23.pdf` — mapa oficial de Franja Morada. **Fuente del grafo.**
  Las aristas se extrajeron de la geometría vectorial del PDF (no a ojo): 59 correlativas,
  48 de tipo *Regularizar* (trazo naranja) y 11 de tipo *Aprobar* (trazo violeta).
- Capturas de SIGA aportadas por el usuario — códigos de materia, niveles, estados posibles
  y los dos ejemplos numéricos de peso académico usados para verificar las fórmulas.
- Captura del listado de electivas de 3º/4º nivel (parcial, cortada al final).
- Código fuente de UTN.BA Helper (`pablomatiasgomez/utn.ba-helper`, MIT) — de donde se
  confirmó la tabla de la Ordenanza 1549, el corte del ciclo lectivo al 15/03 y la
  definición exacta de cada término de ambos polinomios.

**No hay** datos académicos reales cargados: el usuario pidió expresamente arrancar con
todas las materias en estado pendiente. No inventar notas, fechas ni estados suyos.

## Product Principles

1. **La aritmética oficial es sagrada.** El peso académico y los promedios replican la
   definición de UTN al detalle, incluidas sus rarezas (el `+1` en años de carrera, el corte
   del 15/03, la ponderación sólo pre-2017). Si difiere de SIGA, es un bug.
2. **Mostrar el porqué, no sólo el número.** Cada métrica se muestra con su fórmula
   desarmada y los valores que entraron, como hace SIGA. El usuario tiene que poder auditarla.
3. **La habilitación se calcula, no se declara.** Que una materia esté disponible se deriva
   del grafo y del estado cargado; y cuando no lo está, la app dice exactamente qué falta.
4. **Cargar el estado tiene que costar poco.** El uso real es una ráfaga de ediciones dos
   veces al año; el camino de "marcar materia + poner nota" debe ser de dos clics.
5. **Los datos son del usuario y viven en su máquina.** Sin cuentas, sin red, exportables en
   un JSON legible.

## Accessibility & Inclusion

Requisito propio del producto: el estado de una materia **nunca** puede comunicarse sólo por
color. El mapa de correlativas original es exactamente eso (verde/naranja/violeta/gris) y es
ilegible para daltonismo; acá cada estado lleva además etiqueta y forma/ícono propios.
Contraste mínimo AA sobre todos los chips de estado, y navegación completa por teclado.
