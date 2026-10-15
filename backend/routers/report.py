from fastapi import APIRouter

from schemas import ReportRequest
from services.llm_service import generate_interview_report

router = APIRouter(tags=["report"])

# Alias for backward compatibility
GenerateReportRequest = ReportRequest


@router.post("/generate")
def generate_report(payload: ReportRequest):
    """Generate the structured evaluation report from the full conversation transcript."""
    report = generate_interview_report(
        topic=payload.topic,
        difficulty=payload.difficulty,
        conversation_history=payload.conversation_history,
    )
    return report
