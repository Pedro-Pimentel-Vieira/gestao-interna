export const STORAGE_KEY = 'gestao-interna:coordenador';
export const coordinators = [
  { id: 'clara', name: 'Clara Guedes', initials: 'CG', role: 'Coordenadora', photo: '/fotos/clara.jpeg' },
  { id: 'pedro', name: 'Pedro Pimentel', initials: 'PP', role: 'Coordenador', photo: '/fotos/pedro.png' },
];
export function readCoordinator() {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return coordinators.find(person => person.id === id) ?? null;
  } catch { return null; }
}
