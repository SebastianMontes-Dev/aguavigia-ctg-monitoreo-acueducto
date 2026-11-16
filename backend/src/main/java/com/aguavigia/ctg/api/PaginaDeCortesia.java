package com.aguavigia.ctg.api;

import com.aguavigia.ctg.domain.ClaveEnClaro;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.util.HtmlUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * Las páginas que abre un navegador desde el enlace de un correo de cuenta (ADR-030). Sin plantilla externa ni
 * recursos de fuera: el correo apunta a la propia API porque no hay otro sitio que pinte estas pantallas. El único
 * JavaScript es el botón para ver la clave (ADR-115), autorizado por su hash y prescindible: sin él, el formulario
 * funciona igual. Se componen como el ingreso de la app (ADR-107, ADR-109, ADR-114): a la izquierda
 * la presentación teñida de cardenillo con los pasos, a la derecha la tarea. Colores de DESIGN.md §3 y, en oscuro, del
 * grafito (§3.1).
 *
 * Todo texto variable se escapa aquí y no en quien llama: el mensaje de una excepción o el token de la URL acaban
 * dentro de HTML y una sola omisión sería un XSS reflejado. Las claves nunca vuelven a la página.
 */
final class PaginaDeCortesia {

    private static final MediaType HTML_UTF8 = new MediaType("text", "html", StandardCharsets.UTF_8);

    /**
     * `same-origin` y no `no-referrer` (hotfix 1.0.1): con `no-referrer` el navegador manda `Origin: null` en el POST
     * del formulario, la cadena de CORS lo toma por otro origen y responde 403 «Invalid CORS request», así que ningún
     * formulario de estas páginas llegaba al caso de uso. `same-origin` tampoco manda la URL con el token a otro sitio.
     */
    static final String POLITICA_DE_REFERENCIA = "same-origin";

    /**
     * Muestra el botón del ojo (sale con `hidden`, para que sin JavaScript no haya un botón que no hace nada) y alterna
     * el campo entre `password` y `text`. Va en línea porque la página no carga nada de fuera.
     */
    static final String SCRIPT_VER_CLAVE = """
            for (const boton of document.querySelectorAll('button.ver')) {
              const campo = document.getElementById(boton.getAttribute('aria-controls'));
              if (!campo) continue;
              boton.hidden = false;
              boton.addEventListener('click', () => {
                const mostrar = campo.type === 'password';
                campo.type = mostrar ? 'text' : 'password';
                boton.setAttribute('aria-pressed', String(mostrar));
                boton.setAttribute('aria-label', mostrar ? 'Ocultar la clave' : 'Mostrar la clave');
              });
            }
            """;

    /**
     * La CSP de la cadena de seguridad (`SecurityConfig`) no admite scripts. Las páginas que piden clave ponen la suya,
     * igual de cerrada, más el hash de {@link #SCRIPT_VER_CLAVE}: solo ese script exacto puede ejecutarse, sin abrir
     * `unsafe-inline`. La cadena no pisa una CSP que la respuesta ya trae, igual que con `Referrer-Policy`.
     */
    static final String POLITICA_CSP_CON_SCRIPT = "default-src 'none'; style-src 'unsafe-inline'; script-src '"
            + hashCsp(SCRIPT_VER_CLAVE) + "'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

    /** Un paso de la presentación: lo que pasa, en palabras de quien lo vive. */
    record Paso(String titulo, String detalle) {
    }

    /**
     * La mitad izquierda. {@code pasoActual} es el índice del paso en curso; los anteriores salen hechos. Con un índice
     * igual al número de pasos, todos salen hechos.
     */
    record Presentacion(String rotulo, String titular, String entrada, List<Paso> pasos, int pasoActual) {
    }

    /** Un enlace hacia la app, para salir de la página cuando la tarea terminó. */
    record Enlace(String texto, String url) {
    }

