# TIBO — Addendum : gestion des doublons d'ingestion et sélection de date

> Document complémentaire au cahier des charges principal de TIBO. À transmettre séparément, car le document principal a pu évoluer depuis sa première rédaction. Ce document est autonome mais suppose la lecture préalable du cahier des charges principal (contexte : ingestion quotidienne de 20 à 30 fichiers Excel/CSV, chacun devenant une table).

---

## 1. Objectif

Deux problèmes liés à traiter ensemble :
1. Empêcher qu'un même fichier soit ingéré plusieurs fois par erreur (doublon).
2. Permettre à l'utilisateur de consulter les données d'une date précise plutôt que uniquement les données du jour, ce qui suppose de ne jamais écraser les imports précédents.

---

## 2. Détection des doublons à l'ingestion

Chaque fichier uploadé est identifié par une **empreinte de contenu** (hash, ex. SHA-256), calculée sur le contenu du fichier — pas sur son seul nom, pour détecter un doublon même renommé.

Ce hash est comparé à la table de métadonnées d'ingestion déjà prévue dans le document principal (qui contient déjà un champ hash à cet effet).

| Cas détecté | Condition | Comportement attendu |
|---|---|---|
| Fichier strictement identique déjà ingéré, peu importe la date | Hash identique à un import déjà journalisé | Import rejeté automatiquement. Message explicite à l'utilisateur : "Ce fichier a déjà été importé le [date]". Aucune ligne insérée en base |
| Contenu différent, même nom de fichier, même jour calendaire | Hash différent, nom identique, `date_ingestion` = aujourd'hui | Traité comme une **correction du jour** : les lignes de l'import précédent du jour sont marquées obsolètes (pas supprimées) et remplacées par la nouvelle version, avec conservation de trace |
| Contenu différent, même nom de fichier, jour suivant | Hash différent, nom identique, `date_ingestion` = nouvelle date | Import normal, s'ajoute à l'historique sans toucher aux données des jours précédents |

**Exigence explicite** : ce contrôle doit produire un **message visible côté utilisateur au moment de l'upload**, pas seulement une entrée silencieuse dans un journal technique consultable uniquement par un administrateur.

---

## 3. Historisation des données (pas d'écrasement)

- Chaque ligne insérée en base porte une colonne technique **`date_ingestion`** (date du lot d'import), en plus de ses colonnes métier d'origine.
- Les tables ne sont **jamais écrasées** lors d'un nouvel import : chaque import quotidien vient s'ajouter (append-only), à l'exception du cas "correction du jour" décrit ci-dessus.
- Conséquence directe : il devient possible de reconstituer l'état des données à n'importe quelle date passée, dans la limite de la politique de rétention définie dans le document principal (section 6bis).

---

## 4. Sélection de la date par l'utilisateur métier

Deux mécanismes complémentaires, pas exclusifs l'un de l'autre :

1. **Sélecteur de date global**, visible en permanence dans l'interface (par défaut positionné sur "aujourd'hui"). Change la date, et toutes les vues affichées se recalculent automatiquement sur cette date, sans action supplémentaire de l'utilisateur.
2. **Filtre de date au sein d'une vue**, en glissant le champ `date_ingestion` dans la zone Filtres du constructeur de vues (cohérent avec le fonctionnement déjà prévu pour tout autre champ) — utile pour comparer plusieurs dates dans une même vue plutôt que d'en figer une seule.

---

## 5. Points à trancher avec Claude Code

1. **Volumétrie et partitionnement** : conserver un historique quotidien de 20 à 30 fichiers sur plusieurs années (cf. rétention réglementaire du document principal) peut représenter un volume significatif selon la taille des fichiers sources — impacte le choix de partitionnement de table (ex. partitionnement par date) et d'indexation
2. **Définition exacte de "même jour calendaire"** : fuseau horaire de référence, heure de bascule d'un jour à l'autre si l'ingestion peut avoir lieu en soirée
3. **Comportement des vues déjà construites** face à l'historisation : une vue sans filtre de date explicite doit-elle par défaut n'afficher que la date sélectionnée dans le sélecteur global, ou cumuler tout l'historique si aucun filtre n'est posé ? (Risque de double comptage si mal géré, à spécifier précisément avant développement)
4. **Rétroactivité de la détection de doublon** : la comparaison de hash doit-elle porter sur l'historique complet depuis le début, ou seulement sur une fenêtre glissante (ex. les 90 derniers jours) pour rester performante à mesure que le volume grandit

---

## 6. Critères d'acceptation

- [ ] Uploader deux fois le même fichier (contenu strictement identique) déclenche un message explicite et empêche la seconde ingestion
- [ ] Uploader un fichier corrigé sous le même nom, le même jour, remplace la version du jour sans dupliquer les lignes ni perdre la trace de la version précédente
- [ ] Uploader le même nom de fichier un jour différent s'ajoute à l'historique sans modifier les données des jours précédents
- [ ] Un utilisateur métier peut changer la date via le sélecteur global et voir toutes les vues se recalculer sur cette date
- [ ] Un utilisateur métier peut glisser le champ `date_ingestion` dans une vue pour comparer plusieurs dates, sans passer par le sélecteur global
