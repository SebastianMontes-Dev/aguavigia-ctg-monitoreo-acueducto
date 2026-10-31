import { expect, test, type Page, type Route } from '@playwright/test'
import { problema, simularApi } from './api-simulada'

const PERMISOS_VEEDOR = ['VER_PANEL', 'MODERAR_REPORTES', 'GESTIONAR_CORTES', 'REVISAR_INGESTA', 'CONFIGURAR_SEGUNDO_FACTOR']
const PERMISOS_ADMIN = [...PERMISOS_VEEDOR, 'GESTIONAR_USUARIOS', 'VER_AUDITORIA']
const URI_TOTP = 'otpauth://totp/AguaVigia:admin@example.com?secret=JBSWY3DPEHPK3PXP&issuer=AguaVigia'

interface OpcionesPanel {
  sesion?: (route: Route, intento: number) => Promise<void>
  yo?: (route: Route) => Promise<void>
  confirmacion?: (route: Route, intento: number) => Promise<void>
}

function sesionEmitida(alcance: 'COMPLETO' | 'ALTA_SEGUNDO_FACTOR', permisos: string[]) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify({ token: `token-${alcance}`, usuarioId: 'u1', nombre: 'Ana Pérez', correo: 'ana@example.com', rol: 'VEEDOR', permisos, alcance }) }
}

function cuenta(permisos: string[], extra: Record<string, unknown> = {}) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'u1', nombre: 'Ana Pérez', correo: 'ana@example.com', estado: 'ACTIVA', rol: 'VEEDOR', permisosEfectivos: permisos, ...extra }) }
}

/** Simula `/api/veedor/**` y devuelve los cuerpos enviados, para comprobar qué se mandó en cada intento. */
async function simularPanel(page: Page, opciones: OpcionesPanel = {}) {
  await simularApi(page)
  const sesiones: Record<string, unknown>[] = []
  const cierres: string[] = []
  let confirmaciones = 0
  await page.route('**/api/veedor/sesion', async (route) => {
    sesiones.push(route.request().postDataJSON() as Record<string, unknown>)
    if (opciones.sesion) return opciones.sesion(route, sesiones.length)
    return route.fulfill(sesionEmitida('COMPLETO', PERMISOS_VEEDOR))
  })
  await page.route('**/api/veedor/sesion/cierre', (route) => {
    cierres.push(route.request().headers().authorization ?? '')
    return route.fulfill({ status: 204 })
  })
  await page.route('**/api/veedor/yo', opciones.yo ?? ((route) => route.fulfill(cuenta(PERMISOS_VEEDOR))))
  await page.route('**/api/veedor/segundo-factor/alta', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ uri: URI_TOTP, secreto: 'JBSWY3DPEHPK3PXP' }) }))
  await page.route('**/api/veedor/segundo-factor/confirmacion', (route) => {
    confirmaciones++
    if (opciones.confirmacion) return opciones.confirmacion(route, confirmaciones)
    return route.fulfill(sesionEmitida('COMPLETO', PERMISOS_ADMIN))
  })
  return { sesiones, cierres }
}

async function ingresar(page: Page) {
  await page.goto('/panel/ingreso')
  await page.getByLabel('Correo').fill('ana@example.com')
  await page.getByLabel('Clave', { exact: true }).fill('una clave larga y única')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
}

test('debeIngresarConClaveYCodigoYVerSoloLasSeccionesPermitidas', async ({ page }) => {
  const { sesiones } = await simularPanel(page, {
    sesion: (route, intento) => intento === 1
      ? route.fulfill(problema(401, 'segundo-factor-requerido', 'Falta el código'))
      : route.fulfill(sesionEmitida('COMPLETO', PERMISOS_VEEDOR)),
  })
  await ingresar(page)
  const codigo = page.getByLabel('Código de la app')
  await expect(codigo).toBeFocused()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await codigo.fill('12a3456')
  await expect(codigo).toHaveValue('123456')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()

  const secciones = page.getByRole('navigation', { name: 'Secciones del panel' })
  await expect(secciones.getByRole('link', { name: 'Moderación' })).toHaveAttribute('aria-current', 'page')
  await expect(secciones.getByRole('link', { name: 'Seguridad' })).toBeVisible()
  await expect(secciones.getByRole('link', { name: 'Cuentas' })).toHaveCount(0)
  await expect(secciones.getByRole('link', { name: 'Auditoría' })).toHaveCount(0)
  await expect(page.getByText('Ana Pérez')).toBeVisible()
  expect(sesiones[0]).not.toHaveProperty('codigoTotp')
  expect(sesiones[1]).toMatchObject({ correo: 'ana@example.com', codigoTotp: '123456' })
})

