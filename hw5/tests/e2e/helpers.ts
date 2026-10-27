import { expect, test as base } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { Run } from '../../frontend/src/types.js'

export { expect }
export const test = base.extend({
  page: async ({ page, request, baseURL }, use, testInfo) => {
    if (process.env.HW5_E2E_ISOLATED !== '1' || !baseURL?.startsWith('http://127.0.0.1:')) {
      throw new Error('E2E 僅能使用 test.sh 啟動的隔離後端')
    }
    for (const resource of ['simulations', 'programs']) {
      const response = await request.get(`/api/v1/${resource}`)
      expect(response.ok()).toBeTruthy()
      for (const item of await response.json() as { id: number }[]) {
        expect((await request.delete(`/api/v1/${resource}/${item.id}`)).status()).toBe(204)
      }
    }
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/')
    await expect(page.locator('.connection')).toHaveText('LOCAL WORKSPACE')
    await use(page)
    if (errors.length) {
      await testInfo.attach('browser-errors', { body: errors.join('\n'), contentType: 'text/plain' })
      if (testInfo.status === testInfo.expectedStatus) expect(errors).toEqual([])
    }
  },
})

export async function configure(page: Page, values: {
  title?: string; source: string; registers?: string; memory?: string; maxCycles?: number
}) {
  await page.locator('#program-title').fill(values.title ?? 'E2E 程式')
  await page.getByRole('textbox', { name: 'MIPS 組合語言' }).fill(values.source)
  const settings = page.locator('.settings > details').first()
  if (await settings.getAttribute('open') === null) await settings.locator('summary').click()
  await page.locator('#init-registers').fill(values.registers ?? '')
  await page.locator('#init-memory').fill(values.memory ?? '')
  await page.getByLabel('Cycle 上限').fill(String(values.maxCycles ?? 10000))
}

export async function run(page: Page, status = '執行完成'): Promise<Run> {
  const response = page.waitForResponse(r => r.url().endsWith('/api/v1/simulations') && r.request().method() === 'POST')
  await page.getByRole('button', { name: '執行模擬' }).click()
  const result = await response
  expect(result.status()).toBe(201)
  await expect(page.locator('.run-result strong')).toHaveText(status)
  await expect(page.getByRole('status')).toContainText('模擬已儲存')
  return result.json()
}

export async function save(page: Page) {
  const response = page.waitForResponse(r => /\/api\/v1\/programs(?:\/\d+)?$/.test(r.url()) && ['POST', 'PUT'].includes(r.request().method()))
  await page.getByRole('button', { name: '儲存程式', exact: true }).click()
  const result = await response
  expect(result.ok()).toBeTruthy()
  await expect(page.getByRole('status')).toContainText('程式已儲存')
  return result.json() as Promise<{ id: number }>
}

export async function cycle(page: Page, value: number | 'last') {
  const slider = page.getByRole('slider', { name: 'Cycle 時間軸' })
  await slider.focus()
  if (value === 'last') await slider.press('End')
  else {
    await slider.press('Home')
    for (let n = 1; n < value; n++) await slider.press('ArrowRight')
  }
  await expect(slider).toHaveValue(value === 'last' ? (await slider.getAttribute('max'))! : String(value - 1))
}

export const register = (page: Page, name: string) => page.locator('.register-grid > div').filter({ has: page.locator('span', { hasText: new RegExp(`^\\$${name}\\d+$`) }) }).locator('code')
export const memory = (page: Page, address: string) => page.locator('.memory-grid > div').filter({ has: page.locator('span', { hasText: new RegExp(`^${address}$`) }) }).locator('code')
export const metric = (page: Page, label: string) => page.locator('.metric').filter({ has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) }).locator('strong')
export const signal = (page: Page, label: string) => page.locator('.signals-grid > div').filter({ has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) }).locator('code')
export const history = (page: Page) => page.getByRole('tab', { name: 'History' }).click()

export async function confirm(page: Page, accepted: boolean, action: () => Promise<unknown>) {
  const dialog = page.waitForEvent('dialog').then(async dialog => {
    expect(dialog.type()).toBe('confirm')
    if (accepted) await dialog.accept()
    else await dialog.dismiss()
  })
  await action()
  await dialog
}
