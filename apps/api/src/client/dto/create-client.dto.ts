import {
  IsString,
  IsOptional,
  IsEmail,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressDto } from '../../organization/dto/create-organization.dto';

export class CreateClientDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'contact@acme.fr' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '123456789', description: 'SIREN (9 chiffres)' })
  @IsOptional()
  @Matches(/^\d{9}$/, { message: 'SIREN invalide (9 chiffres)' })
  siren?: string;

  @ApiPropertyOptional({ example: '12345678900001', description: 'SIRET (14 chiffres)' })
  @IsOptional()
  @Matches(/^\d{14}$/, { message: 'SIRET invalide (14 chiffres)' })
  siret?: string;

  @ApiPropertyOptional({ example: 'FR12345678901' })
  @IsOptional()
  @IsString()
  vatNumber?: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress!: AddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  deliveryAddress?: AddressDto;
}
