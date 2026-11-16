package com.aguavigia.ctg.domain;

import java.nio.charset.StandardCharsets;

/**
 * La contraseña tal como la escribe la persona, con la política del proyecto aplicada al construir.
 * Existe para que la política se cumpla en un solo sitio: registro, invitación y restablecimiento
 * pasan todos por aquí, así que no puede haber un camino que acepte una clave más débil que otro.
 *
 * La política la fijó el dueño del producto (ADR-115): al menos 9 caracteres, una mayúscula y un signo.
 * El resto son límites técnicos, no de fuerza: el tope de caracteres y de bytes (BCrypt) y los espacios
 * de los extremos, que casi siempre son un error al pegar.
 */
public record ClaveEnClaro(String valor) {

    public static final int LONGITUD_MINIMA = 9;
    public static final int LONGITUD_MAXIMA = 128;

    /**
     * BCrypt trunca en 72 bytes: sin este tope, dos claves largas que compartan los primeros 72
     * bytes serían la misma para el sistema. El máximo está por debajo en caracteres, pero un
     * carácter no ASCII ocupa varios bytes, así que se comprueba en bytes.
     */
    private static final int BYTES_MAXIMOS_BCRYPT = 72;

    public ClaveEnClaro {
        if (valor == null || valor.isBlank()) {
            throw new IllegalArgumentException("Escribe una clave");
        }
        if (valor.codePointCount(0, valor.length()) < LONGITUD_MINIMA) {
            throw new IllegalArgumentException(
                    "La clave debe tener al menos " + LONGITUD_MINIMA + " caracteres");
        }
        if (valor.codePointCount(0, valor.length()) > LONGITUD_MAXIMA) {
            throw new IllegalArgumentException(
                    "La clave no puede pasar de " + LONGITUD_MAXIMA + " caracteres");
        }
        if (valor.getBytes(StandardCharsets.UTF_8).length > BYTES_MAXIMOS_BCRYPT) {
            throw new IllegalArgumentException(
                    "La clave es demasiado larga para cifrarse de forma segura. Usa menos caracteres.");
        }
        if (valor.strip().length() != valor.length()) {
            throw new IllegalArgumentException("La clave no puede empezar ni terminar con espacios");
        }
        if (valor.codePoints().noneMatch(Character::isUpperCase)) {
            throw new IllegalArgumentException("Añade al menos una letra mayúscula a la clave");
        }
        if (valor.codePoints().noneMatch(ClaveEnClaro::esSigno)) {
            throw new IllegalArgumentException("Añade al menos un signo a la clave, como # o !");
        }
    }

    /** Un signo es lo que no es letra, cifra ni espacio: `#`, `!`, `-`, `*`, `¿`… */
    private static boolean esSigno(int caracter) {
        return !Character.isLetterOrDigit(caracter) && !Character.isWhitespace(caracter);
    }

    @Override
    public String toString() {
        return "ClaveEnClaro[oculta]";
    }
}
