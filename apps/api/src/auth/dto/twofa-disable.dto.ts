import { IsString, Matches } from "class-validator";

export class DisableTwoFactorDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: "Code must be a 6-digit number" })
  code!: string;
}