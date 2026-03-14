import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import postcssImportExtGlob from 'postcss-import-ext-glob';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import fg from 'fast-glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedPackageRoot = path.resolve(__dirname, '../../..');

const pathExists = async (p) => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};

const resolveGlobalCssPath = async () => {
  const sitePath = path.join(process.cwd(), 'src/assets/css/global/global.css');
  if (await pathExists(sitePath)) return sitePath;
  return path.join(sharedPackageRoot, 'src/assets/css/global/global.css');
};

const resolveLocalCssFiles = async () => {
  const siteLocal = await fg(['src/assets/css/local/**/*.css'], {
    cwd: process.cwd(),
    absolute: true
  });
  const sharedLocal = await fg(['src/assets/css/local/**/*.css'], {
    cwd: sharedPackageRoot,
    absolute: true
  });
  const byBasename = new Map();
  for (const p of sharedLocal) byBasename.set(path.basename(p), p);
  for (const p of siteLocal) byBasename.set(path.basename(p), p);
  return [...byBasename.values()];
};

const buildCss = async (inputPath, outputPaths) => {
  const inputContent = await fs.readFile(inputPath, 'utf-8');

  const result = await postcss([
    postcssImportExtGlob,
    postcssImport,
    tailwindcss,
    autoprefixer,
    cssnano
  ]).process(inputContent, {from: inputPath});

  for (const outputPath of outputPaths) {
    await fs.mkdir(path.dirname(outputPath), {recursive: true});
    await fs.writeFile(outputPath, result.css);
  }

  return result.css;
};

export const buildAllCss = async () => {
  const tasks = [];

  const globalCssPath = await resolveGlobalCssPath();
  tasks.push(buildCss(globalCssPath, ['src/_includes/css/global.css']));

  const localCssFiles = await resolveLocalCssFiles();
  for (const inputPath of localCssFiles) {
    const baseName = path.basename(inputPath);
    tasks.push(buildCss(inputPath, [`src/_includes/css/${baseName}`]));
  }

  const componentCssFiles = await fg(['src/assets/css/components/**/*.css']);
  for (const inputPath of componentCssFiles) {
    const baseName = path.basename(inputPath);
    tasks.push(buildCss(inputPath, [`dist/assets/css/components/${baseName}`]));
  }

  await Promise.all(tasks);
};
