export class CreateOrganizationCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly siren: string,
    public readonly siret: string,
    public readonly address: {
      street: string;
      city: string;
      zip: string;
      country: string;
    },
    public readonly legalForm: string,
    public readonly vatNumber?: string,
    public readonly capital?: string,
    public readonly rcsCity?: string,
  ) {}
}
