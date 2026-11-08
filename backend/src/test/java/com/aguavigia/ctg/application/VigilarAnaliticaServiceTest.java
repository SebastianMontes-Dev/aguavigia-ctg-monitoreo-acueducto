package com.aguavigia.ctg.application;

import com.aguavigia.ctg.domain.CierreDeCorte;
import com.aguavigia.ctg.domain.CorteAgua;
import com.aguavigia.ctg.domain.CorteId;
import com.aguavigia.ctg.domain.EstadoCorte;
import com.aguavigia.ctg.domain.FilaEventoAnalitico;
import com.aguavigia.ctg.domain.FilaReporteDiaAnalitica;
import com.aguavigia.ctg.domain.OrigenCorte;
import com.aguavigia.ctg.domain.OrigenEstado;
import com.aguavigia.ctg.domain.RegistroDeVigilancia;
import com.aguavigia.ctg.domain.ResultadoDeCopia;
import com.aguavigia.ctg.domain.Sector;
import com.aguavigia.ctg.domain.SectorId;
import com.aguavigia.ctg.domain.SumasDeBarrio;
import com.aguavigia.ctg.domain.VerificacionDeBitacora;
import com.aguavigia.ctg.domain.port.out.CorteAguaRepository;
import com.aguavigia.ctg.domain.port.out.IntegridadAnaliticaPort;
import com.aguavigia.ctg.domain.port.out.LectorDeBitacoraPort;
import com.aguavigia.ctg.domain.port.out.LectorDeReportesAgregadosPort;
import com.aguavigia.ctg.domain.port.out.SectorRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class VigilarAnaliticaServiceTest {

    private static final Instant AHORA = Instant.parse("2026-11-06T15:00:00Z");
    private static final Instant INICIO = Instant.parse("2026-11-01T10:00:00Z");
    private static final Instant CIERRE = INICIO.plus(3, ChronoUnit.HOURS);

    private SectorRepository sectores;
    private CorteAguaRepository cortes;
    private LectorDeReportesAgregadosPort reportes;
    private LectorDeBitacoraPort bitacora;
    private IntegridadAnaliticaPort integridad;
    private VigilarAnaliticaService servicio;

    @BeforeEach
    void preparar() {
        sectores = mock(SectorRepository.class);
        cortes = mock(CorteAguaRepository.class);
        reportes = mock(LectorDeReportesAgregadosPort.class);
        bitacora = mock(LectorDeBitacoraPort.class);
        integridad = mock(IntegridadAnaliticaPort.class);
        servicio = new VigilarAnaliticaService(sectores, cortes, reportes, bitacora, integridad, () -> AHORA);
        when(sectores.listarTodos()).thenReturn(List.of(barrio("manga"), barrio("crespo")));
        when(integridad.idsDeBitacora()).thenReturn(Set.of());
        when(bitacora.todosEnOrden()).thenReturn(List.of());
        when(integridad.verificarCadena()).thenReturn(new VerificacionDeBitacora(0, 0, null));
        when(integridad.registrarVigilancia(any())).thenReturn(5L);
        when(reportes.agregarPorDia()).thenReturn(List.of());
        when(cortes.listarTodos()).thenReturn(List.of());
        when(integridad.sumasPorBarrio()).thenReturn(Map.of());
    }

    private static Sector barrio(String id) {
        return new Sector(new SectorId(id), "Barrio " + id, 100, null);
    }

    private static CorteAgua corteCerradoEn(String id, Instant cierre, String... barrios) {
        CorteAgua.Builder corte = CorteAgua.builder().id(new CorteId(id))
                .sectoresAfectados(java.util.Arrays.stream(barrios).map(SectorId::new).toList())
                .inicio(INICIO).finPrometido(INICIO.plus(2, ChronoUnit.HOURS)).causa("Mantenimiento")
                .origen(OrigenCorte.OFICIAL_ACUACAR).estado(EstadoCorte.RESTABLECIDO);
        corte.cierres(java.util.Arrays.stream(barrios).collect(java.util.stream.Collectors.toMap(SectorId::new,
                b -> new CierreDeCorte(cierre, OrigenEstado.ACUACAR, false))));
        return corte.build();
    }

    private static FilaEventoAnalitico evento(String id) {
        return new FilaEventoAnalitico(id, "CORTE_ANUNCIADO", "manga", null, INICIO, "Aviso " + id, null, null);
    }

    @Test
    void cuandoTodoCuadraDebeAnotarUnaRevisionOk() {
        when(cortes.listarTodos()).thenReturn(List.of(corteCerradoEn("c1", CIERRE, "manga")));
        when(reportes.agregarPorDia()).thenReturn(List.of(new FilaReporteDiaAnalitica("manga", LocalDate.of(2026, 11, 1), "SIN_AGUA", "APROBADO", 4)));
        when(integridad.sumasPorBarrio()).thenReturn(Map.of("manga", new SumasDeBarrio(1, 1, CIERRE.getEpochSecond(), 4)));

        RegistroDeVigilancia revision = servicio.vigilar();

        assertThat(revision.resultado()).isEqualTo(ResultadoDeCopia.OK);
        assertThat(revision.id()).isEqualTo(5L);
        assertThat(revision.barriosRevisados()).isEqualTo(2);
        assertThat(revision.diferencias()).isZero();
        assertThat(revision.detalle()).isNull();
    }

    @Test
    void soloDebeAnexarLosEventosQueLaBitacoraInmutableNoTiene() {
        when(integridad.idsDeBitacora()).thenReturn(Set.of("e1", "e2"));
        when(bitacora.todosEnOrden()).thenReturn(List.of(evento("e1"), evento("e2"), evento("e3"), evento("e4")));

        servicio.vigilar();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<FilaEventoAnalitico>> captor = ArgumentCaptor.forClass(List.class);
        verify(integridad).anexarABitacora(captor.capture(), any());
        assertThat(captor.getValue()).extracting(FilaEventoAnalitico::id).containsExactly("e3", "e4");
    }

    @Test
    void sinEventosNuevosNoDebeEscribirEnLaBitacora() {
        when(integridad.idsDeBitacora()).thenReturn(Set.of("e1"));
        when(bitacora.todosEnOrden()).thenReturn(List.of(evento("e1")));

        servicio.vigilar();

        verify(integridad, never()).anexarABitacora(any(), any());
    }

    @Test
    void unCierreMovidoDeUnaHoraAOtraDebeDelatarseAunqueLosConteosCuadren() {
        when(cortes.listarTodos()).thenReturn(List.of(corteCerradoEn("c1", CIERRE, "manga")));
        // SQL tiene el mismo número de pares y de cierres, pero el cierre una hora más tarde.
        when(integridad.sumasPorBarrio()).thenReturn(Map.of("manga", new SumasDeBarrio(1, 1, CIERRE.plusSeconds(3600).getEpochSecond(), 0)));

        RegistroDeVigilancia revision = servicio.vigilar();

        assertThat(revision.resultado()).isEqualTo(ResultadoDeCopia.CON_DIFERENCIAS);
        assertThat(revision.diferencias()).isEqualTo(1);
        assertThat(revision.detalle()).contains("manga").contains("Mongo").contains("SQL");
    }

    @Test
    void unReporteDeMasEnUnaDeLasBasesDebeDelatarse() {
        when(reportes.agregarPorDia()).thenReturn(List.of(new FilaReporteDiaAnalitica("crespo", LocalDate.of(2026, 11, 1), "SIN_AGUA", "APROBADO", 10)));
        when(integridad.sumasPorBarrio()).thenReturn(Map.of("crespo", new SumasDeBarrio(0, 0, 0, 9)));

        RegistroDeVigilancia revision = servicio.vigilar();

        assertThat(revision.resultado()).isEqualTo(ResultadoDeCopia.CON_DIFERENCIAS);
        assertThat(revision.detalle()).contains("crespo").contains("10 reportes").contains("9 reportes");
    }

    @Test
    void debeContarLasReferenciasColgantesDeParesYDeReportes() {
        when(cortes.listarTodos()).thenReturn(List.of(corteCerradoEn("c1", CIERRE, "manga", "fantasma")));
        when(reportes.agregarPorDia()).thenReturn(List.of(new FilaReporteDiaAnalitica("otro-fantasma", LocalDate.of(2026, 11, 1), "SIN_AGUA", "APROBADO", 2)));
        when(integridad.sumasPorBarrio()).thenReturn(Map.of("manga", new SumasDeBarrio(1, 1, CIERRE.getEpochSecond(), 0)));

        RegistroDeVigilancia revision = servicio.vigilar();

        assertThat(revision.resultado()).isEqualTo(ResultadoDeCopia.CON_DIFERENCIAS);
        assertThat(revision.diferencias()).isEqualTo(2);
        assertThat(revision.detalle()).contains("referencia(s) colgante(s)").contains("c1 -> fantasma").contains("reportes -> otro-fantasma");
    }

    @Test
    void unaCadenaRotaDebeHacerQueLaRevisionAvise() {
        when(integridad.verificarCadena()).thenReturn(new VerificacionDeBitacora(40, 2, "abc"));

        RegistroDeVigilancia revision = servicio.vigilar();

        assertThat(revision.resultado()).isEqualTo(ResultadoDeCopia.CON_DIFERENCIAS);
        assertThat(revision.eslabonesRotos()).isEqualTo(2);
        assertThat(revision.eventosEnBitacora()).isEqualTo(40);
        assertThat(revision.detalle()).contains("2 eslabón(es) roto(s)");
    }

    @Test
    void siLaBaseNoRespondeDebeAnotarUnaRevisionFallidaSinLanzar() {
        when(integridad.idsDeBitacora()).thenThrow(new com.aguavigia.ctg.domain.AnaliticaNoDisponibleException("sin PostgreSQL"));

        RegistroDeVigilancia revision = servicio.vigilar();

        assertThat(revision.resultado()).isEqualTo(ResultadoDeCopia.FALLIDA);
        assertThat(revision.detalle()).contains("sin PostgreSQL");
    }

    @Test
    void siTampocoSePuedeAnotarLaRevisionNoDebeLanzar() {
        when(integridad.registrarVigilancia(any())).thenThrow(new com.aguavigia.ctg.domain.AnaliticaNoDisponibleException("sin PostgreSQL"));

        RegistroDeVigilancia revision = servicio.vigilar();

        assertThat(revision.id()).isZero();
        assertThat(revision.resultado()).isEqualTo(ResultadoDeCopia.OK);
    }
}
