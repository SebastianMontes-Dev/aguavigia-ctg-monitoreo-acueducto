package com.aguavigia.ctg.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.random.RandomGenerator;

/**
 * Lo mínimo que el generador de datos sintéticos necesita de un barrio: saber si un punto cae dentro de su polígono y
 * sortear uno que sí caiga. Lee el GeoJSON tal como se sembró ({@code Polygon} o {@code MultiPolygon}, con
 * coordenadas {@code [longitud, latitud]}) y solo mira el anillo exterior de cada polígono; los huecos no importan para
 * repartir reportes. Java puro: no depende de Spring ni de Mongo.
 */
public final class PoligonoGeoJson {

    private final List<double[][]> anillos;
    private final double minimaLongitud;
    private final double maximaLongitud;
    private final double minimaLatitud;
    private final double maximaLatitud;

    private PoligonoGeoJson(List<double[][]> anillos) {
        this.anillos = anillos;
        double minLon = Double.MAX_VALUE;
        double maxLon = -Double.MAX_VALUE;
        double minLat = Double.MAX_VALUE;
        double maxLat = -Double.MAX_VALUE;
        for (double[][] anillo : anillos) {
            for (double[] punto : anillo) {
                minLon = Math.min(minLon, punto[0]);
                maxLon = Math.max(maxLon, punto[0]);
                minLat = Math.min(minLat, punto[1]);
                maxLat = Math.max(maxLat, punto[1]);
            }
        }
        this.minimaLongitud = minLon;
        this.maximaLongitud = maxLon;
        this.minimaLatitud = minLat;
        this.maximaLatitud = maxLat;
    }

    /** Nulo si la geometría no es un {@code Polygon} o {@code MultiPolygon} legible. */
    public static PoligonoGeoJson de(Map<String, Object> geometria) {
        if (geometria == null) {
            return null;
        }
        Object tipo = geometria.get("type");
        Object coordenadas = geometria.get("coordinates");
        if (!(coordenadas instanceof List<?> lista) || tipo == null) {
            return null;
        }
        List<double[][]> anillos = new ArrayList<>();
        try {
            if ("Polygon".equals(tipo)) {
                agregarExterior(lista, anillos);
            } else if ("MultiPolygon".equals(tipo)) {
                for (Object poligono : lista) {
                    agregarExterior((List<?>) poligono, anillos);
                }
            } else {
                return null;
            }
        } catch (ClassCastException | IndexOutOfBoundsException formaInesperada) {
            return null;
        }
        return anillos.isEmpty() ? null : new PoligonoGeoJson(anillos);
    }

    private static void agregarExterior(List<?> poligono, List<double[][]> destino) {
        List<?> exterior = (List<?>) poligono.get(0);
        double[][] puntos = new double[exterior.size()][];
        for (int i = 0; i < puntos.length; i++) {
            List<?> par = (List<?>) exterior.get(i);
            puntos[i] = new double[] {((Number) par.get(0)).doubleValue(), ((Number) par.get(1)).doubleValue()};
        }
        if (puntos.length >= 4) {
            destino.add(puntos);
        }
    }

    public boolean contiene(double latitud, double longitud) {
        if (latitud < minimaLatitud || latitud > maximaLatitud || longitud < minimaLongitud || longitud > maximaLongitud) {
            return false;
        }
        for (double[][] anillo : anillos) {
            if (dentroDe(anillo, latitud, longitud)) {
                return true;
            }
        }
        return false;
    }

    /** Un punto dentro del polígono, sorteado en su rectángulo y aceptado si cae dentro; si no, el centro del rectángulo. */
    public Coordenada sortear(RandomGenerator azar) {
        for (int intento = 0; intento < 200; intento++) {
            double longitud = minimaLongitud + azar.nextDouble() * (maximaLongitud - minimaLongitud);
            double latitud = minimaLatitud + azar.nextDouble() * (maximaLatitud - minimaLatitud);
            if (contiene(latitud, longitud)) {
                return new Coordenada(latitud, longitud);
            }
        }
        return new Coordenada((minimaLatitud + maximaLatitud) / 2, (minimaLongitud + maximaLongitud) / 2);
    }

    /** Trazado de un rayo hacia la derecha: cuenta cuántos lados del anillo cruza. */
    private static boolean dentroDe(double[][] anillo, double latitud, double longitud) {
        boolean dentro = false;
        for (int i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
            double longitudI = anillo[i][0];
            double latitudI = anillo[i][1];
            double longitudJ = anillo[j][0];
            double latitudJ = anillo[j][1];
            boolean cruza = (latitudI > latitud) != (latitudJ > latitud)
                    && longitud < (longitudJ - longitudI) * (latitud - latitudI) / (latitudJ - latitudI) + longitudI;
            if (cruza) {
                dentro = !dentro;
            }
        }
        return dentro;
    }
}
