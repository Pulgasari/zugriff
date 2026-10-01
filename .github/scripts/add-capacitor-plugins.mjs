// .github/scripts/add-capacitor-plugins.mjs
//
// adds the repo's own native capacitor plugins to a scaffolded android project,
// after `cap add android` (see build-android-capacitor.yml). npm plugins are found by
// `cap sync`; these live in .github/capacitor/plugins/ as plain java sources, so
// they are copied in by hand and registered in MainActivity.
//
//   APP_SLUG=files node .github/scripts/add-capacitor-plugins.mjs build/files
//
// two kinds:
//   plugins/*.java          every app gets them (the saf folder access)
//   plugins/<name>/         only the apps whose registry entry lists <name> in
//                           build.plugins. a folder may hold helper classes next
//                           to its plugin, and a manifest.json with what it adds to
//                           AndroidManifest.xml: permissions, services, cleartext
//
// every java file is placed by its own `package` line. a class is registered
// when it is annotated @CapacitorPlugin, the helpers are only copied.
// idempotent: a second run overwrites the sources, adds nothing twice to the
// manifest and leaves MainActivity alone.

import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registry } from './../../.shared/js/data/apps.js';

const ROOT     = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCES  = join(ROOT, '.github', 'capacitor', 'plugins');
const project  = process.argv[2] || '.';
const javaDir  = join(project, 'android', 'app', 'src', 'main', 'java');
const manifest = join(project, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

const slug     = process.env.APP_SLUG;
const optional = (slug && registry.get(slug)?.build?.plugins) || [];

// :::::: COPY

const plugins   = [];
const fragments = [];

async function copyJava (dir) {
  for (const file of (await readdir(dir)).filter(name => name.endsWith('.java'))) {
    const source = await readFile(join(dir, file), 'utf8');
    const pkg    = source.match(/^package\s+([\w.]+)\s*;/m)?.[1];
    if (!pkg) throw new Error(`add-capacitor-plugins: ${file} has no package line`);

    const target = join(javaDir, ...pkg.split('.'));
    await mkdir(target, { recursive: true });
    await cp(join(dir, file), join(target, file));

    if (/@CapacitorPlugin\b/.test(source)) plugins.push(`${pkg}.${file.slice(0, -'.java'.length)}`);
  }
}

await copyJava(SOURCES);

for (const name of optional) {
  const dir = join(SOURCES, name);
  if (!existsSync(dir)) throw new Error(`add-capacitor-plugins: ${slug} asks for "${name}", there is no ${dir}`);
  await copyJava(dir);
  if (existsSync(join(dir, 'manifest.json'))) fragments.push(JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')));
}

// :::::: MANIFEST
// string edits on the template's manifest: a permission before </manifest>, a
// service before </application>, cleartext as an attribute of <application>

if (fragments.length) {
  let xml = await readFile(manifest, 'utf8');

  for (const fragment of fragments) {
    for (const permission of fragment.permissions ?? []) {
      if (xml.includes(`"${permission}"`)) continue;
      xml = xml.replace('</manifest>', `    <uses-permission android:name="${permission}" />\n</manifest>`);
    }

    for (const service of fragment.services ?? []) {
      if (xml.includes(`"${service.name}"`)) continue;
      const type = service.foregroundServiceType ? `\n            android:foregroundServiceType="${service.foregroundServiceType}"` : '';
      xml = xml.replace(/\n([ \t]*)<\/application>/, (_, indent) => `\n        <service\n            android:name="${service.name}"\n            android:exported="false"${type} />\n${indent}</application>`);
    }

    if (fragment.cleartext && !xml.includes('usesCleartextTraffic')) {
      xml = xml.replace('<application', '<application\n        android:usesCleartextTraffic="true"');
    }
  }

  await writeFile(manifest, xml);
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

console.log(`add-capacitor-plugins: ${plugins.join(', ')} -> ${activityPath}${fragments.length ? `, manifest: ${optional.join(', ')}` : ''}`);
