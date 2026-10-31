// Generado desde backend/openapi.yaml con `npm run api:sync`. No se edita a mano.

export interface paths {
    "/api/veedor/usuarios/{id}/invitacion/reenvio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reenviar la invitación a una cuenta que aún no la aceptó
         * @description Requiere GESTIONAR_USUARIOS. El enlace anterior deja de servir y se reinicia su vigencia de 7 días.
         */
        post: operations["reenviarInvitacion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/usuarios/invitaciones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Invitar a una persona con un rol ya decidido
         * @description Crea la cuenta en INVITADA y le envia un enlace para que fije su clave. Al
         *     aceptarlo queda ACTIVA sin necesitar otra aprobacion.
         */
        post: operations["invitar"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/sesion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Iniciar sesion en el panel del veedor
         * @description Devuelve un token JWT valido por 8 horas (RNF011) junto con el rol y los permisos
         *     ya resueltos. Si la cuenta tiene segundo factor y no se envio `codigoTotp`, la
         *     respuesta es 401 con type `segundo-factor-requerido`: hay que reintentar con el
         *     codigo, no es un error de credencial.
         */
        post: operations["iniciarSesion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/sesion/cierre": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cerrar sesion
         * @description Revoca en el servidor todas las sesiones vivas de la cuenta, no solo la de este
         *     navegador. Un token copiado antes del cierre deja de servir en el acto.
         */
        post: operations["cerrar"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/segundo-factor/confirmacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirmar el alta con un codigo de la app
         * @description Devuelve una sesion nueva de alcance COMPLETO. Es lo que permite que un ADMIN
         *     recien sembrado pase de su sesion restringida al panel sin volver a escribir la
         *     clave que acaba de escribir.
         */
        post: operations["confirmar"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/segundo-factor/baja": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Desactivar el segundo factor de la propia cuenta
         * @description Exige un codigo valido: si bastara con la sesion, un token robado podria quitar
         *     de en medio justamente la defensa que impide usarlo. Un ADMIN no puede
         *     desactivarlo, su rol lo exige.
         */
        post: operations["desactivar"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/segundo-factor/alta": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Empezar el alta: genera el secreto y devuelve el QR
         * @description El secreto queda guardado sin confirmar y todavia no se exige al entrar. Solo
         *     empieza a hacerlo tras confirmar un codigo valido. El secreto se muestra una
         *     sola vez: no hay endpoint para volver a leerlo.
         */
        post: operations["iniciar"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/cuenta/clave": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cambiar la propia clave
         * @description Exige la clave actual y comparte el contador de intentos fallidos con el inicio de sesión
         *     (5 fallos en 15 minutos bloquean la cuenta 15 minutos). Al cambiarla se cierran **todas** las
         *     sesiones, la actual incluida: el cliente debe volver a pedir `POST /api/veedor/sesion` con la
         *     clave nueva. Se avisa por correo del cambio.
         */
        post: operations["cambiarClave"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/cortes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar los cortes que afectan a un sector */
        get: operations["listarPorSector"];
        put?: never;
        /**
         * Registrar un corte oficial
         * @description Sectores afectados, inicio, fin prometido y causa (RF016). Origen VEEDOR.
         */
        post: operations["registrar"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/vecino/verificacion-barrio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Verificar el barrio con la ubicacion del momento
         * @description Compara la coordenada con el poligono del barrio que declaraste. Si cae dentro, el
         *     barrio queda verificado con su fecha; la coordenada se descarta y no se guarda.
         *     Maximo 3 intentos por dia (429 con `Retry-After`). Si ya estaba verificado, no hace
         *     nada y devuelve el perfil. Es una senal blanda: sube el costo de votar desde un
         *     barrio ajeno, no prueba identidad.
         */
        post: operations["verificarBarrio"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/vecino/sesion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Iniciar sesion como vecino
         * @description Devuelve un token JWT valido por 8 horas que sirve en `/api/vecino/**` (y, del panel, solo en `GET /api/veedor/yo` y `POST /api/veedor/sesion/cierre`). Una
         *     cuenta del panel no entra por aqui, ni una de vecino por `/api/veedor/sesion`:
         *     en los dos casos la respuesta es la misma 401 que ante una clave incorrecta.
         */
        post: operations["iniciarSesion_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/vecino/sesion/cierre": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cerrar sesion
         * @description Revoca en el servidor todas las sesiones vivas de la cuenta, no solo la de este navegador.
         */
        post: operations["cerrar_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/suscripciones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Suscribirse a los avisos de uno o más sectores
         * @description Crea la suscripción en PENDIENTE_CONFIRMACION y envía un correo de doble
         *     opt-in (Ley 1581/2012, RF013). No empieza a recibir avisos hasta confirmarla.
         */
        post: operations["suscribirse"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/suscripciones/confirmar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Pantalla del enlace «Confirmar» del correo
         * @description Página a la que lleva el enlace del correo. Solo muestra un botón: NO confirma nada, porque un
         *     antivirus o una vista previa de enlaces abre los GET sin que nadie los pida (`ADR-054`). La
         *     acción ocurre al enviar el formulario, que hace POST a la misma ruta.
         */
        get: operations["pantallaConfirmar"];
        put?: never;
        /**
         * Confirmar la suscripción (doble opt-in)
         * @description Acción del botón de la página de confirmación (o de un cliente de API). El token es de un solo enlace, no de un solo uso:
         *     confirmarla dos veces no falla (RF013). Responde JSON o una página HTML de cortesía
         *     según el `Accept` de quien pide: el formulario de la página responde HTML y un cliente de API
         *     responde JSON. `token` va como parámetro de consulta o del formulario.
         */
        post: operations["confirmar_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/suscripciones/cancelar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Pantalla del enlace de baja de todo correo (RF015)
         * @description Página a la que lleva el enlace del correo. Solo muestra un botón: NO cancela nada, porque un
         *     antivirus o una vista previa de enlaces abre los GET sin que nadie los pida (`ADR-054`). La
         *     acción ocurre al enviar el formulario, que hace POST a la misma ruta.
         */
        get: operations["pantallaCancelar"];
        put?: never;
        /**
         * Darse de baja en un clic (RF015)
         * @description Acción del botón de la página de baja (o de un cliente de API). Sin pedir credenciales: el token que llega en cada correo es suficiente. Responde
         *     JSON o una página HTML de cortesía según el `Accept` de quien pide (mismo motivo
         *     que en {@code /confirmar}).
         */
        post: operations["cancelar"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sectores/{sectorId}/restablecimiento": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirmar con un toque que volvió el agua
         * @description El `token` es el del enlace del correo de aviso. Sin sesion ni `X-Dispositivo`: lo que identifica a
         *     quien toca es el token, que firma el servidor, vence y es de un barrio y una suscripcion. Registra un
         *     reporte `SERVICIO_RESTABLECIDO` en ese barrio, con el mismo cupo y el mismo quorum de cualquier otro
         *     reporte: un toque no cambia el estado por si solo.
         */
        post: operations["confirmarRestablecimiento"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/reportes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Registrar un reporte ciudadano
         * @description Sin registro ni cuenta (RF005), pero con identidad: la cabecera `X-Dispositivo` (token de
         *     `POST /api/dispositivos`) o la sesion de un vecino. Sin ninguna de las dos responde 401
         *     `dispositivo-invalido`. Limita automaticamente los reportes por identidad en la ventana vigente
         *     (RF006, 3 para un dispositivo y 5 para un vecino) — ver 429. Hace falta el `sectorId`, la
         *     `coordenada` o ambos (RF007): con solo la coordenada el servidor infiere el sector que la
         *     contiene y responde 400 si cae fuera de todo barrio de Cartagena. La coordenada se envia solo si
         *     el usuario autorizo compartir su ubicacion; con su `precisionMetros` el servidor verifica el
         *     reporte (campo `verificacion` de la respuesta) y guarda solo una aproximacion de ella. La respuesta trae
         *     `subidaToken`, el permiso de un solo uso para subir la foto de este reporte.
         */
        post: operations["registrar_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/reportes/{id}/foto": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Agregar evidencia a un reporte
         * @description Sube la foto de un reporte (M10). Exige la cabecera `X-Subida` con el `subidaToken` que recibio
         *     quien creo el reporte: sirve una sola vez y vence a los pocos minutos. Solo JPEG y PNG (se
         *     comprueba la firma del archivo, no solo el tipo declarado). La foto queda en revision: el publico
         *     la ve cuando el veedor aprueba el reporte, y nunca cuenta como voto.
         */
        post: operations["agregarEvidencia"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/reportes/{id}/confirmar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirmar un reporte
         * @description Permite a otro vecino confirmar un reporte ciudadano (M11). Sin cuerpo: la identidad de quien
         *     confirma viaja en `X-Dispositivo` o en la sesion de un vecino, igual que al reportar.
         */
        post: operations["confirmar_2"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/iot/presion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Registrar una lectura de presión de un sensor
         * @description Una presión por debajo del umbral (15 psi por defecto) se registra como reporte de
         *     PRESION_BAJA con el cupo de sensor. Una lectura normal responde 200 sin registrar
         *     nada. Sin cuerpo de respuesta en el caso exitoso.
         */
        post: operations["reportarPresion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/dispositivos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Pedir una identidad de dispositivo
         * @description Crea un dispositivo nuevo y devuelve su token firmado. Pidelo la primera vez, guardalo y
         *     enviarlo en `X-Dispositivo` en cada reporte y confirmacion. Cada llamada crea una
         *     identidad distinta: no la pidas en cada reporte. Si un reporte responde 401
         *     `dispositivo-invalido`, pide otro. Maximo 10 por hora por IP.
         */
        post: operations["pedir"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cuentas/verificacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirmar el correo con el token del enlace
         * @description Pasa la cuenta a PENDIENTE_APROBACION. Sigue sin poder entrar hasta que un ADMIN la apruebe.
         */
        post: operations["verificarCorreo"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cuentas/verificacion/reenvio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reenviar el correo de verificación
         * @description Para quien se registró y no recibió el enlace (o venció). Responde 202 **siempre**, exista o no
         *     la cuenta y ya esté verificada o no: no revela qué correos están registrados. Reenvía como mucho
         *     una vez cada 2 minutos por cuenta. El enlace anterior deja de servir.
         */
        post: operations["reenviarVerificacion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cuentas/vecino": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Registrarse como vecino
         * @description Crea la cuenta sin clave y envia al correo el enlace para elegirla. Al elegirla la
         *     cuenta queda ACTIVA, sin aprobacion de un administrador. La clave no viaja aqui: asi
         *     nadie puede registrar el correo de otra persona con una clave suya.
         *     Exige el barrio y aceptar el aviso de privacidad; la casilla de avisos es aparte.
         *     Responde 202 aunque el correo ya tenga cuenta, para no revelar que direcciones
         *     estan registradas.
         */
        post: operations["registrarse"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cuentas/restablecimiento": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Pedir el enlace para restablecer la clave
         * @description Responde 202 siempre, exista o no la cuenta. Ver el javadoc de esta clase.
         */
        post: operations["pedirRestablecimiento"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cuentas/registro": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Solicitar una cuenta del panel
         * @description Crea la cuenta en PENDIENTE_VERIFICACION y envia el enlace de confirmacion.
         *     Registrarse no concede ningun permiso: hace falta verificar el correo y que un
         *     ADMIN apruebe. Responde 202 aunque el correo ya tenga cuenta, para no revelar
         *     que direcciones estan registradas.
         */
        post: operations["registrarse_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cuentas/invitacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Aceptar una invitacion fijando la clave
         * @description Deja la cuenta ACTIVA con el rol que eligio quien invito. No hace falta otra aprobacion.
         */
        post: operations["aceptar"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cuentas/enlaces/verificar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Pantalla del enlace «Confirmar mi correo»
         * @description Muestra el botón de confirmación. No consume el token: eso ocurre al enviar el formulario.
         */
        get: operations["pantallaVerificar"];
        put?: never;
        /**
         * Confirmar el correo desde el formulario de la pantalla
         * @description Mismo efecto que POST /api/cuentas/verificacion, pero recibe el formulario y responde HTML.
         */
        post: operations["verificarCorreo_1"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cuentas/enlaces/restablecer": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Pantalla del enlace para restablecer la clave
         * @description Muestra el formulario para elegir la clave nueva. No consume el token.
         */
        get: operations["pantallaRestablecer"];
        put?: never;
        /**
         * Restablecer la clave desde el formulario de la pantalla
         * @description Mismo efecto que POST /api/cuentas/clave, pero recibe el formulario y responde HTML.
         */
        post: operations["restablecerClave"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cuentas/enlaces/invitacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Pantalla del enlace de invitación
         * @description Muestra el formulario para elegir la clave. No consume el token.
         */
        get: operations["pantallaInvitacion"];
        put?: never;
        /**
         * Aceptar la invitación desde el formulario de la pantalla
         * @description Mismo efecto que POST /api/cuentas/invitacion, pero recibe el formulario y responde HTML.
         */
        post: operations["aceptarInvitacion"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cuentas/clave": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Fijar la clave nueva con el token del enlace
         * @description Cambia la clave y revoca todas las sesiones abiertas de esa cuenta.
         */
        post: operations["fijarClave"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/usuarios/{id}/suspension": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Suspender una cuenta activa
         * @description Revoca sus sesiones al instante: no espera a que caduque su token.
         */
        patch: operations["suspender"];
        trace?: never;
    };
    "/api/veedor/usuarios/{id}/rechazo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Denegar una solicitud de acceso */
        patch: operations["rechazar"];
        trace?: never;
    };
    "/api/veedor/usuarios/{id}/reactivacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Devolver el acceso a una cuenta suspendida */
        patch: operations["reactivar"];
        trace?: never;
    };
    "/api/veedor/usuarios/{id}/permisos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Cambiar rol y ajustes de permisos de una cuenta
         * @description Revoca las sesiones vivas de esa persona, tanto si los permisos se amplian como
         *     si se recortan: el token los lleva dentro y una sesion abierta seguiria usando
         *     los anteriores.
         */
        patch: operations["cambiarPermisos"];
        trace?: never;
    };
    "/api/veedor/usuarios/{id}/aprobacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Aprobar una cuenta que ya verifico su correo, asignandole permisos */
        patch: operations["aprobar"];
        trace?: never;
    };
    "/api/veedor/reportes/{id}/foto/descartar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Descartar solo la foto de un reporte
         * @description El reporte sigue como esta (su voto no cambia); la foto deja de servirse al publico y el panel la
         *     sigue viendo como evidencia.
         */
        patch: operations["descartarFoto"];
        trace?: never;
    };
    "/api/veedor/reportes/{id}/descartar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Descartar un reporte */
        patch: operations["descartar"];
        trace?: never;
    };
    "/api/veedor/reportes/{id}/aprobar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Aprobar un reporte */
        patch: operations["aprobar_1"];
        trace?: never;
    };
    "/api/veedor/ingesta/propuestas/{id}/descartar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Descartar una propuesta
         * @description No toca el sector. La propuesta se archiva como descartada, no se borra. Descartar una ya aprobada responde 409.
         */
        patch: operations["descartar_1"];
        trace?: never;
    };
    "/api/veedor/ingesta/propuestas/{id}/aprobar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Aprobar una propuesta
         * @description Aplica el estado propuesto al sector y anexa el evento a la bitácora pública
         *     (RF026). Es el único camino por el que la ingesta llega al mapa.
         */
        patch: operations["aprobar_2"];
        trace?: never;
    };
    "/api/veedor/ingesta/propuestas/{id}/anulacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Anular una propuesta ya aprobada
         * @description Deshace una aprobación por error: la propuesta queda ANULADA con su motivo, deja de afirmar nada
         *     del presente, la bitácora anexa una corrección que cita el boletín y el barrio se recalcula.
         *     Queda constancia en la auditoría.
         */
        patch: operations["anularPropuesta"];
        trace?: never;
    };
    "/api/veedor/cortes/{id}/sectores/{sectorId}/confirmacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Confirmar —o corregir la hora de— un cierre provisional
         * @description Un cierre que solo sostenían los vecinos o los sensores pasa a definitivo con la hora que fije el veedor.
         */
        patch: operations["confirmarCierre"];
        trace?: never;
    };
    "/api/veedor/cortes/{id}/sectores/{sectorId}/cierre": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Cerrar un solo barrio del corte
         * @description Los barrios de un corte se restablecen a horas distintas. El corte pasa a RESTABLECIDO cuando todos sus barrios tienen cierre.
         */
        patch: operations["cerrarSector"];
        trace?: never;
    };
    "/api/veedor/cortes/{id}/cierre": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Cerrar un corte con la hora real de restablecimiento (RF017) */
        patch: operations["cerrar_2"];
        trace?: never;
    };
    "/api/veedor/cortes/{id}/anulacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Anular un corte publicado por error
         * @description Queda como historia con su motivo, fuera del Índice y de las estadísticas; los barrios se recalculan y la bitácora anexa la corrección (no se edita lo ya publicado).
         */
        patch: operations["anularCorte"];
        trace?: never;
    };
    "/api/vecino/perfil": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Actualizar el perfil
         * @description Cambia nombre, barrio y la casilla de avisos; solo se aplica lo que viene. Cambiar
         *     de barrio anula la verificacion de barrio anterior.
         */
        patch: operations["actualizarPerfil"];
        trace?: never;
    };
    "/api/veedor/yo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Datos de la cuenta que tiene la sesion
         * @description Lo usa el frontend al recargar para saber que puede pintar sin volver a pedir la
         *     clave. Devuelve el estado vigente en la base de datos, no lo que dice el token.
         */
        get: operations["yo"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/usuarios": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar cuentas, mas recientes primero
         * @description Paginado, con el total y el enlace a la siguiente pagina en `X-Total-Count` y
         *     `Link`. `estado` filtra por PENDIENTE_APROBACION para ver solo la cola de altas y
         *     `barrioId` (slug de un sector) por el barrio donde viven las personas.
         */
        get: operations["listar"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/sistema/metricas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Contadores de calibración del sistema
         * @description Cambios de estado, disputas, quórums rechazados por composición, reportes por nivel de verificación, fallos de colectores y
         *     el tiempo entre el primer reporte y el cambio de estado. Son de este proceso desde `desde`: un reinicio los pone a cero. Sirven
         *     para calibrar los umbrales y los plazos, que son valores iniciales sin datos reales que los respalden.
         */
        get: operations["consultarMetricasDelSistema"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/reportes/pendientes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar los reportes pendientes de moderación, más antiguos primero
         * @description Paginado, con el total y el enlace a la siguiente página en las cabeceras
         *     `X-Total-Count` y `Link`. Por defecto 50; el máximo por página es 200. Cada reporte trae `senalRed`:
         *     verdadero si viene de una red que ya envió una ráfaga de reportes a ese barrio (D9).
         */
        get: operations["listarPendientes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/ingesta/salud": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Salud de cada colector: última ejecución exitosa, ítems y tasa de error
         * @description Lista vacía mientras el pipeline no haya corrido un ciclo. La telemetría vive en
         *     memoria del proceso, así que un reinicio la reinicia.
         */
        get: operations["salud"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/ingesta/propuestas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar las propuestas pendientes de revisión, más recientes primero
         * @description Paginado, con el total y el enlace a la siguiente página en las cabeceras
         *     `X-Total-Count` y `Link`. Por defecto 50; el máximo por página es 200.
         */
        get: operations["listarPendientes_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/ingesta/fallidos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar los documentos que siguen fallando al procesarse, más recientes primero
         * @description Un documento sale de esta lista en cuanto se procesa con éxito: es lo que sigue
         *     roto *ahora*, no un histórico. Máximo 200 filas.
         */
        get: operations["fallidos"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/fotos/{nombre}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Ver la foto de cualquier reporte (panel)
         * @description Para moderar: el panel ve la foto en cualquier estado, aprobada o no.
         */
        get: operations["fotoDelPanel"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/disputas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar los barrios en disputa, los más contradichos primero
         * @description Cada barrio trae `reportesEnContra`: cuántos vecinos sostienen que el estado oficial no es el real.
         */
        get: operations["listarDisputas"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/cortes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Consultar un corte por su identificador */
        get: operations["consultar"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/cortes/vencidos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Cola de cortes vencidos
         * @description Los cortes cuya promesa ya pasó sin cierre y los que tienen un cierre provisional que nadie ha confirmado, del más antiguo al más reciente.
         */
        get: operations["listarCortesVencidos"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/auditoria": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Bitacora de auditoria de cuentas, mas recientes primero
         * @description Solo anexado: no hay forma de editar ni borrar un asiento desde la API.
         */
        get: operations["auditoria"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/veedor/analitica/copia": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Últimas copias de MongoDB a la base analítica
         * @description Cuándo corrió cada copia, cuánto copió y si los conteos de las dos bases cuadraron. Es donde se ve el estado de la copia: `/actuator/health` no la incluye a propósito.
         */
        get: operations["ultimasCopiasAnaliticas"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/vecino/yo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Perfil del vecino con la sesion
         * @description Devuelve el estado vigente en la base de datos, no lo que dice el token.
         */
        get: operations["yo_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/requests.json": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar los sectores con el servicio afectado, en formato Open311
         * @description Un `service_request` por sector que no está en CON_SERVICIO. Los sectores sin
         *     estado verificado no aparecen: publicar "sin novedad" sin haberlo comprobado es
         *     el falso positivo que ADR-014 evita.
         */
        get: operations["getRequests"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sistema/modo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Modo del sistema
         * @description `modo` es REAL o SIMULACION: la interfaz muestra un banner permanente en la simulacion, que nunca se
         *     presenta como real. `cuentasSinteticas` es cuantas cuentas de vecino las creo el sistema para probar el
         *     volumen: se dicen tal cual, no son adopcion. Se recuerda un minuto.
         */
        get: operations["modo"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sectores": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar los sectores con su estado conocido
         * @description Devuelve los sectores de Cartagena (211 barrios sembrados desde el GeoJSON
         *     oficial). `estado` viaja nulo mientras no haya dato verificado del sector —
         *     el cliente debe mostrarlo como "sin datos" y no suponer que hay servicio.
         */
        get: operations["listarSectores"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sectores/{sectorId}/cortes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Histórico de cortes de un sector, del más reciente al más antiguo
         * @description Cortes oficiales que afectaron al sector, abiertos y cerrados. Paginado con las mismas
         *     cabeceras que la bitácora (`X-Total-Count`, `X-Total-Pages`, `X-Page`, `X-Page-Size`, `Link`);
         *     por defecto 50, máximo 200. Un sector sin cortes devuelve una lista vacía, no un 404.
         */
        get: operations["listar_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sectores/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Consultar un sector por su identificador */
        get: operations["consultarSector"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sectores/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Avisos en vivo de cambios de estado (SSE)
         * @description Conexión abierta (`text/event-stream`) que AVISA de que algo cambió; no envía el
         *     estado. Cada evento `sectores` trae `{"actualizadoEn": "..."}` y el cliente pide
         *     entonces GET /api/sectores, que está cacheado. Un comentario `:latido` llega cada
         *     25 s y `retry:` indica cuánto esperar antes de reconectar. El servidor agrupa los
         *     cambios en un aviso por segundo como máximo y cierra la conexión cada ~10-12
         *     minutos por diseño. Por encima del tope de conexiones responde 429 con `Retry-After`.
         */
        get: operations["streamSectores"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sectores/geometria": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Polígonos de todos los sectores (GeoJSON)
         * @description FeatureCollection con un Feature por sector; `id` es el mismo que devuelve
         *     GET /api/sectores. Los polígonos solo cambian al volver a sembrar, por eso la
         *     respuesta se puede cachear un día.
         */
        get: operations["geometria"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/fotos/{nombre}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Ver la foto de un reporte aprobado
         * @description Sin sesion. Responde 404 si la foto no existe, si su reporte aun no esta aprobado o si el veedor la
         *     descarto: son el mismo 404 a proposito, para que nadie pueda sondear que fotos hay. La interfaz
         *     debe mirar `fotoEstado` del reporte y no pedir la imagen mientras este EN_REVISION.
         */
        get: operations["foto"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/estadisticas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Obtener estadísticas globales de la ciudad */
        get: operations["globales"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/estadisticas/exportar.csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Exportar las estadísticas en CSV (RF025)
         * @description Separador `;` y BOM UTF-8, para que Excel en español lo abra sin romper las tildes.
         */
        get: operations["exportarCsv"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cumplimiento": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Índice global de la ciudad, sobre todos los cortes cerrados */
        get: operations["global"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cumplimiento/serie": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Evolución del índice mes a mes (RF024)
         * @description Un punto por mes con al menos un corte cerrado, en hora de Cartagena. Sin
         *     `sectorId`, la ciudad completa. `desde` y `hasta` son opcionales y acotan por la
         *     hora real de restablecimiento. Lista vacía si no hay cortes cerrados en el
         *     rango — una serie sin datos es una respuesta válida.
         */
        get: operations["serie"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cumplimiento/serie.csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * La misma serie en CSV (RF025)
         * @description Separador `;` y BOM UTF-8, para que Excel en español la abra sin romper las tildes.
         */
        get: operations["serieCsv"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cumplimiento/sectores/{sectorId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Índice agregado de un sector, sobre sus cortes cerrados */
        get: operations["porSector"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cumplimiento/cortes/{corteId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Índice de un corte cerrado */
        get: operations["porCorte"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/cumplimiento/calidad": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Calidad del dato del índice: cuánto se midió y cuánto no
         * @description Cuantos cierres sostienen el indice, cuantos son provisionales, y cuantos cortes ya vencidos no tienen
         *     cierre en algun barrio. Responde aunque no haya un solo cierre —cuando `/api/cumplimiento` responde
         *     400—: es lo que permite mostrar «sin datos suficientes» con cifras. `sectorId` es opcional.
         */
        get: operations["calidad"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/bitacora": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar los eventos de la bitácora, más recientes primero
         * @description Paginado: la bitácora es de solo anexado (RF028), así que crece sin cota.
         *     El total, la página y el enlace a la siguiente viajan en las cabeceras
         *     `X-Total-Count`, `X-Total-Pages`, `X-Page`, `X-Page-Size` y `Link` — el cuerpo
         *     sigue siendo un arreglo JSON, así que un cliente que las ignore no se rompe.
         *     Por defecto 50 eventos; el máximo por página es 200.
         *
         *     Filtros opcionales, que se combinan y buscan en todo el historial: `sectorId`,
         *     `tipo`, `desde` (inclusivo) y `hasta` (exclusivo), ambos instantes ISO 8601 en
         *     UTC. El enlace `Link` a la siguiente página conserva los filtros. Sin
         *     coincidencias, la respuesta es una página vacía, no un error; un `tipo` que no
         *     existe o un `hasta` que no es posterior a `desde` son un 400.
         */
        get: operations["listar_2"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/bitacora/{id}/sustento": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Los reportes que sustentan un evento de consenso (RF011)
         * @description Ids de los reportes ciudadanos que sostuvieron el cambio de estado, para contrastarlo con la
         *     evidencia. Van aparte del listado porque en una avería grande pueden ser miles. Paginado con las
         *     mismas cabeceras que el listado; por defecto 50 ids por página, máximo 200. Vacío en los
         *     eventos que no son de consenso.
         */
        get: operations["sustento"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/analitica/cumplimiento": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Índice de Cumplimiento desde la copia SQL
         * @description El índice global de la ciudad, o el de un barrio con `sectorId`. Misma fórmula que `GET /api/cumplimiento`, calculada por una vista de PostgreSQL sobre la copia, que va hasta 5 minutos por detrás de MongoDB.
         */
        get: operations["cumplimientoAnalitico"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/analitica/cumplimiento/mensual": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Serie mensual del Índice desde la copia SQL
         * @description El índice agrupado por mes en hora de Cartagena, de más antiguo a más reciente.
         */
        get: operations["cumplimientoAnaliticoMensual"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description Invitacion emitida por un ADMIN: crea la cuenta con su rol y manda el enlace */
        SolicitudInvitacion: {
            /** Format: email */
            correo: string;
            nombre: string;
            /** @description ADMIN, VEEDOR u OBSERVADOR */
            rol: string;
            /** @description Opcional: slug del barrio de la persona. 400 si no existe. */
            barrioId?: string | null;
        };
        /** @description Cuenta del panel, tal como la ve un ADMIN */
        UsuarioRespuesta: {
            id?: string;
            correo?: string;
            nombre?: string;
            /** @description PENDIENTE_VERIFICACION, PENDIENTE_APROBACION, INVITADA, ACTIVA, SUSPENDIDA o RECHAZADA */
            estado?: string;
            rol?: string;
            /** @description Slug del barrio donde vive la persona; nulo si no lo dio (ADR-081) */
            barrioId?: string | null;
            permisosEfectivos?: string[];
            permisosConcedidos?: string[];
            permisosRevocados?: string[];
            segundoFactorActivo?: boolean;
            /** Format: date-time */
            creadoEn?: string;
            /** Format: date-time */
            actualizadoEn?: string;
            /**
             * @description Cuenta de vecino creada por el sistema para probar el volumen (ADR-094): no es una persona registrada y no puede
             *     iniciar sesion. El listado las incluye; esta marca permite ocultarlas.
             */
            sintetica?: boolean;
        };
        /** @description Credencial de acceso al panel del veedor */
        CredencialVeedor: {
            /**
             * Format: email
             * @description Correo de la cuenta
             * @example veedor@ejemplo.org
             */
            correo: string;
            /** @description Clave de la cuenta */
            clave: string;
            /**
             * @description Codigo de 6 digitos de la app de autenticacion. Se omite en el primer intento; si la
             *     cuenta tiene segundo factor, la respuesta 401 con type `segundo-factor-requerido`
             *     indica que hay que reintentar incluyendolo.
             */
            codigoTotp?: string;
        };
        /** @description Sesion emitida para el panel del veedor (RNF011: expira en 8 horas) */
        SesionVeedor: {
            /** @description Token JWT. Se envia como 'Authorization: Bearer <token>' */
            token?: string;
            usuarioId?: string;
            nombre?: string;
            correo?: string;
            /** @description ADMIN, VEEDOR u OBSERVADOR */
            rol?: string;
            /** @description Permisos efectivos ya resueltos: rol mas concedidos menos revocados */
            permisos?: string[];
            /**
             * @description COMPLETO, o ALTA_SEGUNDO_FACTOR cuando la cuenta es ADMIN y todavia no dio de alta su
             *     TOTP. Con ese alcance el token solo sirve para /api/veedor/segundo-factor.
             */
            alcance?: string;
        };
        /** @description Codigo de 6 digitos de la app de autenticacion */
        SolicitudCodigo: {
            codigo: string;
        };
        /** @description Datos para dar de alta el segundo factor. El secreto solo se muestra aqui, una vez. */
        AltaSegundoFactorRespuesta: {
            /** @description URI otpauth:// para pintar el QR */
            uri?: string;
            /** @description El mismo secreto en Base32, para teclearlo si la camara falla */
            secreto?: string;
        };
        /** @description Cambiar la propia clave con la sesión iniciada */
        SolicitudCambioClave: {
            /** @description La clave de hoy. Sin ella un token robado bastaría para cambiarla. */
            claveActual: string;
            /** @description La nueva: de 12 a 128 caracteres y distinta de la actual. */
            claveNueva: string;
        };
        /** @description Registro de un corte oficial por el veedor (RF016) */
        SolicitudCorte: {
            /**
             * @description Identificadores de los sectores afectados
             * @example [
             *       "manga",
             *       "bocagrande"
             *     ]
             */
            sectoresAfectados: string[];
            /** Format: date-time */
            inicio: string;
            /** Format: date-time */
            finPrometido: string;
            /** @example Mantenimiento planta El Bosque */
            causa: string;
            /**
             * Format: date-time
             * @description Opcional. El corte del veedor es el override: desde esta hora deja de afirmar nada, aunque nadie lo haya cerrado.
             */
            caducaEn?: string | null;
        };
        ProblemDetail: {
            /** Format: uri */
            type?: string;
            title?: string | null;
            /** Format: int32 */
            status?: number;
            detail?: string | null;
            /** Format: uri */
            instance?: string | null;
            properties?: {
                [key: string]: Record<string, never>;
            } | null;
        };
        /** @description Cómo y cuándo se restableció un barrio dentro del corte */
        CierreRespuesta: {
            sectorId?: string;
            /** Format: date-time */
            hora?: string;
            /** @description Quién lo sostiene: VEEDOR, ACUACAR, VECINOS, SENSOR o PRENSA */
            fuente?: string;
            /** @description Un cierre que solo sostienen los vecinos o los sensores: un veedor o un boletín puede confirmarlo o corregirlo */
            provisional?: boolean;
        };
        /** @description Corte oficial (RF016-RF017) */
        CorteRespuesta: {
            id?: string;
            sectoresAfectados?: string[];
            /** Format: date-time */
            inicio?: string;
            /** Format: date-time */
            finPrometido?: string;
            causa?: string;
            origen?: string;
            /** @description ANUNCIADO, CONFIRMADO, RESTABLECIDO, EXPIRADO o ANULADO. RESTABLECIDO solo cuando todos sus barrios tienen cierre; EXPIRADO nadie lo confirmó a tiempo y no cuenta en el Índice. */
            estado?: string;
            /** @description Un cierre por cada barrio ya restablecido; los pendientes no aparecen. Vacío mientras ningún barrio se haya restablecido. */
            cierres?: components["schemas"]["CierreRespuesta"][];
            /** @description Solo en un corte ANULADO: por qué se anuló */
            motivoAnulacion?: string | null;
            /**
             * Format: date-time
             * @description Solo en el corte del veedor, que es el override: desde esta hora deja de afirmar nada. Nulo si dura hasta que alguien lo cierre o expire.
             */
            caducaEn?: string | null;
        };
        /** @description Coordenada GPS del reporte, solo cuando el usuario la autoriza (RF007) */
        CoordenadaDTO: {
            /** Format: double */
            latitud: number;
            /** Format: double */
            longitud: number;
        };
        /**
         * @description La ubicacion del momento. El servidor la compara con el barrio que declaraste y la descarta: no se
         *     guarda ni se audita; solo queda que el barrio quedo verificado.
         */
        SolicitudVerificacionBarrio: {
            coordenada: components["schemas"]["CoordenadaDTO"];
            /**
             * Format: double
             * @description Precision de la lectura en metros (`coords.accuracy` del navegador). Una precision peor que 200 m
             *     (ubicacion aproximada por red) no verifica y responde 422 `ubicacion-imprecisa`.
             * @example 25.5
             */
            precisionMetros: number;
        };
        /** @description Lo que acepto, con la version del texto y la fecha */
        ConsentimientoRespuesta: {
            /** @description PRIVACIDAD o AVISOS */
            tipo?: string;
            version?: string;
            /** Format: date-time */
            fecha?: string;
        };
        /** @description Perfil del vecino con sesion */
        PerfilVecinoRespuesta: {
            id?: string;
            correo?: string;
            nombre?: string;
            /** @description ACTIVA mientras pueda iniciar sesion */
            estado?: string;
            /** @description Slug del barrio que declaro */
            barrioId?: string;
            /** @description true si probo con su ubicacion que vive en `barrioId` */
            barrioVerificado?: boolean;
            /** Format: date-time */
            barrioVerificadoEn?: string | null;
            /** @description true si acepto recibir avisos de cortes de su barrio */
            recibeAvisos?: boolean;
            /** @description Lo que acepto, con la version del texto y la fecha */
            consentimientos?: components["schemas"]["ConsentimientoRespuesta"][];
            /** Format: date-time */
            creadoEn?: string;
            /** Format: date-time */
            actualizadoEn?: string;
        };
        /** @description Credencial de un vecino registrado */
        CredencialVecino: {
            /**
             * Format: email
             * @description Correo de la cuenta
             * @example vecina@ejemplo.org
             */
            correo: string;
            /** @description Clave de la cuenta */
            clave: string;
        };
        /** @description Sesion de un vecino. Sirve en `/api/vecino/**`; del panel solo abre `GET /api/veedor/yo` y `POST /api/veedor/sesion/cierre`, que muestran o cierran lo propio. */
        SesionVecino: {
            /** @description Token JWT. Se envia como 'Authorization: Bearer <token>' */
            token?: string;
            usuarioId?: string;
            nombre?: string;
            correo?: string;
            /** @description Siempre `GESTIONAR_PERFIL_PROPIO` */
            permisos?: string[];
        };
        /** @description Solicitud para suscribirse a los avisos de uno o más sectores */
        SolicitudSuscripcion: {
            /**
             * Format: email
             * @description Correo al que llegarán los avisos
             * @example vecino@correo.com
             */
            correo: string;
            /** @description Identificadores de los sectores a seguir (211 barrios tiene la ciudad: más no caben) */
            sectorIds: string[];
        };
        /** @description Suscripción creada, pendiente de confirmación por correo (RF013) */
        SuscripcionRespuesta: {
            id?: string;
            correo?: string;
            sectorIds?: string[];
            /** @description PENDIENTE_CONFIRMACION, CONFIRMADA o CANCELADA */
            estado?: string;
            /** Format: date-time */
            creadaEn?: string;
        };
        /** @description Reporte ciudadano registrado */
        ReporteRespuesta: {
            id?: string;
            sectorId?: string;
            tipo?: string;
            /** Format: date-time */
            timestamp?: string;
            /**
             * @description Ruta de la foto: `/api/fotos/{nombre}`. Existir no significa que se pueda ver: el servidor la sirve al
             *     publico solo si `fotoEstado` es PUBLICA; antes responde 404.
             */
            fotoUrl?: string;
            /**
             * @description SIN_FOTO, EN_REVISION (el reporte espera moderacion), PUBLICA o DESCARTADA. Con EN_REVISION la interfaz
             *     muestra «en revision» en vez de pedir la imagen.
             */
            fotoEstado?: string;
            /** Format: int32 */
            confirmaciones?: number;
            /**
             * @description Cuanto respalda el servidor que quien reporta esta en el barrio: CUENTA_VERIFICADA, UBICACION_VERIFICADA
             *     o NINGUNA. Lo decide el servidor; el cliente solo lo muestra.
             */
            verificacion?: string;
            /**
             * @description Solo al crear el reporte: el token con el que su autor sube la foto en `POST /api/reportes/{id}/foto`
             *     (cabecera `X-Subida`). De un solo uso y vence a los pocos minutos; no se vuelve a entregar.
             */
            subidaToken?: string;
        };
        /**
         * @description Reporte ciudadano (RF005-RF008). La identidad de quien reporta no va en el cuerpo: viaja en la
         *     cabecera `X-Dispositivo` (token de `POST /api/dispositivos`) o en la sesion de un vecino
         *     (`Authorization: Bearer`). Un campo `huella` en el cuerpo, como el de versiones anteriores, se ignora.
         */
        SolicitudReporte: {
            /**
             * @description Identificador del sector reportado. Opcional si viaja la coordenada: entonces el
             *     servidor infiere el barrio que la contiene (RF007). Si no viaja ninguno, 400.
             * @example bocagrande
             */
            sectorId?: string | null;
            /**
             * @description SIN_AGUA, PRESION_BAJA o SERVICIO_RESTABLECIDO
             * @example SIN_AGUA
             */
            tipo: string;
            coordenada?: components["schemas"]["CoordenadaDTO"];
            /**
             * Format: double
             * @description Precision de la coordenada en metros (`coords.accuracy` del navegador). Sin ella, o si es peor que
             *     200 m, la ubicacion no verifica el reporte.
             * @example 25.5
             */
            precisionMetros?: number | null;
        };
        IotCoordenada: {
            /** Format: double */
            lat?: number;
            /** Format: double */
            lon?: number;
        };
        IotPresionRequest: {
            sensorId: string;
            sectorId: string;
            /** Format: double */
            presionPsi?: number;
            coordenada?: components["schemas"]["IotCoordenada"];
        };
        /** @description Identidad de dispositivo emitida por el servidor */
        TokenDeDispositivoRespuesta: {
            /** @description Se envia en la cabecera `X-Dispositivo` de `POST /api/reportes` y de `/confirmar`. Guardalo: perderlo es perder la identidad. */
            token?: string;
        };
        /** @description Pedir de nuevo el correo de verificación. Responde siempre 202, exista o no la cuenta. */
        SolicitudReenvioVerificacion: {
            /** Format: email */
            correo: string;
        };
        /**
         * @description Las dos casillas son independientes: aceptar la privacidad es obligatorio para registrarse;
         *     `avisos` autoriza recibir avisos de cortes de tu barrio y por defecto es falso.
         */
        Consentimiento: {
            /** @description Acepta el aviso de privacidad vigente. Debe ser true. */
            privacidad?: boolean;
            /**
             * @description Acepta recibir avisos de cortes de su barrio
             * @default false
             */
            avisos: boolean;
        };
        /**
         * @description Registro de un vecino. Confirmar el correo activa la cuenta: no hay aprobacion de un administrador
         *     porque un vecino solo gestiona su propio perfil.
         */
        SolicitudRegistroVecino: {
            /** Format: email */
            correo: string;
            nombre: string;
            /**
             * @description Slug del barrio donde vives (uno de `GET /api/sectores`). 400 si no existe.
             * @example manga
             */
            barrioId: string;
            consentimiento: components["schemas"]["Consentimiento"];
        };
        /** @description Pedir el enlace de restablecimiento. Responde siempre 202, exista o no la cuenta. */
        SolicitudRestablecer: {
            /** Format: email */
            correo: string;
        };
        /** @description Solicitud de acceso al panel. No concede nada: exige verificar el correo y que un ADMIN apruebe. */
        SolicitudRegistro: {
            /** Format: email */
            correo: string;
            /** @description Nombre con el que apareceras en la auditoria del panel */
            nombre: string;
            /** @description Minimo 12 caracteres. La politica completa vive en ClaveEnClaro. */
            clave: string;
            /**
             * @description Opcional: slug del barrio donde vives (uno de `GET /api/sectores`). 400 si no existe.
             * @example manga
             */
            barrioId?: string | null;
        };
        /** @description Fijar clave desde un enlace de un solo uso (invitacion o restablecimiento) */
        SolicitudFijarClave: {
            /** @description Token que venia en el enlace del correo */
            token: string;
            clave: string;
        };
        /**
         * @description Rol de base mas los ajustes por persona. Los permisos del rol se aplican solos; `concedidos`
         *     anade sobre ellos y `revocados` quita. Un permiso en las dos listas es un error y se rechaza.
         */
        SolicitudPermisos: {
            /** @description ADMIN, VEEDOR u OBSERVADOR */
            rol: string;
            concedidos?: string[];
            revocados?: string[];
        };
        /** @description Reporte ciudadano en la cola de moderación del veedor (RF018) */
        ReporteModeracionRespuesta: {
            id?: string;
            sectorId?: string;
            tipo?: string;
            coordenada?: components["schemas"]["CoordenadaDTO"];
            /** Format: date-time */
            timestamp?: string;
            /** @description PENDIENTE, APROBADO o DESCARTADO */
            estadoModeracion?: string;
            /** @description CUENTA_VERIFICADA, UBICACION_VERIFICADA o NINGUNA: cuánto respalda el servidor que quien reporta está en el barrio */
            verificacion?: string;
            /** @description SIN_FOTO, EN_REVISION, PUBLICA o DESCARTADA */
            fotoEstado?: string;
            /** @description Ruta de la foto para el panel (`/api/veedor/fotos/{nombre}`), que la ve en cualquier estado. Nulo si no hay foto */
            fotoUrl?: string;
            /** @description Solo en la cola de pendientes: el reporte viene de una red (resumen diario de la IP, que no se expone) que ya envio una rafaga de reportes a este barrio. No bloquea nada: es donde mirar primero. Nulo en el resto de respuestas */
            senalRed?: boolean | null;
        };
        /**
         * @description Propuesta de cambio de estado detectada por la ingesta automatizada (M9), esperando la
         *     revisión de un veedor. No afecta el mapa público hasta que se apruebe.
         */
        PropuestaIngestaRespuesta: {
            id?: string;
            sectorId?: string;
            /** @description SIN_SERVICIO, PRESION_BAJA, CORTE_PROGRAMADO o CON_SERVICIO */
            estadoPropuesto?: string;
            /**
             * @description Colector que la detectó
             * @example acuacar
             */
            fuente?: string;
            /** @description Enlace al boletín o nota de prensa original */
            urlOriginal?: string | null;
            /** @description Fragmento del que se dedujo el estado, para que el veedor pueda verificarlo */
            citaTextual?: string;
            /**
             * Format: double
             * @description Entre 0 y 1, graduada según la evidencia que halló el extractor (ADR-032): 0.85 con
             *     enumeración explícita de barrios y horario, 0.75 con enumeración sin horario, 0.45
             *     con una mención suelta en prosa. Sirve para ordenar la cola, no para publicar solo.
             */
            confianza?: number;
            /** Format: date-time */
            detectadaEn?: string;
            /** @description PENDIENTE, APROBADA o DESCARTADA */
            estadoRevision?: string;
            /**
             * Format: date-time
             * @description Inicio de la ventana que el boletín prometió. Nulo cuando el texto no la declaraba:
             *     no se estima (ADR-006).
             */
            inicioDeclarado?: string | null;
            /**
             * Format: date-time
             * @description Fin prometido de la misma ventana. Junto con el inicio es lo que permite que el
             *     estado del sector evolucione solo (ADR-033) y lo que alimenta el Índice de
             *     Cumplimiento (RF020-RF022).
             */
            finPrometido?: string | null;
            /**
             * @description Por qué esta propuesta espera al veedor en vez de haberse publicado sola (D5): confianza baja, una
             *     ventana de más de 72 horas, más de 40 barrios, un nombre ambiguo, o que viene de prensa. Nulo si salió sola.
             */
            motivoDeRevision?: string | null;
        };
        /** @description Anulación de un corte o de una propuesta de la ingesta que se publicó por error */
        SolicitudAnulacion: {
            /**
             * @description Por qué se anula. Queda en la bitácora pública y en la auditoría.
             * @example El boletín hablaba de otro barrio
             */
            motivo: string;
        };
        /** @description Cierre de un corte con la hora real de restablecimiento (RF017) */
        SolicitudCierreCorte: {
            /** Format: date-time */
            horaReal: string;
        };
        /** @description Cambios al perfil. Solo se aplica lo que viene; un campo ausente no se toca. */
        SolicitudPerfilVecino: {
            nombre?: string;
            /**
             * @description Slug del barrio donde vives. Cambiarlo anula la verificacion de barrio anterior. 400 si no existe.
             * @example crespo
             */
            barrioId?: string | null;
            /** @description true acepta avisos de cortes de tu barrio; false retira ese consentimiento */
            recibirAvisos?: boolean | null;
        };
        /** @description Contadores de calibración (D37) de este proceso desde `desde`. Un reinicio los pone a cero; con varias réplicas, cada una cuenta los suyos. */
        MetricasDelSistemaRespuesta: {
            /**
             * Format: date-time
             * @description Desde cuándo cuentan estos contadores
             */
            desde?: string;
            /** @description Cambios de estado publicados, por «ESTADO/ORIGEN» (SIN_DATOS/SIN_ORIGEN es el regreso a «sin datos») */
            cambiosDeEstado?: {
                [key: string]: number;
            };
            /**
             * Format: int64
             * @description Barrios que entraron en disputa (los vecinos contradicen lo oficial)
             */
            disputasAbiertas?: number;
            /** @description Quórums que llegaron al umbral pero no a la composición (verificación o redes distintas), por tipo de reporte y por episodio */
            quorumsRechazadosPorComposicion?: {
                [key: string]: number;
            };
            /** @description Reportes recibidos por nivel de verificación: NINGUNA, UBICACION_VERIFICADA o CUENTA_VERIFICADA */
            reportesPorNivelDeVerificacion?: {
                [key: string]: number;
            };
            /** @description Fallos de cada colector de ingesta, por nombre */
            fallosDeColectores?: {
                [key: string]: number;
            };
            tiempoHastaElCambioDeEstado?: components["schemas"]["TiempoHastaElCambio"];
        };
        /** @description Cambios medidos y cuánto tardaron, en segundos */
        TiempoHastaElCambio: {
            /** Format: int64 */
            cambios?: number;
            /** Format: int64 */
            promedioSegundos?: number;
            /** Format: int64 */
            maximoSegundos?: number;
        };
        /** @description Estado de salud de un colector de la ingesta automatizada */
        SaludColectorRespuesta: {
            /** @example acuacar */
            nombre?: string;
            /**
             * Format: date-time
             * @description Nulo si el colector todavía no ha completado un ciclo con éxito
             */
            ultimaEjecucionExitosa?: string | null;
            /**
             * Format: date-time
             * @description Nulo si nunca ha fallado
             */
            ultimoFallo?: string | null;
            /** @description Mensaje del último fallo, para diagnosticar sin entrar al servidor */
            motivoDelUltimoFallo?: string | null;
            /**
             * Format: int64
             * @description Documentos traídos desde que arrancó el proceso
             */
            itemsProcesados?: number;
            /**
             * Format: double
             * @description Entre 0 y 1, sobre los ciclos corridos desde que arrancó el proceso
             */
            tasaDeError?: number;
            /**
             * Format: int32
             * @description Ciclos seguidos fallando. Desde 3, el colector se reporta caído en /actuator/health
             */
            fallosConsecutivos?: number;
        };
        /** @description Documento de la ingesta que falló al procesarse y sigue en cola de reintento */
        DocumentoFallidoRespuesta: {
            /** @example acuacar */
            fuente?: string;
            urlOriginal?: string;
            titulo?: string | null;
            /** @description Mensaje de la excepción que hizo fallar el procesamiento */
            motivo?: string;
            /** Format: date-time */
            primerIntento?: string;
            /** Format: date-time */
            ultimoIntento?: string;
            /**
             * Format: int32
             * @description Veces que se reintentó sin éxito, una por ciclo de ingesta
             */
            reintentos?: number;
        };
        /** @description Cuántos vecinos respaldan un estado y cuántos hacían falta */
        RespaldoVecinalRespuesta: {
            /** Format: int32 */
            vecinos?: number;
            /** Format: int32 */
            umbral?: number;
        } | null;
        /** @description Sector de Cartagena con el estado conocido de su servicio de agua */
        SectorRespuesta: {
            /**
             * @description Identificador estable del sector
             * @example bocagrande
             */
            id?: string;
            /**
             * @description Nombre del barrio segun el GeoJSON oficial
             * @example BOCAGRANDE
             */
            nombre?: string;
            /**
             * Format: int32
             * @description Habitantes según el censo. **Nulo cuando el barrio no tiene dato censal** (27 de los 211): no es 0,
             *     y no debe mostrarse como «0 habitantes».
             * @example 12000
             */
            poblacion?: number | null;
            /**
             * @description Estado conocido del servicio. **Nulo cuando no hay dato verificado**: no se asume
             *     CON_SERVICIO por omision, porque publicar servicio normal sin verificarlo es el
             *     falso positivo que el proyecto evita (ADR-014). Presentarlo como "sin datos".
             * @enum {string|null}
             */
            estado?: "CON_SERVICIO" | "SIN_SERVICIO" | "PRESION_BAJA" | "CORTE_PROGRAMADO" | null;
            /**
             * Format: date-time
             * @description Cuando se registro ese estado. Nulo si el sector no tiene estado.
             */
            actualizadoEn?: string | null;
            /**
             * Format: date-time
             * @description Última vez que una fuente con autoridad (consenso de vecinos, corte del veedor o boletín
             *     aprobado) sostuvo ese estado, haya cambiado o no (ADR-073). Nunca anterior a
             *     `actualizadoEn`. Nulo si el sector no tiene estado. Confirmar sin cambiar no emite
             *     evento SSE: el valor se renueva al volver a pedir la lista.
             */
            verificadoEn?: string | null;
            /**
             * @description Quién sostiene el estado: ACUACAR (boletín oficial), PRENSA (nota aprobada por el veedor),
             *     VEEDOR (corte o cierre del veedor), VECINOS (quórum de reportes) o SENSOR. Nulo si el sector
             *     no tiene estado.
             * @enum {string|null}
             */
            origen?: "ACUACAR" | "VEEDOR" | "VECINOS" | "PRENSA" | "SENSOR" | null;
            ventanaPrometida?: components["schemas"]["VentanaPrometidaRespuesta"];
            /**
             * @description La promesa ya venció y nadie confirmó que volvió el agua: el barrio sigue como estaba, pero
             *     por confirmar. Un restablecimiento pide menos vecinos que reportar una avería.
             */
            restablecimientoPorConfirmar?: boolean;
            /**
             * @description Un quórum de vecinos contradice a la fuente oficial. El color no cambia: la contradicción
             *     se muestra como una insignia y llega a la cola del veedor.
             */
            enDisputa?: boolean;
            /**
             * Format: int32
             * @description Cuántos vecinos sostienen esa contradicción. 0 si no hay disputa.
             */
            reportesEnContra?: number;
            respaldo?: components["schemas"]["RespaldoVecinalRespuesta"];
        };
        /** @description Desde cuándo y hasta cuándo prometió la fuente oficial la afectación */
        VentanaPrometidaRespuesta: {
            /** Format: date-time */
            inicio?: string;
            /** Format: date-time */
            fin?: string;
        } | null;
        /** @description Asiento de la bitacora de auditoria de cuentas: quien le hizo que a quien */
        EventoAuditoriaRespuesta: {
            id?: string;
            accion?: string;
            /** @description Nulo cuando actua el sistema o alguien sin sesion */
            autorCorreo?: string;
            sujetoCorreo?: string;
            detalle?: string;
            ip?: string;
            /** Format: date-time */
            ocurrioEn?: string;
        };
        /** @description Cuántos barrios, cortes y pares corte-barrio hay en una de las dos bases */
        ConteosAnaliticosRespuesta: {
            /** Format: int32 */
            sectores?: number;
            /** Format: int32 */
            cortes?: number;
            /** Format: int32 */
            pares?: number;
        };
        /** @description Una copia de MongoDB a la base analítica: cuándo corrió y si los conteos de las dos bases cuadraron */
        CopiaAnaliticaRespuesta: {
            /** Format: int64 */
            id?: number;
            /** Format: date-time */
            iniciadaEn?: string;
            /**
             * Format: date-time
             * @description Nulo si la copia sigue en curso o el backend se detuvo a mitad de ella
             */
            terminadaEn?: string;
            /** @description EN_CURSO, OK, CON_DIFERENCIAS o FALLIDA */
            resultado?: string;
            enMongo?: components["schemas"]["ConteosAnaliticosRespuesta"];
            enSql?: components["schemas"]["ConteosAnaliticosRespuesta"];
            /** @description Qué no cuadró o por qué falló. Nulo si todo salió bien */
            detalle?: string;
        };
        /** @description service_request de Open311 GeoReport v2 */
        Open311Response: {
            service_request_id?: string;
            /**
             * @description open o closed
             * @example open
             */
            status?: string;
            /**
             * @description Código del tipo de servicio
             * @example AGUA-001
             */
            service_code?: string;
            service_name?: string;
            description?: string;
            /** @description Nombre del barrio. La unidad geográfica es el sector, no un punto (ADR-026) */
            address?: string;
            /**
             * Format: date-time
             * @description Cuándo se registró el estado actual del sector
             */
            requested_datetime?: string | null;
            /**
             * Format: date-time
             * @description Igual a requested_datetime: el estado del sector es su propia actualización
             */
            updated_datetime?: string | null;
        };
        /** @description Qué instancia es esta y cuánto de lo que contiene es sintético */
        ModoDelSistemaRespuesta: {
            /** @description REAL o SIMULACION */
            modo?: string;
            /**
             * Format: int64
             * @description Cuentas de vecino creadas por el sistema para probar el volumen; no son personas registradas
             */
            cuentasSinteticas?: number;
        };
        /** @description Listado de sectores con la hora en que el servidor genero la respuesta */
        RespuestaSectores: {
            sectores?: components["schemas"]["SectorRespuesta"][];
            /**
             * Format: date-time
             * @description Instante en que el servidor genero esta respuesta (UTC)
             */
            generadoEn?: string;
        };
        /** @description Sector con su cantidad de cortes registrados */
        EstadisticaSectorRespuesta: {
            sectorId?: string;
            nombre?: string;
            /** Format: int32 */
            cantidadCortes?: number;
        };
        /** @description Estadísticas públicas globales (M7, RF023) */
        EstadisticasRespuesta: {
            sectoresMasAfectados?: components["schemas"]["EstadisticaSectorRespuesta"][];
            cortesPorDiaDeSemana?: {
                [key: string]: number;
            };
            /** Format: double */
            duracionPromedioHoras?: number;
        };
        /**
         * @description Índice de Cumplimiento (RF020-RF022): comparación explícita entre duración prometida y
         *     real, nunca un porcentaje aislado.
         */
        IndiceCumplimientoRespuesta: {
            /** @description Nulo cuando el índice es por corte o global, no por sector */
            sectorId?: string;
            /** Format: int64 */
            duracionPrometidaSegundos?: number;
            /** Format: int64 */
            duracionRealSegundos?: number;
            /**
             * Format: int64
             * @description duracionReal - duracionPrometida. Negativa si terminó antes de lo prometido
             */
            desviacionSegundos?: number;
            /**
             * Format: double
             * @description Capado en 100 cuando el corte termina antes o a tiempo
             */
            porcentajeCumplimiento?: number;
            /**
             * Format: double
             * @description De los cierres que sostienen este indice, que porcentaje (0 a 100) solo lo sostienen vecinos o sensores y un
             *     veedor o un boletin aun puede corregir. Publicalo junto al porcentaje: el numero es solo tan solido como esto.
             */
            porcentajeProvisional?: number;
            /**
             * Format: int64
             * @description Cortes cuya ventana prometida ya termino y en los que algun barrio no tiene cierre (incluidos los que expiraron
             *     sin confirmacion). No cuentan a favor ni en contra de Acuacar: se declaran.
             */
            cortesSinCierreConfirmado?: number;
            /**
             * Format: int64
             * @description Cortes publicados por error y retirados: no entran al indice
             */
            cortesAnulados?: number;
        };
        /** @description Un mes de la evolución del Índice de Cumplimiento (RF024) */
        PuntoSerieRespuesta: {
            /**
             * @description Mes en hora de Cartagena, ISO 8601
             * @example 2026-08
             */
            periodo?: string;
            /** Format: int64 */
            duracionPrometidaSegundos?: number;
            /** Format: int64 */
            duracionRealSegundos?: number;
            /**
             * Format: int64
             * @description duracionReal - duracionPrometida. Negativa si terminaron antes de lo prometido
             */
            desviacionSegundos?: number;
            /**
             * Format: double
             * @description Capado en 100 cuando los cortes terminan antes o a tiempo
             */
            porcentajeCumplimiento?: number;
            /**
             * Format: int32
             * @description Cortes cerrados sobre los que se calculó el mes. Un 40% sobre un solo corte y uno
             *     sobre veinte no significan lo mismo.
             */
            cantidadCortes?: number;
        };
        /**
         * @description Lo que sostiene el Indice de Cumplimiento: cuantos cierres se midieron y cuantos cortes no se pudieron medir. Existe aunque
         *     no haya un solo cierre (el indice entonces responde 400): es lo que permite decir «sin datos suficientes» con cifras.
         */
        CalidadDelCumplimientoRespuesta: {
            /**
             * Format: int64
             * @description Pares corte-barrio con cierre que entran al indice
             */
            cierresMedidos?: number;
            /**
             * Format: int64
             * @description De ellos, los que solo sostienen vecinos o sensores
             */
            cierresProvisionales?: number;
            /**
             * Format: double
             * @description cierresProvisionales sobre cierresMedidos, de 0 a 100
             */
            porcentajeProvisional?: number;
            /**
             * Format: int64
             * @description Cortes ya vencidos con algun barrio sin cierre, incluidos los expirados
             */
            cortesSinCierreConfirmado?: number;
            /**
             * Format: int64
             * @description Cortes retirados por error
             */
            cortesAnulados?: number;
        };
        /** @description Evento de la bitácora pública, de solo anexado (RF026-RF028) */
        EventoBitacoraRespuesta: {
            id?: string;
            /** @description CORTE_ANUNCIADO, CORTE_CONFIRMADO_POR_CIUDADANOS, CORTE_RESTABLECIDO o CORTE_DETECTADO_POR_INGESTA */
            tipo?: string;
            /** @description Nulo si el evento no está atado a un sector */
            sectorId?: string;
            /** @description Nulo si el evento no está atado a un corte oficial (p. ej. consenso ciudadano) */
            corteId?: string;
            /** Format: date-time */
            timestamp?: string;
            descripcion?: string;
            /** @description Estado del servicio que afirma el evento: CON_SERVICIO, SIN_SERVICIO, PRESION_BAJA o CORTE_PROGRAMADO. Nulo si el evento no habla del servicio — presentarlo entonces como informativo, sin color de estado. */
            estado?: string;
            /** @description Boletín o nota que respalda el evento. Nulo si la fuente no lo trae. */
            urlOriginal?: string;
            /** @description Portada del boletín. Nula si la fuente no la trae. */
            imagenUrl?: string;
            /**
             * Format: int32
             * @description RF011 — cuántos reportes ciudadanos sostuvieron el cambio, en los eventos de consenso; 0 en los demás. Los ids no viajan en el listado (pesaban cientos de KB por página): se piden con GET /api/bitacora/{id}/sustento.
             */
            cantidadReportesSustento?: number;
            /** @description Quién sostiene el evento: ACUACAR o PRENSA (boletín o nota), VECINOS (quórum) o VEEDOR (panel). Nulo en los eventos anteriores a este dato. */
            fuente?: string | null;
            respaldo?: components["schemas"]["RespaldoRespuesta"];
        };
        /** @description Cuántos vecinos respaldan un cambio y cuántos hacían falta */
        RespaldoRespuesta: {
            /** Format: int32 */
            vecinos?: number;
            /** Format: int32 */
            umbral?: number;
        } | null;
        /**
         * @description Índice de Cumplimiento calculado por las vistas SQL de la copia analítica (PostgreSQL, ADR-100). Misma fórmula que
         *     GET /api/cumplimiento (ADR-022): se suman duraciones, no se promedian porcentajes. Va hasta 5 minutos por detrás de MongoDB.
         */
        CumplimientoAnaliticoRespuesta: {
            /** @description Nulo en el índice global de la ciudad */
            sectorId?: string;
            /** @description Nulo en el índice global de la ciudad */
            nombre?: string;
            /**
             * Format: int64
             * @description Pares corte-barrio ya restablecidos que sostienen el índice. Con 0, el 100 % no dice nada: no hay nada que medir
             */
            paresCerrados?: number;
            /** Format: int64 */
            duracionPrometidaSegundos?: number;
            /** Format: int64 */
            duracionRealSegundos?: number;
            /**
             * Format: int64
             * @description duracionReal - duracionPrometida. Negativa si terminó antes de lo prometido
             */
            desviacionSegundos?: number;
            /**
             * Format: double
             * @description Capado en 100 cuando los cortes terminan antes o a tiempo
             */
            porcentajeCumplimiento?: number;
            /**
             * Format: date-time
             * @description Cuándo terminó la última copia que cuadró con MongoDB. Nulo si todavía no hubo ninguna
             */
            copiadoEn?: string;
        };
        /** @description El Índice de un mes, calculado por las vistas SQL de la copia analítica */
        PuntoMensualAnaliticoRespuesta: {
            /**
             * @description Mes en hora de Cartagena, formato ISO 8601
             * @example 2026-08
             */
            periodo?: string;
            /** Format: int64 */
            paresCerrados?: number;
            /** Format: int64 */
            duracionPrometidaSegundos?: number;
            /** Format: int64 */
            duracionRealSegundos?: number;
            /** Format: double */
            porcentajeCumplimiento?: number;
        };
        /** @description La serie mensual del Índice según la copia analítica, de más antiguo a más reciente */
        SerieMensualAnaliticaRespuesta: {
            /**
             * Format: date-time
             * @description Cuándo terminó la última copia que cuadró con MongoDB. Nulo si todavía no hubo ninguna
             */
            copiadoEn?: string;
            puntos?: components["schemas"]["PuntoMensualAnaliticoRespuesta"][];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    reenviarInvitacion: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Invitación reenviada */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description No existe la cuenta */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description La cuenta ya aceptó la invitación (no está en estado INVITADA) */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    invitar: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudInvitacion"];
            };
        };
        responses: {
            /** @description Invitacion enviada */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsuarioRespuesta"];
                };
            };
            /** @description Datos invalidos o barrio inexistente */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsuarioRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description Ya existe una cuenta con ese correo */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsuarioRespuesta"];
                };
            };
        };
    };
    iniciarSesion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CredencialVeedor"];
            };
        };
        responses: {
            /** @description Credencial correcta, token emitido */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SesionVeedor"];
                };
            };
            /** @description Credencial incorrecta, o falta el segundo factor */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SesionVeedor"];
                };
            };
            /** @description La cuenta existe pero no esta habilitada para entrar */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SesionVeedor"];
                };
            };
            /** @description Cuenta bloqueada por intentos fallidos */
            423: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SesionVeedor"];
                };
            };
            /** @description Demasiados intentos desde esta IP */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SesionVeedor"];
                };
            };
        };
    };
    cerrar: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    confirmar: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudCodigo"];
            };
        };
        responses: {
            /** @description Segundo factor activo; sesion nueva emitida */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SesionVeedor"];
                };
            };
            /** @description El codigo no coincide */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SesionVeedor"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description No hay un alta en curso */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SesionVeedor"];
                };
            };
        };
    };
    desactivar: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudCodigo"];
            };
        };
        responses: {
            /** @description Segundo factor desactivado */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description El codigo no coincide */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El rol ADMIN exige segundo factor */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    iniciar: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["SolicitudCodigo"];
            };
        };
        responses: {
            /** @description Secreto generado, pendiente de confirmar */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AltaSegundoFactorRespuesta"];
                };
            };
            /** @description El codigo actual no coincide */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AltaSegundoFactorRespuesta"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description Ya tiene segundo factor y no envio el codigo actual */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AltaSegundoFactorRespuesta"];
                };
            };
        };
    };
    cambiarClave: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudCambioClave"];
            };
        };
        responses: {
            /** @description Clave cambiada; todas las sesiones cerradas */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description La clave actual no es correcta, la nueva no cumple la política (12 a 128 caracteres) o es igual a la actual */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description Cuenta bloqueada por intentos fallidos */
            423: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    listarPorSector: {
        parameters: {
            query: {
                sectorId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorteRespuesta"][];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    registrar: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudCorte"];
            };
        };
        responses: {
            /** @description Corte registrado */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorteRespuesta"];
                };
            };
            /** @description Datos inválidos o algún sector no existe */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    verificarBarrio: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudVerificacionBarrio"];
            };
        };
        responses: {
            /** @description Perfil con el barrio verificado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PerfilVecinoRespuesta"];
                };
            };
            /** @description Coordenada fuera de rango o precision ausente o negativa */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PerfilVecinoRespuesta"];
                };
            };
            /** @description `ubicacion-fuera-del-barrio` (la ubicacion no cae en tu barrio declarado) o `ubicacion-imprecisa` (precision peor que 200 m; reintenta con GPS) */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PerfilVecinoRespuesta"];
                };
            };
            /** @description Ya usaste los 3 intentos de hoy */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PerfilVecinoRespuesta"];
                };
            };
        };
    };
    iniciarSesion_1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CredencialVecino"];
            };
        };
        responses: {
            /** @description Credencial correcta, token emitido */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SesionVecino"];
                };
            };
            /** @description Credencial incorrecta */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SesionVecino"];
                };
            };
            /** @description La cuenta esta suspendida (si aun no eligio su clave, responde 401 como con una clave incorrecta) */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SesionVecino"];
                };
            };
            /** @description Cuenta bloqueada por intentos fallidos */
            423: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SesionVecino"];
                };
            };
            /** @description Demasiados intentos desde esta IP */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SesionVecino"];
                };
            };
        };
    };
    cerrar_1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description No Content */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    suscribirse: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudSuscripcion"];
            };
        };
        responses: {
            /** @description Suscripción creada, correo de confirmación en camino */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuscripcionRespuesta"];
                };
            };
            /** @description Correo inválido o algún sector no existe */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    pantallaConfirmar: {
        parameters: {
            query: {
                token: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Página con el botón */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
        };
    };
    confirmar_1: {
        parameters: {
            query: {
                token: string;
            };
            header?: {
                Accept?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Suscripción confirmada */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                    "text/html": Record<string, never>;
                };
            };
            /** @description Token inválido, inexistente o de una suscripción ya cancelada */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    pantallaCancelar: {
        parameters: {
            query: {
                token: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Página con el botón */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
        };
    };
    cancelar: {
        parameters: {
            query: {
                token: string;
            };
            header?: {
                Accept?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Suscripción cancelada */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                    "text/html": Record<string, never>;
                };
            };
            /** @description Token inválido o inexistente */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    confirmarRestablecimiento: {
        parameters: {
            query: {
                token: string;
            };
            header?: never;
            path: {
                sectorId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Voto registrado */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReporteRespuesta"];
                };
            };
            /** @description Falta el token */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El enlace no sirve (type `enlace-invalido`): vencio, es de otro barrio o ya no recibes los avisos */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description Se agoto el cupo de reportes de esta suscripcion en el barrio */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    registrar_1: {
        parameters: {
            query?: never;
            header?: {
                "X-Dispositivo"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudReporte"];
            };
        };
        responses: {
            /** @description Reporte registrado */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReporteRespuesta"];
                };
            };
            /** @description Sector inexistente, tipo inválido, coordenada fuera de Cartagena o sin sector ni coordenada */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description Falta `X-Dispositivo`, no lo firmó este servidor o el dispositivo ya no existe (type `dispositivo-invalido`): pide otro con POST /api/dispositivos */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La identidad superó el límite de reportes para este sector */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    agregarEvidencia: {
        parameters: {
            query?: never;
            header?: {
                "X-Subida"?: string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: {
            content: {
                "multipart/form-data": {
                    /** Format: binary */
                    foto: string;
                };
            };
        };
        responses: {
            /** @description Evidencia agregada */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReporteRespuesta"];
                };
            };
            /** @description Falta el archivo o no es una imagen valida */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description Falta el token de subida, ya se uso, vencio o es de otro reporte (type `subida-no-autorizada`); es la misma respuesta si el reporte no existe */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El reporte ya tiene foto */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description Formato no permitido, como WebP (type `formato-no-permitido`) */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    confirmar_2: {
        parameters: {
            query?: never;
            header?: {
                "X-Dispositivo"?: string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Reporte confirmado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReporteRespuesta"];
                };
            };
            /** @description Falta o no es válida la identidad del dispositivo (type `dispositivo-invalido`) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description Reporte no encontrado */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    reportarPresion: {
        parameters: {
            query?: never;
            header?: {
                "X-IoT-Key"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IotPresionRequest"];
            };
        };
        responses: {
            /** @description Lectura recibida (haya generado reporte o no) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Falta el sensor, el sector no existe o la coordenada es inválida */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description X-IoT-Key ausente o incorrecta */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El servidor no tiene configurada la clave de sensores */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    pedir: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Token emitido */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenDeDispositivoRespuesta"];
                };
            };
            /** @description Demasiados tokens pedidos desde esta IP */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenDeDispositivoRespuesta"];
                };
            };
        };
    };
    verificarCorreo: {
        parameters: {
            query: {
                token: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Correo confirmado */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Enlace invalido, vencido o ya usado */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    reenviarVerificacion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudReenvioVerificacion"];
            };
        };
        responses: {
            /** @description Si había algo que reenviar, el correo va en camino */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Correo mal formado */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    registrarse: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudRegistroVecino"];
            };
        };
        responses: {
            /** @description Solicitud recibida; revisa tu correo */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Correo mal formado, barrio ausente o inexistente, o privacidad no aceptada */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    pedirRestablecimiento: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudRestablecer"];
            };
        };
        responses: {
            /** @description Accepted */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    registrarse_1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudRegistro"];
            };
        };
        responses: {
            /** @description Solicitud recibida; revisa tu correo */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Correo mal formado, clave que no cumple la politica o barrio inexistente */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    aceptar: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudFijarClave"];
            };
        };
        responses: {
            /** @description Cuenta activa; ya puedes iniciar sesion */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Enlace invalido o clave que no cumple la politica */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    pantallaVerificar: {
        parameters: {
            query: {
                token: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
        };
    };
    verificarCorreo_1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/x-www-form-urlencoded": {
                    token: string;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
        };
    };
    pantallaRestablecer: {
        parameters: {
            query: {
                token: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
        };
    };
    restablecerClave: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/x-www-form-urlencoded": {
                    token: string;
                    clave: string;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
        };
    };
    pantallaInvitacion: {
        parameters: {
            query: {
                token: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
        };
    };
    aceptarInvitacion: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/x-www-form-urlencoded": {
                    token: string;
                    clave: string;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
        };
    };
    fijarClave: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudFijarClave"];
            };
        };
        responses: {
            /** @description Clave cambiada */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Enlace invalido, vencido o ya usado */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    suspender: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Cuenta suspendida */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsuarioRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description Es el unico ADMIN activo, o el ADMIN se administra a si mismo */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsuarioRespuesta"];
                };
            };
        };
    };
    rechazar: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsuarioRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    reactivar: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsuarioRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    cambiarPermisos: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudPermisos"];
            };
        };
        responses: {
            /** @description Permisos actualizados */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsuarioRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description Dejaria al sistema sin ningun ADMIN activo */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsuarioRespuesta"];
                };
            };
        };
    };
    aprobar: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudPermisos"];
            };
        };
        responses: {
            /** @description Cuenta activa */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsuarioRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La cuenta no esta esperando aprobacion, o el ADMIN se administra a si mismo */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsuarioRespuesta"];
                };
            };
        };
    };
    descartarFoto: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Foto descartada */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReporteModeracionRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El reporte no existe */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El reporte no tiene foto */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    descartar: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Reporte descartado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReporteModeracionRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El reporte no existe */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    aprobar_1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Reporte aprobado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReporteModeracionRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El reporte no existe */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    descartar_1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Propuesta descartada */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PropuestaIngestaRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La propuesta no existe */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La propuesta ya estaba aprobada */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    aprobar_2: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Propuesta aprobada y estado aplicado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PropuestaIngestaRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La propuesta no existe */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El sector de la propuesta ya no existe, o la propuesta ya estaba descartada */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    anularPropuesta: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudAnulacion"];
            };
        };
        responses: {
            /** @description Propuesta anulada */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PropuestaIngestaRespuesta"];
                };
            };
            /** @description Falta el motivo */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La propuesta no existe */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La propuesta no estaba aprobada */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    confirmarCierre: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                sectorId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudCierreCorte"];
            };
        };
        responses: {
            /** @description Cierre confirmado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorteRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El corte no existe */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El barrio no tiene cierre o ya estaba confirmado */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    cerrarSector: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                sectorId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudCierreCorte"];
            };
        };
        responses: {
            /** @description Barrio cerrado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorteRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El corte no existe */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El corte ya no está abierto o el barrio ya estaba cerrado */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    cerrar_2: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudCierreCorte"];
            };
        };
        responses: {
            /** @description Corte cerrado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorteRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El corte no existe */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El corte ya estaba cerrado */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    anularCorte: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudAnulacion"];
            };
        };
        responses: {
            /** @description Corte anulado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorteRespuesta"];
                };
            };
            /** @description Falta el motivo */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El corte no existe */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El corte ya estaba anulado */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    actualizarPerfil: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SolicitudPerfilVecino"];
            };
        };
        responses: {
            /** @description Perfil actualizado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PerfilVecinoRespuesta"];
                };
            };
            /** @description Nombre invalido o barrio inexistente */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PerfilVecinoRespuesta"];
                };
            };
        };
    };
    yo: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsuarioRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    listar: {
        parameters: {
            query?: {
                estado?: string;
                barrioId?: string;
                pagina?: number;
                tamano?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsuarioRespuesta"][];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    consultarMetricasDelSistema: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MetricasDelSistemaRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    listarPendientes: {
        parameters: {
            query?: {
                pagina?: number;
                tamano?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReporteModeracionRespuesta"][];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    salud: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Estado generado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SaludColectorRespuesta"][];
                };
            };
            /** @description Falta el token del veedor */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SaludColectorRespuesta"][];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    listarPendientes_1: {
        parameters: {
            query?: {
                pagina?: number;
                tamano?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Listado generado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PropuestaIngestaRespuesta"][];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    fallidos: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Listado generado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentoFallidoRespuesta"][];
                };
            };
            /** @description Falta el token del veedor */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentoFallidoRespuesta"][];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    fotoDelPanel: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                nombre: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La imagen (image/jpeg o image/png) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/jpeg": unknown;
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description Ningun reporte reclama esa foto */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": string;
                };
            };
        };
    };
    listarDisputas: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SectorRespuesta"][];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    consultar: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Corte encontrado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorteRespuesta"];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description No existe un corte con ese id */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    listarCortesVencidos: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorteRespuesta"][];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    auditoria: {
        parameters: {
            query?: {
                pagina?: number;
                tamano?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventoAuditoriaRespuesta"][];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    ultimasCopiasAnaliticas: {
        parameters: {
            query?: {
                limite?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Las copias, de la más reciente a la más antigua */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CopiaAnaliticaRespuesta"][];
                };
            };
            /** @description Sin sesión, token inválido, caducado o revocado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La sesión no tiene el permiso que exige esta operación */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La copia analítica está apagada o PostgreSQL no responde */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    yo_1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PerfilVecinoRespuesta"];
                };
            };
        };
    };
    getRequests: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Listado generado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Open311Response"][];
                };
            };
        };
    };
    modo: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ModoDelSistemaRespuesta"];
                };
            };
        };
    };
    listarSectores: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Listado generado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RespuestaSectores"];
                };
            };
        };
    };
    listar_1: {
        parameters: {
            query?: {
                pagina?: number;
                tamano?: number;
            };
            header?: never;
            path: {
                sectorId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Cortes de la página pedida */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorteRespuesta"][];
                };
            };
            /** @description No existe el sector */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    consultarSector: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sector encontrado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SectorRespuesta"];
                };
            };
            /** @description No existe un sector con ese id */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    streamSectores: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Tope de conexiones en vivo alcanzado; reintentar tras Retry-After */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    geometria: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Geometrías */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/geo+json": unknown;
                };
            };
        };
    };
    foto: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                nombre: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description La imagen (image/jpeg o image/png) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/jpeg": unknown;
                };
            };
            /** @description No hay una foto publica con ese nombre */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": string;
                };
            };
        };
    };
    globales: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EstadisticasRespuesta"];
                };
            };
        };
    };
    exportarCsv: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description CSV generado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/csv": string;
                };
            };
        };
    };
    global: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Índice calculado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IndiceCumplimientoRespuesta"];
                };
            };
            /** @description Todavía no hay cortes cerrados */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    serie: {
        parameters: {
            query?: {
                sectorId?: string;
                desde?: string;
                hasta?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Serie generada */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PuntoSerieRespuesta"][];
                };
            };
        };
    };
    serieCsv: {
        parameters: {
            query?: {
                sectorId?: string;
                desde?: string;
                hasta?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description CSV generado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/csv": string;
                };
            };
        };
    };
    porSector: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sectorId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Índice calculado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IndiceCumplimientoRespuesta"];
                };
            };
            /** @description El sector no tiene cortes cerrados todavía */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    porCorte: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                corteId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Índice calculado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IndiceCumplimientoRespuesta"];
                };
            };
            /** @description El corte no existe */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description El corte todavía no está cerrado */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    calidad: {
        parameters: {
            query?: {
                sectorId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Calidad calculada */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CalidadDelCumplimientoRespuesta"];
                };
            };
        };
    };
    listar_2: {
        parameters: {
            query?: {
                pagina?: number;
                tamano?: number;
                sectorId?: string;
                tipo?: "CORTE_ANUNCIADO" | "CORTE_CONFIRMADO_POR_CIUDADANOS" | "CORTE_RESTABLECIDO" | "CORTE_DETECTADO_POR_INGESTA";
                desde?: string;
                hasta?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Listado generado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventoBitacoraRespuesta"][];
                };
            };
            /** @description Tipo de evento desconocido, fecha mal formada o rango invertido */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    sustento: {
        parameters: {
            query?: {
                pagina?: number;
                tamano?: number;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Ids de la página pedida (vacía si se pasa del final) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": string[];
                };
            };
            /** @description No existe el evento */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    cumplimientoAnalitico: {
        parameters: {
            query?: {
                sectorId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Índice calculado */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CumplimientoAnaliticoRespuesta"];
                };
            };
            /** @description El barrio no existe en la copia */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
            /** @description La copia analítica está apagada, PostgreSQL no responde o todavía no hubo una primera copia */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
    cumplimientoAnaliticoMensual: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Serie calculada */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SerieMensualAnaliticaRespuesta"];
                };
            };
            /** @description La copia analítica está apagada, PostgreSQL no responde o todavía no hubo una primera copia */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetail"];
                };
            };
        };
    };
}
