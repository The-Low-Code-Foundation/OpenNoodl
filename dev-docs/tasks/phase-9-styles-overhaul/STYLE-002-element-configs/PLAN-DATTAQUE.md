# STYLE-002: Element Configs & Variants - Plan d'Attaque

**Date**: 15 janvier 2026  
**Estimé Total**: 16-20 heures  
**Stratégie**: Approche MVP progressive (comme STYLE-001)

---

## 📊 Vue d'Ensemble

STYLE-002 crée un système de configuration d'éléments avec variantes pour les nodes visuels de Noodl. Au lieu de tout faire d'un coup (risque de dépassement de contexte), nous allons procéder par MVPs successifs.

**Dépendances**:

- ✅ STYLE-001 MVP (complété) - système de tokens disponible

---

## 🎯 Stratégie: 3 MVPs Progressifs

### MVP 1: Config System + Text Bug Fix (6-8h)

**Objectif**: Infrastructure de base + correction bug critique  
**Livrables**: Registry fonctionnel, 2 configs (Button, Text), bug Text corrigé

### MVP 2: Node Integration + Defaults (5-7h)

**Objectif**: Application automatique des configs à la création  
**Livrables**: Nodes créés avec styles par défaut, 3 nodes supplémentaires

### MVP 3: Variants + UI (5-6h)

**Objectif**: Système de variantes avec UI de sélection  
**Livrables**: Changement de variantes via property panel

**Custom Variants**: Phase STYLE-002 Full (post-MVP)

---

## 📋 MVP 1: Config System + Text Bug Fix

### Objectifs

- Infrastructure ElementConfig fonctionnelle
- Registry pour enregistrer/récupérer configs
- 2 configs complets: Button, Text
- **Bug Fix**: Corriger le problème de sizing du Text element

### Sous-Tâches

#### 1A. Types & Interfaces (1h)

**Fichiers à créer**:

```
packages/noodl-editor/src/editor/src/models/ElementConfigs/
├── ElementConfigTypes.ts
└── index.ts
```

**Contenu**:

- Interface `ElementConfig`
- Interface `VariantConfig`
- Interface `StateConfig`
- Type `ElementConfigRegistry`

**Tester**: Les types compilent sans erreur

---

#### 1B. Registry Implementation (1.5h)

**Fichiers à créer**:

```
packages/noodl-editor/src/editor/src/models/ElementConfigs/
├── ElementConfigRegistry.ts
└── index.ts (update)
```

**Fonctionnalités**:

- `register(config)` - enregistrer une config
- `get(nodeType)` - récupérer une config
- `getVariants(nodeType)` - lister les variantes
- `applyDefaults(node)` - appliquer les defaults
- `applyVariant(node, variantName)` - appliquer une variante

**Tester**: Unit tests basiques (register/get)

---

#### 1C. ButtonConfig Implementation (1.5h)

**Fichiers à créer**:

```
packages/noodl-editor/src/editor/src/models/ElementConfigs/configs/
├── ButtonConfig.ts
└── index.ts
```

**Contenu**:

- Defaults complets (padding, typography, border, etc.)
- 6 variantes: primary, secondary, outline, ghost, destructive, link
- States: hover, active, disabled pour chaque variante
- Sizes: sm, md, lg, xl

**Tester**: Config enregistrée dans le registry, récupérable

---

#### 1D. TextConfig Implementation (1h)

**Fichiers à créer**:

```
packages/noodl-editor/src/editor/src/models/ElementConfigs/configs/
├── TextConfig.ts
└── index.ts (update)
```

**Contenu**:

- **Defaults avec bug fix**: `width: 'auto'`, `flexShrink: 1`, `minWidth: 0`
- 10 variantes: body, heading-1 à heading-6, muted, label, small, code
- Pas de states pour Text (pas interactif)

**Tester**: Config enregistrée, defaults incluent les fix flex

---

#### 1E. Text Element Bug Fix (2h)

