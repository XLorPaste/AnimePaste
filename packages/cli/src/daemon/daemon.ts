import path from 'node:path';
import { bold, dim, link } from 'kolorist';
import { format, subMonths } from 'date-fns';

import type { Store, VideoInfo } from '../io';
import type { OnairPlan, EpisodeList } from '../types';

import { context } from '../context';
import { MAX_RETRY } from '../constant';
import { formatEP, formatEpisodeName } from '../utils';
import {
  logger,
  IndexListener,
  titleColor,
  startColor,
  okColor
} from '../logger';
import { OnairEpisode, AdminClient } from '../client';
import { TorrentClient, useStore, checkVideo } from '../io';
import { Anime, Episode, daemonSearch, bangumiLink } from '../anime';

import { Plan } from './plan';
import { debug } from './constant';

export class Daemon {
  private plan!: Plan;
  private store!: Store;
  private client!: AdminClient;

  /**
   * Enable donwload and upload
   *
   * @default 'true'
   */
  private readonly enable: boolean;

  constructor(option: { update: boolean }) {
    this.enable = !option.update;
    context.isDaemon = true;
  }

  async init() {
    try {
      logger.info('Start initing daemon ' + now());

      await this.refreshPlan();
      await this.refreshDatabase();
      await this.refreshEpisode();
      await this.refreshStore();

      logger.empty();
      logger.info(okColor('Init daemon OK ') + now());
    } catch (error: any) {
      if ('message' in error) {
        logger.error(error.message);
      }
      debug(error);
    }
  }

  async update() {
    try {
      logger.info('Start updating anime ' + now());

      await context.init({ force: false });
      await this.refreshPlan();
      await this.refreshDatabase();
      await this.refreshEpisode();
      await this.refreshStore();

      logger.empty();
      logger.info(okColor('Update OK ') + now());
    } catch (error: any) {
      if ('message' in error) {
        logger.error(error.message);
      }
      debug(error);
    }
  }

  private async refreshPlan() {
    this.plan = await Plan.create();
    logger.empty();
    this.plan.printOnair();
  }

  private async refreshDatabase() {
    logger.empty();
    await context.magnetStore.index({
      limit: subMonths(
        new Date(Math.min(...[...this.plan].map((p) => p.date.getTime()))),
        1
      ),
      earlyStop: !context.cliOption.force,
      listener: IndexListener
    });
  }

  private async refreshEpisode() {
    let count = 0;

    for (const plan of this.plan) {
      for (const onair of plan.onair) {
        // Skip finished plan
        if (plan.state === 'finish' && (await context.getAnime(onair.bgmId))) {
          continue;
        }
        // Continue outside onair anime
        if (onair.link && typeof onair.link === 'string') {
          continue;
        }

        const keywords = Array.isArray(onair.keywords)
          ? onair.keywords
          : typeof onair.keywords === 'string'
          ? [onair.keywords]
          : undefined;

        await daemonSearch(onair.bgmId, keywords, {
          type: 'tv',
          title: onair.title
        });

        const anime = await context.getAnime(onair.bgmId);

        if (anime) {
          logger.info(
            okColor('Refresh  ') +
              formatTitle(onair.title, onair.season) +
              okColor(' OK ') +
              `(${bangumiLink(onair.bgmId)})`
          );
          count++;
        } else {
          throw new Error(
            `Fail to init ${onair.title} (${bangumiLink(onair.bgmId)})`
          );
        }
      }
    }

    logger.info(
      `${okColor('Refresh  ')}${count} onair animes ${okColor('OK')}`
    );
  }

