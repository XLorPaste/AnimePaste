import createDebug from 'debug';
import { lightRed } from '@breadc/color';

import { AnimeSystemError } from '@animespace/core';

import { makeSystem, makeCliApp } from './system';

const debug = createDebug('anime:cli');

export async function bootstrap() {
  const handle = (error: unknown) => {
    if (error instanceof AnimeSystemError) {
      console.error(lightRed('Anime System Error ') + error.detail);
    } else if (error instanceof Error) {
      console.error(lightRed('Unknown Error ') + error.message);
    } else {
      console.error(error);
    }
    debug(error);
  };

  process.setMaxListeners(256);
  process.on('unhandledRejection', (error) => {
    debug(error);
  });

  try {
    const system = await makeSystem();
    const app = await makeCliApp(system);
    await app.run(process.argv.slice(2));
    process.exit(0);
  } catch (error: unknown) {
    handle(error);
    process.exit(1);
  }
}

bootstrap();
