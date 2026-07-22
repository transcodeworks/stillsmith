/**
 * Write shots back into `*.scene.tsx` — and tours into `*.tour.ts`; the
 * engine is the same because both are "named export of an object literal".
 *
 * Shots live in code, which is what makes them feel like Storybook stories — but
 * it means the authoring GUI's Save button has to edit TypeScript, not JSON.
 *
 * The rule that keeps this safe: only ever touch the *named properties handed to
 * us*, on the *one exported object literal* addressed. Everything else in the
 * file — imports, the scene, other shots, and any comment on a property we
 * weren't asked to change — is left exactly as written. A spread is fine, too:
 * `{ ...shared, delay: 100 }` keeps its spread and only the named property moves.
 *
 * What we refuse is an initialiser that isn't an object literal at all — a
 * helper call, a conditional, an identifier. There is no property to set on
 * those, so the GUI reports them read-only rather than guessing.
 *
 * The one thing that does NOT survive is a comment *inside* a property we
 * rewrite: `annotations` is regenerated from data, and a comment between two
 * annotations isn't data. Comments on the shot, the scene, and untouched
 * properties are safe.
 */
import { Node, type ObjectLiteralExpression, Project, VariableDeclarationKind } from "ts-morph";

import { formatFile } from "./format.js";
import { printLiteral } from "./literal.js";

/** Property values to set. `undefined` removes the property. */
export type ShotProps = Record<string, unknown>;

export class CodemodError extends Error {}

function project(): Project {
  return new Project({
    // Scene files are read straight off disk; we never need a full type-check,
    // and loading the consumer's tsconfig would be slow and could fail.
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: true, jsx: 4 /* ReactJSX */ },
    manipulationSettings: { indentationText: "  " as never },
  });
}

/**
 * The object literal a shot export is initialised with.
 *
 * Handles the three shapes a shot is realistically written in:
 *   export const X: Shot = { … }
 *   export const X = { … } satisfies Shot
 *   export const X = { … }
 */
function shotLiteral(
  sourceFile: ReturnType<Project["addSourceFileAtPath"]>,
  exportName: string,
): ObjectLiteralExpression {
  const decl = sourceFile.getVariableDeclaration(exportName);
  if (!decl) {
    throw new CodemodError(`No export named "${exportName}" in ${sourceFile.getFilePath()}`);
  }

  let init = decl.getInitializer();
  // Unwrap `{…} satisfies Shot` / `{…} as Shot` (and the Tour equivalents).
  while (init && (Node.isSatisfiesExpression(init) || Node.isAsExpression(init))) {
    init = init.getExpression();
  }

  if (!init || !Node.isObjectLiteralExpression(init)) {
    throw new CodemodError(
      `"${exportName}" is not a plain object literal, so stillsmith won't rewrite it. ` +
        "Inline it as an object literal to edit it here, or edit the file by hand.",
    );
  }
  return init;
}

/**
 * Set (or remove) properties on one shot, leaving the rest of the file alone.
 *
 * `formatFile` afterwards runs the project's own formatter if it has one, so the
 * result matches the surrounding code rather than ts-morph's house style.
 */
export async function setShotProps(
  file: string,
  exportName: string,
  props: ShotProps,
  root: string,
): Promise<void> {
  const proj = project();
  const sourceFile = proj.addSourceFileAtPath(file);
  const literal = shotLiteral(sourceFile, exportName);

  for (const [key, value] of Object.entries(props)) {
    const existing = literal.getProperty(key);

    if (value === undefined) {
      existing?.remove();
      continue;
    }

    const initializer = printLiteral(value);
    if (existing && Node.isPropertyAssignment(existing)) {
      existing.setInitializer(initializer);
    } else {
      // A shorthand or spread property under this name — replace it outright.
      existing?.remove();
      literal.addPropertyAssignment({ name: key, initializer });
    }
  }

  await sourceFile.save();
  await formatFile(file, root);
}

/** What `createNamedExport` stamps onto the new declaration. */
export interface ExportShape {
  /** The type annotation, e.g. "Shot". */
  typeName: string;
  /** Where the type imports from, e.g. "@stillsmith/capture/react". */
  moduleSpecifier: string;
  /** Printed initializer, e.g. "{}" or "{ steps: [] }". */
  initializer: string;
}

/** Append `export const <name>: <Type> = <init>`, importing the type if needed. */
export async function createNamedExport(
  file: string,
  exportName: string,
  shape: ExportShape,
  root: string,
): Promise<void> {
  const proj = project();
  const sourceFile = proj.addSourceFileAtPath(file);

  if (sourceFile.getVariableDeclaration(exportName)) {
    throw new CodemodError(`"${exportName}" already exists in ${file}`);
  }
  if (!/^[A-Za-z_$][\w$]*$/.test(exportName)) {
    throw new CodemodError(`"${exportName}" is not a valid export name`);
  }

  ensureTypeImport(sourceFile, shape.typeName, shape.moduleSpecifier);
  sourceFile.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [{ name: exportName, type: shape.typeName, initializer: shape.initializer }],
  });

  await sourceFile.save();
  await formatFile(file, root);
}

/** Append `export const <name>: Shot = {}`. */
export function createShot(file: string, exportName: string, root: string): Promise<void> {
  return createNamedExport(
    file,
    exportName,
    { typeName: "Shot", moduleSpecifier: "@stillsmith/capture/react", initializer: "{}" },
    root,
  );
}

/** Append `export const <name>: Tour = { id, steps: [] }` to a `.tour.ts`. */
export function createTour(file: string, exportName: string, root: string): Promise<void> {
  return createNamedExport(
    file,
    exportName,
    {
      typeName: "Tour",
      moduleSpecifier: "@stillsmith/tour",
      // `id` is required by the type and is the persistence key — stamp the
      // kebab-cased export name rather than leaving a type error behind.
      initializer: printLiteral({
        id: exportName
          .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
          .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
          .toLowerCase(),
        steps: [],
      }),
    },
    root,
  );
}

export async function deleteShot(file: string, exportName: string, root: string): Promise<void> {
  const proj = project();
  const sourceFile = proj.addSourceFileAtPath(file);

  const decl = sourceFile.getVariableDeclaration(exportName);
  if (!decl) throw new CodemodError(`No export named "${exportName}" in ${file}`);

  // Remove the whole `export const X = …` statement, not just the declarator.
  decl.getVariableStatementOrThrow().remove();

  await sourceFile.save();
  await formatFile(file, root);
}

/** A new export is type-annotated, so the file needs that type in scope. */
function ensureTypeImport(
  sourceFile: ReturnType<Project["addSourceFileAtPath"]>,
  typeName: string,
  moduleSpecifier: string,
): void {
  const existing = sourceFile.getImportDeclaration(
    (d) => d.getModuleSpecifierValue() === moduleSpecifier,
  );

  if (!existing) {
    sourceFile.addImportDeclaration({
      moduleSpecifier,
      isTypeOnly: true,
      namedImports: [typeName],
    });
    return;
  }

  const named = existing.getNamedImports();
  if (named.some((n) => n.getName() === typeName)) return;
  existing.addNamedImport(typeName);
}
