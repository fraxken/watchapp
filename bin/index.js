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
const isGlob = require("is-glob");

// CONSTANTS
const CWD = process.cwd();
const VERSION = "1.2.0";
const TITLE = cyan().bold("watchapp");
const EXCLUDE = ["node_modules", "coverage", ".nyc_output"];

// Vars
let cp = null;
let watcher = null;
let isClosed = false;
const sleep = promisify(setTimeout);

sade("watchapp [range]", true)
    .option("--delay, -d [value]", "FS.watcher delay in milliseconds", 200)
    .option("--entry, -e", "overwrite the default entry file (package.json main field)", null)
    .option("--script, -s", "'npm' script --> name <-- to run before the child process", null)
    .option("--exclude, -x", "exclude a given list of directories/files from the watcher (separated with commas)", "")
    .example("myapp.js -d 500")
    .example("'.*\\.(json|html|ts)' -s build -x build,views")
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
        if (code !== 0 && code !== null) {
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
async function main(range = process.cwd(), options) {
    const { delay, entry, script, exclude = "" } = options;
    console.log(white().bold(`\n[${TITLE}] ${green().bold(VERSION)}`));

    // Add new list of files to EXCLUDE constants
    if (typeof exclude === "string" && exclude.trim() !== "") {
        const fList = new Set(exclude.split(",").map((value) => relative(CWD, value)));
        EXCLUDE.push(...[...fList]);
    }

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
        if (typeof script === "string") {
            crossSpawn.sync("npm", ["run", script], { stdio: "inherit" });
        }
        await startProcess(mainFile);
    }
    catch (error) {
        console.log(yellow().bold(`Failed to start process on file ${cyan().bold(mainFile)}`));
        console.error(red().bold(error.message));
        close();
    }

    const isValidPath = isGlob(range) === false;
    let dirToWatch = isValidPath ? relative(CWD, range) : process.cwd();
    if (dirToWatch.trim() === "") {
        dirToWatch = process.cwd();
    }
    let expr;

    try {
        expr = new RegExp(range, "g");
    }
    catch (error) {
        console.log(red().bold(error.message));
        process.exit(0);
    }

    console.log(white().bold(`[${TITLE}] watching: ${yellow().bold(dirToWatch)}`));
    if (!isValidPath) {
        console.log(white().bold(`[${TITLE}] filtrer enabled with following RegEx: ${cyan().bold(expr.toString())}`));
    }

    function filter(name) {
        const rel = relative(CWD, name);

        if (!isValidPath && !expr.test(name)) {
            return false;
        }

        return EXCLUDE.some((value) => rel.startsWith(value)) === false;
    }
    watcher = watch(dirToWatch, { recursive: true, delay, filter }, async() => {
        try {
            if (typeof script === "string") {
                crossSpawn.sync("npm", ["run", script], { stdio: "inherit" });
            }
            await startProcess(mainFile);
        }
        catch (error) {
            console.error(red().bold(error.message));
            close();
        }
    });

    process.on("SIGINT", close);
}
