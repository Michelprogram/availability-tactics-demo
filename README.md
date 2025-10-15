# Proof of Concept – Tactiques de Disponibilité

## Extrait vidéo

[![Démonstration vidéo]()](https://www.youtube.com/watch?v=vuWMAhkEBoA)


## Objectif

Ce projet démontre deux **tactiques de disponibilité** essentielles dans l’architecture logicielle :

1. **Détection de défaillance** le système identifie automatiquement lorsqu’un service devient inactif.  
2. **Récupération après panne (redondance)** un service de secours (secondary) prend le relais du service principal (primary).

L’application illustre un système redondant capable de maintenir sa disponibilité malgré une panne simulée.

De plus nous avons ajouté **les parties bonus**, quant'à la latence durant le temps de bascule ainsi que le taux d'erreur pendant la bascule.

---

## Tactiques mises en œuvre

### 1. Détection de défaillance

Le **reverse proxy** vérifie périodiquement la santé du service principal via l’endpoint `/health`.  
- Si le service répond (`200 OK`), il reste actif.  
- En cas d’erreur ou d’absence de réponse, la défaillance est détectée.

### 2. Récupération après panne

Lorsqu’une panne est détectée :
- Le **reverse proxy** bascule automatiquement le trafic vers le **backend de secours**. 
- Le service principal se rédemarre.

Cette tactique assure une **tolérance aux pannes** via la **redondance**.

---

## Design de l’application

L’architecture repose sur **quatre conteneurs Docker** interconnectés dans un même réseau virtuel.

### Composants

| Composant | Description | Port | Rôle |
|------------|--------------|------|------|
| `backend-primary` | Service principal Node.js (Express) | 3001 | Fournit les données principales |
| `backend-secondary` | Service de secours (mêmes endpoints) | 3002 | Prend le relais si le principal tombe |
| `reverse-proxy` | Gestionnaire de bascule (Golan) | 8021 | Détecte la panne, redirige le trafic |
| `frontend` | Interface utilisateur (HTML/Javascript/CSS) | 3000 | Visualise les états et logs |

### Schéma d’architecture

![img](documentation/architecture.png)

---

## Endpoints API

### Backend (Primary + Secondary)

| Méthode | Endpoint | Description |
|----------|-----------|-------------|
| `GET` | `/health` | Vérifie si le service est actif |
| `GET` | `/api/data` | Retourne un mock de données |
| `POST` | `/fail` | Simule une défaillance (exécution `process.exit(1)`) |
| `POST` | `/recover` | Pensé initialement, mais le système de restart est entièrement géré par Docker |

### Reverse Proxy

| Méthode | Endpoint | Description |
|----------|-----------|-------------|
| `GET` | `/proxy/health` | Indique quel service est actuellement actif |
| `GET` | `/proxy/data` | Redirige vers le service actif |
| `POST` | `/proxy/fail` | Déclenche une panne du service actif |
| *(Background job)* | - | Vérifie `/health` du primaire et bascule automatiquement en cas de panne |
| `Websocket` | `logs` | Websocket qui envoie les logs du reverse proxy pour un meilleur suivi de l'état du réseau |

---

## Exécution du projet en local

Il est obligatoire d'avoir docker sur sa machine.

Pour lancer l'ensemble du projet (a exécuter à la racine du projet):

```bash
docker compose up --build
```

Cette commande va:
- Construire tous les services (backend, reverse proxy, frontend)
- Démarrer les containers définie dans `docker-compose.yml`
- Redémarrage automatique des services si ces derniers fail
