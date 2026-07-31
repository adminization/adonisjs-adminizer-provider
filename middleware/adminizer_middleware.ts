import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export type AdminizerRawMiddleware = (
    req: any,
    res: any,
    next: (err?: unknown) => void
) => void

let routePrefix = ''
let handler: AdminizerRawMiddleware | null = null

/**
 * Called once by AdminizerProvider during boot(), before this middleware
 * ever runs, to wire in the real Adminizer middleware + configured prefix.
 */
export function configureAdminizerMiddleware(prefix: string, rawMiddleware: AdminizerRawMiddleware) {
    routePrefix = prefix
    handler = rawMiddleware
}

export default class AdminizerHttpMiddleware {
    async handle(ctx: HttpContext, next: NextFn) {
        const url = ctx.request.url()

        if (!handler || (url !== routePrefix && !url.startsWith(`${routePrefix}/`))) {
            return next()
        }

        return new Promise<void>((resolve, reject) => {
            handler!(ctx.request.request, ctx.response.response, (err?: unknown) => {
                if (err) {
                    reject(err)
                    return
                }
                if (!ctx.response.response.headersSent) {
                    ctx.response.status(404).send('Not found')
                }
                resolve()
            })
        })
    }
}
