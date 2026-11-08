package com.aguavigia.ctg.infrastructure.persistence.mongo;

import com.aguavigia.ctg.domain.CorteAgua;
import com.aguavigia.ctg.domain.Dispositivo;
import com.aguavigia.ctg.domain.EventoBitacora;
import com.aguavigia.ctg.domain.ReporteCiudadano;
import com.aguavigia.ctg.domain.ResumenDeDatosSinteticos;
import com.aguavigia.ctg.domain.port.out.AlmacenDeDatosSinteticosPort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;

/**
 * Guarda los datos sintéticos (ADR-111) por lotes y los marca con {@code sintetico: true}, con el mismo formato de documento
 * que usan los adaptadores reales (comparten el método {@code aDocumento}). Solo inserta: no modifica ni borra nada.
 */
@Component
public class DatosSinteticosMongoAdapter implements AlmacenDeDatosSinteticosPort {

    private final MongoTemplate mongoTemplate;

    public DatosSinteticosMongoAdapter(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public void insertarDispositivos(List<Dispositivo> dispositivos) {
        insertar(dispositivos, DispositivoDocumento.class, dispositivo -> {
            DispositivoDocumento documento = new DispositivoDocumento();
            documento.setId(DispositivoMongoAdapter.huella(dispositivo.id().valor()));
            documento.setCreadoEn(dispositivo.creadoEn());
            documento.setUltimoVisto(dispositivo.ultimoVisto());
            return documento;
        }, documento -> documento.setSintetico(true));
    }

    @Override
    public void insertarReportes(List<ReporteCiudadano> reportes) {
        insertar(reportes, ReporteCiudadanoDocumento.class, ReporteCiudadanoMongoAdapter::aDocumento,
                documento -> documento.setSintetico(true));
    }

    @Override
    public void insertarCortes(List<CorteAgua> cortes) {
        insertar(cortes, CorteAguaDocumento.class, CorteAguaMongoAdapter::aDocumento,
                documento -> documento.setSintetico(true));
    }

    @Override
    public void insertarEventos(List<EventoBitacora> eventos) {
        insertar(eventos, EventoBitacoraDocumento.class, EventoBitacoraMongoAdapter::aDocumento,
                documento -> documento.setSintetico(true));
    }

    @Override
    public ResumenDeDatosSinteticos contar() {
        Query sinteticos = Query.query(Criteria.where("sintetico").is(true));
        return new ResumenDeDatosSinteticos(
                mongoTemplate.count(sinteticos, DispositivoDocumento.class),
                mongoTemplate.count(sinteticos, ReporteCiudadanoDocumento.class),
                mongoTemplate.count(sinteticos, CorteAguaDocumento.class),
                mongoTemplate.count(sinteticos, EventoBitacoraDocumento.class),
                null);
    }

    private <D, T> void insertar(List<D> elementos, Class<T> clase, Function<D, T> aDocumento, Consumer<T> marcar) {
        if (elementos.isEmpty()) {
            return;
        }
        List<T> documentos = elementos.stream().map(aDocumento).peek(marcar).toList();
        mongoTemplate.insert(documentos, clase);
    }
}
