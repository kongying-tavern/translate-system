import { prisma } from '../index'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { config } from '../config'

export async function register(username: string, email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw { code: 1004, message: 'email already registered' }
  // First user is super admin
  const userCount = await prisma.user.count()
  const role = userCount === 0 ? 'super_admin' : 'member'
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({ data: { username, email, passwordHash, role } })
  return generateTokens(user.id, user.role)
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw { code: 1001, message: 'invalid email or password' }
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw { code: 1001, message: 'invalid email or password' }
  return generateTokens(user.id, user.role)
}

export async function refresh(refreshToken: string) {
  const hash = sha256(refreshToken)
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash: hash, revoked: false, expiresAt: { gt: new Date() } }
  })
  if (!stored) throw { code: 1001, message: 'invalid or expired refresh token' }
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } })
  const user = await prisma.user.findUnique({ where: { id: stored.userId } })
  if (!user) throw { code: 1003, message: 'user not found' }
  return generateTokens(stored.userId, user.role)
}

export async function getUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw { code: 1003, message: 'user not found' }
  return { id: user.id, username: user.username, email: user.email, avatarUrl: user.avatarUrl, role: user.role }
}

// User management
export async function listUsers() {
  return prisma.user.findMany({ select: { id: true, username: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: 'asc' } })
}

const ROLE_LEVEL: Record<string, number> = { super_admin: 4, senior_admin: 3, admin: 2, member: 1 }

function canManage(operator: string | undefined, target: string): boolean {
  const opLevel = ROLE_LEVEL[operator || 'member'] || 0
  const tgtLevel = ROLE_LEVEL[target] || 0
  if (operator === 'senior_admin' && target === 'super_admin') return false
  if (operator === 'admin' && tgtLevel >= 2) return false  // admin can only manage members
  if (operator === 'member') return false
  return true
}

export async function updateUserRole(operatorId: string, targetId: string, newRole: string) {
  const operator = await prisma.user.findUnique({ where: { id: operatorId } })
  const target = await prisma.user.findUnique({ where: { id: targetId } })
  if (!target) throw { code: 1003, message: '用户不存在' }
  if (!canManage(operator?.role, target.role)) throw { code: 1002, message: '没有权限管理此用户' }
  if (ROLE_LEVEL[newRole] > (ROLE_LEVEL[operator?.role || 'member'] || 0)) throw { code: 1002, message: '不能设置高于自己的角色' }
  return prisma.user.update({ where: { id: targetId }, data: { role: newRole }, select: { id: true, username: true, role: true } })
}

export async function createUser(username: string, email: string, password: string, role: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw { code: 1004, message: '邮箱已注册' }
  const passwordHash = await bcrypt.hash(password, 10)
  return prisma.user.create({ data: { username, email, passwordHash, role }, select: { id: true, username: true, email: true, role: true, createdAt: true } })
}

export async function deleteUser(operatorId: string, targetId: string) {
  const operator = await prisma.user.findUnique({ where: { id: operatorId } })
  const target = await prisma.user.findUnique({ where: { id: targetId } })
  if (!target) throw { code: 1003, message: '用户不存在' }
  if (targetId === operatorId) throw { code: 1004, message: '不能删除自己' }
  if (!canManage(operator?.role, target.role)) throw { code: 1002, message: '没有权限删除此用户' }
  return prisma.user.delete({ where: { id: targetId } })
}

export async function changeOwnPassword(userId: string, oldPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw { code: 1003, message: '用户不存在' }
  if (!await bcrypt.compare(oldPassword, user.passwordHash)) throw { code: 1001, message: '当前密码错误' }
  const passwordHash = await bcrypt.hash(newPassword, 10)
  return prisma.user.update({ where: { id: userId }, data: { passwordHash }, select: { id: true } })
}

export async function changeUserPassword(operatorId: string, targetId: string, newPassword: string) {
  const operator = await prisma.user.findUnique({ where: { id: operatorId } })
  const target = await prisma.user.findUnique({ where: { id: targetId } })
  if (!target) throw { code: 1003, message: '用户不存在' }
  if (!canManage(operator?.role, target.role)) throw { code: 1002, message: '不能修改此用户密码' }
  const passwordHash = await bcrypt.hash(newPassword, 10)
  return prisma.user.update({ where: { id: targetId }, data: { passwordHash }, select: { id: true, username: true } })
}

async function generateTokens(userId: string, role: string) {
  const accessToken = jwt.sign({ sub: userId, role }, config.jwtSecret, { expiresIn: config.jwtAccessTTL })
  const raw = crypto.randomBytes(32).toString('base64url')
  const tokenHash = sha256(raw)
  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt: new Date(Date.now() + config.jwtRefreshTTL * 1000) }
  })
  return { accessToken, refreshToken: raw, expiresIn: Math.floor(Date.now() / 1000) + config.jwtAccessTTL }
}

function sha256(s: string): string { return crypto.createHash('sha256').update(s).digest('base64url') }
