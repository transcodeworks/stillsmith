/**
 * Fixture data for Pebble, the rock collection manager.
 *
 * Typed against the real model, so if a field changes, the scenes that render it
 * stop compiling instead of quietly producing a stale screenshot.
 */
export type RockKind = "igneous" | "sedimentary" | "metamorphic" | "mineral";

/**
 * A specimen photograph, plus the attribution its licence obliges us to carry.
 *
 * Every field here is a licence term, not a nicety: CC BY requires the
 * photographer, the licence, and a path back to the original. The inspector
 * renders all three, which is why they live on the data rather than in a
 * comment somewhere.
 */
export interface RockPhoto {
  /** Served from `public/rocks`, so this stays a plain string in Node too. */
  src: string;
  photographer: string;
  license: string;
  licenseUrl: string;
  /** The Wikimedia Commons file page. */
  source: string;
}

export interface Rock {
  id: string;
  name: string;
  kind: RockKind;
  /** Mohs scale, 1–10. */
  hardness: number;
  grams: number;
  foundAt: string;
  foundOn: string;
  /** Two-stop gradient. Sits behind `photo`, and stands in without one. */
  colors: [string, string];
  /**
   * Optional because a suitably-licensed photograph is not a given — the shelf
   * once carried a slate that had none, and the fixture was changed rather than
   * the licence bar lowered (see NOTICE.md). Every specimen has one today; a
   * rock that loses its photo falls back to `colors` rather than to a hole.
   */
  photo?: RockPhoto;
  notes: string;
  favourite: boolean;
}

const ST_JOHN = {
  photographer: "James St. John",
  license: "CC BY 2.0",
  licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
} as const;

export const ROCKS: Rock[] = [
  {
    id: "obsidian",
    name: "Obsidian",
    kind: "igneous",
    hardness: 5.5,
    grams: 212,
    foundAt: "Glass Butte, Oregon",
    foundOn: "2024-08-11",
    colors: ["#3b3f4a", "#0c0d11"],
    photo: {
      src: "/rocks/obsidian.jpg",
      ...ST_JOHN,
      source: "https://commons.wikimedia.org/wiki/File:Gray_obsidian_30.jpg",
    },
    notes: "Conchoidal fracture, edges still sharp. Handle with the cloth.",
    favourite: true,
  },
  {
    id: "amethyst",
    name: "Amethyst Geode",
    kind: "mineral",
    hardness: 7,
    grams: 640,
    foundAt: "Artigas, Uruguay",
    foundOn: "2024-05-02",
    colors: ["#a78bfa", "#5b21b6"],
    photo: {
      src: "/rocks/amethyst.jpg",
      photographer: "Marie-Lan Taÿ Pamart",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      source:
        "https://commons.wikimedia.org/wiki/File:Amethyst_geode_Planalto_MNHN_Min%C3%A9ralogie_n1.jpg",
    },
    notes: "Cracked open on the second tap. Points are unusually even.",
    favourite: true,
  },
  {
    id: "pyrite",
    name: "Pyrite",
    kind: "mineral",
    hardness: 6.25,
    grams: 98,
    foundAt: "Navajún, Spain",
    foundOn: "2023-11-19",
    colors: ["#fbbf24", "#b45309"],
    photo: {
      src: "/rocks/pyrite.jpg",
      photographer: "Miguel Calvo",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      source: "https://commons.wikimedia.org/wiki/File:Pyrite_Navajun_Screw_Growth.jpg",
    },
    notes: "Near-perfect cubes. Not gold, and I have made my peace with that.",
    favourite: false,
  },
  {
    id: "rose-quartz",
    name: "Rose Quartz",
    kind: "mineral",
    hardness: 7,
    grams: 305,
    foundAt: "Custer, South Dakota",
    foundOn: "2024-02-27",
    colors: ["#fda4af", "#be123c"],
    photo: {
      src: "/rocks/rose-quartz.jpg",
      ...ST_JOHN,
      source:
        "https://commons.wikimedia.org/wiki/File:Rose_quartz_(Newry,_Maine,_USA)_(29623706408).jpg",
    },
    notes: "Cloudy, but catches the window light beautifully around four o'clock.",
    favourite: false,
  },
  {
    id: "malachite",
    name: "Malachite",
    kind: "mineral",
    hardness: 3.75,
    grams: 154,
    foundAt: "Kolwezi, DRC",
    foundOn: "2023-09-04",
    colors: ["#34d399", "#065f46"],
    photo: {
      src: "/rocks/malachite.jpg",
      ...ST_JOHN,
      source:
        "https://commons.wikimedia.org/wiki/File:Botryoidal_Malachite_(7.7_mm),_Katanga_Province,_Zaire_(8459820730).jpg",
    },
    notes: "Banding is the whole point. Soft — do not put it in the tumbler.",
    favourite: false,
  },
  {
    id: "gneiss",
    name: "Lewisian Gneiss",
    kind: "metamorphic",
    hardness: 6.5,
    grams: 512,
    foundAt: "Isle of Lewis, Scotland",
    foundOn: "2022-06-30",
    colors: ["#cbd0d6", "#2b3138"],
    photo: {
      src: "/rocks/gneiss.jpg",
      ...ST_JOHN,
      source: "https://commons.wikimedia.org/wiki/File:Gneiss_2_(33239757534).jpg",
    },
    notes:
      "Older than the continent it sits on. The bands are metamorphic, not sedimentary — I have had that argument.",
    favourite: false,
  },
];

export const KIND_LABEL: Record<RockKind, string> = {
  igneous: "Igneous",
  sedimentary: "Sedimentary",
  metamorphic: "Metamorphic",
  mineral: "Mineral",
};

export const OBSIDIAN = ROCKS[0] as Rock;
export const AMETHYST = ROCKS[1] as Rock;
export const MALACHITE = ROCKS[4] as Rock;
