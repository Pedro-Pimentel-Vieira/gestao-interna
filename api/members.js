import { getMembers } from '../server/members.js';
import { getSupabase } from '../server/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Método não permitido.' }));
  }
  try {
    const data = await getMembers();
    const db = getSupabase();
    if (db && data.members.length) {
      const result = await db.from('member_profiles').select('id,name,photo_path').in('id', data.members.map(member => member.id));
      if (result.error) throw result.error;
      const profiles = new Map(await Promise.all(result.data.map(async profile => {
        let photo = '';
        if (profile.photo_path) {
          const signed = await db.storage.from('member-photos').createSignedUrl(profile.photo_path, 3600);
          if (signed.error) throw signed.error;
          photo = signed.data.signedUrl;
        }
        return [profile.id, { name: profile.name, photo }];
      })));
      data.members = data.members.map(member => ({ ...member, name: profiles.get(member.id)?.name || member.name, photo: profiles.get(member.id)?.photo || '' }));
    }
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: 'Não foi possível atualizar os membros. Tente novamente em instantes.' }));
  }
}
