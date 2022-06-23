import * as fs from 'fs-extra';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { load, dump } from 'js-yaml';

import type { LocalVideoInfo } from '../types';

import { Anime, MagnetInfo } from '../anime';

import { LogContext } from './log';

const DefaultGlobalConfig: GlobalConfig = {
  plan: [],
  store: {
    local: {
      path: './anime'
    },
    ali: {
      accessKeyId: '',
      accessKeySecret: '',
      endpoint: ''
    }
  }
};

export class GlobalContex {
  static ConfigFileName = 'config.yaml';
  static AnimeDdName = 'anime.json';

  readonly root: string;
  readonly anime: string;
  readonly config: string;
  readonly cacheRoot: string;

  readonly storeLog: LogContext<LocalVideoInfo>;
  readonly magnetLog: LogContext<MagnetInfo>;

  private _localRoot: string;
  private configCache: any;
  private animeCache: Map<string, Anime> = new Map();

  constructor() {
    this.root = path.join(homedir(), '.animepaste');
    this.cacheRoot = path.join(this.root, 'cache');
    this._localRoot = path.join(this.root, 'anime');

    this.anime = path.join(this.root, GlobalContex.AnimeDdName);
    this.config = path.join(this.root, GlobalContex.ConfigFileName);

    this.storeLog = new LogContext(this, 'store.json');
    this.magnetLog = new LogContext(this, 'magnet.json');
  }

  async init() {
    await fs.ensureDir(this.root);
    await fs.ensureDir(path.join(this.root, 'anime'));
    await fs.ensureDir(path.join(this.root, 'cache'));
    if (!(await fs.pathExists(this.config))) {
      fs.writeFile(
        this.config,
        dump(DefaultGlobalConfig, { indent: 2 }).replace('store', '\nstore'),
        'utf-8'
      );
    }

    const local = await this.getStoreConfig<{ path: string }>('local');
    if (local?.path) {
      this._localRoot = path.resolve(this.root, local.path);
    }
    if (!fs.existsSync(this._localRoot)) {
      throw new Error(`Local stroage root "${this._localRoot}" does not exist`);
    }

    if (fs.existsSync(this.anime)) {
      const animes = JSON.parse(
        await fs.readFile(this.anime, 'utf-8')
      ) as Anime[];
      this.animeCache.clear();
      for (const anime of animes) {
        this.animeCache.set(anime.bgmId, Anime.copy(anime));
      }
    }
  }

  get localRoot() {
    return this._localRoot;
  }

  async loadConfig<T = any>(): Promise<T> {
    const content = await fs.readFile(this.config, 'utf-8');
    this.configCache = load(content);
    return this.configCache;
  }

  async getStoreConfig<T = any>(key: string): Promise<T> {
    return (await this.loadConfig()).store[key];
  }

  // -----------
  /**
   * Anime
   */
  async getAnime(bgmId: string): Promise<Anime | undefined> {
    return this.animeCache.get(bgmId);
  }

  async updateAnime(anime: Anime) {
    this.animeCache.set(anime.bgmId, anime);
    const content = [...this.animeCache.values()];
    await fs.writeFile(this.anime, JSON.stringify(content, null, 2), 'utf-8');
  }
  // -----------

  /**
   * Copy file from "src" to "root/dst/basename(src)"
   *
   * @param src
   * @param dst
   */
  async copy(src: string, dst: 'cache' | 'anime') {
    const filepath = path.join(this.root, dst, path.basename(src));
    await fs.copy(src, filepath);
    return filepath;
  }
}

export interface GlobalConfig {
  plan: [];

  store: {};
}

export const context = new GlobalContex();
