# TIBO

Plateforme BI self-service pour utilisateurs métiers. Spécification complète : [`TIBO_specification_projet.md`](./TIBO_specification_projet.md).

## Structure du repo

```
backend/               NestJS — API, RBAC, admin/paramétrage, auth (AuthProvider) et notifications (NotificationProvider) abstraits
frontend/              React + TypeScript (Vite) — constructeur de vues drag-and-drop (dnd-kit), écrans d'administration
relation-detection/    Service Python (FastAPI + pandas + rapidfuzz) — scoring des relations entre tables
infra/postgres/        Scripts d'initialisation Postgres (pgcrypto)
docker-compose.yml      Environnement de dev local (Postgres + les 3 services ci-dessus)
```

## Configuration

Toute la configuration (mots de passe, secret JWT, ports, URL publique du frontend) vit dans un
fichier `.env` à la racine, non suivi par git — copier `.env.example` vers `.env` et ajuster :

```
cp .env.example .env
```

Sans `.env`, `docker-compose.yml` retombe sur des valeurs par défaut de dev uniquement.

## Démarrer en local

```
docker compose up -d --build
```

- Frontend : http://localhost:5174
- Backend : http://localhost:3000
- Relation-detection : http://localhost:8001
- Postgres : localhost:5434 (user/db `tibo`)

Les ports hôtes sont décalés (5434, 8001, 5174) pour éviter les conflits avec d'autres projets Docker sur cette même machine — en interne les services communiquent sur leurs ports par défaut (5432, 8000, 5173).

## Déploiement derrière un reverse-proxy (ex. Nginx Proxy Manager)

TIBO expose deux services séparés (frontend + backend) qui doivent être routés sous **un seul
domaine** — le frontend est codé pour appeler son API sur `VITE_API_BASE_URL`, pas sur son propre
origin. Configuration testée avec NPM (Nginx Proxy Manager), transposable à tout reverse-proxy nginx :

1. **Proxy Host principal** : domaine → forward vers le port hôte du frontend (5174 par défaut,
   cf. `docker-compose.yml`). C'est la racine `/`.
2. **Custom Location `/api`** sur ce même Proxy Host → forward vers le port hôte du backend (3000).
   Dans le champ de configuration Nginx **propre à cette Custom Location** (pas l'onglet
   "Advanced" général du Proxy Host, qui s'applique à tout le domaine), ajouter :
   ```
   rewrite ^/api/(.*)$ /$1 break;
   ```
   Indispensable : le backend ne connaît pas le préfixe `/api` dans ses routes (`/auth/login`,
   `/views`, etc.), il faut le retirer avant de transmettre la requête.
3. Mettre à jour `VITE_API_BASE_URL` dans `.env` avec l'URL complète, `/api` inclus
   (ex. `https://mondomaine.example/api`), puis reconstruire le frontend :
   `docker compose up -d --build frontend`
4. Ajouter le domaine à `server.allowedHosts` dans `frontend/vite.config.ts` — le serveur de dev
   Vite rejette par défaut les requêtes dont le `Host` n'est pas reconnu.

**Piège rencontré en pratique** : si le `rewrite` est placé dans l'onglet "Advanced" général du
Proxy Host plutôt que dans la Custom Location elle-même, il s'applique **avant** que Nginx choisisse
la location — résultat, `/api/...` est réécrit en `/...` puis retombe sur la location `/` (le
frontend) au lieu de la Custom Location `/api` (le backend), et rien ne fonctionne côté API alors
que la page se charge normalement.

## État actuel

MVP fonctionnel : ingestion réelle, détection et validation des relations, constructeur de vues
(drag-and-drop, agrégations, graphiques), tableaux de bord, partage par groupe, exports Excel/PDF,
authentification locale et RBAC réellement appliqués, rétention avec journal d'audit, écrans
d'administration. Authentification LDAP (bind de service + recherche + vérification du mot de
passe), SMTP (envoi réel via nodemailer, avec email de test) et apparence (logo, favicon, titre,
couleur des boutons et du fond, appliqués immédiatement dans toute l'application y compris sur
l'écran de connexion) sont réellement actifs, pas seulement des écrans de configuration.
Reste ouvert : masquage des colonnes sensibles et durées légales de rétention confirmées (décisions
métier/juridiques, cf. section 10 de la spécification), SSO/OIDC (non prévu à ce stade).
