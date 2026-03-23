import {
  IsString,
  IsOptional,
  IsNumber,
  ValidateNested,
  Length,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddressDto {
  @ApiProperty()
  @IsString()
  street!: string;

  @ApiProperty()
  @IsString()
  city!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d{5}$/, { message: 'Code postal invalide (5 chiffres)' })
  zip!: string;

  @ApiProperty({ default: 'FR' })
  @IsString()
  @Length(2, 2)
  country!: string;
}

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Mon Entreprise' })
  @IsString()
  name!: string;

  @ApiProperty({ example: '123456789', description: 'SIREN (9 chiffres)' })
  @IsString()
  @Matches(/^\d{9}$/, { message: 'SIREN invalide (9 chiffres)' })
  siren!: string;

  @ApiProperty({ example: '12345678900001', description: 'SIRET (14 chiffres)' })
  @IsString()
  @Matches(/^\d{14}$/, { message: 'SIRET invalide (14 chiffres)' })
  siret!: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @ApiProperty({ example: 'micro-entrepreneur' })
  @IsString()
  legalForm!: string;

  @ApiPropertyOptional({ example: 'FR12345678901' })
  @IsOptional()
  @IsString()
  vatNumber?: string;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber()
  capital?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rcsCity?: string;
}
