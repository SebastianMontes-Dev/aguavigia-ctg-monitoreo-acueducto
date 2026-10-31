import { useMemo, useState } from 'react'
import { ComboBox, Input, Label, ListBox, ListBoxItem, Popover } from 'react-aria-components'
import { buscarSectores, nombreLegible, type Sector } from '../dominio/sectores'
import { Icono } from './Icono'
import estilos from './SelectorBarrio.module.css'

interface Props {
  sectores: readonly Sector[]
  valor?: string
  alCambiar: (id?: string) => void
  etiqueta?: string
  /** `pastilla` (ADR-104): en la barra junto al titular, con la etiqueta solo para el lector de pantalla. */
  forma?: 'linea' | 'pastilla'
  /** Lo que dice el campo vacío; «Todos los barrios» solo tiene sentido donde elegir uno es un filtro opcional. */
  marcador?: string
}

export function SelectorBarrio({ sectores, valor, alCambiar, etiqueta = 'Barrio', forma = 'linea', marcador = 'Todos los barrios' }: Props) {
  const [termino, setTermino] = useState('')
  const seleccionado = sectores.find((sector) => sector.id === valor)
  const opciones = useMemo(() => termino ? buscarSectores(sectores, termino, 211) : sectores,
    [sectores, termino])

  return (
    <div className={estilos.conjunto} data-forma={forma}>
      <ComboBox
        className={estilos.selector}
        selectedKey={valor ?? null}
        inputValue={termino || (seleccionado ? nombreLegible(seleccionado.nombre) : '')}
        onInputChange={setTermino}
        onSelectionChange={(clave) => {
          setTermino('')
          if (clave !== null) alCambiar(String(clave))
        }}
        items={opciones}
        menuTrigger="input"
        allowsEmptyCollection
      >
        <Label className={forma === 'pastilla' ? estilos.oculto : estilos.etiqueta}>{etiqueta}</Label>
        {forma === 'pastilla' ? (
          <div className={estilos.pastilla}>
            <Icono nombre="buscar" tamano={18} />
            <Input className={estilos.entradaPastilla} placeholder={marcador} autoComplete="off" spellCheck={false} />
          </div>
        ) : (
          <Input className={estilos.entrada} placeholder={marcador} autoComplete="off" spellCheck={false} />
        )}
        <Popover className={estilos.menu} offset={4}>
          <ListBox<Sector> className={estilos.lista} renderEmptyState={() => <p className={estilos.vacio}>No encontramos barrios con ese nombre</p>}>
            {(sector) => <ListBoxItem id={sector.id} textValue={nombreLegible(sector.nombre)} className={estilos.opcion}>
              {nombreLegible(sector.nombre)}
            </ListBoxItem>}
          </ListBox>
        </Popover>
      </ComboBox>
      {valor && <button type="button" className={estilos.limpiar} onClick={() => { setTermino(''); alCambiar(undefined) }}>Quitar barrio</button>}
    </div>
  )
}
