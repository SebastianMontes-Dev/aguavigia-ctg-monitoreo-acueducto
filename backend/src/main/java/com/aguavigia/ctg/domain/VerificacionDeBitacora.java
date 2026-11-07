package com.aguavigia.ctg.domain;

/**
 * El estado de la cadena de hashes de la bitácora inmutable: cuántos eventos tiene, cuántos eslabones no cuadran (0 en una cadena sana)
 * y el hash del último, que resume toda la historia hasta ese punto. {@code ultimoHash} es nulo si la bitácora está vacía.
 */
public record VerificacionDeBitacora(long eventos, long eslabonesRotos, String ultimoHash) {

    public boolean cadenaValida() {
        return eslabonesRotos == 0;
    }
}
