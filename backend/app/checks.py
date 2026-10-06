"""Deterministic readiness checks. Each function is pure: given an evidence
bundle (plain dicts gathered via the read-only tools) it returns a
CheckResult. No check ever calls the model and none of them approve, reject,
or score a claim -- they only report pass / fail / unknown with a reason and
the evidence IDs that justify it.
"""
from datetime import date
from typing import TypedDict

from app.schemas import AssessmentStatus, CheckResult

REQUIRED_DOCUMENT_TYPES = ["claim_form", "id_document", "police_report"]
HISTORY_WINDOW_MONTHS = 24


class Evidence(TypedDict):
    claim: dict
    customer: dict
    policy: dict
    wording: dict
    documents: list[dict]
    billing: dict | None
    history: list[dict]


def _months_between(earlier: date, later: date) -> int:
    return (later.year - earlier.year) * 12 + (later.month - earlier.month)


def _incident_date_sources(evidence: Evidence) -> list[tuple[str, str, str]]:
    """Returns (label, iso_date, evidence_id) for every known account of the incident date."""
    claim = evidence["claim"]
    sources = [("claim form", claim["incident_date"], claim["claim_id"])]
    for doc in evidence["documents"]:
        if doc["type"] == "police_report" and doc.get("fields", {}).get("incident_date"):
            sources.append(("police report", doc["fields"]["incident_date"], doc["doc_id"]))
    return sources


def check_policy_in_force(evidence: Evidence) -> CheckResult:
    policy = evidence["policy"]
    start = date.fromisoformat(policy["cover_start_date"])
    end = date.fromisoformat(policy["cover_end_date"])
    sources = _incident_date_sources(evidence)
    evidence_ids = [policy["policy_id"]] + [s[2] for s in sources]

    out_of_range = [s for s in sources if not (start <= date.fromisoformat(s[1]) <= end)]
    if out_of_range:
        details = "; ".join(f"{label} says {iso} ({eid})" for label, iso, eid in out_of_range)
        return CheckResult(
            check_id="policy_in_force", label="Policy in force", status="fail",
            reason=(
                f"Policy {policy['policy_id']} is in force {start.isoformat()} to {end.isoformat()}, "
                f"but {details} falls outside that period."
            ),
            evidence_ids=evidence_ids,
        )
    return CheckResult(
        check_id="policy_in_force", label="Policy in force", status="pass",
        reason=f"All known incident dates fall within the policy period {start.isoformat()} to {end.isoformat()}.",
        evidence_ids=evidence_ids,
    )


def check_incident_date_consistency(evidence: Evidence) -> CheckResult:
    sources = _incident_date_sources(evidence)
    evidence_ids = [s[2] for s in sources]
    if len(sources) < 2:
        return CheckResult(
            check_id="incident_date_consistency", label="Incident date consistency", status="unknown",
            reason="Only one source for the incident date is available, so it cannot be corroborated.",
            evidence_ids=evidence_ids,
        )
    distinct_dates = {s[1] for s in sources}
    if len(distinct_dates) == 1:
        return CheckResult(
            check_id="incident_date_consistency", label="Incident date consistency", status="pass",
            reason=f"All {len(sources)} sources agree the incident occurred on {sources[0][1]}.",
            evidence_ids=evidence_ids,
        )
    details = "; ".join(f"{label} says {iso} ({eid})" for label, iso, eid in sources)
    return CheckResult(
        check_id="incident_date_consistency", label="Incident date consistency", status="fail",
        reason=f"Sources disagree on the incident date: {details}.",
        evidence_ids=evidence_ids,
    )


def check_premium_paid(evidence: Evidence) -> CheckResult:
    billing = evidence["billing"]
    policy_id = evidence["policy"]["policy_id"]
    if billing is None:
        return CheckResult(
            check_id="premium_paid", label="Premium paid", status="unknown",
            reason=f"No billing record was found for policy {policy_id} for the incident month.",
            evidence_ids=[policy_id],
        )
    if billing["status"] == "paid":
        return CheckResult(
            check_id="premium_paid", label="Premium paid", status="pass",
            reason=f"The premium debit for {billing['month']} succeeded.",
            evidence_ids=[billing["bill_id"]],
        )
    reason = f"The premium debit for {billing['month']} has status '{billing['status']}'"
    if billing.get("bounce_reason"):
        reason += f" ({billing['bounce_reason'].replace('_', ' ')})"
    reason += "."
    return CheckResult(
        check_id="premium_paid", label="Premium paid", status="fail", reason=reason,
        evidence_ids=[billing["bill_id"]],
    )


