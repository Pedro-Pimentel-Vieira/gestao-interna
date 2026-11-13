export default function SourceLinks({ links }) {
  return <section className="source-links" aria-label="Planilhas relacionadas">
    <div><span className="source-links-label">PLANILHAS RELACIONADAS</span><p>Consulte ou atualize os dados diretamente na fonte.</p></div>
    <div className="source-links-actions">{links.map(link => <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label} <span aria-hidden="true">↗</span></a>)}</div>
  </section>;
}