    /**
     * Lo que salió mal en un campo del formulario, junto a ese campo. Un enlace que ya no sirve no es un error de campo:
     * no hay nada que reintentar con él y va a {@link #fallo}.
     */
    record Errores(String clave, String confirmacion) {
        static final Errores NINGUNO = new Errores(null, null);

        static Errores deLaClave(String mensaje) {
            return new Errores(mensaje, null);
        }

        static Errores deLaConfirmacion(String mensaje) {
            return new Errores(null, mensaje);
        }

        boolean hay() {
            return clave != null || confirmacion != null;
        }
    }

    /** Lo que pide el formulario de la derecha y adónde lo manda. */
    record Formulario(String accion, String token, String titulo, String bajada, String textoBoton, String nota,
                      boolean pideClave) {
    }

    private static final String PLANTILLA = """
            <!doctype html>
            <html lang="es-CO">
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="color-scheme" content="light dark">
            <meta name="referrer" content="{{politica}}">
            <title>{{titulo}} · AguaVigía CTG</title>
            <style>
              :root {
                color-scheme: light dark;
                --papel: #f5f5f2; --tarjeta: #ffffff; --elevada: #ffffff;
                --tinta: #15191c; --tinta-2: #4a5157; --tinta-3: #7b838a;
                --linea: #dddcd6; --linea-suave: #e9e8e3;
                --cardenillo: #2f5f57; --sobre-cardenillo: #ffffff; --laton: #836430;
                --fuente-marca: 'Newsreader', Georgia, 'Times New Roman', serif;
                --fuente-cuerpo: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                --margen: clamp(16px, 3vw, 40px);
                --suave: cubic-bezier(.2, .8, .2, 1);
              }
              @media (prefers-color-scheme: dark) {
                :root {
                  --papel: #111719; --tarjeta: #1a1f22; --elevada: #242c2f;
                  --tinta: #f1f4f2; --tinta-2: #b1bbbd; --tinta-3: #7e888c;
                  --linea: #354044; --linea-suave: #283135;
                  --cardenillo: #8cc8b8; --sobre-cardenillo: #111719; --laton: #c9a567;
                }
              }
              * { box-sizing: border-box; }
              body { margin: 0; background: var(--papel); color: var(--tinta); font-family: var(--fuente-cuerpo); font-size: 1rem; line-height: 1.5; }
              .oculto { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

              .pantalla { display: grid; min-height: 100vh; min-height: 100dvh; }
              .lado { display: grid; grid-template-rows: auto 1fr auto; gap: 2rem; padding: 2rem var(--margen); border-bottom: 1px solid var(--linea);
                      background: var(--tarjeta); background: color-mix(in srgb, var(--cardenillo) 8%, var(--tarjeta)); }
              .marca { display: inline-flex; align-items: baseline; gap: .5rem; margin: 0; font-family: var(--fuente-marca); font-size: 1.75rem; font-weight: 500; letter-spacing: -.01em; }
              .rotulo { font-family: var(--fuente-cuerpo); font-size: .75rem; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--tinta-2); }
              .presentacion { display: grid; gap: 1rem; align-content: center; max-width: 30rem; }
              .filete { width: 56px; height: 3px; border-radius: 999px; background: var(--laton); }
              h1 { margin: 0; font-family: var(--fuente-marca); font-weight: 400; font-size: clamp(2.25rem, 4.6vw, 4.25rem); line-height: 1.02; letter-spacing: -.02em; text-wrap: balance; }
              .entrada { margin: 0; font-size: 1.25rem; color: var(--tinta-2); text-wrap: pretty; }
              .cierre { display: grid; gap: 1rem; }
              .pasos { display: grid; max-width: 30rem; margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--linea); }
              .pasos li { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: .75rem; padding: .75rem 0; font-size: .9375rem; color: var(--tinta-2); }
              .pasos li + li { border-top: 1px solid var(--linea-suave); }
              .pasos strong { display: block; color: var(--tinta); font-weight: 600; }
              .numero { display: grid; place-items: center; width: 28px; height: 28px; border: 1px solid var(--tinta-3); border-radius: 999px; color: var(--tinta); font-size: .75rem; font-weight: 600; font-variant-numeric: tabular-nums; }
              .pasos [aria-current] .numero { border-color: var(--cardenillo); background: var(--cardenillo); color: var(--sobre-cardenillo); }
              .pie-lado { margin: 0; font-size: .8125rem; color: var(--tinta-2); }

              .tarea { display: grid; align-content: center; padding: 2rem var(--margen) 4rem; }
              .formulario { display: grid; gap: 1.5rem; width: 100%; max-width: 420px; margin-inline: auto; }
              h2 { margin: 0; font-size: 1.25rem; font-weight: 600; line-height: 1.3; }
              .bajada { margin: -.75rem 0 0; color: var(--tinta-2); font-size: .9375rem; }
              .campos { display: grid; gap: 1.25rem; }
              .campo { display: grid; gap: .5rem; }
              label { font-size: .9375rem; font-weight: 600; }
              .caja { display: flex; align-items: center; gap: .25rem; min-height: 48px; padding: 0 1px 0 1rem; border: 1px solid var(--tinta-3); border-radius: 999px;
                      background: var(--elevada); }
              .caja:focus-within { outline: 2px solid var(--laton); outline-offset: 2px; }
              .caja[data-invalido] { border: 2px solid var(--tinta); padding-left: calc(1rem - 1px); padding-right: 0; }
              .caja input { flex: 1; min-width: 0; min-height: 44px; padding: 0; border: 0; background: transparent; color: var(--tinta); font: inherit; font-size: 1.0625rem;
                            outline: none; }
              .ver { display: grid; place-items: center; flex: none; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 999px; background: none;
                     color: var(--tinta-2); cursor: pointer; }
              .ver[hidden] { display: none; }
              .ver:hover { color: var(--tinta); }
              .ver:focus-visible { outline: 2px solid var(--laton); outline-offset: -2px; }
              .ver svg { width: 22px; height: 22px; }
              .ver .tachado { display: none; }
              .ver[aria-pressed=true] .tachado { display: inline; }
              .ayuda { margin: 0; font-size: .8125rem; color: var(--tinta-2); }
              .error { display: flex; gap: .5rem; margin: 0; font-size: .9375rem; font-weight: 600; color: var(--tinta); }
              .error::before { content: '!'; display: grid; place-items: center; flex: none; width: 18px; height: 18px; margin-top: 2px; border-radius: 999px;
                               background: var(--tinta); color: var(--papel); font-size: 12px; line-height: 1; }
              .aviso { display: grid; gap: .25rem; margin: 0; padding: .875rem 1rem; border: 1px solid var(--tinta-3); border-radius: 10px; font-size: .9375rem; color: var(--tinta-2); }
              .aviso.error { display: flex; align-items: flex-start; gap: .5rem; color: var(--tinta); }

              .boton { display: inline-flex; align-items: center; justify-content: space-between; gap: .75rem; width: 100%; min-height: 50px; padding: 0 1.5rem;
                       border: 0; border-radius: 999px; background: var(--cardenillo); color: var(--sobre-cardenillo); font: inherit; font-weight: 600; text-decoration: none; cursor: pointer; }
              .boton:hover { box-shadow: inset 0 0 0 2px var(--sobre-cardenillo); }
              .boton:focus-visible { outline: 2px solid var(--laton); outline-offset: 3px; }
              .enlace { color: var(--tinta); text-decoration: underline; text-decoration-color: var(--tinta-3); text-underline-offset: 3px; }
              .enlace:hover { text-decoration-color: var(--laton); }
              .enlace:focus-visible { outline: 2px solid var(--laton); outline-offset: 2px; }
              .nota { margin: 0; padding-top: 1rem; border-top: 1px solid var(--linea); font-size: .875rem; color: var(--tinta-2); }
              .listo { justify-items: start; gap: 1rem; }
              .listo .bajada { margin: 0; }
              .marca-listo { width: 48px; height: 48px; color: var(--cardenillo); }

              @media (min-width: 56.25em) {
                .pantalla { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
                .lado { padding: 2rem clamp(40px, 5vw, 88px); border-bottom: 0; border-right: 1px solid var(--linea); }
                .tarea { padding-inline: clamp(24px, 5vw, 88px); }
              }
              @media (max-width: 56.1875em) {
                .pantalla { align-content: start; }
                .lado { grid-template-rows: auto auto; gap: 1rem; padding-block: 1.5rem; }
                .cierre { display: none; }
                h1 { font-size: clamp(2rem, 9vw, 2.75rem); }
                .tarea { align-content: start; padding-top: 1.5rem; }
              }
              /* identidad.md §5: la tarea entra escalonada al abrir el enlace. Cuando la página vuelve con un error, no: el
                 error tiene que leerse en cuanto llega. */
              @media (prefers-reduced-motion: no-preference) {
                [data-entrada] .formulario > * { animation: entrar 560ms var(--suave) both; }
                [data-entrada] .formulario > :nth-child(2) { animation-delay: 50ms; }
                [data-entrada] .formulario > :nth-child(3) { animation-delay: 100ms; }
                [data-entrada] .formulario > :nth-child(4) { animation-delay: 150ms; }
                [data-entrada] .formulario > :nth-child(n+5) { animation-delay: 200ms; }
                @keyframes entrar { from { opacity: 0; transform: translateY(10px); } }
                .boton span { transition: transform 320ms var(--suave); }
                .boton:hover span { transform: translateX(4px); }
              }
            </style>
            </head>
            <body>
              <main class="pantalla"{{entrada-animada}}>
                <section class="lado" aria-label="Presentación">
                  <p class="marca">AguaVigía <span class="rotulo">Cartagena</span></p>
                  <div class="presentacion">
                    <span class="filete" aria-hidden="true"></span>
                    <span class="rotulo">{{rotulo}}</span>
                    <h1>{{titular}}</h1>
                    <p class="entrada">{{entrada}}</p>
                  </div>
                  <div class="cierre">
                    <ol class="pasos" aria-label="Pasos">{{pasos}}
                    </ol>
                    <p class="pie-lado">Este enlace sirve una sola vez.</p>
                  </div>
                </section>
                <section class="tarea">
            {{tarea}}
                </section>
              </main>{{script}}
            </body>
            </html>
            """;

