# English Path — Dossier d'architecture

*Version 1.0 — 20/11/2026. Ce document répond à la « première mission » du cahier des charges, adaptée à la contrainte de déploiement sur GitHub Pages, sans backend.*

## 1. Analyse du cahier des charges

**Objectif** : un professeur particulier disponible 24 h/24, qui fait passer un apprenant de A2 à B2 (puis C1) et le prépare à IELTS Academic et TOEFL iBT.

**Contraintes structurantes**

| Contrainte | Conséquence d'architecture |
|---|---|
| GitHub Pages uniquement (statique, public) | SPA statique, routage par hash, `base` Vite = sous-chemin du dépôt, pas de secret dans le bundle |
| Pas de backend obligatoire | toute la logique métier (scoring, SRS, maîtrise, correction) s'exécute dans le navigateur ; les données vivent dans IndexedDB |
| Offline-first | précache complet de l'app et du contenu par Workbox ; aucune fonctionnalité de base ne dépend du réseau |
| Clés IA jamais exposées | couche IA → proxy optionnel déployé par l'utilisateur (modèle Cloudflare Worker fourni) |
| Pas de perte de progression | écriture locale immédiate à chaque réponse, transactions Dexie, stockage persistant demandé, export/import JSON |
| Progression réelle, pas automatique | niveau modifié seulement par test de positionnement ou checkpoint ; maîtrise calculée sur les réponses réelles |

**Risques identifiés**
- *Perte des données si l'utilisateur vide son navigateur* → `navigator.storage.persist()`, rappel de sauvegarde, export/import.
- *Qualité audio variable de la synthèse vocale* → audio TTS hors ligne par défaut, et une règle de cache qui permettra d'ajouter des fichiers audio enregistrés (Phase 2).
- *Correction d'écriture sans IA limitée* → règles ciblées sur les erreurs fréquentes des francophones, chacune expliquée ; l'interface dit clairement ce qu'elles ne peuvent pas détecter.
- *Formats d'examen qui changent* (TOEFL 2026) → formats en configuration JSON datée, jamais dans le code.

## 2. Architecture technique

```
┌──────────────────────────── Navigateur (PWA) ─────────────────────────────┐
│  UI React (pages/)  ──►  hooks (live queries Dexie)                       │
│        │                                                                  │
│        ▼                                                                  │
│  Domaine (lib/) — fonctions pures, testées                                │
│   scoring · srs · mastery · stats · recommend · exercise · writingCheck   │
│        │                                                                  │
│        ▼                                                                  │
│  Persistance : repo.ts ──► Dexie / IndexedDB  ◄── backup.ts (export/import)│
│  Contenu : content/data/*.json (bundlé, versionné, précaché)              │
│  Audio : Web Speech API (TTS) · MediaRecorder (enregistrements)           │
│                                                                           │
│  Service Worker (Workbox) : précache app + contenu · runtime cache audio  │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │ HTTPS, uniquement si configuré et en ligne
                                ▼
                 Proxy IA optionnel (Cloudflare Worker)
                 secret: clé fournisseur · CORS · jeton d'accès
                                │
                                ▼
                 OpenAI / Anthropic / … (interchangeables)
```

## 3. Modules et interactions

| Module | Fichiers | Rôle | Dépend de |
|---|---|---|---|
| Onboarding | `pages/Onboarding` | profil, objectif, examen, temps quotidien, restauration | repo, backup |
| Positionnement | `pages/Placement`, `lib/scoring` | test A2→B2, niveau global et par compétence | content, repo |
| Dashboard | `pages/Home`, `lib/recommend` | « Que dois-je apprendre aujourd'hui ? » | stats, mastery, content |
| Learning | `pages/Learn`, `LessonPage`, `Checkpoint` | unités → leçons → pratique → quiz → correction ; checkpoints de niveau | ExerciseRunner, repo |
| Practice | `ReadingPage`, `ListeningPage`, `WritingPage`, `Flashcards` | entraînement par compétence | tts, writingCheck, ai, srs |
| Speaking | `pages/Speaking` | sujet du jour, enregistrement, réécoute | MediaRecorder, Dexie |
| Exams | `pages/Exams`, `exam-formats.json` | formats configurables (Phase 3 : examens blancs) | content |
| Progress | `pages/Progress` | CECRL, maîtrise, 7/30/90 j, historique | stats, mastery |
| Profile | `pages/Profile` | réglages, sauvegarde, IA, confidentialité | backup, ai |
| Moteur d'exercices | `components/ExerciseRunner` | QCM, texte à trous, remise en ordre, vrai/faux ; mode immédiat ou test | exercise |

