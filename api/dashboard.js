import { getDashboard } from '../server/dashboard.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Método não permitido.' }));
  }
  try {
    res.statusCode = 200;
    res.end(JSON.stringify(await getDashboard()));
  } catch {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: 'Não foi possível atualizar os indicadores. Tente novamente em instantes.' }));
  }
}