    private static final String MARCA_LISTO = """
                  <svg class="marca-listo" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <circle cx="24" cy="24" r="22"/><path d="M14.5 24.5l6.5 6.5 13-14" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>""";

    /** El ojo, con una raya encima cuando la clave está a la vista (el botón entonces la oculta). */
    private static final String OJO = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\""
            + " stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\">"
            + "<path d=\"M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>"
            + "<path class=\"tachado\" d=\"M4 4l16 16\"/></svg>";

    private PaginaDeCortesia() {
    }

    /**
     * Formulario que hace `POST` a la acción llevando el token en un campo oculto. El `GET` que lo muestra no consume
     * nada: los antivirus de correo precargan los enlaces, y un enlace de un solo uso que actúa con solo abrirse quedaría
     * gastado antes de que la persona lo vea. Si pide clave, la pide dos veces (ADR-114) y la compara el servidor, que no
     * depende de que el navegador ejecute el script del ojo (ADR-115).
     *
     * @param estado 200 al mostrarlo por primera vez, 400 al volver a mostrarlo con un error
     */
    static ResponseEntity<String> formulario(HttpStatus estado, Presentacion presentacion, Formulario formulario,
                                             Errores errores) {
        StringBuilder tarea = new StringBuilder()
                .append("      <form class=\"formulario\" method=\"post\" action=\"").append(escapar(formulario.accion()))
                .append("\">\n")
                .append("        <h2>").append(escapar(formulario.titulo())).append("</h2>\n")
                .append("        <p class=\"bajada\">").append(escapar(formulario.bajada())).append("</p>\n");
        tarea.append("        <input type=\"hidden\" name=\"token\" value=\"").append(escapar(formulario.token()))
                .append("\">\n");
        if (formulario.pideClave()) {
            tarea.append("        <div class=\"campos\">\n")
                    .append(campoDeClave("clave", "Clave nueva",
                            "Al menos " + ClaveEnClaro.LONGITUD_MINIMA
                                    + " caracteres, una mayúscula y un signo como # o !.", errores.clave()))
                    .append(campoDeClave("confirmacion", "Repite la clave",
                            "Escríbela igual, para confirmar que es la que quieres.", errores.confirmacion()))
                    .append("        </div>\n");
        }
        tarea.append("        <button class=\"boton\" type=\"submit\">").append(escapar(formulario.textoBoton()))
                .append(" <span aria-hidden=\"true\">→</span></button>\n");
        if (formulario.nota() != null) {
            tarea.append("        <p class=\"nota\">").append(escapar(formulario.nota())).append("</p>\n");
        }
        tarea.append("      </form>");
        String titulo = errores.hay() ? "Revisa los datos" : presentacion.titular();
        return respuesta(estado, titulo, presentacion, tarea.toString(), formulario.pideClave());
    }

