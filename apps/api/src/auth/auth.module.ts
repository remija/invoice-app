import { Module } from '@nestjs/common';
import { CognitoAuthGuard } from './cognito-auth.guard';

@Module({
  providers: [CognitoAuthGuard],
  exports: [CognitoAuthGuard],
})
export class AuthModule {}
