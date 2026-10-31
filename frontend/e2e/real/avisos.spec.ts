import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { correoDe, rutaEnCorreo } from './ayudantes'

test('debeSuscribirseConfirmarYDarseDeBajaSoloDespuesDePulsarCadaBoton', async ({ page, request }) => {
  const correo = `avisos-${randomUUID()}@example.com`
  const acciones: string[] = []
  page.on('request', (peticion) => {
    if (peticion.method() === 'POST' && /\/api\/suscripciones\/(confirmar|cancelar)/.test(peticion.url())) acciones.push(peticion.url())
  })

  await page.goto('/avisos?sector=manga')
  await expect(page.getByRole('list', { name: 'Barrios elegidos' })).toContainText('Manga')
  await page.getByRole('textbox', { name: 'Tu correo' }).fill(correo)
  const alta = page.waitForResponse((respuesta) => respuesta.url().endsWith('/api/suscripciones') && respuesta.request().method() === 'POST')
  await page.getByRole('button', { name: /Enviar enlace de confirmación/ }).click()
  expect((await alta).status()).toBe(201)
  await expect(page.getByRole('status')).toContainText('Si la dirección es válida')

  const cuerpo = await correoDe(request, correo)
  const confirmar = rutaEnCorreo(cuerpo, '/avisos/confirmar')
  const baja = rutaEnCorreo(cuerpo, '/avisos/baja')

  await page.goto(confirmar)
  await expect(page).toHaveURL(/\/avisos\/confirmar$/)
  expect(acciones).toHaveLength(0)
  const confirmacion = page.waitForResponse((respuesta) => respuesta.url().includes('/api/suscripciones/confirmar?token='))
  await page.getByRole('button', { name: 'Confirmar avisos' }).click()
  expect((await confirmacion).status()).toBe(200)
  await expect(page.getByRole('status')).toContainText('Avisos confirmados')

  await page.goto(baja)
  await expect(page).toHaveURL(/\/avisos\/baja$/)
  expect(acciones).toHaveLength(1)
  const cancelacion = page.waitForResponse((respuesta) => respuesta.url().includes('/api/suscripciones/cancelar?token='))
  await page.getByRole('button', { name: 'Dejar de recibir avisos' }).click()
  expect((await cancelacion).status()).toBe(200)
  await expect(page.getByRole('status')).toContainText('Ya no recibirás estos avisos')
  expect(acciones).toHaveLength(2)
})
