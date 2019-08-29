# Watch my app

![ver](https://img.shields.io/badge/dynamic/json.svg?url=https://raw.githubusercontent.com/fraxken/watchapp/master/package.json&query=$.version&label=Version)
![MIT](https://img.shields.io/github/license/mashape/apistatus.svg)

Watch and restart your Node.js application.

<p align="center">
    <img src="https://hostpic.xyz/files/15669741112002204892.png">
</p>

## Why

- Light and fast alternative to nodemon.
- Keep the number of dependencies low.
- Focus on Node.js support only.

## Getting Started
This package is available in the Node Package Repository and can be easily installed with [npm](https://docs.npmjs.com/getting-started/what-is-npm) or [yarn](https://yarnpkg.com).

```bash
$ npm install watch-my-app -g
# or
$ npx watch-my-app
```

## Usage example
When installed globally the `watchapp` executable will be exposed in your terminal

```bash
$ cd myApplication
$ watchapp
```

By default watchapp will read your local **package.json** and search for the `main` field. It's possible to overwrite this behavior by using the `--entry` / `-e` option.

```bash
$ watchapp -e ./server.js
```

For more options just run with `--help`
```bash
$ watchapp --help
```

## License
MIT
