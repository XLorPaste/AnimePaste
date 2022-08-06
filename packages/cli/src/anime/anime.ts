import { debug as createDebug } from 'debug';

import type { Resource } from '@animepaste/database';

import type { CustomBangumi } from '../types';

import { groupBy } from '../utils';
import { context } from '../context';

const LOCALE = 'zh-Hans';

const debug = createDebug('anime:anime');

export class Anime {
  readonly title: string = '';

  readonly bgmId: string = '';

  readonly date: Date = new Date();

  readonly episodes: Episode[] = [];

  constructor(option: {
    title: string;
    bgmId: string;
    date: Date;
    episodes?: Episode[];
  }) {
    this.title = option.title;
    this.bgmId = option.bgmId;
    this.date = option.date;
    if (option.episodes) {
      this.episodes = option.episodes;
    }
  }

  static empty(title: string, bgmId: string) {
    return new Anime({
      title,
      bgmId,
      date: new Date()
    });
  }

  static bangumi(item: CustomBangumi) {
    return new Anime({
      title: item.titleCN,
      date: new Date(item.begin),
      bgmId: item.bgmId
    });
  }

  static copy(anime: Anime) {
    return new Anime({
      title: anime.title,
      bgmId: anime.bgmId,
      date: new Date(anime.date),
      episodes: anime.episodes
    });
  }

  addSearchResult(results: Resource[]) {
    if (context.cliOption.force) {
      this.episodes.splice(0);
    }

    const foundIds = new Set(this.episodes.map((ep) => ep.magnetId));

    for (const result of results) {
      if (foundIds.has(result.id)) continue;

      const ep = this.parseEpisode(result);

      if (ep && ep.ep > 0) {
        this.episodes.push(ep);
      } else {
        debug(`Parse Error: ${result.title}`);
      }
    }
  }

  parseEpisode(result: Resource) {
    // Disable download MKV
    if (result.title.indexOf('MKV') !== -1) return undefined;
    // Disable download HEVC
    if (result.title.indexOf('HEVC') !== -1) return undefined;

    const parsed = context.magnetStore.parser.parse(result.title);
    debug(result.title + ' => ' + JSON.stringify(parsed, null, 2));

    const ep: Episode = {
      ep: parsed.ep ?? 0,
      quality: context.magnetStore.parser.quality(parsed),
      language: context.magnetStore.parser.language(parsed),
      creationTime: result.createdAt.toISOString(),
      fansub: result.fansub,
      magnetId: result.id,
      magnetName: result.title,
      bgmId: this.bgmId
    };

    return ep;
  }

  genEpisodes(fansubOrder: string[]) {
    const fansubs = groupBy(this.episodes, (ep) => ep.fansub);
    const episodes: Episode[] = [];
    for (let epId = 1, found = true; found; epId++) {
      found = false;
      for (const fs of fansubOrder) {
        const eps = fansubs.getOrDefault(fs, []).filter((ep) => ep.ep === epId);
        if (eps.length === 1) {
          found = true;
          episodes.push(eps[0]);
        } else if (eps.length > 1) {
          eps.sort((a, b) => {
            if (a.quality !== b.quality) {
              return b.quality - a.quality;
            }
            const gL = (a: Episode) => (a.language === LOCALE ? 1 : 0);
            const dL = gL(b) - gL(a);
            if (dL !== 0) return dL;
            return (
              new Date(b.creationTime).getTime() -
              new Date(a.creationTime).getTime()
            );
          });
          found = true;
          episodes.push(eps[0]);
        }
        if (found) break;
      }
    }
    return episodes;
  }
}

export interface Episode {
  /**
   * 条目内的集数, 从 1 开始
   */
  ep: number;

  /**
   * fansub
   */
  fansub: string;

  /**
   * Video qulity
   */
  quality: 1080 | 720;

  /**
   * 简体和繁体
   */
  language: 'zh-Hans' | 'zh-Hant';

  /**
   * airdate
   */
  creationTime: string;

  /**
   * Link to magnet
   */
  magnetId: string;

  magnetName: string;

  /**
   * Link to the parent Anime
   */
  bgmId: string;
}
