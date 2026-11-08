package com.aguavigia.ctg.application;

import com.aguavigia.ctg.domain.CierreDeCorte;
import com.aguavigia.ctg.domain.CorteAgua;
import com.aguavigia.ctg.domain.FilaEventoAnalitico;
import com.aguavigia.ctg.domain.FilaReporteDiaAnalitica;
import com.aguavigia.ctg.domain.RegistroDeVigilancia;
import com.aguavigia.ctg.domain.ResultadoDeCopia;
import com.aguavigia.ctg.domain.Sector;
import com.aguavigia.ctg.domain.SectorId;
import com.aguavigia.ctg.domain.SumasDeBarrio;
import com.aguavigia.ctg.domain.VerificacionDeBitacora;
import com.aguavigia.ctg.domain.port.in.VigilarAnaliticaUseCase;
import com.aguavigia.ctg.domain.port.out.CorteAguaRepository;
import com.aguavigia.ctg.domain.port.out.IntegridadAnaliticaPort;
import com.aguavigia.ctg.domain.port.out.LectorDeBitacoraPort;
import com.aguavigia.ctg.domain.port.out.LectorDeReportesAgregadosPort;
import com.aguavigia.ctg.domain.port.out.RelojPort;
import com.aguavigia.ctg.domain.port.out.SectorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * El vigilante de la copia analítica (ADR-113). En cada revisión:
 * <ol>
 *   <li>agrega a la bitácora inmutable los eventos de Mongo que todavía no están (la base solo admite agregar);</li>
 *   <li>recorre la cadena de hashes y cuenta los eslabones que no cuadran;</li>
 *   <li>compara, barrio por barrio, cuatro sumas entre Mongo y PostgreSQL (pares, cierres, segundos de cierre y reportes) y cuenta las
 *       referencias colgantes: pares y reportes que apuntan a un barrio que no existe.</li>
 * </ol>
 * Avisa; no corrige nada. Es más fina que la comparación de totales de cada copia, que no ve un cierre movido de una hora a otra.
 * Una revisión que no pudo hacerse queda anotada como {@link ResultadoDeCopia#FALLIDA} si hay dónde anotarla.
 */
public class VigilarAnaliticaService implements VigilarAnaliticaUseCase {

    private static final Logger log = LoggerFactory.getLogger(VigilarAnaliticaService.class);
    private static final int BARRIOS_EN_EL_DETALLE = 8;

    private final SectorRepository sectores;
    private final CorteAguaRepository cortes;
    private final LectorDeReportesAgregadosPort reportes;
    private final LectorDeBitacoraPort bitacora;
    private final IntegridadAnaliticaPort integridad;
    private final RelojPort reloj;

    public VigilarAnaliticaService(SectorRepository sectores, CorteAguaRepository cortes, LectorDeReportesAgregadosPort reportes,
                                   LectorDeBitacoraPort bitacora, IntegridadAnaliticaPort integridad, RelojPort reloj) {
        this.sectores = sectores;
        this.cortes = cortes;
        this.reportes = reportes;
        this.bitacora = bitacora;
        this.integridad = integridad;
        this.reloj = reloj;
    }

    @Override
    public RegistroDeVigilancia vigilar() {
        Instant ahora = reloj.ahora();
        try {
            Set<String> yaEnBitacora = integridad.idsDeBitacora();
            List<FilaEventoAnalitico> nuevos = bitacora.todosEnOrden().stream().filter(e -> !yaEnBitacora.contains(e.id())).toList();
            if (!nuevos.isEmpty()) {
                integridad.anexarABitacora(nuevos, ahora);
            }
            VerificacionDeBitacora cadena = integridad.verificarCadena();

            List<Sector> catalogo = sectores.listarTodos();
            Set<SectorId> conocidos = new HashSet<>();
            catalogo.forEach(sector -> conocidos.add(sector.id()));
            List<String> colgantes = new ArrayList<>();
            Map<String, SumasDeBarrio> deMongo = sumasDeMongo(conocidos, colgantes);
            Map<String, SumasDeBarrio> deSql = integridad.sumasPorBarrio();

            List<String> descuadres = new ArrayList<>();
            for (Sector sector : catalogo) {
                String id = sector.id().valor();
                SumasDeBarrio enMongo = deMongo.getOrDefault(id, SumasDeBarrio.VACIAS);
                SumasDeBarrio enSql = deSql.getOrDefault(id, SumasDeBarrio.VACIAS);
                if (!enMongo.equals(enSql)) {
                    descuadres.add(id + " (Mongo " + resumen(enMongo) + " vs SQL " + resumen(enSql) + ")");
                }
            }

            int diferencias = descuadres.size() + colgantes.size();
            boolean sana = diferencias == 0 && cadena.cadenaValida();
            String detalle = sana ? null : detalleDe(descuadres, colgantes, cadena);
            if (!sana) {
                log.warn("El vigilante de la copia analítica encontró diferencias: {}", detalle);
            }
            return anotar(new RegistroDeVigilancia(0, ahora, sana ? ResultadoDeCopia.OK : ResultadoDeCopia.CON_DIFERENCIAS,
                    catalogo.size(), diferencias, cadena.eventos(), cadena.eslabonesRotos(), detalle));
        } catch (RuntimeException fallo) {
            log.warn("La revisión de la copia analítica falló: {}", fallo.toString());
            return anotar(new RegistroDeVigilancia(0, ahora, ResultadoDeCopia.FALLIDA, 0, 0, 0, 0, fallo.toString()));
        }
    }

    private Map<String, SumasDeBarrio> sumasDeMongo(Set<SectorId> conocidos, List<String> colgantes) {
        Map<String, SumasDeBarrio> sumas = new HashMap<>();
        for (CorteAgua corte : cortes.listarTodos()) {
            for (SectorId sector : corte.sectoresAfectados()) {
                if (!conocidos.contains(sector)) {
                    colgantes.add("par " + corte.id().valor() + " -> " + sector.valor());
                    continue;
                }
                CierreDeCorte cierre = corte.cierres().get(sector);
                sumas.merge(sector.valor(), SumasDeBarrio.VACIAS.conPar(cierre == null ? null : cierre.hora().getEpochSecond()),
                        (a, b) -> new SumasDeBarrio(a.pares() + b.pares(), a.cierres() + b.cierres(),
                                a.segundosDeCierre() + b.segundosDeCierre(), a.reportes()));
            }
        }
        Set<String> sectoresConReportesColgantes = new HashSet<>();
        for (FilaReporteDiaAnalitica fila : reportes.agregarPorDia()) {
            if (!conocidos.contains(new SectorId(fila.sectorId()))) {
                if (sectoresConReportesColgantes.add(fila.sectorId())) {
                    colgantes.add("reportes -> " + fila.sectorId());
                }
                continue;
            }
            sumas.merge(fila.sectorId(), SumasDeBarrio.VACIAS.conReportes(fila.cantidad()),
                    (a, b) -> new SumasDeBarrio(a.pares(), a.cierres(), a.segundosDeCierre(), a.reportes() + b.reportes()));
        }
        return sumas;
    }

    private static String resumen(SumasDeBarrio s) {
        return s.pares() + " pares, " + s.cierres() + " cierres, " + s.segundosDeCierre() + " s, " + s.reportes() + " reportes";
    }

    private static String detalleDe(List<String> descuadres, List<String> colgantes, VerificacionDeBitacora cadena) {
        StringBuilder detalle = new StringBuilder("Hay diferencias:");
        if (!descuadres.isEmpty()) {
            detalle.append(' ').append(descuadres.size()).append(" barrio(s) descuadran: ")
                    .append(String.join("; ", descuadres.subList(0, Math.min(BARRIOS_EN_EL_DETALLE, descuadres.size()))))
                    .append(descuadres.size() > BARRIOS_EN_EL_DETALLE ? "; …" : "").append('.');
        }
        if (!colgantes.isEmpty()) {
            detalle.append(' ').append(colgantes.size()).append(" referencia(s) colgante(s): ")
                    .append(String.join(", ", colgantes.subList(0, Math.min(BARRIOS_EN_EL_DETALLE, colgantes.size()))))
                    .append(colgantes.size() > BARRIOS_EN_EL_DETALLE ? ", …" : "").append('.');
        }
        if (!cadena.cadenaValida()) {
            detalle.append(" La cadena de la bitácora tiene ").append(cadena.eslabonesRotos()).append(" eslabón(es) roto(s).");
        }
        return detalle.toString();
    }

    private RegistroDeVigilancia anotar(RegistroDeVigilancia revision) {
        try {
            long id = integridad.registrarVigilancia(revision);
            return new RegistroDeVigilancia(id, revision.ejecutadaEn(), revision.resultado(), revision.barriosRevisados(),
                    revision.diferencias(), revision.eventosEnBitacora(), revision.eslabonesRotos(), revision.detalle());
        } catch (RuntimeException sinBase) {
            log.warn("No se pudo anotar la revisión de la copia analítica: {}", sinBase.toString());
            return revision;
        }
    }
}
