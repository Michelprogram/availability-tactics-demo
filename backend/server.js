const express = require('express');
const os = require('os');
const app = express();

const PORT = process.env.PORT || 3000;      
const ROLE = process.env.ROLE || 'primary';  // 'primary' ou 'spare'


app.get('/health', (req, res) => {
  const ip = Object.values(os.networkInterfaces())
    .flat()
    .find((iface) => iface.family === 'IPv4' && !iface.internal)?.address || 'unknown';

  res.status(200).json({
    status: 'OK',
    ip,
    port: PORT
  });
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
