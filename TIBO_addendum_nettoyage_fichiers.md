# TIBO — Addendum : nettoyage des fichiers mal formatés à l'ingestion

> Document complémentaire au cahier des charges principal de TIBO. À transmettre séparément, car le document principal a pu évoluer depuis sa première rédaction. Ce document est autonome mais suppose la lecture préalable du cahier des charges principal (contexte : ingestion quotidienne de 20 à 30 fichiers Excel/CSV) et de l'addendum sur la gestion des doublons/dates d'ingestion.

---

## 1. Objectif

Les fichiers sources (exports finance/banque) arrivent rarement propres : lignes de titre avant l'en-tête réel, lignes de total en bas de fichier, colonnes vides, délimiteurs CSV incohérents, encodages variables. TIBO doit absorber une bonne partie de ces problèmes automatiquement, et proposer une correction visuelle simple (jamais de configuration technique) pour les cas ambigus.

---

## 2. Nettoyage automatique (sans intervention utilisateur)

Appliqué systématiquement à chaque fichier entrant, avant toute tentative de détection de relations :

| Problème | Traitement automatique |
|---|---|
| Délimiteur CSV incertain (`,` / `;` / tabulation) | Détection automatique par échantillonnage du fichier |
| Encodage incertain | Détection automatique (évite la corruption des caractères accentués) |
| Ligne d'en-tête non située en ligne 1 | Détection par heuristique : première ligne suivie de données au type cohérent (texte au-dessus, valeurs homogènes en dessous) |
| Lignes entièrement vides | Suppression automatique |
| Colonnes entièrement vides | Suppression automatique |
| Espaces superflus en début/fin de cellule | Nettoyage systématique |

Ce nettoyage automatique doit être **journalisé** (quelles transformations appliquées, sur quel fichier, à quelle date) même lorsqu'il ne nécessite aucune validation humaine.

---

## 3. Correction visuelle assistée (cas ambigus)

Pour les cas que l'heuristique ne peut pas trancher seule (ligne de titre libre avant le tableau, lignes de total ou de commentaire en bas de fichier) :

- **Aperçu du fichier** sous forme de grille avant validation de l'import, avec la ligne d'en-tête détectée automatiquement mise en évidence
- L'utilisateur peut **cliquer sur une autre ligne** pour indiquer que le tableau commence réellement là (pas de saisie de numéro de ligne)
- L'utilisateur peut **sélectionner une ou plusieurs lignes/colonnes** (haut ou bas du fichier) et cliquer sur "Exclure" — sélection à la souris, cohérente avec le reste de l'interface, jamais de configuration en langage technique
- Une fois la correction validée pour un fichier donné, la règle est **mémorisée** (associée au nom du fichier ou à un identifiant de source) et **réappliquée automatiquement** lors des imports suivants du même fichier, sans repasser par l'aperçu à chaque fois

---

## 4. Garde-fou : détection d'anomalie sur une règle mémorisée

Une règle de nettoyage mémorisée ne doit jamais être réappliquée aveuglément si le fichier du jour s'écarte significativement des jours précédents.

- Si le nettoyage automatique (via une règle mémorisée) exclurait un pourcentage de lignes/colonnes anormalement élevé par rapport à l'historique récent du même fichier (ex. seuil indicatif : plus de 3 à 5 fois l'écart habituel, à calibrer avec l'administrateur données), **l'import est mis en attente** plutôt qu'exécuté silencieusement
- Dans ce cas, une alerte est adressée à l'administrateur données, qui doit valider ou corriger manuellement avant que l'import ne se poursuive
- Objectif : éviter qu'un changement de structure du fichier source (colonne ajoutée/supprimée par l'émetteur, nouveau format) ne conduise à supprimer silencieusement de vraies données métier

---

## 5. Traçabilité

- Toute ligne ou colonne exclue lors du nettoyage (automatique ou assisté) est journalisée : fichier, date, règle appliquée, nombre de lignes/colonnes concernées
- Cette journalisation doit être consultable par l'administrateur données depuis le journal d'ingestion déjà prévu dans le document principal — pas un journal technique séparé et moins accessible
- Cohérent avec les exigences de traçabilité déjà posées pour le reste de l'application (rétention, RBAC) : une donnée exclue doit pouvoir être expliquée a posteriori en cas de question ou d'audit

---

## 6. Points à trancher avec Claude Code

1. Seuil précis de déclenchement de l'alerte anomalie (section 4) — à calibrer avec des exemples réels de fichiers, pas fixé arbitrairement
2. Portée de la mémorisation d'une règle de nettoyage : par nom exact de fichier, ou par une signature plus large (ex. même structure de colonnes) pour tolérer un léger changement de nom de fichier d'un jour à l'autre
3. Comportement si un fichier ne peut pas du tout être nettoyé automatiquement ni via l'aperçu assisté (structure trop irrégulière) : rejet complet avec message à l'utilisateur, ou import partiel avec avertissement
4. Format d'export de la journalisation de nettoyage pour un besoin d'audit (visualisation seule dans l'interface, ou export dédié possible)

---

## 7. Critères d'acceptation

- [ ] Un fichier CSV avec un délimiteur `;` au lieu de `,` est correctement interprété sans intervention de l'utilisateur
- [ ] Un fichier avec des lignes ou colonnes entièrement vides est nettoyé automatiquement avant ingestion
- [ ] Un fichier dont l'en-tête ne commence pas en ligne 1 propose un aperçu où l'utilisateur peut cliquer pour indiquer la vraie ligne d'en-tête
- [ ] Une correction validée sur un fichier est réappliquée automatiquement le jour suivant pour le même fichier, sans repasser par l'aperçu
- [ ] Si le nettoyage exclurait un volume de lignes anormalement élevé par rapport à l'historique du fichier, l'import est mis en attente et une alerte est envoyée à l'administrateur données plutôt que d'être exécuté silencieusement
- [ ] Chaque ligne ou colonne exclue est consultable a posteriori dans le journal d'ingestion, avec la raison de l'exclusion
