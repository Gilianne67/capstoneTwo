# IskolarMatch Regression Checklist

Use this with the executable cases in `docs/REGRESSION_TEST_CASES.md`.

Record Pass, Fail, or Blocked on the case itself. This file is the run plan: what must run after every staging merge, what must run before a prototype presentation or final defense, and what can be skipped when a change is limited to one module.

Environment: Vite on `http://localhost:5173` and the API on `http://localhost:5000`. Cases assume that dev server, because several admin screens call `/api` through the Vite proxy.

---

## A. Master regression checklist

Check a row only after the case in `REGRESSION_TEST_CASES.md` has a status.

### Authentication & RBAC

- [ ] AUTH-001 Student registration
- [ ] AUTH-002 Provider registration
- [ ] AUTH-003 Admin registration rejected
- [ ] AUTH-004 Valid login
- [ ] AUTH-005 Invalid credentials
- [ ] AUTH-006 Missing email or password
- [ ] AUTH-007 Logout
- [ ] AUTH-008 Session restoration
- [ ] AUTH-009 Missing token
- [ ] AUTH-010 Invalid or expired token
- [ ] AUTH-011 Student blocked from provider routes
- [ ] AUTH-012 Provider blocked from student routes
- [ ] AUTH-013 Student blocked from admin routes
- [ ] AUTH-014 Provider blocked from admin routes
- [ ] AUTH-015 Admin opens admin routes
- [ ] AUTH-016 Role-based redirects
- [ ] AUTH-017 Duplicate email
- [ ] AUTH-018 Provider organization required
- [ ] AUTH-019 Short password
- [ ] AUTH-020 Signed-out dashboard redirect
- [ ] AUTH-021 Forgot password, unknown email
- [ ] AUTH-022 Forgot password does not open a reset page

### Student registration & onboarding

- [ ] STU-001 Registration opens onboarding
- [ ] STU-002 Adult onboarding saves
- [ ] STU-003 Required onboarding fields
- [ ] STU-004 Adult date of birth is accepted
- [ ] STU-005 Under-18 registration is rejected
- [ ] STU-006 Guest cannot open onboarding
- [ ] STU-007 Provider cannot open student onboarding
- [ ] STU-008 Onboarding values survive refresh
- [ ] STU-009 Invalid academic values rejected
- [ ] STU-010 Dashboard opens while profile is still incomplete

### Student profile

- [ ] PROF-001 Profile loads
- [ ] PROF-002 Province, municipality, and GWA save
- [ ] PROF-003 Profile survives refresh
- [ ] PROF-004 Profile survives logout and login
- [ ] PROF-005 Empty GWA blocked
- [ ] PROF-006 Completion gate
- [ ] PROF-007 Incomplete profile blocks search and matches
- [ ] PROF-008 Complete profile allows matching
- [ ] PROF-009 Profile is only the signed-in student
- [ ] PROF-010 Provider cannot update a student profile

### Adult-only student access

- [ ] AGE-001 Under-18 registration rejected
- [ ] AGE-002 Invalid, future, missing, 18, and 19+ dates
- [ ] AGE-003 Under-18 onboarding rejected
- [ ] AGE-004 Adult onboarding persists without a guardian
- [ ] AGE-005 Active student with no date of birth cannot log in
- [ ] AGE-006 Existing token without a date of birth is rejected
- [ ] AGE-007 Date of birth only on the user record
- [ ] AGE-008 Date of birth only on the student profile
- [ ] AGE-009 Conflicting dates of birth are denied
- [ ] AGE-010 Provider without a date of birth
- [ ] AGE-011 Administrator is not age-checked
- [ ] AGE-012 Consent routes are gone

### Provider registration & onboarding

- [ ] PROV-001 Provider registration
- [ ] PROV-002 Kept on onboarding
- [ ] PROV-003 Organization and representative saved
- [ ] PROV-004 Document type and size
- [ ] PROV-005 Pending Review after submit
- [ ] PROV-006 Pending restrictions
- [ ] PROV-007 Student cannot open provider onboarding
- [ ] PROV-008 Guest cannot open provider onboarding
- [ ] PROV-009 Provider cannot change verification status
- [ ] PROV-010 Verification page
- [ ] PROV-011 Analytics is simulated
- [ ] PROV-012 Pending state survives a new login

