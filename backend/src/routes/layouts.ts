import { Router } from 'express'
import * as layoutService from '../services/layout'
import { authMiddleware } from '../middleware/auth'
import { requireOwnership } from '../middleware/ownership'
import { success, error } from '../lib/response'
import { ErrCode } from '../lib/errors'

export const layoutRoutes = Router()

// Templates
layoutRoutes.get('/:projectSlug/layouts/templates', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.listTemplates(req.params.projectSlug); success(res, data) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})
layoutRoutes.post('/:projectSlug/layouts/templates', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.createTemplate(req.params.projectSlug, req.body); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
layoutRoutes.get('/:projectSlug/layouts/templates/:templateId', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.getTemplate(req.params.templateId); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
layoutRoutes.put('/:projectSlug/layouts/templates/:templateId', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.updateTemplate(req.params.templateId, req.body); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
layoutRoutes.delete('/:projectSlug/layouts/templates/:templateId', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { await layoutService.deleteTemplate(req.params.templateId); success(res, null) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

// Configs
layoutRoutes.get('/:projectSlug/layouts/configs', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.listConfigs(req.params.projectSlug); success(res, data) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})
layoutRoutes.post('/:projectSlug/layouts/configs', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.createConfig(req.params.projectSlug, req.body); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
layoutRoutes.get('/:projectSlug/layouts/configs/:configId', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.getConfig(req.params.configId); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
layoutRoutes.put('/:projectSlug/layouts/configs/:configId', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.updateConfig(req.params.configId, req.body); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
layoutRoutes.delete('/:projectSlug/layouts/configs/:configId', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { await layoutService.deleteConfig(req.params.configId); success(res, null) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})
layoutRoutes.get('/:projectSlug/layouts/configs/:configId/resolved', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.getResolvedConfig(req.params.configId); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
