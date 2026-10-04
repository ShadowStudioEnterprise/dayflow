import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, Check, Layers2 } from 'lucide-react'
import { authService } from '../../services/supabase/auth-service'
import { backendConfigured } from '../../services/supabase/client'
import {
  loginSchema,
  registrationSchema,
  emailSchema,
  passwordSchema,
} from '../../shared/validation/auth-schemas'
import { Brand } from '../../shared/components/Brand'
import { useAuth } from './auth-context'
import { LocalMailNotice } from './LocalMailNotice'

type Mode = 'login' | 'register' | 'reset' | 'update'
const modes = {
  login: {
    title: 'Un lugar para tu día.',
    intro: 'Inicia sesión y continúa donde lo dejaste.',
    submit: 'Iniciar sesión',
  },
  register: {
    title: 'Haz espacio para lo importante.',
    intro: 'Crea tu cuenta y empieza a organizarte.',
    submit: 'Crear cuenta',
  },
  reset: {
    title: 'Volvamos a entrar.',
    intro: 'Te enviaremos un enlace para recuperar tu contraseña.',
    submit: 'Enviar enlace',
  },
  update: {
    title: 'Una nueva contraseña.',
    intro: 'Elige una contraseña de al menos 12 caracteres.',
    submit: 'Guardar contraseña',
  },
}
interface Fields {
  email?: string
  password?: string
  name?: string
}
export default function AuthPage() {
  const location = useLocation()
  const mode: Mode = location.pathname.endsWith('register')
    ? 'register'
    : location.pathname.endsWith('reset-password')
      ? 'reset'
      : location.pathname.endsWith('update-password')
        ? 'update'
        : 'login'
  return <AuthForm key={mode} mode={mode} />
}
function AuthForm({ mode }: { mode: Mode }) {
  const { user, loading, recovery } = useAuth()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const schema =
    mode === 'register'
      ? registrationSchema
      : mode === 'reset'
        ? emailSchema
        : mode === 'update'
          ? passwordSchema
          : loginSchema
  const formSchema = z
    .object({
      email: z.string().optional(),
      password: z.string().optional(),
      name: z.string().optional(),
    })
    .superRefine((fields, context) => {
      const result = schema.safeParse(fields)
      if (!result.success)
        for (const issue of result.error.issues)
          context.addIssue({
            code: 'custom',
            path: issue.path,
            message: issue.message,
          })
    })
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({ resolver: zodResolver(formSchema) })
  if (recovery && mode !== 'update')
    return <Navigate to="/auth/update-password" replace />
  if (user && !recovery && (mode === 'login' || mode === 'register'))
    return <Navigate to="/" replace />
  const submit = handleSubmit(async (fields) => {
    setError('')
    setSuccess('')
    try {
      if (mode === 'login') await authService.signIn(loginSchema.parse(fields))
      if (mode === 'register') {
        const result = await authService.signUp(
          registrationSchema.parse(fields),
        )
        if (!result.session)
          setSuccess(
            'Revisa tu correo para confirmar tu cuenta y después inicia sesión.',
          )
      }
      if (mode === 'reset') {
        await authService.resetPassword(emailSchema.parse(fields))
        setSuccess(
          'Si existe una cuenta con ese email, recibirás un enlace de recuperación.',
        )
      }
      if (mode === 'update') {
        await authService.updatePassword(passwordSchema.parse(fields))
        await authService.signOut()
        setSuccess('Contraseña guardada. Ya puedes iniciar sesión.')
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo completar la solicitud.',
      )
    }
  })
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">MENOS RUIDO. MÁS CLARIDAD.</span>
          <h1>
            Tu día,
            <br />
            en su sitio.
          </h1>
          <p>
            Ideas, planes y pequeños pasos.
            <br />
            Todo empieza con un poco de espacio.
          </p>
          <div className="story-art" aria-hidden="true">
            <Layers2 size={120} strokeWidth={0.8} />
          </div>
        </div>
        <span className="muted">Diseñado para seguir tu ritmo.</span>
      </aside>
      <main className="auth-main">
        <Link className="back-link" to="/setup">
          <ArrowLeft size={16} /> Conocer Dayflow
        </Link>
        <div className="auth-form">
          <span className="eyebrow">BIENVENIDO A DAYFLOW</span>
          <h2>{modes[mode].title}</h2>
          <p className="muted">{modes[mode].intro}</p>
          {backendConfigured && <LocalMailNotice />}
          {!backendConfigured && (
            <div className="notice">
              El acceso se activará al configurar Supabase. Consulta las
              instrucciones de instalación en README.md.
            </div>
          )}
          {mode === 'update' && !loading && !user && !success && (
            <div className="notice">
              Abre el enlace enviado a tu correo para establecer una contraseña.
            </div>
          )}
          <form onSubmit={submit} noValidate>
            {mode === 'register' && (
              <label>
                Tu nombre
                <input
                  autoComplete="name"
                  {...register('name')}
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name && (
                  <span className="field-error">{errors.name.message}</span>
                )}
              </label>
            )}
            {mode !== 'update' && (
              <label>
                Email
                <input
                  type="email"
                  placeholder="tu@ejemplo.com"
                  autoComplete="email"
                  {...register('email')}
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email && (
                  <span className="field-error">{errors.email.message}</span>
                )}
              </label>
            )}
            {mode !== 'reset' && (
              <label>
                Contraseña
                <input
                  type="password"
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  {...register('password')}
                  aria-invalid={Boolean(errors.password)}
                />
                {errors.password && (
                  <span className="field-error">{errors.password.message}</span>
                )}
              </label>
            )}
            {mode === 'login' && (
              <Link className="text-link" to="/auth/reset-password">
                ¿Has olvidado tu contraseña?
              </Link>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="success-message" role="status">
                <Check size={18} />
                {success}
              </p>
            )}
            <button
              className="button primary full"
              disabled={
                !backendConfigured ||
                isSubmitting ||
                loading ||
                (mode === 'update' && !user)
              }
            >
              {isSubmitting ? 'Un momento…' : modes[mode].submit}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {mode === 'login' ? (
              <>
                ¿Todavía no tienes cuenta?{' '}
                <Link to="/auth/register">Crear cuenta</Link>
              </>
            ) : (
              <Link to="/auth/login">Volver a iniciar sesión</Link>
            )}
          </p>
        </div>
      </main>
    </div>
  )
}