### Provider verification

- [ ] VER-001 Pending status persists
- [ ] VER-002 Pending cannot create a scholarship
- [ ] VER-003 Queue lists the provider
- [ ] VER-004 Admin can open details and the file
- [ ] VER-005 Provider cannot self-approve
- [ ] VER-006 Admin approval sets Verified
- [ ] VER-007 Approval persists
- [ ] VER-008 Verified provider can create
- [ ] VER-009 Empty rejection blocked
- [ ] VER-010 Rejection stores the reason
- [ ] VER-011 Rejection persists
- [ ] VER-012 Rejected login refused
- [ ] VER-013 Existing session refused
- [ ] VER-014 Rejected create refused

### Scholarship management

- [ ] SCH-001 Create
- [ ] SCH-002 Required fields
- [ ] SCH-003 Both academic scales
- [ ] SCH-004 Income cap
- [ ] SCH-005 Location scopes
- [ ] SCH-006 Course list
- [ ] SCH-007 Exclusive and preferred tags
- [ ] SCH-008 Weights total 100
- [ ] SCH-009 URL and deadline
- [ ] SCH-010 Open and Closed
- [ ] SCH-011 Edit
- [ ] SCH-012 Archive
- [ ] SCH-013 Owner isolation
- [ ] SCH-014 Student details
- [ ] SCH-015 Expiry then Closed
- [ ] SCH-016 Closed excluded from matching
- [ ] SCH-017 Archived excluded
- [ ] SCH-018 Pending create still forbidden
- [ ] SCH-019 Student cannot create
- [ ] SCH-020 Custom criterion is not a matching tag

### Scholarship search

- [ ] SEARCH-001 Keyword
- [ ] SEARCH-002 Degree level
- [ ] SEARCH-003 No course dropdown
- [ ] SEARCH-004 Region filter, Nationwide remains
- [ ] SEARCH-005 No income dropdown
- [ ] SEARCH-006 Eligibility flags
- [ ] SEARCH-007 Empty query result
- [ ] SEARCH-008 Incomplete profile
- [ ] SEARCH-009 API failure, no mock cards
- [ ] SEARCH-010 Minimum score
- [ ] SEARCH-011 Sort
- [ ] SEARCH-012 Reset

### Matching

- [ ] MATCH-001 Academic level
- [ ] MATCH-002 Course alias
- [ ] MATCH-003 Course mismatch
- [ ] MATCH-004 Empty course list
- [ ] MATCH-005 GWA 1.00–5.00
- [ ] MATCH-006 GWA 60–100
- [ ] MATCH-007 Both scales
- [ ] MATCH-008 Income cap
- [ ] MATCH-009 Top income bracket
- [ ] MATCH-010 No income cap
- [ ] MATCH-011 Region scope
- [ ] MATCH-012 Province scope
- [ ] MATCH-013 Municipality scope
- [ ] MATCH-014 Nationwide
- [ ] MATCH-015 Citizenship
- [ ] MATCH-016 Exclusive tag
- [ ] MATCH-017 Preferred tag
- [ ] MATCH-018 Weights
- [ ] MATCH-019 Score 84 / Recommended
- [ ] MATCH-020 Rank order
- [ ] MATCH-021 Hard filter omitted
- [ ] MATCH-022 Closed excluded
- [ ] MATCH-023 Archived excluded
- [ ] MATCH-024 Expired excluded
- [ ] MATCH-025 Incomplete profile
- [ ] MATCH-026 Complete profile match
- [ ] MATCH-027 Wrong role
- [ ] MATCH-028 Match Feed API failure

### Saved scholarships

- [ ] SAVE-001 Save
- [ ] SAVE-002 Unsave
- [ ] SAVE-003 Refresh
- [ ] SAVE-004 Logout and login
- [ ] SAVE-005 Expired row stays saved
- [ ] SAVE-006 Closed and archived stay saved
- [ ] SAVE-007 Invalid id
- [ ] SAVE-008 Empty and failed load

