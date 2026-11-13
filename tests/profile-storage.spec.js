import { test, expect } from '@playwright/test';
import { validateProfile, decodePhoto, saveProfile } from '../server/profile-storage.js';

const fields = { name: 'Clara', role: '', email: '', phone: '', bio: '', attendance: '', version: null };

test('valida os dados recebidos pelo servidor e rejeita fotos inválidas', () => {
  expect(validateProfile(fields)).toMatchObject({ name: 'Clara', attendance: null });
  expect(validateProfile({ ...fields, attendance: '0' }).attendance).toBe(0);
  for (const attendance of ['-1', '101', 'abc']) expect(() => validateProfile({ ...fields, attendance })).toThrow();
  expect(() => validateProfile({ ...fields, bio: 'a'.repeat(3001) })).toThrow();
  expect(() => validateProfile({ ...fields, email: 'inválido' })).toThrow();
  expect(() => decodePhoto('https://example.com/foto.jpg')).toThrow();
  expect(() => decodePhoto('data:image/jpeg;base64,YWJjZA==')).toThrow();
});

function database(initial = null, conflict = false) {
  let row = initial;
  const removed = [];
  const uploaded = [];
  return {
    row: () => row, removed, uploaded,
    from() {
      let write;
      let insertion = false;
      const filters = {};
      const query = {
        select() { return query; }, eq(key, value) { filters[key] = value; return query; },
        insert(value) { write = value; insertion = true; return query; },
        update(value) { write = value; return query; },
        async maybeSingle() {
          if (!write) return { data: row, error: null };
          if (conflict || (!insertion && row.version !== filters.version)) return { data: null, error: null };
          row = { ...row, ...write }; return { data: row, error: null };
        },
        single() { return query.maybeSingle(); },
      };
      return query;
    },
    storage: { from: () => ({
      upload: async path => { uploaded.push(path); return { error: null }; },
      remove: async paths => { removed.push(...paths); return { error: null }; },
      createSignedUrl: async () => ({ data: { signedUrl: 'https://example.com/signed-photo' }, error: null }),
    }) },
  };
}

test('salva e detecta edição concorrente sem sobrescrever a versão existente', async () => {
  const db = database();
  const first = await saveProfile('1234567890abcdef1234', fields, db);
  expect(first.profile.version).toBe(1);
  await expect(saveProfile('1234567890abcdef1234', fields, db)).rejects.toMatchObject({ status: 409 });
  const second = await saveProfile('1234567890abcdef1234', { ...fields, version: 1, role: 'Coordenação' }, db);
  expect(second.profile).toMatchObject({ version: 2, role: 'Coordenação' });
});

test('remove upload novo se uma edição concorrente impedir a gravação', async () => {
  const db = database({ ...fields, attendance: null, version: 1, photo_path: 'old/photo.jpg' }, true);
  await expect(saveProfile('1234567890abcdef1234', { ...fields, version: 1, photo: 'data:image/jpeg;base64,/9j/2Q==' }, db)).rejects.toMatchObject({ status: 409 });
  expect(db.uploaded).toHaveLength(1);
  expect(db.removed).toEqual(db.uploaded);
  expect(db.row().photo_path).toBe('old/photo.jpg');
});

test('salvamento compartilhado usa a API e conserva formulário em caso de conflito', async ({ page }) => {
  const id = '1234567890abcdef1234';
  let stored = null;
  let conflict = false;
  await page.route('**/api/members', route => route.fulfill({ json: { members: [{ id, name: 'Clara Guedes', attendanceRate: 75 }], updatedAt: new Date().toISOString() } }));
  await page.route('**/api/profiles?*', async route => {
    if (route.request().method() === 'PUT') {
      if (conflict) return route.fulfill({ status: 409, json: { error: 'Este perfil foi alterado em outro lugar.' } });
      const body = route.request().postDataJSON();
      stored = { ...body, version: 1, photo: '' };
    }
    return route.fulfill({ json: { mode: 'supabase', profile: stored } });
  });
  await page.goto(`/#membros/${id}`);
  await page.getByRole('button', { name: /Clara Guedes/ }).click();
  await expect(page.getByText('Banco conectado')).toBeVisible();
  await page.getByRole('button', { name: 'Editar perfil' }).click();
  await page.getByLabel('Cargo / função').fill('Coordenadora');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Perfil salvo e compartilhado com a equipe.')).toBeVisible();
  await page.reload();
  await expect(page.locator('.member-identity')).toContainText('Coordenadora');
  expect(await page.evaluate(id => localStorage.getItem(`gestao-interna:perfil:${id}`), id)).toBeNull();
  conflict = true;
  await page.getByRole('button', { name: 'Editar perfil' }).click();
  await page.getByLabel('Cargo / função').fill('Nova função');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('alert')).toContainText('alterado em outro lugar');
  await expect(page.getByLabel('Cargo / função')).toHaveValue('Nova função');
});
