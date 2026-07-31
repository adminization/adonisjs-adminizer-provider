import type Configure from '@adonisjs/core/commands/configure'
import {stubsRoot} from './stubs/main.js'
import {readdir, access} from 'node:fs/promises'

export async function configure(command: Configure) {

    const codemods = await command.createCodemods()

    await codemods.updateRcFile((rcFile: any) => {
        rcFile.addProvider(
            'adonisjs-adminizer-provider/provider',
            ['web']
        )
    })

    await codemods.defineEnvVariables({
        JWT_SECRET: 'adminizer_secret',
        AP_PASSWORD_SALT: 'aadminizer_salt'
    })

    const migrationsDir = command.app.makePath('database/migrations')

    async function migrationExists(pattern: string): Promise<boolean> {
        try {
            const files = await readdir(migrationsDir)
            return files.some((file) => file.includes(pattern))
        } catch {
            return false
        }
    }

    async function fileExists(path: string): Promise<boolean> {
        try {
            await access(path)
            return true
        } catch {
            return false
        }
    }

    /**
     * Migrations
     */
    if (await migrationExists('create_adminizer_users_table')) {
        command.logger.warning('Migration "create_adminizer_users_table" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'migrations/create_adminizer_users_table.stub', {})
    }

    if (await migrationExists('create_adminizer_groups_table')) {
        command.logger.warning('Migration "create_adminizer_groups_table" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'migrations/create_adminizer_groups_table.stub', {})
    }

    if (await migrationExists('create_adminizer_user_groups_table')) {
        command.logger.warning('Migration "create_adminizer_user_groups_table" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'migrations/create_adminizer_user_groups_table.stub', {})
    }

    if (await migrationExists('create_adminizer_filters_table')) {
        command.logger.warning('Migration "create_adminizer_filters_table" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'migrations/create_adminizer_filters_table.stub', {})
    }

    if (await migrationExists('create_adminizer_history_actions_table')) {
        command.logger.warning('Migration "create_adminizer_history_actions_table" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'migrations/create_adminizer_history_actions_table.stub', {})
    }

    if (await migrationExists('create_adminizer_filter_columns_table')) {
        command.logger.warning('Migration "create_adminizer_filter_columns_table" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'migrations/create_adminizer_filter_columns_table.stub', {})
    }

    if (await migrationExists('create_adminizer_notifications_table')) {
        command.logger.warning('Migration "create_adminizer_notifications_table" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'migrations/create_adminizer_notifications_table.stub', {})
    }

    if (await migrationExists('create_adminizer_user_notifications_table')) {
        command.logger.warning('Migration "create_adminizer_user_notifications_table" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'migrations/create_adminizer_user_notifications_table.stub', {})
    }

    if (await migrationExists('create_adminizer_media_table')) {
        command.logger.warning('Migration "create_adminizer_media_table" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'migrations/create_adminizer_media_table.stub', {})
    }

    if (await migrationExists('create_adminizer_media_meta_table')) {
        command.logger.warning('Migration "create_adminizer_media_meta_table" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'migrations/create_adminizer_media_meta_table.stub', {})
    }

    if (await migrationExists('create_adminizer_media_associations_table')) {
        command.logger.warning('Migration "create_adminizer_media_associations_table" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'migrations/create_adminizer_media_associations_table.stub', {})
    }

    /**
     * Models
     */
    const userModelPath = command.app.makePath('app/models/adminizer/adminizer_user.ts')
    if (await fileExists(userModelPath)) {
        command.logger.warning('Model "adminizer_user.ts" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'models/adminizer_user.stub', {})
    }

    const groupModelPath = command.app.makePath('app/models/adminizer/adminizer_group.ts')
    if (await fileExists(groupModelPath)) {
        command.logger.warning('Model "adminizer_group.ts" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'models/adminizer_group.stub', {})
    }

    const filterModelPath = command.app.makePath('app/models/adminizer/adminizer_filter.ts')
    if (await fileExists(filterModelPath)) {
        command.logger.warning('Model "adminizer_filter.ts" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'models/adminizer_filter.stub', {})
    }

    const filterColumnModelPath = command.app.makePath('app/models/adminizer/adminizer_filter_column.ts')
    if (await fileExists(filterColumnModelPath)) {
        command.logger.warning('Model "adminizer_filter_column.ts" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'models/adminizer_filter_column.stub', {})
    }

    const historyActionModelPath = command.app.makePath('app/models/adminizer/adminizer_history_action.ts')
    if (await fileExists(historyActionModelPath)) {
        command.logger.warning('Model "adminizer_history_action.ts" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'models/adminizer_history_action.stub', {})
    }

    const notificationModelPath = command.app.makePath('app/models/adminizer/adminizer_notification.ts')
    if (await fileExists(notificationModelPath)) {
        command.logger.warning('Model "adminizer_notification.ts" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'models/adminizer_notification.stub', {})
    }

    const userNotificationModelPath = command.app.makePath('app/models/adminizer/adminizer_user_notification.ts')
    if (await fileExists(userNotificationModelPath)) {
        command.logger.warning('Model "adminizer_user_notification.ts" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'models/adminizer_user_notification.stub', {})
    }

    const mediaModelPath = command.app.makePath('app/models/adminizer/adminizer_media.ts')
    if (await fileExists(mediaModelPath)) {
        command.logger.warning('Model "adminizer_media.ts" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'models/adminizer_media.stub', {})
    }

    const mediaMetaModelPath = command.app.makePath('app/models/adminizer/adminizer_media_meta.ts')
    if (await fileExists(mediaMetaModelPath)) {
        command.logger.warning('Model "adminizer_media_meta.ts" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'models/adminizer_media_meta.stub', {})
    }

    const mediaAssocMetaModelPath = command.app.makePath('app/models/adminizer/adminizer_media_association.ts')
    if (await fileExists(mediaAssocMetaModelPath)) {
        command.logger.warning('Model "adminizer_media_association.ts" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'models/adminizer_media_association.stub', {})
    }

    /**
     * Config
     */
    const configPath = command.app.makePath('config/adminizer.ts')
    if (await fileExists(configPath)) {
        command.logger.warning('Config file "adminizer.ts" already exists, skipping')
    } else {
        await codemods.makeUsingStub(stubsRoot, 'config/adminizer.stub', {})
    }

    command.logger.info('Please run "node ace migration:run" to apply the migrations')

}