Toute réponse notée passe par `repo.recordAttempt()` → table `attempts` → source unique des statistiques et de la maîtrise.

## 4. Schéma de données (IndexedDB, Dexie v1)

| Table | Clé | Index | Contenu |
|---|---|---|---|
| `profile` | `id` (= 'me') | — | nom, objectif, examen, minutes/jour, niveau démontré, niveaux par compétence, thème, aide FR |
| `attempts` | `uuid` | at, skill, level, source, refId, [skill+level] | chaque réponse notée (append-only) |
| `lessonProgress` | `lessonId` | status, updatedAt | statut, meilleur score, nb de tentatives |
| `assessments` | `uuid` | at, kind | tests de positionnement et checkpoints : niveau, scores par compétence et par niveau |
| `cards` | `id` | due, source | flashcards SM-2 : ease, interval, reps, lapses, due |
| `sessions` | `day` | — | secondes d'étude et XP par jour |
| `writings` | `uuid` | promptId, at | textes soumis + correction hors ligne et IA |
| `recordings` | `uuid` | at | enregistrements audio (Blob) |
| `kv` | `key` | — | brouillons, consentements, config IA (`secret.*` jamais exportés) |

Évolution du schéma : `db.version(n).stores(...).upgrade(...)` de Dexie. Le format de sauvegarde porte son propre numéro de version, et l'import refuse un fichier plus récent que l'app.

## 5. Stratégie offline-first

1. **Précache** (Workbox `generateSW`) : HTML, JS, CSS, icônes et **tout le contenu pédagogique** (JSON bundlé), soit environ 1 Mo. Après le premier chargement, l'app démarre et fonctionne sans réseau.
2. **Runtime cache** `CacheFirst` (`ep-content`) pour les futurs fichiers audio et packs de contenu du même domaine, avec support des requêtes Range pour la lecture audio.
3. **Aucune mise en cache** des appels IA (cross-origin, réseau uniquement).
4. **Navigation** : routage par hash + `navigateFallback` vers `index.html` + `404.html` sur Pages.
5. **Écritures** : chaque réponse est enregistrée immédiatement en local. Une coupure ou une fermeture de l'onglet ne perd rien, et les brouillons d'écriture sont sauvegardés toutes les 600 ms.
6. **Mise à jour** : `registerType: 'prompt'`. Le nouveau service worker attend l'accord de l'utilisateur, puis les caches obsolètes sont supprimés. L'app vérifie les mises à jour toutes les heures.
7. **Statut** visible en permanence : Online / Offline. Il n'y a pas de synchronisation serveur ; le transfert entre appareils se fait par export/import, avec fusion sans doublons.

## 6. Local vs Internet

| Fonctionnalité | Local (hors ligne) | Internet requis |
|---|---|---|
| Leçons, quiz, corrections préenregistrées, checkpoints, test de niveau | ✅ | |
| Reading, flashcards SRS, statistiques, historique | ✅ | |
| Listening (TTS système) | ✅ si l'OS a une voix anglaise | |
| Writing — correction par règles expliquées | ✅ | |
| Enregistrement / réécoute vocale | ✅ | |
| Export / import de sauvegarde | ✅ | |
| Writing — correction IA détaillée | | ✅ + proxy |
| Tuteur conversationnel IA (Phase 2) | | ✅ + proxy |
| Reconnaissance vocale / analyse de prononciation (Phase 2) | partiel (Web Speech selon navigateur) | ✅ pour une analyse fine |
| Futurs modèles locaux légers (ex. WebGPU / WASM) | prévu via la même interface `lib/ai.ts` | |

