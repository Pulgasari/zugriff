// .github/scripts/repos.mjs
// the repos of config.repos, next to zugriff (rat and what its import map points into): a shallow clone each

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import config from '../config.js';

const root   = fileURLToPath(new URL('../../', import.meta.url));
const parent = dirname(root.replace(/\/$/, ''));
const owner  = process.env.GITHUB_REPOSITORY_OWNER ?? 'Pulgasari';

for (const repo of config.repos) {
  const target = join(parent, repo);
  if (existsSync(target)) continue;
  execFileSync('git', ['clone', '--depth', '1', '--quiet', `https://github.com/${owner}/${repo}.git`, target], { stdio: 'inherit' });
  console.log(`cloned ${repo}`);
}
