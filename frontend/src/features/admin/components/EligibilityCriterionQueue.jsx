import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Tag, X } from 'lucide-react';
import StatusBadge from '../../../components/common/StatusBadge';

const formatSubmitted = (value) => {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString();
};

const authHeaders = (json = false) => {
  const token = localStorage.getItem('token');
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function EligibilityCriterionQueue() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionError, setActionError] = useState('');
  const [selectedAction, setSelectedAction] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/v1/admin/eligibility-criterion-requests', {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load eligibility criterion requests.');
      }

      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (error) {
      setErrorMsg(error.message || 'Failed to load eligibility criterion requests.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const closeAction = () => {
    if (isProcessing) return;
    setSelectedAction(null);
    setRejectionReason('');
    setActionError('');
  };

  const applyUpdatedRequest = (updated) => {
    if (!updated?._id) return;
    setRequests((current) =>
      current.map((request) =>
        String(request._id) === String(updated._id) ? updated : request
      )
    );
  };

  const submitAction = async () => {
    if (!selectedAction) return;

    const isReject = selectedAction.type === 'reject';
    if (isReject && !rejectionReason.trim()) {
      setActionError('A rejection reason is required.');
      return;
    }

    setIsProcessing(true);
    setActionError('');

    try {
      const isFulfillment = selectedAction.type === 'fulfillment';
      const url = isFulfillment
        ? `/api/v1/admin/eligibility-criterion-requests/${selectedAction.id}/fulfillment`
        : `/api/v1/admin/eligibility-criterion-requests/${selectedAction.id}/decision`;

      const body = isFulfillment
        ? { fulfillmentStatus: selectedAction.fulfillmentStatus }
        : {
            decision: isReject ? 'Rejected' : 'Approved',
            rejectionReason: isReject ? rejectionReason.trim() : undefined,
          };

      const res = await fetch(url, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'Unable to update this eligibility criterion request.');
      }

      applyUpdatedRequest(data.request);
      setSelectedAction(null);
      setRejectionReason('');
    } catch (error) {
      setActionError(error.message || 'Unable to update this eligibility criterion request.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-800" />
            Eligibility Criterion Requests
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Review requested tags before changing their progress. Approval does not add a tag to scholarship matching.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {isLoading ? (
        <div className="min-h-[120px] flex items-center justify-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
          Loading criterion requests...
        </div>
      ) : requests.length === 0 ? (
        <p className="text-xs text-slate-500 py-6 text-center">No eligibility criterion requests yet.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const providerName = request.provider?.institutionName || 'Unknown provider';
            const nextFulfillment =
              request.status === 'Approved' && request.fulfillmentStatus === 'Pending'
                ? 'In Progress'
                : request.status === 'Approved' && request.fulfillmentStatus === 'In Progress'
                  ? 'Done'
                  : null;

            return (
              <article
                key={request._id}
                className="border border-slate-200/80 rounded-2xl p-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{request.criterionName}</h4>
                      <span className="px-2 py-0.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700">
                        {request.criterionType}
                      </span>
                      <StatusBadge status={request.status} customLabel={request.status === 'Pending' ? 'Pending review' : request.status} />
                      {request.status === 'Approved' && (
                        <StatusBadge status={request.fulfillmentStatus || 'Pending'} />
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {providerName}
                      {request.provider?.accountEmail ? ` · ${request.provider.accountEmail}` : ''}
                      {' · '}
                      Submitted {formatSubmitted(request.createdAt)}
                    </p>
                  </div>
                </div>

                {request.description && (
                  <p className="text-xs text-slate-600 leading-relaxed">{request.description}</p>
                )}

                {request.status === 'Rejected' && request.rejectionReason && (
                  <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                    Rejection reason: {request.rejectionReason}
                  </p>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  {request.status === 'Pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setActionError('');
                          setRejectionReason('');
                          setSelectedAction({ id: request._id, type: 'reject', name: request.criterionName });
                        }}
                        className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActionError('');
                          setSelectedAction({ id: request._id, type: 'approve', name: request.criterionName });
                        }}
                        className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                    </>
                  )}

                  {nextFulfillment && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionError('');
                        setSelectedAction({
                          id: request._id,
                          type: 'fulfillment',
                          fulfillmentStatus: nextFulfillment,
                          name: request.criterionName,
                        });
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Mark {nextFulfillment}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">
              {selectedAction.type === 'approve' && 'Approve criterion request'}
              {selectedAction.type === 'reject' && 'Reject criterion request'}
              {selectedAction.type === 'fulfillment' && `Mark request ${selectedAction.fulfillmentStatus}`}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {selectedAction.type === 'approve' &&
                `Approve “${selectedAction.name}”? It stays Pending until you move it to In Progress or Done. Approval does not change scholarship matching.`}
              {selectedAction.type === 'reject' &&
                `Reject “${selectedAction.name}”? The reason is shown to the requesting provider. Rejected requests cannot be reopened.`}
              {selectedAction.type === 'fulfillment' &&
                selectedAction.fulfillmentStatus === 'Done' &&
                `Mark “${selectedAction.name}” Done? This sends one completion email to the provider’s registered account email.`}
              {selectedAction.type === 'fulfillment' &&
                selectedAction.fulfillmentStatus !== 'Done' &&
                `Move “${selectedAction.name}” to ${selectedAction.fulfillmentStatus}? This does not send a completion email.`}
            </p>

            {selectedAction.type === 'reject' && (
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Explain why this criterion request is rejected."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-rose-500"
              />
            )}

            {actionError && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                {actionError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAction}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAction}
                disabled={isProcessing}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl cursor-pointer flex items-center gap-2 ${
                  selectedAction.type === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-800 hover:bg-emerald-900'
                }`}
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
