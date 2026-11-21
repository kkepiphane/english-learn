# English Path

Application web progressive (PWA) pour apprendre l'anglais de **A2 à C1** et préparer **IELTS Academic / TOEFL iBT**.
100 % frontend, **hébergée gratuitement sur GitHub Pages**, installable sur Android, iOS et ordinateur, et **utilisable hors ligne** après le premier chargement.

> Aucun serveur, aucun compte, aucun abonnement. Les données de l'apprenant restent dans le navigateur (IndexedDB). L'IA est **optionnelle** et passe par un proxy que vous déployez vous-même.

---

## Ce qui fonctionne aujourd'hui (Phase 1)

| Module | État | Hors ligne |
|---|---|---|
| Test de positionnement (24 questions A2→B2, 4 compétences, règle cumulative anti-hasard) | ✅ | ✅ |
| Dashboard : niveau démontré / en cours / objectif, objectif quotidien, série, XP, prochaine leçon, compétences à travailler, défis quotidiens et hebdomadaires, graphique de la semaine | ✅ | ✅ |
| Parcours **A2** (4 unités, 8 leçons) et **B1** (4 unités, 8 leçons) : objectif, explication EN + FR, exemples audio, vocabulaire (définition, traduction, API, exemple, contexte), pratique guidée, quiz, correction détaillée, erreurs à retenir | ✅ | ✅ |
| **Checkpoints de niveau** : seul moyen de monter de niveau (≥ 70 % dans *chaque* compétence) | ✅ | ✅ |
| Reading : 3 textes, glossaire au toucher, ajout aux flashcards, résumé, questions | ✅ | ✅ |
| Listening : 3 audios (voix de l'appareil), 4 vitesses, transcription après les questions | ✅ | ✅* |
| Writing : 4 sujets, brouillon auto-sauvegardé, **correction hors ligne expliquée** (EN + FR) ciblant les erreurs des francophones, version corrigée, modèle de réponse | ✅ | ✅ |
| Writing : correction IA approfondie | ✅ si proxy configuré | ❌ (Internet) |
| Flashcards à **répétition espacée** (SM-2) | ✅ | ✅ |
| Speaking : sujet du jour, enregistrement 1–3 min, réécoute, suppression, consentement micro | ✅ | ✅ |
| Progress : niveau CECRL, maîtrise par compétence (acquise / en progression / insuffisante / à réviser), évolution 7/30/90 jours, historique des tests | ✅ | ✅ |
| Profil : objectifs, thème clair/sombre, aide en français désactivable, **export / import de sauvegarde** (audio inclus), suppression des données | ✅ | ✅ |
| Tuteur IA conversationnel, analyse de prononciation | ⏳ Phase 2 | — |
| Examens blancs IELTS / TOEFL | ⏳ Phase 3 (les formats sont déjà en configuration) | — |

\* Le Listening utilise la synthèse vocale du système (Web Speech API). Android, iOS, Windows et macOS fournissent des voix hors ligne ; sur un appareil sans voix anglaise, la transcription est affichée à la place.

L'application n'affiche jamais une fonctionnalité comme opérationnelle si elle dépend d'une IA non configurée : les écrans concernés indiquent « AI is not configured » ou « Phase 2/3 ».

---

## Démarrage local

Prérequis : Node.js 22+.

```bash
npm install
npm run dev          # http://localhost:5173
```

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm test` | tests unitaires (Vitest) : scoring, SRS, maîtrise, correcteur, sauvegarde, intégrité du contenu |
| `npm run test:e2e` | tests navigateur (Playwright) : manifest, **fonctionnement hors ligne**, persistance, export |
| `npm run build` | build de production + service worker + manifest dans `dist/` |
| `npm run preview` | sert le build localement |

Le service worker n'est actif qu'en build de production (`npm run build && npm run preview`).
Pour les tests E2E avec un Chrome déjà installé : `CHROME_PATH=/usr/bin/google-chrome npm run test:e2e`.

---

## Déploiement sur GitHub Pages

1. Créez un dépôt GitHub et poussez le code sur la branche `main`.
2. Dans **Settings → Pages → Build and deployment**, choisissez **Source : GitHub Actions**.
3. Poussez sur `main` : le workflow `.github/workflows/deploy.yml`
   1. installe les dépendances (`npm ci`),
   2. exécute la vérification de types et les tests unitaires,
   3. compile l'application,
   4. génère le manifest, les icônes et le service worker (vérifiés),
   5. lance les tests hors ligne dans Chromium,
   6. déploie `dist/` sur GitHub Pages, **uniquement si tout est vert**.

L'URL sera `https://<utilisateur>.github.io/<depot>/`.

### Chemin de base (`base` de Vite)

Le workflow le calcule automatiquement :

| Cas | `BASE_PATH` |
|---|---|
| Dépôt de projet (`english-path`) | `/english-path/` |
| Dépôt `<utilisateur>.github.io` | `/` |
| Domaine personnalisé | définissez la variable de dépôt `BASE_PATH` = `/` (Settings → Secrets and variables → Actions → Variables) |

L'app utilise un routage par hash (`/#/learn`) : les liens profonds fonctionnent sur Pages sans règle de réécriture, et hors ligne.

### Installation

- **Android / Chrome / Edge** : menu → « Installer l'application ».
- **iOS / Safari** : Partager → « Sur l'écran d'accueil ».
- **Ordinateur** : icône d'installation dans la barre d'adresse.

Au premier chargement, tout le contenu (leçons, textes, exercices) est mis en cache. Un message « ready to work offline » le confirme.

### Mises à jour

Quand une nouvelle version est déployée, un bandeau propose **Update / Later** : la mise à jour n'interrompt jamais un exercice en cours. Les anciens caches sont nettoyés automatiquement.

---

## Données et sauvegardes

Tout est stocké dans **IndexedDB** (Dexie) sur l'appareil : profil, objectifs, préférences, réponses, progression, vocabulaire, historique, statistiques, textes écrits, enregistrements audio.

- L'app demande au navigateur un stockage **persistant** pour éviter l'effacement automatique.
- **Profile → Export backup** télécharge un fichier JSON unique (audio inclus, en option).
- **Import** : *Merge* (fusion sans doublons, la version la plus récente gagne) ou *Replace* (restauration complète sur un nouvel appareil). L'import est transactionnel : en cas d'erreur, les données locales restent intactes.
- Les secrets (jeton du proxy IA) ne sont **jamais** exportés.

⚠️ Effacer les données du site dans le navigateur supprime la progression. Exportez une sauvegarde régulièrement.

---

## IA (optionnelle) — sans exposer de clé

GitHub Pages est public : une clé API dans le code ou dans le navigateur serait lisible par tout le monde. English Path n'en contient donc **aucune**. Les appels IA passent par un **proxy** que vous déployez, qui garde la clé comme secret.

Un modèle prêt à l'emploi pour **Cloudflare Workers** (offre gratuite) est fourni dans `ai-proxy/` :

```bash
cd ai-proxy
npx wrangler login
# éditez wrangler.toml : PROVIDER (openai | anthropic), MODEL, ALLOWED_ORIGIN=https://<utilisateur>.github.io
npx wrangler secret put OPENAI_API_KEY     # ou ANTHROPIC_API_KEY
npx wrangler secret put ACCESS_TOKEN       # longue chaîne aléatoire
npx wrangler deploy
```

Puis dans l'app : **Profile → AI tutor** → URL du Worker + le même `ACCESS_TOKEN` → **Test connection**.

Contrat du proxy (stable, indépendant du fournisseur) :

| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| GET | `/v1/health` | — | `{ ok, provider, model }` |
| POST | `/v1/writing-feedback` | `{ text, task, level }` | `{ correctedText, improvedText, errors[], vocabulary, coherence, structure, estimatedLevel, advice[] }` |
| POST | `/v1/chat` | `{ messages, level, mode }` | `{ reply }` |

Changer de fournisseur ne demande que de modifier les variables du proxy. Sans proxy ou hors ligne, l'app reste entièrement utilisable (correction hors ligne, exercices, etc.). Le proxy filtre l'origine (CORS) et exige le jeton d'accès.

Le code du proxy a été vérifié syntaxiquement, mais il n'a pas encore été testé contre un vrai fournisseur. Lancez **Test connection** après le déploiement.

---

## Contenu pédagogique

Les contenus sont des **fichiers JSON versionnés** dans `src/content/data/`, compilés et précachés :

```
lessons-a2.json   lessons-b1.json   units.json
reading.json      listening.json    writing.json
placement.json    exam-formats.json
```

Pour ajouter du contenu : modifiez ou ajoutez un fichier JSON, puis lancez `npm test`. Les tests d'intégrité vérifient que chaque exercice a une réponse valide et une explication, que les identifiants sont uniques, que le vocabulaire est complet (API, traduction, exemple) et que les tests de niveau ont assez d'items par niveau.

Tous les textes et exercices sont originaux. Les formats d'examen sont stockés en configuration (`exam-formats.json`, vérifiés le 20/11/2026 : TOEFL iBT est noté sur 1–6 depuis le 21 janvier 2026) : ils sont à revérifier sur les sites officiels avant la Phase 3.

---

## Règles pédagogiques clés

- **Le niveau n'augmente jamais parce que des leçons sont terminées.** Il change uniquement via le test de positionnement ou un **checkpoint** réussi (≥ 70 % en grammaire, vocabulaire, lecture *et* écoute).
- Test de positionnement **cumulatif** : réussir B1 en échouant A2 ne place pas en B1 (protection contre le hasard).
- Maîtrise par compétence : précision pondérée par la récence sur les 40 dernières réponses ; « acquise » exige ≥ 80 % sur au moins 8 réponses ; une compétence acquise non pratiquée depuis 14 jours passe « à réviser ».
- Les scores (writing, futurs examens blancs) sont des **estimations pédagogiques**, jamais des scores officiels.
- Coach bienveillant : pas de culpabilisation après une journée manquée.

---

## Architecture

Voir [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) : modules, schéma IndexedDB, stratégie offline-first, cache, local vs Internet, feuille de route et tests.

Stack : React 19 · TypeScript · Vite · Tailwind CSS · Dexie.js / IndexedDB · vite-plugin-pwa / Workbox · Recharts · Vitest · Playwright.

## Accessibilité

Navigation clavier, lien d'évitement, rôles ARIA (progression, statut, groupes), libellés sur les boutons-icônes, contrastes clair/sombre, préférence système de thème, cibles tactiles ≥ 40 px, zones sûres iOS.
