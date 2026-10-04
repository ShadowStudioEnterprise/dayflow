import { z } from 'zod'
export const emailSchema = z.object({
  email: z.email('Escribe un email válido.'),
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
