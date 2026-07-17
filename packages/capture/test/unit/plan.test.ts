import path from "node:path";
import { describe, expect, it } from "vitest";

import type { DiscoveredScene } from "../../src/core/discover.js";
import { buildPlan, findOrphanShots, resolveTarget } from "../../src/core/plan.js";
import { readShots, type SceneModule } from "../../src/scene-utils.js";
import type { ResolvedConfig, Scene, Shot } from "../../src/types.js";

const ROOT = "/app";

const config = (over: Partial<ResolvedConfig> = {}): ResolvedConfig =>
  ({
    root: ROOT,
    configPath: `${ROOT}/stillsmith.config.tsx`,
    framework: "react",
    scenes: ["src/**/*.scene.tsx"],
    stabilize: { fonts: true, animations: "disable", delay: 0 },
    format: "jpeg",
    presets: {
      light: { width: 1280, height: 800 },
      dark: { width: 1280, height: 800, colorScheme: "dark" },
      docs: { width: 640, height: 480, dpr: 2 },
    },
    targets: {
      all: { outDir: "output" },
    },
    ...over,
  }) as ResolvedConfig;

/** A discovered scene, built through `readShots` so shot naming stays honest. */
function discovered(id: string, scene: Partial<Scene>, shots: Record<string, Shot>) {
  const mod = { default: { render: () => null, ...scene }, ...shots } as SceneModule;
  return {
    file: path.join(ROOT, "src", `${id}.scene.tsx`),
    id,
    scene: mod.default,
    shots: readShots(mod),
  } satisfies DiscoveredScene;
}

const at = (...parts: string[]) => path.join(ROOT, ...parts);

describe("resolveTarget", () => {
  it("names the targets it knows when asked for one it doesn't", () => {
    expect(() => resolveTarget(config(), "nope")).toThrow(/Unknown target "nope".*all/s);
  });
});

describe("buildPlan preset resolution", () => {
  const scenes = [
    discovered("a", {}, { Default: {} }),
    discovered("b", { presets: ["docs"] }, { Default: {}, Wide: { presets: ["light"] } }),
  ];

  it("gives a shot with no opinion every preset", () => {
    const plan = buildPlan(config(), scenes, "all", { scenes: ["a"] });
    expect(plan.map((i) => i.presetName).sort()).toEqual(["dark", "docs", "light"]);
  });

  it("lets the scene narrow it", () => {
    const plan = buildPlan(config(), scenes, "all", { scenes: ["b"], shots: ["default"] });
    expect(plan.map((i) => i.presetName)).toEqual(["docs"]);
  });

  it("lets the shot override the scene — most specific wins", () => {
    const plan = buildPlan(config(), scenes, "all", { scenes: ["b"], shots: ["wide"] });
    expect(plan.map((i) => i.presetName)).toEqual(["light"]);
  });

  it("intersects with the target's presets rather than adding to them", () => {
    const cfg = config({ targets: { docsOnly: { outDir: "out", presets: ["docs"] } } });
    const plan = buildPlan(cfg, scenes, "docsOnly", { scenes: ["a"] });
    expect(plan.map((i) => i.presetName)).toEqual(["docs"]);
  });

  it("throws when a shot names a preset that doesn't exist", () => {
    const bad = [discovered("a", {}, { Default: { presets: ["retina"] } })];
    expect(() => buildPlan(config(), bad, "all")).toThrow(/unknown preset "retina"/);
  });
});

describe("buildPlan tag filtering", () => {
  const scenes = [
    discovered("tagged", { tags: ["docs"] }, { Default: {} }),
    discovered("untagged", {}, { Default: {} }),
  ];

  it("a target with tags takes only shots carrying one", () => {
    const cfg = config({ targets: { docs: { outDir: "out", tags: ["docs"], presets: ["docs"] } } });
    const plan = buildPlan(cfg, scenes, "docs");
    expect(plan.map((i) => i.sceneId)).toEqual(["tagged"]);
  });

  it("a target without tags takes everything", () => {
    const plan = buildPlan(config(), scenes, "all", { presets: ["light"] });
    expect(plan.map((i) => i.sceneId).sort()).toEqual(["tagged", "untagged"]);
  });
});

