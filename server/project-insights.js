import Papa from 'papaparse';
import { getProjectsSummary, PROJECTS_SHEET_URL } from './projects.js';

const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const number = value => {
  const text = String(value ?? '').replace(/R\$\s*/g, '').replace(/%/g, '').replace(/\s/g, '');
  if (!text || /[#?]/.test(text)) return null;
  const parsed = Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/\.(?=\d{3}(?:\D|$))/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};
const dateValue = value => {
  const match = String(value ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  return `${String(match[1]).padStart(2, '0')}/${String(match[2]).padStart(2, '0')}/${match[3]}`;
};

function valueBelow(rows, labels) {
  for (let row = 0; row < rows.length - 1; row++) for (let column = 0; column < rows[row].length; column++) {
    const label = normalize(rows[row][column]);
    if (labels.some(item => label === item || label.includes(item))) return rows[row + 1]?.[column] ?? '';
  }
  return '';
}

function valueAfterLabel(rows, labels, rowOffset) {
  for (let row = 0; row < rows.length - rowOffset; row++) for (let column = 0; column < rows[row].length; column++) {
    const label = normalize(rows[row][column]);
    if (labels.some(item => label.includes(item))) return rows[row + rowOffset]?.[column] ?? '';
  }
  return '';
}

export function parseSchedule(csv) {
  const result = Papa.parse(csv, { skipEmptyLines: false });
  if (result.errors.length || !result.data.length) throw new Error('Cronograma inválido.');
  const rows = result.data;
  const progress = number(valueBelow(rows, ['progresso atual', 'progresso']));
  const plannedProgress = number(valueBelow(rows, ['progresso planejado atual', 'progresso planejado']));
  const statusHeaderRow = rows.findIndex(row => row.some(cell => normalize(cell) === 'status'));
  const statusColumn = statusHeaderRow >= 0 ? rows[statusHeaderRow].findIndex(cell => normalize(cell) === 'status') : -1;
  const generalStageColumn = statusHeaderRow >= 0 ? rows[statusHeaderRow].findIndex(cell => normalize(cell) === 'etapa geral') : -1;
  const specificStageColumn = statusHeaderRow >= 0 ? rows[statusHeaderRow].findIndex(cell => normalize(cell) === 'etapa especifica') : -1;
  const counts = { completed: 0, inProgress: 0, notStarted: 0, other: 0 };
  if (statusColumn >= 0) for (const row of rows.slice(statusHeaderRow + 1)) {
    const status = normalize(row[statusColumn]);
    const generalStage = generalStageColumn >= 0 ? normalize(row[generalStageColumn]) : '';
    const specificStage = specificStageColumn >= 0 ? normalize(row[specificStageColumn]) : '';
    const hasActivity = Boolean(
      (generalStage && generalStage !== 'etapa geral') ||
      (specificStage && specificStage !== 'etapa especifica')
    );
    if (!status || !hasActivity) continue;
    if (status === 'concluido') counts.completed++;
    else if (status.includes('andamento')) counts.inProgress++;
    else if (status.includes('nao iniciado')) counts.notStarted++;
    else counts.other++;
  }
  const totalActivities = counts.completed + counts.inProgress + counts.notStarted + counts.other;
  const projectValueCell = valueBelow(rows, ['valor do projeto']);
  const currencyValues = rows.slice(statusHeaderRow + 1).flat().filter(cell => /^R\$\s*[\d.]+,\d{2}$/.test(String(cell).trim())).map(number).filter(value => value !== null);
  return {
    startDate: dateValue(valueBelow(rows, ['dia de inicio'])),
    expectedEndDate: dateValue(valueBelow(rows, ['termino previsto'])) || dateValue(valueAfterLabel(rows, ['dia de inicio'], 2)),
    delayDays: number(valueBelow(rows, ['dias atrasados'])),
    projectValue: number(projectValueCell) ?? (currencyValues.length ? currencyValues.reduce((sum, value) => sum + value, 0) : null),
    progress,
    remaining: progress === null ? null : Math.max(0, 100 - progress),
    plannedProgress,
    activities: { ...counts, total: totalActivities },
  };
}

async function fetchSchedule(url) {
  const id = url.match(/\/d\/([^/]+)/)?.[1];
  if (!id) throw new Error('Link de cronograma inválido.');
  const endpoint = new URL(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq`);
  endpoint.searchParams.set('tqx', 'out:csv');
  endpoint.searchParams.set('sheet', 'Cronograma');
  endpoint.searchParams.set('range', 'A1:X300');
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/csv')) throw new Error('Cronograma indisponível.');
  return response.text();
}

export async function getProjectInsights(id, { loadSchedule = fetchSchedule } = {}) {
  const summary = await getProjectsSummary();
  const project = summary.projects.find(item => item.id === id);
  if (!project) return null;
  if (!project.scheduleUrl) return { project, masterSheetUrl: PROJECTS_SHEET_URL, insights: null, updatedAt: new Date().toISOString() };
  return { project, masterSheetUrl: PROJECTS_SHEET_URL, insights: parseSchedule(await loadSchedule(project.scheduleUrl)), updatedAt: new Date().toISOString() };
}
