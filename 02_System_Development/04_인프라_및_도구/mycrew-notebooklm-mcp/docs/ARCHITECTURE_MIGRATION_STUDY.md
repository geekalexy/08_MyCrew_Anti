# NotebookLM MCP - Étude de Migration d'Architecture

> **Date**: Décembre 2024
> **Statut**: Étude préliminaire
> **Conclusion**: Migration non recommandée actuellement (API incomplète)

---

## Résumé Exécutif

Cette étude analyse les options pour industrialiser l'authentification et migrer vers l'API officielle NotebookLM Enterprise.

**Conclusion principale**: L'API Enterprise ne couvre pas les fonctionnalités essentielles (interrogation du notebook, génération de contenus). La migration n'est pas justifiée actuellement mais devra être réévaluée quand Google étendra l'API.

---

## Table des Matières

1. [Contexte et Objectifs](#1-contexte-et-objectifs)
2. [Architecture Actuelle](#2-architecture-actuelle)
3. [Options d'Architecture](#3-options-darchitecture)
4. [Comparaison des Fonctionnalités](#4-comparaison-des-fonctionnalités)
5. [Analyse des Coûts](#5-analyse-des-coûts)
6. [Matrice Avantages/Limites](#6-matrice-avantageslimites)
7. [Recommandations](#7-recommandations)
8. [Roadmap et Points de Réévaluation](#8-roadmap-et-points-de-réévaluation)
9. [Industrialisation de l'Authentification](#9-industrialisation-de-lauthentification-sans-api-enterprise)

---

## 1. Contexte et Objectifs

### 1.1 Situation Actuelle

Le MCP NotebookLM utilise **Playwright (browser automation)** pour interagir avec NotebookLM car aucune API officielle n'existait au moment du développement.

### 1.2 Objectif Principal

**Industrialiser l'authentification** pour:

- Éliminer la dépendance aux cookies browser
- Permettre l'authentification M2M (Machine-to-Machine)
- Augmenter la fiabilité et réduire les interventions manuelles
- Supporter plusieurs comptes avec rotation

### 1.3 Découverte

Google a lancé une **API NotebookLM Enterprise** (Discovery Engine API) mais celle-ci est **incomplète** pour nos besoins.

---

## 2. Architecture Actuelle

### 2.1 Diagramme

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ARCHITECTURE ACTUELLE (Playwright)                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐     ┌──────────────┐     ┌─────────────────────────────┐  │
│  │  Client  │────▶│  HTTP Server │────▶│     Playwright/Patchright   │  │
│  │  (MCP)   │     │  (Express)   │     │     (Browser Automation)    │  │
│  └──────────┘     └──────────────┘     └──────────────┬───────────────┘  │
│                                                       │                 │
│                                                       ▼                 │
│                                        ┌─────────────────────────────┐  │
│                                        │   NotebookLM Web UI         │  │
│                                        │   (notebooklm.google.com)   │  │
│                                        └─────────────────────────────┘  │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  AUTHENTIFICATION:                                                      │
│  ├── Login manuel initial (setup_auth)                                  │
│  ├── Cookies sauvegardés (~/.notebooklm-mcp/auth-state.json)            │
│  ├── SessionStorage persisté                                            │
│  └── Auto-refresh si cookies expirés                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  LIMITATIONS:                                                           │
│  ├── Compte unique = point de défaillance unique                        │
│  ├── Rate limit 50 queries/jour (compte gratuit)                        │
│  ├── Expiration cookies (~2 semaines)                                   │
│  ├── Détection activité suspecte par Google                             │
│  └── Fragilité si l'UI NotebookLM change                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Stack Technique

| Composant      | Technologie                  | Rôle                          |
| -------------- | ---------------------------- | ----------------------------- |
| Runtime        | Node.js 18+                  | Exécution                     |
| Browser Engine | Patchright (Playwright fork) | Automation avec stealth       |
| HTTP Server    | Express.js                   | API REST pour les clients MCP |
| Auth Storage   | JSON files                   | Persistance cookies/session   |
| Stealth        | Custom utils                 | Comportement humain simulé    |

---

## 3. Options d'Architecture

### 3.1 Option A: Statu Quo (Playwright seul)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  OPTION A: PLAYWRIGHT SEUL (actuel)                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Client ──▶ HTTP Server ──▶ Playwright ──▶ NotebookLM Web UI            │
│                                                                         │
│  Améliorations possibles:                                               │
│  ├── Pool de comptes avec rotation                                      │
│  ├── Browser profiles persistants                                       │
│  ├── Quota tracking par compte                                          │
│  └── Failover automatique                                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Option B: API Enterprise (complète)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  OPTION B: API ENTERPRISE SEULE (hypothétique - API incomplète)         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Client ──▶ HTTP Server ──▶ Google Cloud API ──▶ NotebookLM Backend     │
│                                │                                        │
│                                ▼                                        │
│                    Service Account / OAuth 2.0                          │
│                                                                         │
│  ❌ NON VIABLE: L'API ne supporte pas l'interrogation (chat/query)      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Option C: Architecture Hybride

```
┌─────────────────────────────────────────────────────────────────────────┐
│  OPTION C: HYBRIDE (API + Playwright)                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                        MCP NotebookLM v2                         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                  │                                      │
│          ┌───────────────────────┴───────────────────────┐              │
│          ▼                                               ▼              │
│  ┌─────────────────────┐                   ┌─────────────────────────┐  │
│  │   API Enterprise    │                   │      Playwright         │  │
│  │   (Google Cloud)    │                   │   (Browser Automation)  │  │
│  ├─────────────────────┤                   ├─────────────────────────┤  │
│  │ • Create notebook   │                   │ • Ask questions         │  │
│  │ • Add/manage sources│                   │ • Generate guides       │  │
│  │ • Generate audio    │                   │ • Extract responses     │  │
│  │ • Share notebook    │                   │ • Download content      │  │
│  │ • M2M Auth (OAuth)  │                   │ • Web search sources    │  │
│  └─────────────────────┘                   └─────────────────────────┘  │
│          │                                               │              │
│          ▼                                               ▼              │
│  Service Account                               Cookies/Session          │
│  (pas d'intervention humaine)                  (login manuel requis)    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Comparaison des Fonctionnalités

### 4.1 Fonctionnalités par Mode d'Accès

| Fonctionnalité                 | API Enterprise | Playwright | Notes                         |
| ------------------------------ | :------------: | :--------: | ----------------------------- |
| **Gestion Notebooks**          |                |            |                               |
| Créer notebook                 |       ✅       |     ✅     | API préférable                |
| Lister notebooks               |       ✅       |     ⚠️     | API plus fiable               |
| Supprimer notebook             |       ✅       |     ⚠️     | API préférable                |
| Partager notebook              |       ✅       |     ⚠️     | API avec rôles IAM            |
| **Gestion Sources**            |                |            |                               |
| Ajouter source (fichier)       |       ✅       |     ✅     | API plus simple               |
| Ajouter source (URL)           |       ✅       |     ✅     | API plus simple               |
| Ajouter source (texte)         |       ✅       |     ✅     | API plus simple               |
| Ajouter source (Google Drive)  |       ✅       |     ⚠️     | API native                    |
| Ajouter source (YouTube)       |       ✅       |     ✅     | Équivalent                    |
| Lister sources                 |       ✅       |     ⚠️     | API plus fiable               |
| Supprimer sources              |       ✅       |     ⚠️     | API préférable                |
| Discover sources (web search)  |       ❌       |     ✅     | Playwright seul               |
| **Génération Contenu**         |                |            |                               |
| Audio Overview                 |       ✅       |     ✅     | API préférable                |
| Podcast (standalone)           |       ✅       |     ❌     | API exclusive                 |
| Study Guide                    |       ❌       |     ✅     | Playwright seul               |
| Briefing Doc                   |       ❌       |     ✅     | Playwright seul               |
| Timeline                       |       ❌       |     ✅     | Playwright seul               |
| FAQ                            |       ❌       |     ✅     | Playwright seul               |
| Table of Contents              |       ❌       |     ✅     | Playwright seul               |
| Mind Map                       |       ❌       |     ✅     | Playwright seul               |
| **Interaction**                |                |            |                               |
| **Poser des questions (chat)** |       ❌       |     ✅     | **CRITIQUE: Playwright seul** |
| Extraire réponses              |       ❌       |     ✅     | Playwright seul               |
| Historique conversation        |       ❌       |     ✅     | Playwright seul               |
| **Export**                     |                |            |                               |
| Télécharger audio (WAV)        |       ⚠️       |     ✅     | Via UI                        |
| Télécharger mind map (image)   |       ❌       |     ✅     | Playwright seul               |
| Exporter texte généré          |       ❌       |     ✅     | Playwright seul               |

### 4.2 Résumé Couverture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  COUVERTURE FONCTIONNELLE                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  API Enterprise:  ████████░░░░░░░░░░░░  ~40% des fonctionnalités       │
│  Playwright:      ████████████████████  ~100% des fonctionnalités      │
│                                                                         │
│  ⚠️  LA FONCTION LA PLUS IMPORTANTE (chat/query) N'EST PAS DANS L'API   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Analyse des Coûts

### 5.1 Coûts Directs

| Option                   | Coût Mensuel | Coût Annuel  | Notes                          |
| ------------------------ | ------------ | ------------ | ------------------------------ |
| **Gratuit (Playwright)** | $0           | $0           | 50 queries/jour, 100 notebooks |
| **NotebookLM Plus**      | ~$10/user    | ~$120/user   | Via Workspace, 5x limites      |
| **Enterprise**           | $9/licence   | $108/licence | API access, M2M auth           |
| **Gemini Enterprise**    | $30/user     | $360/user    | Inclut NotebookLM Enterprise   |

### 5.2 Coûts API (estimés)

| Opération        | Pricing            | Notes                            |
| ---------------- | ------------------ | -------------------------------- |
| API Calls        | Non documenté      | Probablement inclus dans licence |
| Storage          | Standard GCP rates | Si data stores utilisés          |
| Audio Generation | Non documenté      | Potentiellement pay-as-you-go    |

### 5.3 Coûts Cachés

| Élément               | Option Gratuite | Option Enterprise   |
| --------------------- | --------------- | ------------------- |
| Maintenance cookies   | ~1h/mois        | $0 (M2M)            |
| Gestion multi-comptes | Complexe        | Native (IAM)        |
| Debugging UI changes  | Variable        | Réduit (API stable) |
| Support Google        | Aucun           | Inclus              |

---

## 6. Matrice Avantages/Limites

### 6.1 Option A: Playwright Seul (Statu Quo)

| Avantages                   | Limites                          |
| --------------------------- | -------------------------------- |
| ✅ Gratuit                  | ❌ Auth fragile (cookies)        |
| ✅ 100% des fonctionnalités | ❌ Rate limit 50/jour            |
| ✅ Pas de dépendance GCP    | ❌ Maintenance si UI change      |
| ✅ Fonctionne maintenant    | ❌ Pas de M2M natif              |
| ✅ Contrôle total           | ❌ Détection possible par Google |

### 6.2 Option B: API Enterprise Seule

| Avantages                       | Limites                            |
| ------------------------------- | ---------------------------------- |
| ✅ Auth M2M (Service Account)   | ❌ **Pas de chat/query API**       |
| ✅ API stable et versionnée     | ❌ **Pas de génération guides**    |
| ✅ Quotas plus élevés           | ❌ Coût $9/mois minimum            |
| ✅ Support Google               | ❌ Fonctionnalités limitées (~40%) |
| ✅ Sécurité enterprise (VPC-SC) | ❌ Lock-in Google Cloud            |

### 6.3 Option C: Hybride (API + Playwright)

| Avantages                         | Limites                                 |
| --------------------------------- | --------------------------------------- |
| ✅ Meilleur des deux mondes       | ❌ Complexité accrue                    |
| ✅ M2M pour sources/audio         | ❌ Toujours besoin de cookies pour chat |
| ✅ 100% fonctionnalités           | ❌ Coût $9/mois + maintenance           |
| ✅ Migration progressive possible | ❌ Deux systèmes à maintenir            |
| ✅ Fallback si API évolue         | ❌ Overhead développement               |

---

## 7. Recommandations

### 7.1 Décision: NE PAS MIGRER (pour l'instant)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  RECOMMANDATION FINALE                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ❌ MIGRATION NON RECOMMANDÉE ACTUELLEMENT                              │
│                                                                         │
│  Raison principale:                                                     │
│  L'API Enterprise ne supporte pas la fonctionnalité critique:           │
│  → Interrogation du notebook (chat/query)                               │
│                                                                         │
│  Sans cette fonctionnalité, l'API n'apporte pas de valeur               │
│  suffisante pour justifier le coût de $9/mois/licence.                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Actions Court Terme (0-3 mois)

| Action                         | Priorité | Effort    | Impact            |
| ------------------------------ | -------- | --------- | ----------------- |
| Pool de comptes gratuits (3-5) | Haute    | 2-3 jours | Résilience auth   |
| Quota tracking par compte      | Haute    | 1 jour    | Évite rate limits |
| Browser profiles persistants   | Moyenne  | 2 jours   | Stabilité auth    |
| Failover automatique           | Moyenne  | 1 jour    | Disponibilité     |

### 7.3 Actions si API Évolue

Quand Google ajoutera l'endpoint `notebooks.query` ou équivalent:

1. Réévaluer la migration hybride
2. Implémenter d'abord pour sources/audio (M2M)
3. Migrer progressivement les fonctionnalités supportées
4. Conserver Playwright comme fallback

---

## 8. Roadmap et Points de Réévaluation

### 8.1 Timeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ROADMAP                                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Q1 2025: Améliorer architecture actuelle                               │
│  ├── Pool multi-comptes                                                 │
│  ├── Quota tracking                                                     │
│  └── Monitoring/alerting                                                │
│                                                                         │
│  Q2 2025: Surveiller évolution API Google                               │
│  ├── Veille sur notebooks.query/chat endpoint                           │
│  ├── Réévaluer si >60% couverture fonctionnelle                         │
│  └── POC hybride si pertinent                                           │
│                                                                         │
│  Q3-Q4 2025: Migration potentielle                                      │
│  ├── Si API complète: migration progressive                             │
│  └── Si API incomplète: continuer Playwright                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Critères de Réévaluation

Réévaluer la migration si l'API ajoute:

- [ ] `notebooks.query` ou `notebooks.chat` - Interrogation du notebook
- [ ] `notebooks.generate` - Génération de Study Guide, Timeline, etc.
- [ ] `notebooks.export` - Export des contenus générés
- [ ] Pricing transparent pour les API calls

### 8.3 Sources de Veille

| Source                   | URL                                             | Fréquence    |
| ------------------------ | ----------------------------------------------- | ------------ |
| Google Cloud Blog        | cloud.google.com/blog                           | Mensuelle    |
| NotebookLM Release Notes | support.google.com/notebooklm                   | Bi-mensuelle |
| API Documentation        | docs.cloud.google.com/.../notebooklm-enterprise | Mensuelle    |
| Google AI Forum          | discuss.ai.google.dev                           | Hebdomadaire |

---

## Annexes

### A. Endpoints API Enterprise (Décembre 2024)

```
Base URL: https://{LOCATION}-discoveryengine.googleapis.com/v1alpha

Notebooks:
  POST   /projects/{project}/locations/{location}/notebooks                    # Create
  GET    /projects/{project}/locations/{location}/notebooks/{id}               # Get
  GET    /projects/{project}/locations/{location}/notebooks:listRecentlyViewed # List
  POST   /projects/{project}/locations/{location}/notebooks:batchDelete        # Delete
  POST   /projects/{project}/locations/{location}/notebooks/{id}:share         # Share

Sources:
  POST   /projects/{project}/locations/{location}/notebooks/{id}/sources:batchCreate   # Add
  POST   /projects/{project}/locations/{location}/notebooks/{id}/sources:uploadFile    # Upload
  GET    /projects/{project}/locations/{location}/notebooks/{id}/sources/{sourceId}    # Get
  POST   /projects/{project}/locations/{location}/notebooks/{id}/sources:batchDelete   # Delete

Audio:
  POST   /projects/{project}/locations/{location}/notebooks/{id}/audioOverviews        # Create
  DELETE /projects/{project}/locations/{location}/notebooks/{id}/audioOverviews/{aoId} # Delete

Podcasts (standalone):
  POST   /projects/{project}/locations/{location}/podcasts                             # Create
```

### B. Authentification API Enterprise

```bash
# Option 1: Service Account (M2M - recommandé pour production)
gcloud auth activate-service-account \
  --key-file=/path/to/service-account-key.json

# Option 2: User Account (interactif)
gcloud auth login --enable-gdrive-access

# Obtenir token
TOKEN=$(gcloud auth print-access-token)

# Exemple d'appel API
curl -X POST \
  "https://us-discoveryengine.googleapis.com/v1alpha/projects/123/locations/us/notebooks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName": "Mon Notebook"}'
```

### C. Références

- [NotebookLM Enterprise Documentation](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/overview)
- [API Notebooks](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-notebooks)
- [API Sources](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-notebooks-sources)
- [API Audio Overview](https://docs.cloud.google.com/gemini/enterprise/notebooklm-enterprise/docs/api-audio-overview)
- [NotebookLM Pricing](https://www.elite.cloud/post/notebooklm-pricing-2025-free-plan-vs-paid-plan-which-one-actually-saves-you-time/)
- [NotebookLM for Enterprise](https://cloud.google.com/resources/notebooklm-enterprise)

---

## 9. Industrialisation de l'Authentification (sans API Enterprise)

Cette section détaille les options pour robustifier l'authentification Playwright sans migrer vers l'API Enterprise.

### 9.1 Problématique OAuth vs Session Cookies

```
┌─────────────────────────────────────────────────────────────────────────┐
│  POURQUOI OAUTH NE RÉSOUT PAS LE PROBLÈME DIRECTEMENT                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  NotebookLM Web UI utilise:                                             │
│  └── Session cookies Google (SID, HSID, SSID, APISID, SAPISID)          │
│      ├── Durée: ~2 semaines                                             │
│      └── Générés lors du login web                                      │
│                                                                         │
│  OAuth 2.0 produit:                                                     │
│  └── Access tokens + Refresh tokens                                     │
│      ├── Pour APIs Google (Drive, Cloud, etc.)                          │
│      └── NON convertibles en session cookies web ❌                     │
│                                                                         │
│  Résultat:                                                              │
│  ├── OAuth fonctionne pour l'API Enterprise (si on l'utilisait)         │
│  ├── OAuth NE fonctionne PAS pour l'UI web NotebookLM                   │
│  └── On doit maintenir des sessions web via Playwright                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Options d'Industrialisation

#### Option 1: Comptes Dédiés + Credentials Stockés (Sans 2FA)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  OPTION 1: CREDENTIALS STOCKÉS (comptes sans 2FA)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Setup:                                                                 │
│  1. Créer 3-5 comptes Gmail DÉDIÉS (pas comptes personnels)             │
│  2. Désactiver 2FA sur ces comptes                                      │
│  3. Stocker email/password chiffrés (AES-256)                           │
│  4. Auto-login automatique quand session expire                         │
│                                                                         │
│  Flow:                                                                  │
│  ┌─────────┐     ┌──────────────┐     ┌─────────────────┐               │
│  │ Request │────▶│ Check Session│────▶│ Session Valid?  │               │
│  └─────────┘     └──────────────┘     └────────┬────────┘               │
│                                                │                        │
│                         ┌──────────────────────┴──────────────────┐     │
│                         ▼                                         ▼     │
│                  ┌──────────────┐                         ┌───────────┐ │
│                  │ YES: Use it  │                         │ NO: Login │ │
│                  └──────────────┘                         └─────┬─────┘ │
│                                                                 │       │
│                                                                 ▼       │
│                                              ┌──────────────────────────┐│
│                                              │ 1. Decrypt credentials   ││
│                                              │ 2. Navigate to login     ││
│                                              │ 3. Fill email, Next      ││
│                                              │ 4. Fill password, Next   ││
│                                              │ 5. Save session cookies  ││
│                                              └──────────────────────────┘│
│                                                                         │
│  Avantages:                          Limites:                           │
│  ✅ Zero intervention humaine        ⚠️ Comptes moins sécurisés (no 2FA)│
│  ✅ Simple à implémenter             ⚠️ Google peut bloquer si suspect  │
│  ✅ Fonctionne 24/7                  ⚠️ Credentials stockés = risque    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Option 2: Comptes avec TOTP + Auto-2FA

````
┌─────────────────────────────────────────────────────────────────────────┐
│  OPTION 2: CREDENTIALS + TOTP SECRET (comptes avec 2FA)                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Setup:                                                                 │
│  1. Créer comptes Gmail avec 2FA TOTP (PAS SMS)                         │
│  2. Lors du setup 2FA, sauvegarder le SECRET (code QR)                  │
│  3. Stocker email + password + TOTP secret (chiffrés)                   │
│  4. Générer les codes 2FA programmatiquement                            │
│                                                                         │
│  Génération TOTP:                                                       │
│  ```typescript                                                          │
│  import { authenticator } from 'otplib';                                │
│                                                                         │
│  const secret = decrypt(account.totpSecretEncrypted);                   │
│  const code = authenticator.generate(secret);                           │
│  // → "123456" (code 2FA valide 30 secondes)                            │
│  ```                                                                    │
│                                                                         │
│  Flow 2FA:                                                              │
│  ┌─────────────────┐                                                    │
│  │ After password  │                                                    │
│  └────────┬────────┘                                                    │
│           ▼                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐    │
│  │ Detect 2FA page │────▶│ Generate TOTP   │────▶│ Fill & Submit   │    │
│  └─────────────────┘     │ from secret     │     └─────────────────┘    │
│                          └─────────────────┘                            │
│                                                                         │
│  Avantages:                          Limites:                           │
│  ✅ 2FA activé (plus sécurisé)       ⚠️ TOTP secret à stocker           │
│  ✅ Zero intervention humaine        ⚠️ Plus complexe à setup           │
│  ✅ Meilleure protection compte      ⚠️ Google peut quand même bloquer  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
````

#### Option 3: Session Keep-Alive Proactif

````
┌─────────────────────────────────────────────────────────────────────────┐
│  OPTION 3: SESSION KEEP-ALIVE (prévention vs guérison)                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Principe: Utiliser la session AVANT qu'elle expire                     │
│  Les cookies Google durent ~2 semaines mais se "refresh" à l'usage      │
│                                                                         │
│  Implementation:                                                        │
│  ├── Cron job toutes les 12h                                            │
│  ├── Pour chaque compte: charger NotebookLM (pas besoin de query)       │
│  └── Ça "refresh" implicitement les cookies de session                  │
│                                                                         │
│  ```typescript                                                          │
│  // Cron: 0 */12 * * * (toutes les 12 heures)                           │
│  async function keepSessionsAlive() {                                   │
│    for (const account of accounts) {                                    │
│      const context = await loadBrowserProfile(account);                 │
│      const page = await context.newPage();                              │
│      await page.goto('https://notebooklm.google.com');                  │
│      await page.waitForLoadState('networkidle');                        │
│      // Session cookies auto-refreshed!                                 │
│      await page.close();                                                │
│    }                                                                    │
│  }                                                                      │
│  ```                                                                    │
│                                                                         │
│  Avantages:                          Limites:                           │
│  ✅ Pas de login = moins de risque   ⚠️ Retarde le problème seulement   │
│  ✅ Très simple                      ⚠️ Si rate un refresh = problème   │
│  ✅ Pas de credentials stockés       ⚠️ Nécessite login initial manuel  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
````

### 9.3 Architecture Multi-Comptes Recommandée

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ARCHITECTURE PRODUCTION RECOMMANDÉE                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ~/.notebooklm-mcp/                                                     │
│  ├── accounts.json              ← Configuration des comptes             │
│  ├── accounts/                                                          │
│  │   ├── account-1/                                                     │
│  │   │   ├── profile/           ← Chrome profile complet persistant     │
│  │   │   ├── auth-state.json    ← Cookies/session exportés              │
│  │   │   ├── quota.json         ← { used: 45, limit: 50, resetAt: "." } │
│  │   │   └── credentials.enc    ← Email/password/TOTP chiffré (opt.)    │
│  │   ├── account-2/                                                     │
│  │   │   └── ...                                                        │
│  │   └── account-3/                                                     │
│  │       └── ...                                                        │
│  └── active-account.json        ← Compte actuellement sélectionné       │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Account Pool Manager                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                │                                        │
│          ┌────────────────────┼────────────────────┐                    │
│          ▼                    ▼                    ▼                    │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐              │
│  │   Account 1   │   │   Account 2   │   │   Account 3   │              │
│  │   (primary)   │   │   (backup)    │   │   (backup)    │              │
│  ├───────────────┤   ├───────────────┤   ├───────────────┤              │
│  │ Email: bot1@  │   │ Email: bot2@  │   │ Email: bot3@  │              │
│  │ TOTP: ✓       │   │ TOTP: ✓       │   │ TOTP: ✓       │              │
│  │ Profile: ✓    │   │ Profile: ✓    │   │ Profile: ✓    │              │
│  │ Quota: 45/50  │   │ Quota: 50/50  │   │ Quota: 23/50  │              │
│  │ Session: OK   │   │ Session: OK   │   │ Session: EXP  │◄─┐           │
│  └───────────────┘   └───────────────┘   └───────────────┘  │           │
│                                                             │           │
│                                          Auto-Login ────────┘           │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  STRATÉGIES DE SÉLECTION                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  LEAST_USED:    Utiliser le compte avec le plus de quota restant        │
│  ROUND_ROBIN:   Alterner entre les comptes à chaque requête             │
│  FAILOVER:      Compte principal, switch si problème                    │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  COMPOSANTS                                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SessionKeepAlive   → Cron 12h, maintient sessions actives              │
│  HealthMonitor      → Vérifie état sessions, détecte expirations        │
│  AutoLoginModule    → Re-login automatique si credentials stockés       │
│  QuotaTracker       → Compte requêtes, évite rate limits                │
│  AlertingService    → Notifie si tous comptes KO                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.4 Implémentation Technique

#### Configuration accounts.json

```json
{
  "accounts": [
    {
      "id": "account-1",
      "email": "notebooklm.bot1@gmail.com",
      "enabled": true,
      "priority": 1,
      "has_credentials": true,
      "has_totp": true
    },
    {
      "id": "account-2",
      "email": "notebooklm.bot2@gmail.com",
      "enabled": true,
      "priority": 2,
      "has_credentials": true,
      "has_totp": true
    },
    {
      "id": "account-3",
      "email": "notebooklm.bot3@gmail.com",
      "enabled": true,
      "priority": 3,
      "has_credentials": false,
      "has_totp": false
    }
  ],
  "rotation_strategy": "least_used",
  "keep_alive_interval_hours": 12,
  "auto_login_enabled": true,
  "alert_webhook": "https://hooks.slack.com/..."
}
```

#### Interface AccountManager

```typescript
interface Account {
  id: string;
  email: string;
  profileDir: string;
  quota: { used: number; limit: number; resetAt: Date };
  sessionStatus: 'valid' | 'expiring' | 'expired';
  lastActivity: Date;
}

interface AccountManager {
  // Sélectionner le meilleur compte disponible
  getBestAccount(): Promise<Account>;

  // Incrémenter le quota après une requête
  recordUsage(accountId: string): Promise<void>;

  // Vérifier la santé de tous les comptes
  healthCheck(): Promise<AccountHealth[]>;

  // Auto-refresh si credentials stockés
  refreshAccount(accountId: string): Promise<boolean>;

  // Keep-alive pour maintenir les sessions
  keepAlive(): Promise<void>;
}
```

#### Auto-Login avec TOTP

```typescript
import { authenticator } from 'otplib';
import { decrypt } from './crypto';

class AutoLoginManager {
  async performAutoLogin(account: AccountConfig): Promise<boolean> {
    const page = await this.browser.newPage();

    try {
      // 1. Navigate to Google login
      await page.goto('https://accounts.google.com/signin');
      await page.waitForLoadState('networkidle');

      // 2. Enter email
      const email = decrypt(account.emailEncrypted);
      await page.fill('input[type="email"]', email);
      await page.click('#identifierNext');
      await page.waitForNavigation();

      // 3. Enter password
      const password = decrypt(account.passwordEncrypted);
      await page.fill('input[type="password"]', password);
      await page.click('#passwordNext');
      await page.waitForNavigation();

      // 4. Handle 2FA if configured
      if (account.totpSecretEncrypted) {
        await this.handle2FA(page, account.totpSecretEncrypted);
      }

      // 5. Wait for successful login
      await page.waitForURL('**/myaccount.google.com/**', { timeout: 30000 });

      // 6. Navigate to NotebookLM to establish session
      await page.goto('https://notebooklm.google.com');
      await page.waitForLoadState('networkidle');

      // 7. Save session state
      const state = await page.context().storageState();
      await this.saveSessionState(account.id, state);

      log.success(`✅ Auto-login successful for ${account.email}`);
      return true;
    } catch (error) {
      log.error(`❌ Auto-login failed for ${account.email}: ${error}`);
      return false;
    } finally {
      await page.close();
    }
  }

  private async handle2FA(page: Page, totpSecretEncrypted: string): Promise<void> {
    // Wait for 2FA page
    await page.waitForSelector('input[name="totpPin"]', { timeout: 10000 });

    // Generate TOTP code
    const secret = decrypt(totpSecretEncrypted);
    const code = authenticator.generate(secret);

    log.info(`  🔐 Entering 2FA code...`);
    await page.fill('input[name="totpPin"]', code);
    await page.click('#totpNext');
    await page.waitForNavigation();
  }
}
```

### 9.5 Setup des Comptes Dédiés

| Étape | Action                             | Notes                                      |
| ----- | ---------------------------------- | ------------------------------------------ |
| 1     | Créer 3-5 comptes Gmail dédiés     | Noms: `nblm.bot1@gmail.com`, etc.          |
| 2     | Activer 2FA TOTP (recommandé)      | Utiliser Google Authenticator ou similaire |
| 3     | Sauvegarder le secret TOTP         | Code affiché lors du setup (ou QR décodé)  |
| 4     | Créer le fichier `credentials.enc` | Chiffrer avec clé AES-256                  |
| 5     | Login initial manuel (1 fois)      | Pour établir le profil browser             |
| 6     | Vérifier quota disponible          | 50 queries/jour par compte gratuit         |

### 9.6 Risques et Mitigations

| Risque                            | Probabilité | Impact   | Mitigation                                          |
| --------------------------------- | ----------- | -------- | --------------------------------------------------- |
| Google bloque "activité suspecte" | Moyenne     | Haut     | Profils persistants, comportement humain, IP stable |
| CAPTCHA au login                  | Faible      | Moyen    | Retry avec délai, fallback autre compte             |
| Credentials compromis             | Faible      | Critique | Chiffrement AES-256, comptes dédiés isolés          |
| Tous comptes bloqués              | Très faible | Critique | Alerting immédiat, intervention manuelle            |
| Changement UI Google login        | Faible      | Moyen    | Monitoring, mise à jour sélecteurs                  |

### 9.7 Comparatif des Options

| Critère              | Option 1 (No 2FA) | Option 2 (TOTP) | Option 3 (Keep-Alive) |
| -------------------- | ----------------- | --------------- | --------------------- |
| **Sécurité**         | ⚠️ Faible         | ✅ Bonne        | ✅ Bonne              |
| **Complexité setup** | ✅ Simple         | ⚠️ Moyenne      | ✅ Simple             |
| **Maintenance**      | ✅ Faible         | ✅ Faible       | ⚠️ Moyenne            |
| **Fiabilité**        | ⚠️ Moyenne        | ✅ Bonne        | ⚠️ Moyenne            |
| **Zero-touch**       | ✅ Oui            | ✅ Oui          | ⚠️ Partiel            |
| **Recommandé**       | Dev/test          | **Production**  | Complément            |

### 9.8 Recommandation Finale

```
┌─────────────────────────────────────────────────────────────────────────┐
│  RECOMMANDATION POUR PRODUCTION                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Combiner Option 2 (TOTP) + Option 3 (Keep-Alive):                      │
│                                                                         │
│  1. Pool de 3-5 comptes dédiés avec 2FA TOTP                            │
│  2. Credentials + TOTP secrets chiffrés (AES-256)                       │
│  3. Keep-alive cron toutes les 12h (prévention)                         │
│  4. Auto-login avec TOTP si session expire (guérison)                   │
│  5. Rotation LEAST_USED pour répartir la charge                         │
│  6. Alerting si >50% des comptes en erreur                              │
│                                                                         │
│  Effort estimé: 3-5 jours de développement                              │
│  Résultat: Système autonome 24/7 sans intervention humaine              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Annexes

### D. Dépendances pour Auto-Login TOTP

```json
{
  "dependencies": {
    "otplib": "^12.0.1"
  }
}
```

### E. Exemple de Chiffrement Credentials

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = process.env.CREDENTIALS_ENCRYPTION_KEY; // 32 bytes

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### F. Références Authentification

- [Playwright Authentication](https://playwright.dev/docs/auth)
- [Google OAuth Refresh Tokens](https://developers.google.com/identity/protocols/oauth2)
- [Puppeteer Session Cookie Management](https://www.webshare.io/academy-article/puppeteer-login)
- [OAuth Tokens vs Cookies Discussion](https://github.com/puppeteer/puppeteer/issues/6615)
- [otplib - TOTP Library](https://www.npmjs.com/package/otplib)

---

_Document généré le 23 décembre 2024_
_Prochaine réévaluation recommandée: Mars 2025_
