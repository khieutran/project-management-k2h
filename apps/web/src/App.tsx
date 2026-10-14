import { Navigate, Route, Routes } from 'react-router-dom';

import './App.css';
import { CreateProjectPage } from './features/projects/pages/CreateProjectPage';
import { EditProjectPage } from './features/projects/pages/EditProjectPage';
import { ProjectDetailPage } from './features/projects/pages/ProjectDetailPage';
import { ProjectsPage } from './features/projects/pages/ProjectsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { GuestRoute } from './routing/GuestRoute';
import { ProtectedRoute } from './routing/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/new" element={<CreateProjectPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/projects/:projectId/edit" element={<EditProjectPage />} />
      </Route>

      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
