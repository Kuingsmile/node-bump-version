import { createRequire } from 'node:module'
import * as path from 'node:path'

import inquirer from 'inquirer';
import _ from 'lodash';
import minimist from 'minimist';
import * as semver from 'semver';

import logger from '../logger.js';
import mainLifeCycle from '../mainLifeCycle.js';
import { BumpVersionArgs, PackageJson, ReleaseChoice,ReleaseType } from '../types/index.js';
import { helperMsg } from '../utils.js';
const require = createRequire(import.meta.url);

let pkg: PackageJson | undefined;
try {
  pkg = require(path.join(process.cwd(), 'package.json'));
} catch (e) {
  logger('package.json not found!', 'error');
  process.exit(0);
}

if (!pkg) {
  logger('package.json not found!', 'error');
  process.exit(0);
}

let argv: BumpVersionArgs = minimist(process.argv.slice(2), {
  alias: {
    'preid-alpha': 'a', // alpha
    'preid-beta': 'b', // beta
    'dry': 'd', // dry run mode
    'file': 'f', // changelog file,
    'path': 'p', // package.json's path
    'help': 'h', // help message
    'type': 't' // bump type
  }
});

if (argv.h) {
  console.log(helperMsg);
  process.exit(0);
}

const releaseType: ReleaseType = (typeof argv.t === 'string' ? argv.t : 'patch') as ReleaseType;
const currentVersion = pkg!.version;
if (currentVersion === undefined) {
  logger('Version field is not found in package.json!', 'error');
  process.exit(0);
}

const preid = argv.a ? 'alpha' : argv.b ? 'beta' : '';
const nextVersion = semver.inc(currentVersion, releaseType, preid);
const releaseTypes: ReleaseType[] = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'];

function generateReleaseTypes(types: ReleaseType[]): ReleaseChoice[] {
  return types.map((item: ReleaseType) => {
    const version = semver.inc(currentVersion, item, (preid || 'alpha'));
    return {
      name: `${item} - ${version}`,
      value: version || ''
    };
  });
}

const defaultObj = {
  path: process.cwd(),
  file: 'CHANGELOG.md'
};

argv = _.assign({}, defaultObj, argv);

let promptList: any[] = [
  {
    type: 'confirm',
    name: 'confirmVersion',
    message: `The next version is ${nextVersion}, is it right?`
  }
];

console.log(
  `
BumpVersion -- By Kuingsmile
  `
);

(async () => {
  const answer = await inquirer.prompt(promptList);
  if ((answer as any).confirmVersion) {
    await mainLifeCycle(argv, currentVersion, nextVersion || '');
  } else {
    promptList = [
      {
        type: 'list',
        name: 'version',
        message: `The current version is ${currentVersion}\n Which version would you like to bump it?`,        choices: [
          ...generateReleaseTypes(releaseTypes),
          { type: 'separator' },
          'custom version',
          'never mind~'
        ],
        pageSize: 10
      }
    ];
    
    const answer = await inquirer.prompt(promptList);
    if ((answer as any).version === 'never mind~') {
      return console.log('Bye~');
    } else if ((answer as any).version === 'custom version') {
      promptList = [
        {
          type: 'input',
          name: 'version',
          message: 'Write down your custom version:'
        }
      ];
      
      const result = await inquirer.prompt(promptList);
      if (semver.valid((result as any).version) && semver.gte((result as any).version, currentVersion)) {
        await mainLifeCycle(argv, currentVersion, (result as any).version);
      } else {
        return logger('Invalid version!', 'error');
      }
    } else {
      await mainLifeCycle(argv, currentVersion, (answer as any).version);
    }
  }
})();
