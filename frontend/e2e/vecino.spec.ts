import { expect, test, type Page } from '@playwright/test'
import { CLAVE_SESION_PANEL, CLAVE_SESION_VECINO, conEspera, conSesionDeVecino, json, perfilDeEjemplo, problema, simularVecino } from './vecino'

const NEUTRO_VECINO = 'Si la dirección es válida, te enviamos un correo con un enlace para elegir tu clave.'
// Dentro del cuadro de Armenia en la geometría simulada.
const EN_ARMENIA = { latitude: 10.408, longitude: -75.502 }

async function elegirBarrio(page: Page, buscar: string, opcion: RegExp) {
  const campo = page.getByRole('combobox', { name: 'Tu barrio' })
  const coincidencia = page.getByRole('option', { name: opcion })
  await campo.fill(buscar)
  // Con la máquina cargada el menú a veces no se abre con el primer evento: se vuelve a teclear una vez.
  await coincidencia.first().waitFor({ timeout: 3000 }).catch(async () => {
    await campo.clear()
    await campo.pressSequentially(buscar)
  })
  await coincidencia.click()
}

async function ingresar(page: Page, clave = 'una clave larga y unica') {
  await page.goto('/vecino/ingreso')
  await page.getByLabel('Correo', { exact: true }).fill('vera@example.com')
  await page.getByLabel('Clave', { exact: true }).fill(clave)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
}

