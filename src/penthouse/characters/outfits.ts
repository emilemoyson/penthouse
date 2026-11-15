/**
 * Wardrobe for the characters. Every colour is a slot, so a new sub-agent
 * is just a new entry here. All of them wear the same cut: oversized hoodie,
 * loose joggers with ribbed cuffs, chunky sneakers.
 */
export type Outfit = {
  skin: string;
  hair: string;
  hoodie: string;
  hoodieTrim: string; // hem, cuffs, hood lining
  strings: string; // drawstrings
  logo: string;
  pants: string;
  pantsCuff: string;
  shoe: string;
  sole: string;
  shoeAccent: string;
  headphones?: string | null; // worn around the neck
  headphonesGlow?: string | null;
  beanie?: string | null;
  hairStyle?: "locs" | "afro" | "textured" | "curly" | "bun" | "buzz";
  vest?: string | null; // sleeveless puffer vest over the top
  chain?: string | null; // thin chain at the collar
  /** What they wear: the hoodie cut, a suit (jacket = hoodie slot, trousers = pants slot), or gym kit (tee = hoodie slot, shorts = pants slot). */
  kind?: "hoodie" | "suit" | "gym";
  hoodUp?: boolean;
  baggy?: boolean; // wide, slouchy sweatpants
  graphic?: string | null; // big bold print across the chest
  shirt?: string; // suit shirt
  tie?: string; // suit tie
  tights?: string | null; // gym: under the shorts (null = bare legs)
  headband?: string | null;
};

export const OUTFITS = {
  /** Office: you, in a sharp charcoal-navy suit, cut slightly loose. White shirt, deep red tie, brown loafers. */
  emile: {
    kind: "suit",
    skin: "#8a5a3e",
    hair: "#1a120e",
    hoodie: "#36425e",
    hoodieTrim: "#2c3650",
    strings: "#36425e",
    logo: "#36425e",
    pants: "#36425e",
    pantsCuff: "#36425e",
    shoe: "#4a2c1c",
    sole: "#22150f",
    shoeAccent: "#4a2c1c",
    shirt: "#f2efe8",
    tie: "#8e2f3a",
    headphones: null,
    beanie: null,
    hairStyle: "locs",
  },
  /** Bedroom: oversized grey hoodie with the hood up, baggy charcoal sweatpants, socks. */
  sleep: {
    kind: "hoodie",
    hoodUp: true,
    baggy: true,
    skin: "#c98d6a",
    hair: "#151018",
    hoodie: "#a7a3ad",
    hoodieTrim: "#928e99",
    strings: "#f1eee8",
    logo: "#d94a6a",
    graphic: null,
    pants: "#4a4a52",
    pantsCuff: "#3f3f46",
    shoe: "#efece6",
    sole: "#d8d3ca",
    shoeAccent: "#a7a3ad",
    headphones: null,
    beanie: null,
    hairStyle: "bun",
  },
  /** Gym: navy training tee, black shorts over tights, blue headband, white trainers. */
  coach: {
    kind: "gym",
    skin: "#7a4a32",
    hair: "#0f0b0a",
    hoodie: "#24304f",
    hoodieTrim: "#24304f",
    strings: "#24304f",
    logo: "#ff5a6e",
    pants: "#1c1c22",
    pantsCuff: "#1c1c22",
    tights: "#121216",
    headband: "#3d63d6",
    shoe: "#f4f1ea",
    sole: "#e6e1d8",
    shoeAccent: "#ff5a6e",
    headphones: null,
    headphonesGlow: null,
    beanie: null,
    hairStyle: "afro",
  },
  /** Kitchen: oversized white graphic hoodie with the hood up and a bold red print, baggy grey sweatpants. */
  chef: {
    kind: "hoodie",
    hoodUp: true,
    baggy: true,
    skin: "#e2b590",
    hair: "#5a3a22",
    hoodie: "#cfc9c4",
    hoodieTrim: "#bdb6b0",
    strings: "#d23b3b",
    logo: "#d23b3b",
    graphic: "#d23b3b",
    vest: "#c9772e",
    chain: "#e2b64a",
    pants: "#8b8b93",
    pantsCuff: "#7c7c84",
    shoe: "#f4f1ea",
    sole: "#3a3a3f",
    shoeAccent: "#2f56c8",
    headphones: null,
    beanie: null,
    hairStyle: "buzz",
  },
} satisfies Record<string, Outfit>;

export type OutfitId = keyof typeof OUTFITS;
