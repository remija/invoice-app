import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GetOrganizationQuery } from './get-organization.query';

@QueryHandler(GetOrganizationQuery)
export class GetOrganizationHandler
  implements IQueryHandler<GetOrganizationQuery>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetOrganizationQuery) {
    const organization = await this.prisma.organization.findUnique({
      where: { cognitoUserId: query.userId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }
}
