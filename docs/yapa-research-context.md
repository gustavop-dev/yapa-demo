# Yapa: contexto de research

Documento de referencia. No se carga en cada sesión; consúltalo cuando haga falta
justificar una decisión o preparar la conversación con el fundador.

Fecha del research original: agosto 2026. Los datos de producto, precios y regulación
cambian rápido, reverificar antes de citar en la entrevista.

---

## 0. Correcciones verificadas (18 de agosto de 2026)

Tres afirmaciones de este documento resultaron incorrectas al leer las fuentes
primarias. Se dejan marcadas en el cuerpo del texto y se resumen acá porque son, en sí
mismas, material para la entrevista.

**a) Radar no tiene tier gratuito.** Cita textual de radar.com/pricing: *"Radar does not
currently offer a free tier. Every plan starts with a quote based on your expected
usage."* Además, el producto Places (detección de visita a POI) abre su documentación
con *"Places is available on the Enterprise plan"*, sin precio público, y todos los
acuerdos son anuales. Radar tampoco expone MCC en ningún campo (cero menciones en sus
59 páginas de documentación) y su cobertura de place detection es "Great" solo en
Estados Unidos, el único de 236 países con esa calificación.

**b) El caché por celda geográfica no es legal con Google Places.** La sección 5 de este
documento proponía "caché por celda H3 o geohash en backend propio" como mitigación de
costo. Los Google Maps Platform Terms, sección 3.2.3(a), prohíben literalmente
*"pre-fetch, index, store, reshare, or rehost Google Maps Content"*, *"bulk download ...
places information"* y *"copy and save business names, addresses"*. Lo único cacheable
es el `place_id` (indefinido, por excepción expresa) y el lat/lng (máximo 30 días). El
nombre del comercio y su categoría, no.

**c) El flywheel de datos de entrenamiento tampoco es legal con Google.** Sección
3.2.3(c)(vii): *"Customer will not ... use Google Maps Content to improve machine
learning and artificial intelligence models, including to train, test, validate or
fine-tune the models."* Si los candidatos salen de Google Places, el foso de datos
propios que describe la sección 2 de este documento no se puede construir.

**Consecuencia arquitectónica.** La fuente de POIs tiene que ser un dataset abierto,
porque es la única que permite a la vez el caché y el entrenamiento. Overture Maps
Foundation, tema `places`: unos 75 millones de POIs, GeoParquet descargable sin
registro, unas 280 categorías básicas, licencias CDLA Permissive 2.0, Apache 2.0 y CC0
según contribuyente, ninguna con share-alike.

Y esto reformula la tesis de la sección 4. No es que "en USA el catálogo de datos es una
línea de factura". Es que **en USA el catálogo de POIs es gratis y abierto, y lo que es
una línea de factura es alquilárselo a Google, con una cláusula que además te prohíbe
construir tu propio foso encima.**

---

## 1. El producto y el mercado

Yapa: recomendar con cuál de tus tarjetas pagar en un comercio, para maximizar
beneficios. Pre-MVP, sin producto público. Mercado inicial: Estados Unidos.

Dos problemas técnicos que el fundador puso sobre la mesa: **geolocalización** y
**notificaciones push**.

### Por qué esos dos y no otros

La categoría ya existe en USA y está madura, pero concentrada en el checkout **online**
(extensiones de navegador). Lo presencial es el hueco. Geolocalización más push es
precisamente la apuesta por lo presencial. La tesis del fundador es coherente.

### Competencia

| Producto | Fuerte en | Modelo |
|---|---|---|
| Kudos | Checkout online, extensión Chrome y Safari | Gratis más Premium; unos 90M USD levantados (a16z, Kleiner Perkins, Nyca), valuación reportada de unos 500M USD, 400k+ usuarios |
| CardPointers | Base de datos amplia de tarjetas (5.000+ tarjetas, 900 bancos, 258 países) | Suscripción |
| MaxRewards | Agregación de cuentas más auto-activación de categorías rotativas | Suscripción (Gold) |
| Uthrive, AwardWallet, CardStack, RewardSmart | Nichos varios | Mixto |

