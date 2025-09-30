import AnalyticsSummary from '../components/analytics/AnalyticsSummary';

const AnalyticsPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Analytics Dashboard</h1>
      <AnalyticsSummary />
    </div>
  )
}

export default AnalyticsPage;