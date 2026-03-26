import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SireneService } from './sirene.service';

@Module({
  imports: [HttpModule],
  providers: [SireneService],
  exports: [SireneService],
})
export class SireneModule {}
