# TIBO — Spécification de projet

> Plateforme BI self-service pour utilisateurs métiers, à partir de fichiers Excel/CSV injectés quotidiennement.

---

## 1. Vision

TIBO est une application de Business Intelligence interne inspirée de Tableau, pensée pour des **utilisateurs métiers non techniques**. Chaque jour, entre 20 et 30 fichiers Excel/CSV sont injectés dans une base de données relationnelle. L'application détecte automatiquement les relations entre ces fichiers (comme si chacun était une table d'un schéma relationnel), puis permet à l'utilisateur de construire des vues et des graphiques par glisser-déposer, sans écrire de requête ni de code.

Les données étant sensibles, le chiffrement est une exigence de premier plan, dès la version initiale.

---

## 2. Utilisateurs cibles

- **Utilisateur métier** (persona principal) : consulte des vues déjà créées, construit ses propres vues par glisser-déposer, exporte des extractions en Excel ou PDF. Aucune compétence technique attendue.
- **Administrateur données** : supervise l'ingestion quotidienne, valide/corrige les relations détectées entre fichiers, gère les accès.
- *(Phase 2)* **Utilisateur authentifié via l'annuaire d'entreprise** (LDAP), recevant des notifications par email (SMTP).

---

## 3. Périmètre fonctionnel

### 3.1 MVP (phase 1 — à livrer en premier)

1. **Ingestion quotidienne** de 20 à 30 fichiers `.xlsx` / `.csv`
   - Upload manuel dans une v1, avec possibilité d'automatiser (dossier surveillé ou upload programmé) en v1.1
   - Chaque fichier devient une table dans la base de données
   - Détection et normalisation automatique des types de colonnes (texte, date, numérique, booléen)
   - Journal d'ingestion (fichier, date, nombre de lignes, statut, erreurs éventuelles)

