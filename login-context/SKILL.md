---
name: login-context
description: Disenar, implementar, auditar o reforzar modulos de autenticacion basados en sesiones o tokens. Usar al trabajar con registro, login, logout, persistencia de identidad, cookies, CSRF, credenciales, roles, respuestas AJAX/HTML, recuperacion de cuenta o integraciones posteriores al login en cualquier lenguaje o framework.
---

# Login Context

Disenar la autenticacion como un limite de seguridad independiente del framework. Elegir una unica fuente de verdad para la identidad, mantener los efectos secundarios fuera del resultado de autenticacion y verificar cada garantia con pruebas negativas.

## Relevar El Sistema

1. Localizar rutas, controladores, servicios, modelos, middlewares, formularios, scripts cliente, configuracion, migraciones y almacenamiento de sesiones.
2. Dibujar los flujos de registro, login, acceso protegido y logout desde la entrada HTTP hasta la persistencia y la respuesta.
3. Identificar la autoridad real: sesion de servidor, token firmado o proveedor externo. Evitar mantener dos mecanismos que puedan contradecirse.
4. Enumerar datos confiables y no confiables. Tratar cuerpo, query, headers, cookies y almacenamiento del navegador como entrada controlada por el cliente.
5. Separar autenticacion, autorizacion y tareas posteriores al login. No permitir que una integracion opcional cambie si las credenciales fueron validas.

## Definir Invariantes

Exigir como minimo:

- No almacenar ni registrar contrasenas en texto plano.
- No aceptar roles, permisos, identificadores internos ni estado de verificacion desde un registro publico.
- No revelar si fallo el usuario o la contrasena durante el login.
- Regenerar el identificador de sesion despues de autenticar.
- Guardar en sesion solo identidad y autorizacion minimas.
- Proteger con CSRF toda mutacion autenticada mediante cookies.
- Aplicar limites de intentos a login, registro y recuperacion.
- Usar secretos aleatorios desde variables de entorno o un gestor de secretos.
- Enviar cookies con `HttpOnly`, `Secure` en HTTPS, `SameSite` apropiado, alcance minimo y expiracion definida.
- Invalidar la sesion en servidor al cerrar sesion.
- Responder una sola vez por peticion.

## Implementar Registro

1. Validar CSRF cuando el navegador use cookies.
2. Validar tipos, longitudes y formato mediante un esquema de lista permitida.
3. Normalizar el identificador de login, por ejemplo recortar y convertir el email a minusculas.
4. Eliminar campos desconocidos y asignar roles exclusivamente en servidor.
5. Aplicar una politica de contrasena que admita frases largas y respete el limite en bytes del algoritmo elegido.
6. Comprobar duplicados para experiencia de usuario y respaldar la comprobacion con una restriccion unica en la base.
7. Derivar la contrasena con Argon2id, scrypt o bcrypt y un costo configurable. Guardar solamente el hash.
8. Crear el usuario con consulta parametrizada y traducir errores internos a mensajes publicos seguros.
9. Si el producto inicia sesion al registrar, regenerar la sesion antes de guardar la identidad.
10. Devolver JSON o redirigir segun el contrato HTTP definido.

No reutilizar el endpoint de registro publico para crear administradores. Crear un flujo administrativo separado, autenticado y autorizado.

## Implementar Login

Aplicar la siguiente secuencia:

```text
limitar intentos
-> validar CSRF
-> validar y normalizar credenciales
-> buscar la cuenta por un campo fijo y parametrizado
-> comparar contra el hash real o un hash ficticio si no existe
-> emitir un unico error generico si falla
-> regenerar la sesion
-> guardar identidad minima
-> persistir la sesion
-> ejecutar integraciones opcionales de forma aislada
-> responder JSON o redirigir
```

Comparar contra un hash ficticio cuando la cuenta no exista para reducir diferencias temporales que permitan enumerar usuarios. No incluir hash, datos sensibles ni el objeto completo del usuario en la respuesta.

## Gestionar Sesiones

Para sesiones de servidor:

- Guardar los datos en una base o cache compartida; no usar memoria local en produccion.
- Firmar la cookie de identificador con un secreto de al menos 32 bytes.
- Configurar vencimiento coherente entre cookie y almacenamiento.
- Regenerar al autenticar y destruir al cerrar sesion.
- Considerar expiracion absoluta, expiracion por inactividad y revocacion de todas las sesiones.
- Confiar en encabezados de proxy solo cuando la infraestructura los controle.