**Fichiers à modifier**:

```
packages/noodl-viewer-react/src/nodes/basic/Text.jsx
packages/noodl-runtime/src/nodes/basic/text.js (si existe)
```

**Changements**:

```javascript
// AVANT (bug)
const defaultStyle = {
  width: '100%',
  height: 'auto',
};

// APRÈS (fix)
const defaultStyle = {
  width: 'auto',      // Changé de '100%'
  height: 'auto',
  flexShrink: 1,      // Nouveau
  flexGrow: 0,        // Nouveau
  minWidth: 0,        // Nouveau
};
```

**Tester**:

1. Créer un Group avec `flexDirection: row`
2. Ajouter 2 Text elements comme enfants
3. Vérifier que les deux sont visibles côte à côte
4. **Avant fix**: Le 2e déborde à droite
5. **Après fix**: Les deux partagent l'espace

---

### MVP 1 - Résumé

- [x] Types TypeScript définis
- [x] Registry implémenté et testé
- [x] ButtonConfig complet avec 6 variantes
- [x] TextConfig complet avec 10 variantes
- [x] Bug Text sizing corrigé et testé

**Livrable**: Infrastructure ElementConfig + 2 configs + bug fix critique

---

## 📋 MVP 2: Node Integration + Defaults

### Objectifs

- Intégrer le système de configs dans la création de nodes
- Appliquer automatiquement les defaults à la création
- Ajouter 3 configs supplémentaires: Group, TextInput, Image

### Sous-Tâches

#### 2A. Hook Node Creation (2h)

**Fichiers à modifier**:

```
packages/noodl-editor/src/editor/src/models/
├── NodeModel.ts
├── NodeGraphModel.ts
└── nodelibrary.ts (ou fichier de création de node)
```

**Fonctionnalités**:

- Détecter la création d'un nouveau node
- Récupérer la config via `ElementConfigRegistry.get(nodeType)`
- Appliquer les defaults via `ElementConfigRegistry.applyDefaults(node)`
- Stocker la variante par défaut dans node.parameters

**Tester**: Créer un Button, vérifier que padding/colors sont appliqués

---

#### 2B. GroupConfig Implementation (1h)

**Fichiers à créer**:

```
packages/noodl-editor/src/editor/src/models/ElementConfigs/configs/
├── GroupConfig.ts
└── index.ts (update)
```

**Contenu**:

- Defaults: `display: flex`, `flexDirection: column`
- 7 variantes: default, card, section, inset, flex-row, flex-col, centered

**Tester**: Créer un Group, vérifier defaults appliqués

---

#### 2C. TextInputConfig Implementation (1h)

**Fichiers à créer**:

```
packages/noodl-editor/src/editor/src/models/ElementConfigs/configs/
├── TextInputConfig.ts
└── index.ts (update)
```

**Contenu**:

- Defaults: padding, border, typography
- 2 variantes: default, error
- States: focus, disabled, placeholder

**Tester**: Créer un TextInput, vérifier styling

---

#### 2D. ImageConfig Implementation (0.5h)

**Fichiers à créer**:

```
packages/noodl-editor/src/editor/src/models/ElementConfigs/configs/
├── ImageConfig.ts
└── index.ts (update)
```

**Contenu**:

- Defaults: `width: auto`, `height: auto`, `objectFit: cover`
- 3 variantes: default, rounded, circle

**Tester**: Créer une Image, vérifier defaults

---

#### 2E. Integration Testing (1h)

**Tests manuels**:

1. Créer un nouveau projet vide
2. Drag & drop chaque type de node (Button, Text, Group, TextInput, Image)
3. Vérifier que chaque node a les bonnes propriétés par défaut
4. Inspecter node.parameters pour vérifier `_variant`
5. Vérifier dans le preview que les styles sont appliqués

**Tests unitaires**:

- Test de création de node avec config
- Test d'application des defaults
- Test de stockage de la variante par défaut

---

### MVP 2 - Résumé

