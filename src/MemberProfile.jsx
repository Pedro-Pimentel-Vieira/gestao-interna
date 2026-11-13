import { useEffect, useRef, useState } from 'react';

const keyFor = id => `gestao-interna:perfil:${id}`;
function readProfile(id) {
  try {
    const value = JSON.parse(localStorage.getItem(keyFor(id)) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(['name', 'role', 'email', 'phone', 'bio', 'photo', 'attendance'].filter(key => typeof value[key] === 'string').map(key => [key, value[key]]));
  } catch { return {}; }
}

async function resizePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Escolha uma imagem JPG, PNG ou WebP de até 10 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .85);
  } finally { bitmap.close(); }
}

export default function MemberProfile({ member }) {
  const [saved, setSaved] = useState(() => readProfile(member.id));
  const [draft, setDraft] = useState({});
  const [editing, setEditing] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('loading');
  const [saving, setSaving] = useState(false);
  const editingRef = useRef(false);
  const localProfile = readProfile(member.id);
  const hasLocalProfile = Object.keys(localProfile).length > 0;
  const busy = saving || photoLoading;
  useEffect(() => { editingRef.current = editing; }, [editing]);
  useEffect(() => {
    let active = true;
    let pending = false;
    const controller = new AbortController();
    async function load() {
      if (pending || editingRef.current) return;
      pending = true;
      try {
        const response = await fetch(`/api/profiles?id=${encodeURIComponent(member.id)}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (!['local', 'supabase'].includes(result.mode)) throw new Error();
        if (active && !editingRef.current) {
          setMode(result.mode);
          setSaved(result.mode === 'supabase' ? result.profile || {} : readProfile(member.id));
          setError('');
        }
      } catch {
        if (active && !editingRef.current) { setMode('error'); setError('Não foi possível carregar o perfil salvo. Recarregue a página para tentar novamente.'); }
      } finally { pending = false; }
    }
    load();
    const interval = setInterval(load, 60000);
    return () => { active = false; clearInterval(interval); controller.abort(); };
  }, [member.id]);
  const values = { name: member.name, role: '', email: '', phone: '', bio: '', photo: '', attendance: '', ...(editing ? draft : saved) };
  const rate = values.attendance === '' ? member.attendanceRate : Number(values.attendance);
  const initials = (values.name || member.name).split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('');
  const update = event => setDraft(previous => ({ ...previous, [event.target.name]: event.target.value }));
  function edit() { setDraft({ ...saved }); setEditing(true); setMessage(''); setError(''); }
  function cancel() { setEditing(false); setError(''); }
  async function save(event) {
    event.preventDefault();
    if (!values.name.trim()) { setError('Preencha o nome do membro.'); return; }
    if (values.attendance !== '' && (!Number.isFinite(rate) || rate < 0 || rate > 100)) { setError('Informe uma presença entre 0 e 100.'); return; }
    const next = { ...draft };
    if (next.name !== undefined) next.name = next.name.trim();
    setSaving(true);
    try {
      if (mode === 'supabase') {
        const payload = { name: values.name.trim(), role: values.role, email: values.email, phone: values.phone, bio: values.bio, attendance: values.attendance, version: draft.version ?? null };
        if (values.photo !== (saved.photo || '')) payload.photo = values.photo;
        const response = await fetch(`/api/profiles?id=${encodeURIComponent(member.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível salvar no banco.');
        setSaved(result.profile); setMessage('Perfil salvo e compartilhado com a equipe.');
      } else if (mode === 'local') {
        localStorage.setItem(keyFor(member.id), JSON.stringify(next));
        setSaved(next); setMessage('Perfil salvo neste navegador.');
      } else throw new Error('Aguarde o carregamento do perfil antes de salvar.');
      setEditing(false); setError('');
    } catch (cause) { setError(`${cause.message || 'Não foi possível salvar.'} Suas alterações continuam no formulário.`); }
    finally { setSaving(false); }
  }
  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true); setError('');
    try { const photo = await resizePhoto(file); setDraft(previous => ({ ...previous, photo })); }
    catch (cause) { setError(cause.message || 'Não foi possível abrir a imagem.'); }
    finally { setPhotoLoading(false); event.target.value = ''; }
  }
  return <section className="member-profile" aria-labelledby="member-name">
    <div className="member-cover" />
    <form onSubmit={save}>
      <div className="member-profile-header">
        <div className="member-photo">{values.photo ? <img src={values.photo} alt={`Foto de ${values.name}`} /> : <span aria-hidden="true">{initials}</span>}</div>
        <div className="member-identity"><h2 id="member-name">{values.name || member.name}</h2><p>{values.role || 'Membro da equipe'}</p><div className="profile-badges"><span className="project-status project-status-running">Ativo</span>{mode === 'supabase' && <span className="database-status"><span aria-hidden="true" />Banco conectado</span>}</div></div>
        <div className="profile-actions">{editing ? <><button type="button" className="secondary-button" disabled={busy} onClick={cancel}>Cancelar</button><button className="primary-button" disabled={busy} type="submit">{saving ? 'Salvando…' : 'Salvar alterações'}</button></> : <button className="primary-button" type="button" disabled={!['local', 'supabase'].includes(mode)} onClick={edit}>Editar perfil</button>}</div>
      </div>
      {editing && <div className="photo-controls"><label className="secondary-button">{photoLoading ? 'Carregando foto…' : 'Alterar foto'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={busy} /></label>{values.photo && <button type="button" className="secondary-button" disabled={busy} onClick={() => setDraft(previous => ({ ...previous, photo: '' }))}>Remover foto</button>}</div>}
      <div className="member-profile-body">
        <section className="profile-info"><h3>Informações pessoais</h3>
          {editing ? <div className="profile-fields">
            <label>Nome completo<input autoFocus name="name" value={values.name} onChange={update} required maxLength={160} /></label>
            <label>Cargo / função<input name="role" value={values.role} onChange={update} maxLength={100} placeholder="Ex.: Desenvolvedor" /></label>
            <label>E-mail<input name="email" type="email" value={values.email} onChange={update} maxLength={200} placeholder="nome@empresa.com" /></label>
            <label>Telefone<input name="phone" type="tel" value={values.phone} onChange={update} maxLength={40} placeholder="(00) 00000-0000" /></label>
            <label className="full-field">Sobre o membro<textarea name="bio" rows={5} value={values.bio} onChange={update} maxLength={3000} placeholder="Adicione uma descrição, responsabilidades ou outras informações." /></label>
          </div> : <><dl className="profile-facts"><div><dt>Nome completo</dt><dd>{values.name}</dd></div><div><dt>Cargo / função</dt><dd>{values.role || 'Não informado'}</dd></div><div><dt>E-mail</dt><dd>{values.email || 'Não informado'}</dd></div><div><dt>Telefone</dt><dd>{values.phone || 'Não informado'}</dd></div></dl><h3>Sobre o membro</h3><p className="member-bio">{values.bio || 'Nenhuma informação adicionada ainda.'}</p></>}
        </section>
        <section className="profile-attendance"><h3>Participação</h3><dl className="project-stat"><dt>Taxa de presença</dt><dd>{rate === null ? '—' : `${rate.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`}</dd></dl>
          {rate === null && <p className="attendance-note">Taxa de presença indisponível na planilha.</p>}
          {editing ? <label className="attendance-input">Presença manual (%)<input name="attendance" type="number" min="0" max="100" step="0.01" value={values.attendance} onChange={update} placeholder="Usar valor da planilha" /><span>Deixe vazio para acompanhar automaticamente a planilha.</span></label> : <p className="attendance-note">{values.attendance === '' ? 'Atualizada pela planilha Clarimba.' : 'Valor editado neste perfil.'}</p>}
        </section>
      </div>
      <div className="profile-footer"><p>{mode === 'supabase' ? 'As edições são compartilhadas com a equipe. A planilha de origem permanece inalterada.' : mode === 'loading' ? 'Carregando perfil salvo…' : mode === 'local' ? 'As edições ficam salvas apenas neste navegador e não alteram a planilha.' : 'O perfil salvo está temporariamente indisponível.'}</p>
        {mode === 'supabase' && hasLocalProfile && !editing && <button type="button" className="secondary-button" onClick={() => { setDraft({ ...saved, ...localProfile, version: saved.version }); setEditing(true); setMessage('Revise os dados deste navegador e clique em Salvar alterações para compartilhar.'); }}>Importar dados deste navegador</button>}
        {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
      </div>
    </form>
  </section>;
}
