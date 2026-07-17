/**
 * Server-only Next modules — throw on import with a named recipe.
 *
 * Scenes are client renders. stillsmith does not emulate a server-component
 * runtime; a loud accurate error beats an empty stub.
 */
const MESSAGE =
  "this component is server-only; scenes render in a browser — extract the presentational child and shoot that";

throw new Error(`stillsmith: ${MESSAGE}`);
