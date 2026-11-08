package com.aguavigia.ctg.infrastructure.config;

import com.aguavigia.ctg.domain.PlanDeDatosSinteticos;
import com.aguavigia.ctg.domain.ResumenDeDatosSinteticos;
import com.aguavigia.ctg.domain.Sector;
import com.aguavigia.ctg.domain.SectorId;
import com.aguavigia.ctg.domain.EstadoServicio;
import com.aguavigia.ctg.domain.port.in.GenerarDatosSinteticosUseCase;
import com.aguavigia.ctg.domain.port.out.SectorRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Como las cuentas sintéticas, los datos aleatorios esperan a que otro proceso siembre los barrios; sin ellos no hay a quién
 * repartirle los reportes. Con el plan en 0 (el valor por defecto) no hacen nada.
 */
class GeneradorDeDatosSinteticosAlArranqueTest {

    private GenerarDatosSinteticosUseCase generar;
    private SectorRepository sectores;
    private final List<Long> esperas = new ArrayList<>();

    @BeforeEach
    void preparar() {
        generar = mock(GenerarDatosSinteticosUseCase.class);
        sectores = mock(SectorRepository.class);
        when(generar.completar(any())).thenReturn(new ResumenDeDatosSinteticos(10, 100, 5, 20, 1L));
    }

    private GeneradorDeDatosSinteticosAlArranque con(PlanDeDatosSinteticos plan, int esperados, int intentos) {
        return new GeneradorDeDatosSinteticosAlArranque(generar, sectores, plan, esperados, intentos, esperas::add);
    }

    private static List<Sector> barrios(int cuantos) {
        return IntStream.range(0, cuantos)
                .mapToObj(i -> new Sector(new SectorId("b" + i), "Barrio " + i, 1000, EstadoServicio.CON_SERVICIO))
                .toList();
    }

    @Test
    void noDebeHacerNadaConElPlanVacio() {
        con(new PlanDeDatosSinteticos(0, 0, 100, 30, null), 3, 2).generarCuandoEsteListo();

        verify(generar, never()).completar(any());
    }

    @Test
    void debeCompletarElPlanCuandoYaEstanLosBarrios() {
        when(sectores.listarTodos()).thenReturn(barrios(3));
        PlanDeDatosSinteticos plan = new PlanDeDatosSinteticos(100, 5, 50, 30, 7L);

        con(plan, 3, 2).generarCuandoEsteListo();

        verify(generar).completar(plan);
        assertThat(esperas).isEmpty();
    }

    @Test
    void debeEsperarALosBarriosYGenerarCuandoAparecen() {
        when(sectores.listarTodos()).thenReturn(List.of(), barrios(3));
        PlanDeDatosSinteticos plan = new PlanDeDatosSinteticos(100, 5, 50, 30, null);

        con(plan, 3, 5).generarCuandoEsteListo();

        verify(generar).completar(plan);
        assertThat(esperas).hasSize(1);
    }

    @Test
    void noDebeInventarNadaSiLosBarriosNuncaLlegan() {
        when(sectores.listarTodos()).thenReturn(List.of());

        con(new PlanDeDatosSinteticos(100, 5, 50, 30, null), 3, 2).generarCuandoEsteListo();

        verify(generar, never()).completar(any());
        assertThat(esperas).hasSize(2);
    }

    @Test
    void unFalloDeMongoNoDebeTumbarElArranque() {
        when(sectores.listarTodos()).thenThrow(new DataAccessResourceFailureException("sin Mongo"));

        assertThatCode(() -> con(new PlanDeDatosSinteticos(100, 5, 50, 30, null), 3, 2).generarCuandoEsteListo())
                .doesNotThrowAnyException();
    }

    @Test
    void unFalloDelGeneradorNoDebeTumbarElArranque() {
        when(sectores.listarTodos()).thenReturn(barrios(3));
        when(generar.completar(any())).thenThrow(new IllegalStateException("fallo inesperado"));

        assertThatCode(() -> con(new PlanDeDatosSinteticos(100, 5, 50, 30, null), 3, 2).generarCuandoEsteListo())
                .doesNotThrowAnyException();
    }
}