Nota sobre MaxRewards: su diferencial (ver balances reales de puntos y activar ofertas)
requiere credenciales directas de los emisores, no Plaid. Por eso los usuarios reportan
desincronizaciones frecuentes que obligan a re-autenticar. Es un trade-off real, no un
bug: Plaid da transacciones, no saldos de recompensas ni ofertas del portal del emisor.

---

## 2. Geolocalización: el estado real del problema

### Lo que NO es el problema

La degradación intencional del GPS por parte de EE.UU. (Selective Availability) se apagó
en el año 2000. Los satélites GPS III ni siquiera tienen la capacidad. Jamming y
spoofing existen pero son fenómenos de zonas de conflicto. **No usar este argumento.**

Los teléfonos modernos además combinan GPS, Galileo, GLONASS y BeiDou, doble frecuencia
L1 y L5, y fusión con WiFi y celdas.

### Lo que SÍ es el problema

**a) El toggle de precisión de iOS.** Desde iOS 14 el usuario puede conceder ubicación
aproximada. Si `accuracyAuthorization` es `.reducedAccuracy`:

- precisión de **1 a 20 km** (documentado en `kCLLocationAccuracyReduced`)
- la ubicación se recalcula "at most a few times per hour"
- Apple no agrega ruido: dividió el mundo en regiones para preservar la ciudad
- **el region monitoring se apaga por completo.** Cita de `accuracyAuthorization`: *"If
  the value is `reducedAccuracy` ... your app can't use region monitoring or beacon
  ranging."* No degrada, se apaga.

Ojo con dos cifras que circulan y no están en documentación escrita: "unos 5 km" y "4
veces por hora" vienen de la sesión WWDC20 10660 transcrita por terceros. Usar el rango
documentado.

Salida: `requestTemporaryFullAccuracyAuthorization(withPurposeKey:)` pide precisión
temporal con un propósito declarado que el sistema muestra al usuario. Encaja perfecto
con un widget on-demand: el tap es el evento que justifica la petición.

**a-bis) Android tiene el mismo problema.** Desde Android 12 el usuario puede conceder
ubicación aproximada, que la documentación describe como *"accurate to within about 3
square kilometers"*. Es un área, no un radio. En Android 12 a 16 no existe equivalente a
la API temporal de iOS: la única vía es volver a pedir FINE y COARSE juntos, y el sistema
muestra un diálogo de upgrade distinto.

**Android 17 (API 37) introduce el location button**, que sí es el análogo funcional, y
la política de Play lo hace obligatorio para apps cuyo caso de uso es acceso puntual a
ubicación. Yapa es exactamente ese caso: la arquitectura del widget on-demand no solo es
la más defendible hoy, es la que Play va a exigir.

**b) Interiores.** Las paredes atenúan la señal unos 20 a 30 dB. En un mall no hay fix
GPS útil. Además: misma posición XY, distinto Z, varios comercios.

**c) Multipath urbano.** La señal rebota en edificios; el error horizontal en un cañón
urbano supera la distancia entre locales vecinos.

### Encuadre correcto para la entrevista

> "En interiores no hay señal GPS útil, y el error horizontal en un centro comercial es
> mayor que la distancia entre locales. El problema no es la precisión del sistema, es
> que la precisión disponible no alcanza para la granularidad del negocio."

### La solución de producto

Widget tipo Shazam: el usuario toca, ve comercios cercanos, selecciona el suyo.
Beneficios acumulados:

1. No requiere permiso de background location
2. No consume batería en background
3. Evita el límite de geofences
4. Evita la revisión de Google Play para background location (formulario más video)
5. Es la postura de privacidad más defendible bajo la regulación actual de USA
6. **Cada tap es una etiqueta de entrenamiento**, o sea un dataset propio de (geohash,
   hora, comercio confirmado) que en meses supera a un API genérico en las zonas de más
   tráfico. Ver la corrección (c) de la sección 0: esto solo es legal si los POIs no
   vienen de Google.

### El refinamiento que reduce los taps

No hace falta el comercio exacto: hace falta la **categoría (MCC)**. La mayoría de
beneficios de tarjeta se definen por MCC.

