// lib/sections.js
// Known OneNote section IDs for AliceChatGPT (NoGraphListCalls fast map)
//
// NOTE: We handle both ASCII hyphen "-" and EN DASH "–" for matching.

export const NOTEBOOK_NAME = "AliceChatGPT";

// Canonical map: friendly key -> { name: OneNote UI name, id: sectionId }
export const SECTIONS = {
  // ===== Food & Nutrition =====
  "Food and Nutrition": {
    name: "Food and Nutrition",
    id: "0-824A10198D31C608!s8dd162a74531444eaee1b88c96c56d7c",
  },
  "Food and Nutrition – Meals": {
    name: "Food and Nutrition – Meals",
    id: "0-824A10198D31C608!s99db9d2afe324f7e89479d7d84cde5dd",
  },
  "Food and Nutrition - Meals": {
    name: "Food and Nutrition - Meals",
    id: "0-824A10198D31C608!s99db9d2afe324f7e89479d7d84cde5dd",
  },
  "Food and Nutrition – Ingredients": {
    name: "Food and Nutrition – Ingredients",
    id: "0-824A10198D31C608!sec12c41ac704440ebac7daeb6ead26c1",
  },
  "Food and Nutrition - Ingredients": {
    name: "Food and Nutrition - Ingredients",
    id: "0-824A10198D31C608!sec12c41ac704440ebac7daeb6ead26c1",
  },
  "Food and Nutrition – Alcohol Notes": {
    name: "Food and Nutrition – Alcohol Notes",
    id: "0-824A10198D31C608!s3c1c6233ad714675a45af9359aba1e80",
  },
  "Food and Nutrition - Alcohol Notes": {
    name: "Food and Nutrition - Alcohol Notes",
    id: "0-824A10198D31C608!s3c1c6233ad714675a45af9359aba1e80",
  },

  // ===== Fitness =====
  "Fitness": {
    name: "Fitness",
    id: "0-824A10198D31C608!s804036943463449aaaf33aa702b7cc4d",
  },
  "Fitness – Workouts": {
    name: "Fitness – Workouts",
    id: "0-824A10198D31C608!sdf1317aee7204806ba48d430f339c923",
  },
  "Fitness - Workouts": {
    name: "Fitness - Workouts",
    id: "0-824A10198D31C608!sdf1317aee7204806ba48d430f339c923",
  },
  "Fitness – Step Counts": {
    name: "Fitness – Step Counts",
    id: "0-824A10198D31C608!s240c71270b6d4341bd64a665275d85a4",
  },
  "Fitness - Step Counts": {
    name: "Fitness - Step Counts",
    id: "0-824A10198D31C608!s240c71270b6d4341bd64a665275d85a4",
  },
  "Fitness – Progress": {
    name: "Fitness – Progress",
    id: "0-824A10198D31C608!sa2eb24e412144523b6fe90e97edaadf1",
  },
  "Fitness - Progress": {
    name: "Fitness - Progress",
    id: "0-824A10198D31C608!sa2eb24e412144523b6fe90e97edaadf1",
  },

  // ===== Journal =====
  "Journal": {
    name: "Journal",
    id: "0-824A10198D31C608!s0d93ba4b9abf4f3da1f053ddaddb2435",
  },

  // ===== Travel =====
  "Travel": {
    name: "Travel",
    id: "0-824A10198D31C608!sb2f5ccb5c6fd456480ec45d90a716dfb",
  },

  // ===== Wardrobe =====
  "Lifestyle and Wardrobe – Shopping List": {
    name: "Lifestyle and Wardrobe – Shopping List",
    id: "0-824A10198D31C608!s66518a6fd3744884af8078f2d1d61e3b",
  },
  "Lifestyle and Wardrobe - Shopping List": {
    name: "Lifestyle and Wardrobe - Shopping List",
    id: "0-824A10198D31C608!s66518a6fd3744884af8078f2d1d61e3b",
  },

  // ===== Finance =====
  "Finance and Career": {
    name: "Finance and Career",
    id: "0-824A10198D31C608!s8940df4070894d42863587ceeb4ccd9f",
  },
  "Finance & Career": {
    name: "Finance and Career",
    id: "0-824A10198D31C608!s8940df4070894d42863587ceeb4ccd9f",
  },
};

// Normalize a name to match either hyphen variant.
export function resolveSectionId(name) {
  if (!name) return null;
  const ascii = String(name).replace(/\u2013/g, "-"); // EN DASH -> hyphen
  const enDash = String(name).replace(/-/g, "–");     // hyphen -> EN DASH
  return (
    SECTIONS[name]?.id ||
    SECTIONS[ascii]?.id ||
    SECTIONS[enDash]?.id ||
    null
  );
}
