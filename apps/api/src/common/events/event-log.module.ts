import { Global, Module } from '@nestjs/common';
import { EventLogService } from './event-log.service';

@Global()
@Module({
  providers: [EventLogService],
  exports: [EventLogService],
})
export class EventLogModule {}
