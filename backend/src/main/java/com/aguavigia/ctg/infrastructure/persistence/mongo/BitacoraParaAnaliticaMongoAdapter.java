package com.aguavigia.ctg.infrastructure.persistence.mongo;

import com.aguavigia.ctg.domain.FilaEventoAnalitico;
import com.aguavigia.ctg.domain.port.out.LectorDeBitacoraPort;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Lee la bitácora pública entera, del evento más antiguo al más reciente, para la copia inmutable (ADR-113). Solo lectura. El orden por
 * instante y, a igualdad, por id es el que fija la cadena de hashes la primera vez; después solo se agregan los que faltan.
 */
@Component
public class BitacoraParaAnaliticaMongoAdapter implements LectorDeBitacoraPort {

    private final MongoTemplate mongoTemplate;

    public BitacoraParaAnaliticaMongoAdapter(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public List<FilaEventoAnalitico> todosEnOrden() {
        Query todos = new Query().with(Sort.by(Sort.Order.asc("timestamp"), Sort.Order.asc("_id")));
        return mongoTemplate.find(todos, EventoBitacoraDocumento.class).stream()
                .map(documento -> new FilaEventoAnalitico(documento.getId(), documento.getTipo(), documento.getSectorId(),
                        documento.getCorteId(), documento.getTimestamp(), documento.getDescripcion(), documento.getEstado(),
                        documento.getFuente()))
                .toList();
    }
}
