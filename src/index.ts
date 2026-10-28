import express from 'express';
import path from 'node:path';
import oidc from 'express-openid-connect';
import { auth as jwtAuth, requiredScopes } from 'express-oauth2-jwt-bearer';
import QRCode from 'qrcode';
import {
  initDb, getCounts, listPasses, getPass, createPass, cancelPass, deletePass, toApiJson,
} from './db.js';

const { auth, requiresAuth } = oidc;

const app = express();
const port = Number(process.env.PORT ?? 3000);
const baseUrl = process.env.BASE_URL;

app.set('trust proxy', true);
app.set('views', path.join(import.meta.dirname, 'views'));
app.set('view engine', 'pug');

app.locals.formatTime = (date: Date) =>
  date.toLocaleString('hr-HR', { timeZone: 'Europe/Zagreb' });

const checkJwt = jwtAuth({
  audience: process.env.AUDIENCE,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
});

app.get('/passes/:id', checkJwt, requiredScopes('read:passes'), async (req, res) => {
  const pass = await getPass(String(req.params.id));
  if (!pass) {
    res.status(404).json({ error: 'Pass not found' });
    return;
  }
  res.json(toApiJson(pass));
});

app.post('/passes', checkJwt, requiredScopes('create:passes'), express.json(), async (req, res) => {
  const { name, document } = req.body ?? {};
  if (typeof name !== 'string' || typeof document !== 'string'
      || name.trim() === '' || document.trim() === '') {
    res.status(400).json({ error: 'name and document are required' });
    return;
  }
  const pass = await createPass(name.trim(), document.trim());
  const png = await QRCode.toBuffer(`${baseUrl}/info/${pass.id}`, { type: 'png' });
  res.status(201)
    .location(`${baseUrl}/passes/${pass.id}`)
    .type('image/png')
    .send(png);
});

app.use(auth({
  authRequired: false,
  idpLogout: true,
  secret: process.env.SESSION_SECRET,
  baseURL: baseUrl,
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
  res.oidc.logout({ returnTo: baseUrl });
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
  const id = String(req.params.id);
  if (!await cancelPass(id)) {
    res.status(404).render('not-found', { id });
    return;
  }
  res.redirect('/');
});

app.post('/admin/passes/:id/delete', requiresAuth(), async (req, res) => {
  const id = String(req.params.id);
  if (!await deletePass(id)) {
    res.status(404).render('not-found', { id });
    return;
  }
  res.redirect('/');
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const status = typeof err?.status === 'number' ? err.status : 500;
  if (status === 500) console.error(err);
  if (res.headersSent) {
    next(err);
    return;
  }
  if (req.path.startsWith('/passes')) {
    res.status(status).json({ error: err?.message ?? 'Error' });
    return;
  }
  res.status(status).send(status === 500 ? 'Internal Server Error' : err?.message);
});

await initDb();

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
