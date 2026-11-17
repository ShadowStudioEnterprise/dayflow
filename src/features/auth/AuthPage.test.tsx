import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import AuthPage from './AuthPage'
import { AuthContext } from './auth-context'
import { authService } from '../../services/supabase/auth-service'
vi.mock('../../services/supabase/client', () => ({ backendConfigured: true }))
vi.mock('../../services/supabase/auth-service', () => ({
  authService: {
    signIn: vi.fn(),
    signUp: vi.fn(),
    resetPassword: vi.fn(),
    confirmEmail: vi.fn(),
    verifyRecoveryCode: vi.fn(),
    updatePassword: vi.fn(),
    signOut: vi.fn(),
  },
}))
function renderPage(route = '/auth/login') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider
        value={{ user: null, loading: false, error: null, recovery: false }}
      >
        <AuthPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}
describe('formulario de acceso', () => {
  it('valida antes de llamar al servicio', async () => {
    renderPage()
    await userEvent.click(
      screen.getByRole('button', { name: 'Iniciar sesión' }),
    )
    expect(
      await screen.findByText('Escribe un email válido.'),
    ).toBeInTheDocument()
    expect(authService.signIn).not.toHaveBeenCalled()
  })
  it('envía credenciales y presenta errores del servicio', async () => {
    vi.mocked(authService.signIn).mockRejectedValueOnce(
      new Error('Credenciales incorrectas'),
    )
    renderPage()
    await userEvent.type(screen.getByLabelText('Email'), 'ana@ejemplo.com')
    await userEvent.type(
      screen.getByLabelText('Contraseña'),
      'una-contraseña-larga',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Iniciar sesión' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Credenciales incorrectas',
    )
    expect(authService.signIn).toHaveBeenCalledWith({
      email: 'ana@ejemplo.com',
      password: 'una-contraseña-larga',
    })
  })
  it('permite solicitar la recuperación sin exponer si existe la cuenta', async () => {
    renderPage('/auth/reset-password')
    await userEvent.type(screen.getByLabelText('Email'), 'ana@ejemplo.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar correo' }))
    expect(await screen.findByText(/Si existe una cuenta/)).toBeInTheDocument()
    expect(authService.resetPassword).toHaveBeenCalledWith({
      email: 'ana@ejemplo.com',
    })
  })
  it('confirma el código para el correo registrado sin reenviar la contraseña', async () => {
    vi.mocked(authService.signUp).mockResolvedValueOnce({
      user: null,
      session: null,
    })
    renderPage('/auth/register')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Tu nombre'), 'Ana')
    await user.type(screen.getByLabelText('Email'), 'ana@ejemplo.com')
    await user.type(screen.getByLabelText('Contraseña'), 'una-contraseña-larga')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    await user.type(
      await screen.findByLabelText('Código de seis cifras'),
      '018234',
    )
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar correo' }))
    expect(authService.confirmEmail).toHaveBeenCalledWith({
      email: 'ana@ejemplo.com',
      token: '018234',
    })
  })
  it('no permite cambiar la contraseña hasta que Supabase acepte el código', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    vi.mocked(authService.verifyRecoveryCode)
      .mockRejectedValueOnce(new Error('El código no es válido o ha caducado.'))
      .mockResolvedValueOnce(save)
    renderPage('/auth/reset-password')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), 'ana@ejemplo.com')
    await user.click(screen.getByRole('button', { name: 'Enviar correo' }))
    const code = screen.getByLabelText('Código de seis cifras')
    await user.type(code, '012345')
    await user.click(screen.getByRole('button', { name: 'Verificar código' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ha caducado')
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument()
    await user.clear(code)
    await user.type(code, '042123')
    await user.click(screen.getByRole('button', { name: 'Verificar código' }))
    expect(authService.verifyRecoveryCode).toHaveBeenLastCalledWith({
      email: 'ana@ejemplo.com',
      token: '042123',
    })
    await user.type(
      await screen.findByLabelText('Contraseña'),
      'otra-contraseña-larga',
    )
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Contraseña guardada',
    )
    expect(save).toHaveBeenCalledWith({ password: 'otra-contraseña-larga' })
    expect(authService.updatePassword).not.toHaveBeenCalled()
  })
})
