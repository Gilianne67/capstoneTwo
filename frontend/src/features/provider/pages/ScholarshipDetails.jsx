import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  GraduationCap,
  MapPin,
  Wallet,
  Tag,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Building2,
  Users,
  Scale
} from 'lucide-react';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://api.iskolarmatch.ph/v1';

export default function ScholarshipDetails() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [scholarship, setScholarship] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchScholarship = async () => {
      try {
        setIsLoading(true);
        setError('');

        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('Authentication token not found.');
        }

        const response = await fetch(
          `${API_BASE_URL}/scholarships/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || 'Failed to load scholarship details.'
          );
        }

        setScholarship(data.scholarship);
      } catch (err) {
        console.error('Failed to fetch scholarship:', err);
        setError(
          err.message || 'Failed to load scholarship details.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchScholarship();
    }
  }, [id]);

  const formatDate = (date) => {
    if (!date) return 'Not specified';

    return new Date(date).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatIncome = (income) => {
    if (
      income === null ||
      income === undefined ||
      income === ''
    ) {
      return 'No maximum income requirement';
    }

    return `₱${Number(income).toLocaleString()}`;
  };

  const renderList = (items) => {
    if (!items || items.length === 0) {
      return (
        <span className="text-sm text-slate-400">
          None specified
        </span>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
          >
            {item}
          </span>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-sm text-slate-500">
          Loading scholarship details...
        </p>
      </div>
    );
  }

  if (error || !scholarship) {
    return (
      <div className="max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => navigate('/dashboard/provider/listings')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Scholarship Listings
        </button>

        <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />

          <h2 className="text-lg font-bold text-slate-900">
            Unable to Load Scholarship
          </h2>

          <p className="text-sm text-slate-500 mt-2">
            {error || 'Scholarship could not be found.'}
          </p>
        </div>
      </div>
    );
  }

  const academicRequirements =
    Array.isArray(scholarship.academicRequirements) &&
    scholarship.academicRequirements.length > 0
      ? scholarship.academicRequirements
      : scholarship.academicRequirement?.gradingScale
        ? [scholarship.academicRequirement]
        : [];

  const hardFilters =
    scholarship.hardFilters || {};

  const geographicLocation =
    hardFilters.geographicLocation || {};

  const incomeRequirement =
    scholarship.incomeRequirement || {};

  const criteriaWeights =
    scholarship.criteriaWeights || {};

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-6">

      {/* Back Button */}
      <button
        type="button"
        onClick={() => navigate('/dashboard/provider/listings')}
        className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Scholarship Listings
      </button>

      {/* ===================================== */}
      {/* HEADER */}
      {/* ===================================== */}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">

        <div className="p-6 md:p-8">

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">

            <div className="space-y-3">

              <div className="flex items-center gap-2 flex-wrap">

                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    scholarship.status === 'Open'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {scholarship.status}
                </span>

                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold">
                  {scholarship.scholarshipType}
                </span>

              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                {scholarship.name}
              </h1>

              <p className="text-sm text-slate-500">
                Scholarship listing details and eligibility requirements
              </p>

            </div>

            <div className="flex flex-col items-start md:items-end gap-2">

              <span className="text-xs text-slate-400 font-medium">
                Grant Value
              </span>

              <span className="text-2xl font-bold text-emerald-600">
                {scholarship.grantValue}
              </span>

            </div>

          </div>

        </div>

      </div>

      {/* ===================================== */}
      {/* DESCRIPTION & BENEFITS */}
      {/* ===================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">

          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-emerald-600" />

            <h2 className="font-bold text-slate-900">
              Scholarship Description
            </h2>
          </div>

          <p className="text-sm text-slate-600 leading-7 whitespace-pre-line">
            {scholarship.description}
          </p>

        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">

          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-emerald-600" />

            <h2 className="font-bold text-slate-900">
              Scholarship Information
            </h2>
          </div>

          <div className="space-y-4">

            <div>
              <p className="text-xs text-slate-400">
                Grant Value
              </p>

              <p className="text-sm font-semibold text-slate-800 mt-1">
                {scholarship.grantValue}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Deadline
              </p>

              <p className="text-sm font-semibold text-slate-800 mt-1 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                {formatDate(scholarship.deadline)}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Ranking Mode
              </p>

              <p className="text-sm font-semibold text-slate-800 mt-1">
                {scholarship.rankingMode}
              </p>
            </div>

          </div>

        </div>

      </div>

      {/* ===================================== */}
      {/* BENEFITS */}
      {/* ===================================== */}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">

        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />

          <h2 className="font-bold text-slate-900">
            Benefits
          </h2>
        </div>

        {scholarship.benefits?.length > 0 ? (
          <div className="space-y-2">
            {scholarship.benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-sm text-slate-600"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />

                <span>{benefit}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            No benefits specified.
          </p>
        )}

      </div>

      {/* ===================================== */}
      {/* ELIGIBILITY */}
      {/* ===================================== */}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">

        <div className="flex items-center gap-2 mb-6">
          <GraduationCap className="w-5 h-5 text-emerald-600" />

          <h2 className="font-bold text-slate-900">
            Eligibility Requirements
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Academic */}
          <div className="border border-slate-100 rounded-xl p-4">

            <h3 className="text-sm font-bold text-slate-800 mb-4">
              Academic Requirements
            </h3>

            <div className="space-y-4">

              {academicRequirements.length > 0 ? (
                academicRequirements.map((requirement, index) => {
                  const scale =
                    requirement.gradingScale === '1-5'
                      ? '1.00-5.00'
                      : requirement.gradingScale;
                  const isInverseScale = scale === '1.00-5.00';

                  return (
                    <div key={`${scale || 'scale'}-${index}`}>
                      <p className="text-xs text-slate-400">
                        {isInverseScale
                          ? 'Maximum Allowable GWA'
                          : 'Minimum Required GPA'}
                      </p>

                      <p className="text-sm font-semibold text-slate-800 mt-1">
                        {requirement.minimumGPA}
                        {scale ? ` (${scale})` : ''}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div>
                  <p className="text-xs text-slate-400">
                    Academic Grading Scale
                  </p>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    Not specified
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-slate-400">
                  Academic Level
                </p>

                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {hardFilters.academicLevel}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">
                  Course / Program
                </p>

                <div className="mt-2">
                  {renderList(hardFilters.courseProgram)}
                </div>
              </div>

            </div>

          </div>

          {/* Financial */}
          <div className="border border-slate-100 rounded-xl p-4">

            <h3 className="text-sm font-bold text-slate-800 mb-4">
              Financial & Citizenship Requirements
            </h3>

            <div className="space-y-4">

              <div>
                <p className="text-xs text-slate-400">
                  Maximum Household Income
                </p>

                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {formatIncome(incomeRequirement.maximumIncome)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">
                  Citizenship Status
                </p>

                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {hardFilters.citizenshipStatus || 'Not specified'}
                </p>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* ===================================== */}
      {/* LOCATION */}
      {/* ===================================== */}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">

        <div className="flex items-center gap-2 mb-5">
          <MapPin className="w-5 h-5 text-emerald-600" />

          <h2 className="font-bold text-slate-900">
            Geographic Eligibility
          </h2>
        </div>

        <div className="space-y-5">

          <div>
            <p className="text-xs text-slate-400 mb-2">
              Regions
            </p>

            {renderList(geographicLocation.regions)}
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-2">
              Provinces
            </p>

            {renderList(geographicLocation.provinces)}
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-2">
              Municipalities / Cities
            </p>

            {renderList(geographicLocation.municipalities)}
          </div>

        </div>

      </div>

      {/* ===================================== */}
      {/* SPECIAL ELIGIBILITY */}
      {/* ===================================== */}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">

        <div className="flex items-center gap-2 mb-5">
          <Tag className="w-5 h-5 text-emerald-600" />

          <h2 className="font-bold text-slate-900">
            Special Eligibility
          </h2>
        </div>

        {scholarship.specialTags?.length > 0 ? (

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            {scholarship.specialTags.map((tag, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 border border-slate-100 rounded-xl p-3"
              >

                <span className="text-sm font-medium text-slate-700">
                  {tag.tagName}
                </span>

                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                    tag.mode === 'Exclusive'
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {tag.mode}
                </span>

              </div>
            ))}

          </div>

        ) : (

          <p className="text-sm text-slate-400">
            No special eligibility requirements specified.
          </p>

        )}

      </div>

      {/* ===================================== */}
      {/* RANKING WEIGHTS */}
      {/* ===================================== */}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">

        <div className="flex items-center gap-2 mb-5">
          <Scale className="w-5 h-5 text-emerald-600" />

          <h2 className="font-bold text-slate-900">
            Matching Criteria Weights
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-400">
              GPA / GWA
            </p>

            <p className="text-xl font-bold text-slate-900 mt-1">
              {((criteriaWeights.gwaWeight ?? 0) * 100).toFixed(0)}%
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-400">
              Income
            </p>

            <p className="text-xl font-bold text-slate-900 mt-1">
              {((criteriaWeights.incomeWeight ?? 0) * 100).toFixed(0)}%
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-400">
              Special Eligibility
            </p>

            <p className="text-xl font-bold text-slate-900 mt-1">
              {((criteriaWeights.tagsWeight ?? 0) * 100).toFixed(0)}%
            </p>
          </div>

        </div>

      </div>

      {/* ===================================== */}
      {/* APPLICATION */}
      {/* ===================================== */}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          <div>
            <h2 className="font-bold text-slate-900">
              Application
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              External application portal for this scholarship.
            </p>
          </div>

          {scholarship.applicationURL && (
            <a
              href={scholarship.applicationURL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Open Application Portal
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

        </div>

      </div>

      {/* ===================================== */}
      {/* FOOTER META */}
      {/* ===================================== */}

      <div className="flex flex-col md:flex-row md:justify-between gap-2 text-[11px] text-slate-400 px-1">

        <span>
          Created: {formatDate(scholarship.createdAt)}
        </span>

        <span>
          Last Updated: {formatDate(scholarship.updatedAt)}
        </span>

      </div>

    </div>
  );
}