test.describe('registro', () => {
  test('noDebePedirNadaSinBarrioNiPrivacidadYPonerCadaErrorJuntoASuCampo', async ({ page }) => {
    await simularVecino(page)
    let peticiones = 0
    await page.route('**/api/cuentas/vecino', (route) => {
      peticiones++
      return route.fulfill({ status: 202 })
    })
    await page.goto('/vecino/registro')
    await page.getByLabel('Correo', { exact: true }).fill('vera@example.com')
    await page.getByLabel('Nombre', { exact: true }).fill('Vera Soto')
    await page.getByRole('button', { name: /Crear mi cuenta/ }).click()
    await expect(page.getByText('Elige tu barrio de la lista.')).toBeVisible()
    await expect(page.getByText('Para crear la cuenta tienes que aceptarlo.')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Tu barrio' })).toBeFocused()
    expect(peticiones).toBe(0)
    await elegirBarrio(page, 'arm', /Armenia/)
    await page.getByRole('button', { name: /Crear mi cuenta/ }).click()
    await expect(page.getByText('Elige tu barrio de la lista.')).toHaveCount(0)
    await expect(page.getByLabel(/Acepto que AguaVigía guarde/)).toBeFocused()
    expect(peticiones).toBe(0)
  })

  test('debeRegistrarConBarrioYConsentimientoSinMandarClaveYDecirLoMismoSiempre', async ({ page }) => {
    await simularVecino(page)
    const cuerpos: Record<string, unknown>[] = []
    await page.route('**/api/cuentas/vecino', (route) => {
      cuerpos.push(route.request().postDataJSON() as Record<string, unknown>)
      return route.fulfill({ status: 202 })
    })
    await page.goto('/vecino/registro')
    await page.getByLabel('Correo', { exact: true }).fill('vera@example.com')
    await page.getByLabel('Nombre', { exact: true }).fill('Vera Soto')
    await elegirBarrio(page, 'manga', /Manga/)
    await page.getByLabel(/Acepto que AguaVigía guarde/).check()
    await page.getByRole('button', { name: /Crear mi cuenta/ }).click()
    await expect(page.getByRole('status')).toHaveText(NEUTRO_VECINO)
    await expect(page.getByText(/queda activa como vecino de Manga/)).toBeVisible()
    expect(cuerpos).toEqual([{ correo: 'vera@example.com', nombre: 'Vera Soto', barrioId: 'manga', consentimiento: { privacidad: true, avisos: false } }])
    await expect(page.getByRole('link', { name: /Reenviar el correo/ })).toHaveAttribute('href', '/cuenta/reenviar')
  })

  test('debeEnviarLaCasillaDeAvisosSoloSiSeMarca', async ({ page }) => {
    await simularVecino(page)
    const cuerpos: { consentimiento: { avisos: boolean } }[] = []
    await page.route('**/api/cuentas/vecino', (route) => {
      cuerpos.push(route.request().postDataJSON() as { consentimiento: { avisos: boolean } })
      return route.fulfill({ status: 202 })
    })
    await page.goto('/vecino/registro')
    await page.getByLabel('Correo', { exact: true }).fill('vera@example.com')
    await page.getByLabel('Nombre', { exact: true }).fill('Vera Soto')
    await elegirBarrio(page, 'arm', /Armenia/)
    await page.getByLabel(/Acepto que AguaVigía guarde/).check()
    await page.getByLabel(/avisos de cortes de mi barrio/).check()
    await page.getByRole('button', { name: /Crear mi cuenta/ }).click()
    await expect(page.getByRole('status')).toBeVisible()
    expect(cuerpos[0]?.consentimiento.avisos).toBe(true)
  })

  test('debeRepartirElDetalleDelServidorYRespetarElLimite', async ({ page }) => {
    await simularVecino(page)
    let intento = 0
    await page.route('**/api/cuentas/vecino', (route) => {
      intento++
      if (intento === 1) {
        return route.fulfill({ status: 400, contentType: 'application/problem+json', body: JSON.stringify({
          type: 'https://aguavigia.example/errores/peticion-invalida', status: 400, detail: 'Datos inválidos', errores: ['nombre: El nombre es demasiado largo'],
        }) })
      }
      return route.fulfill(conEspera(problema(429, 'limite-de-peticiones-excedido', 'Límite'), 300))
    })
    await page.goto('/vecino/registro')
    await page.getByLabel('Correo', { exact: true }).fill('vera@example.com')
    await page.getByLabel('Nombre', { exact: true }).fill('Vera Soto')
    await elegirBarrio(page, 'arm', /Armenia/)
    await page.getByLabel(/Acepto que AguaVigía guarde/).check()
    await page.getByRole('button', { name: /Crear mi cuenta/ }).click()
    await expect(page.getByText('El nombre es demasiado largo')).toBeVisible()
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await page.getByRole('button', { name: /Crear mi cuenta/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Podrás volver a intentarlo en 5 minutos' })).toBeVisible()
  })

  test('noDebeAlargarseMasDeDosPantallasEnElCelular', async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'La altura se mide en el celular (ADR-077).')
    await simularVecino(page)
    await page.goto('/vecino/registro')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const alto = await page.evaluate(() => ({ pagina: document.documentElement.scrollHeight, ventana: window.innerHeight }))
    expect(alto.pagina).toBeLessThanOrEqual(alto.ventana * 2)
  })
})

test.describe('ingreso', () => {
  test('debeIngresarGuardarElTokenSoloEnLaSesionDelVecinoYLlevarAlPerfil', async ({ page }) => {
    const { sesiones } = await simularVecino(page)
    await ingresar(page)
    await expect(page).toHaveURL(/\/vecino\/perfil$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Vera Soto, vecino de Armenia' })).toBeVisible()
    expect(sesiones).toEqual([{ correo: 'vera@example.com', clave: 'una clave larga y unica' }])
    expect(await page.evaluate(([vecino, panel]) => [window.sessionStorage.getItem(vecino!), window.sessionStorage.getItem(panel!)], [CLAVE_SESION_VECINO, CLAVE_SESION_PANEL])).toEqual(['token-vecino', null])
  })

  test('debeDecirLoMismoParaUnaClaveMalaQueParaUnaCuentaDelPanel', async ({ page }) => {
    await simularVecino(page, { sesion: (route) => route.fulfill(problema(401, 'credencial-invalida', 'Correo o clave incorrectos')) })
    await ingresar(page, 'mala-mala-mala')
    const mensaje = page.getByRole('alert').filter({ hasText: 'Correo o clave incorrectos.' })
    await expect(mensaje).toHaveText('Correo o clave incorrectos. Si te registraste hace poco, primero elige tu clave con el enlace del correo.')
    await expect(page).toHaveURL(/\/vecino\/ingreso$/)
    expect(await page.evaluate((clave) => window.sessionStorage.getItem(clave), CLAVE_SESION_VECINO)).toBeNull()
  })

  test('debeExplicarLaCuentaSuspendidaElBloqueoYElLimite', async ({ page }) => {
    await simularVecino(page, {
      sesion: (route, intento) => {
        if (intento === 1) return route.fulfill({ ...problema(403, 'cuenta-no-habilitada', 'No habilitada'), body: JSON.stringify({ type: 'https://aguavigia.example/errores/cuenta-no-habilitada', status: 403, detail: 'No habilitada', estado: 'SUSPENDIDA' }) })
        if (intento === 2) return route.fulfill({ ...problema(423, 'cuenta-bloqueada', 'Bloqueada'), body: JSON.stringify({ type: 'https://aguavigia.example/errores/cuenta-bloqueada', status: 423, detail: 'Bloqueada', segundosRestantes: 840 }) })
        return route.fulfill(conEspera(problema(429, 'limite-de-peticiones-excedido', 'Límite'), 120))
      },
    })
    await ingresar(page)
    await expect(page.getByRole('alert').filter({ hasText: 'Tu cuenta está suspendida' })).toBeVisible()
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Podrás ingresar en 14 minutos' })).toBeVisible()
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Podrás volver a intentarlo en 2 minutos' })).toBeVisible()
  })

  test('debePedirCorreoYClaveAntesDeEnviarYEnlazarLaRecuperacion', async ({ page }) => {
    const { sesiones } = await simularVecino(page)
    await page.goto('/vecino/ingreso')
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    await expect(page.getByText('Escribe tu correo.')).toBeVisible()
    await expect(page.getByText('Escribe tu clave.')).toBeVisible()
    expect(sesiones).toHaveLength(0)
    await expect(page.getByRole('link', { name: 'Olvidé mi clave' })).toHaveAttribute('href', '/cuenta/olvide')
    await expect(page.getByRole('link', { name: '¿No te llegó el correo?' })).toHaveAttribute('href', '/cuenta/reenviar')
    await expect(page.getByRole('link', { name: 'Regístrate como vecino' })).toHaveAttribute('href', '/vecino/registro')
  })

  test('debeLlevarAlPerfilSiYaHaySesionDeVecino', async ({ page }) => {
    await simularVecino(page)
    await conSesionDeVecino(page)
    await page.goto('/vecino/ingreso')
    await expect(page).toHaveURL(/\/vecino\/perfil$/)
  })

  test('debeCerrarSesionConElTokenDelVecinoYExplicarQueSeCerraronTodas', async ({ page }) => {
    const { cierres } = await simularVecino(page)
    await ingresar(page)
    await expect(page).toHaveURL(/\/vecino\/perfil$/)
    await page.getByRole('button', { name: 'Cerrar todas mis sesiones' }).click()
    await expect(page).toHaveURL(/\/vecino\/ingreso\?motivo=cerrada$/)
    await expect(page.getByRole('status').filter({ hasText: 'Cerraste la sesión en este equipo y en los demás' })).toBeVisible()
    expect(cierres).toEqual(['Bearer token-vecino'])
    expect(await page.evaluate((clave) => window.sessionStorage.getItem(clave), CLAVE_SESION_VECINO)).toBeNull()
  })

  test('debeVolverAlIngresoConElMotivoSiLaSesionMurioMientrasSeVeElPerfil', async ({ page }) => {
    await simularVecino(page, { yo: (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }) })
    await conSesionDeVecino(page, 'vencido')
    await page.goto('/vecino/perfil')
    await expect(page).toHaveURL(/\/vecino\/ingreso\?motivo=vencida$/)
    await expect(page.getByText('Tu sesión terminó. Ingresa de nuevo.')).toBeVisible()
  })

  test('debeLlevarAlIngresoSinMotivoSiNuncaHuboSesion', async ({ page }) => {
    await simularVecino(page)
    await page.goto('/vecino/perfil')
    await expect(page).toHaveURL(/\/vecino\/ingreso$/)
  })
})

test.describe('perfil', () => {
  test('debeMostrarArribaElBarrioYSiEstaVerificado', async ({ page }) => {
    await simularVecino(page, { perfil: { barrioVerificado: true, barrioVerificadoEn: '2026-10-31T13:00:00Z' } })
    await conSesionDeVecino(page)
    await page.goto('/vecino/perfil')
    const respuesta = page.getByRole('region', { name: 'Estado de tu barrio' })
    await expect(respuesta).toContainText('Armenia: verificado')
    await expect(respuesta).toContainText('31 de octubre de 2026')
    await expect(page.getByRole('button', { name: /Verificar con mi ubicación/ })).toHaveCount(0)
    await expect(page.getByText('vera@example.com')).toBeVisible()
  })

  test('debeGuardarSoloLoQueCambioYDejarElBotonApagadoSinCambios', async ({ page }) => {
    const { parches } = await simularVecino(page)
    await conSesionDeVecino(page)
    await page.goto('/vecino/perfil')
    const guardar = page.getByRole('button', { name: /Guardar cambios/ })
    await expect(guardar).toBeDisabled()
    await page.getByLabel('Nombre', { exact: true }).fill('Vera Soto Díaz')
    await page.getByLabel(/avisos de cortes de mi barrio/).check()
    await guardar.click()
    await expect(page.getByText('Guardamos tus cambios.')).toBeVisible()
    expect(parches).toEqual([{ nombre: 'Vera Soto Díaz', recibirAvisos: true }])
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vera Soto Díaz, vecino de Armenia')
  })

  test('debeAvisarQueCambiarDeBarrioBorraLaVerificacionYPedirConfirmacion', async ({ page }) => {
    const { parches } = await simularVecino(page, { perfil: { barrioVerificado: true, barrioVerificadoEn: '2026-10-31T13:00:00Z' } })
    await conSesionDeVecino(page)
    await page.goto('/vecino/perfil')
    await elegirBarrio(page, 'manga', /Manga/)
    await page.getByRole('button', { name: /Guardar cambios/ }).click()
    const aviso = page.getByRole('alertdialog')
    await expect(aviso).toContainText('Cambiar de barrio borra la verificación de tu barrio actual')
    expect(parches).toHaveLength(0)
    await aviso.getByRole('button', { name: 'Cancelar' }).click()
    await expect(aviso).toHaveCount(0)
    expect(parches).toHaveLength(0)
    await page.getByRole('button', { name: /Guardar cambios/ }).click()
    await page.getByRole('button', { name: 'Cambiar y borrar la verificación' }).click()
    await expect(page.getByRole('region', { name: 'Estado de tu barrio' })).toContainText('Manga: sin verificar')
    expect(parches).toEqual([{ barrioId: 'manga' }])
  })

  test('noDebePedirConfirmacionAlCambiarDeBarrioSiNoEstabaVerificado', async ({ page }) => {
    const { parches } = await simularVecino(page)
    await conSesionDeVecino(page)
    await page.goto('/vecino/perfil')
    await elegirBarrio(page, 'manga', /Manga/)
    await page.getByRole('button', { name: /Guardar cambios/ }).click()
    await expect(page.getByText('Guardamos tus cambios.')).toBeVisible()
    expect(parches).toEqual([{ barrioId: 'manga' }])
  })

  test('debeVolverAPedirElPerfilAnteUnConflictoDeEstado', async ({ page }) => {
    let lecturas = 0
    await simularVecino(page, {
      yo: (route) => route.fulfill(json(perfilDeEjemplo({ nombre: ++lecturas === 1 ? 'Vera Soto' : 'Vera Soto (actualizado)' }))),
      perfilPatch: (route) => route.fulfill(problema(409, 'conflicto-de-estado', 'La cuenta cambió')),
    })
    await conSesionDeVecino(page)
    await page.goto('/vecino/perfil')
    await page.getByLabel('Nombre', { exact: true }).fill('Otra Vera')
    await page.getByRole('button', { name: /Guardar cambios/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Tu cuenta cambió mientras guardábamos' })).toBeVisible()
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Vera Soto (actualizado)')
    expect(lecturas).toBe(2)
  })

  test('debeDecirElDetalleDelServidorJuntoAlCampoAnteUn400', async ({ page }) => {
    await simularVecino(page, {
      perfilPatch: (route) => route.fulfill({ status: 400, contentType: 'application/problem+json', body: JSON.stringify({
        type: 'https://aguavigia.example/errores/peticion-invalida', status: 400, detail: 'Datos inválidos', errores: ['nombre: El nombre es demasiado largo'],
      }) }),
    })
    await conSesionDeVecino(page)
    await page.goto('/vecino/perfil')
    await page.getByLabel('Nombre', { exact: true }).fill('Un nombre larguísimo')
    await page.getByRole('button', { name: /Guardar cambios/ }).click()
    await expect(page.getByText('El nombre es demasiado largo')).toBeVisible()
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  })
})

test.describe('verificación del barrio', () => {
  test('debeVerificarConLaUbicacionDelMomentoYSuPrecision', async ({ page, context }) => {
    const { verificaciones } = await simularVecino(page)
    await conSesionDeVecino(page)
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ ...EN_ARMENIA, accuracy: 25 })
    await page.goto('/vecino/perfil')
    await expect(page.getByRole('region', { name: 'Estado de tu barrio' })).toContainText('Armenia: sin verificar')
    await expect(page.getByText('No se guarda tu ubicación. Tienes 3 intentos al día.')).toBeVisible()
    await page.getByRole('button', { name: /Verificar con mi ubicación/ }).click()
    await expect(page.getByRole('region', { name: 'Estado de tu barrio' })).toContainText('Armenia: verificado')
    expect(verificaciones).toEqual([{ coordenada: { latitud: EN_ARMENIA.latitude, longitud: EN_ARMENIA.longitude }, precisionMetros: 25 }])
    // La ubicación no se guarda en ningún almacén del navegador.
    const guardado = await page.evaluate(() => JSON.stringify([{ ...window.localStorage }, { ...window.sessionStorage }]))
    expect(guardado).not.toContain(String(EN_ARMENIA.latitude))
  })

  test('debeOfrecerCorregirElBarrioCuandoLaUbicacionEstaFuera', async ({ page, context }) => {
    await simularVecino(page, { verificacion: (route) => route.fulfill(problema(422, 'ubicacion-fuera-del-barrio', 'Fuera')) })
    await conSesionDeVecino(page)
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 10.5, longitude: -75.3, accuracy: 20 })
    await page.goto('/vecino/perfil')
    await page.getByRole('button', { name: /Verificar con mi ubicación/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Tu ubicación no está dentro de Armenia' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Tu barrio' })).toBeVisible()
  })

  test('debeDecirQueUnaLecturaImprecisaNoGastaIntento', async ({ page, context }) => {
    await simularVecino(page, { verificacion: (route) => route.fulfill(problema(422, 'ubicacion-imprecisa', 'Imprecisa')) })
    await conSesionDeVecino(page)
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ ...EN_ARMENIA, accuracy: 500 })
    await page.goto('/vecino/perfil')
    await page.getByRole('button', { name: /Verificar con mi ubicación/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Esto no cuenta como intento' })).toBeVisible()
  })

  test('noDebePedirAlServidorUnaLecturaPeorQueMilMetros', async ({ page, context }) => {
    const { verificaciones } = await simularVecino(page)
    await conSesionDeVecino(page)
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ ...EN_ARMENIA, accuracy: 5000 })
    await page.goto('/vecino/perfil')
    await page.getByRole('button', { name: /Verificar con mi ubicación/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Esto no cuenta como intento' })).toBeVisible()
    expect(verificaciones).toHaveLength(0)
  })

  test('debeDecirCuandoVolverAIntentarloAlAgotarseLosTresIntentosDelDia', async ({ page, context }) => {
    await simularVecino(page, { verificacion: (route) => route.fulfill(conEspera(problema(429, 'limite-de-peticiones-excedido', 'Límite'), 43_200)) })
    await conSesionDeVecino(page)
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ ...EN_ARMENIA, accuracy: 25 })
    await page.goto('/vecino/perfil')
    await page.getByRole('button', { name: /Verificar con mi ubicación/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Usaste los 3 intentos de hoy. Podrás volver a intentarlo en 12 horas' })).toBeVisible()
  })

  test('debeDecirSiNoSeDioPermisoDeUbicacion', async ({ page, context }) => {
    const { verificaciones } = await simularVecino(page)
    await conSesionDeVecino(page)
    await context.clearPermissions()
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (_exito, fallo) =>
        fallo?.({ code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3, POSITION_UNAVAILABLE: 2, message: 'denegado' } as GeolocationPositionError)
    })
    await page.goto('/vecino/perfil')
    await page.getByRole('button', { name: /Verificar con mi ubicación/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'No tenemos permiso para usar tu ubicación' })).toBeVisible()
    expect(verificaciones).toHaveLength(0)
  })

  test('debeVolverAPedirElPerfilAnteUnConflictoDeEstadoAlVerificar', async ({ page, context }) => {
    let lecturas = 0
    await simularVecino(page, {
      yo: (route) => { lecturas++; return route.fulfill(json(perfilDeEjemplo())) },
      verificacion: (route) => route.fulfill(problema(409, 'conflicto-de-estado', 'Cambió')),
    })
    await conSesionDeVecino(page)
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ ...EN_ARMENIA, accuracy: 25 })
    await page.goto('/vecino/perfil')
    await page.getByRole('button', { name: /Verificar con mi ubicación/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Tu cuenta cambió mientras comprobábamos' })).toBeVisible()
    await expect.poll(() => lecturas).toBe(2)
  })
})

