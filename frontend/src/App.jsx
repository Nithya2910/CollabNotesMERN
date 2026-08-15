import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import PrivateRoute from './PrivateRoute';

/**
 * App — root routing configuration.
 *
 * Public routes:  /login, /signup
 * Private routes: /dashboard, /editor/:id (require auth)
 */
const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login"  element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected routes */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard"    element={<Dashboard />} />
          <Route path="/editor/:id"   element={<Editor />} />
        </Route>

        {/* Redirect root to dashboard */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* 404 fallback */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
              <div className="text-center">
                <p className="text-8xl font-bold text-gray-200 dark:text-gray-800">404</p>
                <p className="text-xl text-gray-600 dark:text-gray-400 mt-4">Page not found</p>
                <a href="/dashboard" className="btn-primary mt-6 inline-flex">Go home</a>
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
