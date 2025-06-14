export interface BumpVersionArgs {
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
export interface PackageJson {
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
export type LogLevel = 'success' | 'info' | 'warn' | 'error';
export type ReleaseType = 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease';
export interface ReleaseChoice {
    name: string;
    value: string;
}
//# sourceMappingURL=index.d.ts.map