package com.aguavigia.ctg.application;

import com.aguavigia.ctg.domain.CierreDeCorte;
import com.aguavigia.ctg.domain.Coordenada;
import com.aguavigia.ctg.domain.CorteAgua;
import com.aguavigia.ctg.domain.CorteId;
import com.aguavigia.ctg.domain.Dispositivo;
import com.aguavigia.ctg.domain.DispositivoId;
import com.aguavigia.ctg.domain.EstadoCorte;
import com.aguavigia.ctg.domain.EstadoModeracion;
import com.aguavigia.ctg.domain.EstadoServicio;
import com.aguavigia.ctg.domain.EventoBitacora;
import com.aguavigia.ctg.domain.EventoBitacoraFactory;
import com.aguavigia.ctg.domain.HuellaDispositivo;
import com.aguavigia.ctg.domain.NivelDeVerificacion;
import com.aguavigia.ctg.domain.OrigenCorte;
import com.aguavigia.ctg.domain.OrigenEstado;
import com.aguavigia.ctg.domain.PlanDeDatosSinteticos;
import com.aguavigia.ctg.domain.PoligonoGeoJson;
import com.aguavigia.ctg.domain.ReporteCiudadano;
import com.aguavigia.ctg.domain.ReporteId;
import com.aguavigia.ctg.domain.ResumenDeDatosSinteticos;
import com.aguavigia.ctg.domain.Sector;
import com.aguavigia.ctg.domain.SectorId;
import com.aguavigia.ctg.domain.TipoEvento;
import com.aguavigia.ctg.domain.TipoReporte;
import com.aguavigia.ctg.domain.GeometriaSector;
import com.aguavigia.ctg.domain.port.in.GenerarDatosSinteticosUseCase;
import com.aguavigia.ctg.domain.port.out.AlmacenDeDatosSinteticosPort;
import com.aguavigia.ctg.domain.port.out.GeometriaSectoresPort;
import com.aguavigia.ctg.domain.port.out.RelojPort;
import com.aguavigia.ctg.domain.port.out.SectorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.SplittableRandom;
import java.util.UUID;
import java.util.random.RandomGenerator;

/**
 * Datos aleatorios para la simulación (ADR-111): cortes con sus barrios, cierres y bitácora, y reportes ciudadanos repartidos
 * entre dispositivos. Lo sortea todo, pero no a la ligera:
 * <ul>
 *   <li>Los reportes siguen la población de cada barrio, con unos pocos barrios «calientes» que concentran muchos más.</li>
 *   <li>Casi dos de cada tres se agrupan alrededor de un corte, desde que empieza hasta poco después de que termina; el resto
 *       cae en la hora del día con los picos de la mañana y de la tarde.</li>
 *   <li>Cada punto cae dentro del polígono de su barrio.</li>
 *   <li>Los cortes terminan antes, a tiempo o tarde, o vencen sin confirmar, o se anulan, así que el Índice de Cumplimiento
 *       tiene barrios al 100 %, al 40 % y sin dato.</li>
 * </ul>
 * Con la misma semilla, el mismo reloj y los mismos barrios sale lo mismo. Todo queda en el pasado y dentro de los
 * {@link PlanDeDatosSinteticos#MAXIMO_DE_DIAS} días que el TTL de los reportes respeta. Los cortes son de origen
 * {@link OrigenCorte#SINTETICO}: nunca se hacen pasar por un boletín de Acuacar.
 */
public class GenerarDatosSinteticosService implements GenerarDatosSinteticosUseCase {

    private static final Logger log = LoggerFactory.getLogger(GenerarDatosSinteticosService.class);
    private static final ZoneId CARTAGENA = ZoneId.of("America/Bogota");
    private static final int TAMANO_DE_LOTE = 2000;
    private static final int POBLACION_SI_FALTA = 5000;
    private static final String[] CAUSAS = {
            "Mantenimiento de la red de distribución", "Reparación de daño en tubería matriz", "Empalme de nueva línea",
            "Limpieza de tanque de almacenamiento", "Cambio de válvula", "Falla eléctrica en la estación de bombeo",
            "Reposición de tubería por obra vial"};

