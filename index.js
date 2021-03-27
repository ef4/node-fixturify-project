"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fixturify_1 = __importDefault(require("fixturify"));
const tmp = require("tmp");
const fs = require("fs-extra");
const path = require("path");
const resolvePackagePath = require("resolve-package-path");
tmp.setGracefulCleanup();
function deserializePackageJson(serialized) {
    return JSON.parse(serialized);
}
function keys(object) {
    if (object !== null && (typeof object === 'object' || Array.isArray(object))) {
        return Object.keys(object);
    }
    else {
        return [];
    }
}
function getString(obj, propertyName, errorMessage) {
    const value = obj[propertyName];
    if (typeof value === 'string') {
        return value;
    }
    else {
        throw new TypeError(errorMessage || `expected 'string' but got '${typeof value}'`);
    }
}
/**
 A utility method access a file from a DirJSON that is type-safe and runtime safe.

```ts
getFile(folder, 'package.json') // the files content, or it will throw
```
 */
function getFile(dir, fileName) {
    const value = dir[fileName];
    if (typeof value === 'string') {
        return value;
    }
    else if (typeof value === 'object' && value !== null) {
        throw new TypeError(`Expected a file for name '${fileName}' but got a 'Folder'`);
    }
    else {
        throw new TypeError(`Expected a file for name '${fileName}' but got '${typeof value}'`);
    }
}
/**
 A utility method access a file from a DirJSON that is type-safe and runtime safe

```ts
getFolder(folder, 'node_modules') // => the DirJSON of folder['node_module'] or it will throw
```
 */
