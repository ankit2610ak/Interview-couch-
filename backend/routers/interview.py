from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException

from schemas import (
    StartInterviewRequest,
    StartInterviewResponse,
    AnswerRequest,
    AnswerResponse,
)
from services.llm_service import get_next_interviewer_message, validate_interview_topic

router = APIRouter(tags=["interview"])

# Aliases for backward compatibility
AnswerInterviewRequest = AnswerRequest
AnswerInterviewResponse = AnswerResponse


@router.post("/start", response_model=StartInterviewResponse)
def start_interview(payload: StartInterviewRequest):
    """Start an interview session by generating the first interviewer question."""
    # Backend control: Validate topic to reject random gibberish (e.g. xyz, lala, keyboard mashes)
    if not validate_interview_topic(payload.topic):
        raise HTTPException(
            status_code=400,
            detail=(
                f"'{payload.topic}' does not appear to be a valid interview topic. "
                "Please enter a valid technical or professional subject (e.g., Python, System Design, React, SQL, DSA)."
            ),
        )

    first_message, _ = get_next_interviewer_message(
        topic=payload.topic,
        difficulty=payload.difficulty,
        conversation_history=[],
    )
    history: List[Dict[str, Any]] = [
        {"role": "assistant", "content": first_message}
    ]
    return StartInterviewResponse(
        first_message=first_message,
        conversation_history=history,
    )


@router.post("/answer", response_model=AnswerResponse)
def answer_interview(payload: AnswerRequest):
    """Receive the candidate's answer and generate the next interviewer question or conclusion."""
    updated_history: List[Dict[str, Any]] = list(payload.conversation_history)
    updated_history.append({"role": "user", "content": payload.user_answer})

    ai_message, is_complete = get_next_interviewer_message(
        topic=payload.topic,
        difficulty=payload.difficulty,
        conversation_history=updated_history,
    )
    updated_history.append({"role": "assistant", "content": ai_message})

    return AnswerResponse(
        ai_message=ai_message,
        is_complete=is_complete,
        conversation_history=updated_history,
    )