    private final SectorRepository sectores;
    private final GeometriaSectoresPort geometrias;
    private final AlmacenDeDatosSinteticosPort almacen;
    private final RelojPort reloj;

    public GenerarDatosSinteticosService(SectorRepository sectores, GeometriaSectoresPort geometrias,
                                         AlmacenDeDatosSinteticosPort almacen, RelojPort reloj) {
        this.sectores = sectores;
        this.geometrias = geometrias;
        this.almacen = almacen;
        this.reloj = reloj;
    }

    @Override
    public ResumenDeDatosSinteticos contar() {
        return almacen.contar();
    }

    @Override
    public ResumenDeDatosSinteticos completar(PlanDeDatosSinteticos plan) {
        ResumenDeDatosSinteticos hay = almacen.contar();
        int reportesQueFaltan = (int) Math.max(0, plan.reportes() - hay.reportes());
        int cortesQueFaltan = (int) Math.max(0, plan.cortes() - hay.cortes());
        if (reportesQueFaltan == 0 && cortesQueFaltan == 0) {
            return hay;
        }
        return generar(new PlanDeDatosSinteticos(reportesQueFaltan, cortesQueFaltan,
                Math.min(plan.dispositivos(), Math.max(reportesQueFaltan, 1)), plan.dias(), plan.semilla()));
    }

    @Override
    public ResumenDeDatosSinteticos generar(PlanDeDatosSinteticos plan) {
        List<Sector> catalogo = sectores.listarTodos();
        if (catalogo.isEmpty()) {
            throw new IllegalStateException("No hay barrios sembrados: no se pueden repartir datos sintéticos");
        }
        long semilla = plan.semilla() != null ? plan.semilla() : RandomGenerator.getDefault().nextLong();
        RandomGenerator azar = new SplittableRandom(semilla);
        Instant ahora = reloj.ahora();

        Barrios barrios = new Barrios(catalogo, geometrias.listar(), azar);
        List<VentanaDeCorte> ventanas = new ArrayList<>();
        long[] cuentaCortes = generarCortes(plan, barrios, azar, ahora, ventanas);
        long reportes = generarReportes(plan, barrios, azar, ahora, ventanas);

        ResumenDeDatosSinteticos resumen = new ResumenDeDatosSinteticos(
                reportes > 0 ? Math.min(plan.dispositivos(), reportes) : 0, reportes, cuentaCortes[0], cuentaCortes[1], semilla);
        log.info("Datos sintéticos generados (semilla {}): {} reportes, {} cortes, {} eventos de bitácora", semilla,
                resumen.reportes(), resumen.cortes(), resumen.eventos());
        return resumen;
    }

    // ───────────────────────────── cortes ─────────────────────────────

    /** Lo que los reportes necesitan saber de un corte para agruparse a su alrededor. */
    private record VentanaDeCorte(List<SectorId> sectores, Instant inicio, Instant fin) {
    }

