import { test, expect } from '@playwright/test';
import { getDashboard, parseNumber } from '../server/dashboard.js';

test('interpreta moeda brasileira e monta indicadores priorizando CCE', async () => {
  expect(parseNumber('R$ 54.751,22')).toBe(54751.22);
  expect(parseNumber('R$ 100.000')).toBe(100000);
  expect(parseNumber('?????')).toBeNull();
  const csv = {
    'sales|Metas por coordenação': ',CICLOS E METAS 26/27,,,,,\n,,,,Ciclo Gambito,,31/12/2026\n,novembro/2026,"R$ 130.000",,QAB,"R$ 38.000",\n,dezembro/2026,,,CCE,"R$ 100.000",',
    'billing|Metas por coordenação': ',CICLOS E METAS 26/27,,,,,\n,,,,Ciclo 1,FIM:,31/12/2026\n,novembro/2026,"R$ 90.000",,QAB,"R$ 37.000",\n,dezembro/2026,,,CCE,"R$ 65.000",',
    'sales|Geral': ',,CCE c,VV,TM\nnovembro/2026,,2,"R$ 12.500","R$ 6.250"',
    'billing|CCE': ',Novembro/26,\n,Previsto,\n,"R$ 7.353,10","R$ 2.000,00"',
    'sales|Ciclo Gambito': ',,Contratos,Valor Vendido real,Arrecadação Média,Meta,% da Meta\n,CCE,2,"R$ 12.500",,"R$ 100.000","12,5%"',
    'billing|Ciclo Gambito': ',,Faturamento Previsto,Valor Faturado,% do Faturamento Previsto,Meta,% da Meta\n,CCE,"R$ 45.036,04","R$ 54.751,22","121,57%","R$ 65.000","84,23%"',
  };
  const loadCsv = async (id, sheet) => csv[`${id.startsWith('1W') ? 'sales' : 'billing'}|${sheet}`];
  const data = await getDashboard({ now: new Date('2026-11-12T12:00:00-03:00'), loadCsv });
  expect(data).toMatchObject({
    scope: 'CCE', period: 'novembro/2026', cycle: { name: 'Ciclo Gambito', end: '31/12/2026', daysRemaining: 49 },
    month: { sales: { actual: 12500, contracts: 2, target: 130000 }, billing: { actual: 2000, forecast: 7353.1, target: 90000 } },
    cycleResults: { sales: { actual: 12500, target: 100000, percentage: 12.5 }, billing: { actual: 54751.22, target: 65000, percentage: 84.23 } },
  });
});

test('exibe painel visual, atualiza e preserva a última leitura em falha', async ({ page }) => {
  let fail = false;
  const payload = {
    scope: 'CCE', period: 'novembro/2026', cycle: { name: 'Ciclo Gambito', end: '31/12/2026', daysRemaining: 49 },
    month: { sales: { actual: 0, contracts: 0, target: 130000, targetScope: 'Fluxo' }, billing: { actual: 0, forecast: 7353.1, target: 90000, targetScope: 'Fluxo' } },
    cycleResults: { sales: { actual: 0, target: 100000, percentage: 0 }, billing: { actual: 54751.22, target: 65000, percentage: 84.23 } },
    updatedAt: new Date().toISOString(),
  };
  await page.route('**/api/dashboard', route => route.fulfill({ status: fail ? 502 : 200, json: fail ? { error: 'Falha' } : payload }));
  await page.goto('/#home');
  await page.getByRole('button', { name: /Clara Guedes/ }).click();
  await expect(page.getByRole('heading', { name: 'Visão de CCE' })).toBeVisible();
  await expect(page.getByText('R$ 54.751,22')).toBeVisible();
  await expect(page.getByText('84,2%')).toBeVisible();
  await expect(page.getByText('49')).toBeVisible();
  fail = true;
  await page.getByRole('button', { name: 'Atualizar dados' }).click();
  await expect(page.getByRole('status')).toContainText('última leitura');
  await expect(page.getByText('R$ 54.751,22')).toBeVisible();
});

test('painel não cria rolagem horizontal no celular', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route('**/api/dashboard', route => route.fulfill({ json: {
    scope: 'CCE', period: 'novembro/2026', cycle: { name: 'Ciclo Gambito', end: '31/12/2026', daysRemaining: 49 },
    month: { sales: { actual: 0, contracts: 0, target: 130000 }, billing: { actual: 0, forecast: 7353.1, target: 90000 } },
    cycleResults: { sales: { actual: 0, target: 100000, percentage: 0 }, billing: { actual: 54751.22, target: 65000, percentage: 84.23 } },
    updatedAt: new Date().toISOString(),
  } }));
  await page.goto('/#home');
  await page.getByRole('button', { name: /Pedro Pimentel/ }).click();
  await expect(page.getByRole('heading', { name: 'Visão de CCE' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
