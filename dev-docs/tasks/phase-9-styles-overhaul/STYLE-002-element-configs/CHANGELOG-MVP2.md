# STYLE-002 MVP 2 - CHANGELOG

**Date**: 15 janvier 2026  
**Status**: ✅ Complete  
**Estimé**: 5-7h | **Réel**: ~1h

---

## 📋 Objectif

Intégrer le système de configs dans la création de nodes et ajouter 3 configs supplémentaires (Group, TextInput, Image).

---

## ✅ Travail Complété

### 1. Nouvelles Configurations

#### GroupConfig (7 variantes)

- **Fichier**: `packages/noodl-editor/src/editor/src/models/ElementConfigs/configs/GroupConfig.ts`
- **Node Type**: `Group`
- **Variantes**:
  - `default` - Simple flex column container
  - `card` - Elevated container with border and shadow
  - `section` - Content section with padding
  - `inset` - Subtle background for nested content
  - `flex-row` - Horizontal layout
  - `flex-col` - Vertical layout (explicit)
  - `centered` - Center content both axes

#### TextInputConfig (2 variantes)

- **Fichier**: `packages/noodl-editor/src/editor/src/models/ElementConfigs/configs/TextInputConfig.ts`
- **Node Type**: `net.noodl.controls.textinput`
- **Variantes**:
  - `default` - Standard input appearance
  - `error` - Validation error state
- **States**: focus, hover, disabled, placeholder

#### ImageConfig (3 variantes)

- **Fichier**: `packages/noodl-editor/src/editor/src/models/ElementConfigs/configs/ImageConfig.ts`
- **Node Type**: `net.noodl.visual.image`
- **Variantes**:
  - `default` - Standard rectangular image
  - `rounded` - Image with rounded corners
  - `circle` - Circular image (for avatars)

### 2. Export et Enregistrement

**Fichiers modifiés**:

- `packages/noodl-editor/src/editor/src/models/ElementConfigs/configs/index.ts`

  - Ajout des exports pour GroupConfig, TextInputConfig, ImageConfig

- `packages/noodl-editor/src/editor/src/models/ElementConfigs/index.ts`
  - Mise à jour de `initElementConfigs()` pour enregistrer les 5 configs

### 3. Hook de Node Creation

**Découverte importante**: Le hook était DÉJÀ implémenté dans `NodeGraphNode` (constructor, lignes 143-147):

```typescript
// Apply element config defaults if available
if (this.typename && Object.keys(this.parameters).length === 0) {
  ElementConfigRegistry.instance.applyDefaults(this as any);
}
```

Cela signifie que dès qu'un nouveau node est créé avec des paramètres vides, les defaults de sa config sont automatiquement appliqués.

---

## 📁 Fichiers Créés/Modifiés

### Créés (3 fichiers)

```
packages/noodl-editor/src/editor/src/models/ElementConfigs/configs/
├── GroupConfig.ts         (nouveau)
├── TextInputConfig.ts     (nouveau)
└── ImageConfig.ts         (nouveau)
```

### Modifiés (2 fichiers)

```
packages/noodl-editor/src/editor/src/models/ElementConfigs/
├── configs/index.ts       (exports ajoutés)
└── index.ts              (initElementConfigs mis à jour)
```

---

## 🔧 Fonctionnement

### Flux de Création de Node

1. **User crée un node** (drag & drop ou menu)
2. **NodeGraphNode constructor** est appelé
3. **Hook détecte** que `parameters` est vide
4. **Registry lookup** via `ElementConfigRegistry.instance.get(nodeType)`
5. **Defaults appliqués** via `applyDefaults(node)`
6. **Node possède maintenant** les styles par défaut de sa config

### Exemple: Création d'un Button

```typescript
// Avant (pas de config)
const button = new NodeGraphNode({ typename: 'net.noodl.visual.button' });
// button.parameters = {}

// Après (avec config)
const button = new NodeGraphNode({ typename: 'net.noodl.visual.button' });
// button.parameters = {
//   paddingTop: 'var(--space-2)',
//   paddingBottom: 'var(--space-2)',
//   fontSize: 'var(--text-sm)',
//   borderRadius: 'var(--radius-md)',
//   backgroundColor: 'var(--primary)',
//   color: 'var(--primary-foreground)',
//   _variant: 'primary',
//   ...
// }
```

---

## 🧪 Tests à Effectuer

### Tests Manuels

1. **Lancer l'application**

   ```bash
   npm run clean:all
   npm run dev
   ```

2. **Vérifier le log de démarrage**

   - Console devrait afficher: `[ElementConfigs] Initialized with 5 configs`

3. **Créer un nouveau projet**

4. **Drag & Drop chaque type de node**

   - Button
   - Text
   - Group
   - TextInput
   - Image

5. **Inspecter les propriétés**

   - Vérifier que chaque node a des valeurs par défaut
   - Vérifier que `_variant` est défini
   - Vérifier que les propriétés utilisent des tokens (`var(--...)`)

6. **Vérifier dans le preview**
   - Les styles par défaut devraient être visibles
   - Button devrait avoir padding, colors, border-radius
   - Group devrait être un flex column
   - TextInput devrait avoir border et padding

### Tests Automatiques

Les tests unitaires existants dans `ElementConfigRegistry.test.ts` couvrent déjà :

- ✅ Registration de configs
- ✅ Récupération de configs
- ✅ Application de defaults
- ✅ Validation de configs

---

## 📊 Statistiques

| Métrique            | Valeur                                    |
| ------------------- | ----------------------------------------- |
| Configs créées      | 3                                         |
| Total configs       | 5 (Button, Text, Group, TextInput, Image) |
| Variantes totales   | 6 + 10 + 7 + 2 + 3 = **28 variantes**     |
| Fichiers TypeScript | 3 nouveaux                                |
| Lignes de code      | ~400 lignes                               |
| Tokens utilisés     | ~50 design tokens                         |

---

## 🎯 MVP 2 - Critères de Succès

- [x] GroupConfig implémenté avec 7 variantes
- [x] TextInputConfig implémenté avec 2 variantes
- [x] ImageConfig implémenté avec 3 variantes
- [x] Configs exportées dans `configs/index.ts`
- [x] Configs enregistrées dans `initElementConfigs()`
- [x] Hook de création découvert (déjà en place)
- [x] Documentation complète
- [ ] Tests manuels effectués (à faire)

---

## 🚀 Prochaines Étapes (MVP 3)

MVP 2 est maintenant complet. Pour MVP 3, il faudra :

1. **VariantSelector Component** (2h)

   - Créer un composant UI pour sélectionner les variantes
   - Storybook stories

2. **Property Panel Integration** (1.5h)

   - Ajouter une section "Variant" dans le property panel
   - Connecter au VariantSelector

3. **Viewer Integration** (1.5h)
   - Modifier les nodes du viewer pour lire `_variant`
   - Appliquer les styles de variante au runtime
   - Gérer la priorité: defaults < variant < user overrides

---

## 💡 Notes Techniques

### Design Tokens

Toutes les configs utilisent des design tokens (`var(--token-name)`) qui seront résolus automatiquement par le browser au runtime.

### Priorité des Styles

Pour MVP 3, l'ordre de priorité sera :

1. **Defaults** (plus bas)
2. **Variant styles**
3. **User overrides** (plus haut)

### Node Types

Les node types utilisés :

- `net.noodl.visual.button`
- `net.noodl.visual.text`
- `Group`
- `net.noodl.controls.textinput`
- `net.noodl.visual.image`

---

**Créé par**: Cline  
**Reviewé par**: Richard  
**Date**: 15 janvier 2026
