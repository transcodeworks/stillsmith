import { describe, expect, it } from "vitest";

import {
  fileStem,
  readShots,
  type SceneModule,
  sceneId,
  sceneIdFromFile,
  shotNameFromExport,
} from "../../src/scene-utils.js";
import type { Scene, Shot } from "../../src/types.js";

const scene = (extra: Partial<Scene> = {}): Scene => ({ render: () => null, ...extra });

describe("sceneIdFromFile", () => {
  it("strips the directory and the .scene extension", () => {
    expect(sceneIdFromFile("/abs/src/components/team-settings.scene.tsx")).toBe("team-settings");
  });

  it("accepts every scene file extension", () => {
    for (const ext of ["tsx", "ts", "jsx", "js"]) {
      expect(sceneIdFromFile(`/abs/rock-shelf.scene.${ext}`)).toBe("rock-shelf");
    }
  });

  it("handles Windows separators", () => {
    expect(sceneIdFromFile("C:\\app\\src\\team-settings.scene.tsx")).toBe("team-settings");
  });
});

describe("sceneId", () => {
  it("falls back to the filename", () => {
    const mod = { default: scene() } as SceneModule;
    expect(sceneId("/abs/team-settings.scene.tsx", mod)).toBe("team-settings");
  });

  it("prefers an explicit id on the scene", () => {
    const mod = { default: scene({ id: "custom" }) } as SceneModule;
    expect(sceneId("/abs/team-settings.scene.tsx", mod)).toBe("custom");
  });
});

describe("shotNameFromExport", () => {
  it("kebab-cases the export name", () => {
    expect(shotNameFromExport("Default")).toBe("default");
    expect(shotNameFromExport("TeamSettingsAnnotated")).toBe("team-settings-annotated");
  });

  it("keeps acronyms together", () => {
    expect(shotNameFromExport("HTTPServer")).toBe("http-server");
  });

  it("splits digits from the words that follow", () => {
    expect(shotNameFromExport("Step2Detail")).toBe("step2-detail");
  });
});

describe("readShots", () => {
  it("treats every named object export as a shot", () => {
    const mod = {
      default: scene(),
      Default: {} as Shot,
      Wide: { viewport: { width: 900, height: 400 } } as Shot,
    } as SceneModule;

    expect(readShots(mod).map((s) => s.name)).toEqual(["default", "wide"]);
  });

  it("ignores exports that aren't plain objects, so scene files can hold helpers", () => {
    const mod = {
      default: scene(),
      Real: {} as Shot,
      helper: () => "not a shot",
      COLUMNS: ["also", "not", "a", "shot"],
      nothing: null,
      count: 3,
    } as unknown as SceneModule;

    expect(readShots(mod).map((s) => s.exportName)).toEqual(["Real"]);
  });

  it("lets a shot override its own filename stem", () => {
    const mod = { default: scene(), Wide: { name: "extra-wide" } as Shot } as SceneModule;
    expect(readShots(mod)[0]?.name).toBe("extra-wide");
  });

  it("merges the scene's tags into every shot's", () => {
    const mod = {
      default: scene({ tags: ["docs"] }),
      Default: {} as Shot,
      Marketing: { tags: ["web"] } as Shot,
    } as SceneModule;

    const [byDefault, marketing] = readShots(mod);
    expect(byDefault?.tags).toEqual(["docs"]);
    expect(marketing?.tags).toEqual(["docs", "web"]);
  });
});

describe("fileStem", () => {
  it("drops the shot name for the single-shot case", () => {
    expect(fileStem("workspace", "default")).toBe("workspace");
  });

  it("joins scene and shot otherwise", () => {
    expect(fileStem("workspace", "tour")).toBe("workspace-tour");
  });
});
