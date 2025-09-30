const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center h-screen w-full">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-300">Loading...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;