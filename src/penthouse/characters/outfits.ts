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
  hairStyle?: "textured" | "curly" | "bun" | "buzz";
};

export const OUTFITS = {
  /** You. Oat hoodie, charcoal joggers, white sneakers with a gum sole, headphones round the neck. */
  emile: {
    skin: "#d9a882",
    hair: "#2a1c15",
    hoodie: "#d6c8ae",
    hoodieTrim: "#bfae90",
    strings: "#f3ede2",
    logo: "#3a5a8c",
    pants: "#2b2b31",
    pantsCuff: "#232328",
    shoe: "#eeeae2",
    sole: "#a8743f",
    shoeAccent: "#2f4f86",
    headphones: "#17171c",
    headphonesGlow: "#3ee0ff",
    beanie: null,
    hairStyle: "textured",
  },
  /** Sub-agent: recovery. Lavender hoodie, cream joggers. */
  sleep: {
    skin: "#c98d6a",
    hair: "#151018",
    hoodie: "#9384c2",
    hoodieTrim: "#7b6cab",
    strings: "#efe9ff",
    logo: "#f2a53a",
    pants: "#d8d0c0",
    pantsCuff: "#c4bba9",
    shoe: "#f1efea",
    sole: "#e2ddd3",
    shoeAccent: "#9384c2",
    headphones: null,
    beanie: null,
    hairStyle: "bun",
  },
  /** Sub-agent: coach. Black hoodie with orange accents, grey joggers. */
  coach: {
    skin: "#8d5b3e",
    hair: "#0f0b0a",
    hoodie: "#3a3a46",
    hoodieTrim: "#ff8a3d",
    strings: "#ff8a3d",
    logo: "#ff8a3d",
    pants: "#6a6a73",
    pantsCuff: "#57575f",
    shoe: "#1a1a1f",
    sole: "#f3f0ea",
    shoeAccent: "#ff8a3d",
    headphones: null,
    beanie: null,
    hairStyle: "curly",
  },
  /** Sub-agent: nutrition. Sage hoodie, cream joggers, rust beanie. */
  chef: {
    skin: "#e2b590",
    hair: "#5a3a22",
    hoodie: "#7e9a7b",
    hoodieTrim: "#68836a",
    strings: "#f4efe4",
    logo: "#f4efe4",
    pants: "#e2d9c6",
    pantsCuff: "#cfc5b0",
    shoe: "#f4f1ea",
    sole: "#3a3a3f",
    shoeAccent: "#c96f4a",
    headphones: null,
    beanie: "#c2683f",
    hairStyle: "buzz",
  },
} satisfies Record<string, Outfit>;

export type OutfitId = keyof typeof OUTFITS;