def check_cover_type_matches_loss(evidence: Evidence) -> CheckResult:
    policy = evidence["policy"]
    claim = evidence["claim"]
    cover_type = policy["cover_type"]
    claim_type = claim["claim_type"]
    if cover_type == "third_party_only" and claim_type == "own_damage":
        return CheckResult(
            check_id="cover_type_matches_loss", label="Cover type matches loss", status="fail",
            reason=(
                f"Policy {policy['policy_id']} is third-party-only cover, which does not include own-damage "
                f"claims, but this claim is for own damage."
            ),
            evidence_ids=[policy["policy_id"], claim["claim_id"]],
        )
    return CheckResult(
        check_id="cover_type_matches_loss", label="Cover type matches loss", status="pass",
        reason=f"Cover type '{cover_type}' includes a '{claim_type}' claim.",
        evidence_ids=[policy["policy_id"], claim["claim_id"]],
    )


def check_vehicle_matches_policy(evidence: Evidence) -> CheckResult:
    policy = evidence["policy"]
    claim = evidence["claim"]
    claim_reg = claim.get("vehicle_registration")
    claim_vin = claim.get("vehicle_vin")
    if not claim_reg and not claim_vin:
        return CheckResult(
            check_id="vehicle_matches_policy", label="Vehicle matches policy", status="unknown",
            reason="The claim does not record a vehicle registration or VIN to compare.",
            evidence_ids=[claim["claim_id"]],
        )
    for vehicle in policy["vehicles"]:
        if vehicle["registration"] == claim_reg or vehicle["vin"] == claim_vin:
            return CheckResult(
                check_id="vehicle_matches_policy", label="Vehicle matches policy", status="pass",
                reason=f"Vehicle {claim_reg} ({vehicle['vehicle_id']}) is listed on policy {policy['policy_id']}.",
                evidence_ids=[policy["policy_id"], claim["claim_id"]],
            )
    return CheckResult(
        check_id="vehicle_matches_policy", label="Vehicle matches policy", status="fail",
        reason=f"Vehicle {claim_reg or claim_vin} on the claim is not listed on policy {policy['policy_id']}.",
        evidence_ids=[policy["policy_id"], claim["claim_id"]],
    )


def check_driver_listed(evidence: Evidence) -> CheckResult:
    policy = evidence["policy"]
    claim = evidence["claim"]
    driver_id = claim.get("driver_id_number")
    driver_name = claim.get("driver_name")
    if not driver_id and not driver_name:
        return CheckResult(
            check_id="driver_listed", label="Driver listed", status="unknown",
            reason="The claim does not record who was driving.",
            evidence_ids=[claim["claim_id"]],
        )
    for listed in policy["listed_drivers"]:
        if listed.get("id_number") == driver_id or listed.get("name") == driver_name:
            return CheckResult(
                check_id="driver_listed", label="Driver listed", status="pass",
                reason=f"{driver_name} is a listed driver on policy {policy['policy_id']}.",
                evidence_ids=[policy["policy_id"], claim["claim_id"]],
            )
    return CheckResult(
        check_id="driver_listed", label="Driver listed", status="fail",
        reason=f"{driver_name} is not among the drivers listed on policy {policy['policy_id']}.",
        evidence_ids=[policy["policy_id"], claim["claim_id"]],
    )


def check_police_report_present(evidence: Evidence) -> CheckResult:
    claim_id = evidence["claim"]["claim_id"]
    for doc in evidence["documents"]:
        if doc["type"] == "police_report" and doc.get("fields", {}).get("case_number"):
            return CheckResult(
                check_id="police_report_present", label="Police report present", status="pass",
                reason=f"Police report {doc['doc_id']} is attached with case number {doc['fields']['case_number']}.",
                evidence_ids=[doc["doc_id"]],
            )
    return CheckResult(
        check_id="police_report_present", label="Police report present", status="fail",
        reason="No police report with a case number is attached to this claim.",
        evidence_ids=[claim_id],
    )


