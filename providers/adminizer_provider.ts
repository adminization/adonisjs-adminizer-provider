import type { ApplicationService } from '@adonisjs/core/types'
import { LucidAdapter } from '../lib/lucid_adapter.js'
import { Adminizer } from 'adminizer'
import config from '@adonisjs/core/services/config'
import { AdminizerSystemConfig } from '../src/define_config.js'
import { configureAdminizerMiddleware } from '../middleware/adminizer_middleware.js'
import {MediaManagerApp} from "../apps/media-manager/MediaManagerApp.js";

export default class AdminizerProvider {

    constructor(protected app: ApplicationService) {}

    register() {}

    async boot() {
        // Register middleware as early as possible — before AdonisJS
        // "freezes" the server-middleware stack inside its server.boot()
        const server = await this.app.container.make('server')
        server.use([() => import('../middleware/adminizer_middleware.js')])
    }

    async start() {}

    async ready() {
        const adminizerConfig = config.get<AdminizerSystemConfig>('adminizer')

        if (!adminizerConfig) {
            console.warn('[Adminizer] config/adminizer.ts not found, skipping initialization')
            return
        }

        const adapter = await LucidAdapter.create(adminizerConfig.models, {
            systemModels: adminizerConfig.systemModels,
        })

        const adminizer = new Adminizer([adapter])
        await adminizer.init(adminizerConfig.adminpanelConfig)

        await adminizer.appManager.enable(new MediaManagerApp({
            ...adminizerConfig.adminpanelConfig.mediamanager as any,
        }));

        this.app.container.bindValue('adminizer', adminizer)
        configureAdminizerMiddleware(adminizerConfig.adminpanelConfig.routePrefix, adminizer.getMiddleware())
    }

    async shutdown() {
        console.log('[Adminizer] shutdown')
    }

}

declare module '@adonisjs/core/types' {
    export interface ContainerBindings {
        adminizer: Adminizer
    }
}
