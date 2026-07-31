import db from '@adonisjs/lucid/services/db'
import type {LucidModel} from '@adonisjs/lucid/types/model'
import {
    AbstractAdapter,
    AbstractModel,
    type AbstractAdapterOptions,
    type Attribute,
    type ModelAttributes,
    type QueryCriteria,
} from 'adminizer'

/**
 * Patch applied to an auto-detected attribute after introspection.
 * Used to satisfy Adminizer's system model contracts (e.g. User.apiKey must
 * report columnName "userApiKey", UserNotification.notificationId must report
 * as an association rather than a plain FK column).
 */
type AttributeOverride = Partial<Attribute> & { hide?: boolean; sourceRelation?: string }

// Precomputed attributes/relation-alias maps, keyed by the Lucid model class itself.
// Populated (async) by LucidAdapter.create() before any AbstractModel wrapper is
// constructed, since AbstractModel/AbstractAdapter require synchronous construction
// (`new adapter.Model(modelName, registeredModel)` is called by Adminizer core).
const attributesCache = new WeakMap<LucidModel, ModelAttributes>()
const relationAliasCache = new WeakMap<LucidModel, Record<string, string>>()

function inferAttributeType(sqlType: string | undefined): Attribute['type'] {
    const type = (sqlType ?? '').toLowerCase()
    if (type.includes('bool')) return 'boolean'
    if (type.includes('json')) return 'json'
    if (
        type.includes('int') ||
        type.includes('float') ||
        type.includes('double') ||
        type.includes('decimal') ||
        type.includes('numeric') ||
        type.includes('real')
    ) {
        return 'number'
    }
    return 'string'
}

/**
 * By default Lucid assumes the database generates the primary key, so after an insert it
 * overwrites the in-memory key with whatever the driver reports (the SQLite rowid, the
 * MySQL insertId). That is wrong for a key the application assigns itself — a uuid from a
 * `beforeCreate` hook or a slug typed into the add form — and leaves the instance pointing
 * at a row that does not exist, so the read-back after create/update fails with
 * "Row not found". A non-numeric primary key column is never database-generated, so flag
 * those models as self-assigning.
 */
function configureSelfAssignedPrimaryKey(Model: LucidModel, columnsInfo: Record<string, any>) {
    const primaryColumn = Model.$columnsDefinitions.get(Model.primaryKey)
    const info = primaryColumn ? columnsInfo[primaryColumn.columnName] : undefined
    if (info && inferAttributeType(info.type) !== 'number') {
        Model.selfAssignPrimaryKey = true
    }
}

