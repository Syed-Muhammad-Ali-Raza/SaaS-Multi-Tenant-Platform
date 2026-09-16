import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateOrgDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}