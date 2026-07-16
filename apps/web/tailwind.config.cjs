const lefaxPreset = require("@lefax/design-tokens");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [lefaxPreset],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
};
