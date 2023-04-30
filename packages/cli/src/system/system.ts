import os from 'node:os';
import path from 'node:path';

import { loadSpace, createAnimeSystem } from '@animepaste/core';

export async function makeSystem() {
  const root = inferRoot();
  const space = await loadSpace(root, async (entry) => {
    switch (entry.name) {
      case 'animegarden':
        const { AnimeGarden } = await import('@animepaste/animegarden');
        return AnimeGarden(entry);
      default:
        return undefined;
    }
  });
  const system = createAnimeSystem(space);
  return system;
}

function inferRoot() {
  try {
    const envRoot = process.env.ANIMEPASTE_SPACE;
    if (envRoot) {
      return path.resolve(envRoot);
    }
  } finally {
    return path.resolve(os.homedir(), '.animepaste');
  }
}