    /** @return {cortes creados, eventos creados} */
    private long[] generarCortes(PlanDeDatosSinteticos plan, Barrios barrios, RandomGenerator azar, Instant ahora,
                                 List<VentanaDeCorte> ventanas) {
        long cortes = 0;
        long eventos = 0;
        List<CorteAgua> loteCortes = new ArrayList<>(TAMANO_DE_LOTE);
        List<EventoBitacora> loteEventos = new ArrayList<>(TAMANO_DE_LOTE);

        Duration lapso = Duration.ofDays(plan.dias());
        Duration margen = Duration.ofHours(Math.min(48, plan.dias() * 12L));
        long duracionMaximaHoras = Math.max(2, Math.min(24, margen.toHours() * 45 / 100));

        for (int i = 0; i < plan.cortes(); i++) {
            long segundosDisponibles = Math.max(1, lapso.minus(margen).toSeconds());
            Instant inicio = ahora.minus(lapso).plusSeconds((long) (azar.nextDouble() * segundosDisponibles));
            long mediasHoras = 4 + azar.nextInt((int) Math.max(1, duracionMaximaHoras * 2 - 3));
            Instant finPrometido = inicio.plus(Duration.ofMinutes(mediasHoras * 30));
            List<SectorId> afectados = barrios.sortearDistintos(1 + (int) (7 * Math.pow(azar.nextDouble(), 2.2)), azar);

            double suerte = azar.nextDouble();
            EstadoCorte estado = suerte < 0.05 ? EstadoCorte.ANULADO : suerte < 0.15 ? EstadoCorte.EXPIRADO : EstadoCorte.RESTABLECIDO;
            Map<SectorId, CierreDeCorte> cierres = cierresDe(estado, afectados, inicio, finPrometido, azar);

            CorteAgua.Builder corte = CorteAgua.builder()
                    .id(new CorteId(uuid(azar)))
                    .sectoresAfectados(afectados)
                    .inicio(inicio)
                    .finPrometido(finPrometido)
                    .causa(CAUSAS[azar.nextInt(CAUSAS.length)])
                    .origen(OrigenCorte.SINTETICO)
                    .estado(estado)
                    .cierres(cierres);
            if (estado == EstadoCorte.ANULADO) {
                corte.motivoAnulacion("Aviso sintético anulado: simula un corte publicado por error");
            }
            CorteAgua creado = corte.build();
            loteCortes.add(creado);
            cortes++;

            Instant ultimaHora = cierres.values().stream().map(CierreDeCorte::hora).max(Instant::compareTo).orElse(finPrometido);
            if (estado != EstadoCorte.ANULADO) {
                ventanas.add(new VentanaDeCorte(afectados, inicio, ultimaHora.isAfter(finPrometido) ? ultimaHora : finPrometido));
            }
            eventos += agregarEventos(creado, afectados, inicio, finPrometido, ahora, azar, loteEventos);

            if (loteCortes.size() >= TAMANO_DE_LOTE) {
                almacen.insertarCortes(loteCortes);
                loteCortes.clear();
            }
            if (loteEventos.size() >= TAMANO_DE_LOTE) {
                almacen.insertarEventos(loteEventos);
                loteEventos.clear();
            }
        }
        if (!loteCortes.isEmpty()) {
            almacen.insertarCortes(loteCortes);
        }
        if (!loteEventos.isEmpty()) {
            almacen.insertarEventos(loteEventos);
        }
        return new long[] {cortes, eventos};
    }

    /** Un barrio termina antes, a tiempo o tarde, con la fuente que sostiene el cierre. Un corte vencido deja al menos uno sin cerrar. */
    private static Map<SectorId, CierreDeCorte> cierresDe(EstadoCorte estado, List<SectorId> afectados, Instant inicio,
                                                          Instant finPrometido, RandomGenerator azar) {
        if (estado == EstadoCorte.ANULADO) {
            return Map.of();
        }
        long minutosPrometidos = Duration.between(inicio, finPrometido).toMinutes();
        int cuantosCierran = estado == EstadoCorte.RESTABLECIDO ? afectados.size() : azar.nextInt(afectados.size());
        Map<SectorId, CierreDeCorte> cierres = new LinkedHashMap<>();
        for (int i = 0; i < cuantosCierran; i++) {
            double momento = azar.nextDouble();
            Instant hora;
            if (momento < 0.15) {
                hora = inicio.plus(Duration.ofMinutes((long) (minutosPrometidos * (0.6 + 0.35 * azar.nextDouble()))));
            } else if (momento < 0.55) {
                hora = finPrometido.plus(Duration.ofMinutes(azar.nextInt(16) - 5));
            } else {
                hora = finPrometido.plus(Duration.ofMinutes(10 + azar.nextInt(291)));
            }
            if (hora.isBefore(inicio)) {
                hora = inicio.plusSeconds(60);
            }
            double quien = azar.nextDouble();
            OrigenEstado fuente = quien < 0.35 ? OrigenEstado.ACUACAR : quien < 0.60 ? OrigenEstado.VEEDOR : OrigenEstado.VECINOS;
            boolean provisional = fuente == OrigenEstado.VECINOS && azar.nextBoolean();
            cierres.put(afectados.get(i), new CierreDeCorte(hora, fuente, provisional));
        }
        return cierres;
    }

