# TASK-010B: Preview "No HOME Component" Bug - Status Actuel

**Date**: 12 janvier 2026, 11:40  
**Status**: 🔴 EN COURS - CRITIQUE  
**Priority**: P0 - BLOQUEUR ABSOLU

## 🚨 Symptômes Actuels

**Le preview ne fonctionne JAMAIS après création de projet**

### Ce que l'utilisateur voit:

```
ERROR

No 🏠 HOME component selected
Click Make home as shown below.
[Image avec instructions]
```

### Logs Console:

```
✅ Using real ProjectOrganizationService
ProjectsPage.tsx:67 🔧 Initializing GitHub OAuth service...
GitHubOAuthService.ts:353 🔧 Initializing GitHubOAuthService
ProjectsPage.tsx:73 ✅ GitHub OAuth initialized. Authenticated: false
ViewerConnection.ts:49 Connected to viewer server at ws://localhost:8574
projectmodel.modules.ts:104 noodl_modules folder not found (fresh project), skipping module loading
ProjectsPage.tsx:112 🔔 Projects list changed, updating dashboard
useProjectOrganization.ts:75 ✅ Using real ProjectOrganizationService
LocalProjectsModel.ts:286 Project created successfully: lkh
[object%20Module]:1 Failed to load resource: net::ERR_FILE_NOT_FOUND
nodegrapheditor.ts:374 Failed to load AI assistant outer icon: Event
nodegrapheditor.ts:379 Failed to load warning icon: Event
nodegrapheditor.ts:369 Failed to load AI assistant inner icon: Event
nodegrapheditor.ts:359 Failed to load home icon: Event
nodegrapheditor.ts:364 Failed to load component icon: Event
projectmodel.ts:1259 Project saved Mon Jan 12 2026 11:21:48 GMT+0100
```

**Point clé**: Le projet est créé avec succès, sauvegardé, mais le preview affiche quand même l'erreur "No HOME component".

---

## 📋 Historique des Tentatives de Fix

### Tentative #1 (8 janvier): LocalTemplateProvider avec chemins relatifs

**Status**: ❌ ÉCHOUÉ  
**Problème**: Résolution de chemin avec `__dirname` ne fonctionne pas dans webpack  
**Erreur**: `Template not found at: ./project-examples/...`

### Tentative #2 (8 janvier): LocalTemplateProvider avec process.cwd()

**Status**: ❌ ÉCHOUÉ  
**Problème**: `process.cwd()` pointe vers le mauvais répertoire  
**Erreur**: `Template not found at: /Users/tw/.../packages/noodl-editor/project-examples/...`

### Tentative #3 (9 janvier): Génération programmatique

**Status**: ❌ ÉCHOUÉ  
**Problème**: Structure JSON incomplète  
**Erreur**: `Cannot read properties of undefined (reading 'comments')`  
**Résolution**: Ajout du champ `comments: []` dans la structure

### Tentative #4 (12 janvier - AUJOURD'HUI): Fix rootComponent

**Status**: 🟡 EN TEST  
**Changements**:

1. Ajout de `rootComponent: 'App'` dans `hello-world.template.ts`
2. Ajout du type `rootComponent?: string` dans `ProjectTemplate.ts`
3. Modification de `ProjectModel.fromJSON()` pour gérer `rootComponent`

**Fichiers modifiés**:

- `packages/noodl-editor/src/editor/src/models/template/templates/hello-world.template.ts`
- `packages/noodl-editor/src/editor/src/models/template/ProjectTemplate.ts`
- `packages/noodl-editor/src/editor/src/models/projectmodel.ts`

**Hypothèse**: Le runtime attend une propriété `rootComponent` dans le project.json pour savoir quel composant afficher dans le preview.

**Résultat**: ⏳ ATTENTE DE CONFIRMATION - L'utilisateur rapporte que ça ne fonctionne toujours pas

---

## 🔍 Analyse du Problème Actuel

### Questions Critiques

1. **Le fix du rootComponent est-il appliqué?**

   - Le projet a-t-il été créé APRÈS le fix?
   - Faut-il redémarrer le dev server?
   - Y a-t-il un problème de cache webpack?

2. **Le project.json contient-il rootComponent?**

   - Emplacement probable: `~/Documents/[nom-projet]/project.json` ou `~/Noodl Projects/[nom-projet]/project.json`
   - Contenu attendu: `"rootComponent": "App"`

