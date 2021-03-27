import fixturify from 'fixturify';
import { PackageJson } from 'type-fest';
interface ReadDirOpts {
    linkDeps?: boolean;
}
export interface ProjectArgs {
    name?: string;
    version?: string;
    files?: fixturify.DirJSON;
    requestedRange?: string;
}
export declare class Project {
    pkg: PackageJson;
    files: fixturify.DirJSON;
    readonly isDependency = true;
    private _dependencies;
    private _devDependencies;
    private _baseDir;
    private _tmp;
    private requestedRange;
    private dependencyLinks;
    private linkIsDevDependency;
    constructor(name?: string, version?: string, args?: Omit<ProjectArgs, 'name' | 'version'>);
    constructor(name?: string, args?: Omit<ProjectArgs, 'name'>);
    constructor(args?: ProjectArgs);
    set baseDir(dir: string);
    get baseDir(): string;
    private autoBaseDir;
    get name(): string;
    set name(value: string);
    get version(): string;
    set version(value: string);
    writeSync(): void;
    static fromDir(root: string, opts?: ReadDirOpts): Project;
    private readSync;
    addDependency(name?: string, version?: string, args?: Omit<ProjectArgs, 'name' | 'version'>): Project;
    addDependency(name?: string, args?: Omit<ProjectArgs, 'name'>): Project;
    addDependency(args?: ProjectArgs): Project;
    addDependency(args?: Project): Project;
    private addDep;
    removeDependency(name: string): void;
    removeDevDependency(name: string): void;
    addDevDependency(name?: string, version?: string, args?: Omit<ProjectArgs, 'name' | 'version'>): Project;
    addDevDependency(name?: string, args?: Omit<ProjectArgs, 'name'>): Project;
    addDevDependency(args?: ProjectArgs): Project;
    addDevDependency(args?: Project): Project;
    linkDependency(name: string, opts: {
        baseDir: string;
        resolveName?: string;
        requestedRange?: string;
    } | {
        target: string;
        requestedRange?: string;
    }): void;
    linkDevDependency(name: string, opts: {
        baseDir: string;
        resolveName?: string;
    } | {
        target: string;
    }): void;
    dependencyProjects(): Project[];
    devDependencyProjects(): Project[];
    private pkgJSONWithDeps;
    clone(): Project;
    dispose(): void;
    private depsToObject;
}
export {};
