import React, { useState } from 'react';
import { 
  HelpCircle, 
  Search, 
  ChevronDown, 
  Terminal, 
  BookOpen, 
  ShieldCheck, 
  FileCode2,
  AlertOctagon,
  Download
} from 'lucide-react';

const ADMIN_DOCS = [
  {
    category: "Provider Verification",
    q: "What credentials are required to approve a new Grant Provider?",
    a: "Verify SEC/CHED registration documents, government agency charters, or official corporate credentials provided during registration before enabling provider listing capabilities."
  },
  {
    category: "Admin Provisioning",
    q: "How do I securely onboard a new system administrator?",
    a: "Navigate to System Settings -> Provision New Admin. Fill out the full name and official organizational email, then issue an invitation token. Never set default passwords manually; allow the recipient to complete MFA setup via the email token link."
  },
  {
    category: "Security & Auditing",
    q: "How do I handle flagged scholarship listings or reported content?",
    a: "Review reported listings in the Admin Moderation queue. Check for suspicious external URLs or fee demands. Suspend non-compliant listings immediately."
  },
  {
    category: "Data Privacy & Compliance",
    q: "How should student Data Erasure Requests (Right to be Forgotten) be executed?",
    a: "Verify student identity via multi-factor authorization. Soft-delete the account to preserve anonymized analytical data while immediately stripping all Personally Identifiable Information (PII) from user documents and active MongoDB records within 48 hours."
  },
  {
    category: "System Performance",
    q: "When should the Redis Match Cache be purged?",
    a: "Purge cache after major updates to the matching engine threshold rules or database migrations to ensure students receive updated match scores."
  },
  {
    category: "Incident Management",
    q: "How to trigger maintenance mode during emergency hotfixes?",
    a: "Toggle 'Maintenance Mode' under System Settings -> Global Platform Controls. This restricts student and provider access while allowing root admins to deploy updates."
  },
  {
    category: "System Dispatch & Broadcasts",
    q: "What is the policy for sending platform-wide broadcast messages?",
    a: "Global broadcasts must be pre-approved by the Lead Administrator. Use broadcasts only for critical announcements such as scheduled maintenance, major scholarship submission deadlines, or security alerts to prevent notification fatigue."
  },
  {
    category: "Disaster Recovery",
    q: "What is the procedure if MongoDB primary cluster connection fails?",
    a: "Verify network security groups in your cloud provider, check status logs under Database Health, and trigger secondary failover via cluster management. If data corruption occurs, initiate a point-in-time snapshot restore from the Database & System Health panel."
  }
];

export function AdminHelp() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openDoc, setOpenDoc] = useState(null);

  const toggleDoc = (index) => {
    setOpenDoc(openDoc === index ? null : index);
  };

  const filteredDocs = ADMIN_DOCS.filter(item => 
    item.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.a.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Banner */}
      <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-app-text">Admin Knowledge Base & Protocols</h1>
            <p className="text-xs text-text-muted font-medium">
              Operational documentation, compliance standards, and platform administration guides.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative pt-2">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search admin protocols, verification steps, or incident guides..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold focus:outline-hidden focus:border-primary text-app-text"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Accordion Documentation List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-extrabold text-app-text flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Standard Operating Procedures (SOP)
          </h2>

          <div className="space-y-3">
            {filteredDocs.length === 0 ? (
              <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 text-center text-xs text-text-muted">
                No administrative documentation found matching your search term.
              </div>
            ) : (
              filteredDocs.map((doc, idx) => {
                const isOpen = openDoc === idx;
                return (
                  <div 
                    key={idx}
                    className="bg-card-bg rounded-2xl border border-app-text/10 overflow-hidden shadow-xs transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => toggleDoc(idx)}
                      className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-app-bg/50 transition-colors cursor-pointer"
                    >
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                          {doc.category}
                        </span>
                        <p className="text-xs font-bold text-app-text">{doc.q}</p>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${isOpen ? 'rotate-180 text-primary' : ''}`} />
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 text-xs text-text-muted font-medium border-t border-app-text/5 pt-3 leading-relaxed">
                        {doc.a}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Action Emergency Contacts / Guidelines Sidebar */}
        <div className="space-y-4">
          <h2 className="text-sm font-extrabold text-app-text flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Admin Quick Reference
          </h2>

          <div className="bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs space-y-4">
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-app-bg rounded-xl border border-app-text/10 space-y-1">
                <p className="font-bold text-app-text flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5 text-primary" />
                  API SLA Target
                </p>
                <p className="text-text-muted text-[11px]">
                  Engine latency target is &lt;150ms for query matches.
                </p>
              </div>

              <div className="p-3 bg-app-bg rounded-xl border border-app-text/10 space-y-1">
                <p className="font-bold text-app-text flex items-center gap-1.5">
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
                  Escalation Hotline
                </p>
                <p className="text-text-muted text-[11px]">
                  DevOps Lead: <span className="font-mono font-bold text-app-text">ops@iskolarmatch.ph</span>
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-app-text/10">
              <button
                type="button"
                onClick={() => alert("Downloading System SOP Manual PDF...")}
                className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Full Admin Manual (PDF)</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default AdminHelp;