import { useEffect, useRef, useState } from 'react';
import ProjectDetail from './ProjectDetail.jsx';
import SourceLinks from './SourceLinks.jsx';

const PROJECTS_SHEET = 'https://docs.google.com/spreadsheets/d/1eQ3ZfPck-0ASHwzRAn5p86hfZAxITwfWAu6Nr6vyoSo/edit';

export default function Projects({ projectId }) {
  const [summary, setSummary] = useState(null);
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
        const response = await fetch('/api/projects', { signal: controller.signal });
        if (!response.ok) throw new Error('Falha na leitura');
        const data = await response.json();
        if (![data.running, data.paused].every(n => Number.isInteger(n) && n >= 0) || !Number.isFinite(Date.parse(data.updatedAt))) throw new Error('Dados inválidos');
        if (!Array.isArray(data.projects) || !data.projects.every(project => typeof project.id === 'string' && typeof project.name === 'string' && ['running', 'paused'].includes(project.status))) throw new Error('Lista inválida');
        if (active) { setSummary(data); setError(''); }
      } catch {
        if (active) setError('Não foi possível atualizar os projetos. Tente novamente.');
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
  const project = summary?.projects.find(item => item.id === projectId);
  useEffect(() => {
    if (projectId && project) document.title = `${project.name} | Gestão interna`;
  }, [projectId, project]);
  return <>
    {projectId ? <>
      <a className="project-back" href="#projetos">← Voltar para projetos</a>
      {project ? <section className="project-detail" aria-labelledby="project-name"><ProjectDetail project={project} /></section> : !loading && !error && <p>Projeto não encontrado na lista atual.</p>}
    </> : <dl className="project-stats" aria-busy={loading}>
      <div className="project-stat"><dt>Projetos rodando</dt><dd>{summary?.running ?? '—'}</dd></div>
      <div className="project-stat"><dt>Projetos paralisados</dt><dd>{summary?.paused ?? '—'}</dd></div>
    </dl>}
    <div className="project-sync">
      <p role="status">{loading ? 'Atualizando projetos…' : error || `Atualizado às ${new Date(summary.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
        {error && summary && ' Exibindo a última leitura disponível.'}
      </p>
      <button disabled={loading} onClick={() => refreshRef.current()}>Atualizar</button>
    </div>
    {!projectId && summary && <section className="projects-list-section" aria-labelledby="projects-list-title">
      <h2 id="projects-list-title">Lista de projetos</h2>
      {summary.projects.length ? <ul className="projects-list">
        {[...summary.projects].sort((a, b) => Number(a.status === 'paused') - Number(b.status === 'paused')).map(item => <li key={item.id}>
          <a className="project-link" href={`#projetos/${encodeURIComponent(item.id)}`}>
            <span className="project-link-name">{item.name}</span>
            <span className="project-schedule-state">{item.scheduleUrl ? 'Cronograma vinculado' : 'Sem cronograma'}</span>
            <span className={`project-status project-status-${item.status}`}>{item.status === 'paused' ? 'Paralisado' : 'Rodando'}</span>
            <span aria-hidden="true">→</span>
          </a>
        </li>)}
      </ul> : <p>Nenhum projeto rodando ou paralisado no momento.</p>}
    </section>}
    {!projectId && <SourceLinks links={[{ label: 'Acompanhamento de projetos', href: PROJECTS_SHEET }]} />}
  </>;
}
