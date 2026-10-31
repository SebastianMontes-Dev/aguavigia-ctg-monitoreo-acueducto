import { expect, test, type Page } from '@playwright/test'
import {
  asientosDeEjemplo, copiaDeEjemplo, cuentasDeEjemplo, metricasDeEjemplo, simularAdministracion, sinteticas, PERMISOS_ADMIN,
} from './panel-admin'

const PERMISOS_OBSERVADOR = ['VER_PANEL', 'CONFIGURAR_SEGUNDO_FACTOR']
const tabla = (page: Page) => page.getByRole('region', { name: 'Cuentas del panel y de los vecinos' })
const abrir = (page: Page, nombre: string) => page.getByRole('button', { name: `Abrir el detalle de ${nombre}` }).click()
const filaDe = (page: Page, nombre: string) => tabla(page).locator('tr', { hasText: nombre }).first()

test('debeDecirQueCuentasEsperanAprobacionSinContarLasSinteticas', async ({ page }) => {
  await simularAdministracion(page, { cuentas: [...sinteticas(60), ...cuentasDeEjemplo()] })
  await page.goto('/panel/cuentas')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('1 cuenta espera tu aprobación')
  const resumen = page.getByRole('region', { name: 'Resumen de las cuentas' })
  await expect(resumen.getByText('Esperan aprobación').locator('..')).toContainText('1')
  await expect(resumen.getByText('Invitaciones sin aceptar').locator('..')).toContainText('1')
  await expect(resumen).toContainText('Sin contar las cuentas sintéticas generadas por el sistema con las reglas de alta de un vecino')
})

test('debeOcultarLasSinteticasYSaltarLasPaginasHechasSoloDeEllasHastaLasCuentasDeVerdad', async ({ page }) => {
  const { visto } = await simularAdministracion(page, { cuentas: [...sinteticas(120), ...cuentasDeEjemplo()] })
  await page.goto('/panel/cuentas')
  await expect(tabla(page).getByText('Luis Mora', { exact: true })).toBeVisible()
  await expect(tabla(page).getByText('Marta Ruiz', { exact: true })).toBeVisible()
  await expect(tabla(page).getByText(/Vecino \d+/)).toHaveCount(0)
  await expect(tabla(page)).toContainText('se dejaron atrás 2 páginas hechas solo de ellas')
  await expect(tabla(page)).toContainText('20 cuentas sintéticas ocultas')
  // Las páginas 0 y 1 eran solo sintéticas: se pidieron seguidas, sin que nadie pulsara nada.
  expect(visto.listas.filter((busqueda) => /pagina=\d/.test(busqueda) && !busqueda.includes('estado=')).slice(0, 3)).toEqual([
    '?pagina=0&tamano=50', '?pagina=1&tamano=50', '?pagina=2&tamano=50',
  ])
})

test('debeMostrarLasSinteticasConElInterruptorYPaginarPorCabeceras', async ({ page }) => {
  await simularAdministracion(page, { cuentas: [...sinteticas(120), ...cuentasDeEjemplo()] })
  await page.goto('/panel/cuentas')
  await expect(tabla(page).getByText('Luis Mora', { exact: true })).toBeVisible()
  await tabla(page).getByRole('checkbox', { name: /Mostrar cuentas sintéticas/ }).check()
  await expect(tabla(page).getByText('Vecino 1', { exact: true })).toBeVisible()
  await expect(tabla(page)).toContainText('Página 1 de 3')
  await expect(tabla(page).getByRole('button', { name: 'Anterior' })).toBeDisabled()
  await tabla(page).getByRole('button', { name: 'Siguiente' }).click()
  await expect(tabla(page)).toContainText('Página 2 de 3')
  await expect(tabla(page).getByText('Vecino 51', { exact: true })).toBeVisible()
  await tabla(page).getByRole('button', { name: 'Anterior' }).click()
  await expect(tabla(page).getByText('Vecino 1', { exact: true })).toBeVisible()
})