- [x] Hook de création de node implémenté
- [x] Defaults appliqués automatiquement
- [x] 3 nouvelles configs: Group, TextInput, Image
- [x] Tests d'intégration passent

**Livrable**: Nodes créés avec styles par défaut automatiquement

---

## 📋 MVP 3: Variants + UI

### Objectifs

- Permettre le changement de variante via property panel
- Créer l'UI VariantSelector
- Appliquer la variante sélectionnée au node

### Sous-Tâches

#### 3A. VariantSelector Component (2h)

**Fichiers à créer**:

```
packages/noodl-core-ui/src/components/inputs/VariantSelector/
├── VariantSelector.tsx
├── VariantSelector.module.scss
├── VariantSelector.stories.tsx
└── index.ts
```

**UI Structure**:

```
┌──────────────────────────────┐
│ Variant: [Primary ▼]         │
│          ┌────────────────┐  │
│          │ ● Primary      │  │
│          │   Secondary    │  │
│          │   Outline      │  │
│          │   Ghost        │  │
│          │   Destructive  │  │
│          │   Link         │  │
│          └────────────────┘  │
└──────────────────────────────┘
```

**Props**:

```typescript
interface VariantSelectorProps {
  nodeType: string;
  currentVariant: string;
  onChange: (variant: string) => void;
}
```

**Tester**: Storybook stories pour différents node types

---

#### 3B. Property Panel Integration (1.5h)

**Fichiers à modifier/créer**:

```
packages/noodl-editor/src/editor/src/views/panels/propertyeditor/
├── PropertyEditor.tsx (ou fichier principal)
├── VariantSection.tsx (nouveau)
└── sections/ (dossier pour les sections)
```

**Fonctionnalités**:

- Détecter si le node sélectionné a une config
- Si oui, afficher la section "Variant" en haut du property panel
- Utiliser VariantSelector pour changer la variante
- Appeler `ElementConfigRegistry.applyVariant(node, variantName)` au changement

**Tester**: Sélectionner un Button, changer la variante, voir le changement

---

#### 3C. Variant Application in Viewer (1.5h)

**Fichiers à modifier**:

```
packages/noodl-viewer-react/src/
├── nodes/controls/Button.jsx
├── nodes/basic/Text.jsx
├── nodes/std-library/group.js
└── react-component-node.js (helper pour résolution de variantes)
```

**Fonctionnalités**:

- Lire `node.parameters._variant` ou `node.variant`
- Récupérer la config de la variante
- Appliquer les styles de la variante au composant
- Merger avec les propriétés custom de l'utilisateur (user overrides)

**Ordre de priorité des styles**:

1. Defaults de la config
2. Styles de la variante
3. Propriétés définies par l'utilisateur (highest priority)

**Tester**: Changer la variante dans le property panel, voir le preview se mettre à jour

---

### MVP 3 - Résumé

- [x] VariantSelector UI créé et testé dans Storybook
- [x] Property panel affiche les variantes disponibles
- [x] Changement de variante met à jour le node
- [x] Preview reflète la variante sélectionnée

**Livrable**: Système de variantes fonctionnel avec UI

---

## 🚀 Ordre d'Exécution Recommandé

### Session 1: MVP 1 - Infrastructure (3-4h)

```bash
# 1. Types & Registry
- Créer ElementConfigTypes.ts
- Créer ElementConfigRegistry.ts
- Tests unitaires basiques

# 2. Première Config (Button)
- Créer ButtonConfig.ts
- Enregistrer dans le registry
- Tester la récupération
```

**Point de contrôle**: Registry fonctionne, ButtonConfig enregistré

---

### Session 2: MVP 1 - Configs + Bug Fix (3-4h)

```bash
# 3. Deuxième Config (Text)
- Créer TextConfig.ts
- Inclure les fix flex dans defaults

# 4. Bug Fix Text Element
- Modifier Text.jsx (viewer)
- Tester avec 2 Text en row layout
```