2. **Détection automatique des relations entre fichiers**
   - Moteur de scoring combinant : similarité de nom de colonne, compatibilité de type, cardinalité/unicité, taux de recouvrement des valeurs (Jaccard/containment)
   - Chaque relation proposée est affichée avec un score de confiance
   - L'administrateur données valide, corrige ou rejette les relations avant qu'elles ne soient utilisables dans les vues
   - Les relations validées sont mémorisées (pas de re-détection à chaque import si le schéma n'a pas changé)

3. **Constructeur de vues sans code**
   - Panneau de champs par fichier/table (glisser-déposer)
   - Zones de dépôt : Lignes, Colonnes, Couleur, Taille, Filtres
   - Suggestion automatique du type de graphique selon les champs déposés (barres, ligne, nuage de points, carte de chaleur, table, carte géographique)
   - Bascule manuelle vers un autre type de graphique
   - Agrégations standards (somme, moyenne, comptage, min, max) configurables par mesure
   - **Sauvegarde et partage des vues**
     - Une vue est **privée par défaut** (visible uniquement par son créateur)
     - Le créateur peut **partager une vue avec un groupe** (le partage n'est pas automatique : c'est une action distincte de la simple sauvegarde)
     - **Organisation par équipe** : les vues et tableaux de bord partagés sont classés dans un espace de travail rattaché à un groupe/équipe, pas dans une liste plate ; un utilisateur voit ses vues privées ainsi que les espaces d'équipe auxquels son groupe donne accès
     - Une vue peut être construite et sauvegardée sur une **relation détectée mais pas encore validée** par l'administrateur données : elle affiche alors un indicateur visuel explicite ("relation non validée") tant que la validation n'a pas eu lieu. Si la relation est ensuite rejetée, la vue concernée passe en état "à corriger" plutôt que d'être supprimée silencieusement, et son propriétaire est notifié dans l'interface

4. **Exports**
   - Export d'une vue ou d'un tableau de bord en **PDF** (mise en page imprimable)
   - Export des données sous-jacentes en **Excel** (`.xlsx`, avec en-têtes et types conservés)

5. **Sécurité et chiffrement**
   - Chiffrement des données **au repos** (chiffrement de la base de données / des fichiers stockés)
   - Chiffrement **en transit** (TLS obligatoire sur toutes les connexions)
   - Gestion des accès par rôle (au minimum : lecteur, créateur de vues, administrateur données)
   - Traçabilité (logs d'accès et d'export, horodatés)
   - Anonymisation/masquage possible de colonnes sensibles au niveau table (à définir selon fichiers)

6. **Interface utilisateur**
   - Design soigné, épuré, cohérent (charte graphique dédiée à définir)
   - **Accessibilité** : conformité WCAG 2.1 niveau AA visée (contraste, navigation clavier, lecteurs d'écran, tailles de police ajustables)
   - Interface responsive (poste de travail en priorité, tablette en confort)

7. **Menu paramétrage (administration)**
   - Accessible uniquement aux rôles habilités (voir RBAC ci-dessous), lui-même journalisé : toute modification de paramètre est tracée (qui, quoi, quand, valeur avant/après)
   - **Rétention des données** : les durées de la section 6bis ne sont pas figées en dur dans le code — elles sont éditables par type de donnée depuis cet écran, avec un historique des modifications (obligatoire en secteur réglementé, cf. section 6bis)
   - **Authentification** : bascule entre mode local et mode LDAP, paramétrage des comptes locaux dès le MVP ; l'écran de configuration LDAP (serveur, base DN, mapping des attributs) existe dès le MVP mais reste inactif tant que la phase 2 n'est pas livrée
   - **SMTP** : écran de configuration (serveur, port, identifiants, expéditeur) présent dès le MVP, non fonctionnel avant la phase 2
   - **Groupes** : création/édition de groupes d'utilisateurs, rattachement d'utilisateurs (comptes locaux dans un premier temps, comptes LDAP synchronisés en phase 2)
   - **Permissions (RBAC)** : gestion des rôles et de leurs permissions par écran/fonctionnalité (consultation de vue, création de vue, export, validation des relations détectées, accès au menu paramétrage lui-même), assignation de rôles à des groupes ou des utilisateurs individuels

### 3.2 Phase 2 (non prioritaire, à préparer sans bloquer le MVP)

- **Interconnexion LDAP** : activation fonctionnelle de la synchronisation avec l'annuaire d'entreprise (les écrans de configuration existent dès le MVP, cf. point 7 ci-dessus), mapping des groupes LDAP vers les groupes/rôles applicatifs
- **Connexion SMTP** : activation fonctionnelle de l'envoi d'alertes (échec d'ingestion, relation à valider), envoi programmé de tableaux de bord par email, notifications de partage de vue

> Contrainte de conception pour le MVP : prévoir dès maintenant un module d'authentification abstrait (interface `AuthProvider`) afin que l'ajout du LDAP en phase 2 ne nécessite pas de refonte, et un module de notification abstrait (`NotificationProvider`) pour le SMTP.

---

## 4. Architecture technique proposée

```
┌─────────────────────┐
│   Upload xlsx/csv    │  (manuel v1, automatisable v1.1)
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│  Ingestion & staging  │  parsing, typage, validation
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│ Détection de relations│  scoring + validation admin
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│  Base relationnelle   │  chiffrée au repos, 1 table par fichier
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│  Couche sémantique    │  dimensions / mesures / relations validées
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│ Constructeur de vues  │  glisser-déposer, suggestion de graphique
│   (no-code, web)      │
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│  Exports Excel / PDF  │
└─────────────────────┘

┌───────────────────────────────────────────────────────────┐
│  Module Administration / Paramétrage (transverse)           │
│  Rétention · Authentification (local/LDAP) · SMTP ·          │
│  Groupes · Permissions (RBAC) — accès et modifications        │
│  journalisés, agit sur toutes les couches ci-dessus            │
└───────────────────────────────────────────────────────────┘
```

### 4.1 Stack technique recommandée (à valider avec Claude Code selon contraintes internes)

| Couche | Choix recommandé | Alternative |
|---|---|---|
| Frontend | React + TypeScript, dnd-kit pour le drag-and-drop | — |
| Rendu graphique | Chart.js ou Recharts (barres, lignes, scatter), lib dédiée pour la carte géo | D3.js si besoin de graphiques sur-mesure |
| Backend / API | Node.js (NestJS) ou Python (FastAPI) | — |
| Base de données | PostgreSQL (chiffrement natif via `pgcrypto` + chiffrement disque/TDE) | — |
| Détection de relations | Job Python (pandas + rapidfuzz pour le nom, calcul de Jaccard pour le recouvrement de valeurs) | — |
| Génération PDF | Puppeteer/Playwright (rendu HTML → PDF) ou lib serveur dédiée | — |
| Génération Excel | SheetJS (xlsx) côté serveur | — |
| Authentification (MVP) | Comptes locaux + hashage (argon2), interface `AuthProvider` prête pour LDAP | — |
| Authentification (phase 2) | LDAP/Active Directory via `ldapjs` ou équivalent | SSO SAML/OIDC si besoin ultérieur |
| Notifications (phase 2) | SMTP via `nodemailer` ou équivalent, interface `NotificationProvider` | — |
| Chiffrement en transit | TLS 1.2+ obligatoire sur toutes les connexions (API, base de données) | — |
| Chiffrement au repos | Chiffrement disque (TDE PostgreSQL / chiffrement volume) + chiffrement applicatif des colonnes sensibles identifiées | — |

---

## 5. Modèle de données

**Données métier**
- **1 table par fichier source** (20 à 30 tables), nommage normalisé à partir du nom de fichier
- **Table de métadonnées d'ingestion** : historique des imports (fichier, date, lignes, erreurs, hash du fichier pour détecter les doublons)
- **Table des relations détectées** : source, cible, colonnes concernées, score de confiance, statut (proposée / validée / rejetée), validé par, date de validation
- **Table des vues sauvegardées** : définition JSON des shelves (lignes/colonnes/couleur/taille/filtres), type de graphique, propriétaire, date de modification, **visibilité** (`privée` / `partagée`), **groupe/équipe de partage** (nullable, renseigné uniquement si partagée), **statut relation** (dérivé de la relation utilisée : `validée` / `en attente` / `à corriger` si la relation sous-jacente a été rejetée après coup)
- **Table des tableaux de bord** : regroupement de vues, mise en page, mêmes règles de visibilité/partage que les vues
- **Table espaces de travail par équipe** : un espace par groupe, regroupe les vues et tableaux de bord partagés avec ce groupe

**Utilisateurs, groupes et permissions (RBAC)**
- **Table utilisateurs** : compte local (identifiant, hash de mot de passe) ou compte LDAP (identifiant distant, phase 2), statut actif/inactif
- **Table groupes** : nom, description — sert à la fois de brique RBAC (assignation de rôles) et d'unité de partage/équipe pour les vues
- **Table d'appartenance utilisateur ↔ groupe** (many-to-many)
- **Table rôles** : nom, description (ex. lecteur, créateur de vues, administrateur données, administrateur système)
- **Table permissions** : action unitaire (ex. `view:read`, `view:create`, `view:share`, `export:pdf`, `relation:validate`, `settings:access`, `settings:retention:edit`, `settings:rbac:edit`) — `view:create` (sauvegarder une vue privée) et `view:share` (la partager avec un groupe) sont deux permissions distinctes, un utilisateur peut avoir l'une sans l'autre
- **Table rôle ↔ permission** (many-to-many)
- **Table rôle ↔ groupe ou utilisateur** (assignation, avec portée éventuelle par table/dataset si un cloisonnement des données est nécessaire)

**Configuration (éditable depuis le menu paramétrage)**
- **Table politique de rétention** : type de donnée, durée, unité, statut (actif/gelé — cf. legal hold), dernière modification, modifié par — chaque changement génère une entrée dans le journal d'audit plutôt que d'écraser la valeur précédente
- **Table configuration authentification** : mode actif (local/LDAP), paramètres LDAP (serveur, port, base DN, mapping d'attributs) — présente dès le MVP, activable en phase 2
- **Table configuration SMTP** : serveur, port, identifiants (référence au coffre-fort de secrets, jamais en clair), expéditeur — présente dès le MVP, activable en phase 2

**Journalisation (cf. section 6bis pour la rétention)**
- **Journal d'accès et d'export**
- **Journal des modifications de paramétrage** (rétention, RBAC, authentification, SMTP) — sensible en secteur réglementé, alimente le même mécanisme WORM que les autres journaux d'audit

---

## 6. Sécurité — points d'attention à détailler avec Claude Code

- Chiffrement au repos de la base et des fichiers sources bruts (conservés temporairement pour audit ou supprimés après ingestion — à trancher)
- Politique de rétention des fichiers sources après ingestion
- Gestion des secrets (clés de chiffrement, identifiants de connexion) via un coffre-fort de secrets, jamais en clair dans le code ou la configuration versionnée
- Journalisation des accès et des exports (qui a exporté quoi, quand)
- Anonymisation/masquage de colonnes sensibles à la volée pour certains rôles (à spécifier selon la nature des fichiers)

---

## 6bis. Politique de rétention des données

TIBO opère dans un **secteur réglementé** (finance / santé / assurance). Cela change la logique de rétention par rapport à un contexte générique : il ne s'agit plus seulement de minimiser la durée de conservation (logique RGPD classique), mais de **concilier deux obligations qui peuvent entrer en tension** :

- une obligation de **minimisation** : ne pas garder une copie brute de données sensibles plus longtemps que nécessaire ;
- une obligation légale sectorielle de **conservation longue** de certains enregistrements (pistes d'audit, preuves de contrôle, historique de décisions) souvent imposée sur plusieurs années par les régulateurs du secteur concerné.

Les durées ci-dessous sont des **valeurs de travail resserrées**, à faire valider explicitement par le DPO/juridique et le responsable conformité avant mise en production — les obligations exactes dépendent de la réglementation précise applicable (ex. obligations de conservation des pistes d'audit qui peuvent aller jusqu'à 5-10 ans dans certains cadres financiers ou de santé selon la juridiction).

Ces valeurs ne sont pas codées en dur : elles sont stockées dans la table de configuration décrite en section 5 et éditables depuis le menu paramétrage, réservé aux rôles habilités (`settings:retention:edit`). Toute modification est journalisée avec l'ancienne et la nouvelle valeur — indispensable pour prouver, en cas d'audit sectoriel, que les durées appliquées à un moment donné étaient bien celles en vigueur.

| Type de donnée | Durée de rétention resserrée | Justification | Action à l'expiration |
|---|---|---|---|
| Fichier source brut (xlsx/csv uploadé) | 7 jours glissants maximum | En secteur réglementé, une copie brute de données sensibles ne doit pas persister au-delà du strict nécessaire au contrôle qualité de l'ingestion | Suppression automatique définitive, cryptographique si possible (destruction de la clé de chiffrement du fichier plutôt que simple suppression logique) |
| Données en zone de staging (avant chargement en base) | Purge immédiate en fin de traitement, succès ou échec | Zone transitoire, jamais un stockage de fait | Purge automatique systématique, sans exception |
| Données consolidées en base relationnelle (tables métier) | Conservation selon durée légale minimale du secteur concerné (souvent plusieurs années) — **à faire confirmer précisément**, ne pas fixer arbitrairement | Les enregistrements métier peuvent être eux-mêmes soumis à une obligation légale de conservation | Archivage à froid chiffré à l'échéance légale, jamais de suppression automatique sans validation conformité |
| Journal d'ingestion (métadonnées : fichier, date, lignes, erreurs) | 5 ans minimum (à ajuster selon régulateur) | Fait partie de la piste d'audit du traitement des données réglementées | Archivage, jamais de purge automatique sans décision conformité explicite |
| Journal d'accès et d'export (qui a consulté/exporté quoi, quand) | 5 à 10 ans selon régulateur applicable | Preuve de contrôle d'accès exigée en audit sectoriel | Stockage en écriture unique (WORM), purge uniquement après validation conformité |
| Relations détectées rejetées par l'administrateur | 12 mois puis purge | Traçabilité des décisions de modélisation, sans devenir elle-même une donnée à charge réglementaire | Purge automatique, journalisée |
| Exports PDF/Excel générés et stockés temporairement pour téléchargement | 1 heure après génération, jamais stocké au-delà | Réduire au minimum la fenêtre d'exposition d'un extrait de données sensibles | Suppression automatique immédiate |
| Clés de chiffrement | Rotation tous les 90 jours (au lieu de 12 mois en contexte générique) | Exposition minimale exigée en secteur réglementé, souvent via HSM ou coffre-fort de secrets certifié | Rotation avec re-chiffrement, ancienne clé détruite dès la fin du re-chiffrement |

**Principes renforcés pour un secteur réglementé :**
- **Legal hold / gel de purge** : toute purge automatique doit pouvoir être suspendue à la demande de la conformité/du juridique (litige, contrôle réglementaire en cours), pour un enregistrement ou une période donnée. Ce mécanisme doit être prévu dans le modèle de données dès le MVP (statut "sous gel" sur les enregistrements concernés).
- **Stockage en écriture unique (WORM)** pour les journaux d'audit et d'accès, afin qu'ils ne puissent pas être modifiés ou supprimés avant l'échéance, y compris par un administrateur technique.
- **Séparation des rôles** : la personne qui peut déclencher une suppression manuelle anticipée ne doit pas être la même que celle qui valide/j audite les accès (principe des quatre yeux recommandé pour toute suppression hors purge automatique).
- **Registre des traitements et analyse d'impact (AIPD/DPIA)** : au vu de la sensibilité des données et du secteur, une analyse d'impact relative à la protection des données est recommandée avant mise en production, en parallèle du développement.
- **Documentation de la base légale de conservation** pour chaque table/catégorie de données consolidées, avant de figer une durée — ne pas se contenter d'une durée par défaut appliquée uniformément.
- Toute purge automatique reste journalisée (quoi, quand, combien), et tout job de purge reste supervisé avec alerte en cas d'échec.

---

## 7. Accessibilité et design

- Respect des critères WCAG 2.1 AA : contraste suffisant, navigation clavier complète du constructeur de vues (y compris le glisser-déposer, qui doit avoir une alternative clavier), labels explicites pour lecteurs d'écran
- Charte graphique cohérente et épurée, à définir (palette, typographie, iconographie)
- Retours visuels clairs lors du glisser-déposer et de la détection de relations (statuts, scores de confiance, erreurs d'ingestion)

---

## 8. Roadmap proposée

| Phase | Contenu | Statut |
|---|---|---|
| Phase 0 | Cadrage technique détaillé, choix définitif de la stack, maquettes UI | À faire avec Claude Code |
| Phase 1 — MVP | Ingestion, détection de relations, constructeur de vues, exports Excel/PDF, chiffrement, menu paramétrage (rétention, groupes, RBAC, écrans LDAP/SMTP présents mais inactifs) | Priorité |
| Phase 1.1 | Automatisation de l'ingestion quotidienne (dossier surveillé / planification) | Après validation du MVP |
| Phase 2 | Activation fonctionnelle LDAP (l'écran de configuration existe depuis le MVP) | Différée |
| Phase 2 | Activation fonctionnelle SMTP (l'écran de configuration existe depuis le MVP) | Différée |

---

## 9. Critères d'acceptation du MVP

- [ ] Un administrateur peut importer un lot de fichiers xlsx/csv et voir le statut de chaque import
- [ ] Le système propose automatiquement des relations entre au moins 80% des paires de fichiers réellement liées, avec un score de confiance affiché
- [ ] Un utilisateur métier peut créer une vue par glisser-déposer sans assistance technique, en moins de 5 minutes pour un cas simple
- [ ] Le type de graphique suggéré est cohérent avec les champs déposés dans au moins les cas standards (1 dimension + 1 mesure, série temporelle, croisement de 2 dimensions)
- [ ] Une vue peut être exportée en PDF avec une mise en page lisible
- [ ] Les données sous-jacentes d'une vue peuvent être exportées en Excel
- [ ] Les données sont chiffrées au repos et toutes les communications se font en TLS
- [ ] L'interface passe les contrôles d'accessibilité de base (contraste, navigation clavier)
- [ ] Un administrateur habilité peut modifier une durée de rétention depuis le menu paramétrage, et cette modification apparaît dans le journal d'audit avec l'ancienne et la nouvelle valeur
- [ ] Un administrateur peut créer un groupe, y rattacher des utilisateurs et leur assigner un rôle avec des permissions précises, sans intervention technique
- [ ] Un utilisateur sans la permission `settings:access` ne peut pas accéder au menu paramétrage, y compris par manipulation directe de l'URL
- [ ] Les écrans de configuration LDAP et SMTP sont présents et navigables, mais leur activation ne modifie aucun comportement applicatif tant que la phase 2 n'est pas livrée
- [ ] Une vue sauvegardée est privée par défaut et invisible pour les autres utilisateurs tant qu'elle n'a pas été explicitement partagée
- [ ] Un utilisateur disposant de `view:create` mais pas de `view:share` peut sauvegarder une vue privée mais ne peut pas la partager avec un groupe
- [ ] Une vue partagée apparaît dans l'espace de travail de l'équipe correspondante, visible par tous les membres du groupe destinataire
- [ ] Un utilisateur métier peut sauvegarder une vue reposant sur une relation non encore validée, avec un indicateur visuel clair signalant ce statut
- [ ] Si une relation utilisée par une vue sauvegardée est ensuite rejetée par l'administrateur données, la vue passe en statut "à corriger" et son propriétaire en est informé, sans suppression silencieuse

---

## 10. Ce qui reste à trancher avec Claude Code au démarrage

1. Volume de données par fichier (nombre de lignes/colonnes attendu) — dimensionne le choix technique de la base et des index
2. Fréquence exacte et mode d'automatisation de l'ingestion (upload manuel, dossier surveillé, API)
3. Liste des colonnes sensibles nécessitant un masquage spécifique
4. Environnement de déploiement cible (on-premise, cloud privé, cloud public) — impacte le choix du chiffrement et du futur LDAP
5. Charte graphique et identité visuelle de TIBO
6. Identification précise du ou des régulateurs applicables (finance / santé / assurance) et de leurs durées légales exactes de conservation, pour figer définitivement les valeurs de la section 6bis — actuellement des valeurs resserrées de travail, pas des obligations confirmées
7. Faisabilité technique du stockage WORM et du mécanisme de legal hold dans l'environnement de déploiement cible (impacte le choix de base de données/stockage)
8. Lancement d'une analyse d'impact relative à la protection des données (AIPD/DPIA) en parallèle du développement