test('debeLlevarAlAdminSinTotpAlAltaYEntrarSinVolverAEscribirLaClave', async ({ page }) => {
  const { sesiones } = await simularPanel(page, {
    sesion: (route) => route.fulfill(sesionEmitida('ALTA_SEGUNDO_FACTOR', ['CONFIGURAR_SEGUNDO_FACTOR'])),
    yo: (route) => route.fulfill(cuenta(PERMISOS_ADMIN)),
    confirmacion: (route, intento) => intento === 1
      ? route.fulfill(problema(401, 'credencial-invalida', 'El código no coincide.'))
      : route.fulfill(sesionEmitida('COMPLETO', PERMISOS_ADMIN)),
  })
  await ingresar(page)
  await expect(page).toHaveURL(/\/panel\/segundo-factor$/)
  await expect(page.getByText('Tu cuenta de administrador necesita un segundo factor')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Activar segundo factor' })).toBeDisabled()

  await page.getByRole('button', { name: 'Generar código QR' }).click()
  await expect(page.locator('svg[aria-hidden="true"] path').first()).toBeVisible()
  await expect(page.getByText('JBSW Y3DP EHPK 3PXP')).toBeVisible()

  await page.getByLabel('Código de la app').fill('000000')
  await page.getByRole('button', { name: 'Activar segundo factor' }).click()
  await expect(page.getByRole('alert')).toContainText('El código no coincide')
  await expect(page).toHaveURL(/\/panel\/segundo-factor$/)

  await page.getByLabel('Código de la app').fill('123456')
  await page.getByRole('button', { name: 'Activar segundo factor' }).click()
  const secciones = page.getByRole('navigation', { name: 'Secciones del panel' })
  await expect(secciones.getByRole('link', { name: 'Cuentas' })).toBeVisible()
  await expect(secciones.getByRole('link', { name: 'Auditoría' })).toBeVisible()
  expect(sesiones).toHaveLength(1)
  expect(await page.evaluate(() => sessionStorage.getItem('aguavigia.panel.alcance'))).toBe('COMPLETO')
})

test('debeExplicarCadaRechazoDelIngresoSinDecirQueCampoFallo', async ({ page }) => {
  const respuestas = [
    problema(401, 'credencial-invalida', 'Credenciales inválidas'),
    { ...problema(423, 'cuenta-bloqueada', 'Bloqueada'), body: JSON.stringify({ type: 'https://aguavigia.example/errores/cuenta-bloqueada', status: 423, detail: 'Bloqueada', segundosRestantes: 840 }) },
    { ...problema(403, 'cuenta-no-habilitada', 'No habilitada'), body: JSON.stringify({ type: 'https://aguavigia.example/errores/cuenta-no-habilitada', status: 403, detail: 'No habilitada', estado: 'PENDIENTE_APROBACION' }) },
  ]
  await simularPanel(page, { sesion: (route, intento) => route.fulfill(respuestas[intento - 1] ?? respuestas[0]!) })
  await ingresar(page)
  await expect(page.getByRole('alert')).toHaveText('Correo o clave incorrectos.')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Podrás ingresar en 14 minutos')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Falta que un administrador apruebe la cuenta')
})

