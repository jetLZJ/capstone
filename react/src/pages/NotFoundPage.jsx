import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-6xl font-bold text-gray-800 dark:text-white mb-4">404</h1>
      <div className="w-24 h-1 bg-primary-600 mb-8"></div>
      <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">Page Not Found</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8 text-center max-w-md">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link 
        to="/" 
        className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors"
      >
        Return to Home
      </Link>
    </div>
  );
};

export default NotFoundPage;