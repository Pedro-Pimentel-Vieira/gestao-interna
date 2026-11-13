import Papa from 'papaparse';

const SALES_SHEET_ID = '1WKWznpWgS2VDKCaLHiBUjfZfJsFnYxR-8_92EC7O9B8';
const BILLING_SHEET_ID = '1VhcOqq1GKvwf3xEPUBTJsN_OjSwhcUy9raf9BceLQ-E';
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const normalizePeriod = value => normalize(value).replace(/\/20(\d{2})$/, '/$1');

export function parseNumber(value) {
  const text = String(value ?? '').trim().replace(/R\$\s*/g, '').replace(/\s/g, '');
  if (!text || /[#?]/.test(text)) return null;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/\.(?=\d{3}(?:\D|$))/g, '');
  const number = Number(normalized.replace('%', ''));
  return Number.isFinite(number) ? number : null;
}

export function parseCsv(csv) {
  const result = Papa.parse(csv, { skipEmptyLines: false });
  if (result.errors.length || !result.data.length || String(result.data[0]?.[0] ?? '').startsWith('<')) throw new Error('Resposta inválida da planilha.');
  return result.data;
}

function findRow(rows, label, column) {
  const wanted = normalize(label);
  return rows.find(row => column === undefined ? row.some(cell => normalize(cell) === wanted) : normalize(row[column]) === wanted);
}

function coordinationCycle(rows, coordination = 'CCE') {
  const row = findRow(rows, coordination);
  if (!row) throw new Error(`Coordenação ${coordination} não encontrada no ciclo.`);
  return { actual: parseNumber(row[3]) ?? 0, target: parseNumber(row[5]), percentage: parseNumber(row[6]) };
}

function salesMonth(rows, monthLabel, coordination = 'CCE') {
  const wanted = normalize(coordination);
  const headerIndex = rows.findIndex(row => row.some(cell => normalize(cell) === wanted || normalize(cell).startsWith(`${wanted} `)));
  if (headerIndex < 0) throw new Error('Cabeçalho mensal de vendas não encontrado.');
  const headers = rows[headerIndex];
  const coordinationColumn = headers.findIndex(cell => normalize(cell) === wanted || normalize(cell).startsWith(`${wanted} `));
  let actualColumn = coordinationColumn + 1;
  for (let column = coordinationColumn; column < Math.min(coordinationColumn + 4, headers.length); column++) {
    if (normalize(headers[column]) === 'vv' || normalize(headers[column]).endsWith(' vv')) actualColumn = column;
  }
  const row = findRow(rows, monthLabel, 0);
  if (!row) throw new Error(`Mês ${monthLabel} não encontrado em vendas.`);
  return { actual: parseNumber(row[actualColumn]) ?? 0, contracts: parseNumber(row[coordinationColumn]) ?? 0 };
}

function billingMonth(rows, monthLabel) {
  const monthRowIndex = rows.findIndex(row => row.some(cell => normalizePeriod(cell) === normalizePeriod(monthLabel)));
  if (monthRowIndex < 0) throw new Error(`Mês ${monthLabel} não encontrado em faturamento.`);
  const monthColumn = rows[monthRowIndex].findIndex(cell => normalizePeriod(cell) === normalizePeriod(monthLabel));
  const labels = rows[monthRowIndex + 1] ?? [];
  const values = rows[monthRowIndex + 2] ?? [];
  let forecastColumn = monthColumn;
  let actualColumn = monthColumn + 1;
  for (let column = monthColumn; column < Math.min(monthColumn + 2, labels.length); column++) {
    if (normalize(labels[column]) === 'previsto') forecastColumn = column;
    if (normalize(labels[column]) === 'realizado') actualColumn = column;
  }
  return { forecast: parseNumber(values[forecastColumn]) ?? 0, actual: parseNumber(values[actualColumn]) ?? 0 };
}

function monthlyGoal(rows, monthLabel) {
  const row = findRow(rows, monthLabel, 1);
  return row ? parseNumber(row[2]) : null;
}

function cycleInfo(rows) {
  const titleRow = rows.find(row => row.some(cell => /^ciclo\s/i.test(String(cell ?? '').trim())) && row.some(cell => /\d{2}\/\d{2}\/\d{4}/.test(String(cell ?? ''))));
  const cycleName = titleRow?.map(String).find(cell => /^ciclo\s/i.test(cell.trim()))?.trim() || 'Ciclo atual';
  const end = titleRow?.map(String).find(cell => /\d{2}\/\d{2}\/\d{4}/.test(cell))?.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] || '';
  return { name: cycleName, end };
}

function daysUntil(dateText, now) {
  const match = dateText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const end = Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.ceil((end - today) / 86400000));
}

export async function fetchSheetCsv(spreadsheetId, sheet, range) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq`);
  url.searchParams.set('tqx', 'out:csv');
  url.searchParams.set('sheet', sheet);
  if (range) url.searchParams.set('range', range);
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/csv')) throw new Error('Não foi possível ler a planilha.');
  return response.text();
}

export async function getDashboard({ now = new Date(), loadCsv = fetchSheetCsv } = {}) {
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(now).replace(' de ', '/');
  const [salesMetaCsv, billingMetaCsv, salesGeneralCsv, billingCceCsv] = await Promise.all([
    loadCsv(SALES_SHEET_ID, 'Metas por coordenação', 'A1:G20'),
    loadCsv(BILLING_SHEET_ID, 'Metas por coordenação', 'A1:G20'),
    loadCsv(SALES_SHEET_ID, 'Geral', 'A1:Z20'),
    loadCsv(BILLING_SHEET_ID, 'CCE', 'A1:M18'),
  ]);
  const salesMeta = parseCsv(salesMetaCsv);
  const billingMeta = parseCsv(billingMetaCsv);
  const info = cycleInfo(salesMeta);
  const cycleSheet = info.name;
  const [salesCycleCsv, billingCycleCsv] = await Promise.all([
    loadCsv(SALES_SHEET_ID, cycleSheet, 'A1:I18'),
    loadCsv(BILLING_SHEET_ID, cycleSheet, 'A1:H17'),
  ]);
  const salesCycle = coordinationCycle(parseCsv(salesCycleCsv));
  const billingCycle = coordinationCycle(parseCsv(billingCycleCsv));
  const salesMonthly = salesMonth(parseCsv(salesGeneralCsv), monthLabel);
  const billingMonthly = billingMonth(parseCsv(billingCceCsv), monthLabel);
  return {
    scope: 'CCE',
    period: monthLabel,
    cycle: { ...info, daysRemaining: daysUntil(info.end, now) },
    month: {
      sales: { ...salesMonthly, target: monthlyGoal(salesMeta, monthLabel), targetScope: 'Fluxo' },
      billing: { ...billingMonthly, target: monthlyGoal(billingMeta, monthLabel), targetScope: 'Fluxo' },
    },
    cycleResults: { sales: salesCycle, billing: billingCycle },
    updatedAt: new Date().toISOString(),
  };
}
