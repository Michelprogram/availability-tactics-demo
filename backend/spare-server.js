const express = require('express');
const app = express();
const PORT = 3002;

let isFailing = false; // Le serveur de secours démarre en bonne santé

app.get('/health', (req, res) => {
  if (isFailing) {
    return res.status(500).send('Le serveur est en panne');
  }
  res.status(200).send('OK');
});

app.get('/api/data', (req, res) => {
  if (isFailing) {
    return res.status(500).send('Erreur : Panne du serveur');
  }
  res.json({ message: 'Données du serveur de secours' });
});

app.listen(PORT, () => {
  console.log(`Serveur de secours démarré sur le port ${PORT}`);
});