async function buildLucidAttributes(
    Model: LucidModel,
    overrides: Record<string, AttributeOverride> = {}
): Promise<{ attributes: ModelAttributes; relationAliases: Record<string, string> }> {
    const attributes: ModelAttributes = {}
    const relationAliases: Record<string, string> = {}
    const columnsInfo = await db.connection(Model.connection).columnsInfo(Model.table)

    configureSelfAssignedPrimaryKey(Model, columnsInfo)

    Model.$columnsDefinitions.forEach((column, attributeName) => {
        const info = columnsInfo[column.columnName]
        attributes[attributeName] = {
            type: inferAttributeType(info?.type),
            required: info ? info.nullable === false : false,
            columnName: column.columnName,
        }
    })

    Model.$relationsDefinitions.forEach((relation, name) => {
        const relatedModel = relation.relatedModel() as LucidModel
        switch (relation.type) {
            case 'belongsTo':
            case 'hasOne': {
                const foreignKey = ((relation as any).foreignKey as string) ?? `${name}Id`
                if (attributes[foreignKey]) {
                    attributes[foreignKey].primaryKeyForAssociation = true
                }
                attributes[name] = {type: 'association', model: relatedModel.name, via: foreignKey}
                break
            }
            case 'hasMany': {
                const foreignKey = (relation as any).foreignKey as string
                attributes[name] = {
                    type: 'association-many',
                    collection: relatedModel.name,
                    via: foreignKey,
                }
                break
            }
            case 'manyToMany': {
                const pivotRelatedForeignKey = (relation as any).pivotRelatedForeignKey as string
                attributes[name] = {
                    type: 'association-many',
                    collection: relatedModel.name,
                    via: pivotRelatedForeignKey,
                }
                break
            }
            case 'hasManyThrough': {
                attributes[name] = {type: 'association-many', collection: relatedModel.name}
                break
            }
        }
    })

    for (const [key, patch] of Object.entries(overrides)) {
        if (patch.hide) {
            delete attributes[key]
            continue
        }
        const {sourceRelation, hide, ...rest} = patch
        void hide
        attributes[key] = {...(attributes[key] ?? {type: 'string'}), ...rest}
        if (sourceRelation) {
            relationAliases[key] = sourceRelation
        }
    }

    return {attributes, relationAliases}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export class LucidModelResource extends AbstractModel<any> {
    private readonly Model: LucidModel
    private readonly relationAliases: Record<string, string>

    constructor(modelName: string, model: LucidModel) {
        const attributes = attributesCache.get(model) ?? {}
        super(modelName, attributes, model.primaryKey, model.name)
        this.Model = model
        this.relationAliases = relationAliasCache.get(model) ?? {}
    }

    private applyOutputAliases(json: Record<string, any>): Record<string, any> {
        for (const [key, relationName] of Object.entries(this.relationAliases)) {
            if (relationName in json) {
                json[key] = json[relationName]
            }
        }
        return json
    }

    private resolveColumn(key: string): string {
        const attr = this.attributes[key]
        if (attr?.type === 'association' && attr.via) {
            return attr.via
        }
        return key
    }

    private applyOperator(query: any, column: string, op: string, val: any) {
        if (val === undefined) return
        switch (op) {
            case 'eq':
                query.where(column, val)
                break
            case 'ne':
                query.whereNot(column, val)
                break
            case 'gt':
                query.where(column, '>', val)
                break
            case 'gte':
                query.where(column, '>=', val)
                break
            case 'lt':
                query.where(column, '<', val)
                break
            case 'lte':
                query.where(column, '<=', val)
                break
            case 'contains':
                query.whereLike(column, `%${val}%`)
                break
            case 'startsWith':
                query.whereLike(column, `${val}%`)
                break
            case 'endsWith':
                query.whereLike(column, `%${val}`)
                break
            case 'in':
                query.whereIn(column, val)
                break
            case 'notIn':
                query.whereNotIn(column, val)
                break
            case 'between':
                query.whereBetween(column, val)
                break
            case 'isNull':
                if (val) query.whereNull(column)
                break
            case 'isNotNull':
                if (val) query.whereNotNull(column)
                break
            default:
                query.where(column, val)
        }
    }

    private applyWhere(query: any, where: Record<string, any> | undefined) {
        if (!where) return
        for (const key of Object.keys(where)) {
            const value = (where as any)[key]
            if (key === 'and' && Array.isArray(value)) {
                for (const sub of value) {
                    query.where((q: any) => this.applyWhere(q, sub))
                }
                continue
            }
            if (key === 'or' && Array.isArray(value)) {
                query.where((q: any) => {
                    for (const sub of value) {
                        q.orWhere((q2: any) => this.applyWhere(q2, sub))
                    }
                })
                continue
            }
            if (key === 'not') {
                query.whereNot((q: any) => this.applyWhere(q, value))
                continue
            }
            const column = this.resolveColumn(key)
            if (value === null) {
                query.whereNull(column)
                continue
            }
            if (Array.isArray(value)) {
                query.whereIn(column, value)
                continue
            }
            if (isPlainObject(value)) {
                for (const [op, val] of Object.entries(value)) {
                    if (val === undefined || val === null) continue
                    this.applyOperator(query, column, op, val)
                }
                continue
            }
            query.where(column, value)
        }
    }

    private applySort(query: any, sort: QueryCriteria['sort']) {
        if (!sort) return
        if (typeof sort === 'string') {
            const [field, dir] = sort.trim().split(/\s+/)
            query.orderBy(this.resolveColumn(field), dir?.toUpperCase() === 'DESC' ? 'desc' : 'asc')
            return
        }
        for (const [field, dir] of Object.entries(sort)) {
            query.orderBy(
                this.resolveColumn(field),
                String(dir).toUpperCase() === 'DESC' ? 'desc' : 'asc'
            )
        }
    }

    private applyPreload(query: any, populate: QueryCriteria['populate'] | undefined) {
        const keys = populate
            ? Object.keys(populate)
            : Object.entries(this.attributes)
                .filter(([, attr]) => attr.type === 'association' || attr.type === 'association-many')
                .map(([name]) => name)

        for (const key of keys) {
            const relationName = this.relationAliases[key] ?? key
            if (!this.Model.$relationsDefinitions.has(relationName)) continue
            const nested = populate ? (populate as any)[key] : undefined
            if (nested && typeof nested === 'object') {
                query.preload(relationName, (q: any) => {
                    this.applyWhere(q, nested.where)
                    this.applySort(q, nested.sort)
                    if (typeof nested.limit === 'number') q.limit(nested.limit)
                    if (typeof nested.skip === 'number') q.offset(nested.skip)
                })
            } else {
                query.preload(relationName)
            }
        }
    }

    private buildQuery(criteria: QueryCriteria = {}) {
        const query = this.Model.query()
        const {where, select, populate, sort, limit, skip, id} = criteria as any

        // Handle primary key passed directly in criteria (e.g. from Adminizer's remove controller)
        if (id !== undefined && id !== null) {
            query.where(this.Model.primaryKey, id)
        }

        this.applyWhere(query, where)
        if (select) {
            const fields = Array.isArray(select)
                ? select
                : Object.keys(select).filter((k) => (select as any)[k])
            query.select(fields.map((f: string) => this.resolveColumn(f)))
        }
        this.applySort(query, sort)
        if (typeof limit === 'number') query.limit(limit)
        if (typeof skip === 'number') query.offset(skip)
        this.applyPreload(query, populate)
        return query
    }

    private splitAssociations(data: Record<string, any>) {
        const plainData: Record<string, any> = {}
        const manyAssocData: Record<string, any> = {}
        for (const [key, value] of Object.entries(data)) {
            const attr = this.attributes[key]
            if (attr?.type === 'association' && attr.via) {
                plainData[attr.via] =
                    value !== null && typeof value === 'object' ? (value as any)[this.primaryKey] : value
            } else if (attr?.type === 'association-many') {
                manyAssocData[key] = value
            } else {
                plainData[key] = value
            }
        }
        return {plainData, manyAssocData}
    }

    private async assignManyAssociations(instance: any, manyAssocData: Record<string, any>) {
        for (const [alias, ids] of Object.entries(manyAssocData)) {
            const relationName = this.relationAliases[alias] ?? alias
            const relation = this.Model.$relationsDefinitions.get(relationName)
            if (!relation) continue
            const values = Array.isArray(ids) ? ids : [ids]
            if (relation.type === 'manyToMany') {
                await instance.related(relationName).sync(values)
            } else if (relation.type === 'hasMany') {
                const foreignKey = (relation as any).foreignKey as string
                const relatedModel = relation.relatedModel() as LucidModel
                if (values.length) {
                    await relatedModel
                        .query()
                        .whereIn(relatedModel.primaryKey, values)
                        .update({[foreignKey]: instance[this.primaryKey]})
                }
            }
        }
    }

    /**
     * Unless a model declares `selfAssignPrimaryKey`, Lucid overwrites the in-memory
     * primary key after an insert with whatever the driver reports (the SQLite rowid,
     * the MySQL insertId, ...). For a self-assigned key — a uuid/slug typed into the
     * add form — the row was written with the submitted value, so the instance is left
     * pointing at a key that does not exist. Restore the value we actually inserted.
     */
    private restoreAssignedPrimaryKey(instance: any, assignedKey: any) {
        if (assignedKey === undefined) return
        if (String(instance[this.primaryKey]) === String(assignedKey)) return
        instance.$attributes[this.primaryKey] = assignedKey
        instance.$original[this.primaryKey] = assignedKey
    }

    protected async _create(data: Record<string, any>) {
        const {plainData, manyAssocData} = this.splitAssociations(data)
        const pk = this.primaryKey
        if (plainData[pk] === undefined || plainData[pk] === null || plainData[pk] === '') {
            delete plainData[pk]
        }
        const assignedKey = plainData[pk]
        const instance = await this.Model.create(plainData)
        // Must happen before the relations are written: they are keyed off the instance.
        this.restoreAssignedPrimaryKey(instance, assignedKey)
        await this.assignManyAssociations(instance, manyAssocData)
        const fresh = await this.buildQuery()
            .where(pk, (instance.$attributes as any)[pk])
            .firstOrFail()
        return this.applyOutputAliases(fresh.toJSON())
    }

    protected async _findOne(criteria: QueryCriteria = {}) {
        const record = await this.buildQuery(criteria).first()
        return record ? this.applyOutputAliases(record.toJSON()) : null
    }

    protected async _find(criteria: QueryCriteria = {}) {
        const records = await this.buildQuery(criteria)
        return records.map((r: any) => this.applyOutputAliases(r.toJSON()))
    }

    /**
     * The primary key is never part of an update payload. Lucid targets the update at
     * the instance's *current* key, so merging a changed key would rewrite the WHERE
     * clause and silently update nothing — a self-assigned string key is editable in
     * the admin form, so this is reachable.
     */
    private stripPrimaryKey(plainData: Record<string, any>) {
        delete plainData[this.primaryKey]
        return plainData
    }

    protected async _updateOne(criteria: QueryCriteria, data: Record<string, any>) {
        const record = await this.buildQuery({...criteria, populate: undefined}).first()
        if (!record) return null
        const {plainData, manyAssocData} = this.splitAssociations(data)
        this.stripPrimaryKey(plainData)
        record.merge(plainData)
        await record.save()
        await this.assignManyAssociations(record, manyAssocData)
        const fresh = await this.buildQuery({populate: (criteria as any).populate})
            .where(this.primaryKey, (record as any)[this.primaryKey])
            .firstOrFail()
        return this.applyOutputAliases(fresh.toJSON())
    }

    protected async _update(criteria: QueryCriteria, data: Record<string, any>) {
        const records = await this.buildQuery({...criteria, populate: undefined})
        const {plainData, manyAssocData} = this.splitAssociations(data)
        this.stripPrimaryKey(plainData)
        const results = []
        for (const record of records) {
            record.merge(plainData)
            await record.save()
            await this.assignManyAssociations(record, manyAssocData)
            results.push(this.applyOutputAliases(record.toJSON()))
        }
        return results
    }

    protected async _destroyOne(criteria: QueryCriteria) {
        const record = await this.buildQuery(criteria).first()
        if (!record) return null
        const json = this.applyOutputAliases(record.toJSON())
        await record.delete()
        return json
    }

    protected async _destroy(criteria: QueryCriteria) {
        const records = await this.buildQuery(criteria)
        const json = records.map((r: any) => this.applyOutputAliases(r.toJSON()))
        for (const record of records) {
            await record.delete()
        }
        return json
    }

    protected async _count(criteria: QueryCriteria = {}) {
        const query = this.Model.query()
        this.applyWhere(query, (criteria as any).where)
        const result = await query.count('* as total').first()
        return Number((result as any)?.$extras?.total ?? 0)
    }
}

export interface LucidSystemModelConfig {
    Model: LucidModel
    overrides?: Record<string, AttributeOverride>
}

export type LucidModelRegistration = LucidModel | LucidSystemModelConfig

export class LucidAdapter extends AbstractAdapter {
    Model = LucidModelResource
    private readonly modelsMap: Record<string, LucidModel>

    private constructor(modelsMap: Record<string, LucidModel>, options?: AbstractAdapterOptions) {
        super('lucid', modelsMap, options)
        this.modelsMap = modelsMap
    }

    static async create(
        registrations: Record<string, LucidModelRegistration>,
        options?: AbstractAdapterOptions
    ): Promise<LucidAdapter> {
        const modelsMap: Record<string, LucidModel> = {}
        for (const [name, registration] of Object.entries(registrations)) {
            const isConfig = !(typeof registration === 'function')
            const Model = isConfig
                ? (registration as LucidSystemModelConfig).Model
                : (registration as LucidModel)
            const overrides = isConfig ? (registration as LucidSystemModelConfig).overrides : undefined
            modelsMap[name] = Model
            if (!attributesCache.has(Model)) {
                const {attributes, relationAliases} = await buildLucidAttributes(Model, overrides)
                attributesCache.set(Model, attributes)
                relationAliasCache.set(Model, relationAliases)
            }
        }
        return new LucidAdapter(modelsMap, options)
    }

    get models(): Record<string, any> {
        return this.modelsMap
    }

    getModel(modelName: string): any {
        const matchedKey = Object.keys(this.modelsMap).find(
            (key) => key.toLowerCase() === modelName.toLowerCase()
        )
        return matchedKey ? this.modelsMap[matchedKey] : undefined
    }

    getAttributes(modelName: string): ModelAttributes | undefined {
        const model = this.getModel(modelName)
        return model ? attributesCache.get(model) : undefined
    }
}
