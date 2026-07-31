import {
    AbstractAdminizerApp,
    AppSetupContext,
    MediaManagerConfig,
} from "adminizer";
import {DefaultMediaManager, mediaManagerModelNames} from "./DefaultMediaManager.js";

export interface DefaultMediaManagerAppConfig extends MediaManagerConfig {
    id?: string;
    urlPathPrefix?: string;
}

export class MediaManagerApp extends AbstractAdminizerApp<DefaultMediaManagerAppConfig> {
    readonly name = "media-manager";
    readonly version = "1.0.0";
    declare readonly config: DefaultMediaManagerAppConfig;

    constructor(config: DefaultMediaManagerAppConfig) {
        super();
        this.config = {
            ...config,
            id: config.id ?? "default",
            urlPathPrefix: config.urlPathPrefix ?? "media-manager",
        };
    }

    setup(ctx: AppSetupContext): void {
        const permissionToken = `mediaManager-${this.config.id}`;

        ctx.accessRight({
            id: permissionToken,
            name: this.config.id as string,
            description: `Access to edit media-manager for ${this.config.id}`,
            department: "media-manager",
        });

        for (const modelName of Object.values(mediaManagerModelNames)) {
            ctx.model({name: modelName, adapter: "lucid"});
        }
        ctx.modelAccess({
            id: "storage",
            models: Object.values(mediaManagerModelNames),
        });
        ctx.mediaManager({
            factory: (runtime) =>
                new DefaultMediaManager(
                    runtime,
                    this.config.id as string,
                    this.config.urlPathPrefix as string,
                    this.config.fileStoragePath,
                    this.config.imageSizes ?? {}
                ),
        });
    }
}
