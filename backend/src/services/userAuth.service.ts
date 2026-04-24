import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { AppError } from '../errors/AppError';
import { User } from '../models/User';
import { getUserPlan } from './billing.service';

const SALT_ROUNDS = 10;

function signToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError('JWT_SECRET não configurado no servidor', 500);
  }
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as NonNullable<SignOptions['expiresIn']>,
  };
  return jwt.sign({ sub: userId, email }, secret, options);
}

export type PublicUserPlan = 'free' | 'paid';

function planExpiresToIso(
  plan: PublicUserPlan,
  planExpiresAt: Date | string | null | undefined
): string | null {
  if (plan !== 'paid' || planExpiresAt == null) return null;
  const d = planExpiresAt instanceof Date ? planExpiresAt : new Date(planExpiresAt);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function toPublicUser(user: {
  _id: { toString: () => string };
  email: string;
  plan?: string;
  planExpiresAt?: Date | null;
}): {
  id: string;
  email: string;
  plan: PublicUserPlan;
  planExpiresAt: string | null;
} {
  const plan: PublicUserPlan = user.plan === 'paid' ? 'paid' : 'free';
  return {
    id: user._id.toString(),
    email: user.email,
    plan,
    planExpiresAt: planExpiresToIso(plan, user.planExpiresAt),
  };
}

export async function registerUser(email: string, password: string) {
  const normalized = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  try {
    const user = await User.create({ email: normalized, passwordHash });
    const token = signToken(user._id.toString(), user.email);
    return { user: toPublicUser(user), token };
  } catch (e: unknown) {
    if (
      e &&
      typeof e === 'object' &&
      'code' in e &&
      (e as { code: number }).code === 11000
    ) {
      throw new AppError('E-mail já cadastrado', 409);
    }
    throw e;
  }
}

export async function loginUser(email: string, password: string) {
  const normalized = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalized });
  if (!user) {
    throw new AppError('E-mail ou senha inválidos', 401);
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new AppError('E-mail ou senha inválidos', 401);
  }
  const token = signToken(user._id.toString(), user.email);
  const userId = user._id.toString();
  await getUserPlan(userId);
  const doc = await User.findById(user._id)
    .select({ email: 1, plan: 1, planExpiresAt: 1 })
    .lean();
  if (!doc) {
    throw new AppError('Utilizador não encontrado', 404);
  }
  return { user: toPublicUser(doc), token };
}
