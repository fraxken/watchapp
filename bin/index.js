#!/usr/bin/env node
"use strict";

require("make-promises-safe");

// Require Node.js Dependencies
const { readFileSync } = require("fs");
const { relative, join, dirname, normalize } = require("path");
const { promisify } = require("util");

// Require Third-party Dependencies
const sade = require("sade");
const { white, red, yellow, cyan, green } = require("kleur");
const watch = require("node-watch");
const crossSpawn = require("cross-spawn");

// CONSTANTS
const CWD = process.cwd();
const VERSION = "0.1.0";
const TITLE = cyan().bold("watchapp");
const ROOTSYMBOLS = new Set(["*", ".", ".*", "/"]);
const EXCLUDE = ["node_modules", "coverage", ".nyc_output"];

// Vars
let cp = null;
let watcher = null;
let isClosed = false;
const sleep = promisify(setTimeout);

sade("watchapp [range]", true)
    .option("--delay, -d [value]", "FS.watcher delay", 200)
    .option("--entry, -e", "overwrite the default entry file (package.main)", null)
    .example("watchapp myapp.js -d 500")
    .version(VERSION)
    .action(main)
    .parse(process.argv);

/**
 * @function getPackageMain
 * @returns {string | null}
 */
function getPackageMain() {
    const buf = readFileSync(join(CWD, "package.json"));
    const pkg = JSON.parse(buf.toString());

    return Reflect.has(pkg, "main") ? pkg.main : null;
}

/**
 * @function filter
 * @param {!string} name file name
 * @returns {boolean}
 */
function filter(name) {
    const rel = relative(CWD, name);

    return EXCLUDE.some((value) => rel.startsWith(value)) === false;
}

/**
 * @async
 * @function startProcess
 * @param {!string} mainFile
 * @returns {Promise<void>}
 */
async function startProcess(mainFile) {
    if (cp !== null) {
        console.log(white().bold(`[${TITLE}] ${yellow().bold("restarting due to changes...")}`));
        cp.kill();
        await sleep(100);
    }

    console.log(white().bold(`[${green().bold("watchapp")}] starting \`${green().bold(`node ${mainFile}`)}\``));
    cp = crossSpawn(process.argv[0], [mainFile], { stdio: "inherit" });
    cp.once("error", () => close());
    cp.once("close", (code) => {
        if (code !== 0) {
            const str = `\n[${red().bold("watchapp")}] Node.js process has been closed with code '${yellow().bold(code)}'`;
            console.log(white().bold(str));
            close();
        }
    });
}

/**
 * @function close
 * @returns {void}
 */
function close() {
    if (isClosed) {
        return;
    }
    isClosed = true;

    if (watcher !== null) {
        watcher.close();
        watcher = null;
    }
    if (cp !== null) {
        cp.once("close", () => {
            setImmediate(() => {
                console.log(white().bold(`[${TITLE}] closing process...`));
            });
        });
        cp.kill();
        cp = null;
    }
}

/**
 * @async
 * @function main
 * @param {string} [range] range of files to watch
 * @param {object} [options] command options
 * @returns {Promise<void>}
 */
async function main(range = ".*", options) {
    const { delay, entry } = options;

    console.log(white().bold(`\n[${TITLE}] ${green().bold(VERSION)}`));
    console.log(white().bold(`[${TITLE}] watching: ${yellow().bold(range)}`));

    const mainFile = typeof entry === "string" ? entry : getPackageMain();
    if (mainFile === null) {
        console.error(red().bold("Unable to found 'main' field in your local package.json"));
        process.exit(0);
    }

    if (normalize(dirname(mainFile)) === "bin") {
        console.error(red().bold("Unable to watch a binary"));
        process.exit(0);
    }

    try {
        await startProcess(mainFile);
    }
    catch (error) {
        console.log(yellow().bold(`Failed to start process on file ${cyan().bold(mainFile)}`));
        console.error(red().bold(error.message));
        close();
    }

    const relName = relative(CWD, range);
    const dirToWatch = ROOTSYMBOLS.has(relName) ? process.cwd() : relName;
    watcher = watch(dirToWatch, { recursive: true, delay, filter }, async() => {
        try {
            await startProcess(mainFile);
        }
        catch (error) {
            console.error(red().bold(error.message));
            close();
        }
    });

    process.on("SIGINT", close);
}