  private async refreshStore() {
    this.store = await useStore('ali')();
    this.client = await AdminClient.create(
      new Set(new Set(this.plan.onairs().map((o) => o.bgmId)))
    );
    await this.client.fetchOnair();

    for (const plan of this.plan) {
      for (const onair of plan.onair) {
        // Sync online play bangumis
        if (onair.link && typeof onair.link === 'string') {
          this.client.updateOnair({
            title: onair.title,
            bgmId: onair.bgmId,
            episodes: [],
            link: onair.link
          });
          continue;
        }
        // Skip finish plan and anime is onairing
        if (
          plan.state === 'finish' &&
          this.client.onair.find((o) => o.bgmId === onair.bgmId)
        ) {
          continue;
        }

        const anime = await context.getAnime(onair.bgmId);
        if (!anime) {
          logger.error(
            `Fail to get ${onair.title} (${bangumiLink(onair.bgmId)})`
          );
          continue;
        }

        logger.empty();

        await this.refreshAnime(anime, onair);
        await this.syncPlaylist(onair);
      }
    }

    await this.syncPlaylist();
  }

  private async refreshAnime(anime: Anime, onair: OnairPlan) {
    const epLink =
      onair.link && typeof onair.link !== 'string'
        ? resolveEP(onair.link)
        : new Map<number, string>();

    const givenMagnet = onair.magnet
      ? resolveEP(onair.magnet)
      : new Map<number, string>();
    const epMagnet = (
      await Promise.all(
        [...givenMagnet.entries()].map(async ([ep, magnet]) => {
          const m = await context.magnetStore.findById(magnet);
          if (!!m) {
            const parsedEP = anime.parseEpisode(m);
            parsedEP && (parsedEP.ep = ep);
            return parsedEP;
          }
        })
      )
    ).filter(Boolean) as Episode[];

    const episodes = anime
      .genEpisodes(onair.fansub ?? [])
      .filter((ep) => !givenMagnet.has(ep.ep))
      .concat(epMagnet)
      .filter((ep) => !epLink.has(ep.ep));

    logger.info(
      startColor('Download ') +
        formatTitle(onair.title, onair.season) +
        '    ' +
        `(${bangumiLink(onair.bgmId)})`
    );
    for (const ep of episodes) {
      logger.tab.info(
        `${dim(formatEP(ep.ep))} ${
          ep.magnetName
            ? link(ep.magnetName, context.magnetStore.idToLink(ep.magnetId))
            : context.magnetStore.idToLink(ep.magnetId)
        }`
      );
    }

    // If not enable donwload and upload, continue
    if (!this.enable) return;

    const localRoot = await context.makeLocalAnimeRoot(onair.title);

    type InlineMagnet = {
      magnetId: string;
      magnetURI: string;
      filename: string;
    };

    const serverOnair = this.client.onair.find((o) => o.bgmId === onair.bgmId);
    const getServerMagnet = (magnet: InlineMagnet) => {
      if (serverOnair) {
        for (const ep of serverOnair.episodes) {
          if (
            'storage' in ep &&
            ep.storage &&
            ep.storage.type &&
            ep.storage.videoId &&
            ep.storage.source
          ) {
            const source = ep.storage.source;
            if (source.magnetId === magnet.magnetId) {
              return ep;
            }
          }
        }
        return undefined;
      } else {
        return undefined;
      }
    };

    const magnets: InlineMagnet[] = (
      await Promise.all(
        episodes.map(async (ep) => {
          const magnet = await context.magnetStore.findById(ep.magnetId);
          if (!magnet) {
            logger.error(
              `Can not find magnet (ID: ${link(
                ep.magnetId,
                context.magnetStore.idToLink(ep.magnetId)
              )})`
            );
          }
          return {
            magnetId: ep.magnetId,
            magnetURI: magnet?.magnet ?? '',
            filename: formatEpisodeName(onair, ep)
          };
        })
      )
    ).filter((m) => Boolean(m.magnetURI));

    // Start downloading
    {
      const shouldDownloadMagnet = magnets.filter((m) => !getServerMagnet(m));
      if (shouldDownloadMagnet.length > 0) {
        const torrent = new TorrentClient(localRoot);
        await torrent.download(shouldDownloadMagnet);
        await torrent.destroy();

        // Format check (avoid HEVC / MKV)
        for (const { filename } of shouldDownloadMagnet) {
          if (!(await checkVideo(path.join(localRoot, filename)))) {
            logger.error(`The format of ${filename} may be wrong`);
          }
        }
      }
      logger.info(
        okColor('Download ') +
          formatTitle(onair.title, onair.season) +
          okColor(' OK ') +
          `(Total: ${magnets.length} episodes)`
      );
    }
    // Download OK

    // Start uploading
    const videoInfos: VideoInfo[] = [];
    {
      logger.info(
        startColor('Upload   ') +
          formatTitle(onair.title, onair.season) +
          '    ' +
          `(${bangumiLink(onair.bgmId)})`
      );
      for (const magnet of magnets) {
        const serverMagnet = getServerMagnet(magnet);
        if (serverMagnet) {
          debug(`${magnet.filename} has been uploaded`);
          debug(serverMagnet);
          const foundVideo = await context.videoStore.findVideo(
            serverMagnet.storage.type!,
            serverMagnet.storage.videoId!
          );
          if (foundVideo) {
            videoInfos.push(foundVideo);
            continue;
          }
        } else {
          debug(`Can not find ${magnet.filename}, and try upload`);
        }

        // Do upload
        {
          const { filename, magnetId } = magnet;
          const resp = await this.store.upload(path.join(localRoot, filename), {
            magnetId,
            retry: MAX_RETRY
          });
          if (resp && resp.playUrl.length > 0) {
            // Fix missing magnetId
            if (!resp.source.magnetId) {
              resp.source.magnetId = magnetId;
              await context.videoStore.updateVideo(resp);
            }
            videoInfos.push(resp);
          } else {
            logger.error(`Fail uploading ${filename}`);
          }
        }
      }
      logger.info(
        okColor('Upload   ') +
          formatTitle(onair.title, onair.season) +
          okColor(' OK ') +
          `(Total: ${magnets.length} episodes)`
      );
    }
    // Upload OK

    const syncEpisodes: OnairEpisode[] = episodes.map((ep, idx) => ({
      ep: ep.ep,
      quality: ep.quality,
      creationTime: ep.creationTime,
      playURL: videoInfos[idx].playUrl[0],
      storage: {
        type: videoInfos[idx].platform,
        videoId: videoInfos[idx].videoId,
        source: videoInfos[idx].source
      }
    }));

    this.client.updateOnair({
      title: onair.title,
      bgmId: onair.bgmId,
      episodes: [
        ...syncEpisodes,
        ...[...epLink.entries()].map(([ep, playURL]) => ({
          ep: +ep,
          playURL
        }))
      ].sort((a, b) => a.ep - b.ep)
    });
  }

