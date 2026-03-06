import { expect, test, type Page } from '@playwright/test';

const clickFirstVisible = async (page: Page, texts: string[]) => {
  for (const text of texts) {
    const locator = page.getByRole('button', { name: text });
    if (await locator.count()) {
      await locator.first().click();
      return;
    }
  }
  throw new Error(`No button found for labels: ${texts.join(', ')}`);
};

test('room join starts call and receives subtitle commits', async ({ browser }) => {
  const contextA = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const contextB = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await Promise.all([pageA.goto('/'), pageB.goto('/')]);

  await pageA.locator('input').first().fill('E2E Agent');
  await pageB.locator('input').first().fill('E2E Investor');
  await clickFirstVisible(pageA, ['Entrar al workspace', 'Enter workspace']);
  await clickFirstVisible(pageB, ['Entrar al workspace', 'Enter workspace']);

  const roomInputA = pageA.locator('input[type="text"]').first();
  await expect(roomInputA).toBeVisible();
  const roomCode = await roomInputA.inputValue();
  await pageB.locator('input[type="text"]').first().fill(roomCode);

  await Promise.all([
    clickFirstVisible(pageA, ['Iniciar llamada con traducción', 'Start translation call']),
    clickFirstVisible(pageB, ['Iniciar llamada con traducción', 'Start translation call']),
  ]);

  await expect(pageA.getByText(/SIGNAL CONNECTED|SIGNAL RECONNECTING/i).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(pageB.getByText(/SIGNAL CONNECTED|SIGNAL RECONNECTING/i).first()).toBeVisible({
    timeout: 20_000,
  });

  await pageB.evaluate(() => (window as any).__E2E_SEND_SUBTITLE('chunk_e2e_commit'));

  await expect(pageA.getByText(/chunk_e2e_commit/i).first()).toBeVisible({ timeout: 30_000 });

  await contextA.close();
  await contextB.close();
});
