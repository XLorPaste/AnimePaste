import '@animespace/core';

declare module '@animespace/core' {
  interface AnimePlan {
    fansub: string[];
  }

  interface LocalVideoSource {
    magnet: string;
  }
}