    /**
     * La tarea terminó bien: la marca de listo, el mensaje y los enlaces para seguir en la app. El primero va como botón
     * principal y los demás como enlaces de texto.
     */
    static ResponseEntity<String> listo(Presentacion presentacion, String titulo, String mensaje, List<Enlace> enlaces) {
        StringBuilder tarea = new StringBuilder()
                .append("      <div class=\"formulario listo\">\n").append(MARCA_LISTO).append('\n')
                .append("        <h2>").append(escapar(titulo)).append("</h2>\n")
                .append("        <p class=\"bajada\">").append(escapar(mensaje)).append("</p>\n");
        for (int i = 0; i < enlaces.size(); i++) {
            Enlace enlace = enlaces.get(i);
            if (i == 0) {
                tarea.append("        <a class=\"boton\" href=\"").append(escapar(enlace.url())).append("\">")
                        .append(escapar(enlace.texto())).append(" <span aria-hidden=\"true\">→</span></a>\n");
            } else {
                tarea.append("        <p>").append(enlace(enlace)).append("</p>\n");
            }
        }
        tarea.append("      </div>");
        return respuesta(HttpStatus.OK, presentacion.titular(), presentacion, tarea.toString(), false);
    }

    /**
     * El enlace ya no sirve (vencido, ya usado, inexistente): con ese token no hay nada que reintentar, así que no hay
     * formulario. El motivo que da el caso de uso y un botón para pedir otro.
     */
    static ResponseEntity<String> fallo(Presentacion presentacion, String titulo, String motivo, Enlace ayuda) {
        String tarea = "      <div class=\"formulario\">\n"
                + "        <h2>" + escapar(titulo) + "</h2>\n"
                + "        <p class=\"aviso error\" role=\"alert\">" + escapar(motivo) + "</p>\n"
                + "        <a class=\"boton\" href=\"" + escapar(ayuda.url()) + "\">" + escapar(ayuda.texto())
                + " <span aria-hidden=\"true\">→</span></a>\n"
                + "      </div>";
        return respuesta(HttpStatus.BAD_REQUEST, titulo, presentacion, tarea, false);
    }