test.describe('reportar con la sesión del vecino', () => {
  async function reportar(page: Page, tipo = 'No tengo agua') {
    await page.getByRole('button', { name: 'Reportar lo que pasa en mi casa' }).click()
    await page.getByRole('button', { name: tipo }).click()
  }

  test('debeEnviarElTokenDelVecinoJuntoAlDispositivoYPedirElDispositivoUnaSolaVez', async ({ page }) => {
    const { reportes, dispositivos } = await simularVecino(page)
    await conSesionDeVecino(page)
    await page.goto('/sectores/armenia')
    await page.getByRole('button', { name: 'Reportar lo que pasa en mi casa' }).click()
    await expect(page.getByRole('dialog')).toContainText('Reportas como Vera Soto, vecino de Armenia.')
    await expect(page.getByRole('dialog')).not.toContainText('No hace falta cuenta')
    await page.getByRole('button', { name: 'No tengo agua' }).click()
    await expect(page.getByRole('heading', { name: 'Reporte recibido' })).toBeVisible()
    await page.getByRole('button', { name: /Volver a Armenia/ }).click()
    await reportar(page, 'Llega poca agua')
    await expect(page.getByRole('heading', { name: 'Reporte recibido' })).toBeVisible()
    expect(reportes.map(({ autorizacion }) => autorizacion)).toEqual(['Bearer token-vecino', 'Bearer token-vecino'])
    expect(reportes.map(({ dispositivo }) => dispositivo)).toEqual(['dispositivo-1', 'dispositivo-1'])
    expect(dispositivos).toHaveLength(1)
  })

  test('debeDecirQueElCupoDelVecinoEsDeCincoReportes', async ({ page }) => {
    await simularVecino(page)
    await page.route('**/api/reportes', (route) => route.fulfill(problema(429, 'limite-reportes-excedido', 'Cupo')))
    await conSesionDeVecino(page)
    await page.goto('/sectores/armenia')
    await reportar(page)
    await expect(page.getByRole('alert').filter({ hasText: 'Ya enviaste cinco reportes de este barrio' })).toBeVisible()
  })

  test('debeSeguirPudiendoReportarSinCuentaYSinMandarNingunToken', async ({ page }) => {
    const { reportes } = await simularVecino(page)
    await page.goto('/sectores/armenia')
    await page.getByRole('button', { name: 'Reportar lo que pasa en mi casa' }).click()
    await expect(page.getByRole('dialog')).toContainText('No hace falta cuenta')
    await page.getByRole('button', { name: 'No tengo agua' }).click()
    await expect(page.getByRole('heading', { name: 'Reporte recibido' })).toBeVisible()
    expect(reportes[0]).toMatchObject({ autorizacion: null, dispositivo: 'dispositivo-1' })
  })

  test('debeReintentarSinCuentaSiLaSesionDelVecinoMurioAlReportar', async ({ page }) => {
    const { reportes } = await simularVecino(page)
    let intentos = 0
    await page.route('**/api/reportes', async (route) => {
      intentos++
      reportes.push({ cuerpo: {}, autorizacion: await route.request().headerValue('Authorization'), dispositivo: await route.request().headerValue('X-Dispositivo') })
      if (intentos === 1) return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
      return route.fulfill(json({ id: 'r1', sectorId: 'armenia', tipo: 'SIN_AGUA', confirmaciones: 0, fotoEstado: 'SIN_FOTO' }, 201))
    })
    await conSesionDeVecino(page, 'vencido')
    await page.goto('/sectores/armenia')
    await reportar(page)
    await expect(page.getByRole('heading', { name: 'Reporte recibido' })).toBeVisible()
    expect(reportes.map(({ autorizacion }) => autorizacion)).toEqual(['Bearer vencido', null])
    expect(await page.evaluate((clave) => window.sessionStorage.getItem(clave), CLAVE_SESION_VECINO)).toBeNull()
  })

  test('noDebeMandarElTokenDelPanelEnUnReporteNiElDelVecinoAlPanel', async ({ page }) => {
    const { reportes, autorizaciones } = await simularVecino(page)
    await page.addInitScript(([panel, vecino]) => {
      window.sessionStorage.setItem(panel!, 'token-del-panel')
      window.sessionStorage.setItem(vecino!, 'token-vecino')
    }, [CLAVE_SESION_PANEL, CLAVE_SESION_VECINO])
    await page.goto('/sectores/armenia')
    await reportar(page)
    await expect(page.getByRole('heading', { name: 'Reporte recibido' })).toBeVisible()
    expect(reportes[0]?.autorizacion).toBe('Bearer token-vecino')
    expect(autorizaciones.filter(({ autorizacion }) => autorizacion === 'Bearer token-del-panel')).toEqual([])
  })
})

