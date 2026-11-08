package com.aguavigia.ctg.infrastructure.persistence.mongo;

import com.aguavigia.ctg.domain.FilaReporteDiaAnalitica;
import com.aguavigia.ctg.domain.port.out.LectorDeReportesAgregadosPort;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOptions;
import org.springframework.data.mongodb.core.aggregation.ConditionalOperators;
import org.springframework.data.mongodb.core.aggregation.DateOperators;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Cuenta los reportes en la propia base de Mongo (ADR-112): una fila por barrio, día de Cartagena, tipo y estado de moderación. Solo
 * lectura. Los reportes anteriores a M5 no traen estado de moderación y el dominio los lee como aprobados; aquí igual.
 */
@Component
public class ReportesAgregadosMongoAdapter implements LectorDeReportesAgregadosPort {

    private static final String ZONA = "America/Bogota";

    private final MongoTemplate mongoTemplate;

    public ReportesAgregadosMongoAdapter(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public List<FilaReporteDiaAnalitica> agregarPorDia() {
        Aggregation conteo = Aggregation.newAggregation(
                Aggregation.project("sectorId", "tipo")
                        .and(DateOperators.dateOf("timestamp")
                                .withTimezone(DateOperators.Timezone.valueOf(ZONA)).toString("%Y-%m-%d")).as("dia")
                        .and(ConditionalOperators.ifNull("estadoModeracion").then("APROBADO")).as("estado"),
                Aggregation.group("sectorId", "dia", "tipo", "estado").count().as("cantidad"))
                .withOptions(AggregationOptions.builder().allowDiskUse(true).build());

        return mongoTemplate.aggregate(conteo, ReporteCiudadanoDocumento.class, Document.class).getMappedResults().stream()
                .map(resultado -> {
                    // Con varias claves de grupo Mongo las anida en `_id`; Spring Data a veces las sube al nivel del resultado.
                    Document campos = resultado.get("_id") instanceof Document anidado ? anidado : resultado;
                    return new FilaReporteDiaAnalitica(campos.getString("sectorId"), LocalDate.parse(campos.getString("dia")),
                            campos.getString("tipo"), campos.getString("estado"), ((Number) resultado.get("cantidad")).intValue());
                })
                .toList();
    }
}
