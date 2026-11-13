import { test, expect } from '@playwright/test';

test('escolhe, lembra após recarregar, navega e troca o coordenador', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Quem está por aqui?' })).toBeVisible();
  await page.getByRole('button', { name: /Clara Guedes/ }).click();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Clara Guedes' })).toBeVisible();
  for (const name of ['Projetos', 'Membros', 'Home']) {
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Clara Guedes' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Trocar coordenador' })).toBeHidden();
  await page.getByRole('button', { name: 'Clara Guedes' }).click();
  await page.getByRole('button', { name: 'Trocar coordenador' }).click();
  await page.getByRole('button', { name: /Pedro Pimentel/ }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Pedro Pimentel' })).toBeVisible();
  await expect(page.locator('.workspace')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('valor salvo inválido e navegação no celular', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.addInitScript(() => localStorage.setItem('gestao-interna:coordenador', 'invalido'));
  await page.goto('/#projetos');
  await page.getByRole('button', { name: /Pedro Pimentel/ }).click();
  await expect(page.getByRole('heading', { name: 'Projetos' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('link', { name: 'Membros' }).click();
  await expect(page.getByRole('heading', { name: 'Membros' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('continua utilizável se o armazenamento estiver bloqueado', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    Storage.prototype.setItem = () => { throw new Error('blocked'); };
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Clara Guedes/ }).click();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Não foi possível salvar');
});
