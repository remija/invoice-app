export class UpdateOrganizationCommand {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly name?: string,
    public readonly siret?: string,
    public readonly vatNumber?: string,
    public readonly address?: {
      street: string;
      city: string;
      zip: string;
      country: string;
    },
    public readonly legalForm?: string,
    public readonly capital?: string,
    public readonly rcsCity?: string,
  ) {}
}
