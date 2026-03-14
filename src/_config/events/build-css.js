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
const sharedCssRoot = path.resolve(__dirname, '../../assets/css');
const siteCssRoot = path.resolve(process.cwd(), 'src/assets/css');

const fileExists = async p => fs.access(p).then(() => true).catch(() => false);

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

  // Global CSS: prefer site-local, fall back to shared
  const siteGlobal = path.join(siteCssRoot, 'global/global.css');
  const sharedGlobal = path.join(sharedCssRoot, 'global/global.css');
  const globalEntry = (await fileExists(siteGlobal)) ? siteGlobal : sharedGlobal;
  tasks.push(buildCss(globalEntry, ['src/_includes/css/global.css']));

  // Local CSS: merge shared + site-local, site-local wins on filename collision
  const sharedLocal = await fg([`${sharedCssRoot}/local/**/*.css`]);
  const siteLocal = await fg([`${siteCssRoot}/local/**/*.css`]);
  const localMap = new Map();
  for (const f of [...sharedLocal, ...siteLocal]) {
    localMap.set(path.basename(f), f);
  }
  for (const [baseName, inputPath] of localMap) {
    tasks.push(buildCss(inputPath, [`src/_includes/css/${baseName}`]));
  }

  await Promise.all(tasks);
};