3. **Le runtime charge-t-il correctement le projet?**
   - Vérifier dans `noodl-runtime/src/models/graphmodel.js`
   - Méthode `importEditorData()` ligne ~83: `this.setRootComponentName(exportData.rootComponent)`

### Points de Contrôle

```typescript
// 1. EmbeddedTemplateProvider.download() - ligne 92
await filesystem.writeFile(projectJsonPath, JSON.stringify(projectContent, null, 2));
// ✅ Vérifié: Le template content inclut bien rootComponent

// 2. ProjectModel.fromJSON() - ligne 172
if (json.rootComponent && !_this.rootNode) {
  const rootComponent = _this.getComponentWithName(json.rootComponent);
  if (rootComponent) {
    _this.setRootComponent(rootComponent);
  }
}
// ✅ Ajouté: Gestion de rootComponent

// 3. ProjectModel.setRootComponent() - ligne 233
setRootComponent(component: ComponentModel) {
  const root = _.find(component.graph.roots, function (n) {
    return n.type.allowAsExportRoot;
  });
  if (root) this.setRootNode(root);
}
// ⚠️ ATTENTION: Dépend de n.type.allowAsExportRoot
```

### Hypothèses sur le Problème Persistant

**Hypothèse A**: Cache webpack non vidé

- Le nouveau code n'est pas chargé
- Solution: `npm run clean:all && npm run dev`

**Hypothèse B**: Projet créé avec l'ancien template

- Le projet existe déjà et n'a pas rootComponent
- Solution: Supprimer le projet et en créer un nouveau

**Hypothèse C**: Le runtime ne charge pas rootComponent

- Le graphmodel.js ne gère peut-être pas rootComponent?
- Solution: Vérifier `noodl-runtime/src/models/graphmodel.js`

**Hypothèse D**: Le node Router ne permet pas allowAsExportRoot

- `setRootComponent()` cherche un node avec `allowAsExportRoot: true`
- Le Router ne l'a peut-être pas?
- Solution: Vérifier la définition du node Router

**Hypothèse E**: Mauvaise synchronisation editor ↔ runtime

- Le project.json a rootComponent mais le runtime ne le reçoit pas
- Solution: Vérifier ViewerConnection et l'envoi du projet

---

## 🚀 Plan de Débogage Immédiat

### Étape 1: Vérifier que le fix est appliqué (5 min)

```bash
# 1. Nettoyer complètement les caches
npm run clean:all

# 2. Redémarrer le dev server
npm run dev

# 3. Attendre que webpack compile (voir "webpack compiled successfully")
```

### Étape 2: Créer un NOUVEAU projet (2 min)

- Supprimer le projet "lkh" existant depuis le dashboard
- Créer un nouveau projet avec un nom différent (ex: "test-preview")
- Observer les logs console

### Étape 3: Vérifier le project.json créé (2 min)

```bash
# Trouver le projet
find ~ -name "test-preview" -type d 2>/dev/null | grep -i noodl

# Afficher son project.json
cat [chemin-trouvé]/project.json | grep -A 2 "rootComponent"
```

**Attendu**: On devrait voir `"rootComponent": "App"`

### Étape 4: Ajouter des logs de débogage (10 min)

Si ça ne fonctionne toujours pas, ajouter des console.log:

**Dans `ProjectModel.fromJSON()`** (ligne 172):

```typescript
if (json.rootComponent && !_this.rootNode) {
  console.log('🔍 Loading rootComponent from template:', json.rootComponent);
  const rootComponent = _this.getComponentWithName(json.rootComponent);
  console.log('🔍 Found component?', !!rootComponent);
  if (rootComponent) {
    console.log('🔍 Setting root component:', rootComponent.name);
    _this.setRootComponent(rootComponent);
    console.log('🔍 Root node after setRootComponent:', _this.rootNode?.id);
  }
}
```

**Dans `ProjectModel.setRootComponent()`** (ligne 233):

```typescript
setRootComponent(component: ComponentModel) {
  console.log('🔍 setRootComponent called with:', component.name);
  console.log('🔍 Graph roots:', component.graph.roots.length);
  const root = _.find(component.graph.roots, function (n) {
    console.log('🔍 Checking node:', n.type, 'allowAsExportRoot:', n.type.allowAsExportRoot);
    return n.type.allowAsExportRoot;
  });
  console.log('🔍 Found export root?', !!root);
  if (root) this.setRootNode(root);
}
```

### Étape 5: Vérifier le runtime (15 min)