    private static int agregarEventos(CorteAgua corte, List<SectorId> afectados, Instant inicio, Instant finPrometido,
                                      Instant ahora, RandomGenerator azar, List<EventoBitacora> destino) {
        int antes = destino.size();
        Instant tope = ahora.minusSeconds(60);
        for (SectorId sector : afectados) {
            Instant anuncio = inicio.minus(Duration.ofMinutes(30 + azar.nextInt(24 * 60)));
            if (corte.estado() == EstadoCorte.ANULADO) {
                destino.add(EventoBitacoraFactory.deCorteSintetico(TipoEvento.CORTE_ANULADO, corte, sector, anuncio.plusSeconds(600),
                        "Corte anulado en '" + sector.valor() + "': " + corte.motivoAnulacion(), null, null));
                continue;
            }
            destino.add(EventoBitacoraFactory.deCorteSintetico(TipoEvento.CORTE_ANUNCIADO, corte, sector, anuncio,
                    "Corte anunciado en '" + sector.valor() + "': " + corte.causa(), EstadoServicio.CORTE_PROGRAMADO, null));
            CierreDeCorte cierre = corte.cierreDe(sector).orElse(null);
            if (cierre != null) {
                destino.add(EventoBitacoraFactory.deCorteSintetico(TipoEvento.CORTE_RESTABLECIDO, corte, sector, cierre.hora(),
                        "Corte restablecido en '" + sector.valor() + "'", EstadoServicio.CON_SERVICIO, cierre.fuente()));
            } else {
                Instant vencio = finPrometido.plus(Duration.ofHours(24));
                destino.add(EventoBitacoraFactory.deCorteSintetico(TipoEvento.CORTE_EXPIRADO, corte, sector,
                        vencio.isAfter(tope) ? tope : vencio,
                        "El corte en '" + sector.valor() + "' venció sin que nadie confirmara el restablecimiento", null, null));
            }
        }
        return destino.size() - antes;
    }

    // ───────────────────────────── reportes ─────────────────────────────

