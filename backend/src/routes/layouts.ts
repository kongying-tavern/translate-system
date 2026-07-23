import { Router } from 'express'
import * as layoutService from '../services/layout'
import { authMiddleware } from '../middleware/auth'
import { requireOwnership } from '../middleware/ownership'
import { success, error } from '../lib/response'
import { ErrCode } from '../lib/errors'

export const layoutRoutes = Router()

// Templates
layoutRoutes.get('/:projectId/layouts/templates', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.listTemplates(req.params.projectId); success(res, data) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})
layoutRoutes.post('/:projectId/layouts/templates', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.createTemplate(req.params.projectId, req.body); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
layoutRoutes.get('/:projectId/layouts/templates/:templateId', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.getTemplate(req.params.templateId); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
layoutRoutes.put('/:projectId/layouts/templates/:templateId', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.updateTemplate(req.params.templateId, req.body); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
layoutRoutes.delete('/:projectId/layouts/templates/:templateId', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { await layoutService.deleteTemplate(req.params.templateId); success(res, null) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})

// Configs
layoutRoutes.get('/:projectId/layouts/configs', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.listConfigs(req.params.projectId); success(res, data) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})
layoutRoutes.post('/:projectId/layouts/configs', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.createConfig(req.params.projectId, req.body); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
layoutRoutes.get('/:projectId/layouts/configs/:configId', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.getConfig(req.params.configId); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
layoutRoutes.put('/:projectId/layouts/configs/:configId', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.updateConfig(req.params.configId, req.body); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
layoutRoutes.delete('/:projectId/layouts/configs/:configId', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { await layoutService.deleteConfig(req.params.configId); success(res, null) } catch (e: any) { error(res, ErrCode.Internal, e.message) }
})
layoutRoutes.get('/:projectId/layouts/configs/:configId/resolved', authMiddleware as any, requireOwnership, async (req, res, next) => {
  try { const data = await layoutService.getResolvedConfig(req.params.configId); success(res, data) } catch (e: any) { error(res, e.code || ErrCode.Internal, e.message) }
})
