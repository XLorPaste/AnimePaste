import path from 'path';
import fs from 'fs-extra';

import type { AnimeSystem } from '@animespace/core';

import { fetchResources } from 'animegarden';
import { lightBlue, bold, lightRed } from '@breadc/color';
import { format, getYear, subMonths } from 'date-fns';
import { BgmClient, type BGMCollection } from 'bgmc';

import { ufetch } from './ufetch';

type Item<T> = T extends Array<infer R> ? R : never;

type CollectionItem = Item<NonNullable<BGMCollection.Information['data']>>;

export async function generatePlan(
  system: AnimeSystem,
  username: string,
  options: { create: string | undefined; date: string | undefined }
) {
  const client = new BgmClient(ufetch, { maxRetry: 1 });
  const collections = await getCollections();

  const output: string[] = [];
  const writeln = (text: string) => {
    if (options.create) {
      output.push(text);
    } else {
      console.log(text);
    }
  };

  const now = new Date();
  const date = inferDate(options.date);
  writeln(`title: 创建于 ${format(now, 'yyyy-MM-dd hh:mm')}`);
  writeln(``);
  writeln(`date: ${format(date, 'yyyy-MM-dd hh:mm')}`);
  writeln(``);
  writeln(`status: onair`);
  writeln(``);
  writeln(`onair:`);
  for (const anime of collections) {
    const begin = anime.subject?.date
      ? new Date(anime.subject.date)
      : undefined;
    if (begin && begin.getTime() < date.getTime()) {
      continue;
    }

    if (options.create) {
      system.logger.info(
        `${lightBlue('Searching')} ${bold(
          anime.subject?.name_cn ||
            anime.subject?.name ||
            `Bangumi ${anime.subject_id}`
        )}`
      );
    }

    try {
      const item = await client.subject(anime.subject_id);

      const alias = item.infobox?.find((box) => box.key === '别名');
      const title = item.name_cn || item.name;
      const translations =
        (alias?.value.map((v) => v?.v).filter(Boolean) as string[]) ?? [];
      if (item.name && item.name !== title) {
        translations.unshift(item.name);
      }
      const plan = {
        title,
        bgmId: '' + anime.subject_id,
        translations
      };
      const fansub = await getFansub([plan.title, ...plan.translations]);

      writeln(`  - title: ${plan.title}`);
      writeln(`    translations:`);
      for (const t of plan.translations ?? []) {
        writeln(`      - '${t}'`);
      }
      writeln(`    bgmId: '${plan.bgmId}'`);
      writeln(`    fansub:`);
      if (fansub.length === 0) {
        writeln(
          `      # No fansub found, please check the translations or search keywords`
        );
      }
      for (const f of fansub) {
        writeln(`      - ${f}`);
      }
      const includeURL = JSON.stringify([[title, ...translations]])
        .replace(/\[/g, '%5B')
        .replace(/\]/g, '%5D')
        .replace(/,/g, '%2C')
        .replace(/"/g, '%22')
        .replace(/ /g, '%20');
      writeln(
        `    # https://garden.onekuma.cn/resources/1?include=${includeURL}&after=${encodeURIComponent(
          date.toISOString()
        )}`
      );
      writeln(``);

      if (fansub.length === 0 && options.create) {
        system.logger.warn(`No fansub found for ${title}`);
      }
    } catch (error) {
      system.logger.error(
        `${lightRed('Failed to search')} ${bold(
          anime.subject?.name_cn ||
            anime.subject?.name ||
            `Bangumi ${anime.subject_id}`
        )}`
      );
    }
  }

  if (options.create) {
    const p = path.join(system.space.resolvePath(options.create));
    await fs.writeFile(p, output.join('\n'), 'utf-8');
  }

  async function getCollections() {
    const list: CollectionItem[] = [];
    while (true) {
      const { data } = await client.getCollections(username, {
        subject_type: 2,
        type: 3,
        limit: 50,
        offset: list.length
      });
      if (data && data.length > 0) {
        list.push(...data);
      } else {
        break;
      }
    }
    return uniqBy(list, (c) => '' + c.subject_id);
  }

  async function getFansub(titles: string[]) {
    const { resources } = await fetchResources(ufetch, {
      search: {
        include: [titles]
      },
      count: -1,
      retry: 5
    });
    return uniqBy(
      resources.filter((r) => !!r.fansub),
      (r) => r.fansub!.name
    ).map((r) => r.fansub!.name);
  }
}

function uniqBy<T>(arr: T[], map: (el: T) => string): T[] {
  const set = new Set();
  const list: T[] = [];
  for (const item of arr) {
    const key = map(item);
    if (!set.has(key)) {
      set.add(key);
      list.push(item);
    }
  }
  return list;
}

function inferDate(now: string | undefined) {
  const date = !!now ? new Date(now) : new Date();
  const d1 = new Date(getYear(date), 1, 1, 0, 0, 0);
  const d2 = new Date(getYear(date), 4, 1, 0, 0, 0);
  const d3 = new Date(getYear(date), 7, 1, 0, 0, 0);
  const d4 = new Date(getYear(date), 10, 1, 0, 0, 0);
  const d5 = new Date(getYear(date) + 1, 1, 1, 0, 0, 0);
  if (d1.getTime() > date.getTime()) {
    return subMonths(d1, 1);
  } else if (d2.getTime() > date.getTime()) {
    return subMonths(d2, 1);
  } else if (d3.getTime() > date.getTime()) {
    return subMonths(d3, 1);
  } else if (d4.getTime() > date.getTime()) {
    return subMonths(d4, 1);
  } else {
    return subMonths(d5, 1);
  }
}