Algoritmo: traer N candidatos por distancia, calcular la recomendación para cada uno, y
**preguntar solo si los candidatos discrepan en la respuesta**. Si convergen, mostrar
directo. Cero taps en el caso común. En un food court con ocho locales, si seis comparten
MCC 5812, no hay nada que preguntar.

Refinamiento del refinamiento: cuando hay que preguntar, agrupar los candidatos por la
respuesta que producen, no por comercio. Si 6 de 8 dan la tarjeta A y 2 dan la B, la
pregunta es binaria, no de ocho opciones.

Excepción: promos merchant-específicas, que sí exigen precisión de local. Dos niveles de
exigencia, tratados distinto.

### Caso canónico de USA para el demo

Las categorías de "supermercado" de las tarjetas premium **excluyen superstores como
Walmart y Target**. Es la trampa más conocida entre usuarios de tarjetas en USA.

**Verificado el 18 de agosto de 2026, con texto oficial y fecha:**

Amex Gold, Membership Rewards Program T&C, "Last Updated: June 2026":
> "3 additional points (for a total of 4 points) on the first $25,000 of eligible
> purchases in a calendar year at U.S. supermarkets. **Superstores, convenience stores,
> warehouse clubs, and meal-kit delivery services are not considered supermarkets.**"

Amex Blue Cash Preferred, Card Member Agreement, "As of: 10/08/2025":
> "6 percent on the first $6,000 ... at supermarkets located in the U.S. **(superstores,
> convenience stores, warehouse clubs, and meal-kit delivery services are not considered
> supermarkets)**"

