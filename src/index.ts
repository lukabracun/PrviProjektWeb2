import express from 'express';
import path from 'node:path';
import oidc from 'express-openid-connect';
import {
  initDb, getCounts, listPasses, getPass, cancelPass, deletePass,
} from './db.js';

const { auth, requiresAuth } = oidc;

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.set('trust proxy', true);
app.set('views', path.join(import.meta.dirname, 'views'));
app.set('view engine', 'pug');

app.locals.formatTime = (date: Date) =>
  date.toLocaleString('hr-HR', { timeZone: 'Europe/Zagreb' });

app.use(auth({
  authRequired: false,
  idpLogout: true,
  secret: process.env.SECRET,
  baseURL: process.env.BASE_URL,
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
  authorizationParams: {
    response_type: 'code',
    scope: 'openid profile email',
  },
  routes: {
    logout: false,
  },
}));

app.post('/logout', (req, res) => {
  res.oidc.logout({ returnTo: process.env.BASE_URL });
});

app.get('/', async (req, res) => {
  const counts = await getCounts();
  const loggedIn = req.oidc.isAuthenticated();
  const user = loggedIn ? (req.oidc.user?.name ?? req.oidc.user?.sub) : undefined;
  const passes = loggedIn ? await listPasses() : [];
  res.render('index', { ...counts, user, passes });
});

app.get('/info/:id', async (req, res) => {
  const pass = await getPass(req.params.id);
  if (!pass) {
    res.status(404).render('not-found', { id: req.params.id });
    return;
  }
  res.render('info', { pass });
});

app.post('/admin/passes/:id/cancel', requiresAuth(), async (req, res) => {
  // Uz requiresAuth() TypeScript ne zaključi tip parametra, pa ga eksplicitno pretvaramo u string.
  const id = String(req.params.id);
  const ok = await cancelPass(id);
  if (!ok) {
    res.status(404).render('not-found', { id });
    return;
  }
  res.redirect('/');
});

app.post('/admin/passes/:id/delete', requiresAuth(), async (req, res) => {
  // Uz requiresAuth() TypeScript ne zaključi tip parametra, pa ga eksplicitno pretvaramo u string.
  const id = String(req.params.id);
  const ok = await deletePass(id);
  if (!ok) {
    res.status(404).render('not-found', { id });
    return;
  }
  res.redirect('/');
});

await initDb();

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
