import express from 'express';
import path from 'node:path';
import { initDb, getCounts } from './db.js';

console.log('DB:', process.env.DATABASE_URL?.split('@')[1] ?? 'NIJE POSTAVLJENO');

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.set('views', path.join(import.meta.dirname, 'views'));
app.set('view engine', 'pug');

app.get('/', async (req, res) => {
    const counts = await getCounts();
    res.render('index', counts);
});

await initDb();

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});