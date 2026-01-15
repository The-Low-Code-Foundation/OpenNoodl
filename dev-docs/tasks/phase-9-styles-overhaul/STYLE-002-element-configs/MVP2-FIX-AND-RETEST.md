# MVP2 Fix & Re-Test Guide

**Date**: 15 janvier 2026 21:24  
**Status**: 🔧 Fix Applied - Ready for Testing

---

## 🐛 Problem Identified

Le système ElementConfigs n'était jamais initialisé au démarrage de l'app à cause d'**imports asynchrones** dans `index.ts` qui ne se terminaient jamais.

### Symptômes observés:

- ❌ Aucun log `[ElementConfigs]` dans la console
- ❌ Propriété `_variant` absente des nodes
- ❌ Tokens non résolus (affichage de `px` bruts au lieu de `var(--token)`)
- ❌ Defaults pas appliqués aux nouveaux nodes

---

## ✅ Fix Appliqué

**Fichier modifié**: `packages/noodl-editor/src/editor/src/models/ElementConfigs/index.ts`

### Avant (Cassé):

```typescript
export function initElementConfigs(): void {
  import('./configs').then(({ ButtonConfig, TextConfig, ... }) => {
    import('./ElementConfigRegistry').then(({ ElementConfigRegistry }) => {
      // Code jamais exécuté car async
    });
  });
}
```

### Après (Corrigé):

```typescript
import { ButtonConfig, TextConfig, GroupConfig, TextInputConfig, ImageConfig } from './configs';
import { ElementConfigRegistry } from './ElementConfigRegistry';

export function initElementConfigs(): void {
  console.log('[ElementConfigs] Initializing element configs...');

  // Imports synchrones - s'exécutent immédiatement
  ElementConfigRegistry.instance.register(ButtonConfig);
  ElementConfigRegistry.instance.register(TextConfig);
  ElementConfigRegistry.instance.register(GroupConfig);
  ElementConfigRegistry.instance.register(TextInputConfig);
  ElementConfigRegistry.instance.register(ImageConfig);

  console.log('[ElementConfigs] ✅ Initialized with', ElementConfigRegistry.instance.getCount(), 'configs');
  console.log('[ElementConfigs] Registered node types:', summary.nodeTypes);
}
```

---

## 🧪 Guide de Test - Projet Existant

### ⚠️ IMPORTANT: Limitation Connue

Le hook d'application de defaults **ne s'applique qu'aux NOUVEAUX nodes** créés avec `Object.keys(parameters).length === 0`.

**Cela signifie:**

