import { Matches, MaxLength, MinLength, IsEmail, IsNotEmpty, IsString } from "class-validator";

export class RegisterDto {
  @IsEmail({}, { message: "Invalid email address" })
  email!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/, {
    message:
      "Password must contain uppercase, lowercase, number, and special character",
  })
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  orgName!: string;
}