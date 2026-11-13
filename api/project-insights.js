import { getProjectInsights } from '../server/project-insights.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET'); res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Método não permitido.' }));
  }
  try {
    const id = new URL(req.url, 'http://localhost').searchParams.get('id');
    if (!/^[a-f0-9]{20}$/.test(id || '')) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Identificador inválido.' })); }
    const data = await getProjectInsights(id);
    if (!data) { res.statusCode = 404; return res.end(JSON.stringify({ error: 'Projeto não encontrado.' })); }
    res.statusCode = 200; res.end(JSON.stringify(data));
  } catch {
    res.statusCode = 502; res.end(JSON.stringify({ error: 'Não foi possível atualizar o cronograma.' }));
  }
}
