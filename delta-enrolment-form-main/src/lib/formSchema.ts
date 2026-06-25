import { z } from "zod";

export const formSchema = z.object({
  fullName:          z.string().min(2, "Please enter your full name").max(100).optional(),
  email:             z.string().email("Please enter a valid email address").optional(),
  phone:             z.string().min(7, "Please enter a valid phone number").max(20).optional(),
  emergency:         z.string().min(7, "Please enter an emergency contact").max(20).optional(),
  gender:            z.string().optional(),
  dob:               z.string().optional(),
  nationality:       z.string().min(2, "Please enter your nationality").optional(),
  homeCountry:       z.string().min(2, "Please enter your home country").optional(),
  occupation:        z.string().min(2, "Please enter your occupation").optional(),
  emiratesId:        z.string().min(6, "Please enter your Emirates ID").optional(),
  countryAttendance: z.string().optional(),
  permanentAddress:  z.string().min(5, "Please enter your permanent address").optional(),
  residencyAddress:  z.string().min(5, "Please enter your UAE residency address").optional(),
  passportFile:      z.any().optional(),
  photoFile:         z.any().optional(),
  level:             z.string().optional(),
  startDate:         z.string().optional(),
  source:            z.string().optional(),
  courses:           z.string().optional(),
  payment:           z.string().optional(),
  termsAgreed:       z.string().optional(),
});

export type FormData = z.infer<typeof formSchema>;

export const getFieldError = (fieldName: keyof FormData, errors: any): string | undefined => {
  return errors[fieldName]?.message as string | undefined;
};
