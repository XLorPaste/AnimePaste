import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { makeSystem } from '../src';

const __dirname = path.join(fileURLToPath(import.meta.url), '../');

describe('system', () => {
  it('should load', async () => {
    const root = path.join(__dirname, '../../core/test/fixtures/space');
    const system = await makeSystem(root);
    expect(await system.plans()).toEqual([
      {
        date: new Date('2023-04-01T13:00:00.000Z'),
        name: '2023-04-04 新番放送计划',
        onair: [
          {
            bgm: '323651',
            date: new Date('2023-04-01T13:00:00.000Z'),
            fansub: ['Lilith-Raws', 'ANi'],
            keywords: {
              exclude: [],
              include: [['熊熊勇闯异世界 Punch!']]
            },
            season: 2,
            status: 'onair',
            title: '熊熊勇闯异世界 Punch!',
            alias: [],
            translations: {},
            type: '番剧'
          },
          {
            bgm: '404804',
            date: new Date('2023-04-01T13:00:00.000Z'),
            fansub: ['SweetSub'],
            keywords: {
              exclude: [],
              include: [['天国大魔境', 'Tengoku Daimakyou']]
            },
            status: 'onair',
            title: '天国大魔境',
            alias: [],
            translations: {
              unknown: ['Tengoku Daimakyou']
            },
            type: '番剧'
          },
          {
            bgm: '376703',
            date: new Date('2023-04-01T13:00:00.000Z'),
            fansub: ['喵萌奶茶屋'],
            keywords: {
              exclude: ['闪耀色彩'],
              include: [
                ['偶像大师 灰姑娘女孩 U149'],
                ['偶像大师', 'iDOLM@STER'],
                ['灰姑娘女孩'],
                ['U149']
              ]
            },
            status: 'onair',
            title: '偶像大师 灰姑娘女孩 U149',
            alias: [],
            translations: {},
            type: '番剧'
          }
        ],
        status: 'onair'
      }
    ]);
  });
});
