import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CognitoAuthGuard } from '../../src/auth/cognito-auth.guard';

function createMockContext(authHeader?: string): ExecutionContext {
  const request = {
    headers: {
      ...(authHeader && { authorization: authHeader }),
    },
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function encodeJwtPayload(payload: object): string {
  const header = Buffer.from('{"alg":"HS256"}').toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake-signature`;
}

describe('CognitoAuthGuard', () => {
  let guard: CognitoAuthGuard;

  beforeEach(() => {
    guard = new CognitoAuthGuard(new ConfigService());
  });

  it('should reject request without Authorization header', async () => {
    const ctx = createMockContext();
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should reject non-Bearer token', async () => {
    const ctx = createMockContext('Basic abc123');
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should reject malformed JWT (not 3 parts)', async () => {
    const ctx = createMockContext('Bearer not-a-jwt');
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should reject JWT with invalid base64 payload', async () => {
    const ctx = createMockContext('Bearer aaa.!!!invalid!!!.ccc');
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should extract user from valid JWT payload', async () => {
    const token = encodeJwtPayload({
      sub: 'user-123',
      email: 'test@example.com',
    });
    const ctx = createMockContext(`Bearer ${token}`);
    const request = ctx.switchToHttp().getRequest() as { user?: unknown };

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      userId: 'user-123',
      email: 'test@example.com',
    });
  });
});