Para tokens:

- Usarlos como autoridad solo si la arquitectura es realmente stateless.
- Validar firma, algoritmo, emisor, audiencia, expiracion y revocacion cuando corresponda.
- Evitar emitir un token que ninguna ruta verifica.
- No mezclar token y sesion como autoridades paralelas sin una politica explicita.

## Responder A AJAX Y HTML

Detectar JSON solamente mediante una senal explicita, como `X-Requested-With: XMLHttpRequest` o `Accept: application/json`.

Para AJAX:

- Responder siempre JSON con estructura estable: datos, mensaje, estado y destino permitido.
- No devolver HTML inesperado a un cliente que intentara parsear JSON.
- Usar codigos HTTP correctos.

Para formularios HTML:

- Aceptar el CSRF tambien desde un campo oculto.
- Aplicar Post/Redirect/Get con `303 See Other`.
- Redirigir solo a rutas fijas o destinos validados contra una lista permitida.
- Guardar mensajes de una sola lectura en sesion y escaparlos al renderizar.

Para mejora progresiva en el navegador:

- Interceptar el submit y marcar la peticion AJAX explicitamente.
- Si falla la red o la respuesta no cumple el contrato, ejecutar el submit nativo del mismo formulario.
- Mantener en el HTML todos los campos imprescindibles para autenticar.
- Reservar datos del navegador, como un carrito local, para la ruta AJAX opcional.

## Aislar Integraciones Posteriores

Ejecutar migracion de carrito, auditoria, analitica o preferencias despues de persistir la sesion. Encapsular cada integracion y devolver una advertencia si falla. No convertir un login valido en fallo por una tarea secundaria y no permitir que esa tarea envie una segunda respuesta HTTP.

Usar colas o eventos para tareas no necesarias antes de responder. Mantener sincrono solo aquello que el cliente necesita inmediatamente.

## Autorizar Y Cerrar Sesion

En cada ruta protegida:

1. Comprobar identidad autenticada.
2. Comprobar permisos o rol por separado.
3. Responder `401` si falta autenticacion y `403` si faltan permisos.
4. Devolver JSON a clientes AJAX y redirigir clientes HTML a destinos fijos.

En logout, validar CSRF, destruir la sesion del lado del servidor y limpiar la cookie con el mismo nombre, ruta y atributos. Hacer que el resultado sea seguro aun si la sesion ya expiro.

## Gestionar Secretos Y Configuracion

Mantener fuera del repositorio:

- secretos de sesion y firma;
- credenciales de base de datos;
- claves de correo, MFA y proveedores externos.

Versionar un archivo de ejemplo sin valores reales. Validar al iniciar que las variables requeridas existan y que los secretos tengan entropia suficiente. Fallar al arrancar ante configuracion insegura en vez de degradar silenciosamente.

## Verificar

Probar al menos:

- registro valido, duplicado, campos desconocidos e intento de asignar rol;
- login valido, usuario inexistente, contrasena incorrecta y datos malformados;
- regeneracion de sesion y ausencia del hash en sesion/respuesta;
- cookies en desarrollo y produccion;
- CSRF ausente, incorrecto y valido en login, registro y logout;
- limite de intentos y encabezado `Retry-After`;
- respuesta JSON AJAX y redireccion HTML para exito y error;
- fallback del formulario cuando falla JavaScript o la red;
- acceso anonimo, usuario sin permisos y usuario autorizado;
- fallo de una integracion posterior sin invalidar el login;
- destruccion de sesion y rechazo de la cookie anterior.

Revisar ademas logs, mensajes y trazas para confirmar que no exponen contrasenas, hashes, tokens, secretos ni consultas internas.

## Entregar El Modulo

1. Resumir la autoridad de autenticacion elegida y donde se almacena.
2. Enumerar variables de entorno requeridas sin mostrar sus valores.
3. Describir contratos JSON y destinos HTML.
4. Documentar integraciones opcionales por separado.
5. Informar pruebas ejecutadas y riesgos residuales, especialmente limites en memoria, falta de MFA, verificacion de email o revocacion global.