**Point de contrôle**: 2 configs, bug Text corrigé

---

### Session 3: MVP 2 - Integration (3-4h)

```bash
# 5. Hook Node Creation
- Modifier NodeModel/NodeGraphModel
- Appliquer defaults à la création

# 6. Configs Supplémentaires
- GroupConfig.ts
- TextInputConfig.ts
- ImageConfig.ts
```

**Point de contrôle**: Nodes créés avec defaults automatiquement

---

### Session 4: MVP 3 - Variants UI (2-3h)

```bash
# 7. VariantSelector Component
- Créer le composant UI
- Storybook stories
```

**Point de contrôle**: UI testée dans Storybook

---

### Session 5: MVP 3 - Integration (2-3h)

```bash
# 8. Property Panel Integration
- Ajouter VariantSection
- Connecter VariantSelector

# 9. Viewer Integration
- Appliquer variantes dans les nodes
- Tester le changement en temps réel
```

**Point de contrôle**: Système complet fonctionnel

---

## ✅ Checklist Finale de Validation

### MVP 1: Config System

- [ ] ElementConfigTypes.ts compilé sans erreur
- [ ] ElementConfigRegistry implémenté
- [ ] ButtonConfig avec 6 variantes + 4 sizes
- [ ] TextConfig avec 10 variantes
- [ ] Bug Text sizing corrigé (2 Text en row partagent l'espace)

### MVP 2: Node Integration

- [ ] Hook node creation fonctionne
- [ ] Defaults appliqués automatiquement
- [ ] GroupConfig avec 7 variantes
- [ ] TextInputConfig avec 2 variantes + states
- [ ] ImageConfig avec 3 variantes
- [ ] Test: Créer chaque type de node → styles par défaut visibles

### MVP 3: Variants UI

- [ ] VariantSelector UI créé
- [ ] Storybook stories fonctionnelles
- [ ] Property panel affiche la section Variant
- [ ] Changement de variante met à jour le node
- [ ] Preview reflète la variante en temps réel
- [ ] User overrides ont priorité sur variantes

### Qualité & Documentation

- [ ] Tous les fichiers ont des commentaires JSDoc
- [ ] Code suit les standards TypeScript (.clinerules)
- [ ] Pas de `TSFixme` ajoutés
- [ ] Tests unitaires pour le registry
- [ ] CHANGELOG.md créé avec les changements
- [ ] README.md mis à jour si nécessaire

---

## 🔧 Points Techniques Importants

### 1. Résolution de Tokens dans les Variantes

Les configs utilisent `var(--token-name)`. Le runtime doit:

- Résoudre ces références via CSS (fonctionnera automatiquement)
- Pas besoin de parsing spécial, le browser gère `var()`

### 2. Priorité des Styles

```
Defaults (lowest)
  ↓
Variant Styles
  ↓
User Overrides (highest)
```

Implémentation:

```typescript
const finalStyles = {
  ...config.defaults,
  ...variant.styles,
  ...node.userStyles // Always win
};
```

### 3. Storing Variant Selection

Stocker dans `node.parameters`:

```typescript
node.parameters._variant = 'primary';
// OU
node.variant = 'primary';
```

Préfixe `_` pour indiquer que c'est une propriété système, pas utilisateur.

### 4. States (Hover, Active, etc.)

Pour MVP 3, les states sont:

- Définis dans la config
- Appliqués via React state hooks (useState pour hover/active)
- Mergés avec les styles de base

Exemple:

```typescript
const [isHovered, setIsHovered] = useState(false);

const styles = {
  ...baseStyles,
  ...(isHovered && variant.states?.hover)
};

return (
  <button
    style={styles}
    onMouseEnter={() => setIsHovered(true)}
    onMouseLeave={() => setIsHovered(false)}
  >
    {children}
  </button>
);
```

---

## 🚧 Hors Scope du MVP

Ces features sont prévues pour **STYLE-002 Full** (post-MVP):

- ❌ Custom variant creation (UI "Save as Variant")
- ❌ Custom variant storage (project/global)
- ❌ Variant import/export
- ❌ Variant preview thumbnails in selector
- ❌ Size presets UI (sm, md, lg, xl)
- ❌ Responsive variants (breakpoint-specific)

---

## 📝 Recommandations pour l'Implémentation

### Approche Progressive

**Ne PAS tout faire d'un coup** - Risque de dépassement de contexte API.

1. **Session 1**: Types + Registry + ButtonConfig (3-4 fichiers)
2. **Session 2**: TextConfig + Bug Fix (2 fichiers)
3. **Session 3**: Node Integration + 3 Configs (5 fichiers)
4. **Session 4**: VariantSelector UI (4 fichiers)
5. **Session 5**: Property Panel + Viewer Integration (5 fichiers)

### Commits Fréquents

Commit après chaque sous-tâche complétée:

```bash
git commit -m "feat(element-configs): Add ElementConfigTypes and Registry"
git commit -m "feat(element-configs): Add ButtonConfig with 6 variants"
git commit -m "fix(text): Fix Text element flex sizing issue"
```

### Tests Continus

Tester après chaque sous-tâche, pas à la fin. Si quelque chose ne marche pas, c'est plus facile à debugger.

---

## 📅 Timeline Estimée

| Session | Durée | Tâches                          | Livrable        |
| ------- | ----- | ------------------------------- | --------------- |
| 1       | 3-4h  | Types + Registry + ButtonConfig | Infrastructure  |
| 2       | 3-4h  | TextConfig + Bug Fix            | 2 configs + fix |
| 3       | 3-4h  | Node Integration + 3 Configs    | Auto-defaults   |
| 4       | 2-3h  | VariantSelector UI              | UI component    |
| 5       | 2-3h  | Property Panel + Viewer         | MVP complet     |

**Total**: 13-18 heures (dans l'estimé initial 16-20h)

---

## 🎯 Critères de Succès

**MVP 1 Success**:

- Registry fonctionne
- 2 configs (Button, Text) enregistrés
- Bug Text corrigé
- Tests manuels passent

**MVP 2 Success**:

- Drag & drop d'un Button/Text/Group/TextInput/Image
- Styles par défaut visibles immédiatement dans le preview
- Pas d'erreurs console

**MVP 3 Success**:

- Property panel affiche "Variant" pour nodes configurés
- Changer la variante met à jour le preview en temps réel
- User peut override les styles de variante

**Validation Finale**:

- Créer un nouveau projet
- Ajouter 1 Button, 1 Text, 1 Group
- Changer leurs variantes
- Vérifier que le preview reflète les changements
- ✅ STYLE-002 MVP est complet

---

## 📚 Ressources & Références

### Fichiers Clés à Étudier

```
# Pour comprendre node creation:
packages/noodl-editor/src/editor/src/models/NodeModel.ts
packages/noodl-editor/src/editor/src/models/NodeGraphModel.ts

# Pour comprendre property panel:
packages/noodl-editor/src/editor/src/views/panels/propertyeditor/

# Pour comprendre les nodes viewer:
packages/noodl-viewer-react/src/nodes/controls/Button.jsx
packages/noodl-viewer-react/src/nodes/basic/Text.jsx

# Pour les tokens (déjà implémenté):
packages/noodl-editor/src/editor/src/models/StyleTokens/
```

### Patterns à Suivre

- **EventDispatcher**: Utiliser `useEventListener` hook (pas direct `.on()`)
- **TypeScript**: Pas de `TSFixme`, types explicites
- **Commits**: Format conventionnel (`feat:`, `fix:`, `refactor:`)
- **Comments**: En anglais, expliquer le "why", pas le "what"

---

**Créé le**: 15 janvier 2026  
**Prochaine étape**: Session 1 - Types + Registry + ButtonConfig

---

_Prêt à démarrer quand vous voulez ! 🚀_
