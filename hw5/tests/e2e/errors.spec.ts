import { test, expect, configure, run, history, cycle } from './helpers.js'

const invalid = [
  { name: '未知暫存器', registers: '$unknown = 1', message: '未知暫存器' },
  { name: 'zero 非零', registers: '$zero = 1', message: '$zero 必須為零' },
  { name: '重複暫存器別名', registers: '$t0 = 1\n$8 = 2', message: '初始設定重複' },
  { name: '32-bit 數值超界', registers: '$t0 = 4294967296', message: '數值超出 32-bit 範圍' },
  { name: '記憶體未對齊', memory: '2 = 7', message: '記憶體位址須為 0–1020' },
  { name: '記憶體超界', memory: '1024 = 7', message: '記憶體位址須為 0–1020' },
  { name: '設定格式錯誤', registers: '$t0: 7', message: '初始設定請使用' },
  { name: '不支援偽指令', source: 'li $t0, 7', message: '不支援指令 li' },
  { name: '超過 20 條指令', source: Array(21).fill('nop').join('\n'), message: '最多支援 20 條靜態指令' },
  { name: '空程式名稱', title: '', message: '名稱須為 1–100 字' },
  { name: 'cycle 上限不合法', maxCycles: 0, message: 'cycle 上限須介於 1 與 10000' },
]
for (const item of invalid) {
  test(`拒絕輸入：${item.name}`, async ({ page, request }) => {
    await configure(page, { source: 'nop', ...item })
    await page.getByRole('button', { name: '執行模擬' }).click()
    await expect(page.getByRole('alert')).toContainText(item.message)
    await expect(page.getByRole('button', { name: '執行模擬' })).toBeEnabled()
    expect(await (await request.get('/api/v1/simulations')).json()).toEqual([])
    await expect(page.locator('.run-result')).toHaveCount(0)
    await configure(page, { source: 'nop' })
    await run(page)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
}

for (const item of [
  { name: '執行期記憶體錯誤', source: 'lw $t0, 2($zero)', registers: '', reason: '未按 4 bytes 對齊' },
  { name: '執行期 signed overflow', source: 'addi $t1, $t0, 1', registers: '$t0 = 2147483647', reason: '帶符號溢位' },
]) {
  test(`${item.name}保存部分紀錄且可回放`, async ({ page }) => {
    await configure(page, item)
    await run(page, '執行停止')
    await expect(page.locator('.run-result')).toContainText(item.reason)
    await cycle(page, 'last')
    await history(page)
    await expect(page.locator('.run-list .status-label')).toHaveText('執行停止')
    await page.getByRole('button', { name: '回放', exact: true }).click()
    await expect(page.locator('.run-result')).toContainText(item.reason)
    await expect(page.getByRole('slider')).toHaveValue('0')
  })
}

test('cycle 上限保存部分紀錄且可回放', async ({ page }) => {
  await configure(page, { source: 'loop: j loop', maxCycles: 8 })
  await run(page, '到達上限')
  await expect(page.locator('.run-result')).toContainText('達到 8 cycles 上限')
  await cycle(page, 'last')
  await expect(page.getByRole('slider')).toHaveValue('7')
  await history(page)
  await expect(page.locator('.run-list .status-label')).toHaveText('到達上限')
  await page.getByRole('button', { name: '回放', exact: true }).click()
  await expect(page.locator('.run-result strong')).toHaveText('到達上限')
})

test('暫時無法連線後可重新連上真實 API', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.abort('connectionrefused'))
  await page.reload()
  await expect(page.locator('.connection')).toHaveText('API OFFLINE')
  await expect(page.getByRole('alert')).toContainText('尚未連上 Rust API')
  await page.unroute('**/api/v1/**')
  await page.getByRole('button', { name: '重新連線', exact: true }).click()
  await expect(page.locator('.connection')).toHaveText('LOCAL WORKSPACE')
  await expect(page.getByRole('status')).toContainText('已連上工作區')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: '關閉通知' }).click()
  await expect(page.getByRole('status')).toHaveCount(0)
  await run(page)
})
