const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center h-screen w-full">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--app-primary)]"></div>
        <p className="mt-4 text-[var(--app-muted)]">Loading...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;