### Notifications / deadline alerts

- [ ] NOTIF-001 Alert within 7 days
- [ ] NOTIF-002 3-day and 24-hour copy
- [ ] NOTIF-003 Expired hidden
- [ ] NOTIF-004 Closed hidden
- [ ] NOTIF-005 Archived hidden
- [ ] NOTIF-006 Mark read
- [ ] NOTIF-007 Empty state
- [ ] NOTIF-008 Profile update is not a deadline card
- [ ] NOTIF-009 Provider forbidden

### Admin

- [ ] ADMIN-001 Admin login
- [ ] ADMIN-002 Dashboard loads
- [ ] ADMIN-003 Pending verification count
- [ ] ADMIN-004 No guardian-consent queue
- [ ] ADMIN-005 Queue filters
- [ ] ADMIN-006 Details and document
- [ ] ADMIN-007 Approve persists and unlocks provider
- [ ] ADMIN-008 Reject needs a reason
- [ ] ADMIN-009 Reject persists and blocks login
- [ ] ADMIN-010 Admin API RBAC
- [ ] ADMIN-011 Content Moderation prototype
- [ ] ADMIN-013 Audit prototype
- [ ] ADMIN-014 Settings prototype
- [ ] ADMIN-015 Admin notifications prototype
- [ ] ADMIN-016 Admin help prototype
- [ ] ADMIN-017 Signed-out admin URL
- [ ] ADMIN-018 Moderation UI does not publish scholarships

### Document security

- [ ] DOC-001 No token
- [ ] DOC-002 Student denied
- [ ] DOC-003 Other provider denied
- [ ] DOC-004 Owner allowed
- [ ] DOC-005 Admin allowed
- [ ] DOC-006 Unknown file
- [ ] DOC-007 `/uploads` is not public
- [ ] DOC-008 Viewer uses the protected route

### Navigation

- [ ] NAV-001 Homepage
- [ ] NAV-002 Login and registration URLs
- [ ] NAV-003 Student dashboard
- [ ] NAV-004 Provider dashboard
- [ ] NAV-005 Admin dashboard
- [ ] NAV-006 Student onboarding redirect
- [ ] NAV-007 Provider onboarding and pending
- [ ] NAV-008 Verification queue by role
- [ ] NAV-009 Scholarship details
- [ ] NAV-010 Student sidebar pages
- [ ] NAV-011 Provider help
- [ ] NAV-012 Unknown route
- [ ] NAV-013 Retired settings and alerts routes
- [ ] NAV-014 Logout redirect
- [ ] NAV-015 `/dashboard` by role
- [ ] NAV-016 Consent URL is not available
- [ ] NAV-017 Homepage simulator is not matching
- [ ] NAV-018 Pending provider can open verification only

### Security

- [ ] SEC-001 Anonymous protected APIs
- [ ] SEC-002 Student cannot call provider or admin writes
- [ ] SEC-003 Provider cannot call student APIs
- [ ] SEC-004 Under-18 and missing date of birth blocked
- [ ] SEC-005 Rejected provider blocked except logout
- [ ] SEC-006 Self-verify blocked
- [ ] SEC-007 Cross-provider scholarship edit blocked
- [ ] SEC-008 Document rules
- [ ] SEC-009 Admin signup blocked and consent API absent
- [ ] SEC-010 Rate limit
- [ ] SEC-011 Public health check
- [ ] SEC-012 Cannot reassign `providerId`

### End to end

- [ ] E2E-001 Student register → onboard → profile → match → details → save
- [ ] E2E-002 Provider register → onboard → approve → create scholarship
- [ ] E2E-003 Provider register → onboard → reject → cannot create
- [ ] E2E-004 Adult register, onboard, and match; under 18 rejected
- [ ] E2E-005 Deadline passes → hidden from match/search → Closed
- [ ] E2E-006 Approved provider scholarship appears in Match Feed
- [ ] E2E-007 Rejection stops the current session and the next login

---

## B. Critical smoke test suite

Run this set after every merge to staging. It is the smallest set that still covers sign-in, role walls, the 18+ student gate, provider approval, scholarship create, matching, save, documents, and the three main end-to-end paths.

