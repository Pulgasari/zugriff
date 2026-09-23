// .github/scripts/add-capacitor-plugins.mjs
//
// adds the repo's own native capacitor plugins to a scaffolded android project,
// after `cap add android` (see build-capacitor.yml). npm plugins are found by
// `cap sync`; these live in .github/capacitor/plugins/ as plain java sources, so
// they are copied in by hand and registered in MainActivity.
//
//   node .github/scripts/add-capacitor-plugins.mjs build/files
//
// every *.java there is one plugin class named after its file, placed by its own
// `package` line. idempotent: a second run overwrites the sources and leaves
// MainActivity alone.

import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCES = join(ROOT, '.github', 'capacitor', 'plugins');
const javaDir = join(process.argv[2] || '.', 'android', 'app', 'src', 'main', 'java');

// :::::: COPY

const plugins = [];

for (const file of (await readdir(SOURCES)).filter(name => name.endsWith('.java'))) {
  const source = await readFile(join(SOURCES, file), 'utf8');
  const pkg    = source.match(/^package\s+([\w.]+)\s*;/m)?.[1];
  if (!pkg) throw new Error(`add-capacitor-plugins: ${file} has no package line`);

  const target = join(javaDir, ...pkg.split('.'));
  await mkdir(target, { recursive: true });
  await cp(join(SOURCES, file), join(target, file));

  plugins.push(`${pkg}.${file.slice(0, -'.java'.length)}`);
}

// :::::: REGISTER

// the template's MainActivity sits in the appId's package: find it rather than
// rebuilding the path from capacitor.config.json
async function findMainActivity (dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { const hit = await findMainActivity(path); if (hit) return hit; }
    else if (entry.name === 'MainActivity.java') return path;
  }
  return null;
}

const activityPath = await findMainActivity(javaDir);
if (!activityPath) throw new Error('add-capacitor-plugins: no MainActivity.java, run `cap add android` first');

const activity = await readFile(activityPath, 'utf8');
const MARK     = 'zugriff:plugins';

if (!activity.includes(MARK)) {
  const pkg = activity.match(/^package\s+([\w.]+)\s*;/m)?.[1];
  if (!pkg || !/class MainActivity extends BridgeActivity\s*\{\s*\}/.test(activity)) {
    throw new Error('add-capacitor-plugins: MainActivity is not the bare template anymore, register the plugins by hand');
  }

  // local plugins have to be registered before super.onCreate() builds the bridge
  await writeFile(activityPath, `package ${pkg};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // ${MARK}: the repo's own plugins, see .github/scripts/add-capacitor-plugins.mjs
    @Override
    public void onCreate (Bundle savedInstanceState) {
${plugins.map(name => `        registerPlugin(${name}.class);`).join('\n')}
        super.onCreate(savedInstanceState);
    }
}
`);
}

console.log(`add-capacitor-plugins: ${plugins.join(', ')} -> ${activityPath}`);
