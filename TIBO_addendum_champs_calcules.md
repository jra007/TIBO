# TIBO — Addendum : champs calculés

> Document complémentaire au cahier des charges principal de TIBO. À transmettre séparément, car le document principal a pu évoluer depuis sa première rédaction. Ce document est autonome mais suppose la lecture préalable du cahier des charges principal (contexte : plateforme BI self-service, utilisateurs finance/banque, constructeur de vues par glisser-déposer).

---

## 1. Objectif

Permettre aux utilisateurs métiers (finance, banque) de créer des **champs calculés** utilisables dans le constructeur de vues, sans écrire ni lire de formule textuelle. L'ensemble de l'interaction reste du glisser-déposer, cohérent avec le reste de l'application.

Deux modes de création cohabitent, pour couvrir aussi bien le besoin courant que le cas spécifique.

---

## 2. Mode 1 — Calculs rapides prédéfinis

Accessible par clic droit (ou menu contextuel) sur un champ numérique déjà présent dans une vue. Aucune formule, aucun glisser-déposer requis — un clic suffit.

| Calcul rapide | Description |
|---|---|
| % du total | Exprime chaque valeur comme part du total de la colonne ou du groupe |
| Variation vs période précédente | Différence ou % de variation par rapport à la période antérieure (mois, trimestre, année selon le champ temporel utilisé dans la vue) |
| Cumul (running total) | Somme cumulée le long d'un axe (souvent temporel) |
| Rang | Classement des valeurs (croissant/décroissant) |
| Moyenne mobile | Moyenne glissante sur N périodes, N réglable via un simple champ numérique |

Ces calculs rapides couvrent la majorité des besoins de reporting financier courant (évolution, pondération, classement) sans jamais exposer une syntaxe à l'utilisateur.

---

## 3. Mode 2 — Éditeur de champ calculé par blocs

