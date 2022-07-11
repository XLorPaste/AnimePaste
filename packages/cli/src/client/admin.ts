import axios, { AxiosInstance } from 'axios';
import { debug as createDebug } from 'debug';

import { proxy } from '@animepaste/database';

import type { OnairAnime, UserOption } from './types';

const debug = createDebug('anime:client');

export class AdminClient {
  private static MAX_RETRY = 5;

  private readonly token: string;
  private readonly api: AxiosInstance;

  readonly onairIds: Set<string> | undefined;
  readonly onair: OnairAnime[] = [];
  readonly newOnair: OnairAnime[] = [];

  constructor(option: UserOption) {
    this.token = option.token;
    this.api = axios.create({
      baseURL: option.baseURL,
      headers: {
        Authorization: this.token
      }
    });
    this.onairIds = option.onairIds;
  }

  async fetchOnair() {
    for (let retry = 0; retry < AdminClient.MAX_RETRY; retry++) {
      try {
        const { data } = await this.api.get(
          '/admin/anime',
          retry ? {} : { proxy: proxy() }
        );
        if (data.status !== 'Ok') throw new Error('Unknown error');
        const onair = data.data.onair as OnairAnime[];
        this.onair.splice(0, this.onair.length, ...onair);
        this.newOnair.splice(0, this.newOnair.length);
        return onair;
      } catch (error) {
        debug(error);
      }
    }
    throw new Error('Fail fetching onair animes');
  }

  async syncOnair(): Promise<OnairAnime[]> {
    const onair = uniqBy<OnairAnime>((o) =>
      !this.onairIds || this.onairIds.has(o.bgmId) ? o.bgmId : undefined
    )(this.newOnair, this.onair);
    if (this.onair.length === onair.length) {
      const trans = (o: OnairAnime) =>
        `${o.bgmId}:${JSON.stringify(o.episodes.map((ep) => ep.playURL))}`;
      const newIds = onair.map(trans).sort();
      const oldIds = this.onair.map(trans).sort();
      if (newIds.every((t, idx) => t === oldIds[idx])) {
        return this.onair;
      }
    }

    for (let retry = 0; retry < AdminClient.MAX_RETRY; retry++) {
      try {
        const { data } = await this.api.post(
          '/admin/anime',
          {
            onair
          },
          retry ? {} : { proxy: proxy() }
        );
        if (data.status !== 'Ok') throw new Error('Unknown error');
        return data.data.onair;
      } catch (error) {
        debug(error);
      }
    }
    throw new Error('Fail syncing onair animes');
  }

  updateOnair(onair: OnairAnime) {
    const idx = this.onair.findIndex((o) => o.bgmId === onair.bgmId);
    if (idx === -1) {
      this.newOnair.push(onair);
    } else {
      this.onair[idx] = onair;
      this.newOnair.push(onair);
    }
  }
}

function uniqBy<T>(
  fn: (item: T) => string | undefined
): (...args: T[][]) => T[] {
  return (...arrs) => {
    const set = new Set<string>();
    const ans: T[] = [];
    for (const arr of arrs) {
      for (const item of arr) {
        const key = fn(item);
        if (key && !set.has(key)) {
          set.add(key);
          ans.push(item);
        }
      }
    }
    return ans;
  };
}
