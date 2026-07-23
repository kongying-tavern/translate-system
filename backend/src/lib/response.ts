import { Response } from 'express'

export function success(res: Response, data: any = null) {
  res.json({ code: 0, message: 'success', data })
}

export function successWithPage<T>(res: Response, list: T[], total: number, page: number, pageSize: number) {
  res.json({ code: 0, message: 'success', data: { list, total, page, pageSize } })
}

export function error(res: Response, code: number, message: string, status = 200) {
  res.status(status).json({ code, message, data: null })
}