- ✅ Les nodes que tu vas créer MAINTENANT auront les defaults
- ❌ Les nodes déjà existants dans ton projet NE SERONT PAS affectés (c'est normal)

---

## 📋 Procédure de Test

### Étape 1: Lancer l'App (2 min)

```bash
npm run dev
```

**⚠️ ATTENDRE** que l'app soit complètement lancée avant d'ouvrir la console.

### Étape 2: Vérifier la Console (CRITIQUE)

**Ouvrir DevTools**: `Cmd+Option+I` (Mac) ou `Ctrl+Shift+I` (Windows)

**Chercher ces logs au démarrage:**

```
[ElementConfigs] Initializing element configs...
[ElementConfigRegistry] Registered config for net.noodl.visual.button (6 variants)
[ElementConfigRegistry] Registered config for net.noodl.visual.text (10 variants)
[ElementConfigRegistry] Registered config for Group (7 variants)
[ElementConfigRegistry] Registered config for net.noodl.controls.textinput (2 variants)
[ElementConfigRegistry] Registered config for net.noodl.visual.image (3 variants)
[ElementConfigs] ✅ Initialized with 5 configs
[ElementConfigs] Registered node types: [...]
```

**Si ces logs n'apparaissent PAS:**

- ❌ Le fix n'a pas fonctionné
- ⚠️ Peut-être un problème de cache résiduel
- 📝 Documenter l'erreur et me la transmettre

**Si ces logs apparaissent:**

- ✅ Le système est initialisé correctement
- 🚀 Passer à l'étape 3

---

### Étape 3: Ouvrir Projet & Créer Page/Composant (2 min)

1. Ouvrir un projet existant
2. Créer une **NOUVELLE page ou composant** (vierge)
3. Ouvrir cette page dans l'éditeur

**Pourquoi une nouvelle page?**

- Les nodes existants ont déjà des `parameters`, le hook ne s'applique pas
- Une page vierge garantit des nodes neufs

---

### Étape 4: Test Individuel des Nodes (20 min)

Pour chaque type de node, faire ce test complet:

#### A. Button ✨

**Créer un nouveau Button** (drag & drop depuis le panneau de gauche)

**Dans le Property Panel (panneau de droite), vérifier:**

| Propriété         | Valeur Attendue              | Statut |
| ----------------- | ---------------------------- | ------ |
| `paddingTop`      | `var(--space-2)` ou ~8px     | [ ]    |
| `paddingLeft`     | `var(--space-4)` ou ~16px    | [ ]    |
| `fontSize`        | `var(--text-sm)` ou ~14px    | [ ]    |
| `borderRadius`    | `var(--radius-md)` ou ~4-6px | [ ]    |
| `backgroundColor` | `var(--primary)` ou couleur  | [ ]    |
| `_variant`        | `primary`                    | [ ]    |

**📸 Dans le Preview:**

- Le button doit avoir du padding visible
- Des coins arrondis
- Une couleur de fond
- ✅ Pas un bouton plat sans style

**Console log attendu:**

```
[ElementConfigRegistry] Applied defaults to net.noodl.visual.button (node <id>)
```

---

#### B. Text 🆕 (Avec Bug Fix)

**Créer un nouveau Text** (drag & drop)

**Dans le Property Panel, vérifier:**

| Propriété    | Valeur Attendue             | Statut |
| ------------ | --------------------------- | ------ |
| `width`      | `auto` (PAS `100%` !)       | [ ]    |
| `flexShrink` | `1`                         | [ ]    |
| `fontSize`   | `var(--text-base)` ou ~16px | [ ]    |
| `_variant`   | `body`                      | [ ]    |

⚠️ **Note**: Tu ne verras peut-être pas `flexShrink` dans le Property Panel standard - c'est OK, il est appliqué en interne.

**🧪 Test Critique du Bug Fix:**

1. Créer un **Group**
2. Dans les propriétés du Group, chercher **`flexDirection`** et le mettre à **`row`**
3. Ajouter **DEUX Text elements** comme enfants du Group
4. Mettre du texte dans chaque Text (ex: "Hello" et "World")

**Résultat attendu:**

- ✅ **SUCCÈS**: Les deux textes sont visibles côte à côte, ils partagent l'espace
- ❌ **ÉCHEC**: Un texte déborde à droite et n'est pas visible

**Console log attendu:**

```
[ElementConfigRegistry] Applied defaults to net.noodl.visual.text (node <id>)
```

---

#### C. Group 📦

**Créer un nouveau Group**

**Dans le Property Panel, vérifier:**

| Propriété       | Valeur Attendue | Statut |
| --------------- | --------------- | ------ |
| `display`       | `flex`          | [ ]    |
| `flexDirection` | `column`        | [ ]    |
| `_variant`      | `default`       | [ ]    |

**Console log attendu:**

```
[ElementConfigRegistry] Applied defaults to Group (node <id>)
```

---

#### D. TextInput 📝

**Créer un nouveau TextInput**

**Dans le Property Panel, vérifier:**

| Propriété      | Valeur Attendue | Statut |
| -------------- | --------------- | ------ |
| `paddingTop`   | Token ou ~8px   | [ ]    |
| `paddingLeft`  | Token ou ~12px  | [ ]    |
| `borderWidth`  | Token ou ~1px   | [ ]    |
| `borderRadius` | Token ou ~4px   | [ ]    |
| `_variant`     | `default`       | [ ]    |

**📸 Dans le Preview:**

- L'input doit avoir du padding
- Un border visible
- Des coins arrondis

**Console log attendu:**

```
[ElementConfigRegistry] Applied defaults to net.noodl.controls.textinput (node <id>)
```

---

#### E. Image 🖼️

**Créer une nouvelle Image**

**Dans le Property Panel, vérifier:**

| Propriété   | Valeur Attendue        | Statut |
| ----------- | ---------------------- | ------ |
| `width`     | `auto`                 | [ ]    |
| `height`    | `auto`                 | [ ]    |
| `objectFit` | `cover` (possiblement) | [ ]    |
| `_variant`  | `default`              | [ ]    |

**Note**: `objectFit` peut ne pas être visible selon la config - c'est OK.

**Console log attendu:**

```
[ElementConfigRegistry] Applied defaults to net.noodl.visual.image (node <id>)
```

---

## ✅ Checklist de Validation Finale

### Initialisation

- [ ] App démarre sans erreur
- [ ] Console affiche `[ElementConfigs] ✅ Initialized with 5 configs`
- [ ] 5 logs de registration (Button, Text, Group, TextInput, Image)

### Création de Nodes

- [ ] Button créé avec styles par défaut visibles
- [ ] Text créé avec `width: auto` et `flexShrink: 1`
- [ ] Group créé avec `display: flex` et `flexDirection: column`
- [ ] TextInput créé avec border, padding, et border-radius
- [ ] Image créée avec dimensions auto

### Propriété \_variant

- [ ] Chaque nouveau node a une propriété `_variant` définie
- [ ] Les valeurs sont cohérentes: `primary`, `default`, `body`, etc.

### Bug Fix Text (CRITIQUE)

- [ ] Deux Text elements dans un Group en row sont tous deux visibles
- [ ] Ils partagent l'espace équitablement
- [ ] Pas de débordement à droite

### Logs Console

- [ ] Log d'initialisation présent au démarrage
- [ ] Log "Applied defaults" pour chaque nouveau node créé
- [ ] Aucune erreur rouge dans la console

---

## 🚨 Si Ça Ne Marche Toujours Pas

### Scénario 1: Pas de logs d'initialisation

**Diagnostic:** Le fix n'a pas été appliqué correctement ou cache résiduel

**Actions:**

1. Vérifier que le fichier `ElementConfigs/index.ts` a bien été modifié
2. Re-run `npm run clean:all`
3. Redémarrer l'app
4. Si toujours rien, vérifier les erreurs TypeScript à la compilation

### Scénario 2: Logs présents, mais pas de defaults appliqués

**Diagnostic:** Le hook dans NodeGraphNode ne se déclenche pas

**Causes possibles:**

- Les nodes que tu testes ont déjà des `parameters` (pas vides)
- Tu dupli ques des nodes existants au lieu d'en créer de nouveaux
- Le projet est ancien avec des overrides

**Solution:**

- Créer une page/composant complètement vierge
- Drag & drop des nodes NEUFS depuis la library
- Ne pas dupliquer des nodes existants

### Scénario 3: Defaults appliqués mais pas de \_variant visible

**Diagnostic:** Le property panel ne montre pas les propriétés système (préfixées `_`)

**C'est normal!** Les propriétés `_variant`, `_size`, etc. sont des propriétés système qui peuvent ne pas apparaître dans le property panel standard.

**Vérification alternative:**

1. Ouvrir DevTools Console
2. Sélectionner un node
3. Dans la console, taper: `ProjectModel.instance.getActiveComponent().selectedNodes[0].parameters`
4. Vérifier que `_variant` est présent dans l'objet

---

## 🎯 Résultat Attendu

**Si tous les tests passent:**

- ✅ MVP2 est **VALIDÉ**
- ✅ Le système ElementConfigs est **OPÉRATIONNEL**
- ✅ Les defaults sont appliqués automatiquement aux nouveaux nodes
- ✅ Le bug Text sizing est corrigé
- 🚀 Prêt pour **MVP3** (VariantSelector UI)

**Si des tests échouent:**

- 📝 Documenter précisément quel test échoue
- 📸 Screenshot de l'erreur console si applicable
- 🔧 Investiguer et corriger avant MVP3

---

## 📊 Rapport de Test

Remplir après les tests:

**Date du test:** ****\_\_\_****  
**Testeur:** ****\_\_\_****

### Résumé

- Initialisation: ✅ / ❌
- Button: ✅ / ❌
- Text: ✅ / ❌
- Group: ✅ / ❌
- TextInput: ✅ / ❌
- Image: ✅ / ❌
- Bug Fix Text: ✅ / ❌

### Notes / Problèmes Trouvés:

```
[Ajouter tes observations ici]
```

### Statut Final:

- [ ] MVP2 VALIDÉ - Prêt pour MVP3
- [ ] MVP2 BLOQUÉ - Problèmes à corriger

---

**Créé par**: Cline  
**Date**: 15 janvier 2026 21:24