Amex, página pública de categorías, nombrando comercios:
> "Examples of merchants where you will NOT earn additional rewards include: ...
> **Superstores (e.g., Target, Walmart)** ... **Warehouse clubs (e.g., BJ's Club)**"

Chase, FAQ de categorías:
> "larger stores that sell a wide variety of goods and groceries, such as **warehouse
> clubs, discount stores**"

Y en department stores: *"Supercenters, discount stores ... are not included"*. Target
tampoco califica como department store. Doble exclusión.

El mecanismo, en palabras de Amex, que es la frase que justifica la existencia de Yapa:
> "Merchants are assigned codes based on what they primarily sell ... **A purchase with
> a merchant will not earn additional rewards if the merchant's code is not included in
> a reward category.**"

**Citi Custom Cash queda como no verificado.** Su página de términos se renderiza por JS
y no se pudo leer. No citarla.

### Segundo caso demo: 5541 contra 5542

Pagar en el surtidor da un MCC distinto que pagar adentro. Misma gasolinera, mismo
litro, distinta recompensa. Cita del Visa Merchant Data Standards Manual (abril 2026)
para MCC 5541 Service Stations: *"Excluded from this category code are Automated Fuel
Dispensers, MCC 5542"*.

Es más sutil que el caso Target y demuestra que el problema no se resuelve con "detectar
el comercio", porque el comercio es el mismo.

### MCC de referencia (Visa MDS Manual, abril 2026)

| MCC | Título oficial Visa |
|---|---|
| 5300 | Wholesale Clubs |
| 5310 | Discount Stores |
| 5311 | Department Stores |
| 5411 | Grocery Stores and Supermarkets |
| 5541 | Service Stations |
| 5542 | Automated Fuel Dispensers |
| 5812 | Eating Places and Restaurants |
| 5814 | Fast Food Restaurants |
| 5912 | Drug Stores and Pharmacies |

Regla de asignación, sección 1 del manual: *"The MCC is a four-digit number assigned to
describe a Merchant's **primary business** based on annual sales volume."* Ahí está el
porqué de todo: Walmart vende comida, pero su negocio primario no es comida.

Detalle útil para 5411: *"perishables must represent at least 45% of Merchant's total
monthly sales volume"*.

**Límite de honestidad:** ninguna red ni emisor publica el MCC por comercio. La única
herramienta pública es el Visa Supplier Locator. Que Walmart y Target sean 5310 y Costco
5300 es reporte de comunidad, no fuente oficial. El dato debe llevar procedencia.

---

## 3. Notificaciones push

### Envío (la parte fácil)

FCM para Android, APNs para iOS; FCM puede hacer proxy a APNs para manejar un solo SDK.
O OneSignal o Expo Push si se quiere saltar plomería. Un fin de semana.

Nota: Android 13+ requiere permiso runtime `POST_NOTIFICATIONS`. iOS requiere opt-in
explícito. Ninguna de las dos plataformas da push por defecto.

### Trigger (la parte difícil)

- **iOS: 20 geofences máximo por app.** Cita de Apple: *"An app can register up to 20
  regions at a time."*
- **Android: 100 geofences por app, por usuario del dispositivo.**
- Latencia en Android: menos de 2 minutos típico, 2 a 3 con Background Location Limits,
  hasta 6 si el dispositivo estuvo quieto.

No se puede geocercar una ciudad. La solución es gestión dinámica: cercas grandes tipo
"zona", y al entrar en una, re-registrar cercas finas para los locales de esa zona
liberando slots de zonas anteriores.

**Tensión con la postura de privacidad, descubierta al implementar:** en Android, el
geofencing exige `ACCESS_BACKGROUND_LOCATION`, y desde Android 11 pedirlo no muestra un
diálogo sino que abre la pantalla de Ajustes. O sea que "geocerca real" y "nunca
background location" son incompatibles en la misma app. Y en iOS, bajo reduced accuracy
el region monitoring directamente no funciona.

Alternativas más baratas en batería:

- iOS: `startMonitoringVisits` (Core Location detecta llegada y permanencia, hecho justo
  para esto, latencia de minutos)
- Android: Activity Recognition para detectar "venía caminando, se detuvo"

La Geofencing API de Android no tiene costo: es parte de Play Services, no de Maps
Platform.

### El punto que probablemente nadie ha planteado

**La mayor parte del valor de las push no necesita geolocalización.**

- "Tu crédito de streaming vence en 3 días"
- "Hoy tu tarjeta X da 3x en restaurantes"
- "Activa tu categoría rotativa del trimestre"

Eso es un cron contra el catálogo de promos: cero ubicación, cero batería, cero permisos
delicados.

Y el loop de mayor retención es el **post-transacción**: *"pagaste $80 en X con la
tarjeta A; con la B habrías ganado $4.80 más"*. Genera arrepentimiento, y el
arrepentimiento cambia comportamiento. Requiere feed de transacciones, no GPS.

**Los dos problemas son desacoplables, y uno entrega valor sin tocar el otro.**

---

## 4. Infraestructura comprable (no construir)

### Geolocalización: Radar

Ver la corrección (a) de la sección 0 antes de leer esto. Lo que sigue es lo que el
marketing promete; el precio real y las restricciones de plan están arriba.

- Geofences ilimitados (contra 20 en iOS y 100 en Android)
- Precisión hasta 5 metros
- Geofences poligonales y superpuestos
- Detección de visitas a POIs usando dataset propio, incluso en zonas densas
- `syncGeofences` descarga geofences cercanos al dispositivo para monitoreo local y
  menor latencia, o sea que la gestión dinámica ya viene resuelta

Precios publicados: 0,02 a 0,04 USD por usuario rastreado al mes según producto, y
places search bajo Premium Maps a 2,00 USD por cada 1.000 llamadas. Sin tier gratuito y
con contrato anual.

### Enriquecimiento de transacciones

- **Spade**: convierte strings crípticos ("SQ *COFFEE 8675309 BROOKLYN NY") en merchant
  real, lat/long, MCC, logo y merchant ID estable. Latencia sub-50ms (dentro de la
  ventana de autorización). Usado por Cash App, Stripe, Bilt, Mercury.
- **Plaid Enrich**: alternativa integrada al ecosistema Plaid.

Diferencia clave: los agregadores (Plaid, MX, Finicity) traen datos que el usuario no
tiene. Los enriquecedores (Spade, Ntropy, Heron) limpian datos que ya tienes. Son
complementarios, no competidores.

**Implicación estratégica, corregida.** El cuello de botella no se mueve al catálogo de
POIs, porque ese es gratis y abierto (Overture, Foursquare OS Places). Se mueve a
distribución y al catálogo de earn rates, que sigue siendo propio y sigue siendo el
activo riesgoso: nadie lo publica, cambia cuando el emisor quiere, y mantenerlo al día
es trabajo continuo.

### Costos a modelar

Supuesto: 5 toques por usuario al día, unas 150 llamadas por usuario al mes.

| Fuente | Precio por 1.000 | Cupo gratis mensual | Puede cachear nombre y categoría | Puede entrenar modelos |
|---|---|---|---|---|
| Google Nearby Search Pro | 32,00 USD | 5.000 | No | No |
| Foursquare Places API Pro | 15,00 USD | 500 | No | No concede obra derivada |
| Mapbox Search Box, Category Search | 1,00 USD (precio preview) | 50.000 | No revisado | No revisado |
| Radar Premium Maps, places search | 2,00 USD | Ninguno | No revisado | No revisado |
| Overture Maps places, self-host | 0,00 USD | Ilimitado | Sí | Sí |
| Foursquare OS Places, self-host | 0,00 USD | Ilimitado | Sí (Apache 2.0) | Sí |
| OpenStreetMap self-host | 0,00 USD | Ilimitado | Sí, con ODbL y atribución | Sí |
| Geofencing API de Android | 0,00 USD | 100 geofences por app por usuario | n/a | n/a |

Costo mensual con Google Nearby Search Pro, aplicando tramos de volumen:

| Usuarios | Llamadas al mes | Costo mensual | Por usuario |
|---|---|---|---|
| 1.000 | 150.000 | 4.320 USD | 4,32 USD |
| 10.000 | 1.500.000 | 27.680 USD | 2,77 USD |
| 100.000 | 15.000.000 | 85.280 USD | 0,85 USD |

Notas de precisión sobre estas cifras:

- El crédito mensual de 200 USD de Google fue reemplazado el 1 de marzo de 2025 por un
  cupo gratuito por SKU, sin pooling. Essentials 10.000, Pro 5.000, Enterprise 1.000.
- Nearby Search no tiene tier Essentials, y el campo `types` es Pro. No hay forma de
  abaratarlo recortando el field mask.
- El precio de Mapbox está marcado como "introductory preview pricing" en su propia web
  y la tarifa estándar posterior no está publicada.
- El precio de HERE no se pudo verificar en fuente oficial. No citarlo.
- La instancia pública de Overpass no es apta para producción. Su política de uso lista
  como problemático *"setting up an app for more than just OSM mappers and relying on the
  public instances as backend"*. Sirve para extracción puntual.
- OSM es ODbL, con share-alike si distribuyes una base derivada. Overture places no lo
  es (CDLA Permissive 2.0, Apache 2.0, CC0). Esa diferencia decide cuál usar en
  producción.

Ninguna de las fuentes revisadas, comercial o abierta, incluye MCC. Esa tabla de mapeo
se construye una sola vez contra ISO 18245.

---

## 5. Regulación de ubicación en USA (riesgo real)

Esto es probablemente lo que menos mapeado tiene el equipo.

- **19 estados** tratan la geolocalización precisa como dato sensible que requiere
  consentimiento afirmativo.
- **Maryland**: prohíbe de plano la venta de datos sensibles, no hay checkbox de
  consentimiento que la haga legal. Define "geolocalización precisa" como lo que
  identifica al consumidor o dispositivo dentro de un radio de **1.750 pies** (unos
  533 metros).
- **Virginia** (SB338, vigente 1 de julio de 2026): prohíbe vender geolocalización
  precisa.
- **Oregon**: igual.
- **Connecticut** (Public Act 26-64): igual, vigente 1 de octubre de 2026.
- Ojo con la definición de "venta": Virginia solo cuenta dinero; Maryland y Oregon
  cuentan cualquier contraprestación de valor, lo que barre intercambios de datos y
  acuerdos de SDK "gratis".

### Enforcement

- **FTC v. Kochava** (cerrado mayo 2026): prohibido vender o transferir datos de
  ubicación sensible sin consentimiento afirmativo expreso, y solo para el servicio que
  el consumidor pidió.
- **FTC v. X-Mode/Outlogic** (2024): apuntó a brokers que recolectaban ubicación precisa
  vía SDKs embebidos en apps normales. Precedente directamente aplicable.

### La trampa de precisión en el dato de entrenamiento

El dataset propio se describe como la tupla (geohash, hora, comercio confirmado). La
pregunta que hay que hacerse es a qué precisión de geohash.

| Nivel | Celda aprox. | Cae bajo la definición de Maryland (533 m)? |
|---|---|---|
| 5 | 4,9 x 4,9 km | No |
| 6 | 1,2 km x 0,61 km | No (610 m contra 533 m, por poco) |
| 7 | 153 x 153 m | Sí |

**La precisión que hace útil al prior es exactamente la que dispara las reglas de dato
sensible.** Guardar geohash-6 queda del lado correcto de la definición. Reverificar la
tabla de celdas antes de citarla.

### Traducción para Yapa

La arquitectura de "recolectar ubicación en background y monetizar el dataset" está
legalmente muerta en USA. El widget on-demand más no persistir coordenadas es la
arquitectura más defendible que existe, y además es argumento de marketing frente a
competidores que sí piden background.

Y sumale el dato de Android 17: no es solo la más defendible, es la que la política de
Play va a exigir para apps de acceso puntual a ubicación.

Corolario sobre SDKs de terceros: integrar cualquier SDK de ubicación significa enviar
ubicación precisa afuera. Maryland y Oregon cuentan cualquier contraprestación de valor
como venta, lo que barre los acuerdos de SDK gratuitos. Por eso el detector de comercios
debe vivir detrás de una interfaz: esa función es la línea donde la ubicación abandona el
teléfono, y conviene que sea una sola, auditable y reemplazable.

---

## 6. Modelo de negocio de la categoría

Kudos monetiza con:

1. **Comisión de afiliado cuando el usuario completa una solicitud de tarjeta**
2. Comisión de merchants en el cashback (que comparte con el usuario)

O sea: **la plata está en las tarjetas que NO tienes.** La optimización de las que ya
tienes es el gancho de retención; el revenue es la originación.

Esto interactúa con la sección 4. Si el revenue son eventos raros por usuario
(originación), un costo de 2 a 4 USD por usuario al mes en llamadas a un API de POIs es
probablemente más de lo que el usuario promedio va a generar nunca. La elección de fuente
de datos no es una decisión de infraestructura, es una decisión de unit economics.

### La pregunta abierta para el fundador

En compras presenciales no hay click de afiliado ni tracking de merchant. Entonces, el
offline monetiza vía originación de tarjetas, vía card-linked offers, o vía suscripción.

Eso define el trigger correcto:

- **originación**: push proactivo ("esta tarjeta te habría dado más, aplícala")
- **suscripción**: recomendación en el momento

No llevar la respuesta. Llevar la pregunta bien formulada.

---

## 7. Notas para la entrevista

- Presentar el widget como decisión deliberada de alcance, no como workaround.
- Llevar una página de restricciones con números exactos: 20 geofences en iOS, 100 en
  Android, 1 a 20 km en modo aproximado de iOS, 3 kilómetros cuadrados en modo
  aproximado de Android, 1.750 pies en Maryland, revisión de Play para background
  location, 32 USD por 1.000 llamadas de Google Nearby Search Pro.
- Las tres correcciones de la sección 0 son el material más fuerte. Salieron de leer
  contratos y páginas de precios, no páginas de producto. Ese es el punto.
- "Esto no lo construyo, lo compro" (Radar) vale más que una implementación propia a
  medias, pero solo si sabés cuánto cuesta y qué te prohíbe el contrato.
- No llegar con "lo resolví". Llegar con "hay tres caminos, elegiría este por estas
  razones, y esto es lo que todavía no sé". Un fundador en etapa temprana evalúa si puede
  pensar contigo.
- Dejar espacio para que te contradiga y moverte cuando lo haga.
- No sobreconstruir antes de tener el trabajo. Un demo pequeño es sano; un producto
  completo gratis es otra conversación.
