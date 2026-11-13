import Papa from 'papaparse';
import { createHash } from 'node:crypto';

const sheetId = '1eQ3ZfPck-0ASHwzRAn5p86hfZAxITwfWAu6Nr6vyoSo';
export const PROJECTS_SHEET_URL = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
const scheduleUrls = new Map([
  ['Desenvolvimento Respirare', 'https://docs.google.com/spreadsheets/d/15bg1NVDySHL4KiNSgMoEWNE8qMMCBbVB8qi0pE6SjUY/edit'],
  ['Raquel 2.0', 'https://docs.google.com/spreadsheets/d/1z1o_EQ8e2_uJAgB6oia3ELtdNnrz4Z6M3rrSgkHFtNI/edit'],
  ['APP Fernando', 'https://docs.google.com/spreadsheets/d/1GJVXHTql5GnDgWwDu0-C6n1x6xDtouud5dZ3wmaLjtQ/edit'],
  ['APP Futeba', 'https://docs.google.com/spreadsheets/d/1P1TBbfyIqZEk_MZs6Znk06iAzXtUNrvLRVYoOdsUWxk/edit'],
  ['App Italypet', 'https://docs.google.com/spreadsheets/d/1QgQ4G-pKmubB5_psQdzE73pme5gsyMsFtirKCJ8Z9mc/edit'],
  ['Desenvolvimento Gianfranco', 'https://docs.google.com/spreadsheets/d/1EcoYxWD6AyiNV0sO9nmEakIq_ZwFv1wC3eS32Qh63EE/edit'],
  ['Dev Malvs Clean', 'https://docs.google.com/spreadsheets/d/1oQMjD5R4YrN3zkuLDr9vqqG5RHvXwVH7hJdhPfQ-Wnc/edit'],
  ['AR Cosméticos', 'https://docs.google.com/spreadsheets/d/1TeluvVfBY5jjaIbu0omrWyH3plJMAhQLft5lg21vZzs/edit'],
  ['Dev Petrec', 'https://docs.google.com/spreadsheets/d/1Sjq3f-yuaMD0dvRDCWWOok5HHUOEEV2vENCU1exo8nk/edit'],
  ['App Italy Pet 2.0', 'https://docs.google.com/spreadsheets/d/1_glPOqJ43I5vlzSFBfWR-1KSuxXJ6LWYjXe7uz46gyI/edit'],
  ['AR Oceânica', 'https://docs.google.com/spreadsheets/d/1E94WMuZa_a7jt4mf6DmF42TBAPAo83WUslKfsHRBQfw/edit'],
]);
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function summarizeProjects(csv) {
  const { data, errors } = Papa.parse(csv, { skipEmptyLines: 'greedy' });
  if (errors.length || !data.length) throw new Error('Resposta inválida da planilha.');
  const headers = data[0].map(normalize);
  const name = headers.indexOf('projeto');
  const finished = headers.indexOf('finalizado?');
  const status = headers.indexOf('prev. prazo');
  if ([name, finished, status].includes(-1)) throw new Error('Colunas da planilha não encontradas.');
  let running = 0;
  let paused = 0;
  const projects = [];
  const occurrences = new Map();
  for (const row of data.slice(1)) {
    if (!normalize(row[name])) continue;
    const state = normalize(row[status]);
    if (['true', 'verdadeiro', 'sim', '1'].includes(normalize(row[finished])) || ['finalizado', 'rescindido'].includes(state)) continue;
    const isPaused = ['paralizado', 'paralisado'].includes(state);
    if (isPaused) paused++;
    else running++;
    const projectName = String(row[name]).trim();
    const occurrence = (occurrences.get(projectName) ?? 0) + 1;
    occurrences.set(projectName, occurrence);
    const id = createHash('sha256').update(JSON.stringify([projectName, occurrence])).digest('hex').slice(0, 20);
    projects.push({ id, name: projectName, status: isPaused ? 'paused' : 'running', scheduleUrl: scheduleUrls.get(projectName) || '' });
  }
  return { running, paused, projects };
}

export async function getProjectsSummary() {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/export`);
  url.searchParams.set('format', 'csv');
  url.searchParams.set('gid', '664433547');
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/csv')) {
    throw new Error('Não foi possível ler a planilha.');
  }
  return { ...summarizeProjects(await response.text()), updatedAt: new Date().toISOString() };
}
