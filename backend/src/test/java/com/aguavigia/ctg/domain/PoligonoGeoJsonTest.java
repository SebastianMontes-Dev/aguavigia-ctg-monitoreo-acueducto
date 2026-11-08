package com.aguavigia.ctg.domain;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.SplittableRandom;

import static org.assertj.core.api.Assertions.assertThat;

class PoligonoGeoJsonTest {

    /** Un cuadrado de 0,05° de lado cerca de Cartagena; las coordenadas GeoJSON van como [longitud, latitud]. */
    private static Map<String, Object> cuadrado(double longitud, double latitud) {
        return Map.of("type", "Polygon", "coordinates", List.of(List.of(
                List.of(longitud, latitud), List.of(longitud + 0.05, latitud), List.of(longitud + 0.05, latitud + 0.05),
                List.of(longitud, latitud + 0.05), List.of(longitud, latitud))));
    }

    @Test
    void debeSaberSiUnPuntoCaeDentroDelPoligono() {
        PoligonoGeoJson poligono = PoligonoGeoJson.de(cuadrado(-75.55, 10.40));

        assertThat(poligono.contiene(10.425, -75.525)).isTrue();
        assertThat(poligono.contiene(10.50, -75.525)).isFalse();
        assertThat(poligono.contiene(10.425, -75.40)).isFalse();
    }

    @Test
    void debeSortearSiempreUnPuntoDentroDelBarrio() {
        PoligonoGeoJson poligono = PoligonoGeoJson.de(cuadrado(-75.55, 10.40));
        SplittableRandom azar = new SplittableRandom(7);

        for (int i = 0; i < 500; i++) {
            Coordenada punto = poligono.sortear(azar);
            assertThat(poligono.contiene(punto.latitud(), punto.longitud())).isTrue();
        }
    }

    @Test
    void debeLeerUnMultiPoligonoYAceptarPuntosDeCualquieraDeSusPartes() {
        Map<String, Object> multi = Map.of("type", "MultiPolygon", "coordinates", List.of(
                (List<?>) cuadrado(-75.55, 10.40).get("coordinates"),
                (List<?>) cuadrado(-75.30, 10.20).get("coordinates")));

        PoligonoGeoJson poligono = PoligonoGeoJson.de(multi);

        assertThat(poligono.contiene(10.425, -75.525)).isTrue();
        assertThat(poligono.contiene(10.225, -75.275)).isTrue();
        assertThat(poligono.contiene(10.30, -75.40)).isFalse();
    }

    @Test
    void debeIgnorarUnaGeometriaQueNoSePuedeLeer() {
        assertThat(PoligonoGeoJson.de(null)).isNull();
        assertThat(PoligonoGeoJson.de(Map.of("type", "Point", "coordinates", List.of(-75.5, 10.4)))).isNull();
        assertThat(PoligonoGeoJson.de(Map.of("type", "Polygon", "coordinates", "no-es-una-lista"))).isNull();
        assertThat(PoligonoGeoJson.de(Map.of("type", "Polygon", "coordinates", List.of()))).isNull();
    }
}