test('debeFiltrarPorEstadoYDecirSiNingunaCuentaCoincide', async ({ page }) => {
  const { visto } = await simularAdministracion(page)
  await page.goto('/panel/cuentas')
  await tabla(page).getByLabel('Estado').selectOption('INVITADA')
  await expect(tabla(page).getByText('Pedro Gil', { exact: true })).toBeVisible()
  await expect(tabla(page).getByText('Luis Mora', { exact: true })).toHaveCount(0)
  expect(visto.listas.some((busqueda) => busqueda.includes('estado=INVITADA'))).toBe(true)
  await tabla(page).getByLabel('Estado').selectOption('RECHAZADA')
  await expect(tabla(page).getByText('Ninguna cuenta coincide con esos filtros.')).toBeVisible()
  await tabla(page).getByLabel('Barrio donde vive').selectOption('manga')
  expect(visto.listas.some((busqueda) => busqueda.includes('barrioId=manga'))).toBe(true)
})

test('debeInvitarYExplicarUnCorreoYaRegistradoJuntoAlCampo', async ({ page }) => {
  const { visto } = await simularAdministracion(page)
  await page.goto('/panel/cuentas')
  await page.getByRole('button', { name: 'Invitar a una persona' }).click()
  await page.getByLabel('Nombre').fill('Rosa Díaz')
  await page.getByLabel('Correo').fill('luismora@example.com')
  await page.getByLabel('Rol', { exact: true }).selectOption('VEEDOR')
  await page.getByRole('button', { name: 'Enviar la invitación' }).click()
  await expect(page.getByLabel('Correo')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert').filter({ hasText: 'Ya existe una cuenta con ese correo' })).toBeVisible()

  await page.getByLabel('Correo').fill('rosa@example.com')
  await page.getByRole('button', { name: 'Enviar la invitación' }).click()
  await expect(page.getByText(/Invitamos a Rosa Díaz \(rosa@example\.com\) como veedor/)).toBeVisible()
  await expect(tabla(page).getByText('Rosa Díaz', { exact: true })).toBeVisible()
  expect(visto.invitaciones).toEqual([
    { correo: 'luismora@example.com', nombre: 'Rosa Díaz', rol: 'VEEDOR' },
    { correo: 'rosa@example.com', nombre: 'Rosa Díaz', rol: 'VEEDOR' },
  ])
})

test('debeValidarLaInvitacionSinEnviarNada', async ({ page }) => {
  const { visto } = await simularAdministracion(page)
  await page.goto('/panel/cuentas')
  await page.getByRole('button', { name: 'Invitar a una persona' }).click()
  await page.getByRole('button', { name: 'Enviar la invitación' }).click()
  await expect(page.getByText('Escribe el nombre de la persona.')).toBeVisible()
  await expect(page.getByLabel('Nombre')).toBeFocused()
  expect(visto.invitaciones).toEqual([])
})

test('debeReenviarUnaInvitacionConConfirmacionConElNombre', async ({ page }) => {
  const { visto } = await simularAdministracion(page)
  await page.goto('/panel/cuentas')
  await abrir(page, 'Pedro Gil')
  await page.getByRole('button', { name: 'Reenviar la invitación: Pedro Gil' }).click()
  await expect(page.getByText(/¿Reenviar la invitación a Pedro Gil/)).toBeVisible()
  expect(visto.acciones).toEqual([])
  await page.getByRole('button', { name: 'Sí, reenviar a Pedro Gil' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Reenviamos la invitación a Pedro Gil' })).toBeVisible()
  expect(visto.acciones).toEqual([{ id: 'u4', accion: 'invitacion/reenvio', cuerpo: null }])
})

test('debeAprobarConRolYPermisosSueltosYMandarSoloLoQueCambio', async ({ page }) => {
  const { visto, cuentas } = await simularAdministracion(page)
  await page.goto('/panel/cuentas')
  await abrir(page, 'Marta Ruiz')
  await page.getByRole('button', { name: 'Aprobar con este acceso: Marta Ruiz' }).click()
  await page.getByLabel('Rol de Marta Ruiz').selectOption('VEEDOR')
  await page.getByRole('checkbox', { name: /Ver la auditoría/ }).check()
  await page.getByRole('checkbox', { name: /Revisar la ingesta/ }).uncheck()
  const segundoFactor = page.getByRole('checkbox', { name: /Configurar el segundo factor/ })
  await expect(segundoFactor).toBeChecked()
  await expect(segundoFactor).toBeDisabled()
  await page.getByRole('button', { name: 'Revisar la aprobación' }).click()
  await expect(page.getByText('Rol: Veedor (era Observador).')).toBeVisible()
  await expect(page.getByText('Se le suman: Ver la auditoría.')).toBeVisible()
  await expect(page.getByText('Se le quitan: Revisar la ingesta.')).toBeVisible()
  expect(visto.acciones).toEqual([])
  await page.getByRole('button', { name: 'Sí, aprobar a Marta Ruiz' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Aprobamos la cuenta de Marta Ruiz' })).toBeVisible()
  expect(visto.acciones).toEqual([{ id: 'u5', accion: 'aprobacion', cuerpo: { rol: 'VEEDOR', concedidos: ['VER_AUDITORIA'], revocados: ['REVISAR_INGESTA'] } }])
  expect(cuentas.find((fila) => fila.id === 'u5')?.estado).toBe('ACTIVA')
})

test('debeRechazarUnaSolicitudConConfirmacion', async ({ page }) => {
  const { visto } = await simularAdministracion(page)
  await page.goto('/panel/cuentas')
  await abrir(page, 'Marta Ruiz')
  await page.getByRole('button', { name: 'Rechazar: Marta Ruiz' }).click()
  await expect(page.getByText(/¿Rechazar la solicitud de Marta Ruiz/)).toBeVisible()
  await page.getByRole('button', { name: 'Sí, rechazar a Marta Ruiz' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Rechazamos la solicitud de Marta Ruiz' })).toBeVisible()
  expect(visto.acciones).toEqual([{ id: 'u5', accion: 'rechazo', cuerpo: null }])
})

test('debeSuspenderConConfirmacionConNombreYAvisoDeSesionesYDespuesReactivar', async ({ page }) => {
  const { visto } = await simularAdministracion(page)
  await page.goto('/panel/cuentas')
  await abrir(page, 'Luis Mora')
  await page.getByRole('button', { name: 'Suspender: Luis Mora' }).click()
  await expect(page.getByText(/¿Suspender la cuenta de Luis Mora \(luismora@example\.com\)\?/)).toBeVisible()
  await expect(page.getByText('Se cerrarán todas las sesiones abiertas de esa persona; tendrá que ingresar de nuevo.')).toBeVisible()
  expect(visto.acciones).toEqual([])
  await page.getByRole('button', { name: 'Sí, suspender a Luis Mora' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Suspendimos la cuenta de Luis Mora. Se cerraron sus sesiones abiertas.' })).toBeFocused()
  await expect(filaDe(page, 'Luis Mora')).toContainText('Suspendida')

  await abrir(page, 'Luis Mora')
  await page.getByRole('button', { name: 'Reactivar: Luis Mora' }).click()
  await page.getByRole('button', { name: 'Sí, reactivar a Luis Mora' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Reactivamos la cuenta de Luis Mora' })).toBeVisible()
  await expect(filaDe(page, 'Luis Mora')).toContainText('Activa')
  expect(visto.acciones.map((accion) => accion.accion)).toEqual(['suspension', 'reactivacion'])
})

test('debeCancelarUnaConfirmacionSinEnviarNada', async ({ page }) => {
  const { visto } = await simularAdministracion(page)
  await page.goto('/panel/cuentas')
  await abrir(page, 'Luis Mora')
  await page.getByRole('button', { name: 'Suspender: Luis Mora' }).click()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByText(/¿Suspender la cuenta/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Suspender: Luis Mora' })).toBeFocused()
  expect(visto.acciones).toEqual([])
})

test('debeCambiarElRolYAvisarQueCierraLasSesionesDeEsaPersona', async ({ page }) => {
  const { visto } = await simularAdministracion(page)
  await page.goto('/panel/cuentas')
  await abrir(page, 'Luis Mora')
  await page.getByRole('button', { name: 'Cambiar rol y permisos: Luis Mora' }).click()
  await expect(page.getByText('Todavía no cambiaste nada')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Revisar el cambio' })).toBeDisabled()
  await page.getByLabel('Rol de Luis Mora').selectOption('ADMIN')
  await page.getByRole('button', { name: 'Revisar el cambio' }).click()
  await expect(page.getByText('Rol: Administrador (era Veedor).')).toBeVisible()
  await expect(page.getByText(/Se cerrarán todas las sesiones abiertas/)).toBeVisible()
  await page.getByRole('button', { name: 'Sí, cambiar el acceso de Luis Mora' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Cambiamos el acceso de Luis Mora' })).toBeVisible()
  expect(visto.acciones).toEqual([{ id: 'u2', accion: 'permisos', cuerpo: { rol: 'ADMIN', concedidos: [], revocados: [] } }])
  await expect(filaDe(page, 'Luis Mora')).toContainText('Administrador')
})

test('noDebeOfrecerAccionesSobreLaPropiaCuentaDelAdmin', async ({ page }) => {
  const { visto } = await simularAdministracion(page)
  await page.goto('/panel/cuentas')
  await expect(filaDe(page, 'Ana Pérez')).toContainText('tu cuenta')
  await abrir(page, 'Ana Pérez')
  await expect(page.getByText('Es tu cuenta: no puedes cambiar tu propio acceso. Pídeselo a otro administrador.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Suspender|Cambiar rol|Reactivar|Aprobar|Rechazar/ })).toHaveCount(0)
  expect(visto.acciones).toEqual([])
})

test('debeExplicarUn409EnPantallaYActualizarLaLista', async ({ page }) => {
  await simularAdministracion(page, { conflictos: ['suspension'] })
  await page.goto('/panel/cuentas')
  await abrir(page, 'Luis Mora')
  await page.getByRole('button', { name: 'Suspender: Luis Mora' }).click()
  await page.getByRole('button', { name: 'Sí, suspender a Luis Mora' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'No se pudo suspender: la cuenta ya no está activa' })).toBeVisible()
})

test('noDebeEnviarDosVecesUnaSuspensionPulsadaConPrisa', async ({ page }) => {
  const { visto } = await simularAdministracion(page, { retardoMs: 400 })
  await page.goto('/panel/cuentas')
  await abrir(page, 'Luis Mora')
  await page.getByRole('button', { name: 'Suspender: Luis Mora' }).click()
  await page.getByRole('button', { name: 'Sí, suspender a Luis Mora' }).dblclick()
  await expect(page.getByRole('status').filter({ hasText: 'Suspendimos la cuenta de Luis Mora' })).toBeVisible()
  expect(visto.acciones).toHaveLength(1)
})

test('noDebeMostrarCuentasNiPedirlasSiFaltaGestionarUsuarios', async ({ page }) => {
  const { visto } = await simularAdministracion(page, { permisos: PERMISOS_OBSERVADOR })
  await page.goto('/panel')
  const secciones = page.getByRole('navigation', { name: 'Secciones del panel' })
  await expect(secciones.getByRole('link', { name: 'Sistema' })).toBeVisible()
  await expect(secciones.getByRole('link', { name: 'Cuentas' })).toHaveCount(0)
  await expect(secciones.getByRole('link', { name: 'Auditoría' })).toHaveCount(0)
  await page.goto('/panel/cuentas')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu cuenta no puede gestionar cuentas')
  await expect(page.getByRole('button', { name: /Invitar|Suspender/ })).toHaveCount(0)
  expect(visto.listas).toEqual([])
})

test('debeMostrarLaAuditoriaDeSoloLecturaConSusColumnas', async ({ page }) => {
  const { visto } = await simularAdministracion(page)
  await page.goto('/panel/auditoria')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Última acción: se suspendió una cuenta, hace \d+ min/)
  const tablaAuditoria = page.getByRole('region', { name: 'Acciones sobre cuentas y sesiones' })
  await expect(tablaAuditoria.getByText('Se cambió el acceso de una cuenta')).toBeVisible()
  await expect(tablaAuditoria.getByText('El sistema o alguien sin sesión')).toBeVisible()
  await expect(tablaAuditoria.getByText('10.0.0.1')).toBeVisible()
  await expect(tablaAuditoria.getByText('Asiento número 1')).toBeVisible()
  await expect(tablaAuditoria.getByRole('button', { name: /Editar|Borrar|Eliminar/ })).toHaveCount(0)
  await expect(tablaAuditoria).toContainText('el registro solo se anexa')
  expect(visto.auditoria[0]).toBe('?pagina=0&tamano=50')
})

test('debePaginarLaAuditoriaPorCabeceras', async ({ page }) => {
  const { visto } = await simularAdministracion(page, { auditoria: asientosDeEjemplo(60) })
  await page.goto('/panel/auditoria')
  const bloque = page.getByRole('region', { name: 'Acciones sobre cuentas y sesiones' })
  await expect(bloque).toContainText('Página 1 de 2')
  await expect(bloque.getByRole('button', { name: 'Anterior' })).toBeDisabled()
  await bloque.getByRole('button', { name: 'Siguiente' }).click()
  await expect(bloque).toContainText('Página 2 de 2')
  await expect(bloque.getByText('Asiento número 51')).toBeVisible()
  await expect(bloque.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  expect(visto.auditoria).toContain('?pagina=1&tamano=50')
})

test('debeDecirQueLaAuditoriaEstaVaciaYMostrarSuError', async ({ page }) => {
  await simularAdministracion(page, { auditoria: [] })
  await page.goto('/panel/auditoria')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Todavía no hay acciones registradas')
  await expect(page.getByRole('table')).toHaveCount(0)

  await page.unrouteAll()
  await simularAdministracion(page, { auditoria: 'error' })
  await page.goto('/panel/auditoria')
  // Un 500 se reintenta con espera antes de darse por fallo: la prueba espera ese tiempo.
  await expect(page.getByRole('alert')).toContainText('No pudimos consultar la auditoría', { timeout: 25_000 })
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
})

test('debeMostrarAccesoDenegadoEnLaAuditoriaSinElPermisoOSiElServidorLoNiega', async ({ page }) => {
  const { visto } = await simularAdministracion(page, { permisos: PERMISOS_OBSERVADOR })
  await page.goto('/panel/auditoria')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu cuenta no puede ver la auditoría')
  expect(visto.auditoria).toEqual([])

  await page.unrouteAll()
  await simularAdministracion(page, { auditoria: 'sin-permiso' })
  await page.goto('/panel/auditoria')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu cuenta no puede ver la auditoría')
})

test('debeMostrarLasMetricasConSuUnidadYDesdeCuando', async ({ page }) => {
  await simularAdministracion(page)
  await page.goto('/panel/sistema')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Contadores de este proceso desde hoy a las')
  const bloque = page.getByRole('region', { name: 'Métricas de calibración' })
  await expect(bloque).toContainText('Un reinicio del servidor los pone a cero')
  await expect(bloque.getByText('Barrios en disputa', { exact: true }).locator('..')).toContainText('3')
  await expect(bloque.getByText('Cambios de estado', { exact: true }).locator('..')).toContainText('7')
  await expect(bloque.getByText('Reportes recibidos', { exact: true }).locator('..')).toContainText('164')
  // Con 3 cambios medidos no se concluye nada sobre cuánto tarda.
  await expect(bloque).toContainText('3 cambios medidos: con menos de 5 todavía no se puede sacar una conclusión')
  await bloque.getByText('Ver el desglose de cada contador').click()
  await expect(bloque.getByText('Sin servicio por vecinos')).toBeVisible()
  await expect(bloque.getByText('Cuenta verificada')).toBeVisible()
})

test('debeDarElTiempoHastaElCambioCuandoLaMuestraAlcanza', async ({ page }) => {
  await simularAdministracion(page, { metricas: metricasDeEjemplo(8) })
  await page.goto('/panel/sistema')
  const bloque = page.getByRole('region', { name: 'Métricas de calibración' })
  await expect(bloque.getByText('Tarda en promedio', { exact: true }).locator('..')).toContainText('30 minutos')
  await expect(bloque.getByText('Lo más que tardó', { exact: true }).locator('..')).toContainText('1 hora y media')
})

test('debeMostrarLaCopiaCorrectaConSusConteos', async ({ page }) => {
  await simularAdministracion(page)
  await page.goto('/panel/sistema')
  const copia = page.getByRole('region', { name: 'Copia analítica (PostgreSQL)' })
  await expect(copia.getByText('Copia correcta')).toBeVisible()
  await expect(copia.getByRole('row', { name: /Pares corte-barrio 90 90 Sí/ })).toBeVisible()
})

test('debeMostrarUnaCopiaConDiferenciasConSuDetalle', async ({ page }) => {
  await simularAdministracion(page, {
    copias: [copiaDeEjemplo('CON_DIFERENCIAS', { enSql: { sectores: 211, cortes: 40, pares: 88 }, detalle: 'Faltan 2 pares corte-barrio en SQL' }), copiaDeEjemplo('OK', { id: 8 })],
  })
  await page.goto('/panel/sistema')
  const copia = page.getByRole('region', { name: 'Copia analítica (PostgreSQL)' })
  await expect(copia.getByText('Copiada con diferencias')).toBeVisible()
  await expect(copia.getByRole('row', { name: /Pares corte-barrio 90 88 No cuadra/ })).toBeVisible()
  await expect(copia).toContainText('Faltan 2 pares corte-barrio en SQL')
  await copia.getByText(/Ver las copias anteriores/).click()
  await expect(copia.getByText('Copia correcta')).toBeVisible()
})

test('debeMostrarUnaCopiaFallidaConElMotivo', async ({ page }) => {
  await simularAdministracion(page, { copias: [copiaDeEjemplo('FALLIDA', { terminadaEn: undefined, detalle: 'Conexión rechazada por PostgreSQL' })] })
  await page.goto('/panel/sistema')
  const copia = page.getByRole('region', { name: 'Copia analítica (PostgreSQL)' })
  await expect(copia.getByText('La copia falló')).toBeVisible()
  await expect(copia).toContainText('Por qué falló: Conexión rechazada por PostgreSQL')
})

test('debeDecirQueElSistemaFuncionaIgualCuandoLaCopiaDa503', async ({ page }) => {
  await simularAdministracion(page, { copias: 503 })
  await page.goto('/panel/sistema')
  const copia = page.getByRole('region', { name: 'Copia analítica (PostgreSQL)' })
  await expect(copia).toContainText('La copia analítica está apagada o PostgreSQL no responde; el sistema funciona igual')
  await expect(copia.getByRole('alert')).toHaveCount(0)
  // Las métricas no dependen de la copia.
  await expect(page.getByRole('region', { name: 'Métricas de calibración' })).toContainText('Barrios en disputa')
})

test('debeFallarPorSeparadoLasMetricasYLaCopia', async ({ page }) => {
  await simularAdministracion(page, { metricas: 'error', copias: 'error' })
  await page.goto('/panel/sistema')
  // Un 500 se reintenta con espera antes de darse por fallo: la prueba espera ese tiempo.
  await expect(page.getByRole('region', { name: 'Métricas de calibración' }).getByRole('alert')).toContainText('No pudimos consultar las métricas', { timeout: 25_000 })
  await expect(page.getByRole('region', { name: 'Copia analítica (PostgreSQL)' }).getByRole('alert')).toContainText('No pudimos consultar la copia analítica', { timeout: 25_000 })
})

test('debeDejarAlObservadorVerElSistemaSinNingunaAccion', async ({ page }) => {
  await simularAdministracion(page, { permisos: PERMISOS_OBSERVADOR })
  await page.goto('/panel/sistema')
  await expect(page.getByRole('region', { name: 'Copia analítica (PostgreSQL)' }).getByText('Copia correcta')).toBeVisible()
  await expect(page.getByRole('button', { name: /Aprobar|Suspender|Invitar|Borrar|Editar/ })).toHaveCount(0)
})

test('debeLlevarDelMenuAlasTresSeccionesNuevasDelAdmin', async ({ page }) => {
  await simularAdministracion(page, { permisos: PERMISOS_ADMIN })
  await page.goto('/panel/sistema')
  const secciones = page.getByRole('navigation', { name: 'Secciones del panel' })
  await secciones.getByRole('link', { name: 'Cuentas' }).click()
  await expect(page).toHaveURL(/\/panel\/cuentas$/)
  await secciones.getByRole('link', { name: 'Auditoría' }).click()
  await expect(page).toHaveURL(/\/panel\/auditoria$/)
  await secciones.getByRole('link', { name: 'Sistema' }).click()
  await expect(page).toHaveURL(/\/panel\/sistema$/)
  await expect(secciones.getByRole('link', { name: 'Sistema' })).toHaveAttribute('aria-current', 'page')
})
