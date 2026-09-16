import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class SwitchOrgDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  organizationId!: string;
}