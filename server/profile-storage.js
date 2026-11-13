import { randomUUID } from 'node:crypto';
import { getSupabase } from './supabase.js';

export class ProfileError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function validateProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ProfileError('Perfil inválido.');
  const profile = {};
  for (const [key, limit] of Object.entries({ name: 160, role: 100, email: 200, phone: 40, bio: 3000 })) {
    if (typeof input[key] !== 'string' || input[key].length > limit) throw new ProfileError(`Campo inválido: ${key}.`);
    profile[key] = input[key].trim();
  }
  if (!profile.name) throw new ProfileError('Preencha o nome do membro.');
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) throw new ProfileError('E-mail inválido.');
  if (typeof input.attendance !== 'string') throw new ProfileError('Presença inválida.');
  profile.attendance = input.attendance.trim() === '' ? null : Number(input.attendance);
  if (profile.attendance !== null && (!Number.isFinite(profile.attendance) || profile.attendance < 0 || profile.attendance > 100)) throw new ProfileError('Presença deve estar entre 0 e 100.');
  if (input.version !== null && (!Number.isInteger(input.version) || input.version < 1)) throw new ProfileError('Versão inválida.');
  return profile;
}

export function decodePhoto(value) {
  if (typeof value !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new ProfileError('Foto inválida.');
  const bytes = Buffer.from(value.split(',')[1], 'base64');
  if (bytes.length > 1048576 || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new ProfileError('Foto inválida ou maior que 1 MB.');
  return bytes;
}

async function toProfile(db, row) {
  if (!row) return null;
  let photo = '';
  if (row.photo_path) {
    const result = await db.storage.from('member-photos').createSignedUrl(row.photo_path, 3600);
    if (result.error) throw result.error;
    photo = result.data.signedUrl;
  }
  return { name: row.name, role: row.role, email: row.email, phone: row.phone, bio: row.bio, attendance: row.attendance === null ? '' : String(row.attendance), photo, version: row.version };
}

export async function loadProfile(id, db = getSupabase()) {
  if (!db) return { mode: 'local' };
  const { data, error } = await db.from('member_profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return { mode: 'supabase', profile: await toProfile(db, data) };
}

export async function saveProfile(id, input, db = getSupabase()) {
  if (!db) throw new ProfileError('Supabase ainda não configurado.', 503);
  const fields = validateProfile(input);
  const { data: previous, error: readError } = await db.from('member_profiles').select('*').eq('id', id).maybeSingle();
  if (readError) throw readError;
  if ((previous?.version ?? null) !== input.version) throw new ProfileError('Este perfil foi alterado em outro lugar. Recarregue a página antes de salvar.', 409);
  let uploadedPath;
  let photoPath = previous?.photo_path ?? null;
  if (Object.hasOwn(input, 'photo')) {
    if (input.photo === '') photoPath = null;
    else {
      const bytes = decodePhoto(input.photo);
      uploadedPath = `${id}/${randomUUID()}.jpg`;
      const upload = await db.storage.from('member-photos').upload(uploadedPath, bytes, { contentType: 'image/jpeg', upsert: false });
      if (upload.error) throw upload.error;
      photoPath = uploadedPath;
    }
  }
  const row = { ...fields, photo_path: photoPath, version: (previous?.version ?? 0) + 1 };
  const result = previous
    ? await db.from('member_profiles').update(row).eq('id', id).eq('version', input.version).select().maybeSingle()
    : await db.from('member_profiles').insert({ ...row, id }).select().single();
  if (result.error || !result.data) {
    if (uploadedPath) await db.storage.from('member-photos').remove([uploadedPath]).catch(() => {});
    if (result.error?.code === '23505' || !result.error) throw new ProfileError('Este perfil foi alterado em outro lugar. Recarregue a página antes de salvar.', 409);
    throw result.error;
  }
  if (previous?.photo_path && previous.photo_path !== photoPath) await db.storage.from('member-photos').remove([previous.photo_path]).catch(() => {});
  return { mode: 'supabase', profile: await toProfile(db, result.data) };
}
