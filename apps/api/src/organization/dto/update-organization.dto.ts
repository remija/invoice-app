import {
  IsString,
  IsNumber,
  IsOptional,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AddressDto } from './create-organization.dto';

export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{14}$/, { message: 'SIRET invalide (14 chiffres)' })
  siret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalForm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vatNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  capital?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rcsCity?: string;
}
