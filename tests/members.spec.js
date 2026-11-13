import { test, expect } from '@playwright/test';
import { parseMembers, parseAttendance } from '../server/members.js';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/profiles?*', route => route.fulfill({ json: { mode: 'local' } }));
});

test('usa apenas nomes ativos e ignora presença, vazios e inativos', () => {
  const members = parseMembers('Ativo,Nome,% Presença\nFALSE,Inativo,100%\nTRUE, Clara Guedes ,0%\nTRUE,"Pedro, Pimentel",50%\nTRUE,,100%\n,Sem status,100%');
  expect(members.map(member => member.name)).toEqual(['Clara Guedes', 'Pedro, Pimentel']);
  expect(() => parseMembers('<html>Login</html>')).toThrow();
  expect(members.map(member => member.attendanceRate)).toEqual([0, 50]);
  expect(parseMembers('Ativo,Nome,% Presença\nFALSE,Inativo,100%')).toEqual([]);
  expect(parseAttendance('76,47%')).toBe(76.47);
  expect(parseAttendance('100,00%')).toBe(100);
  for (const value of ['', '#DIV/0!', '120%', '-1%']) expect(parseAttendance(value)).toBeNull();
});

test('lista membros no celular e mantém a leitura se a atualização falhar', async ({ page }) => {
  let fail = false;
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route('**/api/members', route => route.fulfill({ status: fail ? 502 : 200, json: fail ? {} : {
    members: [{ id: 'a', name: 'Clara Guedes Fernandes', attendanceRate: 100 }, { id: 'b', name: 'Pedro Pimentel Alves Vieira', attendanceRate: null }], updatedAt: new Date().toISOString(),
  } }));
  await page.goto('/#membros');
  await page.getByRole('button', { name: /Clara Guedes/ }).click();
  await expect(page.getByRole('heading', { name: 'Membros ativos (2)' })).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByText('Pedro Pimentel Alves Vieira')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  fail = true;
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('última leitura');
  await expect(page.getByRole('listitem')).toHaveCount(2);
});

test('mostra foto antes do nome e usa iniciais quando não há foto', async ({ page }) => {
  await page.route('**/api/members', route => route.fulfill({ json: {
    members: [
      { id: 'a', name: 'Clara Guedes', attendanceRate: 100, photo: 'data:image/jpeg;base64,/9j/2Q==' },
      { id: 'b', name: 'Pedro Pimentel', attendanceRate: 100, photo: '' },
    ],
    updatedAt: new Date().toISOString(),
  } }));
  await page.goto('/#membros');
  await page.getByRole('button', { name: /Clara Guedes/ }).click();
  const clara = page.getByRole('link', { name: /Clara Guedes/ });
  await expect(clara.locator('.member-list-photo img')).toHaveCount(1);
  await expect(clara.locator('.member-list-photo')).toHaveText('');
  const pedro = page.getByRole('link', { name: /Pedro Pimentel/ });
  await expect(pedro.locator('.member-list-photo')).toHaveText('PP');
  const photoBox = await clara.locator('.member-list-photo').boundingBox();
  const nameBox = await clara.locator('.project-link-name').boundingBox();
  expect(photoBox.x).toBeLessThan(nameBox.x);
});

test('abre página individual, mantém link ao recarregar e mostra presença correta', async ({ page }) => {
  await page.route('**/api/members', route => route.fulfill({ json: {
    members: [{ id: 'a', name: 'Clara Guedes Fernandes', attendanceRate: 76.47 }, { id: 'b', name: 'Pedro Pimentel Alves Vieira', attendanceRate: null }], updatedAt: new Date().toISOString(),
  } }));
  await page.goto('/#membros');
  await page.getByRole('button', { name: /Clara Guedes/ }).click();
  await page.getByRole('link', { name: /Clara Guedes Fernandes/ }).click();
  await expect(page).toHaveURL(/#membros\/a$/);
  await expect(page.getByRole('heading', { name: 'Clara Guedes Fernandes' })).toBeVisible();
  await expect(page.locator('.project-stat')).toContainText('76,47%');
  await page.reload();
  await expect(page.locator('.project-stat')).toContainText('76,47%');
  await page.getByRole('link', { name: 'Voltar para membros' }).click();
  await page.getByRole('link', { name: /Pedro Pimentel Alves Vieira/ }).click();
  await expect(page.getByText('Taxa de presença indisponível na planilha.')).toBeVisible();
  await page.goto('/#membros/inexistente');
  await expect(page.getByText('Membro não encontrado na lista de ativos.')).toBeVisible();
});

test('edita perfil, salva foto e informações, persiste e cancela mudanças', async ({ page }) => {
  await page.route('**/api/members', route => route.fulfill({ json: {
    members: [{ id: 'a', name: 'Clara Guedes Fernandes', attendanceRate: 75 }], updatedAt: new Date().toISOString(),
  } }));
  await page.goto('/#membros/a');
  await page.getByRole('button', { name: /Clara Guedes/ }).click();
  await page.getByRole('button', { name: 'Editar perfil' }).click();
  await page.getByLabel('Nome completo', { exact: true }).fill('Clara Guedes');
  await page.getByLabel('Cargo / função').fill('Coordenadora');
  await page.getByLabel('E-mail', { exact: true }).fill('clara@example.com');
  await page.getByLabel('Telefone', { exact: true }).fill('(21) 99999-9999');
  await page.getByLabel('Sobre o membro').fill('Responsável pela equipe.');
  await page.getByLabel('Presença manual (%)').fill('88.5');
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 10; return canvas.toDataURL('image/png').split(',')[1]; });
  await page.locator('input[type=file]').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled();
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Clara Guedes', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Foto de Clara Guedes' })).toBeVisible();
  await expect(page.getByText('clara@example.com', { exact: true })).toBeVisible();
  await expect(page.locator('.project-stat')).toContainText('88,5%');
  await page.getByRole('button', { name: 'Editar perfil' }).click();
  await page.getByLabel('Nome completo', { exact: true }).fill('Mudança cancelada');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('heading', { name: 'Clara Guedes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar perfil' }).click();
  await page.getByLabel('Presença manual (%)').fill('');
  await page.getByRole('button', { name: 'Remover foto' }).click();
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.locator('.project-stat')).toContainText('75%');
  await expect(page.locator('.member-photo img')).toHaveCount(0);
});
