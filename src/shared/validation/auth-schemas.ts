import { z } from 'zod'
export const emailSchema = z.object({
  email: z.email('Escribe un email válido.'),
})
export const emailCodeSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Escribe el código de seis cifras.'),
})
export const loginSchema = emailSchema.extend({
  password: z.string().min(1, 'Escribe tu contraseña.'),
})
export const passwordSchema = z.object({
  password: z.string().min(12, 'Utiliza al menos 12 caracteres.').max(128),
})
export const registrationSchema = emailSchema.extend({
  password: passwordSchema.shape.password,
  name: z.string().trim().min(1, 'Escribe tu nombre.').max(100),
})
