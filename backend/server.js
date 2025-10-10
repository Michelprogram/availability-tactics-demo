const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;      
const ROLE = process.env.ROLE || 'primary';  // 'primary' ou 'spare'


app.get('/health', (req, res) => {
  res.status(200).send('OK');
});


app.get('/api/data', (req, res) => {
  const message =
    ROLE === 'primary'
      ? 'Données du serveur principal'
      : 'Données du serveur de secours';

  res.json({ message, timestamp: new Date().toISOString() });
});


app.post('/fail', (req, res) => {
  res.send(`Panne simulée sur le serveur ${ROLE} : arrêt du processus`);
 
  process.exit(1);
});


app.listen(PORT, () => {
  const label = ROLE === 'primary' ? 'principal' : 'de secours';
  console.log(`Serveur ${label} (${ROLE}) démarré sur le port ${PORT}`);
});
