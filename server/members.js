import Papa from 'papaparse';
import { createHash } from 'node:crypto';

const normalize = value => String(value ?? '').trim().toLowerCase();

export function parseAttendance(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:[.,]\d+)?\s*%$/.test(text)) return null;
  const rate = Number(text.replace('%', '').replace(',', '.').trim());
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : null;
}

export function parseMembers(csv) {
  const { data, errors } = Papa.parse(csv, { skipEmptyLines: 'greedy' });
  if (errors.length || !data.length) throw new Error('Resposta inválida da planilha.');
  const headers = data[0].map(normalize);
  const activeColumn = headers.indexOf('ativo');
  const nameColumn = headers.indexOf('nome');
  const attendanceColumn = headers.indexOf('% presença');
  if (activeColumn < 0 || nameColumn < 0 || attendanceColumn < 0) throw new Error('Colunas da planilha não encontradas.');
  const members = [];
  const occurrences = new Map();
  for (const row of data.slice(1)) {
    const name = String(row[nameColumn] ?? '').trim();
    if (!name || !['true', 'verdadeiro', 'sim', '1'].includes(normalize(row[activeColumn]))) continue;
    const occurrence = (occurrences.get(name) ?? 0) + 1;
    occurrences.set(name, occurrence);
    members.push({ id: createHash('sha256').update(JSON.stringify([name, occurrence])).digest('hex').slice(0, 20), name, attendanceRate: parseAttendance(row[attendanceColumn]) });
  }
  return members;
}

export async function getMembers() {
  const url = new URL('https://docs.google.com/spreadsheets/d/11-GXPflwaUZy1nzEU0kFXj65AC7GqPxB_PfPQJI2NCo/export');
  url.searchParams.set('format', 'csv');
  url.searchParams.set('gid', '1682438240');
  url.searchParams.set('range', 'A:C');
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/csv')) throw new Error('Não foi possível ler a planilha.');
  return { members: parseMembers(await response.text()), updatedAt: new Date().toISOString() };
}
