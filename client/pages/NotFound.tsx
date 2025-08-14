import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
        <Link to="/dashboard" className="text-blue-500 hover:underline">
          Go Home
        </Link>
      </div>
    </div>
  );
}
