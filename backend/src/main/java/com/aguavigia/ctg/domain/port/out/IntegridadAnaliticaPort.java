package com.aguavigia.ctg.domain.port.out;

import com.aguavigia.ctg.domain.FilaEventoAnalitico;
import com.aguavigia.ctg.domain.RegistroDeVigilancia;
import com.aguavigia.ctg.domain.SumasDeBarrio;
import com.aguavigia.ctg.domain.VerificacionDeBitacora;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Lo que el vigilante necesita de la base analítica (ADR-113): agregar eventos a la bitácora inmutable (que solo admite agregar), leer las
 * sumas por barrio para compararlas con Mongo, comprobar la cadena de hashes y anotar cada revisión. Todo método puede lanzar
 * {@link com.aguavigia.ctg.domain.AnaliticaNoDisponibleException} si la base no responde.
 */
public interface IntegridadAnaliticaPort {

    /** Los ids de los eventos que la bitácora inmutable ya tiene. */
    Set<String> idsDeBitacora();

    /** Agrega, en este orden y en una sola transacción, los eventos que no estaban. Devuelve cuántos agregó. Nunca modifica ni borra. */
    int anexarABitacora(List<FilaEventoAnalitico> eventos, Instant copiadoEn);

    /** Cuántos pares, cierres, segundos de cierre y reportes tiene cada barrio en la copia. Los barrios sin nada no aparecen. */
    Map<String, SumasDeBarrio> sumasPorBarrio();

    /** Recorre la cadena de hashes y cuenta los eslabones que no cuadran. */
    VerificacionDeBitacora verificarCadena();

    /** Anota una revisión y devuelve su id. */
    long registrarVigilancia(RegistroDeVigilancia revision);
}
