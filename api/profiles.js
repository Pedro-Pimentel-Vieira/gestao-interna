import { loadProfile, saveProfile, ProfileError } from '../server/profile-storage.js';
import { getMembers } from '../server/members.js';

async function readBody(req) {
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > 1500000) throw new ProfileError('Arquivo muito grande.', 413);
    try { return JSON.parse(raw); } catch { throw new ProfileError('JSON inválido.'); }
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1500000) throw new ProfileError('Arquivo muito grande.', 413);
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new ProfileError('JSON inválido.'); }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const id = new URL(req.url, 'http://localhost').searchParams.get('id');
    if (!/^[a-f0-9]{20}$/.test(id || '')) throw new ProfileError('Identificador inválido.');
    if (!['GET', 'PUT'].includes(req.method)) {
      res.setHeader('Allow', 'GET, PUT');
      throw new ProfileError('Método não permitido.', 405);
    }
    let result;
    if (req.method === 'GET') result = await loadProfile(id);
    else {
      if (!req.headers['content-type']?.includes('application/json')) throw new ProfileError('Envie JSON.', 415);
      const input = await readBody(req);
      const { members } = await getMembers();
      if (!members.some(member => member.id === id)) throw new ProfileError('Membro não encontrado na lista de ativos.', 404);
      result = await saveProfile(id, input);
    }
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode = error instanceof ProfileError ? error.status : 502;
    res.end(JSON.stringify({ error: error instanceof ProfileError ? error.message : 'Não foi possível acessar o banco. Tente novamente.' }));
  }
}
