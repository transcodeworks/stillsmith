/**
 * `@stillsmith/capture/annotate` is a re-export of `@stillsmith/annotate`, kept so
 * existing imports don't break. The engine moved to its own package when it grew
 * a second consumer: `@stillsmith/tour` needs the same Target model and drawer at
 * app runtime, where pulling in the capture package (a dev dependency full of
 * toolchain) would be wrong.
 */
export * from "@stillsmith/annotate";
