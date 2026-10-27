import express from 'express';
import path from 'node:path';
import oidc from 'express-openid-connect';
import { initDb, getCounts } from './db.js';

const { auth } = oidc;

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.set('trust proxy', true);
app.set('views', path.join(import.meta.dirname, 'views'));
app.set('view engine', 'pug');

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
  const user = req.oidc.isAuthenticated()
    ? (req.oidc.user?.name ?? req.oidc.user?.sub)
    : undefined;
  res.render('index', { ...counts, user });
});

await initDb();

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
