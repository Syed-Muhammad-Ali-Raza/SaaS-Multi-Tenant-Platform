import { Matches, MaxLength, MinLength, IsString, IsNotEmpty } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/, {
    message:
      "Password must contain uppercase, lowercase, number, and special character",
  })
  password!: string;
}