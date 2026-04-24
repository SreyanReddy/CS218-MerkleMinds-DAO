import { render, screen } from '@testing-library/react';
import App from './App';

test('renders DAO Governance heading', () => {
  render(<App />);
  const heading = screen.getByText(/DAO Governance DApp/i);
  expect(heading).toBeInTheDocument();
});

test('renders Connect MetaMask button', () => {
  render(<App />);
  const button = screen.getByText(/Connect MetaMask/i);
  expect(button).toBeInTheDocument();
});