describe("buildPlan output paths", () => {
  const scenes = [discovered("workspace", {}, { Default: {}, Tour: {} })];

  it("nests under the preset, and drops 'default' from the stem", () => {
    const plan = buildPlan(config(), scenes, "all", { presets: ["light"] });
    expect(plan.map((i) => i.file).sort()).toEqual([
      at("output", "light", "workspace-tour.jpg"),
      at("output", "light", "workspace.jpg"),
    ]);
  });

  it("writes straight into outDir when the target is flat", () => {
    const cfg = config({ targets: { flat: { outDir: "shots", flat: true, presets: ["light"] } } });
    const plan = buildPlan(cfg, scenes, "flat", { shots: ["default"] });
    expect(plan.map((i) => i.file)).toEqual([at("shots", "workspace.jpg")]);
  });
});

describe("buildPlan output collisions", () => {
  it("refuses a flat target whose presets would overwrite each other", () => {
    const cfg = config({
      targets: { shots: { outDir: "shots", flat: true, presets: ["docs", "dark"] } },
    });
    const scenes = [discovered("home", {}, { Default: {} })];

    expect(() => buildPlan(cfg, scenes, "shots")).toThrow(
      /Target "shots": 1 output path collision.*home\.jpg\n.*\[dark\] home\/default\n.*\[docs\] home\/default\n.*Drop `flat: true`/s,
    );
  });

  it("catches stem clashes even without flat", () => {
    // fileStem("a-b", "default") and fileStem("a", "b") both yield "a-b".
    const scenes = [discovered("a-b", {}, { Default: {} }), discovered("a", {}, { B: {} })];

    expect(() => buildPlan(config(), scenes, "all", { presets: ["light"] })).toThrow(
      /output path collision.*Rename the colliding scenes or shots/s,
    );
  });

  it("does not fire when a flat target is pinned to one preset", () => {
    const cfg = config({
      targets: { shots: { outDir: "shots", flat: true, presets: ["docs"] } },
    });
    const scenes = [discovered("home", {}, { Default: {}, Hero: {} })];

    const plan = buildPlan(cfg, scenes, "shots");
    expect(plan.map((i) => i.file).sort()).toEqual([
      at("shots", "home-hero.jpg"),
      at("shots", "home.jpg"),
    ]);
  });
});

describe("buildPlan format", () => {
  const scenes = [discovered("workspace", {}, { Default: {} })];
  const only = (cfg: ResolvedConfig, target = "all") => {
    const plan = buildPlan(cfg, scenes, target, { presets: ["light"] });
    expect(plan).toHaveLength(1);
    return plan[0] as (typeof plan)[number];
  };

  it("takes the config's format and quality when the target has no opinion", () => {
    const item = only(config({ format: "webp", quality: 85 }));
    expect(item.file).toBe(at("output", "light", "workspace.webp"));
    expect(item.format).toBe("webp");
    expect(item.quality).toBe(85);
  });

  it("lets the target override both", () => {
    const cfg = config({
      quality: 85,
      targets: { all: { outDir: "output", format: "png", quality: 100 } },
    });
    const item = only(cfg);
    expect(item.file).toBe(at("output", "light", "workspace.png"));
    expect(item.format).toBe("png");
    expect(item.quality).toBe(100);
  });

  it("maps jpeg to the .jpg extension", () => {
    const item = only(config());
    expect(item.file).toBe(at("output", "light", "workspace.jpg"));
    expect(item.format).toBe("jpeg");
    expect(item.quality).toBeUndefined();
  });
});

describe("buildPlan viewport", () => {
  it("takes the preset's size, and the shot's when it has one", () => {
    const scenes = [
      discovered("a", {}, { Default: {}, Narrow: { viewport: { width: 340, height: 620 } } }),
    ];
    const plan = buildPlan(config(), scenes, "all", { presets: ["docs"] });
    const byShot = Object.fromEntries(plan.map((i) => [i.shotName, i.viewport]));

    expect(byShot.default).toEqual({ width: 640, height: 480 });
    expect(byShot.narrow).toEqual({ width: 340, height: 620 });
  });
});

describe("findOrphanShots", () => {
  it("names shots that no target picks up", () => {
    const scenes = [
      discovered("a", {}, { Default: {} }),
      discovered("b", { tags: ["docs"] }, { Default: {} }),
    ];
    const cfg = config({ targets: { docs: { outDir: "out", tags: ["docs"] } } });

    const plan = buildPlan(cfg, scenes, "docs");
    expect(findOrphanShots(scenes, plan)).toEqual(["a/default"]);
  });

  it("is empty when everything is captured", () => {
    const scenes = [discovered("a", {}, { Default: {} })];
    const plan = buildPlan(config(), scenes, "all");
    expect(findOrphanShots(scenes, plan)).toEqual([]);
  });
});
