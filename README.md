# The World on Sunday 22 November 2026

A six-panel procedural infographic summing up the world news of Sunday 22 November 2026: Russia's overnight attack on Ukraine, Hong Kong's Election Committee vote, India's record Test total in Wellington, the COP31 deadlock, Georgia's day of mourning, and Trump's push for a permanent Iran deal.

[![news-image-20261122](https://make.fun/badge/news-image-20261122.svg)](https://make.fun/bounty/news-image-20261122)
[![rank](https://make.fun/badge/news-image-20261122/Richat1801/news-image-20261122-entry/rank.svg)](https://make.fun/bounty/news-image-20261122)
[![reward](https://make.fun/badge/news-image-20261122/Richat1801/news-image-20261122-entry/reward.svg)](https://make.fun/bounty/news-image-20261122)

Competition: https://make.fun/bounty/news-image-20261122

Referral code: `dss38k9p`

## How it works

`main.ts` (Node 22, standard library only) draws the whole image from scratch — its own PNG encoder (node:zlib + CRC32), a float framebuffer, and its own 5x7 bitmap font — and writes it to `/output/entry.png`. No network, no downloaded images, fully deterministic: run it twice and the bytes are identical.

Run it the grader's way:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Output: a 1024x1024 PNG under 1 MiB.