  private async syncPlaylist(onair?: OnairPlan) {
    if (!onair) {
      logger.info(
        `${startColor('Sync')}     ${bold(
          this.client.newOnair.length
        )}  local onair animes`
      );
    } else {
      logger.info(
        `${startColor('Sync')}     ` +
          formatTitle(onair.title, onair.season) +
          '    ' +
          `(${bangumiLink(onair.bgmId)})`
      );
    }

    try {
      const onairs = await this.client.syncOnair();
      if (!onair) {
        logger.info(
          `${okColor('Sync')}     ${bold(
            onairs.length
          )} remote onair animes ${okColor('OK')}`
        );
      } else {
        for (const remoteOnair of onairs) {
          if (onair.bgmId !== remoteOnair.bgmId) continue;
          logger.info(
            okColor('Sync     ') +
              formatTitle(onair.title, onair.season) +
              okColor(' OK ') +
              `(Total: ${bold(remoteOnair.episodes.length)} episodes)`
          );
          for (const ep of remoteOnair.episodes) {
            logger.tab.info(`${dim(formatEP(ep.ep))} ${ep.playURL}`);
          }
        }
      }
    } catch {
      logger.error(`Fail connecting server`);
    }
  }
}

function resolveEP(eps: EpisodeList) {
  if (Array.isArray(eps)) {
    return new Map(eps.map((t, idx) => [idx + 1, t]));
  } else {
    const map = new Map<number, string>();
    for (const [idx, ep] of Object.entries(eps)) {
      map.set(+idx, ep);
    }
    return map;
  }
}

function formatTitle(title: string, season: number) {
  return titleColor(title + (season > 1 ? ` Season ${season}` : ''));
}

function now() {
  return `(${format(new Date(), 'yyyy-MM-dd HH:mm')})`;
}
