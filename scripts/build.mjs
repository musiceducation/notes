#!/usr/bin/env node
/**
 * Static site — no bundling. Validates assets so CI / pre-deploy can run `npm run build`.
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const syncWww = process.argv.includes("--sync-www");

function fail(msg) {
  console.error("build:", msg);
  process.exit(1);
}

function checkJs(file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) fail(`missing ${file}`);
  const r = spawnSync(process.execPath, ["--check", p], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    fail(`syntax: ${file}`);
  }
  console.log("ok", file);
}

function copyToWww() {
  const www = path.join(root, "www");
  if (!fs.existsSync(www)) fs.mkdirSync(www, { recursive: true });
  const files = [
    "index.html",
    "style.css",
    "script.js",
    "bootstrap-instruments.js",
    "composition-studio.js",
    "auth-config.js",
    "auth-social.js",
    "capacitor-native.js",
    "vexflow.min.js",
    "lucide.min.js",
  ];
  for (const f of files) {
    const src = path.join(root, f);
    if (!fs.existsSync(src)) fail(`missing ${f}`);
    fs.copyFileSync(src, path.join(www, f));
    console.log("www ←", f);
  }
  for (const f of ["tastic-groove.mp3"]) {
    const src = path.join(root, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(www, f));
      console.log("www <-", f);
    } else {
      console.warn("build: optional missing", f);
    }
  }

  const dataSrc = path.join(root, "data");
  const dataDst = path.join(www, "data");
  if (!fs.existsSync(dataSrc)) fail("missing data/");
  fs.rmSync(dataDst, { recursive: true, force: true });
  fs.cpSync(dataSrc, dataDst, { recursive: true });
  console.log("www ← data/");

  const imgSrc = path.join(root, "img");
  const imgDst = path.join(www, "img");
  if (fs.existsSync(imgSrc)) {
    fs.rmSync(imgDst, { recursive: true, force: true });
    fs.cpSync(imgSrc, imgDst, { recursive: true });
    console.log("www ← img/");
  }
}

async function bundleCapNative(www) {
  const entry = path.join(root, "capacitor-native-entry.mjs");
  if (!fs.existsSync(entry)) return;
  try {
    const esbuild = await import("esbuild");
    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      outfile: path.join(www, "capacitor-native.js"),
      platform: "browser",
      format: "iife",
      minify: true,
    });
    console.log("www ← capacitor-native.js (bundled)");
  } catch (e) {
    console.warn("build: capacitor-native bundle skipped:", e.message || e);
  }
}

function checkJson(file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) fail(`missing ${file}`);
  try {
    JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    fail(`invalid JSON ${file}: ${e.message}`);
  }
  console.log("ok", file);
}

async function main() {
  console.log("build: validate (root =", root + ")");

  for (const f of ["script.js", "bootstrap-instruments.js", "auth-social.js"]) checkJs(f);
  for (const f of ["data/instrument-bank.json", "data/instrument-structure.json"]) checkJson(f);

  for (const f of ["index.html", "style.css"]) {
    if (!fs.existsSync(path.join(root, f))) fail(`missing ${f}`);
    console.log("ok", f);
  }

  if (syncWww) {
    const www = path.join(root, "www");
    copyToWww();
    await bundleCapNative(www);
  }
  console.log("build: done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