test.describe('el vecino y el panel son sesiones distintas', () => {
  test('noDebeAbrirElPanelConLaSesionDeUnVecinoNiMandarleSuToken', async ({ page }) => {
    const { autorizaciones } = await simularVecino(page)
    await conSesionDeVecino(page)
    await page.goto('/panel')
    await expect(page).toHaveURL(/\/panel\/ingreso$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Ingreso al panel' })).toBeVisible()
    expect(autorizaciones.filter(({ ruta }) => ruta.startsWith('/api/veedor/'))).toEqual([])
  })

  test('noDebeAbrirElPerfilDelVecinoConLaSesionDelPanel', async ({ page }) => {
    const { autorizaciones } = await simularVecino(page)
    await page.addInitScript((clave) => window.sessionStorage.setItem(clave, 'token-del-panel'), CLAVE_SESION_PANEL)
    await page.goto('/vecino/perfil')
    await expect(page).toHaveURL(/\/vecino\/ingreso$/)
    expect(autorizaciones.filter(({ autorizacion }) => autorizacion === 'Bearer token-del-panel')).toEqual([])
  })

  test('debeLlevarMiCuentaAlIngresoSinSesionYAlPerfilConSesion', async ({ page }) => {
    await simularVecino(page)
    async function irAMiCuenta() {
      await page.goto('/avisos')
      const menu = page.getByRole('button', { name: 'Menú' })
      if (await menu.isVisible()) await menu.click()
      await page.getByRole('link', { name: 'Mi cuenta' }).first().click()
    }
    await irAMiCuenta()
    await expect(page).toHaveURL(/\/vecino\/ingreso$/)
    await conSesionDeVecino(page)
    await irAMiCuenta()
    await expect(page).toHaveURL(/\/vecino\/perfil$/)
  })
})