**Vérifier `noodl-runtime/src/models/graphmodel.js`**:

```javascript
// Ligne ~83 dans importEditorData()
this.setRootComponentName(exportData.rootComponent);
```

Ajouter des logs:

```javascript
console.log('🔍 Runtime receiving rootComponent:', exportData.rootComponent);
this.setRootComponentName(exportData.rootComponent);
console.log('🔍 Runtime rootComponent set to:', this.rootComponent);
```

---

## 🎯 Solutions Possibles

### Solution Rapide: Forcer le rootComponent manuellement

Si le template ne fonctionne pas, forcer dans `LocalProjectsModel.ts` après création:

```typescript
// Dans newProject(), après projectFromDirectory
projectFromDirectory(dirEntry, (project) => {
  if (!project) {
    console.error('Failed to create project from template');
    fn();
    return;
  }

  project.name = name;

  // 🔧 FORCE ROOT COMPONENT
  const appComponent = project.getComponentWithName('App');
  if (appComponent && !project.getRootNode()) {
    console.log('🔧 Forcing root component to App');
    project.setRootComponent(appComponent);
  }

  this._addProject(project);
  // ...
});
```

### Solution Robuste: Vérifier allowAsExportRoot

Vérifier que le node Router a bien cette propriété. Sinon, utiliser un Group comme root:

```typescript
// Dans hello-world.template.ts
graph: {
  roots: [
    {
      id: generateId(),
      type: 'Group', // Au lieu de 'Router'
      x: 100,
      y: 100,
      parameters: {},
      ports: [],
      children: [
        {
          id: generateId(),
          type: 'Router',
          x: 0,
          y: 0,
          parameters: {
            startPage: '/#__page__/Home'
          },
          ports: [],
          children: []
        }
      ]
    }
  ];
}
```

### Solution Alternative: Utiliser rootNodeId au lieu de rootComponent

Si `rootComponent` par nom ne fonctionne pas, utiliser `rootNodeId`:

```typescript
// Dans le template, calculer l'ID du premier root
const appRootId = generateId();

content: {
  rootComponent: 'App',  // Garder pour compatibilité
  rootNodeId: appRootId,  // Ajouter ID direct
  components: [
    {
      name: 'App',
      graph: {
        roots: [
          {
            id: appRootId,  // Utiliser le même ID
            type: 'Router',
            // ...
          }
        ]
      }
    }
  ]
}
```

---

## ✅ Checklist de Résolution

### Tests Immédiats

- [ ] Cache webpack vidé (`npm run clean:all`)
- [ ] Dev server redémarré
- [ ] Nouveau projet créé (pas le même nom)
- [ ] project.json contient `rootComponent: "App"`
- [ ] Logs ajoutés dans ProjectModel
- [ ] Console montre les logs de rootComponent
- [ ] Preview affiche "Hello World!" au lieu de "No HOME component"

### Si ça ne fonctionne toujours pas

- [ ] Vérifier graphmodel.js dans noodl-runtime
- [ ] Vérifier définition du node Router (allowAsExportRoot)
- [ ] Tester avec un Group comme root
- [ ] Tester avec rootNodeId au lieu de rootComponent
- [ ] Vérifier ViewerConnection et l'envoi du projet

### Documentation Finale

- [ ] Documenter la solution qui fonctionne
- [ ] Mettre à jour CHANGELOG.md
- [ ] Ajouter dans LEARNINGS.md
- [ ] Créer tests de régression
- [ ] Mettre à jour README de TASK-010

---

## 📞 Prochaines Actions pour l'Utilisateur

### Action Immédiate (2 min)

1. Arrêter le dev server (Ctrl+C)
2. Exécuter: `npm run clean:all`
3. Relancer: `npm run dev`
4. Attendre "webpack compiled successfully"
5. Supprimer le projet "lkh" existant
6. Créer un NOUVEAU projet avec un nom différent
7. Tester le preview

### Si ça ne marche pas

Me dire:

- Le nom du nouveau projet créé
- Le chemin où il se trouve
- Le contenu de `project.json` (surtout la présence de `rootComponent`)
- Les nouveaux logs console

### Commande pour trouver le projet.json:

```bash
find ~ -name "project.json" -path "*/Noodl*" -type f -exec grep -l "rootComponent" {} \; 2>/dev/null
```

---

**Mis à jour**: 12 janvier 2026, 11:40  
**Prochaine révision**: Après test avec cache vidé