Pour les besoins plus spécifiques (marge, ratio propre à l'activité, écart entre deux colonnes issues de fichiers différents).

### 3.1 Principe d'interaction

- L'utilisateur ouvre "Nouveau champ calculé" depuis le panneau de champs
- Il nomme le champ (ex. "Marge nette (%)")
- Il glisse des **blocs de champs** (issus de n'importe quel fichier accessible, y compris via les relations déjà détectées entre fichiers) et des **blocs d'opérateurs/fonctions** dans une zone de formule
- Aucune saisie de texte libre pour la logique de calcul — uniquement des blocs prédéfinis assemblés par glisser-déposer
- Un **aperçu du résultat** s'affiche en direct sur un échantillon de données pendant la construction, avant validation

### 3.2 Opérateurs et fonctions proposés au MVP

- Opérateurs arithmétiques de base : `+`, `−`, `×`, `÷`
- Bloc "Ratio" (raccourci pour une division avec gestion automatique de la division par zéro)
- Bloc "Variation %" (raccourci pour un calcul de variation entre deux champs)
- Constante numérique (bloc simple à valeur fixe, ex. `100` pour convertir un ratio en pourcentage)
- Agrégations déjà existantes dans le constructeur de vues (somme, moyenne, comptage, min, max), combinables avec les blocs ci-dessus

### 3.3 Garde-fous d'interaction

- Une zone de dépôt n'accepte que les blocs du type attendu (ex. une division n'accepte que des champs numériques) — empêche par construction une combinaison invalide, plutôt que de la détecter après coup par un message d'erreur
- Si un bloc déposé rendrait la formule invalide (type incompatible, division par un champ non numérique), le dépôt est refusé visuellement à l'endroit même du geste, sans message d'erreur technique
- L'aperçu de résultat doit signaler explicitement les cas de division par zéro ou de valeur manquante rencontrés dans l'échantillon, plutôt que d'afficher un résultat silencieusement faussé

---

## 4. Exigences spécifiques au contexte finance/banque

Ces points sont plus stricts que ce qu'exigerait un outil BI générique, en cohérence avec le secteur réglementé déjà posé dans le cahier des charges principal (rétention, RBAC, journalisation).

1. **Stockage structuré, jamais de texte libre** : la formule est stockée comme un **arbre structuré** (JSON), reflétant exactement l'assemblage de blocs — jamais comme une chaîne de caractères interprétée à l'exécution. Chaque nœud de l'arbre est validé indépendamment (type, opérateur autorisé), ce qui élimine par construction tout risque d'injection ou de formule non prévue.
2. **Précision décimale** : les calculs portant sur des montants financiers utilisent un type numérique décimal exact côté base de données, jamais un flottant natif — pour éviter les écarts d'arrondi qui poseraient problème en audit ou en rapprochement comptable.
3. **Traçabilité** : toute création ou modification d'un champ calculé est journalisée (auteur, date, définition avant/après), au même titre que les modifications de paramétrage déjà prévues dans le document principal. Un champ calculé qui alimente une vue partagée ou un export doit pouvoir être audité a posteriori.
4. **Portée et partage** : un champ calculé suit les mêmes règles de visibilité que les vues (privé par défaut, partage explicite avec un groupe/équipe) — pas de mécanisme de partage distinct à réapprendre par l'utilisateur.
5. **Permission dédiée** : la création d'un champ calculé est une permission RBAC à part entière (`field:calculated:create`), distincte de la simple création de vue (`view:create`) — un utilisateur peut construire des vues sur des champs existants sans avoir le droit d'introduire de nouveaux calculs.

---

## 5. Modèle de données (complément au document principal)

- **Table champs calculés** : identifiant, nom, définition (arbre JSON structuré), type de résultat (numérique, pourcentage, monétaire), fichier/dataset de rattachement, propriétaire, visibilité (privée/partagée), groupe de partage (nullable)
- **Table historique des champs calculés** : une entrée par modification (définition avant/après, auteur, date) — alimente le même mécanisme de journal d'audit que le reste de l'application, y compris le stockage en écriture unique (WORM) déjà prévu pour les journaux sensibles
- Extension de la **table permissions** existante avec : `field:calculated:create`, `field:calculated:edit`, `field:calculated:share`

---

## 6. Critères d'acceptation

- [ ] Un utilisateur métier peut appliquer un calcul rapide (% du total, variation, cumul, rang, moyenne mobile) sur un champ numérique en un seul clic, sans quitter la vue en cours
- [ ] Un utilisateur métier peut créer un champ calculé personnalisé uniquement par glisser-déposer de blocs, sans jamais avoir à taper une formule
- [ ] Une zone de dépôt de la formule refuse un bloc de type incompatible au moment du dépôt, sans nécessiter une validation a posteriori
- [ ] Un aperçu du résultat s'affiche sur un échantillon de données avant que le champ calculé ne soit sauvegardé
- [ ] Un cas de division par zéro ou de valeur manquante dans l'échantillon est signalé explicitement dans l'aperçu
- [ ] La définition d'un champ calculé est stockée sous forme structurée (arbre), jamais sous forme de texte interprété
- [ ] Toute création ou modification d'un champ calculé génère une entrée dans le journal d'audit avec la définition avant/après
- [ ] Un utilisateur disposant de `view:create` mais pas de `field:calculated:create` peut utiliser des champs calculés existants dans ses vues, mais ne peut pas en créer de nouveaux
- [ ] Un champ calculé partagé suit les mêmes règles de visibilité par équipe que les vues (cf. document principal)

---

## 7. Points à trancher avec Claude Code

1. Liste exhaustive des fonctions/opérateurs à couvrir dès le MVP (celle proposée en section 3.2 est un point de départ, pas une liste figée)
2. Gestion du recalcul : un champ calculé doit-il être recalculé à la volée à chaque affichage de vue, ou matérialisé lors de l'ingestion quotidienne ? Ce choix impacte la fraîcheur des données affichées et la charge de calcul
3. Comportement en cas de modification d'un champ calculé déjà utilisé dans des vues partagées existantes (propagation immédiate, ou nécessité d'une validation avant impact sur les vues d'autres utilisateurs)