function getFolder(dir, fileName) {
    const value = dir[fileName];
    if (isDirJSON(value)) {
        return value;
    }
    else if (typeof value === 'string') {
        throw new TypeError(`Expected a file for name '${fileName}' but got 'File'`);
    }
    else {
        throw new TypeError(`Expected a folder for name '${fileName}' but got '${typeof value}'`);
    }
}
function isDirJSON(value) {
    return typeof value === 'object' && value !== null;
}
function getPackageName(pkg) {
    return getString(pkg, 'name', `package.json is missing a name.`);
}
function getPackageVersion(pkg) {
    return getString(pkg, 'version', `${getPackageName(pkg)}'s package.json is missing a version.`);
}
// This only shallow-merges with any user-provided files, which is OK right now
// because this is only one level deep. If we ever make it deeper, we'll need to
// switch to a proper deep merge.
const defaultFiles = {
    'index.js': `
    'use strict';
     module.exports = {};`,
};
class Project {
    constructor(first, second, third) {
        this.isDependency = true;
        this._dependencies = {};
        this._devDependencies = {};
        this.dependencyLinks = new Map();
        this.linkIsDevDependency = new Set();
        let name;
        let version;
        let files;
        let requestedRange;
        if (first == null) {
            // all optional args stay undefined
        }
        else if (typeof first === 'string') {
            name = first;
            if (typeof second === 'string') {
                version = second;
                if (third) {
                    ({ files, requestedRange } = third);
                }
            }
            else {
                if (second) {
                    ({ version, files, requestedRange } = second);
                }
            }
        }
        else {
            ({ name, version, files, requestedRange } = first);
        }
        let pkg = {};
        if (files && typeof (files === null || files === void 0 ? void 0 : files['package.json']) === 'string') {
            pkg = JSON.parse(files['package.json']);
            files = Object.assign({}, files);
            delete files['package.json'];
        }
        this.pkg = Object.assign({}, pkg, {
            name: name || pkg.name || 'a-fixturified-project',
            version: version || pkg.version || '0.0.0',
            keywords: pkg.keywords || [],
        });
        if (files) {
            this.files = { ...defaultFiles, ...files };
        }
        else {
            this.files = defaultFiles;
        }
        this.requestedRange = requestedRange || this.pkg.version;
    }
    set baseDir(dir) {
        if (this._baseDir) {
            throw new Error(`this Project already has a baseDir`);
        }
        this._baseDir = dir;
    }
    get baseDir() {
        if (!this._baseDir) {
            throw new Error(`this project has no baseDir yet. Either set one manually or call writeSync to have one chosen for you`);
        }
        return this._baseDir;
    }
    autoBaseDir() {
        if (!this._baseDir) {
            this._tmp = tmp.dirSync({ unsafeCleanup: true });
            this._baseDir = fs.realpathSync(this._tmp.name);
        }
        return this._baseDir;
    }
    get name() {
        return getPackageName(this.pkg);
    }
    set name(value) {
        this.pkg.name = value;
    }
    get version() {
        return getPackageVersion(this.pkg);
    }
    set version(value) {
        this.pkg.version = value;
    }
    writeSync() {
        this.autoBaseDir();
        fixturify_1.default.writeSync(this.baseDir, this.files);
        fs.outputJSONSync(path.join(this.baseDir, 'package.json'), this.pkgJSONWithDeps(), { spaces: 2 });
        for (let [name, { dir: target }] of this.dependencyLinks) {
            fs.ensureSymlinkSync(target, path.join(this.baseDir, 'node_modules', name), 'dir');
        }
        for (let dep of this.dependencyProjects()) {
            dep.baseDir = path.join(this.baseDir, 'node_modules', dep.name);
            dep.writeSync();
        }
        for (let dep of this.devDependencyProjects()) {
            dep.baseDir = path.join(this.baseDir, 'node_modules', dep.name);
            dep.writeSync();
        }
    }
    static fromDir(root, opts) {
        let project = new Project();
        project.readSync(root, opts);
        return project;
    }
    readSync(root, opts) {
        const files = fixturify_1.default.readSync(root, {
            // when linking deps, we don't need to crawl all of node_modules
            ignore: (opts === null || opts === void 0 ? void 0 : opts.linkDeps) ? ['node_modules'] : [],
        });
        this.pkg = deserializePackageJson(getFile(files, 'package.json'));
        delete files['package.json'];
        this.files = files;
        if (opts === null || opts === void 0 ? void 0 : opts.linkDeps) {
            if (this.pkg.dependencies) {
                for (let dep of Object.keys(this.pkg.dependencies)) {
                    this.linkDependency(dep, { baseDir: path.join(root, this.name) });
                }
            }
            if (this.pkg.devDependencies) {
                for (let dep of Object.keys(this.pkg.devDependencies)) {
                    this.linkDevDependency(dep, { baseDir: path.join(root, this.name) });
                }
            }
        }
        else {
            const nodeModules = getFolder(files, 'node_modules');
            delete files['node_modules'];
            keys(this.pkg.dependencies).forEach(dependency => {
                this.addDependency(new this.constructor({ files: unwrapPackageName(nodeModules, dependency) }));
            });
            keys(this.pkg.devDependencies).forEach(dependency => {
                this.addDevDependency(new this.constructor({ files: unwrapPackageName(nodeModules, dependency) }));
            });
        }
    }
    addDependency(first, second, third) {
        return this.addDep(first, second, third, '_dependencies');
    }
    addDep(first, second, third, target) {
        let dep;
        if (first == null) {
            dep = new Project();
        }
        else if (typeof first === 'string') {
            let name = first;
            if (typeof second === 'string') {
                let version = second;
                dep = new Project(name, version, third);
            }
            else {
                dep = new Project(name, second);
            }
        }
        else if ('isDependency' in first) {
            dep = first;
        }
        else {
            dep = new Project(first);
        }
        this[target][dep.name] = dep;
        this.dependencyLinks.delete(dep.name);
        this.linkIsDevDependency.delete(dep.name);
        return dep;
    }
    removeDependency(name) {
        delete this._dependencies[name];
        this.dependencyLinks.delete(name);
        this.linkIsDevDependency.delete(name);
    }
    removeDevDependency(name) {
        delete this._devDependencies[name];
        this.dependencyLinks.delete(name);
        this.linkIsDevDependency.delete(name);
    }
    addDevDependency(first, second, third) {
        return this.addDep(first, second, third, '_devDependencies');
    }
    linkDependency(name, opts) {
        var _a;
        this.removeDependency(name);
        this.removeDevDependency(name);
        let dir;
        if ('baseDir' in opts) {
            let pkgJSONPath = resolvePackagePath(opts.resolveName || name, opts.baseDir);
            if (!pkgJSONPath) {
                throw new Error(`failed to locate ${opts.resolveName || name} in ${opts.baseDir}`);
            }
            dir = path.dirname(pkgJSONPath);
        }
        else {
            dir = opts.target;
        }
        let requestedRange = (_a = opts === null || opts === void 0 ? void 0 : opts.requestedRange) !== null && _a !== void 0 ? _a : fs.readJsonSync(path.join(dir, 'package.json')).version;
        this.dependencyLinks.set(name, { dir, requestedRange });
    }
    linkDevDependency(name, opts) {
        this.linkDependency(name, opts);
        this.linkIsDevDependency.add(name);
    }
    dependencyProjects() {
        return Object.keys(this._dependencies).map(dependency => this._dependencies[dependency]);
    }
    devDependencyProjects() {
        return Object.keys(this._devDependencies).map(dependency => this._devDependencies[dependency]);
    }
    pkgJSONWithDeps() {
        let dependencies = this.depsToObject(this.dependencyProjects());
        let devDependencies = this.depsToObject(this.devDependencyProjects());
        for (let [name, { requestedRange }] of this.dependencyLinks.entries()) {
            if (this.linkIsDevDependency.has(name)) {
                devDependencies[name] = requestedRange;
            }
            else {
                dependencies[name] = requestedRange;
            }
        }
        return Object.assign(this.pkg, {
            dependencies,
            devDependencies,
        });
    }
    clone() {
        let cloned = new this.constructor();
        cloned.pkg = JSON.parse(JSON.stringify(this.pkg));
        cloned.files = JSON.parse(JSON.stringify(this.files));
        for (let [name, depProject] of Object.entries(this._dependencies)) {
            cloned._dependencies[name] = depProject.clone();
        }
        for (let [name, depProject] of Object.entries(this._devDependencies)) {
            cloned._devDependencies[name] = depProject.clone();
        }
        cloned.dependencyLinks = new Map(this.dependencyLinks);
        cloned.linkIsDevDependency = new Set(this.linkIsDevDependency);
        cloned.requestedRange = this.requestedRange;
        return cloned;
    }
    dispose() {
        if (this._tmp) {
            this._tmp.removeCallback();
        }
    }
    depsToObject(deps) {
        let obj = {};
        deps.forEach(dep => (obj[dep.name] = dep.requestedRange));
        return obj;
    }
}
exports.Project = Project;
function parseScoped(name) {
    let matched = name.match(/(@[^@\/]+)\/(.*)/);
    if (matched) {
        return {
            scope: matched[1],
            name: matched[2],
        };
    }
    return null;
}
function unwrapPackageName(obj, packageName) {
    let scoped = parseScoped(packageName);
    if (scoped) {
        return getFolder(getFolder(obj, scoped.scope), scoped.name);
    }
    return getFolder(obj, packageName);
}
//# sourceMappingURL=index.js.map