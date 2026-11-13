import { useEffect, useRef, useState } from 'react';
import SourceLinks from './SourceLinks.jsx';

const MASTER_SHEET = 'https://docs.google.com/spreadsheets/d/1eQ3ZfPck-0ASHwzRAn5p86hfZAxITwfWAu6Nr6vyoSo/edit';
const money = value => value === null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = value => value === null ? '—' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export default function ProjectDetail({ project }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const refreshRef = useRef(() => {});
  useEffect(() => {
    let active = true, controller;
    async function refresh() {
      controller?.abort(); controller = new AbortController(); setLoading(true);
      try {
        const response = await fetch(`/api/project-insights?id=${encodeURIComponent(project.id)}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (active) { setData(result); setError(''); }
      } catch (cause) { if (active && cause.name !== 'AbortError') setError('Não foi possível atualizar o cronograma agora.'); }
      finally { if (active) setLoading(false); }
    }
    refreshRef.current = refresh; refresh();
    const interval = setInterval(refresh, 300000);
    return () => { active = false; clearInterval(interval); controller?.abort(); };
  }, [project.id]);
  const insights = data?.insights;
  const scheduleUrl = data?.project?.scheduleUrl || project.scheduleUrl;
  const links = [{ label: 'Acompanhamento de projetos', href: data?.masterSheetUrl || MASTER_SHEET }];
  if (scheduleUrl) links.unshift({ label: 'Cronograma do projeto', href: scheduleUrl });
  return <>
    <section className="project-detail-hero"><div><span className={`project-status project-status-${project.status}`}>{project.status === 'paused' ? 'Paralisado' : 'Rodando'}</span><h2 id="project-name">{project.name}</h2><p>Visão executiva baseada no cronograma do projeto.</p></div>{scheduleUrl && <a className="project-sheet-button" href={scheduleUrl} target="_blank" rel="noreferrer">Abrir cronograma ↗</a>}</section>
    {loading && !data ? <div className="dashboard-loading" aria-live="polite"><span />Carregando cronograma…</div> : error && !data ? <div className="project-insights-empty"><h3>Dados temporariamente indisponíveis</h3><p>{error}</p></div> : !insights ? <div className="project-insights-empty"><h3>Cronograma não vinculado</h3><p>Este projeto ainda não possui um link de cronograma na planilha de acompanhamento.</p></div> : <>
      <section className="project-insights-grid" aria-label="Indicadores do projeto">
        <article className="project-progress-card"><span>Progresso atual</span><strong>{decimal(insights.progress)}</strong><div className="project-progress-bar"><i style={{ width: `${Math.min(100, Math.max(0, insights.progress || 0))}%` }} /></div><p>{decimal(insights.remaining)} restante · planejado: {decimal(insights.plannedProgress)}</p></article>
        <article><span>Término previsto</span><strong>{insights.expectedEndDate || '—'}</strong><p>{insights.delayDays > 0 ? `${insights.delayDays} dias de atraso informados` : 'Sem atraso informado'}</p></article>
        <article><span>Início</span><strong>{insights.startDate || '—'}</strong><p>Data registrada no cronograma</p></article>
        <article><span>Valor do projeto</span><strong>{money(insights.projectValue)}</strong><p>Valor registrado na planilha</p></article>
      </section>
      <section className="activity-summary"><div><span>Atividades concluídas</span><strong>{insights.activities.completed}</strong></div><div><span>Em andamento</span><strong>{insights.activities.inProgress}</strong></div><div><span>Não iniciadas</span><strong>{insights.activities.notStarted}</strong></div><div><span>Total mapeado</span><strong>{insights.activities.total}</strong></div></section>
    </>}
    <div className="project-sync"><p role="status">{loading ? 'Atualizando cronograma…' : error || (data?.updatedAt ? `Atualizado às ${new Date(data.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '')}</p><button disabled={loading} onClick={() => refreshRef.current()}>Atualizar</button></div>
    <SourceLinks links={links} />
  </>;
}
