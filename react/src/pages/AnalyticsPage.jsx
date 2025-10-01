import AnalyticsSummary from '../components/analytics/AnalyticsSummary';

const AnalyticsPage = () => {
  return (
    <div className="min-h-full bg-[var(--app-bg)] py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
        <AnalyticsSummary />
      </div>
    </div>
  );
};

export default AnalyticsPage;