def _driver_is_listed(evidence: Evidence) -> bool:
    policy = evidence["policy"]
    claim = evidence["claim"]
    driver_id = claim.get("driver_id_number")
    driver_name = claim.get("driver_name")
    return any(
        listed.get("id_number") == driver_id or listed.get("name") == driver_name
        for listed in policy["listed_drivers"]
    )


def check_excess_estimate(evidence: Evidence) -> CheckResult:
    policy = evidence["policy"]
    excess = policy["excess"]
    basic = excess["basic_excess"]
    total = basic
    applied = []
    if not _driver_is_listed(evidence):
        for extra in excess.get("additional_excesses", []):
            if extra.get("applies_if") == "unlisted_or_inexperienced_driver":
                total += extra["amount"]
                applied.append(extra)
    if applied:
        extras_text = "; ".join(f"{a['reason']} R {a['amount']:,}" for a in applied)
        reason = f"Estimated excess: basic R {basic:,} + {extras_text} = R {total:,} (informational, confirm against the policy schedule)."
    else:
        reason = f"Estimated excess: basic R {basic:,} (informational, confirm against the policy schedule)."
    return CheckResult(
        check_id="excess_estimate", label="Excess estimate", status="pass", reason=reason,
        evidence_ids=[policy["policy_id"]],
    )


def check_prior_claims(evidence: Evidence) -> CheckResult:
    claim = evidence["claim"]
    incident = date.fromisoformat(claim["incident_date"])
    relevant = [
        h for h in evidence["history"]
        if _months_between(date.fromisoformat(h["incident_date"]), incident) <= HISTORY_WINDOW_MONTHS
        and date.fromisoformat(h["incident_date"]) <= incident
    ]
    if not relevant:
        return CheckResult(
            check_id="prior_claims", label="Prior claims (context)", status="pass",
            reason=f"No prior claims recorded on vehicle {claim['vehicle_id']} in the last {HISTORY_WINDOW_MONTHS} months.",
            evidence_ids=[claim["vehicle_id"]],
        )
    reason = (
        f"{len(relevant)} prior claim(s) recorded on vehicle {claim['vehicle_id']} in the last "
        f"{HISTORY_WINDOW_MONTHS} months. Shown for context only; this is not a finding against the claim."
    )
    return CheckResult(
        check_id="prior_claims", label="Prior claims (context)", status="pass", reason=reason,
        evidence_ids=[h["history_id"] for h in relevant],
    )


def check_required_documents(evidence: Evidence) -> CheckResult:
    claim = evidence["claim"]
    present_types = {d["type"] for d in evidence["documents"]}
    missing = [t for t in REQUIRED_DOCUMENT_TYPES if t not in present_types]
    present_doc_ids = [d["doc_id"] for d in evidence["documents"] if d["type"] in REQUIRED_DOCUMENT_TYPES]
    if missing:
        return CheckResult(
            check_id="required_documents", label="Required documents", status="fail",
            reason=f"Missing required document(s): {', '.join(missing)}.",
            evidence_ids=[claim["claim_id"]] + present_doc_ids,
        )
    return CheckResult(
        check_id="required_documents", label="Required documents", status="pass",
        reason="All required documents (claim form, ID document, police report) are present.",
        evidence_ids=present_doc_ids,
    )


CHECKS: list = [
    check_policy_in_force,
    check_incident_date_consistency,
    check_premium_paid,
    check_cover_type_matches_loss,
    check_vehicle_matches_policy,
    check_driver_listed,
    check_police_report_present,
    check_excess_estimate,
    check_prior_claims,
    check_required_documents,
]


def run_all_checks(evidence: Evidence) -> list[CheckResult]:
    return [check(evidence) for check in CHECKS]


def derive_status(checks: list[CheckResult]) -> AssessmentStatus:
    if any(c.status in ("fail", "unknown") for c in checks):
        return "REVIEW_REQUIRED"
    return "READY_FOR_HUMAN_REVIEW"
