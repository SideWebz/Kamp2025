const express = require('express');
const exphbs = require('express-handlebars');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const session = require('express-session');
const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 7889;

// 📁 Database-initialisatie
const dbPath = './db.sqlite';
const dbExists = fs.existsSync(dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error('DB fout:', err);

  if (!dbExists) {
    console.log('Database niet gevonden, maak nieuwe aan...');
    db.run(`
      CREATE TABLE IF NOT EXISTS briefjes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        message TEXT,
        photo TEXT,
        release_at DATETIME
      )
    `, (err) => {
      if (err) console.error('Fout bij DB creatie:', err);
      else console.log('Tabel briefjes aangemaakt.');
    });
  }
});

// 📁 Foto-upload config (naar /public/uploads)
const storage = multer.diskStorage({
  destination: 'public/uploads',
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ⚙️ View engine instellen
const hbs = exphbs.create({
  extname: 'hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  helpers: {
    gt: (a, b) => a > b
  }
});

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');


// 📦 Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'liefde',
  resave: false,
  saveUninitialized: true
}));

// 📅 Einddatum kamp (PAS DIT AAN)
const kampEind = dayjs('2025-07-14T16:30:00');

// 🏠 Homepagina
app.get('/', (req, res) => {
  const now = dayjs();

db.all("SELECT * FROM briefjes ORDER BY release_at ASC", (err, rows) => {

    if (err) return res.send('Databasefout');

    const einde = kampEind;
    const diff = einde.diff(now, 'second');
    const dagen = Math.floor(diff / 86400);
    const uren = Math.floor((diff % 86400) / 3600);

    res.render('home', {
      briefjes: rows.map(b => ({
        ...b,
        countdown: Math.max(0, dayjs(b.release_at).diff(now, 'second'))
      })),
      dagen,
      uren
    });
  });
});

// 🔐 Admin loginpagina
app.get('/admin', (req, res) => {
  if (req.session.loggedIn) return res.render('admin');
  res.render('login');
});

// 🔐 Login POST
app.post('/admin', (req, res) => {
  const { password } = req.body;
  if (password === 'geheim123') {
    req.session.loggedIn = true;
    return res.redirect('/admin');
  }
  res.send('Verkeerd wachtwoord.');
});

// 📝 Nieuw briefje posten
app.post('/admin/nieuw', upload.single('photo'), (req, res) => {
  if (!req.session.loggedIn) return res.status(403).send("Niet ingelogd");

  const { title, message, release_at } = req.body;
  const photo = req.file.filename;

  db.run(
    "INSERT INTO briefjes (title, message, photo, release_at) VALUES (?, ?, ?, ?)",
    [title, message, photo, release_at],
    (err) => {
      if (err) return res.send('Fout bij opslaan');
      res.redirect('/admin');
    }
  );
});

// 🏁 Start server
app.listen(port, () => {
  console.log(`Server draait op http://localhost:${port}`);
});
