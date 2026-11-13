import { getSupabase } from '../server/supabase.js';
import { getMembers } from '../server/members.js';
import { getProjectsSummary } from '../server/projects.js';

const db = getSupabase();
if (!db) throw new Error('Configure o Supabase em .env.local antes de importar.');
const [members, projects] = await Promise.all([getMembers(), getProjectsSummary()]);
for (const [table, rows] of [
  ['member_profiles', members.members.map(member => ({ id: member.id, name: member.name }))],
  ['projects', projects.projects.map(project => ({ id: project.id, name: project.name }))],
]) {
  if (!rows.length) continue;
  const { error } = await db.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error(`Não foi possível importar ${table}. Confira as tabelas e permissões.`);
  console.log(`${table}: ${rows.length} registros conferidos; registros existentes preservados.`);
}
