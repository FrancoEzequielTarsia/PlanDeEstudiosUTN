/* Plan K23 — Ingenieria en Sistemas de Informacion, UTN FRBA.
 *
 * FUENTE: la lamina oficial del plan, que lista para cada materia su nivel y
 * sus requisitos escritos, distinguiendo:
 *   Regularizadas: ...  -> correlativa de tipo REGULARIZAR
 *   Aprobadas: ...      -> correlativa de tipo APROBAR
 *
 * Esa lamina reemplaza al "Mapa Correlativas K23" que se habia usado antes: el
 * mapa tenia varias materias en el nivel equivocado (Ingles I, Probabilidad y
 * Estadistica, Ingles II, Redes de Datos, Ciencia de Datos, Ingenieria y
 * Sociedad) y no declaraba todos los requisitos de tipo APROBAR.
 *
 * `opcional: true` marca lo que no hace falta para el titulo de grado (hoy solo
 * el Seminario Integrador, obligatorio unicamente para el titulo intermedio).
 * No entra en el total de materias del plan.
 */

var PLAN_K23 = [
  // ------------------------------------------------------------- PRIMER NIVEL
  {codigo:"232011", nombre:"Sistemas y Procesos de Negocio", sigla:"SyPN", nivel:1, correlativas:[]},
  {codigo:"950702", nombre:"Análisis Matemático I", sigla:"AM1", nivel:1, correlativas:[]},
  {codigo:"232010", nombre:"Lógica y Estructuras Discretas", sigla:"LyED", nivel:1, correlativas:[]},
  {codigo:"082021", nombre:"Algoritmos y Estructuras de Datos", sigla:"AyED", nivel:1, correlativas:[]},
  {codigo:"082022", nombre:"Arquitectura de Computadoras", sigla:"AdC", nivel:1, correlativas:[]},
  {codigo:"950701", nombre:"Álgebra y Geometría Analítica", sigla:"AGA", nivel:1, correlativas:[]},
  {codigo:"950605", nombre:"Física I", sigla:"F1", nivel:1, correlativas:[]},
  {codigo:"951604", nombre:"Ingeniería y Sociedad", sigla:"IngSoc", nivel:1, correlativas:[]},

  // ------------------------------------------------------------ SEGUNDO NIVEL
  {codigo:"232020", nombre:"Análisis de Sistemas de Información", sigla:"ASI", nivel:2, correlativas:[
    {de:"232011", tipo:"REGULARIZAR"}, {de:"082021", tipo:"REGULARIZAR"}]},
  {codigo:"950703", nombre:"Análisis Matemático II", sigla:"AM2", nivel:2, correlativas:[
    {de:"950702", tipo:"REGULARIZAR"}, {de:"950701", tipo:"REGULARIZAR"}]},
  {codigo:"082025", nombre:"Sintaxis y Semántica de los Lenguajes", sigla:"SySL", nivel:2, correlativas:[
    {de:"232010", tipo:"REGULARIZAR"}, {de:"082021", tipo:"REGULARIZAR"}]},
  {codigo:"082026", nombre:"Paradigmas de Programación", sigla:"PdP", nivel:2, correlativas:[
    {de:"232010", tipo:"REGULARIZAR"}, {de:"082021", tipo:"REGULARIZAR"}]},
  {codigo:"951602", nombre:"Inglés I", sigla:"IT1", nivel:2, correlativas:[]},
  {codigo:"950606", nombre:"Física II", sigla:"F2", nivel:2, correlativas:[
    {de:"950702", tipo:"REGULARIZAR"}, {de:"950605", tipo:"REGULARIZAR"}]},
  {codigo:"082027", nombre:"Sistemas Operativos", sigla:"SSOO", nivel:2, correlativas:[
    {de:"082022", tipo:"REGULARIZAR"}]},
  {codigo:"950704", nombre:"Probabilidad y Estadística", sigla:"PyE", nivel:2, correlativas:[
    {de:"950702", tipo:"REGULARIZAR"}, {de:"950701", tipo:"REGULARIZAR"}]},

  // ------------------------------------------------------------- TERCER NIVEL
  {codigo:"232034", nombre:"Diseño de Sistemas de Información", sigla:"DSI", nivel:3, correlativas:[
    {de:"232020", tipo:"REGULARIZAR"}, {de:"082026", tipo:"REGULARIZAR"},
    {de:"951602", tipo:"APROBAR"}, {de:"082021", tipo:"APROBAR"}, {de:"232011", tipo:"APROBAR"}]},
  {codigo:"951603", nombre:"Inglés II", sigla:"IT2", nivel:3, correlativas:[
    {de:"951602", tipo:"REGULARIZAR"}]},
  {codigo:"950309", nombre:"Economía", sigla:"ECO", nivel:3, correlativas:[
    {de:"950702", tipo:"APROBAR"}, {de:"950701", tipo:"APROBAR"}]},
  {codigo:"232031", nombre:"Desarrollo de Software", sigla:"DdS", nivel:3, correlativas:[
    {de:"082026", tipo:"REGULARIZAR"}, {de:"232020", tipo:"REGULARIZAR"},
    {de:"232010", tipo:"APROBAR"}, {de:"082021", tipo:"APROBAR"}]},
  {codigo:"232030", nombre:"Base de Datos", sigla:"BD", nivel:3, correlativas:[
    {de:"082025", tipo:"REGULARIZAR"}, {de:"232020", tipo:"REGULARIZAR"},
    {de:"232010", tipo:"APROBAR"}, {de:"082021", tipo:"APROBAR"}]},
  {codigo:"SEM-INT", nombre:"Seminario Integrador", sigla:"SI", nivel:3, opcional:true, correlativas:[
    {de:"232020", tipo:"REGULARIZAR"},
    {de:"232011", tipo:"APROBAR"}, {de:"082021", tipo:"APROBAR"},
    {de:"082025", tipo:"APROBAR"}, {de:"082026", tipo:"APROBAR"}]},
  {codigo:"232032", nombre:"Comunicación de Datos", sigla:"CD", nivel:3, correlativas:[
    {de:"082022", tipo:"APROBAR"}, {de:"950605", tipo:"APROBAR"}]},
  {codigo:"232041", nombre:"Redes de Datos", sigla:"RD", nivel:3, correlativas:[
    {de:"082027", tipo:"REGULARIZAR"}, {de:"232032", tipo:"REGULARIZAR"}]},

  // ------------------------------------------------------------- CUARTO NIVEL
  {codigo:"232045", nombre:"Administración de Sistemas de Información", sigla:"AdmSI", nivel:4, correlativas:[
    {de:"950309", tipo:"REGULARIZAR"}, {de:"232034", tipo:"REGULARIZAR"},
    {de:"232020", tipo:"APROBAR"}]},
  {codigo:"232033", nombre:"Análisis Numérico", sigla:"AN", nivel:4, correlativas:[
    {de:"950703", tipo:"REGULARIZAR"},
    {de:"950702", tipo:"APROBAR"}, {de:"950701", tipo:"APROBAR"}]},
  {codigo:"232040", nombre:"Ingeniería y Calidad de Software", sigla:"IyCS", nivel:4, correlativas:[
    {de:"232030", tipo:"REGULARIZAR"}, {de:"232031", tipo:"REGULARIZAR"}, {de:"232034", tipo:"REGULARIZAR"},
    {de:"082025", tipo:"APROBAR"}, {de:"082026", tipo:"APROBAR"}]},
  {codigo:"232043", nombre:"Simulación", sigla:"Sim", nivel:4, correlativas:[
    {de:"950704", tipo:"REGULARIZAR"}, {de:"950703", tipo:"APROBAR"}]},
  {codigo:"950310", nombre:"Legislación", sigla:"Leg", nivel:4, correlativas:[
    {de:"951604", tipo:"REGULARIZAR"}]},
  {codigo:"232042", nombre:"Investigación Operativa", sigla:"IO", nivel:4, correlativas:[
    {de:"950704", tipo:"REGULARIZAR"}, {de:"232033", tipo:"REGULARIZAR"}]},
  {codigo:"232044", nombre:"Tecnologías para la Automatización", sigla:"TpA", nivel:4, correlativas:[
    {de:"950606", tipo:"REGULARIZAR"}, {de:"232033", tipo:"REGULARIZAR"},
    {de:"950703", tipo:"APROBAR"}]},
  {codigo:"232050", nombre:"Ciencia de Datos", sigla:"CdD", nivel:4, correlativas:[
    {de:"232043", tipo:"REGULARIZAR"},
    {de:"950704", tipo:"APROBAR"}, {de:"232030", tipo:"APROBAR"}]},

  // ------------------------------------------------------------- QUINTO NIVEL
  {codigo:"082037", nombre:"Proyecto Final", sigla:"PF", nivel:5, correlativas:[
    {de:"232040", tipo:"REGULARIZAR"}, {de:"232045", tipo:"REGULARIZAR"}, {de:"232041", tipo:"REGULARIZAR"},
    {de:"951603", tipo:"APROBAR"}, {de:"232031", tipo:"APROBAR"}, {de:"232034", tipo:"APROBAR"}]},
  {codigo:"082040", nombre:"Inteligencia Artificial", sigla:"IA", nivel:5, correlativas:[
    {de:"232043", tipo:"REGULARIZAR"},
    {de:"950704", tipo:"APROBAR"}, {de:"232033", tipo:"APROBAR"}]},
  {codigo:"232051", nombre:"Gestión Gerencial", sigla:"GC", nivel:5, correlativas:[
    {de:"950310", tipo:"REGULARIZAR"}, {de:"232045", tipo:"REGULARIZAR"},
    {de:"950309", tipo:"APROBAR"}]},
  {codigo:"082035", nombre:"Sistemas de Gestión", sigla:"SG", nivel:5, correlativas:[
    {de:"950309", tipo:"REGULARIZAR"}, {de:"232042", tipo:"REGULARIZAR"},
    {de:"232034", tipo:"APROBAR"}]},
  {codigo:"232052", nombre:"Seguridad en los Sistemas de Información", sigla:"SSI", nivel:5, correlativas:[
    {de:"232041", tipo:"REGULARIZAR"}, {de:"232045", tipo:"REGULARIZAR"},
    {de:"232031", tipo:"APROBAR"}, {de:"232032", tipo:"APROBAR"}]},
  {codigo:"231699", nombre:"Práctica Profesional Supervisada", sigla:"PPS", nivel:5, correlativas:[
    {de:"232040", tipo:"REGULARIZAR"}, {de:"232045", tipo:"REGULARIZAR"}, {de:"232041", tipo:"REGULARIZAR"},
    {de:"951603", tipo:"APROBAR"}, {de:"232031", tipo:"APROBAR"}, {de:"232034", tipo:"APROBAR"}]},
];

