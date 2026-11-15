import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import LandingRoute from './routes/LandingRoute';
import RoomRoute from './routes/RoomRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/rooms/:roomCode" element={<RoomRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster theme="dark" position="top-center" toastOptions={{
        style: { background: 'var(--color-panel)', border: '1px solid var(--color-line)', color: 'var(--color-text)' },
      }} />
    </BrowserRouter>
  );
}
