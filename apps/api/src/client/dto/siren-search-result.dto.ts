import { ApiProperty } from '@nestjs/swagger';

export class SireneAddressDto {
  @ApiProperty()
  street!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  zip!: string;

  @ApiProperty()
  country!: string;
}

export class SirenSearchResultDto {
  @ApiProperty({ example: '123456789' })
  siren!: string;

  @ApiProperty({ example: 'Ma Société SAS' })
  name!: string;

  @ApiProperty()
  address!: SireneAddressDto;
}
