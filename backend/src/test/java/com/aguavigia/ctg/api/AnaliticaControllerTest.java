package com.aguavigia.ctg.api;

import com.aguavigia.ctg.api.error.ManejadorGlobalDeErrores;
import com.aguavigia.ctg.api.mapper.AnaliticaApiMapperImpl;
import com.aguavigia.ctg.domain.AnaliticaNoDisponibleException;
import com.aguavigia.ctg.domain.ConteosAnaliticos;
import com.aguavigia.ctg.domain.CumplimientoAnalitico;
import com.aguavigia.ctg.domain.Permiso;
import com.aguavigia.ctg.domain.PuntoMensualAnalitico;
import com.aguavigia.ctg.domain.RegistroDeCopia;
import com.aguavigia.ctg.domain.ResultadoDeCopia;
import com.aguavigia.ctg.domain.port.out.ConsultaAnaliticaPort;
import com.aguavigia.ctg.domain.port.out.RevocacionSesionPort;
import com.aguavigia.ctg.infrastructure.config.SecurityConfig;
import com.aguavigia.ctg.infrastructure.security.JwtProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AnaliticaController.class)
@Import({AnaliticaApiMapperImpl.class, ManejadorGlobalDeErrores.class, SecurityConfig.class})
@TestPropertySource(properties = "aguavigia.rate-limit.reglas=")
class AnaliticaControllerTest {

    private static final Instant COPIADO = Instant.parse("2026-10-15T15:00:00Z");

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ConsultaAnaliticaPort consulta;

    @MockitoBean
    private JwtProvider jwtProvider;

    @MockitoBean
    private RevocacionSesionPort revocacion;

    // RateLimitConfig implementa WebMvcConfigurer y se instancia en cualquier @WebMvcTest (REC-006).
    @MockitoBean(name = "redisTemplate")
    private RedisTemplate<String, String> redisTemplateMock;

    private void autenticarCon(Permiso... permisos) {
        given(jwtProvider.validar("token")).willReturn(Optional.of(AutenticacionDePrueba.sesionCon(permisos)));
    }

