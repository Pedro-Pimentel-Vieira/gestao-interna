import { useEffect, useRef, useState } from 'react';
import MemberProfile from './MemberProfile.jsx';
import SourceLinks from './SourceLinks.jsx';

const MEMBERS_SHEET = 'https://docs.google.com/spreadsheets/d/11-GXPflwaUZy1nzEU0kFXj65AC7GqPxB_PfPQJI2NCo/edit#gid=1682438240';

export default function Members({ memberId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refreshRef = useRef(() => {});
  useEffect(() => {
    let active = true;
    let pending = false;
    let controller;
    async function refresh() {
      if (pending) return;
      pending = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      setLoading(true);
      try {
        const response = await fetch('/api/members', { signal: controller.signal });
        if (!response.ok) throw new Error('Falha na leitura');
        const result = await response.json();
        if (!Array.isArray(result.members) || !result.members.every(member => typeof member.id === 'string' && typeof member.name === 'string' && (member.photo === undefined || typeof member.photo === 'string')) || !Number.isFinite(Date.parse(result.updatedAt))) throw new Error('Dados inválidos');
        if (!result.members.every(member => member.attendanceRate === null || (Number.isFinite(member.attendanceRate) && member.attendanceRate >= 0 && member.attendanceRate <= 100))) throw new Error('Presença inválida');
        if (active) { setData(result); setError(''); }
      } catch {
        if (active) setError('Não foi possível atualizar os membros. Tente novamente.');
      } finally {
        clearTimeout(timeout);
        pending = false;
        if (active) setLoading(false);
      }
    }
    refreshRef.current = refresh;
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => { active = false; clearInterval(interval); controller?.abort(); };
  }, []);
  const member = data?.members.find(item => item.id === memberId);
  useEffect(() => {
    if (memberId && member) document.title = `${member.name} | Gestão interna`;
  }, [memberId, member]);
  return <>
    {memberId && <>
      <a className="project-back" href="#membros">← Voltar para membros</a>
      {member ? <MemberProfile key={member.id} member={member} /> : !loading && !error && <p>Membro não encontrado na lista de ativos.</p>}
    </>}
    <div className="project-sync">
      <p role="status">{loading ? 'Atualizando membros…' : error || `Atualizado às ${new Date(data.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
        {error && data && ' Exibindo a última leitura disponível.'}
      </p>
      <button disabled={loading} onClick={() => refreshRef.current()}>Atualizar</button>
    </div>
    {!memberId && data && <section className="projects-list-section" aria-labelledby="members-list-title" aria-busy={loading}>
      <h2 id="members-list-title">Membros ativos <span className="members-count">({data.members.length})</span></h2>
      {data.members.length ? <ul className="projects-list">
        {data.members.map(member => <li key={member.id}>
          <a className="project-link" href={`#membros/${encodeURIComponent(member.id)}`}>
            <span className="member-list-photo">{member.photo ? <img src={member.photo} alt="" /> : <span aria-hidden="true">{member.name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('')}</span>}</span>
            <span className="project-link-name">{member.name}</span>
            <span className="project-status project-status-running">Ativo</span>
            <span aria-hidden="true">→</span>
          </a>
        </li>)}
      </ul> : <p>Nenhum membro ativo no momento.</p>}
    </section>}
    <SourceLinks links={[{ label: 'Planilha Clarimba', href: MEMBERS_SHEET }]} />
  </>;
}
