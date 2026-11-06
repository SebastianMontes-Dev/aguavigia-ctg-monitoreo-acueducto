package com.aguavigia.ctg.domain.port.out;

import com.aguavigia.ctg.domain.CorteAgua;
import com.aguavigia.ctg.domain.Dispositivo;
import com.aguavigia.ctg.domain.EventoBitacora;
import com.aguavigia.ctg.domain.ReporteCiudadano;
import com.aguavigia.ctg.domain.ResumenDeDatosSinteticos;

import java.util.List;

/**
 * Dónde se guardan los datos sintéticos (ADR-111). Inserta por lotes —60 000 reportes uno a uno serían 60 000 viajes a la
 * base— y deja cada documento marcado como sintético. Solo agrega: nunca modifica ni borra lo que ya existe.
 */
public interface AlmacenDeDatosSinteticosPort {

    void insertarDispositivos(List<Dispositivo> dispositivos);

    void insertarReportes(List<ReporteCiudadano> reportes);

    void insertarCortes(List<CorteAgua> cortes);

    void insertarEventos(List<EventoBitacora> eventos);

    /** Cuántos documentos marcados como sintéticos hay en cada colección. */
    ResumenDeDatosSinteticos contar();
}
