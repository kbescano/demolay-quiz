import { describe, expect, it } from 'vitest'

import { databaseStorage } from '../src/lib/db-storage'

/** A tiny in-memory stand-in for payload.find/create/update/delete on the media-files collection. */
type Row = { id: number; path: string; mimeType: string; size: number; data: string; updatedAt: string }

function fakeRequest(headers: Record<string, string> = {}, rows: Row[] = []) {
  let nextId = rows.length + 1
  const payload = {
    async find({ where }: { where: { path: { equals: string } } }) {
      return { docs: rows.filter((r) => r.path === where.path.equals) }
    },
    async create({ data }: { data: Omit<Row, 'id' | 'updatedAt'> }) {
      const row = { id: nextId++, updatedAt: '2026-09-20T00:00:00.000Z', ...data }
      rows.push(row)
      return row
    },
    async update({ id, data }: { id: number; data: Partial<Row> }) {
      Object.assign(rows.find((r) => r.id === id)!, data)
    },
    async delete({ where }: { where: { path: { equals: string } } }) {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].path === where.path.equals) rows.splice(i, 1)
    },
  }
  return { rows, req: { payload, headers: new Headers(headers) } as never }
}

const adapter = databaseStorage({ collection: { slug: 'media' } as never, prefix: '' })
const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]) // the start of a JPEG

describe('database storage adapter', () => {
  it('stores an upload as base64 and serves the same bytes back', async () => {
    const { rows, req } = fakeRequest()
    await adapter.handleUpload({
      file: { buffer: bytes, filename: 'logo.jpg', filesize: bytes.length, mimeType: 'image/jpeg' },
      req,
      storageFilePath: 'logo.jpg',
    } as never)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ path: 'logo.jpg', mimeType: 'image/jpeg', size: bytes.length })

    const response = await adapter.staticHandler(req, {
      doc: { id: 1, filename: 'logo.jpg', prefix: '' } as never,
      params: { collection: 'media', filename: 'logo.jpg' },
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Buffer.from(await response.arrayBuffer()).equals(bytes)).toBe(true)
  })

  it('replaces the file when the same path is uploaded again instead of adding a second row', async () => {
    const { rows, req } = fakeRequest()
    const upload = (buffer: Buffer) =>
      adapter.handleUpload({
        file: { buffer, filename: 'logo.jpg', filesize: buffer.length, mimeType: 'image/jpeg' },
        req,
        storageFilePath: 'logo.jpg',
      } as never)
    await upload(bytes)
    await upload(Buffer.from('newer'))
    expect(rows).toHaveLength(1)
    expect(Buffer.from(rows[0].data, 'base64').toString()).toBe('newer')
  })

  it('answers 304 when the browser already has the current version', async () => {
    const first = fakeRequest()
    await adapter.handleUpload({
      file: { buffer: bytes, filename: 'logo.jpg', filesize: bytes.length, mimeType: 'image/jpeg' },
      req: first.req,
      storageFilePath: 'logo.jpg',
    } as never)
    const args = { doc: { id: 1, filename: 'logo.jpg', prefix: '' } as never, params: { collection: 'media', filename: 'logo.jpg' } }
    const etag = (await adapter.staticHandler(first.req, args)).headers.get('etag')!

    const revisit = fakeRequest({ 'if-none-match': etag }, first.rows)
    const response = await adapter.staticHandler(revisit.req, args)
    expect(response.status).toBe(304)
  })

  it('answers 404 for a file that is not stored', async () => {
    const { req } = fakeRequest()
    const response = await adapter.staticHandler(req, {
      doc: { id: 9, filename: 'missing.jpg', prefix: '' } as never,
      params: { collection: 'media', filename: 'missing.jpg' },
    })
    expect(response.status).toBe(404)
  })

  it('removes the stored bytes when the file is deleted', async () => {
    const { rows, req } = fakeRequest()
    await adapter.handleUpload({
      file: { buffer: bytes, filename: 'logo.jpg', filesize: bytes.length, mimeType: 'image/jpeg' },
      req,
      storageFilePath: 'logo.jpg',
    } as never)
    await adapter.handleDelete({ req, storageFilePath: 'logo.jpg' } as never)
    expect(rows).toHaveLength(0)
  })
})