Stop the staging release if any case here fails.

| ID | Why it is in smoke |
| --- | --- |
| AUTH-001 | Student account can be created |
| AUTH-002 | Provider account can be created |
| AUTH-003 | Admin self-registration stays closed |
| AUTH-004 | Valid login |
| AUTH-005 | Bad password |
| AUTH-007 | Logout |
| AUTH-008 | Refresh keeps the session |
| AUTH-009 | Missing token |
| AUTH-011 | Student cannot open provider pages |
| AUTH-013 | Student cannot open admin pages |
| AUTH-015 | Admin can open admin |
| AUTH-016 | Role redirect |
| STU-001 | Signup lands on onboarding |
| STU-002 | Adult onboarding saves |
| STU-005 | Under-18 registration is rejected |
| PROF-002 | Profile save |
| PROF-003 | Profile survives refresh |
| PROF-004 | Profile survives a new login |
| PROF-006 | Completion rules |
| PROF-007 | Incomplete profile blocks discovery |
| PROF-008 | Complete profile can match |
| AGE-001 | Under-18 registration rejected |
| AGE-005 | Student with no date of birth cannot log in |
| AGE-006 | Existing token without a date of birth is rejected |
| PROV-001 | Provider signup |
| PROV-005 | Onboarding reaches Pending Review |
| PROV-006 | Pending provider is restricted |
| PROV-009 | Provider cannot self-verify |
| VER-002 | Pending create is forbidden |
| VER-003 | Queue shows the provider |
| VER-006 | Approval writes Verified |
| VER-007 | Approval survives refresh |
| VER-008 | Verified provider can create |
| VER-009 | Rejection needs a reason |
| VER-012 | Rejected provider cannot log in |
| VER-013 | Old session is cut off |
| SCH-001 | Scholarship create |
| SCH-002 | Required scholarship fields |
| SCH-013 | Provider sees only own listings |
| SCH-015 | Expiry removes the scholarship and then closes it |
| SEARCH-001 | Keyword search |
| SEARCH-007 | Empty search |
| SEARCH-008 | Incomplete search state |
| SEARCH-009 | Search failure shows no fake cards |
| MATCH-001 | Academic level |
| MATCH-002 | Course alias |
| MATCH-005 | 1.00–5.00 GWA |
| MATCH-007 | Both scales |
| MATCH-008 | Income |
| MATCH-016 | Exclusive tag |
| MATCH-019 | Score and classification |
| MATCH-021 | Failed hard filter is omitted |
| MATCH-024 | Expired omitted |
| MATCH-025 | Incomplete profile returns no matches |
| MATCH-026 | Complete profile returns the scholarship |
| SAVE-001 | Save |
| SAVE-003 | Save survives refresh |
| SAVE-004 | Save survives login |
| NOTIF-001 | Deadline alert for a saved scholarship inside 7 days |
| ADMIN-001 | Admin login |
| ADMIN-002 | Operations dashboard current totals, pending actions, activity, and alerts |
| ADMIN-007 | Approve from the admin UI |
| ADMIN-008 | Reject reason required |
| ADMIN-010 | Admin APIs reject other roles |
| DOC-001 | Document requires a token |
| DOC-004 | Owner can view |
| DOC-005 | Admin can view |
| DOC-007 | `/uploads` is not public |
| NAV-007 | Provider onboarding and pending URLs |
| SEC-001 | Anonymous API wall |
| SEC-002 | Student cannot write provider or admin data |
| SEC-004 | Under-18 and missing date of birth blocked |
| SEC-005 | Rejected provider API wall |
| SEC-007 | Cannot edit another provider's scholarship |
| E2E-001 | Student path |
| E2E-002 | Provider approval path |
| E2E-006 | Match reaches the student |

Smoke total: 77 cases.

E2E-003, E2E-004, E2E-005, and E2E-007 are not in every staging smoke run because they need extra accounts and a deadline edit. They are required in the full suite before a defense.

---

## C. Full regression suite

Run every ID in section A before a prototype presentation or final defense.

That is 219 cases:

| Module | IDs | Count |
| --- | --- | --- |
| Authentication & RBAC | AUTH-001–AUTH-022 | 22 |
| Student registration & onboarding | STU-001–STU-010 | 10 |
| Student profile | PROF-001–PROF-010 | 10 |
| Adult-only student access | AGE-001–AGE-012 | 12 |
| Provider registration & onboarding | PROV-001–PROV-012 | 12 |
| Provider verification | VER-001–VER-014 | 14 |
| Scholarship management | SCH-001–SCH-020 | 20 |
| Scholarship search | SEARCH-001–SEARCH-012 | 12 |
| Matching | MATCH-001–MATCH-028 | 28 |
| Saved scholarships | SAVE-001–SAVE-008 | 8 |
| Notifications | NOTIF-001–NOTIF-009 | 9 |
| Admin | ADMIN-001–ADMIN-011, ADMIN-013–ADMIN-018 | 17 |
| Document security | DOC-001–DOC-008 | 8 |
| Navigation | NAV-001–NAV-018 | 18 |
| Security | SEC-001–SEC-012 | 12 |
| End to end | E2E-001–E2E-007 | 7 |

Include the prototype cases ADMIN-011 and ADMIN-013 through ADMIN-016, PROV-011, and NAV-017. A pass means the screen tells the truth about not saving. A pass does not mean the feature stores data.

Skip SEC-010 on a shared staging server. It can lock the IP for 10 minutes.

---

## D. Module-to-test-case matrix

| If the merge changes… | Run these | Safe to skip |
| --- | --- | --- |
| `authController`, `AuthContext`, `AuthPage`, `auth.js` | AUTH-001–AUTH-022, AGE-001–AGE-012, SEC-001, SEC-004, SEC-005, SEC-009, NAV-002, NAV-014, NAV-015 | MATCH score cases, scholarship field cases, admin prototype pages |
| Student onboarding form or `userController` onboarding | STU-001–STU-010, AGE-001–AGE-012, SEC-004, E2E-004 | Provider verification, admin prototype pages |
| `StudentProfile` or `StudentProfile.jsx` | PROF-001–PROF-010, MATCH-025, MATCH-026, SEARCH-008, STU-010 | Provider document cases |
| Matching service or course catalog | MATCH-001–MATCH-028, SEARCH-001–SEARCH-009, SCH-015–SCH-017, E2E-001, E2E-005, E2E-006 | Admin prototype pages, forgot password |
| Scholarship model or `CreateListing` / scholarship controller | SCH-001–SCH-020, MATCH-022–MATCH-024, SEARCH-003–SEARCH-005, E2E-005 | Adult-only access, admin settings |
| Provider onboarding or verification | PROV-001–PROV-012, VER-001–VER-014, ADMIN-003, ADMIN-005–ADMIN-010, DOC-001–DOC-008, E2E-002, E2E-003, E2E-007 | GWA score math |
| Saved scholarships | SAVE-001–SAVE-008, NOTIF-001–NOTIF-007 | Admin settings |
| Notification service or Deadline Alerts | NOTIF-001–NOTIF-009, SAVE-005, SAVE-006 | Course alias cases |
| Admin dashboard or verification queue | ADMIN-001–ADMIN-010, ADMIN-017, VER-003–VER-013 | Homepage simulator |
| Admin prototype pages only | ADMIN-011, ADMIN-013–ADMIN-016 | Matching, adult-only access, documents |
| Document routes | DOC-001–DOC-008, SEC-008, VER-004 | Ranking weights |
| `App.jsx` routes or sidebar | NAV-001–NAV-018, AUTH-011–AUTH-016, AUTH-020 | Score arithmetic, unless a route to Match Feed moved |
| Security middleware only | SEC-001–SEC-012, AUTH-003, AUTH-009–AUTH-014, DOC-001–DOC-003, DOC-007 | Prototype copy, unless middleware blocks those pages |
| Any staging merge, unknown blast radius | Section B smoke | Nothing in section B |
| Presentation or final defense | Section C, all 219 | Only SEC-010 on shared staging |

When two rows apply, run the union. Do not skip a smoke case because the change looks unrelated if the diff touches auth, matching, scholarships, or routing.

