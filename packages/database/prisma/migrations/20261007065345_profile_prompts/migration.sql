-- CreateEnum
CREATE TYPE "SexualOrientation" AS ENUM ('STRAIGHT', 'GAY', 'LESBIAN', 'BISEXUAL', 'PANSEXUAL', 'ASEXUAL', 'QUEER', 'UNSURE');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('HIGH_SCHOOL', 'ASSOCIATE', 'BACHELOR', 'MASTER', 'DOCTORATE', 'OTHER');

-- CreateEnum
CREATE TYPE "KidsPreference" AS ENUM ('WANT', 'DONT_WANT', 'HAVE_AND_WANT', 'HAVE_AND_DONT', 'NOT_SURE');

-- CreateEnum
CREATE TYPE "CommunicationStyle" AS ENUM ('TEXTER', 'CALLER', 'VIDEO', 'BAD_TEXTER', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "LoveStyle" AS ENUM ('GESTURES', 'GIFTS', 'TOUCH', 'COMPLIMENTS', 'TIME');

-- CreateEnum
CREATE TYPE "PetStatus" AS ENUM ('DOG', 'CAT', 'OTHER', 'NONE', 'WANT_ONE');

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "communicationStyle" "CommunicationStyle",
ADD COLUMN     "educationLevel" "EducationLevel",
ADD COLUMN     "kids" "KidsPreference",
ADD COLUMN     "loveStyle" "LoveStyle",
ADD COLUMN     "pets" "PetStatus",
ADD COLUMN     "sexualOrientation" "SexualOrientation",
ADD COLUMN     "socialMedia" "LifestyleFrequency";
