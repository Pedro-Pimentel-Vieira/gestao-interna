import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import projectsHandler from './api/projects.js';
import membersHandler from './api/members.js';
import profilesHandler from './api/profiles.js';
import dashboardHandler from './api/dashboard.js';
import projectInsightsHandler from './api/project-insights.js';
function projectsApi() {
  const configure = server => { server.middlewares.use((req, res, next) => {
    if (req.url?.split('?')[0] === '/api/projects') return projectsHandler(req, res);
    if (req.url?.split('?')[0] === '/api/members') return membersHandler(req, res);
    if (req.url?.split('?')[0] === '/api/profiles') return profilesHandler(req, res);
    if (req.url?.split('?')[0] === '/api/dashboard') return dashboardHandler(req, res);
    if (req.url?.split('?')[0] === '/api/project-insights') return projectInsightsHandler(req, res);
    next();
  }); };
  return { name: 'projects-api', configureServer: configure, configurePreviewServer: configure };
}
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'SUPABASE_');
  for (const key of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[key] && env[key]) process.env[key] = env[key];
  }
  return { plugins: [react(), projectsApi()] };
});
