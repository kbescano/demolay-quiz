/**
 * A Payload cloud-storage adapter that keeps uploaded files in the database (the hidden
 * `media-files` collection). Free hosting has no persistent disk, and one logo does not justify
 * a separate storage service.
 */
import type { Adapter } from '@payloadcms/plugin-cloud-storage/types'
import { getStorageFilePath } from '@payloadcms/plugin-cloud-storage/utilities'

const COLLECTION = 'media-files' as const

export const databaseStorage: Adapter = ({ collection, prefix = '' }) => ({
  name: 'database',

  async handleUpload({ file, req, storageFilePath }) {
    const values = {
      path: storageFilePath,
      mimeType: file.mimeType,
      size: file.buffer.length,
      data: file.buffer.toString('base64'),
    }
    // Passing `req` keeps this inside the upload's own transaction: a separate write would wait
    // on the lock that transaction holds.
    const { docs } = await req.payload.find({
      collection: COLLECTION,
      where: { path: { equals: storageFilePath } },
      limit: 1,
      depth: 0,
      req,
    })
    if (docs[0]) {
      await req.payload.update({ collection: COLLECTION, id: docs[0].id, data: values, depth: 0, req })
    } else {
      await req.payload.create({ collection: COLLECTION, data: values, depth: 0, req })
    }
  },

  async handleDelete({ req, storageFilePath }) {
    await req.payload.delete({
      collection: COLLECTION,
      where: { path: { equals: storageFilePath } },
      req,
    })
  },

  async staticHandler(req, { doc, headers, params: { clientUploadContext, filename } }) {
    const key = await getStorageFilePath({
      clientUploadContext,
      collection,
      collectionPrefix: prefix,
      doc,
      filename,
      req,
      useCompositePrefixes: false,
    })

    const { docs } = await req.payload.find({
      collection: COLLECTION,
      where: { path: { equals: key } },
      limit: 1,
      depth: 0,
      req,
    })
    const row = docs[0]
    if (!row) return new Response(null, { status: 404, statusText: 'Not Found' })

    const bytes = Buffer.from(row.data, 'base64')
    const etag = `"${row.id}-${new Date(row.updatedAt).getTime()}-${bytes.length}"`

    const responseHeaders = new Headers(headers)
    responseHeaders.set('Content-Type', row.mimeType)
    responseHeaders.set('Cache-Control', 'public, max-age=300')
    responseHeaders.set('ETag', etag)
    responseHeaders.set('X-Content-Type-Options', 'nosniff')

    if (req.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: responseHeaders })
    }
    responseHeaders.set('Content-Length', String(bytes.length))
    return new Response(bytes, { status: 200, headers: responseHeaders })
  },
})
