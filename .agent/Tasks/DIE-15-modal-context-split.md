# DIE-15 — Decide split shape for modal context (HITL)

## Context

`useRecipeModalState` en `src/hooks/use-recipe-modal.ts` retorna un `RecipeModalCtx` con **22 miembros** (líneas 27–65). Mezcla cuatro responsabilidades distintas: navegación del modal, estado de RHF, preview de receta importada, y operaciones derivadas (nutrición + submit). El issue pide una **decisión arquitectónica** — no implementación — sobre cómo partirlo. DIE-17 (`useRecipeForm`) y DIE-18 (navigation hook) están bloqueados hasta aprobar esto.

---

## Decision: split en **2 hooks** (`useRecipeFlow` + `useRecipeForm`)

**No** crear un tercer `useRecipePreview`. Razones abajo.

### `useRecipeFlow` — "¿dónde estoy en el modal?"

Dueño de: apertura/cierre, routing entre screens, contexto de entrada, y el handoff de preview importado (que es parte del *flow*, no del form).

```ts
interface RecipeFlowState {
  isOpen: boolean;
  screen: ModalScreen;
  mode: "create" | "edit";
  enteredVia: EnteredVia;
  recipeId: string | null;             // identidad cuando mode==="edit"
  importedPreview: ImportedRecipe | null;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

interface RecipeFlowActions {
  openCreate: () => void;
  openEdit: (recipeId: string, data: RecipeFormData) => void;
  close: () => void;
  goToScreen: (screen: ModalScreen) => void;
  goBack: () => void;
  goToNextStep: (validate: () => Promise<boolean>) => Promise<void>;
  setImportedPreview: (data: ImportedRecipe) => void;
}

export function useRecipeFlow(form: UseFormReturn<RecipeFormData>): RecipeFlowState & RecipeFlowActions;
```

Notas clave:
- `goToNextStep` recibe el `validate` callback en vez de llamar a `form.trigger` directamente → desacopla Flow de RHF (Form lo inyecta).
- `openEdit` necesita `form.reset` → pasa `form` por argumento (composición), Flow no importa RHF.
- `scrollContainerRef` vive acá porque pertenece al *shell* del modal.

### `useRecipeForm` — "¿qué dato estoy editando y sus operaciones derivadas?"

Dueño de: RHF, field arrays, categorías, nutrición, submit. Recibe callbacks de navegación de Flow.

```ts
interface RecipeFormState {
  form: UseFormReturn<RecipeFormData>;
  ingredientFields: { fields: FieldArrayWithId[]; append: (value: any) => void; remove: (index: number) => void };
  instructionFields: { fields: FieldArrayWithId[]; append: (value: any) => void; remove: (index: number) => void };
  categories: RecipeCategory[];
  nutritionLoading: boolean;
  nutritionResult: NutritionAnalysisResult | null;
  isSubmitting: boolean;
  savedRecipeId: string | null;
}

interface RecipeFormActions {
  analyzeNutrition: () => Promise<void>;
  handleSubmit: () => Promise<void>;
  resetForm: () => void;
}

export function useRecipeForm(opts: {
  mode: "create" | "edit";
  recipeId: string | null;
  isOpen: boolean;
  onSubmitSuccess: () => void;
}): RecipeFormState & RecipeFormActions;
```

Notas clave:
- `handleSubmit` necesita `mode` + `recipeId` (decide create vs update) → vienen como input, **no** importa Flow.
- Inversión de control: Form **no** llama `goToScreen` — recibe `onSubmitSuccess`. Esto hace al hook 100% testeable sin mockear navegación.
- `nutrition` y `submit` viven acá porque ambos operan sobre `form.getValues()`.

### Composición en el provider raíz

```ts
function RecipeModalProvider({ children }) {
  // Instanciar form primero para romper el ciclo flow↔form
  const form = useForm<RecipeFormData>({ resolver: zodResolver(recipeFormSchema), defaultValues });

  const flow = useRecipeFlow(form);
  const formHook = useRecipeForm({
    mode: flow.mode,
    recipeId: flow.recipeId,
    isOpen: flow.isOpen,
    onSubmitSuccess: () => flow.goToScreen("success"),
  });

  return (
    <RecipeModalContext.Provider value={{ ...flow, ...formHook }}>
      {children}
    </RecipeModalContext.Provider>
  );
}
```

**Resolución del ciclo Form↔Flow**: `useForm()` se instancia en el provider y se pasa a `useRecipeFlow`. Flow lo usa solo para `form.reset` en `openEdit`/`close`/`openCreate`. Form lo recibe como parte de su propia lógica interna (o se instancia desde Form y se pasa hacia arriba — decisión de implementación para DIE-17).

### Sin prop-drilling en screens

El context público `useRecipeModal()` sigue exponiendo la misma forma (`{...flow, ...formHook}`). Los **9 consumidores existentes no cambian**. Solo cambia la organización interna.

---

## Por qué NO un tercer `useRecipePreview`

`importedPreview` son **2 miembros** (`importedPreview`, `setImportedPreview`). Crear un hook para eso:

| Costo | Beneficio |
|-------|-----------|
| 3er archivo + provider wiring + 3er punto de composición | Aislamiento de 2 setters triviales |
| Screens que usan flow+form pasarían a usar 3 hooks | Cero ganancia de testabilidad |
| Segundo ciclo de deps (preview↔flow para reset en `close`) | — |

`importedPreview` se setea desde EntryScreen (acción de flow: "vine de import"), se lee en PreviewScreen, y se usa en la transición a step0 → es **flow state**, no una entidad propia. El preview es un *handoff* entre `useRecipeExtraction` (externo, DIE-7/14) y el form. Pertenece naturalmente al flow.

---

## Tradeoffs: 2-hook vs 3-hook

| Criterio | 2-hook (elegido) | 3-hook |
|---|---|---|
| Líneas por hook (estimado) | Flow ~120, Form ~150 | Flow ~110, Form ~150, Preview ~15 |
| Puntos de composición en provider | 2 | 3 |
| Test isolation | Form testea sin navegación (callback inyectado); Flow testea sin RHF (validate inyectado) | Igual + Preview trivial |
| Riesgo de ciclo de deps | 1 (form ↔ flow, resuelto con form en provider) | 2 |
| Coherencia conceptual | "navegación" vs "datos" — eje claro | Tercer eje difuso |

## Test isolation ganada

- **`useRecipeFlow`**: testeable sin RHF. `goToNextStep(() => Promise.resolve(true))` → `expect(screen).toBe("step1")`. Reusa helpers puros (`previousScreen`, `nextStep`) de DIE-12.
- **`useRecipeForm`**: testeable sin Flow. `onSubmitSuccess: vi.fn()` → assert que se llamó tras `createRecipe` exitoso.

---

## Archivos críticos para implementación (DIE-17/18)

- `src/hooks/use-recipe-modal.ts:27-65` — `RecipeModalCtx` actual a partir
- `src/hooks/use-recipe-modal.ts:103-121` — helpers puros reusables por Flow
- `src/hooks/use-recipe-modal.ts:259-322` — `analyzeNutrition` + `handleSubmit` migran a Form
- `src/components/recipes/modal/RecipeModal.tsx` — provider donde se compondrán los 2 hooks
- 9 consumidores de `useRecipeModal()` — **no cambian**

## Status

**Approved** — decisión tomada el 2026-05-03. Desbloquea DIE-17 y DIE-18.
