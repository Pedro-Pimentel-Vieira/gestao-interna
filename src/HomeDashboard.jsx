import { useEffect, useRef, useState } from 'react';
import SourceLinks from './SourceLinks.jsx';

const money = value => value === null || value === undefined ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const percent = (actual, target) => target > 0 ? Math.max(0, actual / target * 100) : 0;
const capped = value => Math.min(100, Math.max(0, value || 0));

function Progress({ value }) {
  return <div className="goal-progress" aria-label={`${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% atingido`}><span style={{ width: `${capped(value)}%` }} /></div>;
}

function CycleCard({ kind, title, data }) {
  const value = data.percentage ?? percent(data.actual, data.target);
  const missing = Math.max(0, (data.target ?? 0) - data.actual);
  return <article className={`cycle-goal cycle-goal-${kind}`}>
    <div className="cycle-goal-top"><div><p className="dashboard-kicker">{title}</p><h3>{money(data.actual)}</h3></div><div className="progress-ring" style={{ '--progress': `${capped(value) * 3.6}deg` }}><strong>{value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong></div></div>
    <Progress value={value} />
    <div className="goal-meta"><span>Meta CCE <strong>{money(data.target)}</strong></span><span>Faltam <strong>{money(missing)}</strong></span></div>
  </article>;
}

export default function HomeDashboard() {
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
      const timeout = setTimeout(() => controller.abort(), 18000);
      setLoading(true);
      try {
        const response = await fetch('/api/dashboard', { signal: controller.signal });
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (result.scope !== 'CCE' || !result.month?.sales || !result.month?.billing || !result.cycleResults?.sales || !result.cycleResults?.billing || !Number.isFinite(Date.parse(result.updatedAt))) throw new Error();
        if (active) { setData(result); setError(''); }
      } catch {
        if (active) setError('Não foi possível atualizar os indicadores agora.');
      } finally {
        clearTimeout(timeout); pending = false; if (active) setLoading(false);
      }
    }
    refreshRef.current = refresh;
    refresh();
    const interval = setInterval(refresh, 300000);
    return () => { active = false; clearInterval(interval); controller?.abort(); };
  }, []);

  if (!data && loading) return <div className="dashboard-loading" aria-live="polite"><span />Carregando indicadores de CCE…</div>;
  if (!data) return <div className="dashboard-error"><p role="alert">{error}</p><button onClick={() => refreshRef.current()}>Tentar novamente</button></div>;
  const salesCyclePct = data.cycleResults.sales.percentage ?? percent(data.cycleResults.sales.actual, data.cycleResults.sales.target);
  const billingCyclePct = data.cycleResults.billing.percentage ?? percent(data.cycleResults.billing.actual, data.cycleResults.billing.target);
  const billingMonthPct = percent(data.month.billing.actual, data.month.billing.forecast);
  return <div className="dashboard">
    <section className="dashboard-hero">
      <div><p className="dashboard-eyebrow">PAINEL DA COORDENAÇÃO</p><h2>Visão de CCE</h2><p>{data.cycle.name} · até {data.cycle.end}</p></div>
      <div className="cycle-countdown"><strong>{data.cycle.daysRemaining ?? '—'}</strong><span>dias para o fim do ciclo</span></div>
    </section>

    <section aria-labelledby="month-title"><div className="dashboard-section-title"><div><p className="dashboard-kicker">RESULTADO MENSAL</p><h2 id="month-title">{data.period.replace('/', ' de ')}</h2></div><span className="scope-chip">CCE</span></div>
      <div className="month-grid">
        <article className="month-card"><div className="metric-icon">↗</div><p>Vendas de CCE no mês</p><h3>{money(data.month.sales.actual)}</h3><div className="month-card-detail"><span>{data.month.sales.contracts} {data.month.sales.contracts === 1 ? 'contrato' : 'contratos'}</span><span>Meta geral do Fluxo: {money(data.month.sales.target)}</span></div><p className="data-note">A planilha não informa uma meta mensal exclusiva de CCE.</p></article>
        <article className="month-card"><div className="metric-icon">R$</div><p>Faturamento CCE no mês</p><h3>{money(data.month.billing.actual)}</h3><Progress value={billingMonthPct} /><div className="month-card-detail"><span>{billingMonthPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% da previsão CCE</span><span>Previsão: {money(data.month.billing.forecast)}</span></div><p className="data-note">Meta geral do Fluxo: {money(data.month.billing.target)}</p></article>
      </div>
    </section>

    <section aria-labelledby="cycle-title"><div className="dashboard-section-title"><div><p className="dashboard-kicker">META DO CICLO</p><h2 id="cycle-title">Desempenho de CCE</h2></div></div><div className="cycle-grid"><CycleCard kind="sales" title="Vendas no ciclo" data={data.cycleResults.sales} /><CycleCard kind="billing" title="Faturamento no ciclo" data={data.cycleResults.billing} /></div></section>

    <section className="management-summary" aria-labelledby="summary-title"><div><p className="dashboard-kicker">LEITURA PARA A COORDENAÇÃO</p><h2 id="summary-title">Onde concentrar atenção</h2></div><div className="attention-list">
      <div className={salesCyclePct < 50 ? 'attention-critical' : ''}><span>Vendas</span><strong>{salesCyclePct < 50 ? 'Prioridade alta' : 'Em acompanhamento'}</strong><p>{money(Math.max(0, data.cycleResults.sales.target - data.cycleResults.sales.actual))} ainda necessários no ciclo.</p></div>
      <div className={billingCyclePct >= 80 ? 'attention-positive' : ''}><span>Faturamento</span><strong>{billingCyclePct >= 80 ? 'Perto da meta' : 'Em acompanhamento'}</strong><p>{money(Math.max(0, data.cycleResults.billing.target - data.cycleResults.billing.actual))} para alcançar a meta.</p></div>
    </div></section>

    <div className="dashboard-sync"><p role="status">{loading ? 'Atualizando indicadores…' : error ? `${error} Exibindo a última leitura.` : `Atualizado às ${new Date(data.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}</p><button disabled={loading} onClick={() => refreshRef.current()}>Atualizar dados</button></div>
    <SourceLinks links={[{ label: 'Vendas 26/27', href: 'https://docs.google.com/spreadsheets/d/1WKWznpWgS2VDKCaLHiBUjfZfJsFnYxR-8_92EC7O9B8/edit' }, { label: 'Faturamento 26/27', href: 'https://docs.google.com/spreadsheets/d/1VhcOqq1GKvwf3xEPUBTJsN_OjSwhcUy9raf9BceLQ-E/edit' }]} />
  </div>;
}
