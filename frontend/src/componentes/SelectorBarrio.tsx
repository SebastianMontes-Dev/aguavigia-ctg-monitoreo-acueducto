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
  /** `pastilla` (ADR-104): en la barra junto al titular, con la etiqueta solo para el lector de pantalla. `campo`: la misma pastilla a la altura de un campo de formulario (48 px). */
  forma?: 'linea' | 'pastilla' | 'campo'
  /** Un formulario que rechazó la elección: borde de 2 px en tinta y `aria-invalid`; `descritoPor` apunta al texto del error. */
  invalido?: boolean
  descritoPor?: string
  /** Pone a la vista la etiqueta de la forma `campo`, donde el formulario no trae la suya (el registro y el perfil del vecino). */
  etiquetaVisible?: boolean
  /** Lo que dice el campo vacío; «Todos los barrios» solo tiene sentido donde elegir uno es un filtro opcional. */
  marcador?: string
  /** Sin «Quitar barrio»: donde el barrio es obligatorio, como en el perfil del vecino. */
  sinQuitar?: boolean
}

export function SelectorBarrio({ sectores, valor, alCambiar, etiqueta = 'Barrio', forma = 'linea', marcador = 'Todos los barrios', invalido, descritoPor, etiquetaVisible = false, sinQuitar = false }: Props) {
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
        isInvalid={invalido}
        aria-describedby={descritoPor}
        allowsEmptyCollection
      >
        <Label className={forma === 'linea' || etiquetaVisible ? estilos.etiqueta : estilos.oculto}>{etiqueta}</Label>
        {forma !== 'linea' ? (
          <div className={estilos.pastilla} data-invalido={invalido ? true : undefined}>
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
      {valor && !sinQuitar && <button type="button" className={estilos.limpiar} onClick={() => { setTermino(''); alCambiar(undefined) }}>Quitar barrio</button>}
    </div>
  )
}