    private static String campoDeClave(String id, String etiqueta, String ayuda, String error) {
        String descripcion = error != null
                ? "<p class=\"error\" id=\"" + id + "-ayuda\">" + escapar(error) + "</p>"
                : "<p class=\"ayuda\" id=\"" + id + "-ayuda\">" + escapar(ayuda) + "</p>";
        return "          <div class=\"campo\">\n"
                + "            <label for=\"" + id + "\">" + etiqueta + "</label>\n"
                + "            <div class=\"caja\"" + (error != null ? " data-invalido" : "") + ">\n"
                + "              <input id=\"" + id + "\" name=\"" + id + "\" type=\"password\" autocomplete=\"new-password\""
                + " minlength=\"" + ClaveEnClaro.LONGITUD_MINIMA + "\" maxlength=\"" + ClaveEnClaro.LONGITUD_MAXIMA + "\""
                + " required aria-describedby=\"" + id + "-ayuda\""
                + (error != null ? " aria-invalid=\"true\"" : "") + ">\n"
                + "              <button class=\"ver\" type=\"button\" aria-controls=\"" + id + "\" aria-pressed=\"false\""
                + " aria-label=\"Mostrar la clave\" hidden>" + OJO + "</button>\n"
                + "            </div>\n"
                + "            " + descripcion + "\n"
                + "          </div>\n";
    }

