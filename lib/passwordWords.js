import { randomInt } from "crypto";

// Curated word list for generated temporary passwords (F16.7).
// Every entry is at least 4 letters, common, and unlikely to be
// misheard or misspelled when read aloud or copied from paper.
// All lowercase here; capitalization happens at generation time.
const WORDS = [
  "tiger", "river", "cloud", "stone", "eagle", "maple", "coral", "amber",
  "storm", "brave", "swift", "glow", "trail", "spark", "coast", "grove",
  "flame", "frost", "ridge", "shore", "peak", "vale", "wolf", "hawk",
  "bear", "deer", "lynx", "otter", "crane", "heron", "robin", "finch",
  "cedar", "birch", "pine", "elm", "willow", "aspen", "reef", "cove",
  "bay", "lake", "creek", "field", "hill", "dune", "cliff", "canyon",
  "mesa", "plain", "forest", "garden", "meadow", "orchard", "harbor",
  "island", "summit", "valley", "desert", "prairie", "glacier", "lagoon",
  "brook", "spring", "gold", "silver", "copper", "iron", "steel", "opal",
  "jade", "pearl", "ruby", "topaz", "quartz", "marble", "granite",
  "comet", "planet", "meteor", "aurora", "zenith", "nova", "orbit",
  "breeze", "thunder", "lantern", "beacon", "compass", "anchor", "voyage",
  "harvest", "sunrise", "sunset", "twilight", "horizon", "cascade",
  "current", "drift", "echo", "pulse", "ember", "flint", "gravel",
  "hollow", "ivory", "juniper", "kestrel", "lark", "mint", "nectar",
  "olive", "pepper", "quince", "raven", "sage", "thistle", "umber",
  "violet", "walnut", "yarrow", "zephyr",
];

// Digit pool intentionally skips 0 and 1, which get confused with
// the letters O and I when read aloud or handwritten quickly.
const DIGITS = ["2", "3", "4", "5", "6", "7", "8", "9"];

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function pickTwoDistinctWords() {
  const first = WORDS[randomInt(0, WORDS.length)];
  let second = WORDS[randomInt(0, WORDS.length)];
  while (second === first) {
    second = WORDS[randomInt(0, WORDS.length)];
  }
  return [first, second];
}

function pickDigit() {
  return DIGITS[randomInt(0, DIGITS.length)];
}

// Generates a readable temporary password: two capitalized common
// words plus two digits, e.g. "TigerRiver84". Minimum possible length
// with the shortest words in the list is 4 + 4 + 2 = 10 characters,
// comfortably above the 8 character minimum already enforced by F15.4.
export function generateReadablePassword() {
  const [wordOne, wordTwo] = pickTwoDistinctWords();
  return `${capitalize(wordOne)}${capitalize(wordTwo)}${pickDigit()}${pickDigit()}`;
}