    private long generarReportes(PlanDeDatosSinteticos plan, Barrios barrios, RandomGenerator azar, Instant ahora,
                                 List<VentanaDeCorte> ventanas) {
        if (plan.reportes() == 0) {
            return 0;
        }
        int cuantosDispositivos = Math.min(plan.dispositivos(), plan.reportes());
        String[] ids = new String[cuantosDispositivos];
        String[] huellas = new String[cuantosDispositivos];
        Instant[] primero = new Instant[cuantosDispositivos];
        Instant[] ultimo = new Instant[cuantosDispositivos];
        for (int i = 0; i < cuantosDispositivos; i++) {
            ids[i] = uuid(azar);
            huellas[i] = HuellaDispositivo.deDispositivo(new DispositivoId(ids[i])).hash();
        }
        int redes = Math.max(30, cuantosDispositivos / 30);
        Map<String, String> cacheDeRedes = new HashMap<>();
        Duration lapso = Duration.ofDays(plan.dias());
        Instant masAntiguo = ahora.minus(lapso);
        Instant masReciente = ahora.minusSeconds(60);

        List<ReporteCiudadano> lote = new ArrayList<>(TAMANO_DE_LOTE);
        for (int i = 0; i < plan.reportes(); i++) {
            boolean enCorte = !ventanas.isEmpty() && azar.nextDouble() < 0.65;
            SectorId sector;
            Instant cuando;
            TipoReporte tipo;
            if (enCorte) {
                VentanaDeCorte ventana = ventanas.get(azar.nextInt(ventanas.size()));
                sector = ventana.sectores().get(azar.nextInt(ventana.sectores().size()));
                long segundos = Math.max(60, Duration.between(ventana.inicio(), ventana.fin()).toSeconds());
                double fraccion = Math.pow(azar.nextDouble(), 1.6);
                cuando = azar.nextDouble() < 0.08
                        ? ventana.fin().plusSeconds((long) (azar.nextDouble() * 6 * 3600))
                        : ventana.inicio().plusSeconds((long) (fraccion * segundos));
                tipo = azar.nextDouble() < 0.78 ? TipoReporte.SIN_AGUA : TipoReporte.PRESION_BAJA;
            } else {
                sector = barrios.sortearPonderado(azar);
                cuando = alAzarEnElDia(ahora, plan.dias(), azar);
                tipo = azar.nextDouble() < 0.45 ? TipoReporte.SIN_AGUA : TipoReporte.PRESION_BAJA;
            }
            if (cuando.isAfter(masReciente)) {
                cuando = masReciente.minusSeconds(azar.nextInt(36000));
            }
            if (cuando.isBefore(masAntiguo)) {
                cuando = masAntiguo.plusSeconds(azar.nextInt(36000));
            }

            int dispositivo = (int) (cuantosDispositivos * Math.pow(azar.nextDouble(), 1.3));
            if (primero[dispositivo] == null || cuando.isBefore(primero[dispositivo])) {
                primero[dispositivo] = cuando;
            }
            if (ultimo[dispositivo] == null || cuando.isAfter(ultimo[dispositivo])) {
                ultimo[dispositivo] = cuando;
            }

            Coordenada coordenada = barrios.sortearPunto(sector, azar);
            lote.add(new ReporteCiudadano(
                    new ReporteId(uuid(azar)), sector, tipo, coordenada, new HuellaDispositivo(huellas[dispositivo]), cuando,
                    moderacionDe(Duration.between(cuando, ahora), azar), null, Set.of(), false, verificacionAlAzar(azar),
                    redDelDia(cacheDeRedes, cuando, (int) (redes * Math.pow(azar.nextDouble(), 2)), cuantosDispositivos), null, false));

            if (lote.size() >= TAMANO_DE_LOTE) {
                almacen.insertarReportes(lote);
                lote.clear();
            }
        }
        if (!lote.isEmpty()) {
            almacen.insertarReportes(lote);
        }

        List<Dispositivo> dispositivos = new ArrayList<>(Math.min(cuantosDispositivos, TAMANO_DE_LOTE));
        for (int i = 0; i < cuantosDispositivos; i++) {
            Instant visto = ultimo[i] != null ? ultimo[i] : ahora.minusSeconds(azar.nextInt(86400 * Math.max(1, plan.dias())));
            Instant creado = primero[i] != null
                    ? primero[i].minus(Duration.ofMinutes(azar.nextInt(3 * 24 * 60)))
                    : visto.minus(Duration.ofMinutes(azar.nextInt(3 * 24 * 60)));
            dispositivos.add(new Dispositivo(new DispositivoId(ids[i]), creado, visto));
            if (dispositivos.size() >= TAMANO_DE_LOTE) {
                almacen.insertarDispositivos(dispositivos);
                dispositivos.clear();
            }
        }
        if (!dispositivos.isEmpty()) {
            almacen.insertarDispositivos(dispositivos);
        }
        return plan.reportes();
    }

    /** Los reportes recientes pueden seguir en la cola del veedor; los viejos ya se decidieron. */
    private static EstadoModeracion moderacionDe(Duration antiguedad, RandomGenerator azar) {
        double suerte = azar.nextDouble();
        if (antiguedad.toHours() < 72) {
            return suerte < 0.25 ? EstadoModeracion.PENDIENTE : suerte < 0.80 ? EstadoModeracion.APROBADO : EstadoModeracion.DESCARTADO;
        }
        return suerte < 0.78 ? EstadoModeracion.APROBADO : EstadoModeracion.DESCARTADO;
    }

    private static NivelDeVerificacion verificacionAlAzar(RandomGenerator azar) {
        double suerte = azar.nextDouble();
        return suerte < 0.20 ? NivelDeVerificacion.CUENTA_VERIFICADA
                : suerte < 0.65 ? NivelDeVerificacion.UBICACION_VERIFICADA : NivelDeVerificacion.NINGUNA;
    }

    /** Resumen de una red de origen que cambia cada día, como el real; pocas redes concentran muchos reportes. */
    private static String redDelDia(Map<String, String> cache, Instant cuando, int red, int dispositivos) {
        String clave = cuando.atZone(CARTAGENA).toLocalDate() + ":" + red;
        return cache.computeIfAbsent(clave, k -> sha256("sim-red:" + k + ":" + dispositivos));
    }