/* Electivas.
 *
 * El plan pide 3 electivas de 3.º/4.º nivel y otras 5 de 5.º nivel. Las de 5.º
 * todavia no estan cargadas porque no se sabe cuales son, asi que el cupo de
 * abajo cuenta solo las de 3.º/4.º.
 *
 * El listado puede estar incompleto: la app permite agregar una a mano.
 */
var CUPO_ELECTIVAS = 3;

var ELECTIVAS_K23 = [
  {codigo:"232063", nombre:"Experiencia de Usuario y Accesibilidad"},
  {codigo:null, nombre:"Administración Estratégica del Capital Humano"},
  {codigo:null, nombre:"Ciberseguridad"},
  {codigo:null, nombre:"Comunicación gráfica y visual"},
  {codigo:null, nombre:"Creatividad e Innovación"},
  {codigo:null, nombre:"Criptografía"},
  {codigo:null, nombre:"Gerenciamiento de Proyectos de Sistemas de Información"},
  {codigo:null, nombre:"Gestión del Talento Humano"},
  {codigo:null, nombre:"Ingeniería de Requisitos"},
  {codigo:null, nombre:"Metodología de Investigación Científico-Tecnológica"},
  {codigo:null, nombre:"Metodología de la Conducción de Equipos de Trabajo"},
  {codigo:null, nombre:"Patrones Algorítmicos"},
  {codigo:null, nombre:"Procesamiento del lenguaje natural"},
  {codigo:null, nombre:"Química ambiental"},
  {codigo:null, nombre:"Técnicas Avanzadas de Programación"},
  {codigo:null, nombre:"Técnicas de Gráficos por Computadora"},
  {codigo:null, nombre:"Tecnologías Avanzadas en la Construcción de Software"},
  {codigo:null, nombre:"Tendencias y Escenarios Tecnológicos"},
  {codigo:null, nombre:"Transformación digital"},
];
