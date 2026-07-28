import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { prisma } from '../index'
import { AppError } from '../utils/AppError'

export async function login(account: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: account }, { username: account }] },
  })
  if (!user)
    throw new AppError(1001, '用户名/邮箱或密码错误')
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid)
    throw new AppError(1001, '用户名/邮箱或密码错误')
  return generateTokens(user.id, user.role)
}

export async function register(username: string, email: string, password: string) {
  const existingEmail = await prisma.user.findUnique({ where: { email } })
  if (existingEmail)
    throw new AppError(1004, '邮箱已注册')
  const existingUsername = await prisma.user.findUnique({ where: { username } })
  if (existingUsername)
    throw new AppError(1004, '用户名已存在')
  const userCount = await prisma.user.count()
  const role = userCount === 0 ? 'super_admin' : 'user'
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({ data: { username, email, passwordHash, role } })
  return generateTokens(user.id, user.role)
}

export async function refresh(refreshToken: string) {
  const hash = sha256(refreshToken)
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash: hash, revoked: false, expiresAt: { gt: new Date() } },
  })
  if (!stored)
    throw new AppError(1001, 'invalid or expired refresh token')
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } })
  const user = await prisma.user.findUnique({ where: { id: stored.userId } })
  if (!user)
    throw new AppError(1003, 'user not found')
  return generateTokens(stored.userId, user.role)
}

export async function getUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user)
    throw new AppError(1003, 'user not found')
  return { id: user.id, username: user.username, email: user.email, avatarUrl: user.avatarUrl, role: user.role }
}

// User management
export async function listUsers() {
  return prisma.user.findMany({ select: { id: true, username: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: 'asc' } })
}

const ROLE_LEVEL: Record<string, number> = { super_admin: 3, admin: 2, user: 1 }

function canManage(operator: string | undefined, target: string): boolean {
  if (operator === 'super_admin')
    return true
  if (operator === 'admin')
    return target !== 'super_admin' // admin can manage members and other admins
  return false
}

export async function updateUserRole(operatorId: string, targetId: string, newRole: string) {
  const operator = await prisma.user.findUnique({ where: { id: operatorId } })
  const target = await prisma.user.findUnique({ where: { id: targetId } })
  if (!target)
    throw new AppError(1003, '用户不存在')
  if (!canManage(operator?.role, target.role))
    throw new AppError(1002, '没有权限管理此用户')
  if (ROLE_LEVEL[newRole] > (ROLE_LEVEL[operator?.role || 'user'] || 0))
    throw new AppError(1002, '不能设置高于自己的角色')
  return prisma.user.update({ where: { id: targetId }, data: { role: newRole }, select: { id: true, username: true, role: true } })
}

export async function createUser(username: string, email: string, password: string, role: string, operatorRole?: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing)
    throw new AppError(1004, '邮箱已注册')
  if (operatorRole === 'admin' && role !== 'user')
    throw new AppError(1002, '系统管理员只能创建普通用户')
  const passwordHash = await bcrypt.hash(password, 10)
  return prisma.user.create({ data: { username, email, passwordHash, role }, select: { id: true, username: true, email: true, role: true, createdAt: true } })
}

export async function deleteUser(operatorId: string, targetId: string) {
  const operator = await prisma.user.findUnique({ where: { id: operatorId } })
  const target = await prisma.user.findUnique({ where: { id: targetId } })
  if (!target)
    throw new AppError(1003, '用户不存在')
  if (targetId === operatorId)
    throw new AppError(1004, '不能删除自己')
  if (!canManage(operator?.role, target.role))
    throw new AppError(1002, '没有权限删除此用户')
  return prisma.user.delete({ where: { id: targetId } })
}

export async function changeOwnPassword(userId: string, oldPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user)
    throw new AppError(1003, '用户不存在')
  if (!await bcrypt.compare(oldPassword, user.passwordHash))
    throw new AppError(1001, '当前密码错误')
  const passwordHash = await bcrypt.hash(newPassword, 10)
  return prisma.user.update({ where: { id: userId }, data: { passwordHash }, select: { id: true } })
}

export async function changeUserPassword(operatorId: string, targetId: string, newPassword: string) {
  const operator = await prisma.user.findUnique({ where: { id: operatorId } })
  const target = await prisma.user.findUnique({ where: { id: targetId } })
  if (!target)
    throw new AppError(1003, '用户不存在')
  if (!canManage(operator?.role, target.role))
    throw new AppError(1002, '不能修改此用户密码')
  const passwordHash = await bcrypt.hash(newPassword, 10)
  return prisma.user.update({ where: { id: targetId }, data: { passwordHash }, select: { id: true, username: true } })
}

async function generateTokens(userId: string, role: string) {
  const accessToken = jwt.sign({ sub: userId, role }, config.jwtSecret, { expiresIn: config.jwtAccessTTL })
  const raw = crypto.randomBytes(32).toString('base64url')
  const tokenHash = sha256(raw)
  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt: new Date(Date.now() + config.jwtRefreshTTL * 1000) },
  })
  return { accessToken, refreshToken: raw, expiresIn: Math.floor(Date.now() / 1000) + config.jwtAccessTTL }
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('base64url')
}
