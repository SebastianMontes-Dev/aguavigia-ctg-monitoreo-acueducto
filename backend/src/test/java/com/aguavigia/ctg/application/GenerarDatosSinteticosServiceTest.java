package com.aguavigia.ctg.application;

import com.aguavigia.ctg.domain.CorteAgua;
import com.aguavigia.ctg.domain.Dispositivo;
import com.aguavigia.ctg.domain.EstadoCorte;
import com.aguavigia.ctg.domain.EstadoModeracion;
import com.aguavigia.ctg.domain.EstadoServicio;
import com.aguavigia.ctg.domain.EventoBitacora;
import com.aguavigia.ctg.domain.GeometriaSector;
import com.aguavigia.ctg.domain.OrigenCorte;
import com.aguavigia.ctg.domain.PlanDeDatosSinteticos;
import com.aguavigia.ctg.domain.PoligonoGeoJson;
import com.aguavigia.ctg.domain.ReporteCiudadano;
import com.aguavigia.ctg.domain.ResumenDeDatosSinteticos;
import com.aguavigia.ctg.domain.Sector;
import com.aguavigia.ctg.domain.SectorId;
import com.aguavigia.ctg.domain.port.out.AlmacenDeDatosSinteticosPort;
import com.aguavigia.ctg.domain.port.out.GeometriaSectoresPort;
import com.aguavigia.ctg.domain.port.out.SectorRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GenerarDatosSinteticosServiceTest {

    private static final Instant AHORA = Instant.parse("2026-11-06T15:00:00Z");

    private final Almacen almacen = new Almacen();
    private final Map<SectorId, PoligonoGeoJson> poligonos = new HashMap<>();
    private GenerarDatosSinteticosService servicio;

    /** Un almacén en memoria que recuerda lo que se le insertó. */
    private static final class Almacen implements AlmacenDeDatosSinteticosPort {
        final List<Dispositivo> dispositivos = new ArrayList<>();
        final List<ReporteCiudadano> reportes = new ArrayList<>();
        final List<CorteAgua> cortes = new ArrayList<>();
        final List<EventoBitacora> eventos = new ArrayList<>();

        @Override public void insertarDispositivos(List<Dispositivo> lote) { dispositivos.addAll(lote); }
        @Override public void insertarReportes(List<ReporteCiudadano> lote) { reportes.addAll(lote); }
        @Override public void insertarCortes(List<CorteAgua> lote) { cortes.addAll(lote); }
        @Override public void insertarEventos(List<EventoBitacora> lote) { eventos.addAll(lote); }

        @Override
        public ResumenDeDatosSinteticos contar() {
            return new ResumenDeDatosSinteticos(dispositivos.size(), reportes.size(), cortes.size(), eventos.size(), null);
        }
    }

    @BeforeEach
    void preparar() {
        SectorRepository sectores = mock(SectorRepository.class);
        GeometriaSectoresPort geometrias = mock(GeometriaSectoresPort.class);
        List<Sector> catalogo = new ArrayList<>();
        List<GeometriaSector> formas = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            SectorId id = new SectorId("barrio-" + i);
            catalogo.add(new Sector(id, "Barrio " + i, 2000 + i * 900, EstadoServicio.CON_SERVICIO));
            double longitud = -75.60 + (i % 4) * 0.03;
            double latitud = 10.30 + (i / 4) * 0.03;
            Map<String, Object> forma = Map.of("type", "Polygon", "coordinates", List.of(List.of(
                    List.of(longitud, latitud), List.of(longitud + 0.02, latitud), List.of(longitud + 0.02, latitud + 0.02),
                    List.of(longitud, latitud + 0.02), List.of(longitud, latitud))));
            formas.add(new GeometriaSector(id, "Barrio " + i, forma));
            poligonos.put(id, PoligonoGeoJson.de(forma));
        }
        when(sectores.listarTodos()).thenReturn(catalogo);
        when(geometrias.listar()).thenReturn(formas);
        servicio = new GenerarDatosSinteticosService(sectores, geometrias, almacen, () -> AHORA);
    }

    private static PlanDeDatosSinteticos plan(int reportes, int cortes, long semilla) {
        return new PlanDeDatosSinteticos(reportes, cortes, 300, 120, semilla);
    }

    @Test
    void debeGenerarLaCantidadPedidaDeReportesYCortes() {
        ResumenDeDatosSinteticos resumen = servicio.generar(plan(5000, 80, 42L));

        assertThat(almacen.reportes).hasSize(5000);
        assertThat(almacen.cortes).hasSize(80);
        assertThat(almacen.dispositivos).hasSize(300);
        assertThat(almacen.eventos).isNotEmpty();
        assertThat(resumen.reportes()).isEqualTo(5000);
        assertThat(resumen.cortes()).isEqualTo(80);
        assertThat(resumen.eventos()).isEqualTo(almacen.eventos.size());
        assertThat(resumen.semilla()).isEqualTo(42L);
    }

    @Test
    void debeRepetirExactamenteLoMismoConLaMismaSemilla() {
        servicio.generar(plan(800, 30, 99L));
        List<String> primera = almacen.reportes.stream()
                .map(r -> r.sectorId().valor() + r.timestamp() + r.tipo() + r.coordenada() + r.estadoModeracion() + r.redHash())
                .toList();
        List<Instant> iniciosPrimera = almacen.cortes.stream().map(c -> c.ventana().inicio()).toList();
        almacen.reportes.clear();
        almacen.cortes.clear();

        servicio.generar(plan(800, 30, 99L));

        assertThat(almacen.reportes.stream()
                .map(r -> r.sectorId().valor() + r.timestamp() + r.tipo() + r.coordenada() + r.estadoModeracion() + r.redHash())
                .toList()).isEqualTo(primera);
        assertThat(almacen.cortes.stream().map(c -> c.ventana().inicio()).toList()).isEqualTo(iniciosPrimera);
    }

    @Test
    void debeDarResultadosDistintosConSemillasDistintas() {
        servicio.generar(plan(500, 20, 1L));
        List<Instant> unos = almacen.reportes.stream().map(ReporteCiudadano::timestamp).toList();
        almacen.reportes.clear();

        servicio.generar(plan(500, 20, 2L));

        assertThat(almacen.reportes.stream().map(ReporteCiudadano::timestamp).toList()).isNotEqualTo(unos);
    }

    @Test
    void debeSortearUnaSemillaSiNoSeDa() {
        ResumenDeDatosSinteticos resumen = servicio.generar(new PlanDeDatosSinteticos(100, 5, 50, 30, null));

        assertThat(resumen.semilla()).isNotNull();
    }

    @Test
    void debeDejarCadaReporteEnElPasadoYDentroDelTtlDeUnAno() {
        servicio.generar(plan(4000, 60, 5L));

        Instant limite = AHORA.minus(Duration.ofDays(365));
        assertThat(almacen.reportes).allSatisfy(reporte -> {
            assertThat(reporte.timestamp()).isBefore(AHORA);
            assertThat(reporte.timestamp()).isAfter(limite);
        });
        assertThat(almacen.cortes).allSatisfy(corte -> assertThat(corte.ventana().inicio()).isBefore(AHORA));
        assertThat(almacen.eventos).allSatisfy(evento -> assertThat(evento.timestamp()).isBefore(AHORA));
    }

    @Test
    void debePonerCadaPuntoDentroDelPoligonoDeSuBarrio() {
        servicio.generar(plan(3000, 20, 8L));

        assertThat(almacen.reportes).allSatisfy(reporte -> {
            assertThat(reporte.coordenada()).isNotNull();
            // Los reportes reales se guardan con 3 decimales (≈ 110 m): el redondeo puede asomar apenas fuera del borde.
            PoligonoGeoJson poligono = poligonos.get(reporte.sectorId());
            boolean cerca = false;
            for (double dLat : new double[] {-0.0006, 0, 0.0006}) {
                for (double dLon : new double[] {-0.0006, 0, 0.0006}) {
                    cerca |= poligono.contiene(reporte.coordenada().latitud() + dLat, reporte.coordenada().longitud() + dLon);
                }
            }
            assertThat(cerca).as("cae en el barrio %s o a un redondeo de su borde", reporte.sectorId().valor()).isTrue();
        });
    }

    @Test
    void debeConcentrarMasReportesEnLosBarriosCalientesQueEnLosFrios() {
        servicio.generar(plan(6000, 0, 3L));

        Map<String, Long> porBarrio = almacen.reportes.stream()
                .collect(Collectors.groupingBy(r -> r.sectorId().valor(), Collectors.counting()));
        long mayor = porBarrio.values().stream().mapToLong(Long::longValue).max().orElse(0);
        long menor = IntStream.range(0, 12).mapToLong(i -> porBarrio.getOrDefault("barrio-" + i, 0L)).min().orElse(0);

        assertThat(mayor).isGreaterThan(menor * 2);
    }

    @Test
    void debeMezclarCortesRestablecidosVencidosYAnulados() {
        servicio.generar(plan(0, 400, 11L));

        Map<EstadoCorte, Long> porEstado = almacen.cortes.stream()
                .collect(Collectors.groupingBy(CorteAgua::estado, Collectors.counting()));
        assertThat(porEstado.keySet()).contains(EstadoCorte.RESTABLECIDO, EstadoCorte.EXPIRADO, EstadoCorte.ANULADO);
        assertThat(porEstado.get(EstadoCorte.RESTABLECIDO)).isGreaterThan(porEstado.get(EstadoCorte.ANULADO));
        assertThat(almacen.cortes).allSatisfy(corte -> assertThat(corte.origen()).isEqualTo(OrigenCorte.SINTETICO));
    }

    @Test
    void debeGenerarCortesQueSeCierranAntesATiempoOTarde() {
        servicio.generar(plan(0, 400, 21L));

        List<Long> desviacionesEnMinutos = almacen.cortes.stream()
                .filter(corte -> corte.estado() == EstadoCorte.RESTABLECIDO)
                .flatMap(corte -> corte.cierres().values().stream()
                        .map(cierre -> Duration.between(corte.ventana().finPrometido(), cierre.hora()).toMinutes()))
                .toList();
        assertThat(desviacionesEnMinutos).anyMatch(minutos -> minutos < -30);
        assertThat(desviacionesEnMinutos).anyMatch(minutos -> Math.abs(minutos) <= 10);
        assertThat(desviacionesEnMinutos).anyMatch(minutos -> minutos > 60);
    }

    @Test
    void debeDejarSinCerrarAlMenosUnBarrioEnUnCorteVencidoYSinCierresEnUnoAnulado() {
        servicio.generar(plan(0, 400, 31L));

        almacen.cortes.stream().filter(c -> c.estado() == EstadoCorte.EXPIRADO)
                .forEach(corte -> assertThat(corte.cierres()).hasSizeLessThan(corte.sectoresAfectados().size()));
        almacen.cortes.stream().filter(c -> c.estado() == EstadoCorte.ANULADO)
                .forEach(corte -> {
                    assertThat(corte.cierres()).isEmpty();
                    assertThat(corte.motivoAnulacion()).isNotBlank();
                });
    }

    @Test
    void debeAgruparBuenaParteDeLosReportesAlrededorDeSusCortes() {
        servicio.generar(plan(4000, 100, 17L));

        Map<String, List<CorteAgua>> cortesPorBarrio = new HashMap<>();
        almacen.cortes.stream().filter(c -> c.estado() != EstadoCorte.ANULADO).forEach(corte ->
                corte.sectoresAfectados().forEach(s ->
                        cortesPorBarrio.computeIfAbsent(s.valor(), k -> new ArrayList<>()).add(corte)));
        long dentroDeUnCorte = almacen.reportes.stream().filter(reporte ->
                cortesPorBarrio.getOrDefault(reporte.sectorId().valor(), List.of()).stream().anyMatch(corte ->
                        !reporte.timestamp().isBefore(corte.ventana().inicio())
                                && reporte.timestamp().isBefore(corte.ventana().inicio().plus(Duration.ofHours(60))))).count();

        assertThat(dentroDeUnCorte).isGreaterThan(almacen.reportes.size() * 50L / 100);
    }

    @Test
    void debeModerarComoLoHaceLaVidaReal() {
        servicio.generar(plan(6000, 100, 4L));

        Instant hace72h = AHORA.minus(Duration.ofHours(72));
        assertThat(almacen.reportes.stream().filter(r -> r.timestamp().isBefore(hace72h)))
                .noneMatch(r -> r.estadoModeracion() == EstadoModeracion.PENDIENTE);
        assertThat(almacen.reportes.stream().filter(r -> r.estadoModeracion() == EstadoModeracion.APROBADO).count())
                .isGreaterThan(almacen.reportes.size() / 2);
        assertThat(almacen.reportes).noneMatch(ReporteCiudadano::esSensor);
        assertThat(almacen.reportes).allSatisfy(r -> assertThat(r.fotoUrl()).isNull());
    }

    @Test
    void debeRepartirLosReportesEntreLosDispositivosSinSalirseDeEllos() {
        servicio.generar(plan(3000, 10, 6L));

        assertThat(almacen.reportes.stream().map(r -> r.huella().hash()).distinct().count())
                .isBetween(100L, 300L);
        assertThat(almacen.dispositivos).allSatisfy(d -> assertThat(d.creadoEn()).isBeforeOrEqualTo(d.ultimoVisto()));
    }

    @Test
    void debeMarcarLosEventosComoSinteticosParaQueNadieLosTomePorUnAvisoDeAcuacar() {
        servicio.generar(plan(0, 50, 2L));

        assertThat(almacen.eventos).allSatisfy(evento -> assertThat(evento.descripcion()).endsWith("(dato sintético)"));
        assertThat(almacen.eventos).noneMatch(evento -> evento.urlOriginal() != null);
    }

    @Test
    void completarNoGeneraNadaSiYaHayLoPedido() {
        servicio.generar(plan(500, 20, 1L));
        int reportes = almacen.reportes.size();
        int cortes = almacen.cortes.size();

        servicio.completar(plan(500, 20, 2L));

        assertThat(almacen.reportes).hasSize(reportes);
        assertThat(almacen.cortes).hasSize(cortes);
    }

    @Test
    void completarGeneraSoloLoQueFalta() {
        servicio.generar(plan(300, 10, 1L));

        servicio.completar(plan(500, 25, 2L));

        assertThat(almacen.reportes).hasSize(500);
        assertThat(almacen.cortes).hasSize(25);
    }

    @Test
    void debeNegarseSiNoHayBarrios() {
        SectorRepository vacio = mock(SectorRepository.class);
        when(vacio.listarTodos()).thenReturn(List.of());
        GenerarDatosSinteticosService sinBarrios =
                new GenerarDatosSinteticosService(vacio, mock(GeometriaSectoresPort.class), almacen, () -> AHORA);

        assertThatThrownBy(() -> sinBarrios.generar(plan(10, 1, 1L)))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("barrios");
    }

    @Test
    void elPlanDebeRechazarLoQueElTtlDeLosReportesBorrariaOHaceInvalido() {
        assertThatThrownBy(() -> new PlanDeDatosSinteticos(10, 1, 5, 331, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new PlanDeDatosSinteticos(10, 1, 5, 0, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new PlanDeDatosSinteticos(-1, 1, 5, 30, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new PlanDeDatosSinteticos(10, 1, 0, 30, null)).isInstanceOf(IllegalArgumentException.class);
    }
}
