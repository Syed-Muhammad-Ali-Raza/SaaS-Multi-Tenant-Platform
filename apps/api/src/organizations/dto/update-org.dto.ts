import { IsOptional, IsString, MaxLength, IsUrl } from "class-validator";

export class UpdateOrgDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrl?: string;
}