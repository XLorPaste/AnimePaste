# AnimeSpace Core Package

It provides internal abstraction for [AnimeSpace](https://github.com/yjl9903/AnimeSpace).

## Usage

### Plugin Development

```ts
import { type Plugin, type PluginEntry } from '@animespace/core';

export interface CustomPluginOptions extends PluginEntry {}

export function CustomPlugin(options: CustomPluginOptions): Plugin {
  return {
    name: 'CustomPlugin'
  };
}
```

## License

AGPL-3.0 License © 2023 [XLor](https://github.com/yjl9903)
