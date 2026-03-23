import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    try {
      // TODO: Validate JWT against Cognito JWKS
      // For now, decode without verification for local dev
      const payload = this.decodeToken(token);
      (request as Request & { user: AuthenticatedUser }).user = {
        userId: payload.sub,
        email: payload.email,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private decodeToken(token: string): { sub: string; email: string } {
    // Simple base64 decode of JWT payload for local dev
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8'),
    );
    return payload;
  }
}
