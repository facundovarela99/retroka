import express from 'express';
import './Config/Env.js';
import { router } from './Config/Router.js';
import { AppSession } from './Middleware/Session.middleware.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename)

const port = process.env.PORT;

const app = express();


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../public/views'))

app.use('/assets', express.static(path.join(__dirname, '../public/assets')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(AppSession())
app.use('/retroka', router)

app.listen(port, (req, res)=>{
    console.log(`Escuchando servidor en http://localhost:${port}`);
})

app.use((req, res)=>{
    res.status(404).send('<h1>Error página no encontrada</h1>')
})