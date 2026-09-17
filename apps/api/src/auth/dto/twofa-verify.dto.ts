import { IsNotEmpty, IsString, Matches } from "class-validator";

export class VerifyTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  mfaToken!: string;

  @IsString()
  @Matches(/^[\dA-Za-z-]{6,12}$/, {
    message: "Code must be a 6-digit TOTP code or a valid backup code",
  })
  code!: string;
}