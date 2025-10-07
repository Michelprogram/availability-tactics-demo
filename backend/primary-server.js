const express = require('express');
const app = express();
const PORT = 3001;

let isFailing = false;

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
    res.json({ message: 'Données du serveur principal', timestamp: new Date().toISOString() });
});

app.post('/fail', (req, res) => {
    isFailing = true;
    res.send('Panne simulée sur le serveur principal');
});

app.listen(PORT, () => {
    console.log(`Serveur principal démarré sur le port ${PORT}`);
});