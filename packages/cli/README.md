# :tv: AnimeSpace

<p align="center">「 你所热爱的就是你的动画 」</p>

[![version](https://img.shields.io/npm/v/animespace?label=AnimeSpace)](https://www.npmjs.com/package/animespace)
[![CI](https://github.com/yjl9903/AnimeSpace/actions/workflows/ci.yml/badge.svg)](https://github.com/yjl9903/AnimeSpace/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/AnimeSpace-Demo-brightgreen)](https://anime.docs.xlorpaste.cn/)
[![License](https://img.shields.io/github/license/yjl9903/AnimeSpace)](./LICENSE)

Paste your favourite anime online.

AnimeSpace is yet another complete **solution** for **automatically following bangumis**.

All the bangumi resources are automatically collected and downloaded from [動漫花園](https://share.dmhy.org/). **Sincere thanks to [動漫花園](https://share.dmhy.org/) and all the fansubs.**

+ 📖 [中文文档](https://anime.docs.xlorpaste.cn/)
+ 📚 [部署博客](https://blog.onekuma.cn/alidriver-alist-rclone-animepaste)

## Features

+ :gear: **Automatically** collect, download and organize anime resources
+ :construction_worker_man: **Scrape anime metadata** from [Bangumi 番组计划](https://bangumi.tv/) and generate NFO file (WIP)
+ :film_strip: **Support any media server** including [Infuse](https://firecore.com/infuse), [Plex](https://www.plex.tv/), [Jellyfin](https://github.com/jellyfin/jellyfin), [Kodi](https://kodi.tv/) and so on...

![Jellyfin](./docs/public/Jellyfin.jpeg)

## Installation and Deploy

> **Prerequisite**
>
> Install latest [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/) globally.

See [部署 | AnimeSpace](https://anime.docs.xlorpaste.cn/deploy/) and [安装 CLI | AnimeSpace](https://anime.docs.xlorpaste.cn/admin/).

## Usage

### Prepare anime plan

It supports to scrape the following list from [Bangumi 番组计划](https://bangumi.tv/).

First, ensure that you can config the Bangumi ID in your `anime.yaml`.

```yaml
plugins:
  # ...
  - name: bangumi
    username: '603937' # <- You Bangumi ID
```

Second, just the following simple command.

```bash
anime bangumi generate --fansub --create "<plan filename>.yaml"
```

See [放映计划 | AnimeSpace](https://anime.docs.xlorpaste.cn/admin/plan.html) to get more details.

### Download anime resources

Just run the following simple command.

```bash
anime refresh
```

## Credits

+ **[動漫花園](https://share.dmhy.org/) and all the fansubs**
+ [Bangumi 番组计划](https://bangumi.tv/) provides a platform for sharing anything about ACG
+ [Bangumi Data](https://github.com/bangumi-data/bangumi-data) collects the infomation of animes
+ [aria2](能干猫今天也忧郁) and [WebTorrent](https://webtorrent.io/) provide the ability to download magnet links
+ [Anime Tracker List](https://github.com/DeSireFire/animeTrackerList) collects trackers for downloading bangumi resources

## License

AGPL-3.0 License © 2023 [XLor](https://github.com/yjl9903)
