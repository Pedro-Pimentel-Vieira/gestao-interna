import { test, expect } from '@playwright/test';
import { summarizeProjects } from '../server/projects.js';
import { parseSchedule } from '../server/project-insights.js';

test('conta somente atividades nomeadas e ignora linhas do modelo', () => {
  const csv = [
    ',Etapa Geral,,Etapa Específica,,,,,,,,,Status',
    ',Desenvolvimento,,Tela inicial,,,,,,,,,Concluído',
    ',Etapa Geral,,,,,,,,,,,Não Iniciado',
    ',Etapa Geral,,,,,,,,,,,Concluído',
    ',,,' + 'Integração API' + ',,,,,,,,,Não Iniciado',
  ].join('\n');
  expect(parseSchedule(csv).activities).toEqual({ completed: 1, inProgress: 0, notStarted: 1, other: 0, total: 2 });
});

test('classifica projetos, ignora concluídos e aceita CSV com vírgulas', () => {
  const csv = 'Projeto,Finalizado?,Prev. Prazo\n"Projeto, A",FALSE,Dentro do Prazo\nB,FALSE,Paralizado\nC,FALSE,Paralisado\nD,TRUE,Paralizado\nE,FALSE,Rescindido\nF,FALSE,Finalizado\n,,\nG,FALSE,Fora do Prazo';
  expect(summarizeProjects(csv)).toMatchObject({ running: 2, paused: 2 });
  expect(summarizeProjects(csv).projects).toHaveLength(4);
  expect(() => summarizeProjects('<html>Login</html>')).toThrow();
});

test('atualiza os cartões e preserva a leitura anterior em caso de falha', async ({ page }) => {
  let fail = false;
  await page.route('**/api/projects', route => route.fulfill({ status: fail ? 502 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { error: 'Falha' } : { running: 5, paused: 10, projects: [], updatedAt: new Date().toISOString() }) }));
  await page.goto('/#projetos');
  await page.getByRole('button', { name: /Clara Guedes/ }).click();
  await expect(page.locator('.project-stat').first()).toContainText('5');
  await expect(page.locator('.project-stat').last()).toContainText('10');
  fail = true;
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('última leitura');
  await expect(page.locator('.project-stat').first()).toContainText('5');
});

test('abre projeto, recarrega a página específica e volta à lista', async ({ page }) => {
  await page.route('**/api/projects', route => route.fulfill({ json: {
    running: 1, paused: 1, updatedAt: new Date().toISOString(), projects: [
      { id: 'projeto-a', name: 'Projeto Oceânica', status: 'running' },
      { id: 'projeto-b', name: 'Projeto B', status: 'paused' },
    ],
  } }));
  await page.goto('/#projetos');
  await page.getByRole('button', { name: /Clara Guedes/ }).click();
  await page.getByRole('link', { name: /Projeto Oceânica/ }).click();
  await expect(page).toHaveURL(/#projetos\/projeto-a$/);
  await expect(page.getByRole('heading', { name: 'Projeto Oceânica' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Projeto Oceânica' })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar para projetos' }).click();
  await expect(page.getByRole('heading', { name: 'Lista de projetos' })).toBeVisible();
  await page.goto('/#projetos/inexistente');
  await expect(page.getByText('Projeto não encontrado na lista atual.')).toBeVisible();
});
