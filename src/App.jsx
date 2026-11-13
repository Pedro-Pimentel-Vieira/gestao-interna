import { useEffect, useRef, useState } from 'react';
import { coordinators, readCoordinator, STORAGE_KEY } from './profiles.js';
import Projects from './Projects.jsx';
import Members from './Members.jsx';
import HomeDashboard from './HomeDashboard.jsx';

const pages = [{ id: 'home', label: 'Home' }, { id: 'projetos', label: 'Projetos' }, { id: 'membros', label: 'Membros' }];
const currentPage = () => {
  const match = window.location.hash.match(/^#projetos\/(.+)$/);
  if (match) return { id: 'projetos', label: 'Projeto', projectId: match[1] };
  const memberMatch = window.location.hash.match(/^#membros\/(.+)$/);
  if (memberMatch) return { id: 'membros', label: 'Membro', memberId: memberMatch[1] };
  return pages.find(page => '#' + page.id === window.location.hash) ?? pages[0];
};

function Icon({ name }) {
  const paths = {
    home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z" />,
    projetos: <><path d="M3 7V5a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><path d="M3 10h18" /></>,
    membros: <><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 3a4 4 0 0 1 0 8m2 3a6 6 0 0 1 3 5v2" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    chevron: <path d="m7 10 5 5 5-5" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    switch: <path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}
function Avatar({ person, large = false }) {
  const [failed, setFailed] = useState(false);
  return <span className={`avatar avatar-${person.id}${large ? ' avatar-large' : ''}`}>
    {person.photo && !failed ? <img src={person.photo} alt="" onError={() => setFailed(true)} /> : <span aria-hidden="true">{person.initials}</span>}
  </span>;
}
export default function App() {
  const [person, setPerson] = useState(readCoordinator);
  const [choosing, setChoosing] = useState(false);
  const [page, setPage] = useState(currentPage);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [storageNotice, setStorageNotice] = useState('');
  const profileRef = useRef(null);
  const profileButtonRef = useRef(null);
  const switchButtonRef = useRef(null);
  const headingRef = useRef(null);
  const showChooser = !person || choosing;

  useEffect(() => {
    const onHashChange = () => { setPage(currentPage()); setMenuOpen(false); };
    const onStorage = event => {
      if (event.key === STORAGE_KEY || event.key === null) { setPerson(readCoordinator()); setProfileOpen(false); }
    };
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('hashchange', onHashChange); window.removeEventListener('storage', onStorage); };
  }, []);
  useEffect(() => {
    document.title = `${showChooser ? 'Escolha seu perfil' : page.label} | Gestão interna`;
    headingRef.current?.focus();
  }, [showChooser, page]);
  useEffect(() => {
    if (!profileOpen) return;
    switchButtonRef.current?.focus();
    const closeOutside = event => { if (!profileRef.current?.contains(event.target)) setProfileOpen(false); };
    const closeOnEscape = event => {
      if (event.key === 'Escape') { setProfileOpen(false); profileButtonRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, [profileOpen]);
  function selectPerson(selected) {
    try { localStorage.setItem(STORAGE_KEY, selected.id); setStorageNotice(''); }
    catch { setStorageNotice('Não foi possível salvar a escolha neste navegador. Você pode continuar nesta sessão.'); }
    setPerson(selected); setChoosing(false); setProfileOpen(false); setMenuOpen(false);
  }
  if (showChooser) return <main className="profile-screen">
    <div className="profile-intro">
      <span className="portal-mark"><Icon name="membros" /></span>
      <p className="eyebrow">GESTÃO INTERNA</p>
      <h1 ref={headingRef} tabIndex={-1}>Quem está por aqui?</h1>
      <p className="intro-description">Escolha seu perfil para acessar o portal da coordenação.</p>
    </div>
    <div className="profile-options">
      {coordinators.map(coordinator => <button key={coordinator.id} className="profile-card" onClick={() => selectPerson(coordinator)}>
        <Avatar person={coordinator} large />
        <span className="profile-card-name">{coordinator.name}</span>
        <span className="profile-card-role">{coordinator.role}</span>
        <span className="profile-card-action">Entrar <Icon name="arrow" /></span>
      </button>)}
    </div>
    <p className="remember-note">Vamos lembrar sua escolha neste navegador.</p>
    {person && <button className="back-button" onClick={() => setChoosing(false)}>Voltar ao portal</button>}
  </main>;
  return <div className="layout">
    <aside className="sidebar">
      <div className="brand"><p className="brand-name">Gestão interna</p><p className="brand-label">Portal da coordenação</p></div>
      <nav id="navigation" className={menuOpen ? 'is-open' : ''} aria-label="Navegação principal">
        {pages.map(item => <a key={item.id} className="nav-link" href={`#${item.id}`} aria-current={page.id === item.id ? 'page' : undefined} onClick={() => setMenuOpen(false)}><Icon name={item.id} />{item.label}</a>)}
      </nav>
    </aside>
    <div className="workspace">
      <header className="header">
        <button className="menu-button" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-controls="navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" /></button>
        <div className="header-brand"><p className="header-title">Portal da coordenação</p><p className="header-subtitle">Gestão interna</p></div>
        <div className="profile-control" ref={profileRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setProfileOpen(false); }}>
          <button ref={profileButtonRef} className="profile-button" aria-expanded={profileOpen} aria-controls="profile-popover" onClick={() => setProfileOpen(!profileOpen)}>
            <Avatar key={person.id} person={person} /><span className="profile-name">{person.name}</span><Icon name="chevron" />
          </button>
          {profileOpen && <div className="profile-popover" id="profile-popover"><button ref={switchButtonRef} onClick={() => { setChoosing(true); setProfileOpen(false); }}><Icon name="switch" />Trocar coordenador</button></div>}
        </div>
      </header>
      {storageNotice && <p role="status" className="storage-notice">{storageNotice}</p>}
      <main className="page" aria-labelledby="page-title">
        <h1 id="page-title" ref={headingRef} tabIndex={-1}>{page.label}</h1>
        {page.id === 'projetos' ? (
          <Projects projectId={page.projectId} />
        ) : page.id === 'membros' ? <Members memberId={page.memberId} /> : <HomeDashboard />}
      </main>
    </div>
  </div>;
}