## 7. Arborescence

```
english-path/
├─ .github/workflows/deploy.yml   CI : tests → build → PWA → E2E offline → Pages
├─ ai-proxy/                      proxy IA optionnel (Cloudflare Worker)
├─ docs/ARCHITECTURE.md
├─ e2e/offline.spec.ts            Playwright : manifest, offline, persistance, export
├─ public/                        favicon, icônes PWA (192, 512, maskable, apple)
├─ src/
│  ├─ App.tsx  main.tsx  index.css
│  ├─ components/                 Layout, ExerciseRunner, ui, UpdatePrompt, ErrorBoundary
│  ├─ content/
│  │  ├─ data/*.json              contenus versionnés
│  │  ├─ index.ts                 accès typé + génération des checkpoints
│  │  └─ types.ts                 modèle de contenu
│  ├─ db/db.ts                    schéma Dexie
│  ├─ hooks/hooks.ts              online, timer d'étude, thème, profil
│  ├─ lib/                        domaine pur + tests (*.test.ts)
│  └─ pages/                      un fichier par écran
├─ playwright.config.ts  vite.config.ts  tailwind.config.js
└─ README.md
```

## 8. Feuille de route et tests associés

| Phase | Contenu | Tests de validation |
|---|---|---|
| **1 — MVP (livrée)** | positionnement, dashboard, A2 + B1, grammaire, vocabulaire, reading, listening, writing, flashcards, progression, offline, sauvegarde, CI/CD Pages | 34 tests unitaires + 3 tests E2E (offline inclus) |
| 2 — Speaking & Pronunciation | tuteur IA (3 modes), dialogues, « Repeat & Improve », reconnaissance vocale, audio enregistré, feedback séparant reconnaissance des mots / précision phonétique / fluidité / intelligibilité | contrats du proxy simulés (mocks), MediaRecorder, permissions refusées |
| 3 — IELTS & TOEFL | Practice / Timed / Full Mock, Writing Task 1 et 2, Speaking Parts 1–3, estimation de band, comparaison avec le test précédent | minuterie, respect des formats configurés, barèmes |
| 4 — Personnalisation | recommandations adaptatives, détection des lacunes par point de grammaire, adaptation du niveau des exercices | tests de recommandation sur historiques synthétiques |
| 5 — Optimisation | découpage du bundle, audit Lighthouse/axe, tests multi-navigateurs (Safari iOS), migration de schéma | Lighthouse CI, axe-core, matrice Playwright |

## 9. Critères de validation — état Phase 1

| # | Critère | État |
|---|---|---|
| 1 | Installable (Android, iOS, ordinateur) | manifest complet + icônes + SW ✅ (vérifié en E2E ; à confirmer sur un iPhone réel) |
| 2 | Ressources accessibles sans Internet | ✅ E2E offline |
| 3 | Progression sauvegardée localement | ✅ E2E (rechargement hors ligne) |
| 4 | Synchronisation au retour d'Internet | remplacée par export/import (pas de backend, par choix) |
| 5–7 | Exercices fonctionnels, réponses évaluées, statistiques réelles | ✅ tests unitaires + E2E |
| 8 | Speaking : enregistrer et réécouter | ✅ (MediaRecorder) |
| 9 | Corrections explicatives | ✅ (hors ligne EN + FR ; IA via proxy) |
| 10 | Examens blancs aux formats configurés | Phase 3 (formats déjà en configuration) |
| 11 | Responsive | ✅ mobile (barre du bas) / ordinateur (barre latérale) |
| 12 | Erreurs et états de chargement gérés | ✅ ErrorBoundary, Suspense, messages hors ligne et IA |
