import { IsOptional, IsUUID } from "class-validator";

export class RefreshDto {
  @IsOptional()
  @IsUUID()
  activeOrgId?: string;
}