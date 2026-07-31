import type { LucidModelRegistration } from '../lib/lucid_adapter.js'
import {AdminpanelConfig} from 'adminizer';

export interface AdminizerSystemConfig {
    models: Record<string, LucidModelRegistration>
    systemModels: Record<string, string>
    adminpanelConfig: AdminpanelConfig
}

export function defineConfig(config: AdminizerSystemConfig): AdminizerSystemConfig {
    return config
}
