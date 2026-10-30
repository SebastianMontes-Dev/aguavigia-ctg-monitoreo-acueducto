import { Document, Font, Page, pdf, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import type { ColumnaGrafica, Novedad } from '../../dominio/estadisticas'
import { formatearNumero } from '../../dominio/formato'
import tokens from '../../estilos/tokens.css?raw'

const COLUMNAS_MINIMAS = 4
// Alturas fijas, en puntos: con porcentajes la barra más alta empuja su columna y saca el pie de la gráfica.
const ALTO_CUERPO = 124
const RELLENO_CUERPO = 6
const ALTO_VALOR = 14
const ALTO_PIE = 14
const ALTO_BASE = 12

export type ContenidoGrafica =
  | { tipo: 'columnas'; columnas: readonly ColumnaGrafica[] }
  | { tipo: 'barras'; novedades: readonly Novedad[]; resaltar: boolean }
  | { tipo: 'aviso'; texto: string }

export interface Informe {
  claveDia: string
  generado: string
  titular: string
  nota: string | null
  cifras: readonly { etiqueta: string; valor: string }[]
  graficas: readonly { titulo: string; bajada: string; contenido: ContenidoGrafica }[]
  bajadaBarrios: string
  barrios: readonly { clave: string; nombre: string; cortes: string | null }[]
  reglas: readonly string[]
}

/** El papel es blanco aunque la página esté en oscuro: los colores salen del tema claro, el primer bloque de tokens.css. */
const claro = (token: string) => new RegExp(`--${token}: (#[0-9a-f]{6})`).exec(tokens)?.[1] ?? 'black'

const colores = {
  tinta: claro('tinta'),
  tinta2: claro('tinta-2'),
  tinta3: claro('tinta-3'),
  linea: claro('linea'),
  lineaSuave: claro('linea-suave'),
  cardenillo: claro('cardenillo'),
}

/** ADR-071: la serif solo en la marca y el titular; las cifras van en Helvetica, de dígitos tabulares. */
const CUERPO = 'Helvetica'
// El PDF no incrusta fuentes variables: estos dos archivos son el woff2 de la página fijado en los pesos de la marca y el titular.
Font.register({
  family: 'Newsreader',
  fonts: [
    { src: '/fuentes/newsreader-latin-300.ttf', fontWeight: 300 },
    { src: '/fuentes/newsreader-latin-500.ttf', fontWeight: 500 },
  ],
})
// La librería parte las palabras en inglés: en español rompería las palabras al final de la línea.
Font.registerHyphenationCallback((palabra) => [palabra])

const e = StyleSheet.create({
  hoja: { paddingVertical: 34, paddingHorizontal: 40, gap: 10, fontFamily: CUERPO, fontSize: 9, lineHeight: 1.35, color: colores.tinta },
  membrete: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingBottom: 6, borderBottomWidth: 0.75, borderBottomColor: colores.tinta, color: colores.tinta2, fontSize: 8.5 },
  marca: { fontFamily: 'Newsreader', fontWeight: 500, fontSize: 14, color: colores.tinta },
  cabecera: { gap: 3 },
  rotulo: { fontSize: 7.5, letterSpacing: 1, textTransform: 'uppercase', color: colores.tinta2 },
  titular: { fontFamily: 'Newsreader', fontWeight: 300, fontSize: 22, lineHeight: 1.1 },
  nota: { fontSize: 8.5, color: colores.tinta2 },
  bloque: { borderWidth: 0.75, borderColor: colores.linea, borderRadius: 7, paddingVertical: 8.5, paddingHorizontal: 11 },
  cifras: { flexDirection: 'row', paddingVertical: 7 },
  cifra: { flex: 1, paddingHorizontal: 11, borderLeftWidth: 0.75, borderLeftColor: colores.linea },
  primeraCifra: { flex: 1, paddingRight: 11 },
  valorCifra: { fontFamily: CUERPO, fontWeight: 'bold', fontSize: 15, lineHeight: 1.2, marginBottom: 2 },
  etiquetaCifra: { fontSize: 8, color: colores.tinta2 },
  fila: { flexDirection: 'row', gap: 10 },
  ultimaFila: { flexDirection: 'row', gap: 10, flexGrow: 1 },
  panel: { flex: 1, gap: 4 },
  titulo: { fontFamily: CUERPO, fontWeight: 'bold', fontSize: 10.5 },
  bajada: { fontSize: 8, color: colores.tinta2 },
  cuerpo: { height: ALTO_CUERPO, paddingTop: RELLENO_CUERPO, borderTopWidth: 0.75, borderTopColor: colores.lineaSuave },
  columnas: { flexDirection: 'row', marginHorizontal: -3 },
  columna: { paddingHorizontal: 3 },
  caja: { height: ALTO_VALOR },
  valor: { fontFamily: CUERPO, fontWeight: 'bold', fontSize: 8.5, lineHeight: 1, textAlign: 'center' },
  area: { justifyContent: 'flex-end' },
  linea: { borderBottomWidth: 0.75, borderBottomColor: colores.tinta },
  sinDato: { borderBottomStyle: 'dashed', borderBottomColor: colores.tinta3 },
  barra: { backgroundColor: colores.cardenillo, opacity: 0.62, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  destacada: { opacity: 1 },
  pie: { height: ALTO_PIE, justifyContent: 'flex-end' },
  abreviado: { fontSize: 8, lineHeight: 1, color: colores.tinta2, textAlign: 'center' },
  abreviadoDestacado: { fontFamily: CUERPO, fontWeight: 'bold', color: colores.tinta },
  base: { height: ALTO_BASE },
  textoBase: { fontSize: 7, lineHeight: 1, color: colores.tinta2, textAlign: 'center' },
  barras: { flexGrow: 1, justifyContent: 'space-between' },
  novedad: { gap: 2 },
  renglon: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 8.5 },
  fuerte: { fontFamily: CUERPO, fontWeight: 'bold' },
  pista: { height: 7 },
  relleno: { height: '100%', minWidth: 2, backgroundColor: colores.cardenillo, opacity: 0.62, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  aviso: { fontSize: 8.5, color: colores.tinta2 },
  barrios: { flexGrow: 1, borderTopWidth: 0.75, borderTopColor: colores.lineaSuave },
  barrio: { flexDirection: 'row', flexGrow: 1, alignItems: 'center', justifyContent: 'space-between', fontSize: 9 },
  conLinea: { borderTopWidth: 0.75, borderTopColor: colores.lineaSuave },
  regla: { paddingVertical: 2.5, fontSize: 7.5, color: colores.tinta2 },
})

function Panel({ titulo, bajada, children }: { titulo: string; bajada?: string; children: ReactNode }) {
  return (
    <View style={[e.bloque, e.panel]}>
      <Text style={e.titulo}>{titulo}</Text>
      {bajada && <Text style={e.bajada}>{bajada}</Text>}
      {children}
    </View>
  )
}

function Columnas({ columnas }: { columnas: readonly ColumnaGrafica[] }) {
  const maximo = Math.max(1, ...columnas.map((columna) => columna.medida ?? 0))
  const ancho = `${100 / Math.max(columnas.length, COLUMNAS_MINIMAS)}%`
  const conBase = columnas.some((columna) => columna.base)
  const altoBarras = ALTO_CUERPO - RELLENO_CUERPO - ALTO_VALOR - ALTO_PIE - (conBase ? ALTO_BASE : 0) - 1
  return (
    <View style={e.columnas}>
      {columnas.map(({ clave, abreviado, valor, medida, base, destacada }) => (
        <View key={clave} style={[e.columna, { width: ancho }]}>
          <View style={e.caja}><Text style={e.valor}>{valor ?? '–'}</Text></View>
          <View style={[e.area, { height: altoBarras }]}>
            {valor !== null && <View style={[e.barra, { height: (medida ?? 0) / maximo * altoBarras }, ...(destacada ? [e.destacada] : [])]} />}
          </View>
          <View style={valor === null ? [e.linea, e.sinDato] : e.linea} />
          <View style={e.pie}><Text style={destacada ? [e.abreviado, e.abreviadoDestacado] : e.abreviado}>{abreviado}</Text></View>
          {conBase && <View style={e.base}><Text style={e.textoBase}>{base}</Text></View>}
        </View>
      ))}
    </View>
  )
}

function Barras({ novedades, resaltar }: { novedades: readonly Novedad[]; resaltar: boolean }) {
  const maximo = Math.max(1, ...novedades.map((novedad) => novedad.eventos ?? 0))
  return (
    <View style={e.barras}>
      {novedades.map(({ tipo, nombre, eventos }, indice) => (
        <View key={tipo} style={e.novedad}>
          <View style={e.renglon}>
            <Text>{nombre}</Text>
            <Text style={e.fuerte}>{eventos === null ? 'Sin dato' : formatearNumero(eventos)}</Text>
          </View>
          <View style={e.pista}>
            {eventos !== null && <View style={[e.relleno, { width: `${eventos / maximo * 100}%` }, ...(resaltar && indice === 0 ? [e.destacada] : [])]} />}
          </View>
        </View>
      ))}
    </View>
  )
}

function Contenido({ contenido }: { contenido: ContenidoGrafica }) {
  if (contenido.tipo === 'columnas') return <Columnas columnas={contenido.columnas} />
  if (contenido.tipo === 'barras') return <Barras novedades={contenido.novedades} resaltar={contenido.resaltar} />
  return <Text style={e.aviso}>{contenido.texto}</Text>
}

function Hoja({ informe }: { informe: Informe }) {
  const pares = [informe.graficas.slice(0, 2), informe.graficas.slice(2, 4)]
  return (
    <Document title={`Estadísticas · AguaVigía Cartagena · ${informe.claveDia}`} author="AguaVigía CTG" creator="AguaVigía CTG" producer="AguaVigía CTG" language="es">
      <Page size="A4" wrap={false} style={e.hoja}>
        <View style={e.membrete}>
          <Text style={e.marca}>AguaVigía</Text>
          <Text>Cartagena · Generado el {informe.generado}</Text>
        </View>
        <View style={e.cabecera}>
          <Text style={e.rotulo}>Estadísticas · todos los cortes registrados</Text>
          <Text style={e.titular}>{informe.titular}</Text>
          {informe.nota && <Text style={e.nota}>{informe.nota}</Text>}
        </View>
        <View style={[e.bloque, e.cifras]}>
          {informe.cifras.map(({ etiqueta, valor }, indice) => (
            <View key={indice} style={indice === 0 ? e.primeraCifra : e.cifra}>
              <Text style={e.valorCifra}>{valor}</Text>
              <Text style={e.etiquetaCifra}>{etiqueta}</Text>
            </View>
          ))}
        </View>
        {pares.map((par, indice) => (
          <View key={indice} style={e.fila}>
            {par.map(({ titulo, bajada, contenido }) => (
              <Panel key={titulo} titulo={titulo} bajada={bajada}>
                <View style={e.cuerpo}><Contenido contenido={contenido} /></View>
              </Panel>
            ))}
          </View>
        ))}
        <View style={e.ultimaFila}>
          <Panel titulo="Barrios con más cortes" bajada={informe.bajadaBarrios}>
            {informe.barrios.length === 0 ? <Text style={e.aviso}>Todavía no hay cortes registrados por barrio.</Text> : (
              <View style={e.barrios}>
                {informe.barrios.map(({ clave, nombre, cortes }, indice) => (
                  <View key={clave} style={indice === 0 ? e.barrio : [e.barrio, e.conLinea]}>
                    <Text>{nombre}</Text>
                    {cortes && <Text style={e.fuerte}>{cortes}</Text>}
                  </View>
                ))}
              </View>
            )}
          </Panel>
          <Panel titulo="Cómo se mide">
            <View>
              {informe.reglas.map((regla) => <Text key={regla} style={[e.regla, e.conLinea]}>{regla}</Text>)}
            </View>
          </Panel>
        </View>
      </Page>
    </Document>
  )
}

/** `ADR-106`: se genera en el navegador y baja como archivo, sin pasar por el diálogo de impresión. */
export async function descargarInforme(informe: Informe): Promise<void> {
  const archivo = await pdf(<Hoja informe={informe} />).toBlob()
  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `aguavigia-estadisticas-${informe.claveDia}.pdf`
  enlace.click()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