    private static String pasos(Presentacion presentacion) {
        List<Paso> pasos = presentacion.pasos();
        return IntStream.range(0, pasos.size()).mapToObj(i -> {
            Paso paso = pasos.get(i);
            boolean hecho = i < presentacion.pasoActual();
            boolean actual = i == presentacion.pasoActual();
            return "\n          <li" + (actual ? " aria-current=\"step\"" : "") + ">"
                    + "<span class=\"numero\" aria-hidden=\"true\">" + (hecho ? "✓" : String.valueOf(i + 1)) + "</span>"
                    + "<span>" + (hecho ? "<span class=\"oculto\">Hecho: </span>" : "")
                    + "<strong>" + escapar(paso.titulo()) + "</strong>" + escapar(paso.detalle()) + "</span></li>";
        }).collect(Collectors.joining());
    }

    private static String enlace(Enlace enlace) {
        return "<a class=\"enlace\" href=\"" + escapar(enlace.url()) + "\">" + escapar(enlace.texto()) + "</a>";
    }

    private static ResponseEntity<String> respuesta(HttpStatus estado, String titulo, Presentacion presentacion,
                                                    String tarea, boolean conScript) {
        // {{script}} antes que los textos variables: un token que diga «{{script}}» no debe convertirse en un script.
        String html = PLANTILLA
                .replace("{{script}}", conScript ? "\n  <script>" + SCRIPT_VER_CLAVE + "</script>" : "")
                .replace("{{politica}}", POLITICA_DE_REFERENCIA)
                .replace("{{entrada-animada}}", estado == HttpStatus.OK ? " data-entrada" : "")
                .replace("{{titulo}}", escapar(titulo))
                .replace("{{rotulo}}", escapar(presentacion.rotulo()))
                .replace("{{titular}}", escapar(presentacion.titular()))
                .replace("{{entrada}}", escapar(presentacion.entrada()))
                .replace("{{pasos}}", pasos(presentacion))
                .replace("{{tarea}}", tarea);
        // no-store: la página puede llevar un token de un solo uso en el HTML.
        ResponseEntity.BodyBuilder cuerpo = ResponseEntity.status(estado)
                .contentType(HTML_UTF8)
                .cacheControl(CacheControl.noStore())
                .header("Referrer-Policy", POLITICA_DE_REFERENCIA);
        if (conScript) {
            cuerpo.header("Content-Security-Policy", POLITICA_CSP_CON_SCRIPT);
        }
        return cuerpo.body(html);
    }

    /** El valor `sha256-…` de CSP para un script en línea: SHA-256 de su texto exacto en UTF-8, en Base64. */
    static String hashCsp(String script) {
        try {
            byte[] resumen = MessageDigest.getInstance("SHA-256").digest(script.getBytes(StandardCharsets.UTF_8));
            return "sha256-" + Base64.getEncoder().encodeToString(resumen);
        } catch (NoSuchAlgorithmException imposible) {
            throw new IllegalStateException("La JVM no trae SHA-256", imposible);
        }
    }

    private static String escapar(String texto) {
        return HtmlUtils.htmlEscape(texto == null ? "" : texto, "UTF-8");
    }
}
