import type { Response } from 'express'

export function error(res: Response, code: number, message: string, status = 200) {
  res.status(status).json({ code, message, data: null })
}
