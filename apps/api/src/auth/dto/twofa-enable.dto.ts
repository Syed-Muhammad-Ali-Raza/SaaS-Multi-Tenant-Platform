import { IsString, Matches } from "class-validator";

export class EnableTwoFactorDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: "Code must be a 6-digit number" })
  code!: string;
}