test('debeVolverAlIngresoConAvisoCuandoLaSesionTermina', async ({ page }) => {
  await simularPanel(page, { yo: (route) => route.fulfill(problema(401, 'sesion-sin-cuenta', 'Sesión revocada')) })
  await page.goto('/panel/ingreso')
  await page.evaluate(() => {
    sessionStorage.setItem('aguavigia.panel.token', 'revocado')
    sessionStorage.setItem('aguavigia.panel.alcance', 'COMPLETO')
  })
  await page.goto('/panel')
  await expect(page).toHaveURL(/\/panel\/ingreso\?motivo=vencida$/)
  await expect(page.getByText('Tu sesión terminó. Ingresa de nuevo.')).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('aguavigia.panel.token'))).toBeNull()
})

test('debeCerrarLaSesionEnElServidorYOlvidarLaCuenta', async ({ page }) => {
  const { cierres } = await simularPanel(page)
  await ingresar(page)
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/panel\/ingreso\?motivo=cerrada$/)
  await expect(page.getByText('Cerraste la sesión en este equipo y en los demás')).toBeVisible()
  expect(cierres).toEqual(['Bearer token-COMPLETO'])
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0)
  await page.goto('/panel')
  await expect(page).toHaveURL(/\/panel\/ingreso$/)
})

test('debeOfrecerElAccesoDelVeedorAlFinalDelMenuPublico', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'En escritorio el menú está desplegado en la cabecera')
  await simularApi(page)
  await page.goto('/bitacora')
  await page.getByRole('button', { name: 'Menú' }).click()
  await page.getByRole('link', { name: 'Acceso al panel' }).click()
  await expect(page.getByRole('heading', { name: 'Ingreso al panel' })).toBeVisible()
})

test('noDebeDesbordarseEnElCelular', async ({ page }) => {
  await simularPanel(page)
  await ingresar(page)
  await expect(page.getByRole('navigation', { name: 'Secciones del panel' })).toBeVisible()
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(desborde).toBeLessThanOrEqual(0)
})

async function irASeguridad(page: Page) {
  await ingresar(page)
  await page.getByRole('navigation', { name: 'Secciones del panel' }).getByRole('link', { name: 'Seguridad' }).click()
}

