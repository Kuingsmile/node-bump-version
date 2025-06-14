import * as ora from 'ora';

interface BumpVersionArgs {
    _: string[];
    a?: boolean;
    b?: boolean;
    d?: boolean;
    f?: string;
    p?: string;
    h?: boolean;
    t?: string;
    dry?: boolean;
    file?: string;
    path?: string;
    help?: boolean;
    type?: string;
    'preid-alpha'?: boolean;
    'preid-beta'?: boolean;
    changelog?: boolean;
    skipCommit?: boolean;
    push?: boolean;
    tag?: boolean;
    'no-tag'?: boolean;
    'no-changelog'?: boolean;
    [key: string]: any;
}
interface PackageJson {
    name: string;
    version: string;
    description?: string;
    main?: string;
    types?: string;
    bin?: Record<string, string> | string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    [key: string]: any;
}
type LogLevel = 'success' | 'info' | 'warn' | 'error';
type ReleaseType = 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease';
interface ReleaseChoice {
    name: string;
    value: string;
}

declare const bumpVersion: (argv: BumpVersionArgs, version: string) => Promise<void>;

declare const changelog: (argv: BumpVersionArgs, newVersion: string) => Promise<void>;

declare const commit: (argv: BumpVersionArgs, newVersion: string) => Promise<string | void>;

declare const execCommand: (argv: BumpVersionArgs, cmd: string) => Promise<string>;

declare const logger: (msg: string, type: LogLevel) => void;

declare const mainLifeCycle: (argv: BumpVersionArgs, _currentVersion: string, newVersion: string) => Promise<void>;

declare const spinner: ora.Ora;

declare const tag: (argv: BumpVersionArgs, newVersion: string) => Promise<string | void>;

declare const checkFileAndGetPath: (argv: BumpVersionArgs, files: string[]) => string[];
declare const helperMsg = "\nBumpVersion -- By Kuingsmile\n\nUsage\n  bump-version\n\nExample\n  bump-version -t major\n\nOptions\n  -a, --preid-alpha             Prerelease id: alpha. Exp. 1.0.0.alpha-0\n\n  -b, --preid-beta              Prerelease id: beta.  Exp. 1.0.0.beta-0\n\n  -d, --dry                     Run bump version without change anything & output the log in console\n\n  -f, --file                    Read and write the CHANGELOG file, relative to package.json's path\n                                Default: CHANGELOG.md\n\n  -p, --path                    A filepath of where your package.json is located\n                                Default: ./\n\n  -h, --help                    Display help message\n\n  -t, --type                    Release type. [major, minor, patch, premajor, preminor, prepatch, prerelease]\n                                Default: patch\n\n  --push                        Auto push commits to origin master\n                                Default: false\n\n  --no-tag                      Tag won't be created\n                                Default: tag will be created\n\n  --no-changelog                Changelog won't be created\n                                Default: changelog will be created\n";

export { bumpVersion, changelog, checkFileAndGetPath, commit, execCommand as exec, helperMsg, logger, mainLifeCycle, spinner as ora, tag };
export type { BumpVersionArgs, LogLevel, PackageJson, ReleaseChoice, ReleaseType };
