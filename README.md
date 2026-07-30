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

## Démarrer en local

```
docker compose up -d --build
```

- Frontend : http://localhost:5174
- Backend : http://localhost:3000
- Relation-detection : http://localhost:8001
- Postgres : localhost:5434 (user/db `tibo`)

Les ports hôtes sont décalés (5434, 8001, 5174) pour éviter les conflits avec d'autres projets Docker sur cette même machine — en interne les services communiquent sur leurs ports par défaut (5432, 8000, 5173).

## État actuel

Squelette de projet : structure des modules NestJS (un par domaine du MVP), routes et pages React, service Python de scoring fonctionnel avec sa formule de confiance, environnement docker-compose opérationnel. La logique métier (persistance, ingestion réelle, RBAC connecté à une base) reste à implémenter — voir la section 10 de la spécification pour les décisions encore ouvertes.