    /** Una hora del día con los picos de la mañana y de la tarde, en un día cualquiera de los últimos {@code dias}. */
    private static Instant alAzarEnElDia(Instant ahora, int dias, RandomGenerator azar) {
        Instant dia = ahora.minus(Duration.ofDays(azar.nextInt(dias)));
        double componente = azar.nextDouble();
        double hora = componente < 0.35 ? 7.5 + 1.5 * azar.nextGaussian()
                : componente < 0.65 ? 19.5 + 1.8 * azar.nextGaussian() : azar.nextDouble() * 24;
        hora = ((hora % 24) + 24) % 24;
        Instant medianoche = dia.atZone(CARTAGENA).toLocalDate().atStartOfDay(CARTAGENA).toInstant();
        return medianoche.plusSeconds((long) (hora * 3600));
    }

    private static String uuid(RandomGenerator azar) {
        return new UUID(azar.nextLong(), azar.nextLong()).toString();
    }

    private static String sha256(String texto) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(texto.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException imposibleEnCualquierJvm) {
            throw new IllegalStateException("SHA-256 no disponible", imposibleEnCualquierJvm);
        }
    }

    // ───────────────────────────── barrios ─────────────────────────────

    /** Los barrios con su peso (población y «barrios calientes») y su polígono, para sortear sectores y puntos. */
    private static final class Barrios {
        private final List<SectorId> ids;
        private final long[] acumulado;
        private final Map<SectorId, PoligonoGeoJson> poligonos = new HashMap<>();

        Barrios(List<Sector> catalogo, List<GeometriaSector> geometrias, RandomGenerator azar) {
            this.ids = new ArrayList<>(catalogo.size());
            this.acumulado = new long[catalogo.size()];
            Set<Integer> calientes = new LinkedHashSet<>();
            int cuantosCalientes = Math.max(1, catalogo.size() / 10);
            while (calientes.size() < cuantosCalientes) {
                calientes.add(azar.nextInt(catalogo.size()));
            }
            long suma = 0;
            for (int i = 0; i < catalogo.size(); i++) {
                Sector sector = catalogo.get(i);
                long peso = Math.max(500, sector.poblacion() != null ? sector.poblacion() : POBLACION_SI_FALTA);
                if (calientes.contains(i)) {
                    peso *= 3 + azar.nextInt(6);
                }
                suma += peso;
                ids.add(sector.id());
                acumulado[i] = suma;
            }
            for (GeometriaSector geometria : geometrias) {
                PoligonoGeoJson poligono = PoligonoGeoJson.de(geometria.geometria());
                if (poligono != null) {
                    poligonos.put(geometria.id(), poligono);
                }
            }
        }

        SectorId sortearPonderado(RandomGenerator azar) {
            long objetivo = (long) (azar.nextDouble() * acumulado[acumulado.length - 1]);
            int bajo = 0;
            int alto = acumulado.length - 1;
            while (bajo < alto) {
                int medio = (bajo + alto) >>> 1;
                if (acumulado[medio] > objetivo) {
                    alto = medio;
                } else {
                    bajo = medio + 1;
                }
            }
            return ids.get(bajo);
        }

        List<SectorId> sortearDistintos(int cuantos, RandomGenerator azar) {
            int meta = Math.min(cuantos, ids.size());
            Set<SectorId> elegidos = new LinkedHashSet<>();
            for (int intentos = 0; elegidos.size() < meta && intentos < meta * 40; intentos++) {
                elegidos.add(sortearPonderado(azar));
            }
            if (elegidos.isEmpty()) {
                elegidos.add(ids.get(0));
            }
            List<SectorId> resultado = new ArrayList<>(elegidos);
            Collections.shuffle(resultado, new java.util.Random(azar.nextLong()));
            return resultado;
        }

        /** Un punto dentro del barrio, redondeado a 3 decimales como se guardan los reportes reales (ADR-090). */
        Coordenada sortearPunto(SectorId sector, RandomGenerator azar) {
            PoligonoGeoJson poligono = poligonos.get(sector);
            if (poligono == null) {
                return null;
            }
            Coordenada punto = poligono.sortear(azar);
            double latitud = Math.round(punto.latitud() * 1000.0) / 1000.0;
            double longitud = Math.round(punto.longitud() * 1000.0) / 1000.0;
            return new Coordenada(latitud, longitud);
        }
    }
}