test('debeCambiarLaClaveAvisandoElCierreDeSesionesYVolverAlIngresoConElMotivo', async ({ page }) => {
  await simularPanel(page)
  const cambios: Record<string, unknown>[] = []
  await page.route('**/api/veedor/cuenta/clave', (route) => {
    cambios.push(route.request().postDataJSON() as Record<string, unknown>)
    return route.fulfill({ status: 204 })
  })
  await irASeguridad(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu cuenta se protege solo con la clave')
  await expect(page.getByText('Al cambiarla se cierran todas tus sesiones')).toBeVisible()

  await page.getByLabel('Clave actual', { exact: true }).fill('la clave de hoy')
  await page.getByLabel('Clave nueva', { exact: true }).fill('corta')
  await page.getByRole('button', { name: /Cambiar clave y cerrar sesiones/ }).click()
  await expect(page.getByLabel('Clave nueva', { exact: true })).toBeFocused()
  await expect(page.getByLabel('Clave nueva', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Usa al menos 12 caracteres.')).toBeVisible()
  expect(cambios).toHaveLength(0)

  await page.getByRole('button', { name: 'Mostrar clave nueva' }).click()
  await expect(page.getByLabel('Clave nueva', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByLabel('Clave nueva', { exact: true }).fill('una clave nueva y larga')
  await page.getByRole('button', { name: /Cambiar clave y cerrar sesiones/ }).click()
  await expect(page).toHaveURL(/\/panel\/ingreso\?motivo=clave$/)
  await expect(page.getByText('Cambiaste tu clave y se cerraron todas las sesiones')).toBeVisible()
  expect(cambios).toEqual([{ claveActual: 'la clave de hoy', claveNueva: 'una clave nueva y larga' }])
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0)
})

test('debeMostrarElDetalleDelServidorSiRechazaLaClaveYConservarLaSesion', async ({ page }) => {
  await simularPanel(page)
  await page.route('**/api/veedor/cuenta/clave', (route) => route.fulfill(problema(400, 'peticion-invalida', 'La clave actual no es correcta.')))
  await irASeguridad(page)
  await page.getByLabel('Clave actual', { exact: true }).fill('la clave de hoy')
  await page.getByLabel('Clave nueva', { exact: true }).fill('una clave nueva y larga')
  await page.getByRole('button', { name: /Cambiar clave y cerrar sesiones/ }).click()
  await expect(page.getByRole('alert')).toHaveText('La clave actual no es correcta.')
  await expect(page).toHaveURL(/\/panel\/seguridad$/)
})

test('debeDesactivarElSegundoFactorConSuCodigoYPedirIngresarDeNuevo', async ({ page }) => {
  await simularPanel(page, { yo: (route) => route.fulfill(cuenta(PERMISOS_VEEDOR, { segundoFactorActivo: true })) })
  const codigos: string[] = []
  await page.route('**/api/veedor/segundo-factor/baja', (route) => {
    codigos.push((route.request().postDataJSON() as { codigo: string }).codigo)
    return codigos.length === 1 ? route.fulfill(problema(401, 'credencial-invalida', 'El código no coincide.')) : route.fulfill({ status: 204 })
  })
  await irASeguridad(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu cuenta pide un código además de la clave')
  await expect(page.getByText('Al desactivarlo se cierran todas tus sesiones')).toBeVisible()
  await page.getByLabel('Código de la app').fill('000000')
  await page.getByRole('button', { name: 'Desactivar y cerrar sesiones' }).click()
  await expect(page.getByLabel('Código de la app')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('El código no coincide o ya se usó')).toBeVisible()
  await page.getByLabel('Código de la app').fill('123456')
  await page.getByRole('button', { name: 'Desactivar y cerrar sesiones' }).click()
  await expect(page).toHaveURL(/\/panel\/ingreso\?motivo=segundo-factor$/)
  expect(codigos).toEqual(['000000', '123456'])
})

test('noDebeOfrecerDesactivarElSegundoFactorAUnAdmin', async ({ page }) => {
  await simularPanel(page, { yo: (route) => route.fulfill(cuenta(PERMISOS_ADMIN, { rol: 'ADMIN', segundoFactorActivo: true })) })
  await irASeguridad(page)
  await expect(page.getByText('El rol de administrador lo exige: no se puede desactivar.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Desactivar/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Cambiar de teléfono' })).toBeVisible()
})

test('debePedirElCodigoActualAlCambiarDeTelefonoYNoGenerarElQrSinEl', async ({ page }) => {
  await simularPanel(page, { yo: (route) => route.fulfill(cuenta(PERMISOS_VEEDOR, { segundoFactorActivo: true })) })
  const altas: unknown[] = []
  await page.route('**/api/veedor/segundo-factor/alta', (route) => {
    altas.push(route.request().postDataJSON())
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ uri: URI_TOTP, secreto: 'JBSWY3DPEHPK3PXP' }) })
  })
  await irASeguridad(page)
  await page.getByRole('link', { name: 'Cambiar de teléfono' }).click()
  await expect(page.getByRole('button', { name: 'Generar código QR' })).toBeDisabled()
  await page.getByLabel('Código actual de la app').fill('654321')
  await page.getByRole('button', { name: 'Generar código QR' }).click()
  await expect(page.getByText('JBSW Y3DP EHPK 3PXP')).toBeVisible()
  expect(altas).toEqual([{ codigo: '654321' }])
})

test('debeConfirmarAntesDeCerrarTodasLasSesiones', async ({ page }) => {
  const { cierres } = await simularPanel(page)
  await irASeguridad(page)
  await page.getByRole('button', { name: 'Cerrar todas mis sesiones' }).click()
  await expect(page.getByText('Se cerrarán todas tus sesiones, también esta.')).toBeVisible()
  expect(cierres).toHaveLength(0)
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByText('Se cerrarán todas tus sesiones, también esta.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Cerrar todas mis sesiones' }).click()
  await page.getByRole('button', { name: 'Sí, cerrar todas' }).click()
  await expect(page).toHaveURL(/\/panel\/ingreso\?motivo=cerrada$/)
  expect(cierres).toEqual(['Bearer token-COMPLETO'])
})
