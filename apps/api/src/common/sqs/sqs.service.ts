import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

export interface SqsMessage {
  type: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class SqsService {
  private readonly logger = new Logger(SqsService.name);
  private readonly client: SQSClient;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('SQS_ENDPOINT');
    this.client = new SQSClient({
      region: this.config.get<string>('AWS_REGION', 'eu-west-3'),
      ...(endpoint && { endpoint }),
    });
  }

  async send(queueUrl: string, message: SqsMessage): Promise<void> {
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      MessageGroupId: message.type,
    });

    try {
      await this.client.send(command);
      this.logger.log(`Message sent to ${queueUrl}: ${message.type}`);
    } catch (error) {
      this.logger.error(`Failed to send message to ${queueUrl}`, error);
      throw error;
    }
  }

  async sendToQueue(queueName: string, message: SqsMessage): Promise<void> {
    const queueUrlKey = `SQS_${queueName.toUpperCase().replace(/-/g, '_')}_QUEUE_URL`;
    const queueUrl = this.config.get<string>(queueUrlKey);
    if (!queueUrl) {
      throw new Error(`Queue URL not configured for: ${queueUrlKey}`);
    }
    await this.send(queueUrl, message);
  }
}
