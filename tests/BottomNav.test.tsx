import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { BottomNav } from '../src/shell/BottomNav'

describe('BottomNav', () => {
  it('renders five nav links', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /log/i })).toHaveAttribute('href', '/log')
    expect(screen.getByRole('link', { name: /stats/i })).toHaveAttribute('href', '/stats')
    expect(screen.getByRole('link', { name: /share/i })).toHaveAttribute('href', '/share')
    expect(screen.getByRole('link', { name: /more/i })).toHaveAttribute('href', '/more')
  })
})
