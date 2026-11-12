# FNF Play

A small, static browser launcher for Friday Night Funkin' web builds. It gives you one place to open the official hosted vanilla web demo or import your own compatible HTML mod builds as ZIP files or folders.

> FNF Play is a launcher, not a replacement for the FNF engine. Each imported mod must already be a browser-ready HTML build.

## Features

- Official vanilla web-demo shortcut with source and attribution links.
- Import a mod as a `.zip` archive or a local folder using the browser file picker.
- Automatic HTML entry-point discovery for `index.html`, `game.html`, or `main.html`.
- Relative asset rewriting for common HTML, CSS, image, audio, and video paths.
- Local library metadata with launch, rename, replace, and remove actions.
- Isolated game player with reload, mute, fullscreen, exit, and open-in-new-tab controls.
- No backend, account, analytics code, or third-party runtime dependency.

## Local development

Requires Node.js 18 or newer.

```bash
npm run dev
# open http://localhost:3000
```

The app is intentionally dependency-free. A production-style static copy can be generated with:

```bash
npm run build
```

The generated `dist/` folder can be deployed to GitHub Pages, Netlify, Cloudflare Pages, or any static host. For GitHub Pages, configure the workflow or Pages source to publish `dist/` after the build step, or publish the repository root directly for a no-build deployment.

The included `.github/workflows/pages.yml` publishes the repository automatically when `main` changes. It builds the dependency-free site and uploads `dist/` to GitHub Pages. The app uses relative asset paths so it also works when GitHub Pages serves it below the repository name.

## Import compatibility

The launcher can inspect and rewrite common relative references, but it cannot turn a desktop mod into a web mod. A compatible package should include an HTML entry file and browser-compatible JavaScript. If a mod relies on desktop filesystem APIs, native binaries, a custom server, cross-origin requests, or engine behavior that cannot run in a sandboxed iframe, use the mod's own web build or open it directly instead.

Imported files are held in memory for the current tab. Only library labels and metadata are persisted in `localStorage`; after a full refresh, re-import the files when prompted by the library card.

Mute is cooperative for embedded content: the launcher sends a `FNF_PLAY_MUTE` or `FNF_PLAY_UNMUTE` message to the selected build. A mod can support those messages to expose a true in-game mute; cross-origin pages that do not opt in may need their own audio controls.

## Vanilla build and third-party rights

The vanilla card opens the official hosted web demo from the FNF creators. This repository does **not** copy the game's art, music, fonts, or other restricted assets. The official FNF repository states that its source code is Apache-2.0 while its assets have separate rights, so the launcher keeps the official build at its canonical destination and preserves links to the official source, modding documentation, and playable page.

- Official source: <https://github.com/FunkinCrew/Funkin>
- Official browser demo: <https://ninja-muffin24.itch.io/funkin>
- Official modding docs: <https://funkincrew.github.io/funkin-modding-docs/>
- Official license: <https://github.com/FunkinCrew/Funkin/blob/main/LICENSE.md>

Friday Night Funkin', its logo, and related assets are trademarks and copyrighted works of their respective owners. FNF Play is an independent launcher and is not affiliated with The Funkin' Crew, Inc.

## License

The launcher source code in this repository is available under the MIT License. See `LICENSE` for the full text. Third-party mod files remain owned and licensed by their respective creators.