---

## E. Test data and test account requirements

Create these before the run. Use a new email stamp for destructive cases so a failed run can be repeated.

| Account | How to get it | Used by |
| --- | --- | --- |
| Admin | Must already exist in MongoDB. Signup cannot create it. | ADMIN, VER, E2E-002, E2E-003, E2E-006, E2E-007 |
| Adult student | Register in AUTH-001 or STU-001, then finish onboarding | Profile, search, save |
| Complete College student | Adult student plus province, municipality, citizenship, GWA scale | MATCH, SEARCH, E2E-001, E2E-006 |
| Under-18 attempt | Register with a date of birth under 18. The attempt must be rejected and must not create an account. | AGE-001, STU-005, E2E-004 |
| Pending provider | Register and submit onboarding with a PDF | PROV, VER, E2E-002 |
| Verified provider | Admin approves a pending provider | SCH, MATCH setup, E2E-006 |
| Second verified provider | Same, separate organization | SCH-013, SEC-007, DOC-003 |
| Rejected provider | Admin rejects with a written reason | VER-010–VER-014, E2E-003, E2E-007 |

Shared student values and the shared scholarship are at the top of `REGRESSION_TEST_CASES.md`.

Files:

- One PDF under 10 MB for provider onboarding.
- One `.txt` file for the rejected upload check.
- Optional file over 10 MB.

Adult-only access:

- A missing date of birth is a failed access check. Do not fill one in during the test and then mark the account as passing.
- Do not delete the student or profile row when access is denied.

Deadline alerts:

- NOTIF-001 needs a scholarship deadline 5 days ahead, status Open, and the student must save it.
- E2E-005 needs a deadline that has already ended in Asia/Manila.

Do not use homepage CHED, DOST, or SM cards as data. They are not database scholarships.

Cleanup: accounts and scholarships named with `QA` or `qa.` are temporary. Removing them is optional on a local database. Do not change a shared admin password.

---

## F. Known prototype limitations

These are current product limits. A test fails when the UI hides the limit or claims data was saved. A test does not fail because the feature is absent.

| Surface | What is true today | Cases |
| --- | --- | --- |
| Content Moderation | Not stored. Resolve and remove are not saved. | ADMIN-011, ADMIN-018 |
| Audit & Compliance | No audit log is connected. Summary text says it is not evaluated. | ADMIN-013 |
| System Settings | Controls do not save. Password change on that screen is unavailable. | ADMIN-014 |
| Admin Notifications | Broadcasts are not sent. Mark-read is not saved. | ADMIN-015 |
| Admin Help | Notes are not live procedures. No support hotline is connected. | ADMIN-016 |
| Provider analytics | No analytics route. The page shows simulated metrics and says the API is offline. | PROV-011 |
| Homepage featured scholarships | Fixed CHED, DOST-SEI, and SM cards. Not the database. | NAV-017 |
| Homepage eligibility checker | Labeled Instant Matching Simulator. Local arithmetic only. | NAV-017 |
| Forgot password | API returns success and logs a link. There is no reset page and no working reset email. | AUTH-022 |
| Application tracker | `ApplicationTracker.jsx` is not routed. | NAV-013 |
| Custom eligibility requests | A provider can submit a request. No admin screen approves it into matching. | SCH-020 |
| Scholarship admin status API | `PATCH /api/v1/admin/scholarships/:id/status` can write `Published` or `Rejected`, which matching does not use. The moderation screen does not operate that workflow. | ADMIN-018 |
| Expiration job | Expired scholarships leave matching immediately. Status becomes Closed when a provider opens listings or the provider dashboard, not from a clock inside server startup. | SCH-015, MATCH-024, E2E-005 |
| Search filters | Keyword, degree, three regions, eligibility flags, and minimum score exist. Course and income are matching rules, not search dropdowns. Nationwide scholarships stay visible under a region filter. | SEARCH-003, SEARCH-004, SEARCH-005 |
| Redis blacklist | If Redis is down, logout still clears the browser token, but the old JWT is not revoked. | AUTH-007 |

Student Help and Provider Help are static FAQ pages. They are implemented. They are not in the prototype list above.
