import type { GlobalContex } from '../../context';

import path from 'node:path';

import OSS from 'ali-oss';
import RPCClient from '@alicloud/pop-core';

import { debug as createDebug } from 'debug';
import { lightGreen } from 'kolorist';
import { SingleBar, Presets } from 'cli-progress';

import { b64decode } from '../utils';
import { CreateStore, Payload, Store, VideoInfo } from './types';

const debug = createDebug('anime:ali');

export class AliStore extends Store {
  private readonly accessKeyId: string;
  private readonly accessKeySecret: string;
  private readonly regionId: string;

  private readonly vodClient: RPCClient;

  constructor(context: GlobalContex, config: AliStoreConfig) {
    super(context, 'ali');

    this.accessKeyId = config.accessKeyId;
    this.accessKeySecret = config.accessKeySecret;
    this.regionId = config.regionId;

    this.vodClient = new RPCClient({
      accessKeyId: this.accessKeyId,
      accessKeySecret: this.accessKeySecret,
      endpoint: 'http://vod.' + this.regionId + '.aliyuncs.com',
      apiVersion: '2017-03-21'
    });
  }

  private async createUplodaVideo(
    title: string,
    file: string
  ): Promise<UploadResponse | undefined> {
    try {
      const res = (await this.vodClient.request('CreateUploadVideo', {
        Title: title,
        FileName: file
      })) as any;
      res.UploadAuth = JSON.parse(b64decode(res.UploadAuth));
      res.UploadAddress = JSON.parse(b64decode(res.UploadAddress));
      return res as UploadResponse;
    } catch (error) {
      debug(error);
      return undefined;
    }
  }

  async doUpload(payload: Payload): Promise<string | undefined> {
    const resp = await this.createUplodaVideo(payload.title, payload.filepath);
    if (!resp) {
      throw new Error('Fail creating upload video');
    }
    debug(resp);

    const store = new OSS({
      endpoint: resp.UploadAddress.Endpoint,
      bucket: resp.UploadAddress.Bucket,
      accessKeyId: resp.UploadAuth.AccessKeyId,
      accessKeySecret: resp.UploadAuth.AccessKeySecret,
      stsToken: resp.UploadAuth.SecurityToken,
      async refreshSTSToken() {
        // TODO: fetch refreshSTSToken
        return {
          accessKeyId: resp.UploadAuth.AccessKeyId,
          accessKeySecret: resp.UploadAuth.AccessKeySecret,
          stsToken: resp.UploadAuth.SecurityToken
        };
      },
      refreshSTSTokenInterval: 60 * 60 * 1000
    });

    console.log(`  Upload: ${lightGreen(path.basename(payload.filepath))}`);
    const bar = new SingleBar(
      {
        format: '  {bar} {percentage}% | ETA: {eta}s'
      },
      Presets.shades_grey
    );

    try {
      bar.start(1, 0);
      const ossRes = await store.multipartUpload(
        resp.UploadAddress.FileName,
        payload.filepath,
        {
          progress(p: number) {
            bar.update(p);
          }
        }
      );
      debug(ossRes);
      return resp.VideoId;
    } catch (error) {
      debug(error);
      await this.doDelete(resp.VideoId);
      return undefined;
    } finally {
      bar.stop();
    }
  }

  async doDelete(videoId: string) {
    try {
      await this.vodClient.request('DeleteVideo', { VideoIds: videoId }, {});
      return true;
    } catch {
      return false;
    }
  }

  async fetchVideoInfo(videoId: string): Promise<VideoInfo | undefined> {
    try {
      const [resp, play] = await Promise.all([
        this.vodClient.request(
          'GetVideoInfo',
          {
            VideoId: videoId
          },
          {}
        ) as Promise<any>,
        this.vodClient.request(
          'GetPlayInfo',
          {
            VideoId: videoId
          },
          {}
        ) as Promise<any>
      ]);
      debug(resp, play);
      return {
        store: 'ali',
        videoId,
        title: resp.Video.Title,
        cover: resp.Video.CoverURL,
        creationTime: resp.Video.CreationTime,
        playUrl: (play?.PlayInfoList?.PlayInfo ?? [])
          .map((p: any) => p?.PlayURL)
          .filter(Boolean)
      };
    } catch (error) {
      debug(error);
      return undefined;
    }
  }
}

export const createAliStore: CreateStore = async (ctx) => {
  const config = await ctx.getStoreConfig<AliStoreConfig>('ali');
  return new AliStore(ctx, config);
};

export interface AliStoreConfig {
  accessKeyId: string;
  accessKeySecret: string;
  regionId: string;
}

interface UploadResponse {
  VideoId: string;
  RequestId: string;
  UploadAddress: {
    Endpoint: string;
    Bucket: string;
    FileName: string;
  };
  UploadAuth: {
    SecurityToken: string;
    AccessKeyId: string;
    AccessKeySecret: string;
    Region: string;
    Expiration: string;
    ExpireUTCTime: string;
  };
}

interface Checkpoint {
  file: string;
  name: string;
  fileSize: number;
  partSize: number;
  uploadId: string;
  doneParts: {
    number: number;
    etag: string;
  };
}