    @Test
    void elIndiceGlobalEsPublicoYSigueLaFormaDelEndpointDeSiempre() throws Exception {
        given(consulta.cumplimientoGlobal())
                .willReturn(new CumplimientoAnalitico(null, null, 3, 7200, 28800, 21600, 25.0));
        given(consulta.ultimaCopiaOk()).willReturn(Optional.of(COPIADO));

        mockMvc.perform(get("/api/analitica/cumplimiento"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sectorId").doesNotExist())
                .andExpect(jsonPath("$.paresCerrados").value(3))
                .andExpect(jsonPath("$.duracionPrometidaSegundos").value(7200))
                .andExpect(jsonPath("$.duracionRealSegundos").value(28800))
                .andExpect(jsonPath("$.desviacionSegundos").value(21600))
                .andExpect(jsonPath("$.porcentajeCumplimiento").value(25.0))
                .andExpect(jsonPath("$.copiadoEn").value("2026-10-15T15:00:00Z"));
    }

    @Test
    void elIndiceDeUnBarrioSeConsultaConSectorId() throws Exception {
        given(consulta.cumplimientoDe("manga"))
                .willReturn(Optional.of(new CumplimientoAnalitico("manga", "Manga", 1, 3600, 3600, 0, 100.0)));
        given(consulta.ultimaCopiaOk()).willReturn(Optional.empty());

        mockMvc.perform(get("/api/analitica/cumplimiento").param("sectorId", "manga"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sectorId").value("manga"))
                .andExpect(jsonPath("$.nombre").value("Manga"))
                .andExpect(jsonPath("$.copiadoEn").doesNotExist());
    }

    @Test
    void unBarrioQueNoEstaEnLaCopiaDebeResponder404ConProblemDetail() throws Exception {
        given(consulta.cumplimientoDe("fantasma")).willReturn(Optional.empty());

        mockMvc.perform(get("/api/analitica/cumplimiento").param("sectorId", "fantasma"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void laSerieMensualEsPublicaYSalePorPeriodo() throws Exception {
        given(consulta.cumplimientoMensual()).willReturn(List.of(
                new PuntoMensualAnalitico(YearMonth.of(2026, 9), 2, 7200, 14400, 50.0),
                new PuntoMensualAnalitico(YearMonth.of(2026, 10), 1, 3600, 3600, 100.0)));
        given(consulta.ultimaCopiaOk()).willReturn(Optional.of(COPIADO));

        mockMvc.perform(get("/api/analitica/cumplimiento/mensual"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.copiadoEn").value("2026-10-15T15:00:00Z"))
                .andExpect(jsonPath("$.puntos.length()").value(2))
                .andExpect(jsonPath("$.puntos[0].periodo").value("2026-09"))
                .andExpect(jsonPath("$.puntos[0].duracionRealSegundos").value(14400))
                .andExpect(jsonPath("$.puntos[1].porcentajeCumplimiento").value(100.0));
    }

    @Test
    void conLaCopiaApagadaOCaidaDebeResponder503ConElTipoServicioNoDisponible() throws Exception {
        given(consulta.cumplimientoGlobal()).willThrow(new AnaliticaNoDisponibleException("La copia analítica no está activada."));

        mockMvc.perform(get("/api/analitica/cumplimiento"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.type").value("https://aguavigia.example/errores/servicio-no-disponible"))
                .andExpect(jsonPath("$.status").value(503))
                .andExpect(jsonPath("$.detail").value("La copia analítica no está activada."));
    }

    @Test
    void tambienLaSerieMensualDebeResponder503SiLaBaseNoResponde() throws Exception {
        given(consulta.cumplimientoMensual()).willThrow(new AnaliticaNoDisponibleException("sin PostgreSQL"));
        given(consulta.ultimaCopiaOk()).willThrow(new AnaliticaNoDisponibleException("sin PostgreSQL"));

        mockMvc.perform(get("/api/analitica/cumplimiento/mensual")).andExpect(status().isServiceUnavailable());
    }

    @Test
    void elEstadoDeLasCopiasExigeSesion() throws Exception {
        mockMvc.perform(get("/api/veedor/analitica/copia")).andExpect(status().isUnauthorized());

        verifyNoInteractions(consulta);
    }

    @Test
    void elEstadoDeLasCopiasExigeElPermisoVerPanel() throws Exception {
        autenticarCon(Permiso.GESTIONAR_PERFIL_PROPIO);

        mockMvc.perform(get("/api/veedor/analitica/copia").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(consulta);
    }

    @Test
    void conVerPanelDebeListarLasUltimasCopiasConSusConteos() throws Exception {
        autenticarCon(Permiso.VER_PANEL);
        given(consulta.ultimasCopias(anyInt())).willReturn(List.of(
                new RegistroDeCopia(2, COPIADO, COPIADO.plusSeconds(3), ResultadoDeCopia.CON_DIFERENCIAS,
                        new ConteosAnaliticos(211, 4, 6), new ConteosAnaliticos(211, 4, 5), "pares 6 vs 5"),
                new RegistroDeCopia(1, COPIADO.minusSeconds(300), null, ResultadoDeCopia.FALLIDA, null, null, "se cayó")));

        mockMvc.perform(get("/api/veedor/analitica/copia").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].resultado").value("CON_DIFERENCIAS"))
                .andExpect(jsonPath("$[0].enMongo.pares").value(6))
                .andExpect(jsonPath("$[0].enSql.pares").value(5))
                .andExpect(jsonPath("$[0].detalle").value("pares 6 vs 5"))
                .andExpect(jsonPath("$[1].resultado").value("FALLIDA"))
                .andExpect(jsonPath("$[1].enMongo").doesNotExist())
                .andExpect(jsonPath("$[1].terminadaEn").doesNotExist());
    }

    @Test
    void elLimiteDeCopiasDebeAcotarseParaNoPedirMilesDeFilas() throws Exception {
        autenticarCon(Permiso.VER_PANEL);
        given(consulta.ultimasCopias(anyInt())).willReturn(List.of());

        mockMvc.perform(get("/api/veedor/analitica/copia").param("limite", "100000").header("Authorization", "Bearer token"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/veedor/analitica/copia").param("limite", "-4").header("Authorization", "Bearer token"))
                .andExpect(status().isOk());

        verify(consulta).ultimasCopias(eq(200));
        verify(consulta).ultimasCopias(eq(1));
    }

    @Test
    void laCopiaCaidaTambienDebeResponder503EnElPanel() throws Exception {
        autenticarCon(Permiso.VER_PANEL);
        given(consulta.ultimasCopias(any(Integer.class))).willThrow(new AnaliticaNoDisponibleException("sin PostgreSQL"));

        mockMvc.perform(get("/api/veedor/analitica/copia").header("Authorization", "Bearer token"))
                .andExpect(status().isServiceUnavailable());
    }

    // --- vigilante y bitácora inmutable (ADR-113) ---

    @Test
    void laIntegridadDeLaBitacoraEsPublicaYDiceSiLaCadenaEstaSana() throws Exception {
        given(consulta.integridadDeBitacora()).willReturn(new com.aguavigia.ctg.domain.VerificacionDeBitacora(120, 0, "abc123"));

        mockMvc.perform(get("/api/analitica/bitacora/integridad"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventos").value(120))
                .andExpect(jsonPath("$.cadenaValida").value(true))
                .andExpect(jsonPath("$.ultimoHash").value("abc123"));
    }

    @Test
    void unaCadenaRotaSeVeEnLaRespuesta() throws Exception {
        given(consulta.integridadDeBitacora()).willReturn(new com.aguavigia.ctg.domain.VerificacionDeBitacora(120, 3, "abc123"));

        mockMvc.perform(get("/api/analitica/bitacora/integridad"))
                .andExpect(jsonPath("$.cadenaValida").value(false))
                .andExpect(jsonPath("$.eslabonesRotos").value(3));
    }

    @Test
    void elVigilanteSoloLoVeQuienTieneVerPanel() throws Exception {
        mockMvc.perform(get("/api/veedor/analitica/vigilancia")).andExpect(status().isUnauthorized());

        autenticarCon(Permiso.VER_PANEL);
        given(consulta.ultimasVigilancias(20)).willReturn(java.util.List.of(new com.aguavigia.ctg.domain.RegistroDeVigilancia(
                9, COPIADO, com.aguavigia.ctg.domain.ResultadoDeCopia.CON_DIFERENCIAS, 211, 2, 120, 0, "Hay diferencias: manga")));

        mockMvc.perform(get("/api/veedor/analitica/vigilancia").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].resultado").value("CON_DIFERENCIAS"))
                .andExpect(jsonPath("$[0].barriosRevisados").value(211))
                .andExpect(jsonPath("$[0].detalle").value("Hay diferencias: manga"));
    }

    @Test
    void sinCopiaLaIntegridadYElVigilanteDebenResponder503() throws Exception {
        given(consulta.integridadDeBitacora()).willThrow(new AnaliticaNoDisponibleException("apagada"));
        autenticarCon(Permiso.VER_PANEL);
        given(consulta.ultimasVigilancias(any(Integer.class))).willThrow(new AnaliticaNoDisponibleException("apagada"));

        mockMvc.perform(get("/api/analitica/bitacora/integridad")).andExpect(status().isServiceUnavailable());
        mockMvc.perform(get("/api/veedor/analitica/vigilancia").header("Authorization", "Bearer token"))
                .andExpect(status().isServiceUnavailable());
    }

    // --- reportes (ADR-112) ---

    @Test
    void elRankingDeReportesEsPublicoYTraeLaPosicionYElPorcentaje() throws Exception {
        given(consulta.rankingDeBarrios(10)).willReturn(java.util.List.of(
                new com.aguavigia.ctg.domain.RankingDeBarrioAnalitico(1, "manga", "Manga", 8, 6, 2, 50.0),
                new com.aguavigia.ctg.domain.RankingDeBarrioAnalitico(2, "crespo", "Crespo", 4, 0, 4, 25.0)));
        given(consulta.ultimaCopiaOk()).willReturn(Optional.of(COPIADO));

        mockMvc.perform(get("/api/analitica/reportes/ranking"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.copiadoEn").value("2026-10-15T15:00:00Z"))
                .andExpect(jsonPath("$.barrios[0].posicion").value(1))
                .andExpect(jsonPath("$.barrios[0].sectorId").value("manga"))
                .andExpect(jsonPath("$.barrios[0].sinAgua").value(6))
                .andExpect(jsonPath("$.barrios[1].porcentajeDeLaCiudad").value(25.0));
    }

    @Test
    void elLimiteDelRankingSeAcotaEntre1Y50() throws Exception {
        given(consulta.rankingDeBarrios(50)).willReturn(java.util.List.of());
        given(consulta.rankingDeBarrios(1)).willReturn(java.util.List.of());

        mockMvc.perform(get("/api/analitica/reportes/ranking").param("limite", "9999")).andExpect(status().isOk());
        mockMvc.perform(get("/api/analitica/reportes/ranking").param("limite", "0")).andExpect(status().isOk());
        verify(consulta).rankingDeBarrios(50);
        verify(consulta).rankingDeBarrios(1);
    }

    @Test
    void laTendenciaDeReportesTraeLaMediaMovilYElCambioNuloDelPrimerDia() throws Exception {
        given(consulta.tendenciaDeReportes(30)).willReturn(java.util.List.of(
                new com.aguavigia.ctg.domain.PuntoTendenciaAnalitico(java.time.LocalDate.of(2026, 11, 1), 7, 7.0, null),
                new com.aguavigia.ctg.domain.PuntoTendenciaAnalitico(java.time.LocalDate.of(2026, 11, 2), 0, 3.5, -7L)));
        given(consulta.ultimaCopiaOk()).willReturn(Optional.empty());

        mockMvc.perform(get("/api/analitica/reportes/tendencia"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.puntos[0].dia").value("2026-11-01"))
                .andExpect(jsonPath("$.puntos[0].cambioRespectoAlDiaAnterior").doesNotExist())
                .andExpect(jsonPath("$.puntos[1].media7Dias").value(3.5))
                .andExpect(jsonPath("$.puntos[1].cambioRespectoAlDiaAnterior").value(-7));
    }

    @Test
    void sinCopiaLasRutasDeReportesDebenResponder503ConProblemDetail() throws Exception {
        given(consulta.rankingDeBarrios(10)).willThrow(new AnaliticaNoDisponibleException("apagada"));
        given(consulta.tendenciaDeReportes(30)).willThrow(new AnaliticaNoDisponibleException("apagada"));

        mockMvc.perform(get("/api/analitica/reportes/ranking")).andExpect(status().isServiceUnavailable())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
        mockMvc.perform(get("/api/analitica/reportes/tendencia")).andExpect(status().isServiceUnavailable());
    }
}
