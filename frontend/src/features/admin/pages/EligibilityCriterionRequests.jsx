import PageHeader from '../../../components/common/PageHeader';
import EligibilityCriterionQueue from '../components/EligibilityCriterionQueue';

export default function EligibilityCriterionRequests() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Eligibility Criterion Requests"
        subtitle="Review requested tags, then move approved requests from Pending to In Progress and Done."
      />
      <EligibilityCriterionQueue />
    </div>
  );
}
